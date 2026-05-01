/**
 * Test Setup Configuration
 * 
 * Global test configuration for Vitest testing framework
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Mock Tauri API for testing
beforeAll(() => {
  // Setup global mocks
  global.console = {
    ...console,
    // Suppress console.log in tests unless needed
    log: process.env.NODE_ENV === 'test' ? () => {} : console.log,
  };
});

beforeEach(() => {
  // Reset any global state before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Final cleanup
});

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
  emit: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(),
}));

vi.mock('@tauri-apps/api/dialog', () => ({
  ask: vi.fn(),
  confirm: vi.fn(),
  message: vi.fn(),
}));

vi.mock('@tauri-apps/api/fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn(),
  resolve: vi.fn(),
}));

// Mock WebSocket for testing
global.WebSocket = vi.fn().mockImplementation(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock IndexedDB for testing
const indexedDB = {
  open: vi.fn().mockReturnValue({
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  }),
};

Object.defineProperty(window, 'indexedDB', {
  value: indexedDB,
  writable: true,
});

// Mock localStorage for testing
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock sessionStorage for testing
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock fetch API for testing
global.fetch = vi.fn();

// Mock performance API
global.performance = {
  ...performance,
  now: vi.fn(() => Date.now()),
};

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock MutationObserver
global.MutationObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
}));

// Setup test environment variables
process.env.NODE_ENV = 'test';

// Global test utilities
declare global {
  const vi: typeof import('vitest').vi;
}
