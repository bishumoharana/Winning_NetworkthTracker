/**
 * TrayManager — Issue #20
 *
 * Creates and manages the system tray icon, context menu,
 * and live speed tooltip for Network Tracker.
 */
import { app, BrowserWindow, Menu, MenuItem, Tray, nativeImage } from 'electron';
import * as path from 'path';
import { NetworkMetric } from '../../shared/types';
import { getAlertConfig, saveAlertConfig } from '../alerts/alertsService';

function formatBps(bps: number): string {
  if (bps >= 1_073_741_824) return `${(bps / 1_073_741_824).toFixed(1)}G`;
  if (bps >= 1_048_576)     return `${(bps / 1_048_576).toFixed(1)}M`;
  if (bps >= 1_024)         return `${(bps / 1_024).toFixed(0)}K`;
  return `${Math.round(bps)}B`;
}

export class TrayManager {
  private tray:       Tray | null = null;
  private window:     BrowserWindow | null = null;
  private _isInited   = false;

  get isInited(): boolean { return this._isInited; }

  /** Initialise the tray icon. Must be called after app is ready. */
  init(win: BrowserWindow): void {
    if (this._isInited) return;
    this.window = win;

    // Use a 16x16 empty image as placeholder tray icon.
    // In production, replace with a real .ico/.png asset in assets/.
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip('Network Tracker');
    this.tray.setTitle('NT'); // macOS menu bar text

    // Double-click on tray icon shows the window
    this.tray.on('double-click', () => this.showWindow());
    // Single click on Windows/Linux shows the window
    this.tray.on('click', () => {
      if (process.platform !== 'darwin') this.showWindow();
    });

    this.buildMenu();
    this._isInited = true;
  }

  /** Build / rebuild the context menu. */
  buildMenu(): void {
    if (!this.tray) return;
    const win      = this.window;
    const config   = this.getAlertsEnabledSafe();

    const menu = Menu.buildFromTemplate([
      {
        label:   win?.isVisible() ? 'Hide Window' : 'Show Window',
        click:   () => {
          if (win?.isVisible()) { win.hide(); }
          else { this.showWindow(); }
          this.buildMenu(); // refresh label
        },
      },
      { type: 'separator' },
      {
        label:   'Alerts',
        type:    'checkbox',
        checked: config,
        click:   (item: MenuItem) => {
          try {
            const current = getAlertConfig();
            saveAlertConfig({ ...current, enabled: item.checked });
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[Tray] failed to toggle alerts:', err);
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Network Tracker',
        click: () => {
          app.quit();
        },
      },
    ]);

    this.tray.setContextMenu(menu);
  }

  /** Update the tray tooltip with the latest live speeds. */
  updateTooltip(metrics: NetworkMetric[]): void {
    if (!this.tray || metrics.length === 0) return;

    // Use the first metric (primary adapter or only adapter)
    const m = metrics[0];
    const tip = `Network Tracker\n${m.adapterName}\n↑ ${formatBps(m.speedUp)}/s  ↓ ${formatBps(m.speedDown)}/s`;
    this.tray.setToolTip(tip);
  }

  /** Sync the Alerts checkbox in the menu with the current saved config. */
  updateAlertsMenuItem(enabled: boolean): void {
    // Simplest approach: rebuild menu with updated state
    if (!this.tray) return;
    const win = this.window;
    const menu = Menu.buildFromTemplate([
      {
        label: win?.isVisible() ? 'Hide Window' : 'Show Window',
        click: () => { if (win?.isVisible()) win.hide(); else this.showWindow(); this.buildMenu(); },
      },
      { type: 'separator' },
      {
        label: 'Alerts', type: 'checkbox', checked: enabled,
        click: (item: MenuItem) => {
          try {
            const current = getAlertConfig();
            saveAlertConfig({ ...current, enabled: item.checked });
          } catch { /* ignore */ }
        },
      },
      { type: 'separator' },
      { label: 'Quit Network Tracker', click: () => app.quit() },
    ]);
    this.tray.setContextMenu(menu);
  }

  showWindow(): void {
    if (!this.window) return;
    if (this.window.isMinimized()) this.window.restore();
    this.window.show();
    this.window.focus();
  }

  /** Destroy the tray icon on app quit. */
  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
    this._isInited = false;
  }

  private getAlertsEnabledSafe(): boolean {
    try { return getAlertConfig().enabled; }
    catch { return false; }
  }
}

export const trayManager = new TrayManager();
