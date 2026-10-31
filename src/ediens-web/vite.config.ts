import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const primaryTarget = env.VITE_API_PROXY_TARGET || env.BACKEND_URL || 'http://localhost:5158';
  const fallbackTarget = 'http://localhost:8080';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: primaryTarget,
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('error', (err, _req, _res) => {
              // If connection refused to primary target (5158), automatically route to container port (8080)
              if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED' && options.target === primaryTarget) {
                console.warn(
                  `[Vite Proxy] Target ${primaryTarget} unreachable, switching fallback to ${fallbackTarget}`
                );
                options.target = fallbackTarget;
              }
            });
          },
        },
      },
    },
  };
});
