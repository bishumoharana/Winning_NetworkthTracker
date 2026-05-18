import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
  getNetworkAdapters,
  getActiveAdapters,
  getPrimaryAdapter,
} from '../network/adapterDetector';
import { networkMonitor } from '../network/networkMonitor';
import { trafficPoller } from '../network/trafficPoller';
import { aggregationScheduler } from '../db/aggregationScheduler';
import {
  queryMetrics,
  getMetricsSummary,
} from '../db/metricsRepository';
import { queryAggregated } from '../db/aggregatedRepository';
import { getAlertConfig, saveAlertConfig, evaluateMetrics } from '../alerts/alertsService';

export function registerNetworkHandlers(): void {
  // Adapter queries
  ipcMain.handle(IPC_CHANNELS.GET_ADAPTERS,   () => getNetworkAdapters());
  ipcMain.handle('get-active-adapters',        () => getActiveAdapters());
  ipcMain.handle('get-primary-adapter',         () => getPrimaryAdapter());

  // Monitor control
  ipcMain.handle('start-network-monitor', () => { networkMonitor.start(); return { started: true }; });
  ipcMain.handle('stop-network-monitor',  () => { networkMonitor.stop();  return { stopped: true }; });
  ipcMain.handle('get-monitor-status',    () => ({
    isRunning: networkMonitor.isRunning,
    adapters:  networkMonitor.getCurrentAdapters(),
  }));

  // Live metrics
  ipcMain.handle('get-latest-metrics', () => trafficPoller.getLatestMetrics());

  // Historical DB queries
  ipcMain.handle(IPC_CHANNELS.GET_METRICS,    (_e, query) => queryMetrics(query));
  ipcMain.handle('get-metrics-summary',       (_e, adapterName: string, since: number, until: number) =>
    getMetricsSummary(adapterName, since, until)
  );
  ipcMain.handle(IPC_CHANNELS.GET_AGGREGATED, (_e, query) => queryAggregated(query));

  // Aggregation scheduler
  ipcMain.handle('run-aggregation-now',    () => aggregationScheduler.runNow());
  ipcMain.handle('get-aggregation-status', () => ({
    isRunning:  aggregationScheduler.isRunning,
    lastRun:    aggregationScheduler.lastRun,
    lastResult: aggregationScheduler.getLastResult(),
  }));

  // Alerts config
  ipcMain.handle('get-alert-config',  () => getAlertConfig());
  ipcMain.handle('save-alert-config', (_e, config) => { saveAlertConfig(config); return { ok: true }; });
}

export function startMonitoring(): void {
  networkMonitor.start();
  trafficPoller.start();
  aggregationScheduler.start();

  // Hook alerts evaluation into every TrafficPoller tick result
  // We listen on the IPC channel the poller broadcasts to renderer,
  // but since we are in main, we subscribe via the poller’s tick directly.
  // Monkey-patch approach: wrap the original tick to also evaluate alerts.
  const originalTick = trafficPoller.tick.bind(trafficPoller);
  trafficPoller.tick = async function patchedTick() {
    await originalTick();
    const metrics = trafficPoller.getLatestMetrics();
    if (metrics.length > 0) {
      try {
        const config = getAlertConfig();
        evaluateMetrics(metrics, config);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Alerts] evaluation error:', err);
      }
    }
  };
}

export function stopMonitoring(): void {
  networkMonitor.stop();
  trafficPoller.stop();
  aggregationScheduler.stop();
}
