import { defineConfig } from 'vite';
import path, { resolve } from 'path';
import react from '@vitejs/plugin-react';
import viteDsTokenFallbacks from '@wordpress/theme/vite-plugins/vite-ds-token-fallbacks';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), viteDsTokenFallbacks()],
  server: {
    port: 5176,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        'service-worker': resolve(__dirname, 'src/sync/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js',
      },
    },
  },
  resolve: {
    alias: {
      // Dedupe React — @wordpress/element bundles React 18 as a hard dep,
      // which conflicts with our React 19. Force all imports through one copy.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime'),
      // ThemeProvider is behind @wordpress/private-apis lock (core-only).
      // Alias the build output directly so we can import it.
      '@wp-internal/theme-provider': path.resolve(
        __dirname,
        'node_modules/@wordpress/theme/build-module/theme-provider.mjs',
      ),
    },
  },
});
