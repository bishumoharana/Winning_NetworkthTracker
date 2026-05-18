/**
 * IPC handlers for startup/auto-launch — Issue #22
 */
import { ipcMain } from 'electron';
import { getLoginItemEnabled, setLoginItemEnabled } from '../startup/startupService';

export function registerStartupHandlers(): void {
  ipcMain.handle('startup:get', () => {
    return getLoginItemEnabled();
  });

  ipcMain.handle('startup:set', (_event, enabled: boolean) => {
    setLoginItemEnabled(enabled);
    return getLoginItemEnabled(); // return confirmed state
  });
}
