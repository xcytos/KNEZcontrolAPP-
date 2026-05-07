import { knezClient } from '../knez/KnezClient';

// Browser-compatible EventEmitter
class EventEmitter {
  private events: Map<string, Function[]> = new Map();

  on(event: string, listener: Function): void {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(listener);
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(...args));
    }
  }

  off(event: string, listener: Function): void {
    const listeners = this.events.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }
}
import { 
  SessionConfig, 
  PlaygroundType, 
  ModelInfo, 
  ProviderInfo 
} from '../../domain/PlaygroundTypes';

export interface StreamController {
  createStream(config: StreamConfig): Promise<Stream>;
  getActiveStreams(): Stream[];
  closeStream(streamId: string): Promise<void>;
}

export interface Stream extends EventEmitter {
  id: string;
  type: string;
  sessionId: string;
  provider: string;
  model: string;
  
  onData(callback: (data: any) => void): void;
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

export interface StreamConfig {
  type: string;
  sessionId: string;
  provider: string;
  model: string;
  config?: Record<string, any>;
}

export interface ModelRouter {
  getAvailableModels(): Promise<ModelInfo[]>;
  getProviderModels(provider: string): Promise<ModelInfo[]>;
  selectModel(provider: string, model: string): Promise<void>;
  getModelInfo(provider: string, model: string): Promise<ModelInfo>;
}

export interface ProviderRegistry {
  getProviders(): Promise<ProviderInfo[]>;
  getProvider(name: string): Promise<ProviderInfo>;
  addProvider(provider: ProviderInfo): Promise<void>;
  removeProvider(name: string): Promise<void>;
  testProvider(provider: ProviderInfo): Promise<boolean>;
}

export interface MemoryService {
  getContext(sessionId: string): Promise<any>;
  setContext(sessionId: string, context: any): Promise<void>;
  searchMemory(query: string, sessionId?: string): Promise<any[]>;
  storeMemory(data: any, sessionId?: string): Promise<string>;
  deleteMemory(memoryId: string): Promise<void>;
}

export interface MCPService {
  listMcpServers(): Promise<any[]>;
  connectMcpServer(serverId: string, config: any): Promise<void>;
  disconnectMcpServer(serverId: string): Promise<void>;
  executeMcpTool(serverId: string, tool: string, args: any): Promise<any>;
}

export interface PlaygroundSDK {
  // Core service access
  getProviderRegistry(): ProviderRegistry;
  getModelRouter(): ModelRouter;
  getStreamController(): StreamController;
  getMemoryService(): MemoryService;
  getMCPService(): MCPService;
  
  // Session management
  createSession(config: SessionConfig): Promise<void>;
  getSession(sessionId: string): Promise<SessionConfig | null>;
  updateSession(sessionId: string, updates: Partial<SessionConfig>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listSessions(): Promise<SessionConfig[]>;
  
  // Event streaming
  subscribeToEvents(eventType: string, handler: (event: any) => void): () => void;
  emitEvent(event: any): void;
  
  // Resource management
  requestResources(requirements: ResourceRequirements): Promise<ResourceAllocation>;
  releaseResources(allocation: ResourceAllocation): Promise<void>;
  
  // UI integration
  showNotification(notification: Notification): void;
  showDialog(dialog: Dialog): Promise<DialogResult>;
  showProgress(progress: ProgressIndicator): void;
}

export interface ResourceRequirements {
  memory?: number; // MB
  cpu?: number; // cores
  disk?: number; // MB
  network?: boolean;
  permissions?: string[];
}

export interface ResourceAllocation {
  id: string;
  allocated: ResourceRequirements;
  available: ResourceRequirements;
  expires: Date;
}

export interface Notification {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  label: string;
  action: () => void;
  style?: 'primary' | 'secondary';
}

export interface Dialog {
  title: string;
  message: string;
  type: 'info' | 'confirm' | 'warning' | 'error';
  buttons: DialogButton[];
  input?: {
    label: string;
    type: 'text' | 'password' | 'number';
    placeholder?: string;
    required?: boolean;
  };
}

export interface DialogButton {
  label: string;
  value: string;
  style?: 'primary' | 'secondary' | 'danger';
}

export interface DialogResult {
  button: string;
  input?: string;
  cancelled: boolean;
}

export interface ProgressIndicator {
  id: string;
  title: string;
  progress: number; // 0-100
  status?: string;
  cancelable?: boolean;
}

class KNEZPlaygroundSDK implements PlaygroundSDK {
  private eventEmitter = new EventEmitter();
  private activeSessions = new Map<string, SessionConfig>();
  // private activeStreams = new Map<string, Stream>(); // TODO: Implement stream tracking
  private resourceAllocations = new Map<string, ResourceAllocation>();

  // Service instances
  private providerRegistry: ProviderRegistry;
  private modelRouter: ModelRouter;
  private streamController: StreamController;
  private memoryService: MemoryService;
  private mcpService: MCPService;

  constructor() {
    this.providerRegistry = new KNEZProviderRegistry();
    this.modelRouter = new KNEZModelRouter(this.providerRegistry);
    this.streamController = new KNEZStreamController(this.modelRouter);
    this.memoryService = new KNEZMemoryService();
    this.mcpService = new KNEZMCPService();
  }

  // Core service access
  getProviderRegistry(): ProviderRegistry {
    return this.providerRegistry;
  }

  getModelRouter(): ModelRouter {
    return this.modelRouter;
  }

  getStreamController(): StreamController {
    return this.streamController;
  }

  getMemoryService(): MemoryService {
    return this.memoryService;
  }

  getMCPService(): MCPService {
    return this.mcpService;
  }

  // Session management
  async createSession(config: SessionConfig): Promise<void> {
    try {
      // Validate session config
      this.validateSessionConfig(config);
      
      // Check resource availability
      const requirements: ResourceRequirements = {
        memory: 512, // Default 512MB per session
        cpu: 1,
        disk: 100,
        network: true,
        permissions: ['terminal', 'filesystem', 'network']
      };
      
      const allocation = await this.requestResources(requirements);
      
      // Store session
      this.activeSessions.set(config.id || '', {
        ...config,
        createdAt: new Date(),
        lastActivity: new Date(),
        resourceAllocation: allocation.id
      });
      
      // Initialize session with backend
      if (config.id) {
        await knezClient.createSession(config);
      }
      
      this.emitEvent({
        type: 'session_created',
        sessionId: config.id,
        config,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      throw new Error(`Failed to create session: ${error.message}`);
    }
  }

  async getSession(sessionId: string): Promise<SessionConfig | null> {
    return this.activeSessions.get(sessionId) || null;
  }

  async updateSession(sessionId: string, updates: Partial<SessionConfig>): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const updatedSession = { ...session, ...updates, lastActivity: new Date() };
    this.activeSessions.set(sessionId, updatedSession);
    
    await knezClient.updateSession(sessionId, updates);
    
    this.emitEvent({
      type: 'session_updated',
      sessionId,
      updates,
      timestamp: Date.now()
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    // Release resources
    if (session.resourceAllocation) {
      await this.releaseResources({
        id: session.resourceAllocation,
        allocated: {} as ResourceRequirements,
        available: {} as ResourceRequirements,
        expires: new Date()
      });
    }
    
    // Close active streams
    const streams = this.streamController.getActiveStreams().filter(s => s.sessionId === sessionId);
    for (const stream of streams) {
      await this.streamController.closeStream(stream.id);
    }
    
    // Remove session
    this.activeSessions.delete(sessionId);
    
    await knezClient.deleteSession(sessionId);
    
    this.emitEvent({
      type: 'session_deleted',
      sessionId,
      timestamp: Date.now()
    });
  }

  async listSessions(): Promise<SessionConfig[]> {
    return Array.from(this.activeSessions.values());
  }

  // Event streaming
  subscribeToEvents(eventType: string, handler: (event: any) => void): () => void {
    this.eventEmitter.on(eventType, handler);
    return () => this.eventEmitter.off(eventType, handler);
  }

  emitEvent(event: any): void {
    this.eventEmitter.emit(event.type, event);
  }

  // Resource management
  async requestResources(requirements: ResourceRequirements): Promise<ResourceAllocation> {
    const allocation: ResourceAllocation = {
      id: `alloc-${Date.now()}`,
      allocated: requirements,
      available: requirements,
      expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
    };
    
    this.resourceAllocations.set(allocation.id, allocation);
    return allocation;
  }

  async releaseResources(allocation: ResourceAllocation): Promise<void> {
    this.resourceAllocations.delete(allocation.id);
  }

  // UI integration
  showNotification(notification: Notification): void {
    // Emit notification event for UI components to handle
    this.emitEvent({
      type: 'notification',
      notification,
      timestamp: Date.now()
    });
  }

  async showDialog(dialog: Dialog): Promise<DialogResult> {
    // Emit dialog event and wait for response
    return new Promise((resolve) => {
      const dialogId = `dialog-${Date.now()}`;
      
      const handleResponse = (response: any) => {
        if (response.dialogId === dialogId) {
          this.eventEmitter.off('dialog_response', handleResponse);
          resolve(response.result);
        }
      };
      
      this.eventEmitter.on('dialog_response', handleResponse);
      
      this.emitEvent({
        type: 'dialog_show',
        dialogId,
        dialog,
        timestamp: Date.now()
      });
    });
  }

  showProgress(progress: ProgressIndicator): void {
    this.emitEvent({
      type: 'progress_show',
      progress,
      timestamp: Date.now()
    });
  }

  private validateSessionConfig(config: SessionConfig): void {
    if (!config.id || !config.name || !config.type) {
      throw new Error('Missing required session fields: id, name, type');
    }
    
    if (!Object.values(PlaygroundType).includes(config.type)) {
      throw new Error(`Invalid playground type: ${config.type}`);
    }
  }
}

// Service implementations
class KNEZProviderRegistry implements ProviderRegistry {
  async getProviders(): Promise<ProviderInfo[]> {
    return await knezClient.getProviders();
  }

  async getProvider(name: string): Promise<ProviderInfo> {
    const providers = await this.getProviders();
    const provider = providers.find(p => p.name === name);
    if (!provider) {
      throw new Error(`Provider ${name} not found`);
    }
    return provider;
  }

  async addProvider(provider: ProviderInfo): Promise<void> {
    await knezClient.addProvider(provider);
  }

  async removeProvider(name: string): Promise<void> {
    await knezClient.removeProvider(name);
  }

  async testProvider(provider: ProviderInfo): Promise<boolean> {
    return await knezClient.testProvider(provider);
  }
}

class KNEZModelRouter implements ModelRouter {
  constructor(private providerRegistry: ProviderRegistry) {}

  async getAvailableModels(): Promise<ModelInfo[]> {
    const providers = await this.providerRegistry.getProviders();
    const allModels: ModelInfo[] = [];
    
    for (const provider of providers) {
      try {
        const models = await this.getProviderModels(provider.name);
        allModels.push(...models);
      } catch (error) {
        console.warn(`Failed to get models for provider ${provider.name}:`, error);
      }
    }
    
    return allModels;
  }

  async getProviderModels(provider: string): Promise<ModelInfo[]> {
    return await knezClient.getProviderModels(provider);
  }

  async selectModel(provider: string, model: string): Promise<void> {
    await knezClient.selectModel(provider, model);
  }

  async getModelInfo(provider: string, model: string): Promise<ModelInfo> {
    const models = await this.getProviderModels(provider);
    const modelInfo = models.find(m => m.model === model);
    if (!modelInfo) {
      throw new Error(`Model ${model} not found for provider ${provider}`);
    }
    return modelInfo;
  }
}

class KNEZStreamController implements StreamController {
  private streams = new Map<string, Stream>();

  constructor(private modelRouter: ModelRouter) {}

  async createStream(config: StreamConfig): Promise<Stream> {
    const stream = new KNEZStream(config, this.modelRouter);
    this.streams.set(stream.id, stream);
    return stream;
  }

  getActiveStreams(): Stream[] {
    return Array.from(this.streams.values());
  }

  async closeStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (stream) {
      await stream.close();
      this.streams.delete(streamId);
    }
  }
}

class KNEZStream extends EventEmitter implements Stream {
  id: string;
  type: string;
  sessionId: string;
  provider: string;
  model: string;
  
  private connected = false;
  private modelRouter: ModelRouter;

  constructor(config: StreamConfig, modelRouter: ModelRouter) {
    super();
    this.id = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = config.type;
    this.sessionId = config.sessionId;
    this.provider = config.provider;
    this.model = config.model;
    this.modelRouter = modelRouter;
  }

  onData(callback: (data: any) => void): void {
    this.on('data', callback);
  }

  async write(data: any): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
    
    // Send data through KNEZ backend
    await knezClient.sendStreamData(this.id, data);
  }

  async close(): Promise<void> {
    this.connected = false;
    await knezClient.closeStream(this.id);
    this.emit('close');
    this.removeAllListeners();
  }

  private async connect(): Promise<void> {
    try {
      // Get model info
      const modelInfo = await this.modelRouter.getModelInfo(this.provider, this.model);
      
      // Connect to KNEZ backend
      await knezClient.createStream(this.id, {
        type: this.type,
        sessionId: this.sessionId,
        provider: this.provider,
        model: this.model,
        modelInfo
      });
      
      this.connected = true;
      this.emit('connected');
      
      // Listen for incoming data
      knezClient.onStreamData(this.id, (data) => {
        this.emit('data', data);
      });
      
    } catch (error) {
      throw new Error(`Failed to connect stream: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class KNEZMemoryService implements MemoryService {
  async getContext(sessionId: string): Promise<any> {
    return await knezClient.getMemoryContext(sessionId);
  }

  async setContext(sessionId: string, context: any): Promise<void> {
    await knezClient.setMemoryContext(sessionId, context);
  }

  async searchMemory(query: string, sessionId?: string): Promise<any[]> {
    return await knezClient.searchMemory(query, sessionId);
  }

  async storeMemory(data: any, sessionId?: string): Promise<string> {
    return await knezClient.storeMemory(data, sessionId);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    await knezClient.deleteMemory(memoryId);
  }
}

class KNEZMCPService implements MCPService {
  async listMcpServers(): Promise<any[]> {
    return await knezClient.listMcpServers();
  }

  async connectMcpServer(serverId: string, config: any): Promise<void> {
    await knezClient.connectMcpServer(serverId, config);
  }

  async disconnectMcpServer(serverId: string): Promise<void> {
    await knezClient.disconnectMcpServer(serverId);
  }

  async executeMcpTool(serverId: string, tool: string, args: any): Promise<any> {
    return await knezClient.executeMcpTool(serverId, tool, args);
  }
}

// Export singleton instance
export const playgroundSDK = new KNEZPlaygroundSDK();
