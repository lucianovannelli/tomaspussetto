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
        name: 'KSC Mobile',
        short_name: 'KSC Mobile',
        display: 'standalone',
        theme_color: '#8b5cf6',
        background_color: '#ffffff',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}']
      }
    })
  ]
});
