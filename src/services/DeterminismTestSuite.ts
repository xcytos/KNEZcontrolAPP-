// ─── DeterminismTestSuite.ts ───────────────────────────────────────────────
// T17: End-to-End Determinism Test Suite — test suite for determinism.
//     Test types: unit tests, integration tests, e2e tests, regression tests.
//     Coverage: tool execution, state management, error handling, performance.
// ─────────────────────────────────────────────────────────────────────────────

export type TestType = 'unit' | 'integration' | 'e2e' | 'regression';
export type TestStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export interface TestCase {
  id: string;
  name: string;
  type: TestType;
  description: string;
  setup?: () => Promise<void>;
  execute: () => Promise<TestResult>;
  teardown?: () => Promise<void>;
  timeoutMs?: number;
}

export interface TestResult {
  passed: boolean;
  durationMs: number;
  error?: string;
  details?: any;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  results: Map<string, TestResult>;
  status: TestStatus;
  startTime: number;
  endTime?: number;
}

export interface TestReport {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: Map<string, TestResult>;
  coverage?: {
    unit: number;
    integration: number;
    e2e: number;
    regression: number;
  };
}

/**
 * Determinism test suite for end-to-end testing.
 */
export class DeterminismTestSuite {
  private suites: Map<string, TestSuite> = new Map();
  private currentSuite: string | null = null;

  /**
   * Create a new test suite.
   */
  createSuite(name: string): TestSuite {
    const suite: TestSuite = {
      name,
      tests: [],
      results: new Map(),
      status: 'pending',
      startTime: Date.now()
    };

    this.suites.set(name, suite);
    return suite;
  }

  /**
   * Get a test suite.
   */
  getSuite(name: string): TestSuite | null {
    return this.suites.get(name) || null;
  }

  /**
   * Add a test case to a suite.
   */
  addTest(suiteName: string, test: TestCase): void {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Suite ${suiteName} not found`);
    }

    suite.tests.push(test);
  }

  /**
   * Run all tests in a suite.
   */
  async runSuite(suiteName: string): Promise<TestReport> {
    const suite = this.suites.get(suiteName);
    if (!suite) {
      throw new Error(`Suite ${suiteName} not found`);
    }

    this.currentSuite = suiteName;
    suite.status = 'running';
    suite.startTime = Date.now();
    suite.results.clear();

    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const test of suite.tests) {
      try {
        // Setup
        if (test.setup) {
          await test.setup();
        }

        // Execute test
        const result = await this.runTest(test);
        suite.results.set(test.id, result);

        if (result.passed) {
          passed++;
        } else {
          failed++;
        }
      } catch (error) {
        suite.results.set(test.id, {
          passed: false,
          durationMs: 0,
          error: String(error)
        });
        failed++;
      } finally {
        // Teardown
        if (test.teardown) {
          try {
            await test.teardown();
          } catch (error) {
            console.error(`Teardown error for test ${test.id}:`, error);
          }
        }
      }
    }

    suite.status = failed === 0 ? 'passed' : 'failed';
    suite.endTime = Date.now();
    this.currentSuite = null;

    // Calculate coverage
    const coverage = this.calculateCoverage(suite);

    return {
      suiteName,
      totalTests: suite.tests.length,
      passed,
      failed,
      skipped,
      durationMs: suite.endTime - suite.startTime,
      results: new Map(suite.results),
      coverage
    };
  }

  /**
   * Run a single test case.
   */
  private async runTest(test: TestCase): Promise<TestResult> {
    const startTime = Date.now();
    const timeoutMs = test.timeoutMs || 30000;

    try {
      // Execute with timeout
      const result = await Promise.race([
        test.execute(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), timeoutMs)
        )
      ]);

      const durationMs = Date.now() - startTime;
      return {
        passed: result.passed,
        durationMs,
        details: result.details
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      return {
        passed: false,
        durationMs,
        error: String(error)
      };
    }
  }

  /**
   * Calculate test coverage by type.
   */
  private calculateCoverage(suite: TestSuite): {
    unit: number;
    integration: number;
    e2e: number;
    regression: number;
  } {
    const coverage = {
      unit: 0,
      integration: 0,
      e2e: 0,
      regression: 0
    };

    const typeCounts: Record<TestType, { total: number; passed: number }> = {
      unit: { total: 0, passed: 0 },
      integration: { total: 0, passed: 0 },
      e2e: { total: 0, passed: 0 },
      regression: { total: 0, passed: 0 }
    };

    for (const test of suite.tests) {
      typeCounts[test.type].total++;
      const result = suite.results.get(test.id);
      if (result && result.passed) {
        typeCounts[test.type].passed++;
      }
    }

    for (const type of Object.keys(typeCounts) as TestType[]) {
      const stats = typeCounts[type];
      coverage[type] = stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
    }

    return coverage;
  }

  /**
   * Run all suites.
   */
  async runAllSuites(): Promise<TestReport[]> {
    const reports: TestReport[] = [];

    for (const [name] of this.suites) {
      try {
        const report = await this.runSuite(name);
        reports.push(report);
      } catch (error) {
        console.error(`Error running suite ${name}:`, error);
      }
    }

    return reports;
  }

  /**
   * Get combined report for all suites.
   */
  getCombinedReport(): {
    totalSuites: number;
    totalTests: number;
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalDurationMs: number;
    suiteReports: TestReport[];
  } | null {
    if (this.suites.size === 0) return null;

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalDurationMs = 0;

    const suiteReports: TestReport[] = [];

    for (const suite of this.suites.values()) {
      if (suite.endTime) {
        const report: TestReport = {
          suiteName: suite.name,
          totalTests: suite.tests.length,
          passed: Array.from(suite.results.values()).filter(r => r.passed).length,
          failed: Array.from(suite.results.values()).filter(r => !r.passed).length,
          skipped: 0,
          durationMs: suite.endTime - suite.startTime,
          results: new Map(suite.results),
          coverage: this.calculateCoverage(suite)
        };
        suiteReports.push(report);

        totalTests += report.totalTests;
        totalPassed += report.passed;
        totalFailed += report.failed;
        totalSkipped += report.skipped;
        totalDurationMs += report.durationMs;
      }
    }

    return {
      totalSuites: this.suites.size,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDurationMs,
      suiteReports
    };
  }

  /**
   * Get suite names.
   */
  getSuiteNames(): string[] {
    return Array.from(this.suites.keys());
  }

  /**
   * Delete a suite.
   */
  deleteSuite(name: string): void {
    this.suites.delete(name);
  }

  /**
   * Clear all suites.
   */
  clearAllSuites(): void {
    this.suites.clear();
  }

  /**
   * Get current running suite.
   */
  getCurrentSuite(): string | null {
    return this.currentSuite;
  }
}

// Global instance
export const determinismTestSuite = new DeterminismTestSuite();
