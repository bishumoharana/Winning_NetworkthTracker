import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
  getNetworkAdapters,
  getActiveAdapters,
  getPrimaryAdapter,
} from '../network/adapterDetector';
import { networkMonitor } from '../network/networkMonitor';
import { trafficPoller } from '../network/trafficPoller';
import {
  queryMetrics,
  getMetricsSummary,
} from '../db/metricsRepository';
import { queryAggregated } from '../db/aggregatedRepository';

export function registerNetworkHandlers(): void {
  // Adapter queries
  ipcMain.handle(IPC_CHANNELS.GET_ADAPTERS,    () => getNetworkAdapters());
  ipcMain.handle('get-active-adapters',         () => getActiveAdapters());
  ipcMain.handle('get-primary-adapter',          () => getPrimaryAdapter());

  // Monitor control
  ipcMain.handle('start-network-monitor', () => { networkMonitor.start(); return { started: true }; });
  ipcMain.handle('stop-network-monitor',  () => { networkMonitor.stop();  return { stopped: true }; });
  ipcMain.handle('get-monitor-status',    () => ({ isRunning: networkMonitor.isRunning, adapters: networkMonitor.getCurrentAdapters() }));

  // Live metrics (latest captured)
  ipcMain.handle('get-latest-metrics', () => trafficPoller.getLatestMetrics());

  // Historical metrics from DB (Task 2.2)
  ipcMain.handle(IPC_CHANNELS.GET_METRICS, (_e, query) => queryMetrics(query));
  ipcMain.handle('get-metrics-summary', (_e, adapterName: string, since: number, until: number) =>
    getMetricsSummary(adapterName, since, until)
  );
  ipcMain.handle(IPC_CHANNELS.GET_AGGREGATED, (_e, query) => queryAggregated(query));
}

export function startMonitoring(): void {
  networkMonitor.start();
  trafficPoller.start();
}

export function stopMonitoring(): void {
  networkMonitor.stop();
  trafficPoller.stop();
}
