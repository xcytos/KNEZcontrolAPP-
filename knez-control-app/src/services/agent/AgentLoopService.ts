/**
 * AgentLoopService - Manages the agent execution loop
 * Handles tool execution, context management, and loop control
 * T12-Enhancement: Multi-step planning layer with goal decomposition
 */

import { agentContextManager } from "./AgentContext";

export interface ToolExecutionResult {
  ok: boolean;
  payload: any;
  errorMsg?: string;
  durationMs?: number;
}

// T12-Enhancement: Multi-step planning interfaces
export interface PlanningStep {
  id: string;
  description: string;
  toolName?: string;
  args?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'failed';
  dependencies: string[]; // IDs of steps this depends on
  estimatedDurationMs?: number;
  actualDurationMs?: number;
  result?: any;
  error?: string;
}

export interface ExecutionPlan {
  id: string;
  sessionId: string;
  goal: string;
  steps: PlanningStep[];
  createdAt: number;
  updatedAt: number;
  status: 'planning' | 'executing' | 'completed' | 'failed';
  currentStepIndex: number;
}

export interface AgentLoopConfig {
  maxSteps: number;
  maxRetries: number;
  timeoutMs: number;
}

export class AgentLoopService {
  private config: AgentLoopConfig = {
    maxSteps: 10,
    maxRetries: 2,
    timeoutMs: 30000
  };

  // T12-Enhancement: Multi-step planning storage
  private plans: Map<string, ExecutionPlan> = new Map(); // sessionId -> plan
  private planIdCounter = 0;

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

  // T12-Enhancement: Multi-step planning methods

  /**
   * Create an execution plan for a goal
   */
  createPlan(sessionId: string, goal: string, steps: PlanningStep[]): ExecutionPlan {
    const planId = `plan_${++this.planIdCounter}`;
    const plan: ExecutionPlan = {
      id: planId,
      sessionId,
      goal,
      steps: steps.map((step, index) => ({
        ...step,
        id: step.id || `step_${planId}_${index}`
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      status: 'planning',
      currentStepIndex: 0
    };

    this.plans.set(sessionId, plan);
    return plan;
  }

  /**
   * Get execution plan for a session
   */
  getPlan(sessionId: string): ExecutionPlan | null {
    return this.plans.get(sessionId) || null;
  }

  /**
   * Update plan with intermediate result
   */
  updatePlan(sessionId: string, stepId: string, result: any, success: boolean, error?: string): ExecutionPlan | null {
    const plan = this.plans.get(sessionId);
    if (!plan) return null;

    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return plan;

    step.status = success ? 'completed' : 'failed';
    step.result = result;
    step.error = error;
    plan.updatedAt = Date.now();

    // Update plan status based on step results
    const allCompleted = plan.steps.every(s => s.status === 'completed' || s.status === 'skipped');
    const anyFailed = plan.steps.some(s => s.status === 'failed');

    if (allCompleted) {
      plan.status = 'completed';
    } else if (anyFailed) {
      plan.status = 'failed';
    } else {
      plan.status = 'executing';
    }

    this.plans.set(sessionId, plan);
    return plan;
  }

  /**
   * Get plan progress
   */
  getPlanProgress(sessionId: string): {
    totalSteps: number;
    completedSteps: number;
    failedSteps: number;
    inProgressSteps: number;
    pendingSteps: number;
    progressPercentage: number;
  } | null {
    const plan = this.plans.get(sessionId);
    if (!plan) return null;

    const completedSteps = plan.steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
    const failedSteps = plan.steps.filter(s => s.status === 'failed').length;
    const inProgressSteps = plan.steps.filter(s => s.status === 'in_progress').length;
    const pendingSteps = plan.steps.filter(s => s.status === 'pending').length;

    return {
      totalSteps: plan.steps.length,
      completedSteps,
      failedSteps,
      inProgressSteps,
      pendingSteps,
      progressPercentage: plan.steps.length > 0 ? (completedSteps / plan.steps.length) * 100 : 0
    };
  }

  /**
   * Adapt plan based on intermediate result
   */
  adaptPlan(sessionId: string, _intermediateResult: any): ExecutionPlan | null {
    const plan = this.plans.get(sessionId);
    if (!plan) return null;

    // Simple adaptation: if a step fails, mark dependent steps as skipped
    const failedStep = plan.steps.find(s => s.status === 'failed');
    if (failedStep) {
      for (const step of plan.steps) {
        if (step.dependencies.includes(failedStep.id) && step.status === 'pending') {
          step.status = 'skipped';
          step.error = 'Skipped due to dependency failure';
        }
      }
      plan.updatedAt = Date.now();
    }

    // If intermediate result suggests different approach, could re-plan here
    this.plans.set(sessionId, plan);
    return plan;
  }

  /**
   * Get next executable step
   */
  getNextStep(sessionId: string): PlanningStep | null {
    const plan = this.plans.get(sessionId);
    if (!plan) return null;

    // Find first pending step with all dependencies completed
    for (const step of plan.steps) {
      if (step.status === 'pending') {
        const dependenciesMet = step.dependencies.every(depId => {
          const depStep = plan.steps.find(s => s.id === depId);
          return depStep && (depStep.status === 'completed' || depStep.status === 'skipped');
        });

        if (dependenciesMet) {
          step.status = 'in_progress';
          plan.currentStepIndex = plan.steps.indexOf(step);
          plan.updatedAt = Date.now();
          this.plans.set(sessionId, plan);
          return step;
        }
      }
    }

    return null;
  }

  /**
   * Clear plan for a session
   */
  clearPlan(sessionId: string): void {
    this.plans.delete(sessionId);
  }

  /**
   * Get all active plans
   */
  getActivePlans(): ExecutionPlan[] {
    return Array.from(this.plans.values()).filter(p => p.status === 'executing' || p.status === 'planning');
  }
}

// Singleton instance
export const agentLoopService = new AgentLoopService();
