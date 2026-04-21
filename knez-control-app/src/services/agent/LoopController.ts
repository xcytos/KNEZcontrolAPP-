/**
 * LoopController - Governor for agent loop execution
 * Enforces deterministic control rules and prevents infinite loops
 */

import { AgentContext } from "./AgentContext";

export interface LoopDecision {
  shouldContinue: boolean;
  shouldStop: boolean;
  shouldForceAnswer: boolean;
  reason?: string;
}

export interface LoopConfig {
  maxSteps: number;
  maxConsecutiveFailures: number;
  maxSameToolRepeats: number;
  forceAnswerTimeoutMs: number;
}

export class LoopController {
  private config: LoopConfig = {
    maxSteps: 10,
    maxConsecutiveFailures: 3,
    maxSameToolRepeats: 2,
    forceAnswerTimeoutMs: 5000
  };

  constructor(config?: Partial<LoopConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Determine if the loop should continue to the next iteration
   */
  shouldContinue(context: AgentContext): boolean {
    const { steps, errorsSeen } = context;

    // STOP IF: maxSteps reached
    if (steps >= this.config.maxSteps) {
      return false;
    }

    // STOP IF: no progress detected (3 consecutive failures)
    const recentFailures = errorsSeen.slice(-this.config.maxConsecutiveFailures);
    if (recentFailures.length >= this.config.maxConsecutiveFailures) {
      return false;
    }

    return true;
  }

  /**
   * Determine if the loop should stop immediately
   */
  shouldStop(context: AgentContext): boolean {
    const { toolHistory } = context;

    // STOP IF: same tool repeated 2x with identical args
    if (this.hasRepeatedTool(toolHistory, this.config.maxSameToolRepeats)) {
      return true;
    }

    // STOP IF: tool returned empty twice
    const emptyResults = toolHistory.filter(h => h.result === null || h.result === "");
    if (emptyResults.length >= 2) {
      return true;
    }

    return false;
  }

  /**
   * Determine if we should force a final answer even if not complete
   */
  shouldForceAnswer(context: AgentContext, elapsedTimeMs: number): boolean {
    const { intermediateState } = context;

    // FORCE IF: partial data available
    const hasPartialData = Object.keys(intermediateState).length > 0;
    if (hasPartialData && elapsedTimeMs > (this.config.forceAnswerTimeoutMs * 2)) {
      return true;
    }

    // FORCE IF: timeout nearing (< 5s remaining from 20s total)
    if (elapsedTimeMs > 15000) {
      return true;
    }

    // FORCE IF: max retries exhausted
    const totalRetries = context.retryHistory.size;
    if (totalRetries >= 5) {
      return true;
    }

    return false;
  }

  /**
   * Get comprehensive loop decision
   */
  getDecision(context: AgentContext, elapsedTimeMs: number): LoopDecision {
    if (this.shouldStop(context)) {
      return {
        shouldContinue: false,
        shouldStop: true,
        shouldForceAnswer: false,
        reason: "Loop stop condition met"
      };
    }

    if (!this.shouldContinue(context)) {
      return {
        shouldContinue: false,
        shouldStop: false,
        shouldForceAnswer: this.shouldForceAnswer(context, elapsedTimeMs),
        reason: "Max steps or consecutive failures reached"
      };
    }

    if (this.shouldForceAnswer(context, elapsedTimeMs)) {
      return {
        shouldContinue: false,
        shouldStop: false,
        shouldForceAnswer: true,
        reason: "Forcing final answer due to timeout or partial data"
      };
    }

    return {
      shouldContinue: true,
      shouldStop: false,
      shouldForceAnswer: false,
      reason: "Continue execution"
    };
  }

  /**
   * Check if same tool has been repeated with identical arguments
   */
  private hasRepeatedTool(toolHistory: Array<{ name: string; args: any; result: any }>, maxRepeats: number): boolean {
    if (toolHistory.length < 2) return false;

    const lastTool = toolHistory[toolHistory.length - 1];
    let repeatCount = 0;

    for (let i = toolHistory.length - 2; i >= 0; i--) {
      const tool = toolHistory[i];
      if (tool.name === lastTool.name && JSON.stringify(tool.args) === JSON.stringify(lastTool.args)) {
        repeatCount++;
      } else {
        break;
      }
    }

    return repeatCount >= maxRepeats;
  }

  /**
   * Update controller configuration
   */
  updateConfig(updates: Partial<LoopConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoopConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const loopController = new LoopController();
