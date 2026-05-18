import { BrowserWindow } from 'electron';
import { NetworkMetric } from '../../shared/types';
import { captureTrafficMetrics } from './trafficCapture';

// IPC channel for pushing live metrics to the renderer
const NETWORK_METRIC_CHANNEL = 'network-metric';

/**
 * TrafficPoller captures network byte counters every `intervalMs`
 * and broadcasts the resulting NetworkMetric[] to all open renderer windows.
 */
export class TrafficPoller {
  private intervalMs: number;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;
  private latestMetrics: NetworkMetric[] = [];

  constructor(intervalMs = 1000) {
    this.intervalMs = intervalMs;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Start polling. No-op if already running. */
  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  /** Stop polling and clear the interval. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._isRunning = false;
  }

  /** Returns the most recently captured metrics (point-in-time snapshot). */
  getLatestMetrics(): NetworkMetric[] {
    return this.latestMetrics;
  }

  /** Executes one capture tick. Exposed for testing. */
  async tick(): Promise<void> {
    try {
      const metrics = await captureTrafficMetrics();
      this.latestMetrics = metrics;
      this.broadcast(metrics);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TrafficPoller] tick error:', err);
    }
  }

  /** Sends metrics to all live renderer windows via IPC. */
  private broadcast(metrics: NetworkMetric[]): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(NETWORK_METRIC_CHANNEL, metrics);
      }
    }
  }
}

// Singleton used by the main process
export const trafficPoller = new TrafficPoller(1000);
