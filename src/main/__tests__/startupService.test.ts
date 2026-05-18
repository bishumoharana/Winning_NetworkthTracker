/**
 * Unit tests for Issue #22 — startupService
 */
import Database from 'better-sqlite3';
import * as os from 'os';
import * as fs from 'fs';
import { _setDbForTest } from '../db/database';
import { CREATE_APP_CONFIG, DEFAULT_CONFIG } from '../db/schema';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGetLoginItemSettings = jest.fn();
const mockSetLoginItemSettings = jest.fn();
const mockGetPath = jest.fn();

jest.mock('electron', () => ({
  app: {
    getLoginItemSettings: mockGetLoginItemSettings,
    setLoginItemSettings: mockSetLoginItemSettings,
    getPath: mockGetPath,
  },
}));

// jest.mock is hoisted above imports — use jest.requireActual inside factory.
jest.mock('os', () => ({
  ...(jest.requireActual('os') as typeof import('os')),
  homedir: () => `${(jest.requireActual('os') as typeof import('os')).tmpdir()}/nt-test-home`,
}));

import {
  getLoginItemEnabled,
  setLoginItemEnabled,
  getStartupConfig,
} from '../startup/startupService';

/** Resolved once so every test uses the same base dir. */
const TEST_HOME = `${os.tmpdir()}/nt-test-home`;
const DESKTOP_FILE = `${TEST_HOME}/.config/autostart/network-tracker.desktop`;

function setupDb() {
  const mem = new Database(':memory:');
  mem.exec(CREATE_APP_CONFIG);
  const stmt = mem.prepare(`INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)`);
  for (const [k, v] of Object.entries(DEFAULT_CONFIG)) stmt.run(k, v);
  _setDbForTest(mem);
  return mem;
}

beforeEach(() => {
  setupDb();
  jest.clearAllMocks();
  mockGetPath.mockReturnValue('/fake/exe');
  mockGetLoginItemSettings.mockReturnValue({ openAtLogin: false });
});

afterAll(() => {
  try { fs.rmSync(TEST_HOME, { recursive: true, force: true }); } catch { /* ok */ }
});

// ── getLoginItemEnabled (non-linux) ──────────────────────────────────────────
describe('getLoginItemEnabled — native (non-linux)', () => {
  const originalPlatform = process.platform;
  beforeAll(() => { Object.defineProperty(process, 'platform', { value: 'darwin' }); });
  afterAll(() => { Object.defineProperty(process, 'platform', { value: originalPlatform }); });

  it('returns false when openAtLogin is false', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: false });
    expect(getLoginItemEnabled()).toBe(false);
  });

  it('returns true when openAtLogin is true', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: true });
    expect(getLoginItemEnabled()).toBe(true);
  });
});

// ── setLoginItemEnabled (non-linux) ──────────────────────────────────────────
describe('setLoginItemEnabled — native (non-linux)', () => {
  const originalPlatform = process.platform;
  beforeAll(() => { Object.defineProperty(process, 'platform', { value: 'win32' }); });
  afterAll(() => { Object.defineProperty(process, 'platform', { value: originalPlatform }); });

  it('calls app.setLoginItemSettings with openAtLogin: true and openAsHidden: true', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: true });
    setLoginItemEnabled(true);
    expect(mockSetLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true, openAsHidden: true });
  });

  it('calls app.setLoginItemSettings with openAtLogin: false', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: false });
    setLoginItemEnabled(false);
    expect(mockSetLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: false, openAsHidden: true });
  });

  it('persists value to app_config in DB', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: true });
    setLoginItemEnabled(true);
    expect(getStartupConfig()).toBe(true);
  });

  it('is idempotent — calling set(true) twice does not throw', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: true });
    expect(() => { setLoginItemEnabled(true); setLoginItemEnabled(true); }).not.toThrow();
  });
});

// ── Linux .desktop file ──────────────────────────────────────────────────────
describe('setLoginItemEnabled — Linux', () => {
  const originalPlatform = process.platform;
  beforeAll(() => { Object.defineProperty(process, 'platform', { value: 'linux' }); });
  afterAll(() => { Object.defineProperty(process, 'platform', { value: originalPlatform }); });

  it('writes a .desktop file when enabled', () => {
    setLoginItemEnabled(true);
    expect(fs.existsSync(DESKTOP_FILE)).toBe(true);
    const content = fs.readFileSync(DESKTOP_FILE, 'utf8');
    expect(content).toContain('[Desktop Entry]');
    expect(content).toContain('Exec=');
    expect(content).toContain('--hidden');
  });

  it('removes the .desktop file when disabled', () => {
    setLoginItemEnabled(true);
    setLoginItemEnabled(false);
    expect(fs.existsSync(DESKTOP_FILE)).toBe(false);
  });

  it('does not throw when removing a non-existent desktop file', () => {
    expect(() => setLoginItemEnabled(false)).not.toThrow();
  });

  it('getLoginItemEnabled returns true after writing desktop file', () => {
    setLoginItemEnabled(true);
    expect(getLoginItemEnabled()).toBe(true);
  });

  it('getLoginItemEnabled returns false after removing desktop file', () => {
    setLoginItemEnabled(true);
    setLoginItemEnabled(false);
    expect(getLoginItemEnabled()).toBe(false);
  });
});

// ── getStartupConfig ─────────────────────────────────────────────────────────
describe('getStartupConfig', () => {
  const originalPlatform = process.platform;
  beforeAll(() => { Object.defineProperty(process, 'platform', { value: 'darwin' }); });
  afterAll(() => { Object.defineProperty(process, 'platform', { value: originalPlatform }); });

  it('returns false by default (key not yet written)', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: false });
    expect(getStartupConfig()).toBe(false);
  });

  it('returns true after setLoginItemEnabled(true)', () => {
    mockGetLoginItemSettings.mockReturnValue({ openAtLogin: true });
    setLoginItemEnabled(true);
    expect(getStartupConfig()).toBe(true);
  });
});
