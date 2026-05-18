/**
 * macOS Notarization stub — Issue #24
 *
 * Runs as electron-builder afterSign hook.
 * Only notarizes when APPLE_ID and APPLE_ID_PASSWORD are set.
 *
 * Required env vars for real notarization:
 *   APPLE_ID           — your Apple ID email
 *   APPLE_ID_PASSWORD  — app-specific password
 *   APPLE_TEAM_ID      — 10-char team ID from developer.apple.com
 */

exports.default = async function notarize(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') return;

  const appleId       = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_ID_PASSWORD;
  const teamId        = process.env.APPLE_TEAM_ID;

  if (!appleId || !applePassword || !teamId) {
    console.log('[notarize] Skipping: APPLE_ID / APPLE_ID_PASSWORD / APPLE_TEAM_ID not set.');
    return;
  }

  const appName  = context.packager.appInfo.productFilename;
  const appPath  = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Notarizing ${appPath}…`);

  // Dynamically require so it doesn’t error on non-mac CI
  const { notarize } = require('@electron/notarize');

  await notarize({
    tool:       'notarytool',
    appPath,
    appleId,
    appleIdPassword: applePassword,
    teamId,
  });

  console.log('[notarize] Done.');
};
