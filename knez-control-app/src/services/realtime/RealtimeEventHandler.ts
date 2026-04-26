/**
 * Real-time Event Handler
 * 
 * Manages WebSocket connection and routes real-time events to appropriate handlers.
 * This service connects to the backend WebSocket and dispatches events to registered handlers.
 */

import { webSocketClient } from '../websocket/WebSocketClient';
import { WebSocketMessage } from '../../domain/WebSocketProtocol';
import { logger } from '../utils/LogService';
import {
  RealtimeEvent,
  RealtimeEventType,
  TokenEventData,
  AgentStateEventData,
  ToolCallEventData,
  ToolResultEventData,
  ErrorEventData,
  StreamStartEventData,
  StreamEndEventData,
  isTokenEventData,
  isAgentStateEventData,
  isToolCallEventData,
  isToolResultEventData,
  isErrorEventData,
  isStreamStartEventData,
  isStreamEndEventData
} from '../../domain/RealtimeProtocol';

export type TokenHandler = (data: TokenEventData) => void;
export type AgentStateHandler = (data: AgentStateEventData) => void;
export type ToolCallHandler = (data: ToolCallEventData) => void;
export type ToolResultHandler = (data: ToolResultEventData) => void;
export type ErrorHandler = (data: ErrorEventData) => void;
export type StreamStartHandler = (data: StreamStartEventData) => void;
export type StreamEndHandler = (data: StreamEndEventData) => void;

export class RealtimeEventHandler {
  private sessionId: string | null = null;
  private isConnected = false;
  private tokenHandlers: Set<TokenHandler> = new Set();
  private agentStateHandlers: Set<AgentStateHandler> = new Set();
  private toolCallHandlers: Set<ToolCallHandler> = new Set();
  private toolResultHandlers: Set<ToolResultHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private streamStartHandlers: Set<StreamStartHandler> = new Set();
  private streamEndHandlers: Set<StreamEndHandler> = new Set();

  constructor() {
    this.setupWebSocketListeners();
  }

  /**
   * Connect to WebSocket for a session
   */
  connect(sessionId: string): void {
    if (this.sessionId === sessionId && this.isConnected) {
      logger.info('realtime_handler', 'already_connected', { sessionId });
      return;
    }

    this.sessionId = sessionId;
    webSocketClient.connect(sessionId);
    logger.info('realtime_handler', 'connecting', { sessionId });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    webSocketClient.disconnect();
    this.sessionId = null;
    this.isConnected = false;
    logger.info('realtime_handler', 'disconnected');
  }

  /**
   * Setup WebSocket message listeners
   */
  private setupWebSocketListeners(): void {
    // Listen for connection established
    webSocketClient.on('connected', (message: WebSocketMessage) => {
      this.isConnected = true;
      logger.info('realtime_handler', 'websocket_connected', message.data);
    });

    // Listen for all events
    webSocketClient.on('event', (message: WebSocketMessage) => {
      this.handleEvent(message);
    });

    // Listen for errors
    webSocketClient.on('error', (message: WebSocketMessage) => {
      logger.error('realtime_handler', 'websocket_error', message.data);
    });
  }

  /**
   * Handle incoming WebSocket event
   */
  private handleEvent(message: WebSocketMessage): void {
    try {
      const eventData = message.data;
      const eventType = eventData.event_type;
      const payload = eventData.payload;

      logger.debug('realtime_handler', 'event_received', { eventType, payloadType: payload?.type });

      // Check if this is a real-time event
      // Allow all events through - backend may not use realtime_ prefix
      // Events are filtered by type in the switch statement below
      if (!eventType) {
        logger.debug('realtime_handler', 'event_filtered', { eventType, reason: 'no event type' });
        return;
      }

      // Parse the real-time event
      const realtimeEvent: RealtimeEvent = {
        type: payload.type,
        session_id: payload.session_id,
        data: payload.data,
        timestamp: payload.timestamp
      };

      logger.debug('realtime_handler', 'realtime_event_parsed', { type: realtimeEvent.type });

      // Route to appropriate handler based on event type
      switch (realtimeEvent.type) {
        case RealtimeEventType.TOKEN:
          if (isTokenEventData(realtimeEvent.data)) {
            this.dispatchToken(realtimeEvent.data);
          }
          break;

        case RealtimeEventType.AGENT_STATE:
          if (isAgentStateEventData(realtimeEvent.data)) {
            this.dispatchAgentState(realtimeEvent.data);
          }
          break;

        case RealtimeEventType.TOOL_CALL:
          if (isToolCallEventData(realtimeEvent.data)) {
            this.dispatchToolCall(realtimeEvent.data);
          }
          break;

        case RealtimeEventType.TOOL_RESULT:
          if (isToolResultEventData(realtimeEvent.data)) {
            this.dispatchToolResult(realtimeEvent.data);
          }
          break;

        case RealtimeEventType.ERROR:
          if (isErrorEventData(realtimeEvent.data)) {
            this.dispatchError(realtimeEvent.data);
          }
          break;

        case RealtimeEventType.STREAM_START:
          if (isStreamStartEventData(realtimeEvent.data)) {
            this.dispatchStreamStart(realtimeEvent.data);
          }
          break;

        case RealtimeEventType.STREAM_END:
          if (isStreamEndEventData(realtimeEvent.data)) {
            this.dispatchStreamEnd(realtimeEvent.data);
          }
          break;

        default:
          logger.warn('realtime_handler', 'unknown_event_type', { type: realtimeEvent.type });
      }
    } catch (error) {
      logger.error('realtime_handler', 'event_handling_error', { error: String(error), message });
    }
  }

  /**
   * Register token handler
   */
  onToken(handler: TokenHandler): () => void {
    this.tokenHandlers.add(handler);
    return () => this.tokenHandlers.delete(handler);
  }

  /**
   * Register agent state handler
   */
  onAgentState(handler: AgentStateHandler): () => void {
    this.agentStateHandlers.add(handler);
    return () => this.agentStateHandlers.delete(handler);
  }

  /**
   * Register tool call handler
   */
  onToolCall(handler: ToolCallHandler): () => void {
    this.toolCallHandlers.add(handler);
    return () => this.toolCallHandlers.delete(handler);
  }

  /**
   * Register tool result handler
   */
  onToolResult(handler: ToolResultHandler): () => void {
    this.toolResultHandlers.add(handler);
    return () => this.toolResultHandlers.delete(handler);
  }

  /**
   * Register error handler
   */
  onError(handler: ErrorHandler): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * Register stream start handler
   */
  onStreamStart(handler: StreamStartHandler): () => void {
    this.streamStartHandlers.add(handler);
    return () => this.streamStartHandlers.delete(handler);
  }

  /**
   * Register stream end handler
   */
  onStreamEnd(handler: StreamEndHandler): () => void {
    this.streamEndHandlers.add(handler);
    return () => this.streamEndHandlers.delete(handler);
  }

  /**
   * Dispatch token event to all handlers
   */
  private dispatchToken(data: TokenEventData): void {
    logger.debug('realtime_handler', 'token_received', { index: data.index, token: data.token.slice(0, 10) });
    this.tokenHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'token_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Dispatch agent state event to all handlers
   */
  private dispatchAgentState(data: AgentStateEventData): void {
    logger.debug('realtime_handler', 'agent_state_changed', { state: data.state });
    this.agentStateHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'agent_state_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Dispatch tool call event to all handlers
   */
  private dispatchToolCall(data: ToolCallEventData): void {
    logger.debug('realtime_handler', 'tool_call_received', { tool_name: data.tool_name, tool_id: data.tool_id });
    this.toolCallHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'tool_call_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Dispatch tool result event to all handlers
   */
  private dispatchToolResult(data: ToolResultEventData): void {
    logger.debug('realtime_handler', 'tool_result_received', { tool_id: data.tool_id });
    this.toolResultHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'tool_result_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Dispatch error event to all handlers
   */
  private dispatchError(data: ErrorEventData): void {
    logger.error('realtime_handler', 'error_received', { error_type: data.error_type, message: data.message });
    this.errorHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'error_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Dispatch stream start event to all handlers
   */
  private dispatchStreamStart(data: StreamStartEventData): void {
    logger.debug('realtime_handler', 'stream_started', { backend_id: data.backend_id, model: data.model });
    this.streamStartHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'stream_start_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Dispatch stream end event to all handlers
   */
  private dispatchStreamEnd(data: StreamEndEventData): void {
    logger.debug('realtime_handler', 'stream_ended', { total_tokens: data.total_tokens, total_time_ms: data.total_time_ms });
    this.streamEndHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        logger.error('realtime_handler', 'stream_end_handler_error', { error: String(error) });
      }
    });
  }

  /**
   * Get connection state
   */
  getConnectionState(): { connected: boolean; sessionId: string | null } {
    return {
      connected: this.isConnected,
      sessionId: this.sessionId
    };
  }
}

// Singleton instance
export const realtimeEventHandler = new RealtimeEventHandler();
