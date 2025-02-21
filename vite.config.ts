import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/Sala7-Password-Generator",
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
