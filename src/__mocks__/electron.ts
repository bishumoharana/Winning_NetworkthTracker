/**
 * Jest mock for the 'electron' package.
 *
 * Electron is not available in a plain Node / Jest environment.
 * Every Electron API used across src/main/** is stubbed here so that
 * module imports never crash during testing.
 *
 * Tests that need specific behaviour override individual mocks inline
 * via jest.mock('electron', () => ({ ... })).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const mockSend         = jest.fn();
const mockIsDestroyed  = jest.fn().mockReturnValue(false);
const mockOpenDevTools = jest.fn();

class BrowserWindowMock {
  loadFile    = jest.fn();
  loadURL     = jest.fn();
  once        = jest.fn();
  on          = jest.fn();
  show        = jest.fn();
  hide        = jest.fn();
  focus       = jest.fn();
  restore     = jest.fn();
  isMinimized = jest.fn().mockReturnValue(false);
  isVisible   = jest.fn().mockReturnValue(true);
  isDestroyed = mockIsDestroyed;
  webContents = {
    send:         mockSend,
    openDevTools: mockOpenDevTools,
    on:           jest.fn(),
  };
  static getAllWindows    = jest.fn().mockReturnValue([]);
  static fromWebContents = jest.fn();
}

class MenuItemMock {
  checked = false;
  constructor(opts: any) {
    Object.assign(this, opts);
  }
}

const electron = {
  app: {
    whenReady:            jest.fn().mockResolvedValue(undefined),
    on:                   jest.fn(),
    quit:                 jest.fn(),
    exit:                 jest.fn(),
    relaunch:             jest.fn(),
    getPath:              jest.fn().mockReturnValue('/tmp/test-user-data'),
    getVersion:           jest.fn().mockReturnValue('0.1.0'),
    getName:              jest.fn().mockReturnValue('network-tracker'),
    isPackaged:           false,
    setLoginItemSettings: jest.fn(),
    getLoginItemSettings: jest.fn().mockReturnValue({ openAtLogin: false }),
  },
  BrowserWindow: BrowserWindowMock,
  ipcMain: {
    handle:        jest.fn(),
    on:            jest.fn(),
    removeHandler: jest.fn(),
  },
  ipcRenderer: {
    invoke:             jest.fn(),
    on:                 jest.fn(),
    removeAllListeners: jest.fn(),
    send:               jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  nativeTheme: {
    shouldUseDarkColors: true,
    themeSource: 'system',
    on: jest.fn(),
  },
  shell: {
    openExternal: jest.fn(),
    openPath:     jest.fn(),
  },
  Menu: {
    buildFromTemplate:  jest.fn().mockReturnValue({ popup: jest.fn() }),
    setApplicationMenu: jest.fn(),
  },
  MenuItem: MenuItemMock,
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip:     jest.fn(),
    setTitle:       jest.fn(),
    setContextMenu: jest.fn(),
    on:             jest.fn(),
    destroy:        jest.fn(),
  })),
  nativeImage: {
    createEmpty:       jest.fn().mockReturnValue({}),
    createFromPath:    jest.fn().mockReturnValue({}),
    createFromBuffer:  jest.fn().mockReturnValue({}),
  },
  Notification: class MockNotification {
    static isSupported = jest.fn().mockReturnValue(true);
    show = jest.fn();
    on   = jest.fn();
    constructor(_opts: any) {}
  },
  dialog: {
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/export.csv' }),
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    showMessageBox: jest.fn().mockResolvedValue({ response: 0 }),
  },
};

module.exports = electron;
