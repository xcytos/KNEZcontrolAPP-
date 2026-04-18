// ─── EventBasedUIProtocol.ts ─────────────────────────────────────────────
// T8: Event-Based UI Protocol — event streaming for UI updates.
//     Event streaming: tool execution events, status updates, progress events.
//     Integration: ChatService, AgentLoopService.
// ─────────────────────────────────────────────────────────────────────────────

export type UIEventType = 
  | 'tool_call_started'
  | 'tool_call_completed'
  | 'tool_call_failed'
  | 'status_update'
  | 'progress_update'
  | 'message_received'
  | 'error_occurred';

export interface UIEvent {
  id: string;
  type: UIEventType;
  sessionId: string;
  data: any;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface EventSubscription {
  sessionId: string;
  eventTypes: UIEventType[];
  callback: (event: UIEvent) => void;
  active: boolean;
}

/**
 * Event-based UI protocol for streaming events to UI.
 */
export class EventBasedUIProtocol {
  private eventQueue: UIEvent[] = [];
  private subscriptions: Map<string, EventSubscription[]> = new Map(); // sessionId -> subscriptions
  private eventIdCounter = 0;
  private maxQueueSize = 1000;

  /**
   * Emit an event.
   */
  emitEvent(type: UIEventType, sessionId: string, data: any, metadata?: Record<string, any>): void {
    const event: UIEvent = {
      id: `event_${++this.eventIdCounter}`,
      type,
      sessionId,
      data,
      timestamp: Date.now(),
      metadata
    };

    // Add to queue
    this.eventQueue.push(event);

    // Trim queue if too large
    if (this.eventQueue.length > this.maxQueueSize) {
      this.eventQueue = this.eventQueue.slice(-this.maxQueueSize);
    }

    // Notify subscribers
    this.notifySubscribers(event);
  }

  /**
   * Subscribe to events for a session.
   */
  subscribe(
    sessionId: string,
    eventTypes: UIEventType[],
    callback: (event: UIEvent) => void
  ): () => void {
    const subscription: EventSubscription = {
      sessionId,
      eventTypes,
      callback,
      active: true
    };

    const sessionSubs = this.subscriptions.get(sessionId) || [];
    sessionSubs.push(subscription);
    this.subscriptions.set(sessionId, sessionSubs);

    // Return unsubscribe function
    return () => {
      subscription.active = false;
      const subs = this.subscriptions.get(sessionId);
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify subscribers of an event.
   */
  private notifySubscribers(event: UIEvent): void {
    const sessionSubs = this.subscriptions.get(event.sessionId);
    if (!sessionSubs) return;

    for (const sub of sessionSubs) {
      if (!sub.active) continue;

      // Check if subscription is for this event type
      if (sub.eventTypes.includes(event.type) || sub.eventTypes.length === 0) {
        try {
          sub.callback(event);
        } catch (error) {
          console.error('Error in event subscription callback:', error);
        }
      }
    }
  }

  /**
   * Get events for a session.
   */
  getSessionEvents(sessionId: string, eventType?: UIEventType): UIEvent[] {
    let events = this.eventQueue.filter(e => e.sessionId === sessionId);

    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    return events;
  }

  /**
   * Get recent events for a session.
   */
  getRecentEvents(sessionId: string, limit: number = 50): UIEvent[] {
    const sessionEvents = this.eventQueue.filter(e => e.sessionId === sessionId);
    return sessionEvents.slice(-limit);
  }

  /**
   * Get events since a timestamp.
   */
  getEventsSince(sessionId: string, timestamp: number): UIEvent[] {
    return this.eventQueue.filter(e => 
      e.sessionId === sessionId && e.timestamp >= timestamp
    );
  }

  /**
   * Clear events for a session.
   */
  clearSessionEvents(sessionId: string): void {
    this.eventQueue = this.eventQueue.filter(e => e.sessionId !== sessionId);
  }

  /**
   * Clear all events.
   */
  clearAllEvents(): void {
    this.eventQueue = [];
  }

  /**
   * Unsubscribe all subscriptions for a session.
   */
  unsubscribeSession(sessionId: string): void {
    this.subscriptions.delete(sessionId);
  }

  /**
   * Get subscription count for a session.
   */
  getSubscriptionCount(sessionId: string): number {
    const subs = this.subscriptions.get(sessionId);
    return subs ? subs.filter(s => s.active).length : 0;
  }

  /**
   * Get event statistics.
   */
  getEventStats(sessionId?: string): {
    totalEvents: number;
    eventsByType: Map<UIEventType, number>;
    oldestEvent?: UIEvent;
    newestEvent?: UIEvent;
  } {
    const events = sessionId 
      ? this.eventQueue.filter(e => e.sessionId === sessionId)
      : this.eventQueue;

    const eventsByType = new Map<UIEventType, number>();
    for (const event of events) {
      const count = eventsByType.get(event.type) || 0;
      eventsByType.set(event.type, count + 1);
    }

    return {
      totalEvents: events.length,
      eventsByType,
      oldestEvent: events.length > 0 ? events[0] : undefined,
      newestEvent: events.length > 0 ? events[events.length - 1] : undefined
    };
  }

  /**
   * Convenience method: emit tool call started event.
   */
  emitToolCallStarted(sessionId: string, toolName: string, args: any): void {
    this.emitEvent('tool_call_started', sessionId, {
      toolName,
      args
    }, { toolName });
  }

  /**
   * Convenience method: emit tool call completed event.
   */
  emitToolCallCompleted(sessionId: string, toolName: string, result: any, durationMs: number): void {
    this.emitEvent('tool_call_completed', sessionId, {
      toolName,
      result,
      durationMs
    }, { toolName, durationMs });
  }

  /**
   * Convenience method: emit tool call failed event.
   */
  emitToolCallFailed(sessionId: string, toolName: string, error: string, durationMs: number): void {
    this.emitEvent('tool_call_failed', sessionId, {
      toolName,
      error,
      durationMs
    }, { toolName, error });
  }

  /**
   * Convenience method: emit status update event.
   */
  emitStatusUpdate(sessionId: string, status: string, metadata?: Record<string, any>): void {
    this.emitEvent('status_update', sessionId, {
      status,
      metadata
    }, { status });
  }

  /**
   * Convenience method: emit progress update event.
   */
  emitProgressUpdate(sessionId: string, progress: number, total: number, message?: string): void {
    this.emitEvent('progress_update', sessionId, {
      progress,
      total,
      percentage: total > 0 ? (progress / total) * 100 : 0,
      message
    }, { progress, total });
  }

  /**
   * Convenience method: emit error occurred event.
   */
  emitErrorOccurred(sessionId: string, error: string, context?: any): void {
    this.emitEvent('error_occurred', sessionId, {
      error,
      context
    }, { error });
  }

  /**
   * Reset protocol.
   */
  reset(): void {
    this.eventQueue = [];
    this.subscriptions.clear();
    this.eventIdCounter = 0;
  }
}

// Global instance
export const eventBasedUIProtocol = new EventBasedUIProtocol();
