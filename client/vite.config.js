import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages раздаёт проект со вложенного пути /<repo-name>/,
// поэтому адреса ассетов и роутера должны начинаться с этого префикса.
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'CONUNDRUM';
const base = isGitHubPages ? `/${repoName}/` : '/';

export default defineConfig({
  plugins: [react()],
  base,
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
      // http-proxy передаёт все методы (GET/POST/PUT/DELETE/OPTIONS) без изменений.
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.js'
  }
});
