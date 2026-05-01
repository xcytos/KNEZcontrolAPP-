// ZeroToleranceConnection.test.ts
// Comprehensive tests for zero-tolerance connection fixes

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { serviceDegradationManager, ServiceType, ServiceLevel } from './ServiceDegradation';
import { serviceDiscovery } from './ServiceDiscovery';

describe('Zero-Tolerance Connection Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    serviceDegradationManager.resetAllServices();
  });

  describe('Service Degradation Manager', () => {
    it('should initialize with all services', () => {
      const allStatus = serviceDegradationManager.getAllServiceStatus();
      
      expect(allStatus).toHaveLength(5); // OLLAMA, KNEZ_BACKEND, WEBSOCKET, MCP, MEMORY
      expect(allStatus.map(s => s.type)).toContain(ServiceType.OLLAMA);
      expect(allStatus.map(s => s.type)).toContain(ServiceType.KNEZ_BACKEND);
    });

    it('should track service health status', async () => {
      // Mock Ollama health check
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);

      const isHealthy = await serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA);
      
      expect(isHealthy).toBe(true);
      
      const status = serviceDegradationManager.getServiceStatus(ServiceType.OLLAMA);
      expect(status?.available).toBe(true);
      expect(status?.errorCount).toBe(0);
    });

    it('should handle service failures gracefully', async () => {
      // Mock Ollama failure
      vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

      const isHealthy = await serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA);
      
      expect(isHealthy).toBe(false);
      
      const status = serviceDegradationManager.getServiceStatus(ServiceType.OLLAMA);
      expect(status?.available).toBe(false);
      expect(status?.errorCount).toBe(1);
      expect(status?.fallbackActive).toBe(true);
    });

    it('should calculate service level correctly', () => {
      // Simulate partial service degradation
      serviceDegradationManager.forceServiceLevel(ServiceLevel.DEGRADED);
      
      const level = serviceDegradationManager.getServiceLevel();
      expect(level).toBe(ServiceLevel.DEGRADED);
    });

    it('should execute with fallback when primary fails', async () => {
      // Mock primary operation failure
      const primaryOp = vi.fn().mockRejectedValue(new Error('Primary failed'));
      const fallbackOp = vi.fn().mockResolvedValue('fallback success');

      // Force service degradation
      serviceDegradationManager.forceServiceLevel(ServiceLevel.DEGRADED);

      const result = await serviceDegradationManager.executeWithFallback(
        ServiceType.OLLAMA,
        primaryOp,
        fallbackOp
      );

      expect(result).toBe('fallback success');
      expect(primaryOp).toHaveBeenCalledTimes(1);
      expect(fallbackOp).toHaveBeenCalledTimes(1);
    });
  });

  describe('Service Discovery', () => {
    it('should discover services with caching', async () => {
      // Mock service discovery
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);

      const result = await serviceDiscovery.discoverService('ollama');
      
      expect(result.service).toBe('ollama');
      expect(result.method).toBe('scan');
      expect(result.endpoint).toBeTruthy();
      expect(result.endpoint?.url).toContain('localhost:11434');
    });

    it('should use cached results for subsequent calls', async () => {
      // Mock service discovery
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);

      // First call
      const result1 = await serviceDiscovery.discoverService('ollama');
      expect(result1.method).toBe('scan');

      // Second call should use cache
      const result2 = await serviceDiscovery.discoverService('ollama');
      expect(result2.method).toBe('cache');
      expect(result2.endpoint).toEqual(result1.endpoint);
    });

    it('should handle service discovery failures', async () => {
      // Mock all discovery attempts failing
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('All endpoints failed'));

      const result = await serviceDiscovery.discoverService('ollama');
      
      expect(result.service).toBe('ollama');
      expect(result.method).toBe('fallback');
      expect(result.endpoint).toBeNull();
    });

    it('should provide cache statistics', () => {
      const stats = serviceDiscovery.getCacheStats();
      
      expect(stats).toHaveProperty('ollama');
      expect(stats).toHaveProperty('knez-backend');
      expect(stats.ollama).toHaveProperty('cached');
      expect(stats.ollama).toHaveProperty('age');
    });
  });

  describe('Integration: Service Degradation + Discovery', () => {
    it('should coordinate between discovery and degradation', async () => {
      // Mock successful discovery
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);

      // Discover service
      const discoveryResult = await serviceDiscovery.discoverService('ollama');
      expect(discoveryResult.endpoint).toBeTruthy();

      // Check service health through degradation manager
      const isHealthy = await serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA);
      expect(isHealthy).toBe(true);

      // Verify service level is full
      const level = serviceDegradationManager.getServiceLevel();
      expect(level).toBe(ServiceLevel.FULL);
    });

    it('should handle cascade failures gracefully', async () => {
      // Mock all services failing
      vi.spyOn(global, 'fetch').mockRejectedValue(new Error('All services down'));

      // Check all services
      await serviceDegradationManager.checkAllServices();

      // Verify service level is offline
      const level = serviceDegradationManager.getServiceLevel();
      expect(level).toBe(ServiceLevel.OFFLINE);

      // Verify fallbacks are active
      const ollamaStatus = serviceDegradationManager.getServiceStatus(ServiceType.OLLAMA);
      expect(ollamaStatus?.fallbackActive).toBe(true);
    });
  });

  describe('Resilience Performance', () => {
    it('should handle rapid service checks without errors', async () => {
      const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);

      // Perform multiple rapid checks
      const promises = Array(10).fill(null).map(() => 
        serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA)
      );

      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results.every(r => r === true)).toBe(true);
      
      // Should only make one actual fetch due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should maintain performance under load', async () => {
      const startTime = Date.now();
      
      // Mock service discovery
      vi.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);

      // Discover multiple services concurrently
      const promises = [
        serviceDiscovery.discoverService('ollama'),
        serviceDiscovery.discoverService('knez-backend'),
        serviceDiscovery.discoverService('websocket')
      ];

      await Promise.all(promises);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary failures', async () => {
      const mockFetch = vi.spyOn(global, 'fetch');
      
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Temporary failure'));
      
      const result1 = await serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA);
      expect(result1).toBe(false);
      
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [] })
      } as Response);
      
      const result2 = await serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA);
      expect(result2).toBe(true);
      
      // Verify error count reset
      const status = serviceDegradationManager.getServiceStatus(ServiceType.OLLAMA);
      expect(status?.errorCount).toBe(0);
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock timeout
      vi.spyOn(global, 'fetch').mockImplementationOnce(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await serviceDegradationManager.checkServiceHealth(ServiceType.OLLAMA);
      expect(result).toBe(false);
      
      // Should not crash
      expect(result).toBeDefined();
    });
  });
});
