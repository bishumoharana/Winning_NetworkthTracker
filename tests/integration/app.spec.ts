/**
 * Integration smoke test — launches the built Electron app and verifies
 * the UI renders correctly.
 *
 * Requires the app to be built first:
 *   npm run build:all
 *
 * Run with:
 *   npm run test:integration
 */
import { test, expect, _electron as electron } from '@playwright/test';
import * as path from 'path';

const BUILT_MAIN = path.join(__dirname, '../../build/main/main.js');

test.describe('Network Tracker — smoke tests', () => {
  test('app launches and dashboard tab is visible', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();

    // Wait for the renderer to hydrate
    await page.waitForLoadState('domcontentloaded');

    // Dashboard heading should be present
    const heading = page.locator('text=Network Monitor');
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await app.close();
  });

  test('all 6 navigation tabs are present', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    const expectedTabs = ['Dashboard', 'Charts', 'Alerts', 'Export', 'Settings', 'History'];
    for (const tab of expectedTabs) {
      await expect(page.locator(`text=${tab}`).first()).toBeVisible({ timeout: 8_000 });
    }

    await app.close();
  });

  test('live metric rows appear within 5 seconds', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // At least one adapter card / row should appear as polling starts
    const metricRow = page.locator('[data-testid="adapter-card"]').first();
    await expect(metricRow).toBeVisible({ timeout: 5_000 });

    await app.close();
  });

  test('clicking Charts tab shows the charts panel', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('text=Charts').first().click();
    const chartsHeading = page.locator('text=Speed Over Time');
    await expect(chartsHeading).toBeVisible({ timeout: 5_000 });

    await app.close();
  });

  test('clicking Alerts tab shows the alerts settings panel', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('text=Alerts').first().click();
    const alertsHeading = page.locator('text=Alert Settings');
    await expect(alertsHeading).toBeVisible({ timeout: 5_000 });

    await app.close();
  });

  test('clicking Export tab shows the export panel', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('text=Export').first().click();
    const exportHeading = page.locator('text=Export Metrics');
    await expect(exportHeading).toBeVisible({ timeout: 5_000 });

    await app.close();
  });

  test('clicking History tab shows the history panel', async () => {
    const app = await electron.launch({ args: [BUILT_MAIN] });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    await page.locator('text=History').first().click();
    const historyHeading = page.locator('text=Bandwidth History');
    await expect(historyHeading).toBeVisible({ timeout: 5_000 });

    await app.close();
  });
});
