/**
 * updaterService — Issue #25
 *
 * Wraps electron-updater with structured IPC events so the renderer
 * can show a non-intrusive update banner.
 */
import { BrowserWindow }  from 'electron';
import { autoUpdater }    from 'electron-updater';
import * as log           from 'electron-log';

export type UpdateStatus =
  | { type: 'checking' }
  | { type: 'available';    version: string }
  | { type: 'not-available'; version: string }
  | { type: 'progress';     percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded';   version: string }
  | { type: 'error';        message: string };

const UPDATE_CHANNEL = 'updater:status';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour throttle

let lastCheckAt = 0;
let win: BrowserWindow | null = null;

function send(status: UpdateStatus): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send(UPDATE_CHANNEL, status);
  }
}

/** Initialise auto-updater. Call once after the main window is ready. */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  win = mainWindow;

  autoUpdater.logger = log;
  autoUpdater.autoDownload        = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    send({ type: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    send({ type: 'available', version: info.version });
  });

  autoUpdater.on('update-not-available', (info) => {
    send({ type: 'not-available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    send({
      type:           'progress',
      percent:        Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred:    progress.transferred,
      total:          progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send({ type: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    send({ type: 'error', message: err?.message ?? 'Unknown update error' });
  });
}

/**
 * Check for updates at most once per CHECK_INTERVAL_MS.
 * Safe to call on every app launch.
 */
export function checkForUpdatesThrottled(): void {
  const now = Date.now();
  if (now - lastCheckAt < CHECK_INTERVAL_MS) return;
  lastCheckAt = now;
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    send({ type: 'error', message: (err as Error)?.message ?? 'Check failed' });
  }
}

/** Force an immediate check regardless of throttle (used by IPC handler). */
export function checkForUpdatesNow(): void {
  lastCheckAt = 0;
  checkForUpdatesThrottled();
}

/** Expose for test resets. */
export function _resetLastCheckAt(): void { lastCheckAt = 0; }
export function _setLastCheckAt(ts: number): void { lastCheckAt = ts; }
