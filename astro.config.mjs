import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';
import VitePWA from '@vite-pwa/astro';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    imageService: 'compile'
  }),
  integrations: [
    react(),
    tailwind({ applyBaseStyles: false }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Tomás Pussetto',
        short_name: 'Tomás Pussetto',
        display: 'standalone',
        theme_color: '#26160d',
        background_color: '#f5f0e8',
        start_url: '/login',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        navigateFallback: null,
        globPatterns: ['_astro/**/*.{js,css}', 'icons/**/*.{png,svg}', '*.{png,svg,ico,webmanifest}'],
        globIgnores: ['**/_worker.js/**/*', '**/_worker.js', '_worker.js/**/*', '_worker.js'],
        importScripts: ['/sw-push.js'],
        clientsClaim: true,
        skipWaiting: true
      }
    })
  ]
});
