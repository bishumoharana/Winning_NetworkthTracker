/**
 * Jest mock for electron-updater.
 * electron-updater tries to locate the app's asar/resources path at
 * import time, which crashes in a Jest/Node environment.
 */
const mockOn                        = jest.fn();
const mockCheckForUpdatesAndNotify  = jest.fn().mockResolvedValue(undefined);
const mockQuitAndInstall            = jest.fn();

export const autoUpdater = {
  logger:               null as unknown,
  autoDownload:         false,
  autoInstallOnAppQuit: false,
  on:                   mockOn,
  checkForUpdatesAndNotify: mockCheckForUpdatesAndNotify,
  quitAndInstall:       mockQuitAndInstall,
};
