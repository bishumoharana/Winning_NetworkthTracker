/**
 * Unit tests for Issue #20 — TrayManager
 * Mocks Electron's Tray, Menu, BrowserWindow, and nativeImage.
 */
import Database from 'better-sqlite3';
import { _setDbForTest } from '../db/database';
import { CREATE_APP_CONFIG, DEFAULT_CONFIG } from '../db/schema';
import { NetworkMetric } from '../../shared/types';

// ── Mocks ────────────────────────────────────────────────────────────
const mockSetToolTip   = jest.fn();
const mockSetTitle     = jest.fn();
const mockSetContextMenu = jest.fn();
const mockOn           = jest.fn();
const mockDestroy      = jest.fn();
const mockMenuBuild    = jest.fn().mockReturnValue({});
const mockIsVisible    = jest.fn().mockReturnValue(true);
const mockShow         = jest.fn();
const mockFocus        = jest.fn();
const mockIsMinimized  = jest.fn().mockReturnValue(false);
const mockRestore      = jest.fn();
const mockHide         = jest.fn();

jest.mock('electron', () => ({
  app:         { quit: jest.fn() },
  BrowserWindow: class { isVisible = mockIsVisible; show = mockShow; focus = mockFocus; isMinimized = mockIsMinimized; restore = mockRestore; hide = mockHide; },
  Menu:        { buildFromTemplate: mockMenuBuild },
  MenuItem:    class {},
  Tray:        class {
    setToolTip    = mockSetToolTip;
    setTitle      = mockSetTitle;
    setContextMenu = mockSetContextMenu;
    on            = mockOn;
    destroy       = mockDestroy;
  },
  nativeImage: { createEmpty: () => ({}) },
}));

// ── Import AFTER mocks are set up ─────────────────────────────────────────
import { TrayManager } from '../tray/trayManager';

function makeFakeWindow() {
  return {
    isVisible:   mockIsVisible,
    show:        mockShow,
    focus:       mockFocus,
    isMinimized: mockIsMinimized,
    restore:     mockRestore,
    hide:        mockHide,
  } as unknown as import('electron').BrowserWindow;
}

function makeMetric(overrides: Partial<NetworkMetric> = {}): NetworkMetric {
  return {
    adapterId: 'eth0', adapterName: 'eth0', timestamp: Date.now(),
    bytesSent: 0, bytesReceived: 0, speedUp: 2_097_152, speedDown: 5_242_880,
    ...overrides,
  };
}

beforeEach(() => {
  // Fresh in-memory DB
  const mem = new Database(':memory:');
  mem.exec(CREATE_APP_CONFIG);
  const stmt = mem.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) stmt.run(k, v);
  _setDbForTest(mem);

  jest.clearAllMocks();
  mockMenuBuild.mockReturnValue({});
});

// ── init ───────────────────────────────────────────────────────────────
describe('TrayManager.init', () => {
  it('initialises tray and sets tooltip', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    expect(mgr.isInited).toBe(true);
    expect(mockSetToolTip).toHaveBeenCalledWith('Network Tracker');
  });

  it('is idempotent — second call is a no-op', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mgr.init(makeFakeWindow());
    expect(mockSetToolTip).toHaveBeenCalledTimes(1);
  });

  it('builds context menu on init', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    expect(mockMenuBuild).toHaveBeenCalled();
    expect(mockSetContextMenu).toHaveBeenCalled();
  });
});

// ── updateTooltip ──────────────────────────────────────────────────────
describe('TrayManager.updateTooltip', () => {
  it('sets tooltip with adapter name and formatted speeds', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mockSetToolTip.mockClear();
    mgr.updateTooltip([makeMetric({ adapterName: 'eth0', speedUp: 2_097_152, speedDown: 5_242_880 })]);
    const tip = mockSetToolTip.mock.calls[0][0] as string;
    expect(tip).toContain('eth0');
    expect(tip).toContain('↑');
    expect(tip).toContain('↓');
    expect(tip).toContain('2.0M'); // 2 MB/s up
    expect(tip).toContain('5.0M'); // 5 MB/s down
  });

  it('does nothing when metrics array is empty', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mockSetToolTip.mockClear();
    mgr.updateTooltip([]);
    expect(mockSetToolTip).not.toHaveBeenCalled();
  });

  it('does nothing before init', () => {
    const mgr = new TrayManager(); // not inited
    mgr.updateTooltip([makeMetric()]);
    expect(mockSetToolTip).not.toHaveBeenCalled();
  });
});

// ── showWindow ──────────────────────────────────────────────────────────
describe('TrayManager.showWindow', () => {
  it('shows and focuses the window', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mockIsMinimized.mockReturnValue(false);
    mgr.showWindow();
    expect(mockShow).toHaveBeenCalled();
    expect(mockFocus).toHaveBeenCalled();
  });

  it('restores minimised window before showing', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mockIsMinimized.mockReturnValue(true);
    mgr.showWindow();
    expect(mockRestore).toHaveBeenCalled();
  });
});

// ── destroy ──────────────────────────────────────────────────────────────
describe('TrayManager.destroy', () => {
  it('destroys the tray and resets isInited', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mgr.destroy();
    expect(mockDestroy).toHaveBeenCalled();
    expect(mgr.isInited).toBe(false);
  });

  it('is safe to call before init', () => {
    const mgr = new TrayManager();
    expect(() => mgr.destroy()).not.toThrow();
  });
});
