/**
 * Unified Chat Architecture
 * 
 * This module provides a unified, modular architecture for chat message management.
 * It eliminates dual storage, dual message arrays, and duplicated sorting logic.
 * 
 * Exports:
 * - UnifiedMessageStore: Single source of truth for all messages
 * - MessageRepository: Unified persistence layer
 * - MessageOrderingService: Centralized ordering logic
 */

export { unifiedMessageStore, UnifiedMessageStore } from './UnifiedMessageStore';
export type { UnifiedMessage, UnifiedMessageStoreState } from './UnifiedMessageStore';
export { messageRepository, MessageRepository } from './MessageRepository';
export { messageOrderingService, MessageOrderingService } from './MessageOrderingService';
