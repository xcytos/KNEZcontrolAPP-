// ─── MessageHelpers.ts ────────────────────────────────────────────────
// Utility functions for message manipulation and validation
// ─────────────────────────────────────────────────────────────────────────────

import { ChatMessage, AssistantMessage, Block, MessageState } from "../../../domain/DataContracts";
import { generateMessageId } from "./IdGenerator";

export function isUserMessage(msg: ChatMessage): boolean {
  return msg.from === "user";
}

export function createAssistantMessage(
  sessionId: string,
  initialBlocks: Block[] = [],
  id?: string
): AssistantMessage {
  return {
    id: id || generateMessageId(),
    sessionId,
    role: "assistant",
    state: MessageState.CREATED,
    blocks: initialBlocks,
    createdAt: Date.now()
  };
}

export function createUserMessage(
  sessionId: string,
  text: string,
  id?: string
): ChatMessage {
  return {
    id: id || generateMessageId(),
    sessionId,
    from: "user",
    text,
    createdAt: new Date().toISOString(),
    sequenceNumber: 0, // Will be set by caller
    deliveryStatus: "delivered",
    correlationId: id || generateMessageId()
  };
}
