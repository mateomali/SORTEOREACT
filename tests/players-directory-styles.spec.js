const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

test('players directory loads its styles on the first partial visit', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto(`${BASE_URL}/index.php`);
  await page.waitForFunction(() => typeof window.goodfellasPartialNavigate === 'function');
  await page.evaluate(() => { window.__directoryVisit = true; });
  await page.evaluate(() => window.goodfellasPartialNavigate('jugadores2.php'));
  await expect(page.locator('.players-directory-table .directory-avatar').first()).toBeVisible();
  expect(await page.evaluate(() => window.__directoryVisit)).toBe(true);
  const metrics = () => page.locator('.players-directory-table .directory-avatar').first().evaluate((avatar) => {
    const style = getComputedStyle(avatar);
    return { width: style.width, height: style.height, overflow: style.overflow };
  });
  const initial = await metrics();
  expect(initial).toEqual({ width: '56px', height: '64px', overflow: 'hidden' });
  await page.reload();
  await expect(page.locator('.players-directory-table .directory-avatar').first()).toBeVisible();
  expect(await metrics()).toEqual(initial);
});
