import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';

dotenv.config();

const backendPort = process.env.PORT || 4000;

export default defineConfig({
  root: 'app',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': `http://localhost:${backendPort}`,
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
