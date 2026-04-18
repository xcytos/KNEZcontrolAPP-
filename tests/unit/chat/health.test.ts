
import { describe, it, expect } from 'vitest';
import { selectPrimaryBackend, isBackendHealthyStatus, isBackendStale } from '../../../src/utils/health';
import { HealthBackend } from '../../../src/domain/DataContracts';

describe('Health Utils', () => {
  it('isBackendHealthyStatus checks common status strings', () => {
    expect(isBackendHealthyStatus('healthy')).toBe(true);
    expect(isBackendHealthyStatus('OK')).toBe(true);
    expect(isBackendHealthyStatus('running')).toBe(true);
    expect(isBackendHealthyStatus('failed')).toBe(false);
    expect(isBackendHealthyStatus(null)).toBe(false);
  });

  it('isBackendStale returns true if last_ping is old', () => {
    const now = new Date();
    const old = new Date(now.getTime() - 70000).toISOString(); // 70s ago
    const fresh = new Date(now.getTime() - 10000).toISOString(); // 10s ago

    expect(isBackendStale({ last_ping: old } as any)).toBe(true);
    expect(isBackendStale({ last_ping: fresh } as any)).toBe(false);
    expect(isBackendStale({ last_ping: undefined } as any)).toBe(true);
  });

  it('selectPrimaryBackend prioritizes fresh healthy backends', () => {
    const now = new Date();
    const fresh = new Date(now.getTime() - 5000).toISOString();
    const stale = new Date(now.getTime() - 90000).toISOString();

    const backends: HealthBackend[] = [
      { 
        backend_id: 'b1', 
        model_id: 'm1', 
        status: 'healthy', 
        last_ping: stale,
        latency_ms: 10 
      },
      { 
        backend_id: 'b2', 
        model_id: 'm2', 
        status: 'healthy', 
        last_ping: fresh,
        latency_ms: 20 
      }
    ];

    const selected = selectPrimaryBackend(backends);
    expect(selected?.backend_id).toBe('b2');
  });

  it('selectPrimaryBackend falls back to stale healthy if no fresh ones', () => {
    const now = new Date();
    const stale = new Date(now.getTime() - 90000).toISOString();

    const backends: HealthBackend[] = [
      { 
        backend_id: 'b1', 
        model_id: 'm1', 
        status: 'healthy', 
        last_ping: stale,
        latency_ms: 10 
      }
    ];

    const selected = selectPrimaryBackend(backends);
    expect(selected?.backend_id).toBe('b1');
  });
});
