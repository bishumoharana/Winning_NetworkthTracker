/**
 * Unit tests for Issue #25 — updaterService
 */

// ── Mocks ──────────────────────────────────────────────────────────────────
const mockCheckForUpdatesAndNotify = jest.fn();
const mockQuitAndInstall           = jest.fn();
const mockOn                       = jest.fn();
const mockSend                     = jest.fn();
const mockIsDestroyed              = jest.fn().mockReturnValue(false);

jest.mock('electron-updater', () => ({
  autoUpdater: {
    logger:                  null,
    autoDownload:            false,
    autoInstallOnAppQuit:    false,
    on:                      mockOn,
    checkForUpdatesAndNotify: mockCheckForUpdatesAndNotify,
    quitAndInstall:          mockQuitAndInstall,
  },
}));

jest.mock('electron-log', () => ({}));

jest.mock('electron', () => ({
  BrowserWindow: class {
    webContents = { send: mockSend };
    isDestroyed = mockIsDestroyed;
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import {
  initAutoUpdater,
  checkForUpdatesThrottled,
  checkForUpdatesNow,
  _resetLastCheckAt,
  _setLastCheckAt,
} from '../updater/updaterService';
import { BrowserWindow } from 'electron';

function makeFakeWindow() {
  return new BrowserWindow() as unknown as import('electron').BrowserWindow;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsDestroyed.mockReturnValue(false);
  _resetLastCheckAt();
});

// ── initAutoUpdater ────────────────────────────────────────────────────────
describe('initAutoUpdater', () => {
  it('registers all 6 event listeners', () => {
    initAutoUpdater(makeFakeWindow());
    const events = mockOn.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain('checking-for-update');
    expect(events).toContain('update-available');
    expect(events).toContain('update-not-available');
    expect(events).toContain('download-progress');
    expect(events).toContain('update-downloaded');
    expect(events).toContain('error');
  });

  it('sends checking status to renderer on checking-for-update event', () => {
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'checking-for-update')?.[1] as () => void;
    handler();
    expect(mockSend).toHaveBeenCalledWith('updater:status', { type: 'checking' });
  });

  it('sends available status with version', () => {
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'update-available')?.[1] as (i: {version:string}) => void;
    handler({ version: '2.0.0' });
    expect(mockSend).toHaveBeenCalledWith('updater:status', { type: 'available', version: '2.0.0' });
  });

  it('sends not-available status with version', () => {
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'update-not-available')?.[1] as (i: {version:string}) => void;
    handler({ version: '1.0.0' });
    expect(mockSend).toHaveBeenCalledWith('updater:status', { type: 'not-available', version: '1.0.0' });
  });

  it('sends progress status with rounded percent', () => {
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'download-progress')?.[1] as (p: object) => void;
    handler({ percent: 45.7, bytesPerSecond: 500_000, transferred: 1_000_000, total: 2_000_000 });
    const call = mockSend.mock.calls[0][1];
    expect(call.type).toBe('progress');
    expect(call.percent).toBe(46);
    expect(call.bytesPerSecond).toBe(500_000);
  });

  it('sends downloaded status with version', () => {
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'update-downloaded')?.[1] as (i: {version:string}) => void;
    handler({ version: '2.0.0' });
    expect(mockSend).toHaveBeenCalledWith('updater:status', { type: 'downloaded', version: '2.0.0' });
  });

  it('sends error status with message', () => {
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'error')?.[1] as (e: Error) => void;
    handler(new Error('network timeout'));
    expect(mockSend).toHaveBeenCalledWith('updater:status', { type: 'error', message: 'network timeout' });
  });

  it('does not send if window is destroyed', () => {
    mockIsDestroyed.mockReturnValue(true);
    initAutoUpdater(makeFakeWindow());
    const handler = mockOn.mock.calls.find((c: unknown[]) => c[0] === 'checking-for-update')?.[1] as () => void;
    handler();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

// ── checkForUpdatesThrottled ───────────────────────────────────────────────
describe('checkForUpdatesThrottled', () => {
  it('calls checkForUpdatesAndNotify on first call', () => {
    checkForUpdatesThrottled();
    expect(mockCheckForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it('skips second call within 1 hour', () => {
    checkForUpdatesThrottled();
    checkForUpdatesThrottled();
    expect(mockCheckForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it('allows check after 1 hour has passed', () => {
    _setLastCheckAt(Date.now() - 61 * 60 * 1000); // 61 minutes ago
    checkForUpdatesThrottled();
    expect(mockCheckForUpdatesAndNotify).toHaveBeenCalledTimes(1);
  });

  it('checkForUpdatesNow resets throttle and always calls', () => {
    checkForUpdatesThrottled(); // set lastCheckAt
    checkForUpdatesNow();       // should still call
    expect(mockCheckForUpdatesAndNotify).toHaveBeenCalledTimes(2);
  });
});
