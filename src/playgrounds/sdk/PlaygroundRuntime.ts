import { 
  PlaygroundManifest, 
  RuntimeConfig, 
  RuntimeStatus, 
  SessionConfig, 
  RuntimeSession, 
  SessionStatus,
  StreamConfig, 
  RuntimeStream, 
  StreamType, 
  StreamStatus,
  RuntimeHealth,
  RuntimeMetrics,
  PTYHandle,
  PTYEvent,
  PTYEventHandler,
  TerminalSize
} from './PlaygroundManifest';

export abstract class PlaygroundRuntime {
  protected manifest: PlaygroundManifest;
  protected status: RuntimeStatus;
  protected sessions: Map<string, RuntimeSession>;
  protected streams: Map<string, RuntimeStream>;
  protected eventListeners: Map<string, Function[]>;

  constructor(manifest: PlaygroundManifest) {
    this.manifest = manifest;
    this.status = RuntimeStatus.STOPPED;
    this.sessions = new Map();
    this.streams = new Map();
    this.eventListeners = new Map();
  }

  // Core lifecycle
  abstract launch(config: RuntimeConfig): Promise<void>;
  abstract attach(pty: PTYHandle): Promise<void>;
  abstract suspend(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract dispose(): Promise<void>;

  // Session management
  async createSession(config: SessionConfig): Promise<RuntimeSession> {
    const session: RuntimeSession = {
      id: config.id,
      runtimeId: this.manifest.id,
      status: SessionStatus.INITIALIZING,
      config,
      pty: null as any,
      streams: new Map(),
      created: new Date(),
      lastActivity: new Date(),
      start: async () => {},
      stop: async () => {},
      pause: async () => {},
      resume: async () => {},
      destroy: async () => {}
    };

    this.sessions.set(config.id, session);
    this.emit('sessionCreated', session);
    
    try {
      await this.start();
      session.status = SessionStatus.ACTIVE;
      session.lastActivity = new Date();
      this.emit('sessionStarted', session);
    } catch (error) {
      session.status = SessionStatus.ERROR;
      this.emit('sessionError', { session, error });
    }

    return session;
  }

  async attachSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new Error(`Session ${sessionId} is not active`);
    }

    this.emit('sessionAttached', session);
  }

  async detachSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = SessionStatus.PAUSED;
      session.lastActivity = new Date();
      this.emit('sessionDetached', session);
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = SessionStatus.TERMINATING;
      
      // Clean up streams
      for (const [streamId, stream] of session.streams) {
        await this.destroyStream(streamId);
      }
      
      // Clean up PTY
      if (session.pty) {
        await session.pty.kill();
      }
      
      session.status = SessionStatus.TERMINATED;
      this.sessions.delete(sessionId);
      this.emit('sessionDestroyed', session);
    }
  }

  // Stream management
  async createStream(config: StreamConfig): Promise<RuntimeStream> {
    const stream: RuntimeStream = {
      id: config.id,
      sessionId: config.sessionId,
      type: config.type,
      status: StreamStatus.CONNECTING,
      config,
      input: new WritableStream(),
      output: new ReadableStream(),
      start: async () => {},
      stop: async () => {},
      pause: async () => {},
      resume: async () => {},
      destroy: async () => {}
    };

    this.streams.set(config.id, stream);
    
    try {
      await this.startStream(stream);
      stream.status = StreamStatus.CONNECTED;
      this.emit('streamCreated', stream);
    } catch (error) {
      stream.status = StreamStatus.ERROR;
      this.emit('streamError', { stream, error });
    }

    return stream;
  }

  async attachStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }

    if (stream.status !== StreamStatus.CONNECTED) {
      throw new Error(`Stream ${streamId} is not connected`);
    }

    this.emit('streamAttached', stream);
  }

  async destroyStream(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    if (stream) {
      stream.status = StreamStatus.DISCONNECTED;
      await stream.input?.close();
      await stream.output?.cancel();
      this.streams.delete(streamId);
      this.emit('streamDestroyed', stream);
    }
  }

  // Health monitoring
  async healthCheck(): Promise<RuntimeHealth> {
    try {
      const metrics = await this.getMetrics();
      const health: RuntimeHealth = {
        status: 'healthy',
        cpuUsage: metrics.cpuUsage,
        memoryUsage: metrics.memoryUsage,
        diskUsage: 0, // TODO: Implement disk usage
        networkLatency: 0, // TODO: Implement network latency
        lastCheck: new Date(),
        uptime: Date.now() - metrics.startTime.getTime()
      };

      // Determine health status
      if (metrics.cpuUsage > 80 || metrics.memoryUsage > 80) {
        health.status = 'degraded';
      }
      if (metrics.errors > 0) {
        health.status = 'unhealthy';
      }

      return health;
    } catch (error) {
      return {
        status: 'unhealthy',
        lastCheck: new Date(),
        uptime: 0,
        error: error as Error
      };
    }
  }

  abstract getMetrics(): Promise<RuntimeMetrics>;

  // Event handling
  on(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(handler);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Status management
  getStatus(): RuntimeStatus {
    return this.status;
  }

  setStatus(status: RuntimeStatus): void {
    const oldStatus = this.status;
    this.status = status;
    this.emit('statusChanged', { oldStatus, newStatus: status });
  }

  // Session access
  getSession(sessionId: string): RuntimeSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): RuntimeSession[] {
    return Array.from(this.sessions.values());
  }

  // Stream access
  getStream(streamId: string): RuntimeStream | undefined {
    return this.streams.get(streamId);
  }

  getAllStreams(): RuntimeStream[] {
    return Array.from(this.streams.values());
  }

  // Manifest access
  getManifest(): PlaygroundManifest {
    return this.manifest;
  }

  // Protected methods for subclasses
  protected async start(): Promise<void> {
    if (this.status === RuntimeStatus.STOPPED) {
      this.setStatus(RuntimeStatus.STARTING);
      await this.doStart();
      this.setStatus(RuntimeStatus.RUNNING);
      this.emit('started');
    }
  }

  protected abstract doStart(): Promise<void>;

  protected async startStream(stream: RuntimeStream): Promise<void> {
    // Default implementation - override in subclasses
    this.emit('streamStarted', stream);
  }

  protected async stop(): Promise<void> {
    if (this.status === RuntimeStatus.RUNNING) {
      this.setStatus(RuntimeStatus.TERMINATING);
      
      // Stop all sessions
      for (const [sessionId, session] of this.sessions) {
        await this.destroySession(sessionId);
      }
      
      await this.doStop();
      this.setStatus(RuntimeStatus.STOPPED);
      this.emit('stopped');
    }
  }

  protected abstract doStop(): Promise<void>;
}
