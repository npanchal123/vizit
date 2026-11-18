import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The site's public address. The deploy workflow sets SITE_URL: the repository variable when there's a custom domain,
// otherwise GitHub Pages' https://<owner>.github.io/<repo>/. The app is served from its path; local builds from /.
const siteUrl = process.env.SITE_URL ?? 'https://npanchal123.github.io/vizit/';
const base = process.env.SITE_URL ? new URL(process.env.SITE_URL).pathname : (process.env.BASE_PATH ?? '/');

/** Fills the full address into the link-preview tags, and writes robots.txt and sitemap.xml for search engines. */
function siteMeta(): Plugin {
  return {
    name: 'vizit-site-meta',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl),
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n` });
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}</loc></url>\n</urlset>\n`,
      });
    },
  };
}

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    siteMeta(),
    // Installable, offline-capable app. Everything a user needs is on the device,
    // so the service worker precaches the whole app shell.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'logo-mark.png', 'apple-touch-icon.png', 'sw-notifications.js'],
      manifest: {
        name: 'Viz it',
        short_name: 'Viz it',
        description: 'Write what you feel and where you want to be, and get a guided visualization made for you.',
        start_url: base,
        scope: base,
        display: 'standalone',
        theme_color: '#4338ca',
        background_color: '#f7f6f2',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // Only for link previews and backups, so not downloaded up front.
        globIgnores: ['**/og-image.*', '**/dexie-export-import-*.js'],
        navigateFallback: `${base}index.html`,
        // The AI endpoint must always hit the network (and fail cleanly when offline).
        navigateFallbackDenylist: [/^\/api\//],
        importScripts: ['sw-notifications.js'],
        // Practice audio is too big to download up front. Each recording is saved the first time it plays,
        // so a practice works offline after you've done it once. The list of recordings is checked online first.
        runtimeCaching: [
          {
            urlPattern: /\/audio\/.+\.mp3$/,
            handler: 'CacheFirst',
            options: { cacheName: 'practice-audio', expiration: { maxEntries: 500 } },
          },
          {
            urlPattern: /\/audio\/manifest\.json$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'practice-audio-manifest', networkTimeoutSeconds: 3 },
          },
        ],
      },
    }),
  ],
  server: {
    // The AI analysis server (npm run dev:api) runs separately in development.
    proxy: { '/api': 'http://localhost:8787' },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
