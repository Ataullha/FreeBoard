import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '0.0.0.0', port: 4173, allowedHosts: ['terminal.local'] },
  build: { target: 'es2022', chunkSizeWarningLimit: 2800 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    testTimeout: 10000,
  },
});
