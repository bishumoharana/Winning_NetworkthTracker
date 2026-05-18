import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import * as path from 'path';
import { IPC_CHANNELS } from '../shared/types';
import { registerAdapterHandlers } from './ipc/adapterHandlers';
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

  // Load the renderer
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// App lifecycle
app.whenReady().then(() => {
  // Register all IPC handlers before creating the window
  registerAdapterHandlers();

  // Log detected adapters to console on startup (dev aid)
  logAdapters();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: theme
ipcMain.handle(IPC_CHANNELS.GET_THEME, () => {
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

ipcMain.handle(IPC_CHANNELS.SET_THEME, (_event, theme: 'dark' | 'light' | 'system') => {
  nativeTheme.themeSource = theme;
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
});

export { mainWindow };
