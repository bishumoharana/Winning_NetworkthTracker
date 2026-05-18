import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../shared/types';
import { initDatabase, closeDatabase } from './db/database';
import { registerNetworkHandlers, startMonitoring, stopMonitoring } from './ipc/networkHandlers';
import { logAdapters } from './network/adapterDetector';

let mainWindow: BrowserWindow | null = null;

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
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // 1. Init DB first (creates tables if needed)
  initDatabase();

  // 2. Register IPC handlers (they use the DB)
  registerNetworkHandlers();

  // 3. Log adapters for dev visibility
  logAdapters();

  // 4. Create the window
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  stopMonitoring();
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Theme IPC
ipcMain.handle(IPC_CHANNELS.GET_THEME, () =>
  nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
);
ipcMain.handle(IPC_CHANNELS.SET_THEME, (_event, theme: 'dark' | 'light' | 'system') => {
  nativeTheme.themeSource = theme;
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

export { mainWindow };
