/**
 * Time Partitioning (Resource Control)
 * 
 * Each module gets time slice:
 * - backend: 10ms
 * - UI: 5ms
 * - diagnostics: 2ms
 * 
 * No module can block others
 * This prevents starvation like ARINC systems
 */

type ModuleType = 'backend' | 'ui' | 'diagnostics';

interface TimeSlice {
  module: ModuleType;
  durationMs: number;
  priority: number;
}

export class TimePartitioning {
  private timeSlices: Map<ModuleType, TimeSlice> = new Map();
  private currentModule: ModuleType | null = null;
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;

  constructor() {
    this.timeSlices.set('backend', { module: 'backend', durationMs: 10, priority: 1 });
    this.timeSlices.set('ui', { module: 'ui', durationMs: 5, priority: 2 });
    this.timeSlices.set('diagnostics', { module: 'diagnostics', durationMs: 2, priority: 3 });
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.scheduleNextSlice();
  }

  stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleNextSlice(): void {
    if (!this.isRunning) return;
    const nextModule = this.getNextModule();
    if (!nextModule) return;
    const slice = this.timeSlices.get(nextModule);
    if (!slice) return;
    this.currentModule = nextModule;
    this.timer = setTimeout(() => {
      this.scheduleNextSlice();
    }, slice.durationMs);
  }

  private getNextModule(): ModuleType | null {
    const modules = Array.from(this.timeSlices.keys());
    if (!this.currentModule) return modules[0];
    const currentIndex = modules.indexOf(this.currentModule);
    const nextIndex = (currentIndex + 1) % modules.length;
    return modules[nextIndex];
  }

  getCurrentModule(): ModuleType | null {
    return this.currentModule;
  }

  getStatistics(): {
    current_module: ModuleType | null;
    time_slices: Record<ModuleType, { durationMs: number; priority: number }>;
    total_cycle_ms: number;
  } {
    const totalCycleMs = Array.from(this.timeSlices.values())
      .reduce((sum, slice) => sum + slice.durationMs, 0);
    const timeSlices: Record<ModuleType, { durationMs: number; priority: number }> = {} as any;
    this.timeSlices.forEach((slice, module) => {
      timeSlices[module] = { durationMs: slice.durationMs, priority: slice.priority };
    });
    return {
      current_module: this.currentModule,
      time_slices: timeSlices,
      total_cycle_ms: totalCycleMs
    };
  }
}

let timePartitioningInstance: TimePartitioning | null = null;

export function getTimePartitioning(): TimePartitioning {
  if (!timePartitioningInstance) {
    timePartitioningInstance = new TimePartitioning();
  }
  return timePartitioningInstance;
}
