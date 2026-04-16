/**
 * AgentTracer - Comprehensive trace system for debugging
 * Logs all agent actions, decisions, tool calls, failures, retries, and timings
 */

export interface ToolCallTrace {
  toolCallId: string;
  name: string;
  args: any;
  result: any;
  success: boolean;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
}

export interface FailureTrace {
  type: string;
  message: string;
  step: number;
  timestamp: number;
}

export interface RetryTrace {
  attempt: number;
  refinedArgs: any;
  originalError: string;
  timestamp: number;
}

export interface StepTrace {
  stepNumber: number;
  decision: string;
  toolCall?: ToolCallTrace;
  failure?: FailureTrace;
  retry?: RetryTrace;
  timing: {
    start: number;
    end: number;
    duration: number;
  };
}

export interface AgentTraceSummary {
  totalSteps: number;
  totalTools: number;
  totalFailures: number;
  totalRetries: number;
  totalTime: number;
  successRate: number;
}

export interface AgentTrace {
  sessionId: string;
  startTime: number;
  endTime?: number;
  steps: StepTrace[];
  summary: AgentTraceSummary;
}

export class AgentTracer {
  private activeTraces: Map<string, AgentTrace> = new Map();
  private completedTraces: Map<string, AgentTrace> = new Map();

  /**
   * Start a new trace for a session
   */
  startTrace(sessionId: string): void {
    const trace: AgentTrace = {
      sessionId,
      startTime: Date.now(),
      steps: [],
      summary: {
        totalSteps: 0,
        totalTools: 0,
        totalFailures: 0,
        totalRetries: 0,
        totalTime: 0,
        successRate: 0
      }
    };
    
    this.activeTraces.set(sessionId, trace);
  }

  /**
   * Log a step in the agent execution
   */
  logStep(sessionId: string, step: StepTrace): void {
    const trace = this.activeTraces.get(sessionId);
    if (!trace) return;

    trace.steps.push(step);
    this.updateSummary(trace);
  }

  /**
   * Log a tool call
   */
  logToolCall(
    sessionId: string,
    toolCallId: string,
    name: string,
    args: any,
    result: any,
    success: boolean,
    startTime: number,
    endTime: number
  ): void {
    const trace = this.activeTraces.get(sessionId);
    if (!trace) return;

    const toolCallTrace: ToolCallTrace = {
      toolCallId,
      name,
      args,
      result,
      success,
      timing: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime
      }
    };

    // Add to steps if it's a new tool call
    const stepTrace: StepTrace = {
      stepNumber: trace.steps.length,
      decision: `Execute tool: ${name}`,
      toolCall: toolCallTrace,
      timing: {
        start: startTime,
        end: endTime,
        duration: endTime - startTime
      }
    };
    
    trace.steps.push(stepTrace);
    trace.summary.totalTools++;
    this.updateSummary(trace);
  }

  /**
   * Log a failure
   */
  logFailure(sessionId: string, type: string, message: string, step: number): void {
    const trace = this.activeTraces.get(sessionId);
    if (!trace) return;

    const failureTrace: FailureTrace = {
      type,
      message,
      step,
      timestamp: Date.now()
    };

    // Add to steps
    const stepTrace: StepTrace = {
      stepNumber: trace.steps.length,
      decision: `Failure: ${type}`,
      failure: failureTrace,
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      }
    };
    
    trace.steps.push(stepTrace);
    trace.summary.totalFailures++;
    this.updateSummary(trace);
  }

  /**
   * Log a retry
   */
  logRetry(sessionId: string, attempt: number, refinedArgs: any, originalError: string): void {
    const trace = this.activeTraces.get(sessionId);
    if (!trace) return;

    const retryTrace: RetryTrace = {
      attempt,
      refinedArgs,
      originalError,
      timestamp: Date.now()
    };

    // Add to steps
    const stepTrace: StepTrace = {
      stepNumber: trace.steps.length,
      decision: `Retry attempt ${attempt}`,
      retry: retryTrace,
      timing: {
        start: Date.now(),
        end: Date.now(),
        duration: 0
      }
    };
    
    trace.steps.push(stepTrace);
    trace.summary.totalRetries++;
    this.updateSummary(trace);
  }

  /**
   * End a trace and move it to completed
   */
  endTrace(sessionId: string): AgentTrace | null {
    const trace = this.activeTraces.get(sessionId);
    if (!trace) return null;

    trace.endTime = Date.now();
    trace.summary.totalTime = trace.endTime - trace.startTime;
    
    // Calculate success rate
    if (trace.summary.totalTools > 0) {
      const successfulTools = trace.steps.filter(s => s.toolCall?.success).length;
      trace.summary.successRate = successfulTools / trace.summary.totalTools;
    }

    this.completedTraces.set(sessionId, trace);
    this.activeTraces.delete(sessionId);

    return trace;
  }

  /**
   * Get active trace for a session
   */
  getActiveTrace(sessionId: string): AgentTrace | undefined {
    return this.activeTraces.get(sessionId);
  }

  /**
   * Get completed trace for a session
   */
  getCompletedTrace(sessionId: string): AgentTrace | undefined {
    return this.completedTraces.get(sessionId);
  }

  /**
   * Export trace as JSON string
   */
  exportTrace(sessionId: string): string {
    const trace = this.completedTraces.get(sessionId) || this.activeTraces.get(sessionId);
    if (!trace) return "{}";

    return JSON.stringify(trace, null, 2);
  }

  /**
   * Get all completed traces
   */
  getAllCompletedTraces(): AgentTrace[] {
    return Array.from(this.completedTraces.values());
  }

  /**
   * Clear trace for a session
   */
  clearTrace(sessionId: string): void {
    this.activeTraces.delete(sessionId);
    this.completedTraces.delete(sessionId);
  }

  /**
   * Clear all traces
   */
  clearAllTraces(): void {
    this.activeTraces.clear();
    this.completedTraces.clear();
  }

  /**
   * Update summary based on current state
   */
  private updateSummary(trace: AgentTrace): void {
    trace.summary.totalSteps = trace.steps.length;
    
    // Count tools, failures, retries from steps
    trace.summary.totalTools = trace.steps.filter(s => s.toolCall).length;
    trace.summary.totalFailures = trace.steps.filter(s => s.failure).length;
    trace.summary.totalRetries = trace.steps.filter(s => s.retry).length;
  }

  /**
   * Get trace statistics for a session
   */
  getTraceStatistics(sessionId: string): AgentTraceSummary | null {
    const trace = this.completedTraces.get(sessionId) || this.activeTraces.get(sessionId);
    return trace?.summary || null;
  }

  /**
   * Get recent traces
   */
  getRecentTraces(limit: number = 10): AgentTrace[] {
    const allTraces = Array.from(this.completedTraces.values())
      .sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
    
    return allTraces.slice(0, limit);
  }
}

// Singleton instance
export const agentTracer = new AgentTracer();
