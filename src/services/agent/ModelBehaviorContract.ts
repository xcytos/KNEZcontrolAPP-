/**
 * ModelBehaviorContract - Defines soft constraints for model behavior
 * Provides guidelines for tool usage, output format, and interaction patterns
 */

export interface BehaviorContract {
  toolUsage: {
    useOnlyWhenRequired: boolean;
    noHallucination: boolean;
    waitForResults: boolean;
    neverGuessDOM: boolean;
    snapshotFirst: boolean;
  };
  outputFormat: {
    plainTextForConversation: boolean;
    jsonOnlyForTools: boolean;
    noSimulation: boolean;
    noPermissionSeeking: boolean;
  };
  execution: {
    maxSteps: number;
    maxRetries: number;
    timeoutMs: number;
  };
}

export class ModelBehaviorContract {
  private contract: BehaviorContract = {
    toolUsage: {
      useOnlyWhenRequired: true,
      noHallucination: true,
      waitForResults: true,
      neverGuessDOM: true,
      snapshotFirst: true
    },
    outputFormat: {
      plainTextForConversation: true,
      jsonOnlyForTools: true,
      noSimulation: true,
      noPermissionSeeking: true
    },
    execution: {
      maxSteps: 5,
      maxRetries: 2,
      timeoutMs: 30000
    }
  };

  /**
   * Generate system prompt with behavior contract
   */
  generateSystemPrompt(): string {
    return `
[AGENT BEHAVIOR CONTRACT]

TOOL USAGE RULES:
1. Use tools ONLY when explicitly required by the user's request
2. Simple messages (greetings, questions, conversation) MUST receive direct plain-text replies
3. Do NOT call tools on messages like "hi", "hello", "how are you", "what can you do" etc.
4. NEVER hallucinate or invent tool results
5. ALWAYS wait for tool results before making decisions
6. NEVER guess DOM elements - use snapshot to get actual refs
7. ALWAYS take a snapshot before clicking or interacting with elements

OUTPUT FORMAT RULES:
1. For normal conversation: Reply directly with natural language text. No JSON.
2. For tool actions: Reply with JSON ONLY and NOTHING ELSE: {"tool_call":{"name":"...","arguments":{...}}}
3. DO NOT simulate tool execution
4. DO NOT ask for permission to use tools
5. DO NOT include explanations with tool calls
6. DO NOT wrap tool calls in markdown or backticks

EXECUTION RULES:
- Maximum steps: ${this.contract.execution.maxSteps}
- Maximum retries per tool: ${this.contract.execution.maxRetries}
- Timeout per tool: ${this.contract.execution.timeoutMs}ms

WORKFLOW PATTERN:
1. Navigate to target URL (if needed)
2. Take snapshot to see page structure
3. Extract refs from snapshot
4. Use refs to click or interact
5. Take another snapshot to verify changes
6. Extract and analyze results

FAILURE HANDLING:
- If a tool fails, analyze the error message
- Retry with refined arguments if appropriate
- If retry limit exceeded, explain the failure to the user
- Never attempt the same failed action more than ${this.contract.execution.maxRetries} times

Remember: Your primary goal is to be helpful and accurate. Use tools when necessary, but don't overuse them.
`;
  }

  /**
   * Get current contract
   */
  getContract(): BehaviorContract {
    return { ...this.contract };
  }

  /**
   * Update contract
   */
  updateContract(updates: Partial<BehaviorContract>): void {
    this.contract = {
      toolUsage: { ...this.contract.toolUsage, ...(updates.toolUsage || {}) },
      outputFormat: { ...this.contract.outputFormat, ...(updates.outputFormat || {}) },
      execution: { ...this.contract.execution, ...(updates.execution || {}) }
    };
  }

  /**
   * Validate model output against contract
   */
  validateOutput(output: string, _toolCalled: boolean): { valid: boolean; violations: string[] } {
    const violations: string[] = [];

    // Check for simulation
    if (output.toLowerCase().includes("i will") && output.toLowerCase().includes("tool")) {
      violations.push("Simulation detected - do not describe tool execution, actually execute it");
    }

    // Check for permission seeking
    if (output.toLowerCase().includes("can i") || output.toLowerCase().includes("may i")) {
      violations.push("Permission seeking detected - do not ask for permission");
    }

    // Check for hallucination indicators
    if (output.toLowerCase().includes("i assume") || output.toLowerCase().includes("i guess")) {
      violations.push("Hallucination indicator detected - do not assume or guess");
    }

    // Check for DOM guessing
    if (output.toLowerCase().includes("the element should be") || output.toLowerCase().includes("i think it's")) {
      violations.push("DOM guessing detected - use snapshot to get actual refs");
    }

    return {
      valid: violations.length === 0,
      violations
    };
  }

  /**
   * Check if tool usage is required for a message
   */
  isToolRequired(message: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Tool-required keywords
    const toolKeywords = [
      "navigate", "browse", "visit", "open",
      "click", "select", "press",
      "type", "input", "enter",
      "extract", "scrape", "get",
      "search", "find", "lookup"
    ];

    // Conversation keywords
    const conversationKeywords = [
      "hi", "hello", "hey",
      "how are you", "what's up",
      "what can you do",
      "help me", "assist me"
    ];

    const hasToolKeyword = toolKeywords.some(kw => lowerMessage.includes(kw));
    const hasConversationKeyword = conversationKeywords.some(kw => lowerMessage.includes(kw));

    // If it's a conversation keyword, tools are not required
    if (hasConversationKeyword) {
      return false;
    }

    // If it has a tool keyword, tools are likely required
    return hasToolKeyword;
  }

  /**
   * Get max steps for execution
   */
  getMaxSteps(): number {
    return this.contract.execution.maxSteps;
  }

  /**
   * Get max retries for tools
   */
  getMaxRetries(): number {
    return this.contract.execution.maxRetries;
  }

  /**
   * Get timeout for tools
   */
  getTimeoutMs(): number {
    return this.contract.execution.timeoutMs;
  }
}

// Singleton instance
export const modelBehaviorContract = new ModelBehaviorContract();
