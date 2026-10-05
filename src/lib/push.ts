import { savePushSubscription, removePushSubscription, sendTestPushNotification } from './api';

// Clave pública VAPID válida NIST P-256
const DEFAULT_VAPID_PUBLIC_KEY = 'BNd_XfAkNboyk51qnrN2MT6XjEuT_YmWjMIErc5blTt_9UMCL_KFgh3RrRTEHcyNJOspLtIDyz8aMKBYD_pG9E0';

export function getVapidPublicKey(): string {
  return (import.meta as any).env?.PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function serializeSubscription(subscription: PushSubscription): any {
  const json = typeof subscription.toJSON === 'function' ? subscription.toJSON() : {};
  let p256dh = json.keys?.p256dh;
  let auth = json.keys?.auth;

  if (!p256dh && typeof subscription.getKey === 'function') {
    p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
  }
  if (!auth && typeof subscription.getKey === 'function') {
    auth = arrayBufferToBase64Url(subscription.getKey('auth'));
  }

  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: p256dh || '',
      auth: auth || ''
    }
  };
}

export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window || 'serviceWorker' in navigator;
}

export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestPermissionSafe(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied';

  try {
    const result = Notification.requestPermission();
    if (result && typeof (result as any).then === 'function') {
      return await result;
    }
  } catch (err) {
    console.warn('[push] Error con Promise en requestPermission:', err);
  }

  return new Promise<NotificationPermission>((resolve) => {
    try {
      Notification.requestPermission((status) => resolve(status));
    } catch {
      resolve(Notification.permission || 'denied');
    }
  });
}

/**
 * Obtiene el ServiceWorkerRegistration activo o lo registra si no existe.
 */
export async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    }
    return reg || null;
  } catch (err) {
    console.warn('[push] Error obteniendo registro de ServiceWorker:', err);
    return null;
  }
}

/**
 * Espera a que el ServiceWorker esté activo (sin colgarse).
 */
export async function waitForActiveRegistration(registration: ServiceWorkerRegistration): Promise<ServiceWorkerRegistration> {
  if (registration.active && registration.active.state === 'activated') {
    return registration;
  }

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
  if (registration.installing) {
    registration.installing.postMessage({ type: 'SKIP_WAITING' });
  }

  // 1. Intentar con navigator.serviceWorker.ready con timeout de 3s
  try {
    const readyPromise = navigator.serviceWorker.ready;
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const readyReg = await Promise.race([readyPromise, timeoutPromise]);
    if (readyReg && readyReg.active) {
      return readyReg;
    }
  } catch (e) {}

  // 2. Escuchar statechange si hay un worker en transición
  const sw = registration.installing || registration.waiting || registration.active;
  if (sw && sw.state !== 'activated') {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2500);
      const onStateChange = () => {
        if (sw.state === 'activated') {
          sw.removeEventListener('statechange', onStateChange);
          clearTimeout(timer);
          resolve();
        }
      };
      sw.addEventListener('statechange', onStateChange);
    });
  }

  const latest = await navigator.serviceWorker.getRegistration();
  return latest || registration;
}

/**
 * Crea o recupera la suscripción con múltiples estrategias de buffer (Uint8Array y ArrayBuffer)
 */
export async function createPushSubscription(registration: ServiceWorkerRegistration): Promise<{ subscription: PushSubscription | null; error?: string }> {
  const vapidKey = getVapidPublicKey();
  const rawKey = urlBase64ToUint8Array(vapidKey);

  // 1. Si ya existe suscripción previa, verificar si es válida
  try {
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const s = serializeSubscription(existing);
      if (s.endpoint && s.keys.p256dh && s.keys.auth) {
        return { subscription: existing };
      }
      try {
        await existing.unsubscribe();
      } catch (e) {}
    }
  } catch (e) {
    console.warn('[push] Error inspeccionando suscripción previa:', e);
  }

  let lastError = '';

  // 2. Intento 1 con Uint8Array
  try {
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: rawKey as unknown as BufferSource
    });
    if (sub) return { subscription: sub };
  } catch (err1: any) {
    lastError = err1?.name ? `${err1.name}: ${err1.message}` : String(err1);
    console.warn('[push] Intento 1 (Uint8Array) falló:', lastError);
  }

  // 3. Intento 2 con rawKey.buffer (necesario en Android Chrome/Samsung Internet)
  try {
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: rawKey.buffer as unknown as BufferSource
    });
    if (sub) return { subscription: sub };
  } catch (err2: any) {
    lastError = err2?.name ? `${err2.name}: ${err2.message}` : String(err2);
    console.warn('[push] Intento 2 (ArrayBuffer) falló:', lastError);
  }

  return { 
    subscription: null, 
    error: lastError || 'El navegador no pudo generar la suscripción push.' 
  };
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const registration = await getSWRegistration();
    if (!registration || !registration.pushManager) return null;
    return await registration.pushManager.getSubscription();
  } catch (err) {
    console.warn('[push] Error obteniendo suscripción:', err);
    return null;
  }
}

export async function subscribeToPush(rawMemberId: string): Promise<{ success: boolean; error?: string; permission?: string }> {
  if (typeof window === 'undefined') return { success: false, error: 'No browser window' };

  const memberId = rawMemberId.trim();
  if (!memberId || isNaN(Number(memberId))) {
    return { success: false, error: 'ID de usuario inválido' };
  }

  if (isIOS() && !isStandalone()) {
    return {
      success: false,
      error: 'En iPhone/iPad necesitás agregar la app a la Pantalla de Inicio para activar notificaciones.'
    };
  }

  let permission: NotificationPermission = 'default';
  try {
    if ('Notification' in window) {
      permission = Notification.permission;
      if (permission === 'default') {
        permission = await requestPermissionSafe();
      }
    }
  } catch (permErr: any) {
    return { success: false, error: 'Error solicitando permiso: ' + (permErr?.message || permErr) };
  }

  if (permission !== 'granted') {
    return {
      success: false,
      permission,
      error: permission === 'denied'
        ? 'Las notificaciones están bloqueadas en tu navegador. Habilitalas desde los ajustes del sitio.'
        : 'Permiso de notificaciones no concedido.'
    };
  }

  if (!('serviceWorker' in navigator)) {
    return { success: false, error: 'Tu navegador no soporta Service Workers' };
  }

  let registration = await getSWRegistration();
  if (!registration) {
    return {
      success: false,
      error: 'No se pudo conectar con el Service Worker (recargá la página e intentá nuevamente).'
    };
  }

  registration = await waitForActiveRegistration(registration);

  if (!registration.pushManager) {
    return {
      success: false,
      error: 'PushManager no está disponible en este navegador.'
    };
  }

  const { subscription, error: subError } = await createPushSubscription(registration);
  if (!subscription) {
    return {
      success: false,
      error: subError || 'No se pudo generar la suscripción push.'
    };
  }

  const payload = serializeSubscription(subscription);
  if (!payload.endpoint || !payload.keys.p256dh || !payload.keys.auth) {
    return {
      success: false,
      error: 'Las claves de notificación generadas están vacías.'
    };
  }

  const saveRes = await savePushSubscription(memberId, payload);
  if (!saveRes.ok) {
    return {
      success: false,
      error: saveRes.message || 'Error al guardar la suscripción en el servidor'
    };
  }

  try {
    localStorage.removeItem(`tp_push_explicitly_disabled_${memberId}`);
    localStorage.removeItem('tp_push_explicitly_disabled');
    localStorage.setItem(`tp_push_subscribed_${memberId}`, 'true');
    localStorage.setItem('tp_push_subscribed', 'true');
  } catch {
    // ignore
  }

  return { success: true, permission: 'granted' };
}

export async function unsubscribeFromPush(rawMemberId: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const memberId = rawMemberId.trim();
  try {
    localStorage.setItem(`tp_push_explicitly_disabled_${memberId}`, 'true');
    localStorage.removeItem(`tp_push_subscribed_${memberId}`);
  } catch {
    // ignore
  }

  try {
    const subscription = await getPushSubscription();
    if (subscription) {
      await removePushSubscription(memberId, subscription.endpoint);
      await subscription.unsubscribe();
    }
    return true;
  } catch (err) {
    console.warn('[push] Error al desuscribir:', err);
    return false;
  }
}

export async function triggerTestNotification(rawMemberId: string): Promise<boolean> {
  const memberId = rawMemberId.trim();
  const isCoach = memberId === '1';

  const testTitle = isCoach ? '🔔 Tomás Pussetto - Coach' : '🔔 Tomás Pussetto - Tu Plan';
  const testBody = isCoach
    ? '¡Notificaciones activas! Acá vas a recibir avisos cuando tus alumnas dejen notas.'
    : '¡Notificaciones activadas! Acá te van a llegar las indicaciones de Tomás en tus ejercicios.';

  let notificationShown = false;

  // 1. Mostrar localmente vía Service Worker
  try {
    const registration = await getSWRegistration();
    if (registration && typeof registration.showNotification === 'function') {
      await registration.showNotification(testTitle, {
        body: testBody,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: 'tp-test-notification'
      });
      notificationShown = true;
    }
  } catch (e) {
    console.warn('[push] SW showNotification error:', e);
  }

  // 2. Fallback Notification directa
  if (!notificationShown && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(testTitle, {
        body: testBody,
        icon: '/icons/icon-192.png'
      });
      notificationShown = true;
    } catch (e) {
      console.warn('[push] Window Notification fallback error:', e);
    }
  }

  // 3. Enviar prueba desde el servidor remoto a Cloudflare D1
  try {
    await sendTestPushNotification(memberId);
  } catch (e) {
    console.warn('[push] sendTestPushNotification error:', e);
  }

  return notificationShown;
}
