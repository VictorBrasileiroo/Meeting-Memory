import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
  define: { __FOUNDATION_MOCK__: true, __CHUNK_TEST__: true, __TRANSCRIPTION_DIAGNOSTICS__: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
});
