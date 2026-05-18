/**
 * IPC handlers for Export feature — Issue #21
 */
import { ipcMain } from 'electron';
import { exportMetrics, getExportAdapters, ExportOptions } from '../export/exportService';

export function registerExportHandlers(): void {
  ipcMain.handle('export:run', (_event, opts: ExportOptions) => {
    return exportMetrics(opts);
  });

  ipcMain.handle('export:get-adapters', () => {
    return getExportAdapters();
  });
}
