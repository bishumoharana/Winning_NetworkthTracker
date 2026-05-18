/**
 * AggregationScheduler — Issue #17
 *
 * Runs aggregateAll() + pruneRawMetrics() + pruneAggregatedMetrics()
 * on a configurable interval (default every 2 hours).
 */
import { runAggregationCycle } from './aggregationService';

export class AggregationScheduler {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private lastRunAt:  number | null = null;
  private lastResult: ReturnType<typeof runAggregationCycle> | null = null;

  constructor(intervalMs = 2 * 60 * 60 * 1000) { // default 2h
    this.intervalMs = intervalMs;
  }

  get isRunning():  boolean { return this._isRunning; }
  get lastRun():    number | null { return this.lastRunAt; }
  getLastResult():  ReturnType<typeof runAggregationCycle> | null { return this.lastResult; }

  /** Start the scheduler. Runs the first cycle immediately, then every intervalMs. */
  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.runCycle(); // immediate first run
    this.timer = setInterval(() => this.runCycle(), this.intervalMs);
  }

  /** Stop the scheduler. */
  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._isRunning = false;
  }

  /** Trigger a cycle immediately (useful for testing / dev IPC trigger). */
  runNow(): ReturnType<typeof runAggregationCycle> | null {
    return this.runCycle();
  }

  private runCycle(): ReturnType<typeof runAggregationCycle> | null {
    try {
      const result = runAggregationCycle();
      this.lastRunAt  = Date.now();
      this.lastResult = result;
      // eslint-disable-next-line no-console
      console.warn(
        `[Aggregation] cycle complete — adapters: ${result.aggregated.length}, ` +
        `rawPruned: ${result.rawPruned}, aggPruned: ${result.aggPruned}`
      );
      return result;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Aggregation] cycle error:', err);
      return null;
    }
  }
}

/** Singleton instance used throughout the app. */
export const aggregationScheduler = new AggregationScheduler();
