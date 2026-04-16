import path from 'path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@wordpress/ui': path.resolve(__dirname, 'src/test/mocks/wordpress-ui.tsx'),
      '@wordpress/icons': path.resolve(__dirname, 'src/test/mocks/wordpress-icons.tsx'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
