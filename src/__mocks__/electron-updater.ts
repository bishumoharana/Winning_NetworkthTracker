/**
 * Jest mock for electron-updater.
 *
 * electron-updater tries to locate the app asar/resources path at import time,
 * which crashes in a Jest/Node environment.
 *
 * This file is used as a fallback via moduleNameMapper.
 * Tests that need specific behaviour use an inline jest.mock() which takes
 * precedence over the moduleNameMapper entry.
 */

const autoUpdater = {
  logger:                   null as unknown,
  autoDownload:             false,
  autoInstallOnAppQuit:     false,
  on:                       jest.fn(),
  checkForUpdatesAndNotify: jest.fn().mockResolvedValue(undefined),
  quitAndInstall:           jest.fn(),
};

module.exports = { autoUpdater };
