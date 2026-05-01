// ServiceDiscovery.ts
// Zero-tolerance smart service discovery with dynamic port scanning and endpoint caching

export interface ServiceEndpoint {
  host: string;
  port: number;
  url: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  healthy: boolean;
  lastChecked: number;
  responseTime?: number;
  version?: string;
}

export interface ServiceConfig {
  name: string;
  defaultPorts: number[];
  hostCandidates: string[];
  healthCheckPath: string;
  protocol: 'http' | 'https' | 'ws' | 'wss';
  timeoutMs: number;
  retryAttempts: number;
  scanRange?: {
    start: number;
    end: number;
  };
}

export interface DiscoveryResult {
  service: string;
  endpoint: ServiceEndpoint | null;
  method: 'default' | 'scan' | 'cache' | 'fallback';
  totalAttempts: number;
  duration: number;
}

export class ServiceDiscovery {
  private endpointCache = new Map<string, ServiceEndpoint>();
  private cacheTimeoutMs = 300000; // 5 minutes
  private activeScans = new Map<string, Promise<ServiceEndpoint | null>>();

  private serviceConfigs: Map<string, ServiceConfig> = new Map([
    ['knez-backend', {
      name: 'knez-backend',
      defaultPorts: [8000, 8001, 8002, 8080],
      hostCandidates: ['127.0.0.1', 'localhost', '0.0.0.0'],
      healthCheckPath: '/health',
      protocol: 'http',
      timeoutMs: 2000,
      retryAttempts: 3,
      scanRange: { start: 8000, end: 8010 }
    }],
    ['ollama', {
      name: 'ollama',
      defaultPorts: [11434, 11435, 11436],
      hostCandidates: ['127.0.0.1', 'localhost'],
      healthCheckPath: '/api/tags',
      protocol: 'http',
      timeoutMs: 3000,
      retryAttempts: 2,
      scanRange: { start: 11434, end: 11440 }
    }],
    ['websocket', {
      name: 'websocket',
      defaultPorts: [8000, 8001, 8002],
      hostCandidates: ['127.0.0.1', 'localhost'],
      healthCheckPath: '/ws/health-check',
      protocol: 'ws',
      timeoutMs: 2000,
      retryAttempts: 3,
      scanRange: { start: 8000, end: 8010 }
    }]
  ]);

  async discoverService(serviceName: string, forceRescan = false): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const config = this.serviceConfigs.get(serviceName);
    
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`);
    }

    console.info(`[ServiceDiscovery] Starting discovery for ${serviceName}`);

    // Check cache first (unless forced)
    if (!forceRescan) {
      const cached = this.getCachedEndpoint(serviceName);
      if (cached) {
        console.info(`[ServiceDiscovery] Using cached endpoint for ${serviceName}: ${cached.url}`);
        return {
          service: serviceName,
          endpoint: cached,
          method: 'cache',
          totalAttempts: 0,
          duration: Date.now() - startTime
        };
      }
    }

    // Prevent duplicate scans
    const scanKey = serviceName;
    if (this.activeScans.has(scanKey)) {
      console.info(`[ServiceDiscovery] Scan already in progress for ${serviceName}, waiting...`);
      const endpoint = await this.activeScans.get(scanKey)!;
      return {
        service: serviceName,
        endpoint,
        method: endpoint ? 'scan' : 'fallback',
        totalAttempts: 1,
        duration: Date.now() - startTime
      };
    }

    // Start new scan
    const scanPromise = this.performServiceDiscovery(config);
    this.activeScans.set(scanKey, scanPromise);

    try {
      const endpoint = await scanPromise;
      
      if (endpoint) {
        this.cacheEndpoint(serviceName, endpoint);
        console.info(`[ServiceDiscovery] Discovery successful for ${serviceName}: ${endpoint.url}`);
      } else {
        console.warn(`[ServiceDiscovery] Discovery failed for ${serviceName}`);
      }

      return {
        service: serviceName,
        endpoint,
        method: endpoint ? 'scan' : 'fallback',
        totalAttempts: 1,
        duration: Date.now() - startTime
      };

    } finally {
      this.activeScans.delete(scanKey);
    }
  }

  private async performServiceDiscovery(config: ServiceConfig): Promise<ServiceEndpoint | null> {
    // Method 1: Try default ports first
    console.debug(`[ServiceDiscovery] Trying default ports for ${config.name}`);
    const defaultEndpoint = await this.tryDefaultPorts(config);
    if (defaultEndpoint) {
      return defaultEndpoint;
    }

    // Method 2: Scan port range if configured
    if (config.scanRange) {
      console.debug(`[ServiceDiscovery] Scanning port range for ${config.name}`);
      const scannedEndpoint = await this.scanPortRange(config);
      if (scannedEndpoint) {
        return scannedEndpoint;
      }
    }

    // Method 3: Try fallback endpoints
    console.debug(`[ServiceDiscovery] Trying fallback endpoints for ${config.name}`);
    const fallbackEndpoint = await this.tryFallbackEndpoints(config);
    if (fallbackEndpoint) {
      return fallbackEndpoint;
    }

    return null;
  }

  private async tryDefaultPorts(config: ServiceConfig): Promise<ServiceEndpoint | null> {
    for (const port of config.defaultPorts) {
      for (const host of config.hostCandidates) {
        const endpoint = await this.testEndpoint(config, host, port);
        if (endpoint) {
          console.info(`[ServiceDiscovery] Found ${config.name} at default endpoint: ${endpoint.url}`);
          return endpoint;
        }
      }
    }
    return null;
  }

  private async scanPortRange(config: ServiceConfig): Promise<ServiceEndpoint | null> {
    if (!config.scanRange) return null;

    const { start, end } = config.scanRange;
    const portsToScan = [];
    
    // Prioritize default ports
    for (const port of config.defaultPorts) {
      if (port >= start && port <= end) {
        portsToScan.push(port);
      }
    }
    
    // Add other ports in range
    for (let port = start; port <= end; port++) {
      if (!portsToScan.includes(port)) {
        portsToScan.push(port);
      }
    }

    // Scan ports concurrently (with reasonable concurrency limit)
    const concurrencyLimit = 10;
    const results: (ServiceEndpoint | null)[] = [];

    for (let i = 0; i < portsToScan.length; i += concurrencyLimit) {
      const batch = portsToScan.slice(i, i + concurrencyLimit);
      const batchPromises = batch.map(async (port) => {
        for (const host of config.hostCandidates) {
          const endpoint = await this.testEndpoint(config, host, port);
          if (endpoint) {
            return endpoint;
          }
        }
        return null;
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Return first successful endpoint
      const found = batchResults.find(result => result !== null);
      if (found) {
        console.info(`[ServiceDiscovery] Found ${config.name} via port scanning: ${found.url}`);
        return found;
      }
    }

    return null;
  }

  private async tryFallbackEndpoints(config: ServiceConfig): Promise<ServiceEndpoint | null> {
    // Try alternative configurations
    const fallbackConfigs = [
      // Try different host patterns
      ...config.hostCandidates.flatMap(host => 
        config.defaultPorts.map(port => ({ host, port }))
      ),
      // Try common development ports
      { host: '127.0.0.1', port: 3000 },
      { host: 'localhost', port: 3000 },
      { host: '127.0.0.1', port: 5000 },
      { host: 'localhost', port: 5000 }
    ];

    for (const { host, port } of fallbackConfigs) {
      const endpoint = await this.testEndpoint(config, host, port);
      if (endpoint) {
        console.info(`[ServiceDiscovery] Found ${config.name} via fallback: ${endpoint.url}`);
        return endpoint;
      }
    }

    return null;
  }

  private async testEndpoint(
    config: ServiceConfig, 
    host: string, 
    port: number
  ): Promise<ServiceEndpoint | null> {
    const url = this.buildUrl(config, host, port);
    const startTime = Date.now();

    try {
      if (config.protocol === 'ws' || config.protocol === 'wss') {
        return await this.testWebSocketEndpoint(config, host, port, url);
      } else {
        return await this.testHttpEndpoint(config, url, startTime);
      }
    } catch (error) {
      console.debug(`[ServiceDiscovery] Endpoint test failed for ${url}:`, error);
      return null;
    }
  }

  private async testHttpEndpoint(
    config: ServiceConfig, 
    url: string, 
    startTime: number
  ): Promise<ServiceEndpoint | null> {
    try {
      const response = await fetch(url + config.healthCheckPath, {
        method: 'GET',
        signal: AbortSignal.timeout(config.timeoutMs),
        headers: {
          'User-Agent': 'ServiceDiscovery/1.0'
        }
      });

      if (response.ok) {
        const responseTime = Date.now() - startTime;
        
        // Try to get version info
        let version: string | undefined;
        try {
          const data = await response.json();
          version = data.version || data.build || undefined;
        } catch {
          // Version info not available
        }

        return {
          host: new URL(url).hostname,
          port: new URL(url).port ? parseInt(new URL(url).port) : 
                (config.protocol === 'https' ? 443 : 80),
          url,
          protocol: config.protocol,
          healthy: true,
          lastChecked: Date.now(),
          responseTime,
          version
        };
      }
    } catch {
      // Request failed
    }

    return null;
  }

  private async testWebSocketEndpoint(
    config: ServiceConfig, 
    host: string, 
    port: number, 
    url: string
  ): Promise<ServiceEndpoint | null> {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        const timeout = setTimeout(() => {
          ws.close();
          resolve(null);
        }, config.timeoutMs);

        const startTime = Date.now();

        ws.onopen = () => {
          const responseTime = Date.now() - startTime;
          clearTimeout(timeout);
          ws.close();

          resolve({
            host,
            port,
            url,
            protocol: config.protocol,
            healthy: true,
            lastChecked: Date.now(),
            responseTime
          });
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(null);
        };

        ws.onclose = () => {
          clearTimeout(timeout);
        };

      } catch {
        resolve(null);
      }
    });
  }

  private buildUrl(config: ServiceConfig, host: string, port: number): string {
    const protocol = config.protocol === 'ws' || config.protocol === 'wss' ? 
                     (config.protocol === 'wss' ? 'wss:' : 'ws:') :
                     (config.protocol === 'https' ? 'https:' : 'http:');
    
    const portStr = ((config.protocol === 'https' && port === 443) || 
                    (config.protocol === 'http' && port === 80) ||
                    (config.protocol === 'wss' && port === 443) ||
                    (config.protocol === 'ws' && port === 80)) ? '' : `:${port}`;
    
    return `${protocol}//${host}${portStr}`;
  }

  private getCachedEndpoint(serviceName: string): ServiceEndpoint | null {
    const cached = this.endpointCache.get(serviceName);
    if (!cached) return null;

    // Check if cache is still valid
    const age = Date.now() - cached.lastChecked;
    if (age > this.cacheTimeoutMs) {
      this.endpointCache.delete(serviceName);
      return null;
    }

    return cached;
  }

  private cacheEndpoint(serviceName: string, endpoint: ServiceEndpoint): void {
    this.endpointCache.set(serviceName, { ...endpoint });
  }

  async verifyEndpoint(endpoint: ServiceEndpoint): Promise<boolean> {
    try {
      const config = this.serviceConfigs.get(endpoint.url.split('://')[1].split('/')[0]);
      if (!config) return false;

      const testResult = await this.testEndpoint(config, endpoint.host, endpoint.port);
      return testResult !== null;
    } catch {
      return false;
    }
  }

  getCacheStats(): Record<string, { cached: boolean; age: number; endpoint?: ServiceEndpoint }> {
    const stats: Record<string, { cached: boolean; age: number; endpoint?: ServiceEndpoint }> = {};
    
    for (const [serviceName] of this.serviceConfigs) {
      const cached = this.getCachedEndpoint(serviceName);
      stats[serviceName] = {
        cached: !!cached,
        age: cached ? Date.now() - cached.lastChecked : 0,
        endpoint: cached || undefined
      };
    }

    return stats;
  }

  clearCache(serviceName?: string): void {
    if (serviceName) {
      this.endpointCache.delete(serviceName);
      console.info(`[ServiceDiscovery] Cleared cache for ${serviceName}`);
    } else {
      this.endpointCache.clear();
      console.info(`[ServiceDiscovery] Cleared all caches`);
    }
  }

  addServiceConfig(config: ServiceConfig): void {
    this.serviceConfigs.set(config.name, config);
    console.info(`[ServiceDiscovery] Added service config for ${config.name}`);
  }

  removeServiceConfig(serviceName: string): void {
    this.serviceConfigs.delete(serviceName);
    this.endpointCache.delete(serviceName);
    console.info(`[ServiceDiscovery] Removed service config for ${serviceName}`);
  }
}

// Global instance
export const serviceDiscovery = new ServiceDiscovery();
