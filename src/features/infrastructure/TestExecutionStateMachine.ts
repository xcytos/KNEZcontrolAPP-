/**
 * Test Execution State Machine
 * Tracks the lifecycle of diagnostic test execution with state transitions
 */

export type TestState = 
  | 'idle'
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TestEvent =
  | { type: 'START'; testId: string }
  | { type: 'PAUSE'; testId: string }
  | { type: 'RESUME'; testId: string }
  | { type: 'COMPLETE'; testId: string; success: boolean }
  | { type: 'CANCEL'; testId: string }
  | { type: 'FAIL'; testId: string; error: string };

export interface TestExecutionState {
  testId: string;
  state: TestState;
  currentNodeIndex: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface TestExecutionContext {
  tests: Map<string, TestExecutionState>;
  activeTest: string | null;
}

class TestExecutionStateMachine {
  private context: TestExecutionContext;
  private listeners: Set<(context: TestExecutionContext) => void>;

  constructor() {
    this.context = {
      tests: new Map(),
      activeTest: null
    };
    this.listeners = new Set();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (context: TestExecutionContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notify() {
    this.listeners.forEach(listener => listener(this.context));
  }

  /**
   * Get current context
   */
  getContext(): TestExecutionContext {
    return this.context;
  }

  /**
   * Get state for a specific test
   */
  getTestState(testId: string): TestExecutionState | undefined {
    return this.context.tests.get(testId);
  }

  /**
   * Initialize a test with idle state
   */
  initializeTest(testId: string): void {
    this.context.tests.set(testId, {
      testId,
      state: 'idle',
      currentNodeIndex: 0,
      startTime: 0
    });
    this.notify();
  }

  /**
   * Transition test state based on event
   */
  transition(event: TestEvent): void {
    const currentState = this.context.tests.get(event.testId);
    if (!currentState) {
      this.initializeTest(event.testId);
    }

    const state = this.context.tests.get(event.testId)!;

    switch (event.type) {
      case 'START':
        if (state.state === 'idle' || state.state === 'pending') {
          state.state = 'running';
          state.startTime = Date.now();
          state.currentNodeIndex = 0;
          this.context.activeTest = event.testId;
        }
        break;

      case 'PAUSE':
        if (state.state === 'running') {
          state.state = 'paused';
        }
        break;

      case 'RESUME':
        if (state.state === 'paused') {
          state.state = 'running';
        }
        break;

      case 'COMPLETE':
        if (state.state === 'running' || state.state === 'paused') {
          state.state = event.success ? 'completed' : 'failed';
          state.endTime = Date.now();
          if (this.context.activeTest === event.testId) {
            this.context.activeTest = null;
          }
        }
        break;

      case 'CANCEL':
        state.state = 'cancelled';
        state.endTime = Date.now();
        if (this.context.activeTest === event.testId) {
          this.context.activeTest = null;
        }
        break;

      case 'FAIL':
        state.state = 'failed';
        state.error = event.error;
        state.endTime = Date.now();
        if (this.context.activeTest === event.testId) {
          this.context.activeTest = null;
        }
        break;
    }

    this.notify();
  }

  /**
   * Advance to next node in test path
   */
  advanceNode(testId: string, totalNodes: number): boolean {
    const state = this.context.tests.get(testId);
    if (!state || state.state !== 'running') return false;

    state.currentNodeIndex++;
    this.notify();

    return state.currentNodeIndex >= totalNodes;
  }

  /**
   * Get execution duration for a test
   */
  getDuration(testId: string): number {
    const state = this.context.tests.get(testId);
    if (!state) return 0;

    const endTime = state.endTime || Date.now();
    return endTime - state.startTime;
  }

  /**
   * Reset all test states
   */
  reset(): void {
    this.context = {
      tests: new Map(),
      activeTest: null
    };
    this.notify();
  }

  /**
   * Get all tests in a specific state
   */
  getTestsByState(state: TestState): TestExecutionState[] {
    return Array.from(this.context.tests.values()).filter(t => t.state === state);
  }

  /**
   * Get test statistics
   */
  getStatistics() {
    const tests = Array.from(this.context.tests.values());
    return {
      total: tests.length,
      completed: tests.filter(t => t.state === 'completed').length,
      failed: tests.filter(t => t.state === 'failed').length,
      running: tests.filter(t => t.state === 'running').length,
      pending: tests.filter(t => t.state === 'pending').length,
      cancelled: tests.filter(t => t.state === 'cancelled').length
    };
  }
}

// Singleton instance
export const testExecutionStateMachine = new TestExecutionStateMachine();
