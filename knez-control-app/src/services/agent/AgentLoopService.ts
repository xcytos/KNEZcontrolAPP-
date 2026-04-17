/**
 * AgentLoopService - Manages the agent execution loop
 * Handles tool execution, context management, and loop control
 */

import { agentContextManager } from "./AgentContext";

export interface ToolExecutionResult {
  ok: boolean;
  payload: any;
  errorMsg?: string;
  durationMs?: number;
}

export interface AgentLoopConfig {
  maxSteps: number;
  maxRetries: number;
  timeoutMs: number;
}

export class AgentLoopService {
  private config: AgentLoopConfig = {
    maxSteps: 5,
    maxRetries: 2,
    timeoutMs: 30000
  };

  constructor(config?: Partial<AgentLoopConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Initialize agent context for a session
   */
  initializeContext(sessionId: string, userGoal: string): void {
    let context = agentContextManager.getContext(sessionId);
    if (!context) {
      context = agentContextManager.createContext(sessionId, userGoal);
    }
    agentContextManager.setPhase(sessionId, "executing");
  }

  /**
   * Get context summary for model prompt
   */
  getContextSummary(sessionId: string): string {
    return agentContextManager.getContextForPrompt(sessionId);
  }

  /**
   * Increment step counter
   */
  incrementStep(sessionId: string): void {
    agentContextManager.incrementStep(sessionId);
  }

  /**
   * Record tool execution in context
   */
  recordToolExecution(
    sessionId: string,
    toolName: string,
    args: any,
    result: any,
    success: boolean
  ): void {
    agentContextManager.addToolToHistory(sessionId, {
      name: toolName,
      args,
      result,
      timestamp: Date.now(),
      success
    });
  }

  /**
   * Record error in context
   */
  recordError(sessionId: string, errorType: string, message: string, step: number): void {
    agentContextManager.addError(sessionId, {
      type: errorType,
      message,
      step,
      timestamp: Date.now()
    });
  }

  /**
   * Check if should retry based on context
   */
  shouldRetry(sessionId: string, toolName: string): boolean {
    const retryCount = agentContextManager.getRetryCount(sessionId, toolName);
    return retryCount < this.config.maxRetries;
  }

  /**
   * Increment retry count
   */
  incrementRetry(sessionId: string, toolName: string): number {
    return agentContextManager.incrementRetry(sessionId, toolName);
  }

  /**
   * Check for recent failures of specific type
   */
  hasRecentFailure(sessionId: string, failureType: string, withinSteps: number = 2): boolean {
    return agentContextManager.hasRecentFailure(sessionId, failureType, withinSteps);
  }

  /**
   * Set intermediate state
   */
  setIntermediateState(sessionId: string, key: string, value: any): void {
    agentContextManager.setIntermediateState(sessionId, key, value);
  }

  /**
   * Get intermediate state
   */
  getIntermediateState(sessionId: string, key: string): any {
    return agentContextManager.getIntermediateState(sessionId, key);
  }

  /**
   * Finalize context when loop completes
   */
  finalizeContext(sessionId: string): void {
    agentContextManager.setPhase(sessionId, "finalizing");
  }

  /**
   * Export context for debugging
   */
  exportContext(sessionId: string): any {
    return agentContextManager.exportContext(sessionId);
  }

  /**
   * Clear context for session
   */
  clearContext(sessionId: string): void {
    agentContextManager.clearContext(sessionId);
  }
}

// Singleton instance
export const agentLoopService = new AgentLoopService();
