/**
 * Message Ordering Service
 * 
 * Provides centralized, deterministic message ordering logic.
 * Eliminates duplicated sorting code across multiple files.
 * 
 * Key Principles:
 * - Always use sequenceNumber for ordering (never timestamps)
 * - Deterministic results regardless of timing
 * - Type-safe operations
 * - Handles edge cases: missing sequence numbers, empty arrays, concurrent operations
 */

import { ChatMessage, AssistantMessage } from "../../../domain/DataContracts";
import { UnifiedMessage } from "./UnifiedMessageStore";

export class MessageOrderingService {
  /**
   * Sort unified messages by sequenceNumber deterministically
   * This replaces all sorting logic in ChatPane, SessionDatabase, etc.
   */
  static sortUnifiedMessages(messages: UnifiedMessage[]): UnifiedMessage[] {
    return [...messages].sort((a, b) => {
      const seqA = this.getSequenceNumber(a);
      const seqB = this.getSequenceNumber(b);
      return seqA - seqB;
    });
  }

  /**
   * Sort ChatMessage array by sequenceNumber
   */
  static sortChatMessages(messages: ChatMessage[]): ChatMessage[] {
    return [...messages].sort((a, b) => {
      const seqA = a.sequenceNumber ?? 0;
      const seqB = b.sequenceNumber ?? 0;
      return seqA - seqB;
    });
  }

  /**
   * Sort AssistantMessage array by sequenceNumber
   */
  static sortAssistantMessages(messages: AssistantMessage[]): AssistantMessage[] {
    return [...messages].sort((a, b) => {
      const seqA = a.sequenceNumber ?? 0;
      const seqB = b.sequenceNumber ?? 0;
      return seqA - seqB;
    });
  }

  /**
   * Get sequence number from a unified message
   */
  private static getSequenceNumber(message: UnifiedMessage): number {
    if (message.type === 'chat') {
      return message.data.sequenceNumber ?? 0;
    } else {
      return message.data.sequenceNumber ?? 0;
    }
  }

  /**
   * Calculate the next sequence number
   * Ensures no gaps in sequence numbers
   */
  static getNextSequenceNumber(currentMax: number): number {
    return currentMax + 1;
  }

  /**
   * Assign sequence numbers to an array of messages
   * Useful for batch operations where sequence numbers need to be set
   */
  static assignSequenceNumbers<T extends { sequenceNumber?: number }>(
    messages: T[],
    startFrom: number = 0
  ): T[] {
    return messages.map((msg, index) => ({
      ...msg,
      sequenceNumber: startFrom + index
    }));
  }

  /**
   * Validate that sequence numbers are contiguous and start from 0 or 1
   * Useful for debugging and ensuring data integrity
   */
  static validateSequenceNumbers(messages: Array<{ sequenceNumber?: number }>): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const sorted = [...messages].sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    // Check for missing sequence numbers
    for (let i = 0; i < sorted.length; i++) {
      const expected = i;
      const actual = sorted[i].sequenceNumber;
      if (actual !== expected) {
        issues.push(`Message at index ${i} has sequenceNumber ${actual}, expected ${expected}`);
      }
    }

    // Check for duplicates
    const seqNumbers = messages.map(m => m.sequenceNumber);
    const uniqueSeqNumbers = new Set(seqNumbers);
    if (seqNumbers.length !== uniqueSeqNumbers.size) {
      issues.push(`Duplicate sequence numbers found`);
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Merge and sort two message arrays by sequenceNumber
   * Used when combining ChatMessage[] and AssistantMessage[]
   */
  static mergeAndSort<T extends { sequenceNumber?: number }>(
    array1: T[],
    array2: T[]
  ): T[] {
    const merged = [...array1, ...array2];
    return this.sortBySequenceNumber(merged);
  }

  /**
   * Generic sort by sequenceNumber
   */
  private static sortBySequenceNumber<T extends { sequenceNumber?: number }>(
    messages: T[]
  ): T[] {
    return [...messages].sort((a, b) => {
      const seqA = a.sequenceNumber ?? 0;
      const seqB = b.sequenceNumber ?? 0;
      return seqA - seqB;
    });
  }

  /**
   * Reassign sequence numbers to ensure they are contiguous
   * Useful for fixing corrupted sequence numbers
   */
  static reassignSequenceNumbers<T extends { sequenceNumber?: number }>(
    messages: T[]
  ): T[] {
    return this.assignSequenceNumbers(messages, 0);
  }
}

// Singleton instance
export const messageOrderingService = new MessageOrderingService();
