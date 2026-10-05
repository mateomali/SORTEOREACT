const { test, expect } = require('@playwright/test');

for (const width of [1440, 390, 320]) test(`participant search stays visible and clears after adding at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('http://127.0.0.1:8000/login.php?next=crear_partido.php');
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: 'Entrar como admin' }).click();
  await page.getByRole('button', { name: 'Continuar a jugadores', exact: true }).click();
  const search = page.locator('#participantSearchReact');
  await expect(search).toBeInViewport();
  const name = await page.locator('[data-player-row]').first().locator('strong').innerText();
  await search.fill(name);
  await expect(page.locator('[data-player-row]:visible').first()).toContainText(name);
  for (const row of await page.locator('[data-player-row]:visible').all()) {
    expect((await row.locator('strong').innerText()).toLowerCase()).toContain(name.toLowerCase());
  }
  await page.locator('[data-player-row]:visible').first().locator('[data-participant-toggle]').click();
  await expect(search).toHaveValue('');
  await expect(search).toBeFocused();
  await expect(search).toBeInViewport();
  await search.fill('zzzz-sin-coincidencias');
  await expect(page.locator('[data-player-row]:visible')).toHaveCount(0);
  await expect(page.locator('[data-participant-empty]')).toBeVisible();
  await search.fill('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `outputs/participant-search-fixed-${width}.png`, fullPage: true });
});
