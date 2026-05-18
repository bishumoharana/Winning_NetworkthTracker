import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../shared/types';
import { initDatabase, closeDatabase } from './db/database';
import { registerNetworkHandlers, startMonitoring, stopMonitoring } from './ipc/networkHandlers';
import { registerExportHandlers } from './ipc/exportHandlers';
import { registerStartupHandlers } from './ipc/startupHandlers';
import { registerStatsHandlers } from './ipc/statsHandlers';
import { registerUpdaterHandlers } from './ipc/updaterHandlers';
import { initAutoUpdater, checkForUpdatesThrottled } from './updater/updaterService';
import { logAdapters } from './network/adapterDetector';
import { trayManager } from './tray/trayManager';

let mainWindow: BrowserWindow | null = null;
let forceQuit = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
    backgroundColor: '#1a1a2e',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    startMonitoring();
    trayManager.init(mainWindow!);
    initAutoUpdater(mainWindow!);
    // Check for updates 5s after launch (non-blocking)
    setTimeout(() => checkForUpdatesThrottled(), 5_000);
  });

  mainWindow.on('close', (event) => {
    if (!forceQuit) {
      event.preventDefault();
      mainWindow?.hide();
      trayManager.buildMenu();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  initDatabase();
  registerNetworkHandlers();
  registerExportHandlers();
  registerStartupHandlers();
  registerStatsHandlers();
  registerUpdaterHandlers();
  logAdapters();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else trayManager.showWindow();
  });
});

app.on('before-quit', () => { forceQuit = true; });

app.on('will-quit', () => {
  stopMonitoring();
  trayManager.destroy();
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle(IPC_CHANNELS.GET_THEME, () =>
  nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
);
ipcMain.handle(IPC_CHANNELS.SET_THEME, (_event, theme: 'dark' | 'light' | 'system') => {
  nativeTheme.themeSource = theme;
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

export { mainWindow };
