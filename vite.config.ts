import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'The Midnight Library',
        short_name: 'Midnight Library',
        description: 'A cozy, local-first sanctuary for reading and writing fictional stories.',
        theme_color: '#080d19',
        background_color: '#080d19',
        display: 'standalone',
        orientation: 'portrait-primary',
        id: '/',
        start_url: '/',
        scope: '/',
        categories: ['books', 'productivity', 'writing'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ['**/*.{html,js,css,png,svg,webp,woff2,webmanifest}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
})
