import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import {
  getNetworkAdapters,
  getActiveAdapters,
  getPrimaryAdapter,
} from '../network/adapterDetector';

/**
 * Registers all network-related IPC handlers on the main process.
 * Call this once during app initialization.
 */
export function registerNetworkHandlers(): void {
  // Return all adapters
  ipcMain.handle(IPC_CHANNELS.GET_ADAPTERS, () => {
    return getNetworkAdapters();
  });

  // Return active adapters only
  ipcMain.handle('get-active-adapters', () => {
    return getActiveAdapters();
  });

  // Return primary adapter
  ipcMain.handle('get-primary-adapter', () => {
    return getPrimaryAdapter();
  });
}
