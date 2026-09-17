import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { offlineBuild } from './offline-build.ts';
import { fileURLToPath } from 'node:url';
export default defineConfig(({ mode }) => ({
  resolve: { alias: { '@athan/i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)) } },
  plugins: [react({ jsxImportSource: '@athan/i18n' }), ...(['browser', 'mobile'].includes(mode) ? [offlineBuild(mode === 'mobile')] : [])],
  base: './',
  build: { outDir: mode === 'mobile' ? '../mobile-ui' : mode === 'browser' ? '../browser-ui' : '../desktop-ui', emptyOutDir: true, target: mode === 'mobile' ? ['chrome120', 'safari17'] : 'es2023' },
}));
