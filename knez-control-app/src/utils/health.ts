import type { HealthBackend } from "../domain/DataContracts";

export function backendHasLiveMetrics(be: HealthBackend): boolean {
  return be.latency_ms !== undefined && be.latency_ms !== null
    ? true
    : be.tokens_per_sec !== undefined && be.tokens_per_sec !== null
      ? true
      : be.last_ping !== undefined && be.last_ping !== null;
}

export function isBackendHealthyStatus(status: string | undefined | null): boolean {
  const s = String(status ?? "").toLowerCase();
  return s === "healthy" || s === "ok" || s === "running" || s === "ready";
}

export function isOverallHealthyStatus(status: string | undefined | null): boolean {
  return isBackendHealthyStatus(status);
}

export function isBackendStale(be: HealthBackend): boolean {
  if (!be.last_ping) return true;
  const raw: any = be.last_ping as any;
  let t: number | null = null;
  if (typeof raw === "number") {
    t = raw < 10_000_000_000 ? raw * 1000 : raw;
  } else if (typeof raw === "string") {
    const parsed = new Date(raw).getTime();
    if (!isNaN(parsed)) t = parsed;
  }
  if (!t) return true;
  return Date.now() - t > 60000;
}

export function selectPrimaryBackend(backends: HealthBackend[] | null | undefined): HealthBackend | null {
  const list = Array.isArray(backends) ? backends : [];
  if (list.length === 0) return null;

  // 1. Healthy + Live Metrics + Not Stale
  const best = list.find((b) => isBackendHealthyStatus(b.status) && backendHasLiveMetrics(b) && !isBackendStale(b));
  if (best) return best;

  // 2. Healthy + Live Metrics (even if stale)
  const liveHealthy = list.find((b) => isBackendHealthyStatus(b.status) && backendHasLiveMetrics(b));
  if (liveHealthy) return liveHealthy;

  // 3. Just Healthy status
  const healthy = list.find((b) => isBackendHealthyStatus(b.status));
  if (healthy) return healthy;

  return list[0] ?? null;
}
