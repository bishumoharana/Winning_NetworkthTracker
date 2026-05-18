import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
  getNetworkAdapters,
  getActiveAdapters,
  getPrimaryAdapter,
} from '../network/adapterDetector';
import { networkMonitor } from '../network/networkMonitor';

/**
 * Registers all network-related IPC handlers.
 * Call once during app initialization.
 */
export function registerNetworkHandlers(): void {
  // Return all adapters (point-in-time)
  ipcMain.handle(IPC_CHANNELS.GET_ADAPTERS, () => getNetworkAdapters());
  ipcMain.handle('get-active-adapters', () => getActiveAdapters());
  ipcMain.handle('get-primary-adapter', () => getPrimaryAdapter());

  // Real-time monitor control
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
}

/**
 * Starts the network monitor. Call after window is created.
 */
export function startMonitoring(): void {
  networkMonitor.start();
}

/**
 * Stops the monitor on app quit.
 */
export function stopMonitoring(): void {
  networkMonitor.stop();
}
