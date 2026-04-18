// ─── StreamingChannelIsolator.ts ───────────────────────────────────────────
// T7: Streaming Channel Isolation — isolates streaming channels to prevent
//     interference between concurrent operations. Channel management:
//     per-session channels, priority-based routing, backpressure handling.
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelPriority = 'low' | 'normal' | 'high' | 'critical';

export interface StreamingChannel {
  id: string;
  sessionId: string;
  priority: ChannelPriority;
  active: boolean;
  createdAt: number;
  lastActivity: number;
  bufferSize: number;
  maxBufferSize: number;
}

export interface ChannelMessage {
  channelId: string;
  type: string;
  data: any;
  timestamp: number;
  priority: ChannelPriority;
}

export interface ChannelStats {
  totalChannels: number;
  activeChannels: number;
  totalMessages: number;
  droppedMessages: number;
  averageLatencyMs: number;
}

/**
 * Streaming channel isolator for managing concurrent streaming operations.
 */
export class StreamingChannelIsolator {
  private channels: Map<string, StreamingChannel> = new Map();
  private messageQueues: Map<string, ChannelMessage[]> = new Map();
  private channelIdCounter = 0;
  private stats = {
    totalMessages: 0,
    droppedMessages: 0,
    totalLatencyMs: 0,
    latencyCount: 0
  };

  /**
   * Create a new streaming channel for a session.
   */
  createChannel(
    sessionId: string,
    priority: ChannelPriority = 'normal',
    maxBufferSize: number = 1000
  ): string {
    const channelId = `channel_${++this.channelIdCounter}`;
    const channel: StreamingChannel = {
      id: channelId,
      sessionId,
      priority,
      active: true,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      bufferSize: 0,
      maxBufferSize
    };

    this.channels.set(channelId, channel);
    this.messageQueues.set(channelId, []);
    
    return channelId;
  }

  /**
   * Get channel by ID.
   */
  getChannel(channelId: string): StreamingChannel | null {
    return this.channels.get(channelId) || null;
  }

  /**
   * Get all channels for a session.
   */
  getSessionChannels(sessionId: string): StreamingChannel[] {
    return Array.from(this.channels.values()).filter(c => c.sessionId === sessionId);
  }

  /**
   * Send message to a channel.
   */
  async sendMessage(
    channelId: string,
    type: string,
    data: any,
    priority?: ChannelPriority
  ): Promise<{ success: boolean; error?: string }> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    if (!channel.active) {
      return { success: false, error: 'Channel is not active' };
    }

    const queue = this.messageQueues.get(channelId);
    if (!queue) {
      return { success: false, error: 'Message queue not found' };
    }

    // Check buffer size
    if (queue.length >= channel.maxBufferSize) {
      this.stats.droppedMessages++;
      return { success: false, error: 'Channel buffer full' };
    }

    const message: ChannelMessage = {
      channelId,
      type,
      data,
      timestamp: Date.now(),
      priority: priority || channel.priority
    };

    queue.push(message);
    channel.bufferSize = queue.length;
    channel.lastActivity = Date.now();
    this.stats.totalMessages++;

    return { success: true };
  }

  /**
   * Get next message from a channel.
   */
  getNextMessage(channelId: string): ChannelMessage | null {
    const queue = this.messageQueues.get(channelId);
    if (!queue || queue.length === 0) {
      return null;
    }

    const message = queue.shift();
    if (message) {
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.bufferSize = queue.length;
        channel.lastActivity = Date.now();
        
        // Track latency
        const latency = Date.now() - message.timestamp;
        this.stats.totalLatencyMs += latency;
        this.stats.latencyCount++;
      }
    }

    return message || null;
  }

  /**
   * Get all messages from a channel (non-destructive).
   */
  peekMessages(channelId: string): ChannelMessage[] {
    const queue = this.messageQueues.get(channelId);
    return queue ? [...queue] : [];
  }

  /**
   * Clear message queue for a channel.
   */
  clearQueue(channelId: string): void {
    const queue = this.messageQueues.get(channelId);
    if (queue) {
      queue.length = 0;
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.bufferSize = 0;
      }
    }
  }

  /**
   * Activate a channel.
   */
  activateChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.active = true;
      channel.lastActivity = Date.now();
    }
  }

  /**
   * Deactivate a channel.
   */
  deactivateChannel(channelId: string): void {
    const channel = this.channels.get(channelId);
    if (channel) {
      channel.active = false;
    }
  }

  /**
   * Close a channel.
   */
  closeChannel(channelId: string): void {
    this.channels.delete(channelId);
    this.messageQueues.delete(channelId);
  }

  /**
   * Close all channels for a session.
   */
  closeSessionChannels(sessionId: string): void {
    const sessionChannels = this.getSessionChannels(sessionId);
    for (const channel of sessionChannels) {
      this.closeChannel(channel.id);
    }
  }

  /**
   * Get channel statistics.
   */
  getChannelStats(channelId: string): {
    bufferSize: number;
    active: boolean;
    ageMs: number;
    idleTimeMs: number;
  } | null {
    const channel = this.channels.get(channelId);
    if (!channel) return null;

    return {
      bufferSize: channel.bufferSize,
      active: channel.active,
      ageMs: Date.now() - channel.createdAt,
      idleTimeMs: Date.now() - channel.lastActivity
    };
  }

  /**
   * Get overall statistics.
   */
  getOverallStats(): ChannelStats {
    const activeChannels = Array.from(this.channels.values()).filter(c => c.active).length;
    const averageLatencyMs = this.stats.latencyCount > 0 
      ? this.stats.totalLatencyMs / this.stats.latencyCount 
      : 0;

    return {
      totalChannels: this.channels.size,
      activeChannels,
      totalMessages: this.stats.totalMessages,
      droppedMessages: this.stats.droppedMessages,
      averageLatencyMs
    };
  }

  /**
   * Get messages by priority from a channel.
   */
  getMessagesByPriority(channelId: string, priority: ChannelPriority): ChannelMessage[] {
    const queue = this.messageQueues.get(channelId);
    if (!queue) return [];

    return queue.filter(m => m.priority === priority);
  }

  /**
   * Apply backpressure: drop low-priority messages when buffer is near full.
   */
  applyBackpressure(channelId: string, threshold: number = 0.8): number {
    const channel = this.channels.get(channelId);
    if (!channel) return 0;

    const queue = this.messageQueues.get(channelId);
    if (!queue) return 0;

    const bufferRatio = queue.length / channel.maxBufferSize;
    if (bufferRatio < threshold) return 0;

    // Drop low-priority messages first
    const priorityOrder: ChannelPriority[] = ['low', 'normal', 'high', 'critical'];
    let dropped = 0;

    for (const priority of priorityOrder) {
      if (bufferRatio < threshold) break;
      
      const index = queue.findIndex(m => m.priority === priority);
      if (index !== -1) {
        queue.splice(index, 1);
        this.stats.droppedMessages++;
        dropped++;
      }
    }

    channel.bufferSize = queue.length;
    return dropped;
  }

  /**
   * Reorder messages in queue by priority.
   */
  reorderByPriority(channelId: string): void {
    const queue = this.messageQueues.get(channelId);
    if (!queue) return;

    const priorityValue: Record<ChannelPriority, number> = {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1
    };

    queue.sort((a, b) => {
      const priorityDiff = priorityValue[b.priority] - priorityValue[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp; // FIFO within same priority
    });
  }

  /**
   * Get active sessions.
   */
  getActiveSessions(): string[] {
    const sessionIds = new Set<string>();
    for (const channel of this.channels.values()) {
      if (channel.active) {
        sessionIds.add(channel.sessionId);
      }
    }
    return Array.from(sessionIds);
  }

  /**
   * Reset statistics.
   */
  resetStats(): void {
    this.stats = {
      totalMessages: 0,
      droppedMessages: 0,
      totalLatencyMs: 0,
      latencyCount: 0
    };
  }

  /**
   * Clear all channels and queues.
   */
  clearAll(): void {
    this.channels.clear();
    this.messageQueues.clear();
    this.resetStats();
  }
}

// Global instance
export const streamingChannelIsolator = new StreamingChannelIsolator();
