import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  envDir: '..',
  // The existing codebase uses JSX inside .js files (CRA convention).
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: []
  },
  // Some tooling runs esbuild directly on .js entry points instead of going
  // through Vite's source transform. Keep the .js -> jsx mapping explicit for
  // dependency pre-bundling as well so JSX-in-.js never falls back to `js`.
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' }
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js'
  }
});
