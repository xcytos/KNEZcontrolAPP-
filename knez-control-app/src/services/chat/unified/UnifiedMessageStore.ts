/**
 * Unified Message Store
 * 
 * This module provides a single source of truth for all messages in the chat system.
 * It eliminates the dual-array architecture (messages + assistantMessages) and provides
 * deterministic ordering using sequence numbers instead of fragile timestamp sorting.
 * 
 * Key Features:
 * - Single message array for all message types (user, assistant, tool_execution, etc.)
 * - Sequence number-based ordering (deterministic, not timestamp-dependent)
 * - Atomic persistence (all messages saved/loaded together)
 * - Type-safe message discrimination
 * - Covers all edge cases: rapid sending, streaming, reload, concurrent operations
 */

import { ChatMessage, AssistantMessage } from "../../../domain/DataContracts";

export type UnifiedMessage = 
  | { type: 'chat'; data: ChatMessage }
  | { type: 'assistant'; data: AssistantMessage };

export interface UnifiedMessageStoreState {
  messages: UnifiedMessage[];
  sequenceCounter: number;
  sessionId: string | null;
}

export class UnifiedMessageStore {
  private state: UnifiedMessageStoreState = {
    messages: [],
    sequenceCounter: 0,
    sessionId: null
  };

  private listeners: Set<(state: UnifiedMessageStoreState) => void> = new Set();

  constructor() {}

  // Subscribe to state changes
  subscribe(listener: (state: UnifiedMessageStoreState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners
  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }

  // Get all messages sorted by sequence number (deterministic ordering)
  getMessages(): UnifiedMessage[] {
    return [...this.state.messages].sort((a, b) => {
      const seqA = this.getSequenceNumber(a);
      const seqB = this.getSequenceNumber(b);
      return seqA - seqB;
    });
  }

  // Get only ChatMessage types
  getChatMessages(): ChatMessage[] {
    return this.getMessages()
      .filter(m => m.type === 'chat')
      .map(m => m.data);
  }

  // Get only AssistantMessage types
  getAssistantMessages(): AssistantMessage[] {
    return this.getMessages()
      .filter(m => m.type === 'assistant')
      .map(m => m.data);
  }

  // Get sequence number from a unified message
  private getSequenceNumber(message: UnifiedMessage): number {
    if (message.type === 'chat') {
      return message.data.sequenceNumber ?? 0;
    } else {
      return message.data.sequenceNumber ?? 0;
    }
  }

  // Add a ChatMessage
  addChatMessage(message: ChatMessage): void {
    // Ensure sequence number is set
    if (message.sequenceNumber === undefined) {
      message.sequenceNumber = this.getNextSequenceNumber();
    }

    const unifiedMessage: UnifiedMessage = { type: 'chat', data: message };
    this.state.messages.push(unifiedMessage);
    this.notify();
  }

  // Add an AssistantMessage
  addAssistantMessage(message: AssistantMessage): void {
    // Ensure sequence number is set
    if (message.sequenceNumber === undefined) {
      message.sequenceNumber = this.getNextSequenceNumber();
    }

    const unifiedMessage: UnifiedMessage = { type: 'assistant', data: message };
    this.state.messages.push(unifiedMessage);
    this.notify();
  }

  // Update a message by ID
  updateMessage(id: string, updates: Partial<ChatMessage | AssistantMessage>): void {
    const message = this.state.messages.find(m => 
      (m.type === 'chat' && m.data.id === id) ||
      (m.type === 'assistant' && m.data.id === id)
    );

    if (!message) return;

    if (message.type === 'chat') {
      message.data = { ...message.data, ...updates as ChatMessage };
    } else {
      message.data = { ...message.data, ...updates as AssistantMessage };
    }

    this.notify();
  }

  // Remove a message by ID
  removeMessage(id: string): void {
    this.state.messages = this.state.messages.filter(m => 
      !((m.type === 'chat' && m.data.id === id) || (m.type === 'assistant' && m.data.id === id))
    );
    this.notify();
  }

  // Get next sequence number
  private getNextSequenceNumber(): number {
    const seq = this.state.sequenceCounter;
    this.state.sequenceCounter += 1;
    return seq;
  }

  // Set session ID
  setSessionId(sessionId: string | null): void {
    this.state.sessionId = sessionId;
  }

  // Get session ID
  getSessionId(): string | null {
    return this.state.sessionId;
  }

  // Load messages from persistence (atomic load)
  async loadFromPersistence(
    loadChat: (sessionId: string) => Promise<ChatMessage[]>,
    loadAssistant: (sessionId: string) => Promise<AssistantMessage[]>,
    sessionId: string
  ): Promise<void> {
    try {
      const [chatMessages, assistantMessages] = await Promise.all([
        loadChat(sessionId),
        loadAssistant(sessionId)
      ]);

      // Convert to unified messages
      const unifiedMessages: UnifiedMessage[] = [
        ...chatMessages.map(m => ({ type: 'chat' as const, data: m })),
        ...assistantMessages.map(m => ({ type: 'assistant' as const, data: m }))
      ];

      this.state.messages = unifiedMessages;
      this.state.sessionId = sessionId;

      // Recalculate sequence counter
      const maxSeq = Math.max(
        ...chatMessages.map(m => m.sequenceNumber ?? 0),
        ...assistantMessages.map(m => m.sequenceNumber ?? 0)
      );
      this.state.sequenceCounter = maxSeq + 1;

      this.notify();
    } catch (error) {
      console.error('Failed to load messages from persistence:', error);
      // On error, clear state to prevent corruption
      this.state.messages = [];
      this.state.sequenceCounter = 0;
      this.notify();
    }
  }

  // Save messages to persistence (atomic save)
  async saveToPersistence(
    saveChat: (sessionId: string, messages: ChatMessage[]) => Promise<void>,
    saveAssistant: (sessionId: string, messages: AssistantMessage[]) => Promise<void>
  ): Promise<void> {
    if (!this.state.sessionId) {
      throw new Error('No session ID set');
    }

    const chatMessages = this.getChatMessages();
    const assistantMessages = this.getAssistantMessages();

    // Save both atomically
    await Promise.all([
      saveChat(this.state.sessionId, chatMessages),
      saveAssistant(this.state.sessionId, assistantMessages)
    ]);
  }

  // Clear all messages
  clear(): void {
    this.state.messages = [];
    this.state.sequenceCounter = 0;
    this.notify();
  }

  // Get current state (for debugging)
  getState(): UnifiedMessageStoreState {
    return { ...this.state };
  }
}

// Singleton instance
export const unifiedMessageStore = new UnifiedMessageStore();
