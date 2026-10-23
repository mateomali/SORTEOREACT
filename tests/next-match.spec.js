const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const fixture = (action, id) => execFileSync('php', ['tests/draw-pots-fixture.php', action, ...(id ? [String(id)] : [])], { encoding: 'utf8' }).trim();

for (const width of [390, 1366]) {
  test(`next match roster without teams or voting and menu order at ${width}`, async ({ page }) => {
    const id = Number(fixture('create'));
    try {
      await page.setViewportSize({ width, height: 950 });
      await page.goto(`${BASE}/propuestas_equipos.php?match_id=${id}`);
      await expect(page.locator('.proposal-back')).toHaveText('Próximo partido');
      const roster = page.getByRole('region', { name: 'Jugadores convocados' });
      await expect(roster.locator('li')).toHaveCount(10);
      await expect(roster).toContainText('Todavía no se armaron los equipos oficiales.');
      await expect(page.locator('.proposal-page')).toContainText('todavía no tiene una votación');
      if (width < 761) await page.locator('#menuToggle').click();
      const nav = page.locator('#mainNav');
      expect(await nav.locator(':scope > a, :scope > details > summary').allTextContents().then(labels => labels.map(label => label.replace(/[\s✓▾]+/g, ' ').trim()))).toEqual(['Inicio', 'Iniciar sesión', 'Jugadores', 'Fechas']);
      await nav.locator('summary').filter({ hasText: 'Fechas' }).click();
      await expect(nav.locator('details').filter({ has: page.locator('summary', { hasText: 'Fechas' }) }).getByRole('link', { name: 'Próximo partido', exact: true })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Historial', exact: true })).toBeVisible();
      if (width < 761) await page.keyboard.press('Escape');
      await page.screenshot({ path: `outputs/next-match-roster-${width}.png`, fullPage: true });
    } finally { fixture('delete', id); }
  });
}
