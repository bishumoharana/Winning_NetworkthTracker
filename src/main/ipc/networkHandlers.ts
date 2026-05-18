import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
  getNetworkAdapters,
  getActiveAdapters,
  getPrimaryAdapter,
} from '../network/adapterDetector';
import { networkMonitor } from '../network/networkMonitor';
import { trafficPoller } from '../network/trafficPoller';

/**
 * Registers all network-related IPC handlers.
 * Call once during app initialization, before creating the window.
 */
export function registerNetworkHandlers(): void {
  // --- Adapter queries ---
  ipcMain.handle(IPC_CHANNELS.GET_ADAPTERS, () => getNetworkAdapters());
  ipcMain.handle('get-active-adapters', () => getActiveAdapters());
  ipcMain.handle('get-primary-adapter', () => getPrimaryAdapter());

  // --- Real-time monitor control ---
  ipcMain.handle('start-network-monitor', () => {
    networkMonitor.start();
    return { started: true };
  });

  ipcMain.handle('stop-network-monitor', () => {
    networkMonitor.stop();
    return { stopped: true };
  });

  ipcMain.handle('get-monitor-status', () => ({
    isRunning: networkMonitor.isRunning,
    adapters: networkMonitor.getCurrentAdapters(),
  }));

  // --- Traffic metrics (Task 2.1) ---
  ipcMain.handle('get-latest-metrics', () => trafficPoller.getLatestMetrics());
}

/** Starts both the adapter monitor and the traffic poller. */
export function startMonitoring(): void {
  networkMonitor.start();
  trafficPoller.start();
}

/** Stops both cleanly on app quit. */
export function stopMonitoring(): void {
  networkMonitor.stop();
  trafficPoller.stop();
}
