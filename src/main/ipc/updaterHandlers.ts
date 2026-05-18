/**
 * IPC handlers for auto-updater — Issue #25
 */
import { ipcMain }              from 'electron';
import { autoUpdater }          from 'electron-updater';
import { checkForUpdatesNow }   from '../updater/updaterService';

export function registerUpdaterHandlers(): void {
  ipcMain.handle('updater:check', () => {
    checkForUpdatesNow();
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });
}
