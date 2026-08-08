# KSC Mobile

PWA mobile-first hecha con Astro + React + Tailwind para clientes del gimnasio KSC.

## Requisitos

- Node.js 20+
- npm 10+

## Scripts

- `npm install`: instala dependencias
- `npm run dev`: entorno local
- `npm run build`: chequeo de tipos + build de producción
- `npm run preview`: previsualizar build local

## Estructura del proyecto

- `src/layouts/`: layout base HTML y metadatos.
- `src/pages/`: rutas de Astro (`/login`, `/dashboard`, `/routine/[id]`).
- `src/components/`: componentes React interactivos (login, dashboard, detalle rutina).
- `src/lib/`: cliente API y tipos de datos.
- `src/styles/`: estilos globales y utilidades Tailwind.
- `public/icons/`: íconos PWA `192x192` y `512x512`.
- `astro.config.mjs`: integraciones Astro (React, Tailwind, PWA y Cloudflare).
- `wrangler.toml`: compatibilidad para deploy en Cloudflare.

## PWA

- Plugin: `@vite-pwa/astro`
- `registerType: autoUpdate`
- Manifest configurado para KSC Mobile

## API utilizada

- `GET {PUBLIC_KSC_API_BASE}/routines?member_id={member_id}`
- `GET {PUBLIC_KSC_API_BASE}/routine/{id}`

Por defecto, `PUBLIC_KSC_API_BASE` apunta a `https://ksc.lucianovannelli.workers.dev/api/mobile`.

## Variables de entorno

- `PUBLIC_KSC_API_BASE`: base de la API mobile del admin KSC.
- `PUBLIC_KSC_ENABLE_MOCKS=true`: habilita datos mock en desarrollo o pruebas manuales.

Sin `PUBLIC_KSC_ENABLE_MOCKS`, la app muestra errores reales de conectividad en lugar de ocultarlos con datos simulados.

## Deploy en Cloudflare Pages

1. Ejecutar `npm run build`
2. Subir el repo a Cloudflare Pages
3. Build command: `npm run build`
4. Output directory: `dist`

El proyecto está preparado para Cloudflare Pages con soporte de rutas dinámicas.
