// ─── ToolExecutionVisualizer.ts ─────────────────────────────────────────────────
// T9: Tool Execution Visualization — enhances AgentProgressBar, adds timeline, result preview
//     for better visibility into tool execution progress.
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolExecutionEvent {
  tool: string;
  status: "pending" | "running" | "completed" | "failed";
  timestamp: Date;
  duration?: number;
  result?: any;
  error?: string;
}

export interface TimelineEvent {
  timestamp: Date;
  type: "tool_start" | "tool_end" | "error" | "warning";
  tool: string;
  message: string;
}

export interface VisualizationState {
  currentTool: string | null;
  toolCount: number;
  completedCount: number;
  failedCount: number;
  progress: number;
  timeline: TimelineEvent[];
  preview: any;
}

/**
 * Tool execution visualizer for tracking and displaying tool execution progress.
 */
export class ToolExecutionVisualizer {
  private events: ToolExecutionEvent[] = [];
  private timeline: TimelineEvent[] = [];
  private currentTool: string | null = null;
  private toolCount = 0;
  private completedCount = 0;
  private failedCount = 0;

  /**
   * Start tracking a tool execution.
   */
  startTool(tool: string): void {
    this.currentTool = tool;
    this.toolCount++;

    this.events.push({
      tool,
      status: "pending",
      timestamp: new Date()
    });

    this.timeline.push({
      timestamp: new Date(),
      type: "tool_start",
      tool,
      message: `Started executing ${tool}`
    });

    this.events[this.events.length - 1].status = "running";
  }

  /**
   * Complete a tool execution.
   */
  completeTool(tool: string, result: any, duration?: number): void {
    const eventIndex = this.events.findIndex(e => e.tool === tool && e.status === "running");
    if (eventIndex >= 0) {
      this.events[eventIndex].status = "completed";
      this.events[eventIndex].result = result;
      this.events[eventIndex].duration = duration;
    }

    this.completedCount++;

    this.timeline.push({
      timestamp: new Date(),
      type: "tool_end",
      tool,
      message: `Completed ${tool}`
    });

    if (this.currentTool === tool) {
      this.currentTool = null;
    }
  }

  /**
   * Fail a tool execution.
   */
  failTool(tool: string, error: string, duration?: number): void {
    const eventIndex = this.events.findIndex(e => e.tool === tool && e.status === "running");
    if (eventIndex >= 0) {
      this.events[eventIndex].status = "failed";
      this.events[eventIndex].error = error;
      this.events[eventIndex].duration = duration;
    }

    this.failedCount++;

    this.timeline.push({
      timestamp: new Date(),
      type: "error",
      tool,
      message: `Failed ${tool}: ${error}`
    });

    if (this.currentTool === tool) {
      this.currentTool = null;
    }
  }

  /**
   * Add a warning to the timeline.
   */
  addWarning(tool: string, message: string): void {
    this.timeline.push({
      timestamp: new Date(),
      type: "warning",
      tool,
      message
    });
  }

  /**
   * Get current visualization state.
   */
  getState(): VisualizationState {
    const progress = this.toolCount > 0 ? this.completedCount / this.toolCount : 0;

    // Get latest result for preview
    const latestCompleted = [...this.events]
      .reverse()
      .find(e => e.status === "completed");

    return {
      currentTool: this.currentTool,
      toolCount: this.toolCount,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      progress,
      timeline: [...this.timeline],
      preview: latestCompleted?.result
    };
  }

  /**
   * Get execution timeline.
   */
  getTimeline(): TimelineEvent[] {
    return [...this.timeline];
  }

  /**
   * Get tool execution events.
   */
  getEvents(): ToolExecutionEvent[] {
    return [...this.events];
  }

  /**
   * Get progress percentage.
   */
  getProgress(): number {
    return this.toolCount > 0 ? (this.completedCount + this.failedCount) / this.toolCount : 0;
  }

  /**
   * Get estimated time remaining.
   */
  getEstimatedTimeRemaining(): number | null {
    const completedEvents = this.events.filter(e => e.status === "completed" && e.duration);
    if (completedEvents.length < 2) return null;

    const avgDuration = completedEvents.reduce((sum, e) => sum + (e.duration ?? 0), 0) / completedEvents.length;
    const remaining = this.toolCount - this.completedCount - this.failedCount;

    return remaining * avgDuration;
  }

  /**
   * Get execution summary.
   */
  getSummary(): {
    totalTools: number;
    completed: number;
    failed: number;
    inProgress: number;
    averageDuration: number;
    totalDuration: number;
  } {
    const completedEvents = this.events.filter(e => e.status === "completed" && e.duration);
    const totalDuration = completedEvents.reduce((sum, e) => sum + (e.duration ?? 0), 0);
    const averageDuration = completedEvents.length > 0 ? totalDuration / completedEvents.length : 0;

    return {
      totalTools: this.toolCount,
      completed: this.completedCount,
      failed: this.failedCount,
      inProgress: this.currentTool ? 1 : 0,
      averageDuration,
      totalDuration
    };
  }

  /**
   * Clear all tracking data.
   */
  clear(): void {
    this.events = [];
    this.timeline = [];
    this.currentTool = null;
    this.toolCount = 0;
    this.completedCount = 0;
    this.failedCount = 0;
  }

  /**
   * Export timeline as text.
   */
  exportTimeline(): string {
    const lines: string[] = [];
    for (const event of this.timeline) {
      const time = event.timestamp.toISOString();
      lines.push(`[${time}] ${event.type.toUpperCase()}: ${event.message}`);
    }
    return lines.join("\n");
  }

  /**
   * Get tool execution duration for a specific tool.
   */
  getToolDuration(tool: string): number | null {
    const event = this.events.find(e => e.tool === tool && e.duration);
    return event?.duration ?? null;
  }

  /**
   * Get all tool durations.
   */
  getAllDurations(): Record<string, number> {
    const durations: Record<string, number> = {};
    for (const event of this.events) {
      if (event.tool && event.duration) {
        durations[event.tool] = event.duration;
      }
    }
    return durations;
  }
}

// Global instance
export const toolExecutionVisualizer = new ToolExecutionVisualizer();
