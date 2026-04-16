// ─── ToolDependencyGraph.ts ─────────────────────────────────────────────────
// T14: Tool Dependency Resolution — defines dependency graph, injection, validation
//     for tools that depend on previous tool results.
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolDependency {
  tool: string;
  dependsOn: string[];
  outputKey?: string; // Key to extract from result for dependent tools
  required: boolean; // Whether this dependency is required
}

export interface ToolExecutionPlan {
  tool: string;
  args: any;
  dependencies: string[];
  order: number;
}

/**
 * Predefined tool dependencies for common workflows.
 */
const TOOL_DEPENDENCIES: Record<string, ToolDependency> = {
  // Browser tools
  playwright__browser_click: {
    tool: "playwright__browser_click",
    dependsOn: ["playwright__browser_navigate", "playwright__browser_snapshot"],
    outputKey: "ref",
    required: true
  },
  playwright__browser_snapshot: {
    tool: "playwright__browser_snapshot",
    dependsOn: ["playwright__browser_navigate"],
    outputKey: "url",
    required: true
  },
  playwright__browser_type: {
    tool: "playwright__browser_type",
    dependsOn: ["playwright__browser_navigate"],
    outputKey: "ref",
    required: true
  },

  // Fetch tools
  fetch__fetch: {
    tool: "fetch__fetch",
    dependsOn: [],
    required: false
  },

  // File system tools (no dependencies)
  filesystem__read_file: {
    tool: "filesystem__read_file",
    dependsOn: [],
    required: false
  },
  filesystem__write_file: {
    tool: "filesystem__write_file",
    dependsOn: [],
    required: false
  }
};

/**
 * Tool dependency graph manager.
 */
export class ToolDependencyGraph {
  private dependencies: Map<string, ToolDependency> = new Map();
  private executionHistory: Array<{ tool: string; result: any; timestamp: Date }> = [];

  constructor() {
    // Initialize with predefined dependencies
    for (const [key, dep] of Object.entries(TOOL_DEPENDENCIES)) {
      this.dependencies.set(key, dep);
    }
  }

  /**
   * Add a custom dependency rule.
   */
  addDependency(dependency: ToolDependency): void {
    this.dependencies.set(dependency.tool, dependency);
  }

  /**
   * Get dependencies for a tool.
   */
  getDependencies(toolName: string): ToolDependency | null {
    return this.dependencies.get(toolName) ?? null;
  }

  /**
   * Check if a tool's dependencies are satisfied.
   */
  areDependenciesSatisfied(toolName: string, executedTools: Set<string>): { satisfied: boolean; missing: string[] } {
    const dep = this.getDependencies(toolName);
    if (!dep || dep.dependsOn.length === 0) {
      return { satisfied: true, missing: [] };
    }

    const missing = dep.dependsOn.filter(depTool => !executedTools.has(depTool));

    if (missing.length === 0) {
      return { satisfied: true, missing: [] };
    }

    if (dep.required) {
      return { satisfied: false, missing };
    }

    // Optional dependencies - satisfied if at least one is present
    const hasAny = dep.dependsOn.some(depTool => executedTools.has(depTool));
    return { satisfied: hasAny, missing: hasAny ? [] : missing };
  }

  /**
   * Resolve dependencies and inject results into tool arguments.
   */
  injectDependencies(
    toolName: string,
    args: any,
    executionHistory: Array<{ tool: string; result: any }>
  ): any {
    const dep = this.getDependencies(toolName);
    if (!dep || dep.dependsOn.length === 0) {
      return args;
    }

    const injectedArgs = { ...args };

    for (const depTool of dep.dependsOn) {
      const historyItem = executionHistory.find(h => h.tool === depTool);
      if (historyItem && dep.outputKey) {
        // Extract the specified key from the result
        const value = this.extractValue(historyItem.result, dep.outputKey);
        if (value !== undefined) {
          injectedArgs[dep.outputKey] = value;
        }
      }
    }

    return injectedArgs;
  }

  /**
   * Extract a value from a result object using a key path.
   */
  private extractValue(result: any, keyPath: string): any {
    if (!result) return undefined;

    const keys = keyPath.split(".");
    let current = result;

    for (const key of keys) {
      if (current && typeof current === "object" && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Build an execution plan respecting dependencies.
   */
  buildExecutionPlan(tools: Array<{ name: string; args: any }>): ToolExecutionPlan[] {
    const plan: ToolExecutionPlan[] = [];
    const executed = new Set<string>();
    const remaining = [...tools];

    let iterations = 0;
    const maxIterations = tools.length * 2; // Prevent infinite loops

    while (remaining.length > 0 && iterations < maxIterations) {
      iterations++;

      for (let i = remaining.length - 1; i >= 0; i--) {
        const tool = remaining[i];
        const check = this.areDependenciesSatisfied(tool.name, executed);

        if (check.satisfied) {
          const dep = this.getDependencies(tool.name);
          plan.push({
            tool: tool.name,
            args: this.injectDependencies(tool.name, tool.args, this.executionHistory),
            dependencies: dep?.dependsOn ?? [],
            order: plan.length
          });
          executed.add(tool.name);
          remaining.splice(i, 1);
        }
      }

      // If no progress was made, break to prevent infinite loop
      if (remaining.length === tools.length - executed.size) {
        // Force execute remaining tools without dependencies
        for (const tool of remaining) {
          plan.push({
            tool: tool.name,
            args: tool.args,
            dependencies: [],
            order: plan.length
          });
        }
        break;
      }
    }

    return plan;
  }

  /**
   * Record tool execution result.
   */
  recordExecution(toolName: string, result: any): void {
    this.executionHistory.push({
      tool: toolName,
      result,
      timestamp: new Date()
    });

    // Keep only recent history (last 50 executions)
    if (this.executionHistory.length > 50) {
      this.executionHistory.shift();
    }
  }

  /**
   * Validate that a tool call has all required dependencies.
   */
  validateToolCall(toolName: string, executedTools: Set<string>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const dep = this.getDependencies(toolName);

    if (!dep) {
      return { valid: true, errors: [] };
    }

    for (const depTool of dep.dependsOn) {
      if (!executedTools.has(depTool)) {
        errors.push(`Missing required dependency: ${depTool}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get dependency graph as a visual representation.
   */
  getDependencyGraph(): Array<{ tool: string; dependsOn: string[]; required: boolean }> {
    return Array.from(this.dependencies.entries()).map(([tool, dep]) => ({
      tool,
      dependsOn: dep.dependsOn,
      required: dep.required
    }));
  }

  /**
   * Clear execution history.
   */
  clearHistory(): void {
    this.executionHistory = [];
  }

  /**
   * Reset to default dependencies.
   */
  reset(): void {
    this.dependencies.clear();
    for (const [key, dep] of Object.entries(TOOL_DEPENDENCIES)) {
      this.dependencies.set(key, dep);
    }
    this.clearHistory();
  }
}

// Global instance
export const toolDependencyGraph = new ToolDependencyGraph();
