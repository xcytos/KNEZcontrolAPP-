// CircuitBreaker.test.ts
// Comprehensive tests for circuit breaker pattern

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CircuitBreaker, CircuitState, circuitBreakerRegistry } from '../../utils/CircuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      recoveryTimeout: 1000,
      monitoringPeriod: 5000,
      expectedRecoveryTime: 2000,
      halfOpenMaxCalls: 2
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Operation', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should execute successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should handle failures and count them', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(1);
    });
  });

  describe('Circuit Breaking', () => {
    it('should open circuit after failure threshold', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Fail 3 times to reach threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
    });

    it('should reject immediately when circuit is open', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      }
      
      // Should reject immediately without calling operation
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
      expect(operation).toHaveBeenCalledTimes(3); // No additional calls
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Next call should transition to HALF_OPEN
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('failure');
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
    });

    it('should close circuit after successful operation in HALF_OPEN', async () => {
      const failingOperation = vi.fn().mockRejectedValue(new Error('failure'));
      const successOperation = vi.fn().mockResolvedValue('success');
      
      // Open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow('failure');
      }
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Execute successful operation in HALF_OPEN
      const result = await circuitBreaker.execute(successOperation);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should track operation statistics', async () => {
      const successOperation = vi.fn().mockResolvedValue('success');
      const failureOperation = vi.fn().mockRejectedValue(new Error('failure'));
      
      // Execute successful operations
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      
      // Execute failed operations
      try {
        await circuitBreaker.execute(failureOperation);
      } catch {}
      
      const stats = circuitBreaker.getStats();
      
      expect(stats.totalCalls).toBe(3);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.failedCalls).toBe(1);
      expect(stats.failureRate).toBeCloseTo(0.33, 2);
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  beforeEach(() => {
    circuitBreakerRegistry.clear();
  });

  it('should create and retrieve circuit breakers', () => {
    const config = {
      failureThreshold: 5,
      recoveryTimeout: 2000,
      monitoringPeriod: 10000,
      halfOpenMaxCalls: 3
    };
    
    circuitBreakerRegistry.create('test-service', config);
    
    const cb = circuitBreakerRegistry.get('test-service');
    
    expect(cb).toBeDefined();
    expect(cb!.getState()).toBe(CircuitState.CLOSED);
  });

  it('should return null for non-existent circuit breaker', () => {
    const cb = circuitBreakerRegistry.get('non-existent');
    expect(cb).toBeNull();
  });

  it('should list all registered circuit breakers', () => {
    circuitBreakerRegistry.create('service1');
    circuitBreakerRegistry.create('service2');
    
    const list = circuitBreakerRegistry.list();
    
    expect(list).toHaveLength(2);
    expect(list).toContain('service1');
    expect(list).toContain('service2');
  });

  it('should remove circuit breakers', () => {
    circuitBreakerRegistry.create('test-service');
    
    const removed = circuitBreakerRegistry.remove('test-service');
    
    expect(removed).toBe(true);
    expect(circuitBreakerRegistry.get('test-service')).toBeNull();
  });

  it('should return false when removing non-existent circuit breaker', () => {
    const removed = circuitBreakerRegistry.remove('non-existent');
    expect(removed).toBe(false);
  });
});
