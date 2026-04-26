// ─── StreamController.ts ─────────────────────────────────────────────────
// Stream ownership + validation (AUTHORITATIVE)
// Responsibilities: startStream, appendChunk, endStream, cancelStream
// Rules: Only ONE stream per request, any second stream → reject
// CONTRACT: Only this component controls stream lifecycle (start → append → end)
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export class StreamController {
  private activeStreamId: string | null = null;
  private activeAssistantId: string | null = null;
  private sessionId: string;
  private onChunk?: (assistantId: string, chunk: string) => void;

  constructor(sessionId: string = "") {
    this.sessionId = sessionId;
  }

  // Set callback for chunk notifications to ChatService
  setChunkCallback(callback: (assistantId: string, chunk: string) => void): void {
    this.onChunk = callback;
  }

  startStream(streamId: string, assistantId: string): void {
    if (this.activeStreamId) {
      logger.warn("stream_controller", "stream_rejected", { 
        sessionId: this.sessionId, 
        activeStream: this.activeStreamId, 
        attemptedStream: streamId 
      });
      throw new Error(`Stream already active: ${this.activeStreamId}`);
    }
    this.activeStreamId = streamId;
    this.activeAssistantId = assistantId;
    logger.debug("stream_controller", "stream_started", { sessionId: this.sessionId, streamId, assistantId });
  }

  // AUTHORITATIVE: Only StreamController can append chunks
  appendChunk(streamId: string, chunk: string): boolean {
    if (this.activeStreamId !== streamId) {
      logger.warn("stream_controller", "append_chunk_ownership_failed", { 
        sessionId: this.sessionId, 
        activeStream: this.activeStreamId, 
        attemptedStream: streamId 
      });
      return false;
    }

    if (this.onChunk && this.activeAssistantId) {
      this.onChunk(this.activeAssistantId, chunk);
    }

    logger.debug("stream_controller", "chunk_appended", { 
      sessionId: this.sessionId, 
      streamId, 
      chunkLength: chunk.length 
    });
    return true;
  }

  validateOwnership(streamId: string, assistantId: string): boolean {
    const isValid = this.activeStreamId === streamId && this.activeAssistantId === assistantId;
    if (!isValid) {
      logger.warn("stream_controller", "stream_ownership_failed", { 
        sessionId: this.sessionId, 
        activeStream: this.activeStreamId, 
        attemptedStream: streamId 
      });
    }
    return isValid;
  }

  endStream(streamId: string): void {
    if (this.activeStreamId !== streamId) {
      logger.warn("stream_controller", "stream_mismatch", { 
        sessionId: this.sessionId, 
        activeStream: this.activeStreamId, 
        attemptedEnd: streamId 
      });
      // Don't throw - just log and clear to prevent stuck state
      logger.warn("stream_controller", "clearing_stale_stream", { streamId });
    }
    this.activeStreamId = null;
    this.activeAssistantId = null;
    logger.debug("stream_controller", "stream_ended", { sessionId: this.sessionId, streamId });
  }

  cancelStream(streamId: string): void {
    if (this.activeStreamId !== streamId) {
      logger.warn("stream_controller", "cancel_stream_mismatch", { 
        sessionId: this.sessionId, 
        activeStream: this.activeStreamId, 
        attemptedCancel: streamId 
      });
      return;
    }
    this.activeStreamId = null;
    this.activeAssistantId = null;
    logger.debug("stream_controller", "stream_cancelled", { sessionId: this.sessionId, streamId });
  }

  isActive(streamId: string): boolean {
    return this.activeStreamId === streamId;
  }

  getActiveStream(): string | null {
    return this.activeStreamId;
  }

  // DEPRECATED: Use appendChunk instead
  append(_messageId: string, activeStreamId: string | null): boolean {
    if (!activeStreamId) return true;
    return this.activeStreamId === activeStreamId;
  }

  start(assistantId: string, streamId: string): boolean {
    try {
      this.startStream(streamId, assistantId);
      return true;
    } catch {
      return false;
    }
  }

  end(_assistantId: string, streamId: string): void {
    this.endStream(streamId);
  }

  cancelActiveStream(): string | null {
    const cancelled = this.activeStreamId;
    if (cancelled) {
      this.activeStreamId = null;
      this.activeAssistantId = null;
      logger.info("stream_controller", "active_stream_cancelled", { 
        sessionId: this.sessionId, 
        cancelledStream: cancelled 
      });
    }
    return cancelled;
  }

  reset(): void {
    const cancelled = this.cancelActiveStream();
    logger.info("stream_controller", "controller_reset", { 
      sessionId: this.sessionId, 
      cancelledStream: cancelled 
    });
  }
}
