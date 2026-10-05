import { useState, useEffect } from 'react';
import {
  isPushSupported,
  getNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  triggerTestNotification,
  isIOS,
  isStandalone
} from '../lib/push';

interface Props {
  memberId: string;
  isBanner?: boolean;
}

export default function CoachNotificationCard({ memberId, isBanner = false }: Props) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isCoach = memberId === '1';

  useEffect(() => {
    if (!isPushSupported()) {
      setPermission('unsupported');
      return;
    }

    const perm = getNotificationPermission();
    setPermission(perm);

    const hasStoredSub = localStorage.getItem(`tp_push_subscribed_${memberId}`) === 'true' || localStorage.getItem('tp_push_subscribed') === 'true';
    const explicitlyDisabled = localStorage.getItem(`tp_push_explicitly_disabled_${memberId}`) === 'true' || localStorage.getItem('tp_push_explicitly_disabled') === 'true';

    const active = perm === 'granted' && hasStoredSub && !explicitlyDisabled;
    setIsSubscribed(active);

    if (isBanner) {
      if (active || perm === 'denied') {
        setDismissed(true);
        return;
      }
      const dismissedAt = localStorage.getItem(`tp_push_banner_dismissed_${memberId}`);
      if (dismissedAt) {
        const days = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (days < 7) {
          setDismissed(true);
        }
      }
    }
  }, [memberId, isBanner]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(`tp_push_banner_dismissed_${memberId}`, String(Date.now()));
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const handleActivate = async () => {
    setLoading(true);
    setFeedback(null);

    const res = await subscribeToPush(memberId);
    setLoading(false);

    if (res.success) {
      setPermission('granted');
      setIsSubscribed(true);
      try {
        localStorage.setItem(`tp_push_subscribed_${memberId}`, 'true');
        localStorage.removeItem(`tp_push_explicitly_disabled_${memberId}`);
      } catch {}
      setFeedback({
        type: 'success',
        message: isCoach
          ? '¡Notificaciones activadas! Vas a recibir avisos cuando tus alumnas dejen notas.'
          : '¡Notificaciones activadas! Te avisaremos cuando Tomás te deje indicaciones o correcciones.'
      });
      // Disparar prueba automática
      setTimeout(() => {
        void triggerTestNotification(memberId);
      }, 500);
    } else {
      setFeedback({
        type: 'error',
        message: res.error || 'No se pudieron activar las notificaciones.'
      });
      const perm = getNotificationPermission();
      setPermission(perm);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setFeedback(null);
    const sent = await triggerTestNotification(memberId);
    setLoading(false);

    if (sent) {
      setFeedback({
        type: 'success',
        message: '¡Notificación enviada! Deberías verla en la pantalla de tu dispositivo.'
      });
    } else {
      setFeedback({
        type: 'error',
        message: 'No se pudo enviar la notificación de prueba. Verificá los permisos del navegador.'
      });
    }
  };

  const handleDeactivate = async () => {
    setLoading(true);
    setFeedback(null);
    await unsubscribeFromPush(memberId);
    try {
      localStorage.setItem(`tp_push_explicitly_disabled_${memberId}`, 'true');
      localStorage.removeItem(`tp_push_subscribed_${memberId}`);
    } catch {}
    setLoading(false);
    setIsSubscribed(false);
    setFeedback({
      type: 'success',
      message: 'Notificaciones silenciadas en este dispositivo.'
    });
  };

  if (permission === 'unsupported') {
    return null;
  }

  if (isBanner && dismissed) {
    return null;
  }

  const iosNotice = isIOS() && !isStandalone();

  return (
    <div className="relative overflow-hidden rounded-3xl border border-[#d5c7b5]/80 bg-gradient-to-b from-[#faf7f2] via-white to-[#f5f0e8] p-5 shadow-[0_8px_30px_rgb(38,22,13,0.06),inset_0_1px_0_#ffffff] transition-all">
      {/* Decorative ambient background */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-200/40 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#26160d] to-[#3d2315] text-[#faf7f2] flex items-center justify-center shadow-md shadow-[#26160d]/20 text-lg shrink-0">
              🔔
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-[#1c1a17]">
                  {isCoach ? 'Avisos de Notas (Entrenador)' : 'Notificaciones de tu Plan'}
                </h3>
              </div>
              <p className="text-xs font-semibold text-[#8c7a6b]">
                {isCoach
                  ? 'Enterate en el acto cuando una alumna escribe en un ejercicio'
                  : 'Enterate cuando Tomás te deje indicaciones o correcciones'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSubscribed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Activas
              </span>
            ) : permission === 'denied' ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-black">
                Bloqueadas
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold">
                Inactivas
              </span>
            )}

            {isBanner && !isSubscribed && (
              <button
                type="button"
                onClick={handleDismiss}
                className="w-7 h-7 rounded-full bg-[#ede6dc]/70 hover:bg-[#e6dfd5] text-[#8c7a6b] hover:text-[#26160d] flex items-center justify-center transition active:scale-90 cursor-pointer"
                title="Cerrar aviso"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content explanation */}
        <p className="text-xs font-medium text-[#5e4e43] leading-relaxed">
          {isCoach
            ? 'Al activar las notificaciones, tu teléfono o computadora te avisará con el nombre de la alumna y el ejercicio apenas guarde una nota, permitiéndote abrir la rutina con un solo toque.'
            : 'Al activar las notificaciones, tu teléfono te avisará cada vez que Tomás te deje indicaciones técnicas, postura o sugerencias de carga en tus ejercicios para que no te pierdas nada.'}
        </p>

        {/* iOS Notice if not installed */}
        {iosNotice && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed font-semibold flex items-start gap-2">
            <span className="text-base">📲</span>
            <span>
              En iPhone necesitás tener la app agregada a tu <strong>Pantalla de Inicio</strong> (desde el botón Compartir de Safari) para poder recibir notificaciones push.
            </span>
          </div>
        )}

        {/* Feedback message */}
        {feedback && (
          <div
            className={`rounded-2xl border p-3 text-xs font-bold flex items-start gap-2 ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50/90 text-emerald-800'
                : 'border-rose-200 bg-rose-50/90 text-rose-800'
            }`}
          >
            <span>{feedback.type === 'success' ? '✓' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!isSubscribed ? (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleActivate}
                className="touch-btn flex-1 h-12 rounded-2xl bg-[#26160d] hover:bg-[#3d2315] text-[#faf7f2] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#26160d]/20 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <span>Configurando...</span>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <span>Activar Notificaciones</span>
                  </>
                )}
              </button>

              {isBanner && (
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="h-12 px-4 rounded-2xl border border-[#d5c7b5] bg-white/80 hover:bg-white text-[#5e4e43] font-bold text-xs transition active:scale-[0.98] cursor-pointer"
                >
                  Más tarde
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleTest}
                className="touch-btn flex-1 h-12 rounded-2xl bg-[#26160d] hover:bg-[#3d2315] text-[#faf7f2] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#26160d]/15 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <span>Enviando...</span>
                ) : (
                  <>
                    <span>Probar Notificación 🔔</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleDeactivate}
                className="h-12 px-4 rounded-2xl border border-[#d5c7b5] bg-white/80 hover:bg-white text-[#5e4e43] font-bold text-xs transition-all active:scale-[0.98] cursor-pointer"
                title="Desactivar en este dispositivo"
              >
                Silenciar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
