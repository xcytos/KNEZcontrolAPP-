/**
 * AgentContext - Execution context layer for agent loop
 * Provides state tracking across agent loop iterations
 */

export interface ToolHistoryEntry {
  name: string;
  args: any;
  result: any;
  timestamp: number;
  success: boolean;
}

export interface ErrorEntry {
  type: string;
  message: string;
  step: number;
  timestamp: number;
}

export type AgentPhase = "planning" | "executing" | "finalizing";

export interface AgentContext {
  sessionId: string;
  steps: number;
  toolHistory: ToolHistoryEntry[];
  currentGoal: string;
  intermediateState: Map<string, any>;
  errorsSeen: ErrorEntry[];
  retryHistory: Map<string, number>;
  startTime: number;
  currentPhase: AgentPhase;
}

export class AgentContextManager {
  private contexts: Map<string, AgentContext> = new Map();

  createContext(sessionId: string, initialGoal: string): AgentContext {
    const context: AgentContext = {
      sessionId,
      steps: 0,
      toolHistory: [],
      currentGoal: initialGoal,
      intermediateState: new Map(),
      errorsSeen: [],
      retryHistory: new Map(),
      startTime: Date.now(),
      currentPhase: "planning"
    };
    
    this.contexts.set(sessionId, context);
    return context;
  }

  getContext(sessionId: string): AgentContext | undefined {
    return this.contexts.get(sessionId);
  }

  updateContext(sessionId: string, updates: Partial<AgentContext>): void {
    const context = this.contexts.get(sessionId);
    if (!context) return;

    Object.assign(context, updates);
  }

  incrementStep(sessionId: string): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.steps += 1;
    }
  }

  addToolToHistory(sessionId: string, entry: ToolHistoryEntry): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.toolHistory.push(entry);
    }
  }

  addError(sessionId: string, error: ErrorEntry): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.errorsSeen.push(error);
    }
  }

  incrementRetry(sessionId: string, toolKey: string): number {
    const context = this.contexts.get(sessionId);
    if (!context) return 0;

    const currentCount = context.retryHistory.get(toolKey) || 0;
    const newCount = currentCount + 1;
    context.retryHistory.set(toolKey, newCount);
    return newCount;
  }

  setIntermediateState(sessionId: string, key: string, value: any): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.intermediateState.set(key, value);
    }
  }

  getIntermediateState(sessionId: string, key: string): any {
    const context = this.contexts.get(sessionId);
    return context?.intermediateState.get(key);
  }

  setPhase(sessionId: string, phase: AgentPhase): void {
    const context = this.contexts.get(sessionId);
    if (context) {
      context.currentPhase = phase;
    }
  }

  getRecentErrors(sessionId: string, limit: number = 5): ErrorEntry[] {
    const context = this.contexts.get(sessionId);
    if (!context) return [];

    return context.errorsSeen.slice(-limit);
  }

  hasRecentFailure(sessionId: string, failureType: string, withinSteps: number = 2): boolean {
    const context = this.contexts.get(sessionId);
    if (!context) return false;

    const recentErrors = context.errorsSeen
      .filter(e => e.type === failureType)
      .filter(e => context.steps - e.step <= withinSteps);

    return recentErrors.length > 0;
  }

  getRetryCount(sessionId: string, toolKey: string): number {
    const context = this.contexts.get(sessionId);
    return context?.retryHistory.get(toolKey) || 0;
  }

  getContextForPrompt(sessionId: string): string {
    const context = this.contexts.get(sessionId);
    if (!context) return "";

    const recentErrors = this.getRecentErrors(sessionId, 3);
    const errorSummary = recentErrors.length > 0
      ? recentErrors.map(e => `- ${e.type}: ${e.message}`).join("\n")
      : "None";

    const toolSummary = context.toolHistory.slice(-3).map(t => 
      `- ${t.name} (success: ${t.success})`
    ).join("\n") || "None";

    return `
[AGENT CONTEXT]
Current Step: ${context.steps}
Phase: ${context.currentPhase}
Goal: ${context.currentGoal}

Recent Tool Calls:
${toolSummary}

Recent Errors:
${errorSummary}

Retry History:
${Array.from(context.retryHistory.entries()).map(([k, v]) => `- ${k}: ${v} retries`).join("\n") || "None"}
`;
  }

  exportContext(sessionId: string): any {
    const context = this.contexts.get(sessionId);
    if (!context) return null;

    return {
      ...context,
      intermediateState: Object.fromEntries(context.intermediateState),
      retryHistory: Object.fromEntries(context.retryHistory)
    };
  }

  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId);
  }

  clearAllContexts(): void {
    this.contexts.clear();
  }
}

// Singleton instance
export const agentContextManager = new AgentContextManager();
