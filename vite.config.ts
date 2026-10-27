import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  define: { __FOUNDATION_MOCK__: mode === 'foundation-mock', __CHUNK_TEST__: mode === 'chunk-test', __TRANSCRIPTION_DIAGNOSTICS__: mode === 'transcription-diagnostic' },
  build: {
    outDir: mode === 'foundation-mock' ? 'dist-dev' : mode === 'chunk-test' ? 'dist-chunk-test' : mode === 'transcription-diagnostic' ? 'dist-diagnostic' : 'dist',
    target: 'es2022',
    modulePreload: false,
    sourcemap: false,
    rolldownOptions: {
      input: {
        ...(mode === 'foundation-mock' ? { 'design-preview': resolve(import.meta.dirname, 'src/design-preview/design-preview.html') } : {}),
        popup: resolve(import.meta.dirname, 'src/popup/popup.html'),
        settings: resolve(import.meta.dirname, 'src/settings/settings.html'),
        session: resolve(import.meta.dirname, 'src/session/session.html'),
        library: resolve(import.meta.dirname, 'src/library/library.html'),
        offscreen: resolve(import.meta.dirname, 'src/offscreen/offscreen.html'),
        microphone: resolve(import.meta.dirname, 'src/microphone/microphone.html'),
        review: resolve(import.meta.dirname, 'src/review/review.html'),
        'service-worker': resolve(import.meta.dirname, 'src/background/service-worker.ts'),
      },
      output: {
        // Keep the UI CSP bootstrap's Zod dependency free of application schemas:
        // otherwise chunk merging can initialize schemas before jitless is set.
        codeSplitting: { groups: [
          { name: 'zod', test: /node_modules[\\/]zod[\\/]/ },
          { name: 'react-runtime', test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/ },
        ] },
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
}));
