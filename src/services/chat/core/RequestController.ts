// ─── RequestController.ts ────────────────────────────────────────────────
// Request lock + lifecycle management
// Responsibilities: startRequest, endRequest, reject if another request is active
// ─────────────────────────────────────────────────────────────────────────────

import { logger } from "../../utils/LogService";

export class RequestController {
  private activeRequest: string | null = null;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  startRequest(requestId: string): void {
    if (this.activeRequest) {
      logger.warn("request_controller", "request_rejected", { 
        sessionId: this.sessionId, 
        activeRequest: this.activeRequest, 
        attemptedRequest: requestId 
      });
      throw new Error(`Request already active: ${this.activeRequest}`);
    }
    this.activeRequest = requestId;
    logger.debug("request_controller", "request_started", { sessionId: this.sessionId, requestId });
  }

  endRequest(requestId: string): void {
    if (this.activeRequest !== requestId) {
      logger.warn("request_controller", "request_mismatch", { 
        sessionId: this.sessionId, 
        activeRequest: this.activeRequest, 
        attemptedEnd: requestId 
      });
      throw new Error(`Request ID mismatch: expected ${this.activeRequest}, got ${requestId}`);
    }
    this.activeRequest = null;
    logger.debug("request_controller", "request_ended", { sessionId: this.sessionId, requestId });
  }

  getActiveRequest(): string | null {
    return this.activeRequest;
  }

  isActive(): boolean {
    return this.activeRequest !== null;
  }
}
