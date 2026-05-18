# Changelog

All notable changes to Network Tracker are documented here.
This project follows [Semantic Versioning](https://semver.org/).

---

## [0.1.0] — 2026-05-18

Initial release.

### Added

- **Network adapter detection** — enumerates all active network interfaces on Windows, macOS, and Linux
- **Real-time traffic capture** — 1-second polling of bytes sent/received per adapter using OS-native APIs
- **SQLite persistence** — stores all metrics in a local SQLite database via `better-sqlite3`; auto-migrates schema on launch
- **IPC bridge** — typed context bridge (`preload.ts`) exposes all main-process APIs to the sandboxed renderer
- **Live Dashboard** — per-adapter upload/download speed cards updated every second
- **Historical Charts** — line charts of speed over the last N minutes, filterable by adapter
- **Alerts & Thresholds** — configurable download/upload speed limits; fires OS native notifications with a 60-second per-adapter cooldown
- **System Tray** — minimise-to-tray on window close; live speed tooltip updated every second; context menu with Show/Hide, Alerts toggle, and Quit
- **Export** — download metrics as `.csv` or `.json` filtered by adapter and date range; saved to the OS Downloads folder
- **Bandwidth History & Stats** — daily/weekly/monthly aggregation table showing total bytes, peak speeds, and average speeds per adapter
- **Auto-launch** — optional launch at OS login using `app.setLoginItemSettings` on Windows/macOS and a `.desktop` autostart file on Linux
- **Auto-update** — background update checks via `electron-updater` against GitHub Releases; in-app banner with download progress and one-click restart
- **Cross-platform packaging** — NSIS installer (Windows), DMG + zip (macOS x64/arm64), AppImage + deb (Linux)
- **CI/CD pipeline** — GitHub Actions: lint + test on every push/PR (3-platform matrix); electron-builder packaging on `v*.*.*` tag push

### Internal

- 100+ unit tests across all main-process services (Jest + ts-jest)
- Integration smoke test suite (Playwright + electron-playwright-helpers)
- ESLint + TypeScript strict mode throughout

[0.1.0]: https://github.com/bishumoharana/Winning_NetworkthTracker/releases/tag/v0.1.0
