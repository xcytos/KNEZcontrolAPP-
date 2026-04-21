// ─── StreamController.ts ─────────────────────────────────────────────────
// Stream ownership + validation
// Responsibilities: startStream, validateOwnership, endStream, cancelStream
// Rules: Only ONE stream per request, any second stream → reject
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export class StreamController {
  private activeStreamId: string | null = null;
  private activeAssistantId: string | null = null;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
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
      throw new Error(`Stream ID mismatch: expected ${this.activeStreamId}, got ${streamId}`);
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

  getActiveStream(): { streamId: string; assistantId: string } | null {
    if (!this.activeStreamId || !this.activeAssistantId) {
      return null;
    }
    return { streamId: this.activeStreamId, assistantId: this.activeAssistantId };
  }
}
