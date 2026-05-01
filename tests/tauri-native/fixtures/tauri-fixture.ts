import { createTauriTest } from '@srsholmes/tauri-playwright';

export const { test, expect } = createTauriTest({
  devUrl: 'http://localhost:5173',
  ipcMocks: {
    // Mock Tauri IPC commands if needed
  },
  mcpSocket: '/tmp/tauri-playwright.sock',
});
