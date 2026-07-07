import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/astro-bridge-core/',
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
});
