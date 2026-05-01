// ServiceDegradation.ts
// Zero-tolerance graceful service degradation with fallback mechanisms

export enum ServiceLevel {
  FULL = 'full',           // All services available
  DEGRADED = 'degraded',   // Some services unavailable, using fallbacks
  MINIMAL = 'minimal',     // Core services only, limited functionality
  OFFLINE = 'offline'      // No external services, local-only mode
}

export enum ServiceType {
  OLLAMA = 'ollama',
  KNEZ_BACKEND = 'knez_backend',
  WEBSOCKET = 'websocket',
  MCP = 'mcp',
  MEMORY = 'memory'
}

export interface ServiceStatus {
  type: ServiceType;
  available: boolean;
  lastCheck: number;
  errorCount: number;
  responseTime?: number;
  fallbackActive: boolean;
  fallbackType?: string;
}

export interface FallbackConfig {
  enabled: boolean;
  timeoutMs: number;
  retryAttempts: number;
  fallbackStrategies: FallbackStrategy[];
}

export interface FallbackStrategy {
  name: string;
  priority: number;
  execute: () => Promise<any>;
  isAvailable: () => boolean;
}

export class ServiceDegradationManager {
  private serviceStatus = new Map<ServiceType, ServiceStatus>();
  private currentServiceLevel: ServiceLevel = ServiceLevel.FULL;
  private fallbackConfigs = new Map<ServiceType, FallbackConfig>();
  private degradationCallbacks: ((level: ServiceLevel, status: ServiceStatus[]) => void)[] = [];

  constructor() {
    this.initializeServiceStatus();
    this.setupDefaultFallbacks();
  }

  private initializeServiceStatus(): void {
    const services: ServiceType[] = [
      ServiceType.OLLAMA,
      ServiceType.KNEZ_BACKEND,
      ServiceType.WEBSOCKET,
      ServiceType.MCP,
      ServiceType.MEMORY
    ];

    services.forEach(service => {
      this.serviceStatus.set(service, {
        type: service,
        available: false,
        lastCheck: 0,
        errorCount: 0,
        fallbackActive: false
      });
    });
  }

  private setupDefaultFallbacks(): void {
    // Ollama fallbacks
    this.fallbackConfigs.set(ServiceType.OLLAMA, {
      enabled: true,
      timeoutMs: 10000,
      retryAttempts: 3,
      fallbackStrategies: [
        {
          name: 'cloud_openai',
          priority: 1,
          execute: async () => {
            // Fallback to OpenAI API
            return { provider: 'openai', model: 'gpt-3.5-turbo' };
          },
          isAvailable: () => true // Always available as fallback
        },
        {
          name: 'mock_responses',
          priority: 2,
          execute: async () => {
            // Mock responses for testing
            return { provider: 'mock', model: 'mock-model' };
          },
          isAvailable: () => true
        }
      ]
    });

    // KNEZ Backend fallbacks
    this.fallbackConfigs.set(ServiceType.KNEZ_BACKEND, {
      enabled: true,
      timeoutMs: 5000,
      retryAttempts: 2,
      fallbackStrategies: [
        {
          name: 'local_storage',
          priority: 1,
          execute: async () => {
            // Use local storage for basic functionality
            return { provider: 'local', storage: 'localStorage' };
          },
          isAvailable: () => typeof localStorage !== 'undefined'
        },
        {
          name: 'memory_only',
          priority: 2,
          execute: async () => {
            // In-memory only mode
            return { provider: 'memory', storage: 'memory' };
          },
          isAvailable: () => true
        }
      ]
    });

    // WebSocket fallbacks
    this.fallbackConfigs.set(ServiceType.WEBSOCKET, {
      enabled: true,
      timeoutMs: 3000,
      retryAttempts: 5,
      fallbackStrategies: [
        {
          name: 'http_polling',
          priority: 1,
          execute: async () => {
            // Fallback to HTTP polling
            return { transport: 'http_polling', interval: 2000 };
          },
          isAvailable: () => true
        },
        {
          name: 'server_sent_events',
          priority: 2,
          execute: async () => {
            // Fallback to Server-Sent Events
            return { transport: 'sse' };
          },
          isAvailable: () => typeof EventSource !== 'undefined'
        }
      ]
    });
  }

  async checkServiceHealth(serviceType: ServiceType): Promise<boolean> {
    const status = this.serviceStatus.get(serviceType)!;
    const startTime = Date.now();

    try {
      let isHealthy = false;

      switch (serviceType) {
        case ServiceType.OLLAMA:
          isHealthy = await this.checkOllamaHealth();
          break;
        case ServiceType.KNEZ_BACKEND:
          isHealthy = await this.checkKnezBackendHealth();
          break;
        case ServiceType.WEBSOCKET:
          isHealthy = await this.checkWebSocketHealth();
          break;
        case ServiceType.MCP:
          isHealthy = await this.checkMCPHealth();
          break;
        case ServiceType.MEMORY:
          isHealthy = await this.checkMemoryHealth();
          break;
      }

      const responseTime = Date.now() - startTime;
      
      // Update status
      status.available = isHealthy;
      status.lastCheck = Date.now();
      status.responseTime = responseTime;

      if (isHealthy) {
        status.errorCount = 0;
        status.fallbackActive = false;
        status.fallbackType = undefined;
      } else {
        status.errorCount++;
        await this.activateFallback(serviceType);
      }

      this.recalculateServiceLevel();
      return isHealthy;

    } catch (error) {
      status.available = false;
      status.errorCount++;
      status.lastCheck = Date.now();
      status.responseTime = Date.now() - startTime;
      
      await this.activateFallback(serviceType);
      this.recalculateServiceLevel();
      return false;
    }
  }

  private async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags', {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkKnezBackendHealth(): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8000/health', {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async checkWebSocketHealth(): Promise<boolean> {
    // Check if WebSocket connection is active
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket('ws://127.0.0.1:8000/ws/health-check');
        const timeout = setTimeout(() => {
          ws.close();
          resolve(false);
        }, 2000);

        ws.onopen = () => {
          clearTimeout(timeout);
          ws.close();
          resolve(true);
        };

        ws.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      } catch {
        resolve(false);
      }
    });
  }

  private async checkMCPHealth(): Promise<boolean> {
    // Check if MCP servers are responsive
    try {
      // This would check MCP server health
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  private async checkMemoryHealth(): Promise<boolean> {
    // Check if memory system is accessible
    try {
      // Test memory operations
      return true; // Placeholder
    } catch {
      return false;
    }
  }

  private async activateFallback(serviceType: ServiceType): Promise<void> {
    const status = this.serviceStatus.get(serviceType)!;
    const config = this.fallbackConfigs.get(serviceType);

    if (!config || !config.enabled) {
      console.warn(`[ServiceDegradation] No fallback configured for ${serviceType}`);
      return;
    }

    // Try fallback strategies in priority order
    for (const strategy of config.fallbackStrategies) {
      if (strategy.isAvailable()) {
        try {
          await strategy.execute();
          status.fallbackActive = true;
          status.fallbackType = strategy.name;
          console.info(`[ServiceDegradation] Activated fallback ${strategy.name} for ${serviceType}`);
          return;
        } catch (error) {
          console.warn(`[ServiceDegradation] Fallback ${strategy.name} failed for ${serviceType}:`, error);
        }
      }
    }

    console.error(`[ServiceDegradation] All fallbacks failed for ${serviceType}`);
  }

  private recalculateServiceLevel(): void {
    const services = Array.from(this.serviceStatus.values());
    const availableServices = services.filter(s => s.available || s.fallbackActive);
    const totalServices = services.length;

    if (availableServices.length === totalServices) {
      this.currentServiceLevel = ServiceLevel.FULL;
    } else if (availableServices.length >= totalServices * 0.7) {
      this.currentServiceLevel = ServiceLevel.DEGRADED;
    } else if (availableServices.length >= totalServices * 0.3) {
      this.currentServiceLevel = ServiceLevel.MINIMAL;
    } else {
      this.currentServiceLevel = ServiceLevel.OFFLINE;
    }

    // Notify callbacks
    this.degradationCallbacks.forEach(callback => {
      try {
        callback(this.currentServiceLevel, services);
      } catch (error) {
        console.error('[ServiceDegradation] Callback error:', error);
      }
    });
  }

  async executeWithFallback<T>(
    serviceType: ServiceType,
    primaryOperation: () => Promise<T>,
    fallbackOperation?: () => Promise<T>
  ): Promise<T> {
    const status = this.serviceStatus.get(serviceType)!;

    // If service is available, try primary operation
    if (status.available && !status.fallbackActive) {
      try {
        return await primaryOperation();
      } catch (error) {
        console.warn(`[ServiceDegradation] Primary operation failed for ${serviceType}:`, error);
        status.errorCount++;
        await this.checkServiceHealth(serviceType);
      }
    }

    // If fallback is active or primary failed, use fallback
    if (status.fallbackActive && fallbackOperation) {
      try {
        return await fallbackOperation();
      } catch (error) {
        console.error(`[ServiceDegradation] Fallback operation failed for ${serviceType}:`, error);
        throw error;
      }
    }

    // If no fallback available, throw error
    throw new Error(`Service ${serviceType} is unavailable and no fallback is configured`);
  }

  getServiceStatus(serviceType: ServiceType): ServiceStatus | undefined {
    return this.serviceStatus.get(serviceType);
  }

  getAllServiceStatus(): ServiceStatus[] {
    return Array.from(this.serviceStatus.values());
  }

  getServiceLevel(): ServiceLevel {
    return this.currentServiceLevel;
  }

  onDegradationLevelChange(callback: (level: ServiceLevel, status: ServiceStatus[]) => void): () => void {
    this.degradationCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.degradationCallbacks.indexOf(callback);
      if (index > -1) {
        this.degradationCallbacks.splice(index, 1);
      }
    };
  }

  async checkAllServices(): Promise<void> {
    const services = Array.from(this.serviceStatus.keys());
    await Promise.all(services.map(service => this.checkServiceHealth(service)));
  }

  forceServiceLevel(level: ServiceLevel): void {
    this.currentServiceLevel = level;
    console.info(`[ServiceDegradation] Service level manually set to ${level}`);
    
    // Notify callbacks
    this.degradationCallbacks.forEach(callback => {
      try {
        callback(level, Array.from(this.serviceStatus.values()));
      } catch (error) {
        console.error('[ServiceDegradation] Callback error:', error);
      }
    });
  }

  resetService(serviceType: ServiceType): void {
    const serviceStatus = this.serviceStatus.get(serviceType);
    if (serviceStatus) {
      serviceStatus.available = false;
      serviceStatus.errorCount = 0;
      serviceStatus.fallbackActive = false;
      serviceStatus.fallbackType = undefined;
      serviceStatus.lastCheck = 0;
      console.info(`[ServiceDegradation] Reset service ${serviceType}`);
    }
  }

  resetAllServices(): void {
    this.serviceStatus.forEach((_status, serviceType) => {
      this.resetService(serviceType);
    });
    this.currentServiceLevel = ServiceLevel.FULL;
    console.info('[ServiceDegradation] All services reset');
  }
}

// Global instance
export const serviceDegradationManager = new ServiceDegradationManager();
