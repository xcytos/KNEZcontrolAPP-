// ─── ResponseAssembler.ts ────────────────────────────────────────────────
// Append + finalize assistant response
// Responsibilities: bind to assistantId, append chunks safely, enforce content integrity
// Rules: Cannot append if message missing, cannot finalize twice, if no content → fallback
// ─────────────────────────────────────────────────────────────────────────────

import { Block, MessageState } from "../../../domain/DataContracts";
import { logger } from "../../utils/LogService";

export class ResponseAssembler {
  private assistantId: string;
  private finalized: boolean = false;
  private hasContent: boolean = false;

  constructor(assistantId: string) {
    this.assistantId = assistantId;
  }

  bind(assistantId: string): void {
    this.assistantId = assistantId;
    this.finalized = false;
    this.hasContent = false;
  }

  appendChunk(assistantId: string, block: Block): void {
    if (this.assistantId !== assistantId) {
      logger.warn("response_assembler", "assistant_id_mismatch", { 
        expected: this.assistantId, 
        received: assistantId 
      });
      throw new Error(`Assistant ID mismatch: expected ${this.assistantId}, got ${assistantId}`);
    }

    if (this.finalized) {
      logger.warn("response_assembler", "append_after_finalize", { assistantId });
      throw new Error(`Cannot append to finalized message: ${assistantId}`);
    }

    this.hasContent = true;
    logger.debug("response_assembler", "chunk_appended", { assistantId, blockType: block.type });
  }

  finalize(assistantId: string): void {
    if (this.assistantId !== assistantId) {
      logger.warn("response_assembler", "finalize_id_mismatch", { 
        expected: this.assistantId, 
        received: assistantId 
      });
      throw new Error(`Assistant ID mismatch: expected ${this.assistantId}, got ${assistantId}`);
    }

    if (this.finalized) {
      logger.warn("response_assembler", "finalize_twice", { assistantId });
      throw new Error(`Cannot finalize message twice: ${assistantId}`);
    }

    if (!this.hasContent) {
      logger.warn("response_assembler", "finalize_no_content", { assistantId });
      // Allow finalization without content (fallback will be handled by caller)
    }

    this.finalized = true;
    logger.debug("response_assembler", "finalized", { assistantId, hasContent: this.hasContent });
  }

  fallback(assistantId: string): void {
    if (this.assistantId !== assistantId) {
      logger.warn("response_assembler", "fallback_id_mismatch", { 
        expected: this.assistantId, 
        received: assistantId 
      });
      throw new Error(`Assistant ID mismatch: expected ${this.assistantId}, got ${assistantId}`);
    }

    this.finalized = true;
    logger.debug("response_assembler", "fallback_triggered", { assistantId });
  }

  isFinalized(): boolean {
    return this.finalized;
  }

  hasReceivedContent(): boolean {
    return this.hasContent;
  }
}
