const { test, expect } = require('@playwright/test');

test('match 232 exposes player analysis in the draw screen on desktop and mobile', async ({ page }) => {
  test.setTimeout(90000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:8000/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D232');
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: 'Entrar como admin', exact: true }).click();
  await expect(page).toHaveURL(/sorteo_legacy_csv.php\?match_id=232/);
  if (!await page.locator('.team-formation').count()) {
    await page.locator('#generateTeamsButton').click();
  }
  const button = page.getByRole('button', { name: 'Analizar equipos', exact: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(button).toBeVisible({ timeout: 60000 });
    await button.click();
    const panel = page.locator('[data-sorteo-analysis]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Comparativa jugador por jugador', { exact: true })).toBeVisible();
    const comparison = panel.locator('[data-player-equivalents]');
    await expect(comparison.locator('tbody tr').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: `outputs/player-analysis-232-${width}.png` });
    await page.getByRole('button', { name: 'Ocultar análisis', exact: true }).click();
    await expect(panel).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
