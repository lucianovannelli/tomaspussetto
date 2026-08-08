/// <reference types="astro/client" />
/// <reference types="vite-plugin-pwa/info" />
/// <reference types="vite-plugin-pwa/vanillajs" />

interface ImportMetaEnv {
  readonly PUBLIC_KSC_API_BASE?: string;
  readonly PUBLIC_KSC_ENABLE_MOCKS?: string;
  readonly PUBLIC_KSC_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'virtual:pwa-info' {
  export const pwaInfo: {
    webManifest: {
      linkTag: string;
    };
  } | undefined;
}

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void;
    onRegisterError?: (error: any) => void;
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>;
}
