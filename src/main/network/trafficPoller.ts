import { BrowserWindow } from 'electron';
import { NetworkMetric } from '../../shared/types';
import { captureTrafficMetrics } from './trafficCapture';
import { insertMetricsBatch } from '../db/metricsRepository';

const NETWORK_METRIC_CHANNEL = 'network-metric';

/**
 * TrafficPoller captures network byte counters every `intervalMs`,
 * persists them to SQLite, and broadcasts to all renderer windows.
 */
export class TrafficPoller {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private latestMetrics: NetworkMetric[] = [];

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  get isRunning(): boolean { return this._isRunning; }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this._isRunning = false;
  }

  getLatestMetrics(): NetworkMetric[] { return this.latestMetrics; }

  async tick(): Promise<void> {
    try {
      const metrics = await captureTrafficMetrics();
      this.latestMetrics = metrics;

      // Persist to SQLite (errors must never crash the poller)
      try {
        insertMetricsBatch(metrics);
      } catch (dbErr) {
        // eslint-disable-next-line no-console
        console.error('[TrafficPoller] DB write error:', dbErr);
      }

      this.broadcast(metrics);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TrafficPoller] tick error:', err);
    }
  }

  private broadcast(metrics: NetworkMetric[]): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) win.webContents.send(NETWORK_METRIC_CHANNEL, metrics);
    }
  }
}

export const trafficPoller = new TrafficPoller(1000);
