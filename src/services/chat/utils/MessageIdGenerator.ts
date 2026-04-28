// ─── MessageIdGenerator.ts ─────────────────────────────────────────────
// Extracted from ChatService.ts - Phase 1 Week 2
// Responsibilities: Unique message ID generation, sequence number management
// ─────────────────────────────────────────────────────────────────────────────

export class MessageIdGenerator {
  private sequenceCounter: number = 0;

  /**
   * Generate a new unique message ID
   */
  generateMessageId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID().replace(/-/g, "");
    }
    // Fallback for environments without crypto.randomUUID
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate user message ID
   */
  generateUserMessageId(): string {
    return this.generateMessageId();
  }

  /**
   * Generate assistant message ID based on user message ID
   */
  generateAssistantMessageId(userMessageId: string): string {
    return `${userMessageId}-assistant`;
  }

  /**
   * Generate tool trace message ID
   */
  generateToolTraceMessageId(assistantId: string, step: number, index: number, suffix?: string): string {
    return `${assistantId}-tool-${step}-${index}${suffix ? `-${suffix}` : ""}`;
  }

  /**
   * Generate stream ID
   */
  generateStreamId(): string {
    return this.generateMessageId();
  }

  /**
   * Generate trace ID
   */
  generateTraceId(): string {
    return this.generateMessageId();
  }

  /**
   * Generate tool call ID
   */
  generateToolCallId(assistantId: string, step: number, index: number): string {
    return `${assistantId}-tool-${step}-${index}-call`;
  }

  // ─── Sequence Number Management ─────────────────────────────────────────

  /**
   * Get next sequence number
   */
  getNextSequenceNumber(): number {
    this.sequenceCounter += 1;
    return this.sequenceCounter;
  }

  /**
   * Get current sequence counter
   */
  getSequenceCounter(): number {
    return this.sequenceCounter;
  }

  /**
   * Set sequence counter
   */
  setSequenceCounter(value: number): void {
    this.sequenceCounter = value;
  }

  /**
   * Reset sequence counter
   */
  resetSequenceCounter(): void {
    this.sequenceCounter = 0;
  }

  /**
   * Initialize sequence counter from existing messages
   */
  initializeFromMessages(messages: Array<{ sequenceNumber?: number }>): void {
    const maxSeq = Math.max(0, ...messages.map(m => m.sequenceNumber ?? 0));
    this.sequenceCounter = maxSeq + 1;
  }
}

// ─── Standalone function for backward compatibility ────────────────────

export function newMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}
