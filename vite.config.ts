import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const basePath = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['favicon.ico', 'favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png', '_redirects', '_headers'],
      manifest: {
        name: 'Certified Handmade',
        short_name: 'CertHandmade',
        description:
          'Local-first open-source cryptographic provenance & QR verification toolkit for human-made digital art.',
        theme_color: '#06111e',
        background_color: '#06111e',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            title: 'title',
            text: 'text',
            url: 'url',
            files: [
              {
                name: 'image',
                accept: ['image/*', '.png', '.jpg', '.jpeg', '.webp'],
              },
            ],
          },
        },
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm,json}'],
        globIgnores: ['og-card.png', 'og-image.png'],
      },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor';
          }
          if (id.includes('node_modules/@noble') || id.includes('node_modules/cborg')) {
            return 'crypto';
          }
          if (id.includes('node_modules/fast-png') || id.includes('node_modules/qrcode') || id.includes('node_modules/jsqr')) {
            return 'imaging';
          }
          return undefined;
        },
      },
    },
  },
});
