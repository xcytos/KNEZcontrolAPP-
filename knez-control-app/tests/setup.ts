// Vitest setup file to mock IndexedDB for Node.js environment
import { vi } from 'vitest';

// In-memory storage for IndexedDB mock
const indexedDBStorage = new Map<string, Map<string, any>>();

class MockRequest {
  constructor(public result: any = null) {
    this.onsuccess = null;
    this.onerror = null;
  }
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

class MockObjectStore {
  constructor(private storeName: string, private dbName: string) {
    if (!indexedDBStorage.has(dbName)) {
      indexedDBStorage.set(dbName, new Map());
    }
    if (!indexedDBStorage.get(dbName)!.has(storeName)) {
      indexedDBStorage.get(dbName)!.set(storeName, new Map());
    }
  }

  private getStore(): Map<string, any> {
    return indexedDBStorage.get(this.dbName)!.get(this.storeName)!;
  }

  add(data: any, key?: string): MockRequest {
    const request = new MockRequest();
    const store = this.getStore();
    const id = key || data.id || data.toolName || Math.random().toString(36);
    store.set(id, data);
    request.result = id;
    request.onsuccess?.();
    return request;
  }

  get(key: string): MockRequest {
    const request = new MockRequest();
    const store = this.getStore();
    request.result = store.get(key) || null;
    request.onsuccess?.();
    return request;
  }

  put(data: any, key?: string): MockRequest {
    const request = new MockRequest();
    const store = this.getStore();
    const id = key || data.id || data.toolName;
    store.set(id, data);
    request.result = id;
    request.onsuccess?.();
    return request;
  }

  delete(key: string): MockRequest {
    const request = new MockRequest();
    const store = this.getStore();
    store.delete(key);
    request.onsuccess?.();
    return request;
  }

  clear(): MockRequest {
    const request = new MockRequest();
    const store = this.getStore();
    store.clear();
    request.onsuccess?.();
    return request;
  }

  getAll(): MockRequest {
    const request = new MockRequest();
    const store = this.getStore();
    request.result = Array.from(store.values());
    request.onsuccess?.();
    return request;
  }
}

class MockTransaction {
  constructor(private db: MockDB, private storeNames: string[]) {}
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;

  objectStore(storeName: string): MockObjectStore {
    return new MockObjectStore(storeName, this.db.name);
  }
}

class MockDB {
  constructor(public name: string, public version: number) {
    this.objectStoreNames = {
      contains: (storeName: string) => indexedDBStorage.has(this.name) && indexedDBStorage.get(this.name)!.has(storeName),
    };
  }
  
  objectStoreNames: { contains: (name: string) => boolean };
  
  createObjectStore(name: string): void {
    if (!indexedDBStorage.has(this.name)) {
      indexedDBStorage.set(this.name, new Map());
    }
    indexedDBStorage.get(this.name)!.set(name, new Map());
  }

  transaction(storeNames: string[], mode?: string): MockTransaction {
    return new MockTransaction(this, storeNames);
  }

  close(): void {
    // No-op for mock
  }
}

const mockOpenDB = vi.fn((name: string, version: number) => {
  const request = new MockRequest();
  const db = new MockDB(name, version);
  request.result = db;
  request.onsuccess?.();
  return request;
});

globalThis.indexedDB = {
  open: mockOpenDB,
  deleteDatabase: vi.fn((name: string) => {
    const request = new MockRequest();
    indexedDBStorage.delete(name);
    request.onsuccess?.();
    return request;
  }),
} as any;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => (store[key] = value.toString()),
    removeItem: (key: string) => delete store[key],
    clear: () => (store = {}),
  };
})();

globalThis.localStorage = localStorageMock as any;
globalThis.sessionStorage = localStorageMock as any;
