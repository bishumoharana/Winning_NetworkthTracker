import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types';
import { getAdapters, detectPrimaryAdapter } from '../network/adapterDetector';

/**
 * Registers all IPC handlers related to network adapter detection.
 * Call this once from main.ts during app initialisation.
 */
export function registerAdapterHandlers(): void {
  // Returns all detected physical adapters, sorted by priority
  ipcMain.handle(IPC_CHANNELS.GET_ADAPTERS, () => {
    return getAdapters();
  });

  // Returns the primary active adapter only
  ipcMain.handle('get-primary-adapter', () => {
    return detectPrimaryAdapter();
  });
}
