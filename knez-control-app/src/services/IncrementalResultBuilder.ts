// ─── IncrementalResultBuilder.ts ─────────────────────────────────────────────────
// T15: Incremental Result Building — adds result accumulator, merging, transformation pipeline
//     for building results incrementally from multiple tool executions.
// ─────────────────────────────────────────────────────────────────────────────

export interface PartialResult {
  tool: string;
  result: any;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface TransformationStep {
  name: string;
  transform: (data: any) => any;
  condition?: (data: any) => boolean;
}

export interface BuiltResult {
  final: any;
  partials: PartialResult[];
  transformations: string[];
  metadata: {
    totalTools: number;
    buildTime: number;
    successRate: number;
  };
}

/**
 * Incremental result builder for accumulating and merging tool results.
 */
export class IncrementalResultBuilder {
  private partials: PartialResult[] = [];
  private transformations: TransformationStep[] = [];
  private startTime: Date | null = null;

  /**
   * Add a partial result from a tool execution.
   */
  addPartial(tool: string, result: any, metadata?: Record<string, any>): void {
    this.partials.push({
      tool,
      result,
      timestamp: new Date(),
      metadata
    });

    if (!this.startTime) {
      this.startTime = new Date();
    }
  }

  /**
   * Add a transformation step to the pipeline.
   */
  addTransformation(step: TransformationStep): void {
    this.transformations.push(step);
  }

  /**
   * Build the final result by merging partials and applying transformations.
   */
  build(): BuiltResult {
    const buildStart = Date.now();

    // Merge partial results
    let merged = this.mergePartials();

    // Apply transformations
    const appliedTransformations: string[] = [];
    for (const step of this.transformations) {
      if (!step.condition || step.condition(merged)) {
        merged = step.transform(merged);
        appliedTransformations.push(step.name);
      }
    }

    const buildTime = Date.now() - buildStart;
    const successCount = this.partials.filter(p => p.result && !p.result.error).length;

    return {
      final: merged,
      partials: [...this.partials],
      transformations: appliedTransformations,
      metadata: {
        totalTools: this.partials.length,
        buildTime,
        successRate: this.partials.length > 0 ? successCount / this.partials.length : 0
      }
    };
  }

  /**
   * Merge partial results into a single structure.
   */
  private mergePartials(): any {
    if (this.partials.length === 0) {
      return null;
    }

    if (this.partials.length === 1) {
      return this.partials[0].result;
    }

    // Try to merge as arrays
    if (this.allAreArrays()) {
      return this.mergeArrays();
    }

    // Try to merge as objects
    if (this.allAreObjects()) {
      return this.mergeObjects();
    }

    // Default: return as array
    return this.partials.map(p => p.result);
  }

  /**
   * Check if all partials are arrays.
   */
  private allAreArrays(): boolean {
    return this.partials.every(p => Array.isArray(p.result));
  }

  /**
   * Check if all partials are objects.
   */
  private allAreObjects(): boolean {
    return this.partials.every(p => typeof p.result === "object" && p.result !== null && !Array.isArray(p.result));
  }

  /**
   * Merge array results.
   */
  private mergeArrays(): any[] {
    const merged: any[] = [];
    for (const partial of this.partials) {
      if (Array.isArray(partial.result)) {
        merged.push(...partial.result);
      }
    }
    return merged;
  }

  /**
   * Merge object results.
   */
  private mergeObjects(): Record<string, any> {
    const merged: Record<string, any> = {};

    for (const partial of this.partials) {
      if (typeof partial.result === "object" && partial.result !== null && !Array.isArray(partial.result)) {
        Object.assign(merged, partial.result);
      }
    }

    return merged;
  }

  /**
   * Get partial results.
   */
  getPartials(): PartialResult[] {
    return [...this.partials];
  }

  /**
   * Clear partial results.
   */
  clear(): void {
    this.partials = [];
    this.transformations = [];
    this.startTime = null;
  }

  /**
   * Get build statistics.
   */
  getStatistics(): {
    partialCount: number;
    transformationCount: number;
    elapsedTime: number;
  } {
    const elapsed = this.startTime ? Date.now() - this.startTime.getTime() : 0;

    return {
      partialCount: this.partials.length,
      transformationCount: this.transformations.length,
      elapsedTime: elapsed
    };
  }
}

/**
 * Common transformation steps.
 */
export const CommonTransformations = {
  /**
   * Filter out null/undefined values.
   */
  filterNulls: (): TransformationStep => ({
    name: "filter_nulls",
    transform: (data) => {
      if (Array.isArray(data)) {
        return data.filter(item => item !== null && item !== undefined);
      }
      if (typeof data === "object" && data !== null) {
        const filtered: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
          if (value !== null && value !== undefined) {
            filtered[key] = value;
          }
        }
        return filtered;
      }
      return data;
    }
  }),

  /**
   * Deduplicate array items.
   */
  deduplicate: (): TransformationStep => ({
    name: "deduplicate",
    transform: (data) => {
      if (Array.isArray(data)) {
        return [...new Set(data)];
      }
      return data;
    },
    condition: (data) => Array.isArray(data)
  }),

  /**
   * Sort array items.
   */
  sort: (key?: string): TransformationStep => ({
    name: key ? `sort_by_${key}` : "sort",
    transform: (data) => {
      if (!Array.isArray(data)) return data;

      return [...data].sort((a, b) => {
        if (key) {
          const aVal = a[key];
          const bVal = b[key];
          if (aVal < bVal) return -1;
          if (aVal > bVal) return 1;
          return 0;
        }
        return String(a).localeCompare(String(b));
      });
    },
    condition: (data) => Array.isArray(data)
  }),

  /**
   * Limit array size.
   */
  limit: (max: number): TransformationStep => ({
    name: `limit_${max}`,
    transform: (data) => {
      if (Array.isArray(data)) {
        return data.slice(0, max);
      }
      return data;
    },
    condition: (data) => Array.isArray(data)
  }),

  /**
   * Extract specific fields from objects.
   */
  extractFields: (fields: string[]): TransformationStep => ({
    name: `extract_${fields.join("_")}`,
    transform: (data) => {
      if (Array.isArray(data)) {
        return data.map(item => {
          if (typeof item === "object" && item !== null) {
            const extracted: Record<string, any> = {};
            for (const field of fields) {
              if (field in item) {
                extracted[field] = item[field];
              }
            }
            return extracted;
          }
          return item;
        });
      }
      if (typeof data === "object" && data !== null) {
        const extracted: Record<string, any> = {};
        for (const field of fields) {
          if (field in data) {
            extracted[field] = data[field];
          }
        }
        return extracted;
      }
      return data;
    }
  }),

  /**
   * Group by field.
   */
  groupBy: (field: string): TransformationStep => ({
    name: `group_by_${field}`,
    transform: (data) => {
      if (!Array.isArray(data)) return data;

      const grouped: Record<string, any[]> = {};
      for (const item of data) {
        if (typeof item === "object" && item !== null && field in item) {
          const key = String(item[field]);
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(item);
        }
      }
      return grouped;
    },
    condition: (data) => Array.isArray(data)
  })
};

// Global instance
export const incrementalResultBuilder = new IncrementalResultBuilder();
