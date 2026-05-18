/**
 * Comprehensive Electron mock for Jest (Node test environment).
 * All Electron APIs are unavailable in plain Node — this stub satisfies
 * every import in src/main/** without crashing.
 */

const mockSend        = jest.fn();
const mockIsDestroyed = jest.fn().mockReturnValue(false);
const mockOpenDevTools = jest.fn();

class BrowserWindowMock {
  loadFile   = jest.fn();
  loadURL    = jest.fn();
  once       = jest.fn();
  on         = jest.fn();
  show       = jest.fn();
  isDestroyed = mockIsDestroyed;
  webContents = {
    send:          mockSend,
    openDevTools:  mockOpenDevTools,
    on:            jest.fn(),
  };
  static getAllWindows = jest.fn().mockReturnValue([]);
  static fromWebContents = jest.fn();
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
    handle: jest.fn(),
    on:     jest.fn(),
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
    buildFromTemplate: jest.fn().mockReturnValue({ popup: jest.fn() }),
    setApplicationMenu: jest.fn(),
  },
  Tray: jest.fn().mockImplementation(() => ({
    setToolTip:       jest.fn(),
    setContextMenu:   jest.fn(),
    on:               jest.fn(),
    destroy:          jest.fn(),
  })),
  Notification: jest.fn().mockImplementation(() => ({
    show: jest.fn(),
    on:   jest.fn(),
  })),
  dialog: {
    showSaveDialog: jest.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/export.csv' }),
    showOpenDialog: jest.fn().mockResolvedValue({ canceled: false, filePaths: [] }),
    showMessageBox:  jest.fn().mockResolvedValue({ response: 0 }),
  },
};

module.exports = electron;
