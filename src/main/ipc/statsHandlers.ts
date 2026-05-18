/**
 * IPC handlers for History/Stats — Issue #23
 */
import { ipcMain } from 'electron';
import { getStats, getSummary, Period } from '../stats/statsService';

export function registerStatsHandlers(): void {
  ipcMain.handle('stats:get', (_event, period: Period, adapterId?: string) => {
    return getStats(period, adapterId);
  });

  ipcMain.handle('stats:summary', (_event, period: Period) => {
    return getSummary(period);
  });
}
