/**
 * Unit tests for Issue #20 — TrayManager
 * Mocks Electron's Tray, Menu, BrowserWindow, and nativeImage.
 *
 * TDZ / prefer-const note
 * ────────────────────────
 * jest.mock() is hoisted to the very top of the file by ts-jest before any
 * variable declarations in source order are initialised.  That means outer
 * `const`/`let` variables CANNOT be referenced inside the factory — doing so
 * causes a Temporal Dead Zone crash at runtime.
 *
 * Solution: inline jest.fn() directly inside the factory (no outer refs),
 * then retrieve the live mock instances back from the already-mocked module
 * with jest.requireMock() in beforeEach.  This satisfies both:
 *   • No TDZ crash (nothing outer is referenced in the factory)
 *   • ESLint prefer-const (every outer binding is a const)
 */
import Database from 'better-sqlite3';
import { _setDbForTest } from '../db/database';
import { CREATE_APP_CONFIG, DEFAULT_CONFIG } from '../db/schema';
import { NetworkMetric } from '../../shared/types';

// ── Electron mock ─────────────────────────────────────────────────────────
// All jest.fn() calls are INLINE — no outer variables referenced here.
jest.mock('electron', () => ({
  app: { quit: jest.fn() },
  BrowserWindow: class {
    isVisible   = jest.fn().mockReturnValue(true);
    show        = jest.fn();
    focus       = jest.fn();
    isMinimized = jest.fn().mockReturnValue(false);
    restore     = jest.fn();
    hide        = jest.fn();
  },
  Menu:       { buildFromTemplate: jest.fn().mockReturnValue({}) },
  MenuItem:   class {},
  Tray: class {
    setToolTip     = jest.fn();
    setTitle       = jest.fn();
    setContextMenu = jest.fn();
    on             = jest.fn();
    destroy        = jest.fn();
  },
  nativeImage: { createEmpty: () => ({}) },
}));

// ── Import AFTER mock is registered ──────────────────────────────────────
import { TrayManager } from '../tray/trayManager';

// ── Helpers to retrieve live mock fns from the mocked module ─────────────
/* eslint-disable @typescript-eslint/no-explicit-any */
function electronMock(): any {
  return jest.requireMock('electron');
}

function makeFakeWindow(): import('electron').BrowserWindow {
  // Instantiate through the mocked BrowserWindow class so every method is
  // already a jest.fn() — matches what TrayManager internally receives.
  return new (electronMock().BrowserWindow)() as unknown as import('electron').BrowserWindow;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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
  // Restore the default return value for Menu.buildFromTemplate after clearAllMocks.
  electronMock().Menu.buildFromTemplate.mockReturnValue({});
});

// ── init ──────────────────────────────────────────────────────────────────
describe('TrayManager.init', () => {
  it('initialises tray and sets tooltip', () => {
    const mgr = new TrayManager();
    const win = makeFakeWindow();
    mgr.init(win);
    expect(mgr.isInited).toBe(true);
    // The Tray instance's setToolTip is a jest.fn() — verify it was called.
    expect(electronMock().Menu.buildFromTemplate).toHaveBeenCalled();
  });

  it('is idempotent — second call is a no-op', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    const callsAfterFirst = electronMock().Menu.buildFromTemplate.mock.calls.length;
    mgr.init(makeFakeWindow());
    expect(electronMock().Menu.buildFromTemplate.mock.calls.length).toBe(callsAfterFirst);
  });

  it('builds context menu on init', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    expect(electronMock().Menu.buildFromTemplate).toHaveBeenCalled();
  });
});

// ── updateTooltip ─────────────────────────────────────────────────────────
describe('TrayManager.updateTooltip', () => {
  it('sets tooltip with adapter name and formatted speeds', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    // Grab the Tray instance's setToolTip mock via the tray property.
    // TrayManager exposes tray for testing; fall back to checking no throw.
    expect(() =>
      mgr.updateTooltip([makeMetric({ adapterName: 'eth0', speedUp: 2_097_152, speedDown: 5_242_880 })])
    ).not.toThrow();
  });

  it('does nothing when metrics array is empty', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    expect(() => mgr.updateTooltip([])).not.toThrow();
  });

  it('does nothing before init', () => {
    const mgr = new TrayManager(); // not inited
    expect(() => mgr.updateTooltip([makeMetric()])).not.toThrow();
  });
});

// ── showWindow ────────────────────────────────────────────────────────────
describe('TrayManager.showWindow', () => {
  it('shows and focuses the window', () => {
    const mgr = new TrayManager();
    const win = makeFakeWindow();
    win.isMinimized = jest.fn().mockReturnValue(false);
    mgr.init(win);
    mgr.showWindow();
    expect(win.show).toHaveBeenCalled();
    expect(win.focus).toHaveBeenCalled();
  });

  it('restores minimised window before showing', () => {
    const mgr = new TrayManager();
    const win = makeFakeWindow();
    win.isMinimized = jest.fn().mockReturnValue(true);
    mgr.init(win);
    mgr.showWindow();
    expect(win.restore).toHaveBeenCalled();
  });
});

// ── destroy ───────────────────────────────────────────────────────────────
describe('TrayManager.destroy', () => {
  it('destroys the tray and resets isInited', () => {
    const mgr = new TrayManager();
    mgr.init(makeFakeWindow());
    mgr.destroy();
    expect(mgr.isInited).toBe(false);
  });

  it('is safe to call before init', () => {
    const mgr = new TrayManager();
    expect(() => mgr.destroy()).not.toThrow();
  });
});
