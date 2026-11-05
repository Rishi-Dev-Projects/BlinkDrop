import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(() => {
  const isHttps = process.env.HTTPS === 'true' || process.argv.includes('--https');
  return {
    plugins: [
      react(),
      ...(isHttps ? [basicSsl()] : [])
    ],
    server: {
      port: 3000,
      host: true
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/firestore']
          }
        }
      }
    }
  };
});
