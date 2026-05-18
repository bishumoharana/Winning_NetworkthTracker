/**
 * startupService — Issue #22
 *
 * Manages "Launch at login" using Electron's app.getLoginItemSettings /
 * app.setLoginItemSettings on Windows and macOS, and a .desktop autostart
 * file on Linux.
 */
import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import { app }   from 'electron';
import { getDb } from '../db/database';

const CONFIG_KEY = 'startup_enabled';

// ── Linux autostart ─────────────────────────────────────────────────────────
const AUTOSTART_DIR  = path.join(os.homedir(), '.config', 'autostart');
const DESKTOP_FILE   = path.join(AUTOSTART_DIR, 'network-tracker.desktop');

function getDesktopFileContent(): string {
  const execPath = app.getPath('exe');
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Network Tracker',
    `Exec=${execPath} --hidden`,
    'Hidden=false',
    'NoDisplay=false',
    'X-GNOME-Autostart-enabled=true',
  ].join('\n') + '\n';
}

function setLinuxAutostart(enabled: boolean): void {
  if (enabled) {
    fs.mkdirSync(AUTOSTART_DIR, { recursive: true });
    fs.writeFileSync(DESKTOP_FILE, getDesktopFileContent(), 'utf8');
  } else {
    if (fs.existsSync(DESKTOP_FILE)) fs.unlinkSync(DESKTOP_FILE);
  }
}

function getLinuxAutostart(): boolean {
  return fs.existsSync(DESKTOP_FILE);
}

// ── macOS / Windows ─────────────────────────────────────────────────────────
function setNativeAutostart(enabled: boolean): void {
  app.setLoginItemSettings({
    openAtLogin:  enabled,
    openAsHidden: true,   // start minimised to tray
  });
}

function getNativeAutostart(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Returns whether launch-at-login is currently enabled for the OS. */
export function getLoginItemEnabled(): boolean {
  try {
    if (process.platform === 'linux') return getLinuxAutostart();
    return getNativeAutostart();
  } catch {
    return false;
  }
}

/** Enables or disables launch-at-login on the OS level. */
export function setLoginItemEnabled(enabled: boolean): void {
  if (process.platform === 'linux') {
    setLinuxAutostart(enabled);
  } else {
    setNativeAutostart(enabled);
  }
  // Persist to DB so the UI reflects state correctly across restarts
  _persistToDb(enabled);
}

/** Read persisted config value from app_config (fallback: query OS). */
export function getStartupConfig(): boolean {
  try {
    const db  = getDb();
    const row = db.prepare(`SELECT value FROM app_config WHERE key = ?`).get(CONFIG_KEY) as { value: string } | undefined;
    if (row) return row.value === 'true';
  } catch { /* fall through */ }
  return getLoginItemEnabled();
}

function _persistToDb(enabled: boolean): void {
  try {
    const db = getDb();
    db.prepare(
      `INSERT INTO app_config (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
    ).run(CONFIG_KEY, String(enabled));
  } catch { /* non-fatal */ }
}
