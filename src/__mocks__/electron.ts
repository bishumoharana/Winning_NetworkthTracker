// Mock Electron APIs for Jest tests (Node environment has no Electron)
const electron = {
  app: {
    whenReady: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    quit: jest.fn(),
    getPath: jest.fn().mockReturnValue('/tmp'),
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    loadURL: jest.fn(),
    once: jest.fn(),
    on: jest.fn(),
    show: jest.fn(),
    webContents: { openDevTools: jest.fn() },
  })),
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
  },
  ipcRenderer: {
    invoke: jest.fn(),
    on: jest.fn(),
    removeAllListeners: jest.fn(),
  },
  contextBridge: {
    exposeInMainWorld: jest.fn(),
  },
  nativeTheme: {
    shouldUseDarkColors: true,
    themeSource: 'system',
  },
};

module.exports = electron;
