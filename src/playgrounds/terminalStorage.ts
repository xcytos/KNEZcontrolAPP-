const STORAGE_KEY = 'knez_playground_buffer';
const MAX_LINES = 200;
const MAX_CHUNK_LENGTH = 500;

interface StoredOutput {
  lines: string[];
  timestamp: number;
  label: string;
}

export interface PersistentSession {
  tabId: string;
  type: string;
  label: string;
  timestamp: number;
}

const SESSION_KEY = 'knez_persistent_sessions';

function loadAll(): Record<string, StoredOutput> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(data: Record<string, StoredOutput>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[terminalStorage] Failed to save buffer (quota exceeded?), clearing', e);
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function pushOutput(tabId: string, label: string, chunk: string) {
  if (!chunk) return;
  const data = loadAll();
  if (!data[tabId]) {
    data[tabId] = { lines: [], timestamp: Date.now(), label };
  }
  const entry = data[tabId];
  const trimmed = chunk.length > MAX_CHUNK_LENGTH
    ? chunk.slice(0, MAX_CHUNK_LENGTH)
    : chunk;
  entry.lines.push(trimmed);
  entry.timestamp = Date.now();
  if (entry.lines.length > MAX_LINES) {
    entry.lines.splice(0, entry.lines.length - MAX_LINES);
  }
  saveAll(data);
}

export function getOutput(tabId: string): StoredOutput | null {
  const data = loadAll();
  return data[tabId] || null;
}

export function clearOutput(tabId: string) {
  const data = loadAll();
  delete data[tabId];
  saveAll(data);
}

export function getSessionHistory(): PersistentSession[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function pushSession(session: PersistentSession) {
  const history = getSessionHistory();
  const idx = history.findIndex(s => s.tabId === session.tabId);
  if (idx >= 0) {
    history[idx] = session;
  } else {
    history.push(session);
  }
  const recent = history.slice(-10);
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(recent));
  } catch {}
}

export function removeSession(tabId: string) {
  const history = getSessionHistory();
  const filtered = history.filter(s => s.tabId !== tabId);
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(filtered));
  } catch {}
}
