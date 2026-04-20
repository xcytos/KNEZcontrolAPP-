import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/playwright-report/**",
        "**/test-results/**",
        "**/tests/tauri-e2e/**"
      ],
    },
    proxy: {
      '/taqwin': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/identity': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/state': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/sessions': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/governance': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/approvals': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/audit': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/perception': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/operator': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/runbooks': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    }
  },

  // Externalize Node.js modules that don't work in browser
  resolve: {
    alias: {
      'better-sqlite3': path.resolve(__dirname, './src/services/stubs/better-sqlite3-stub.ts'),
      'crypto': path.resolve(__dirname, './src/services/stubs/crypto-stub.ts'),
    },
  },

  // Optimize dependencies - exclude better-sqlite3
  optimizeDeps: {
    exclude: ['better-sqlite3', 'crypto'],
  },
}));
