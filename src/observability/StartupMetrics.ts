import { invoke } from "@tauri-apps/api/core";

const STORAGE_KEY = "knez_startup_metrics";
const MAX_ENTRIES = 50;

export interface StartupSample {
  id: string;
  timestamp: string;
  timeOrigin: number;

  fcp: number;
  domContentLoaded: number;
  loadEventEnd: number;

  reactInitStart: number;
  reactInitEnd: number;

  tauriInvokeMs: number | null;

  ptySpawnCountAtCapture: number;
}

let captured: StartupSample | null = null;
let reactInitStart = 0;
let ptySpawnLog: number[] = [];

export function markReactInitStart(): void {
  reactInitStart = performance.now();
}

export function recordPtySpawn(): void {
  ptySpawnLog.push(performance.now());
}

function now(): number {
  return performance.now();
}

export async function captureStartupSample(): Promise<StartupSample> {
  const paintEntries = performance.getEntriesByType("paint");
  const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
  const fcp = fcpEntry ? fcpEntry.startTime : 0;

  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;

  let tauriInvokeMs: number | null = null;
  try {
    const t0 = now();
    await invoke("test_tauri_connection");
    tauriInvokeMs = now() - t0;
  } catch {
    tauriInvokeMs = null;
  }

  const sample: StartupSample = {
    id: crypto.randomUUID?.() ?? Date.now().toString(36),
    timestamp: new Date().toISOString(),
    timeOrigin: performance.timeOrigin,

    fcp,
    domContentLoaded: nav ? nav.domContentLoadedEventEnd : 0,
    loadEventEnd: nav ? nav.loadEventEnd : 0,

    reactInitStart,
    reactInitEnd: now(),

    tauriInvokeMs,
    ptySpawnCountAtCapture: ptySpawnLog.length,
  };

  captured = sample;
  persist(sample);
  return sample;
}

function persist(sample: StartupSample): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const entries: StartupSample[] = raw ? JSON.parse(raw) : [];
    entries.push(sample);
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or blocked — silently drop
  }
}

export function getStartupHistory(): StartupSample[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLatestSample(): StartupSample | null {
  return captured;
}

export function getLastSessionSample(): StartupSample | null {
  const history = getStartupHistory();
  if (history.length < 2) return null;
  return history[history.length - 2];
}
