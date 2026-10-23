const { test, expect } = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
for (const width of [1366, 390]) {
  test(`directory awards podiums and scorers at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/jugadores2.php`);
    const payload = await page.locator('[data-react-island="jugadores2_page"]').evaluate(node => JSON.parse(node.dataset.payload));
    const tabs = page.getByRole('tablist', { name: 'Secciones de jugadores' });
    await tabs.getByRole('tab', { name: 'Premios', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'Premios', exact: true });
    await expect(panel).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Buscar jugador' })).toBeHidden();
    expect(payload.awardLeaderboards.length).toBeGreaterThan(0);
    for (const category of payload.awardLeaderboards) {
      const podium = panel.getByRole('table', { name: `Podio de ${category.label}`, exact: true });
      const leaders = category.entries.filter(entry => entry.position <= 3);
      await expect(podium.locator('tbody tr')).toHaveCount(leaders.length);
      for (const [index, entry] of leaders.entries()) {
        const row = podium.locator('tbody tr').nth(index);
        await expect(row.locator('td').nth(0)).toContainText(`${entry.position}.º`);
        if (entry.position === 1) await expect(row.locator('td').nth(1).locator('strong')).toHaveText(entry.name);
        await expect(row.locator('td').nth(1)).toContainText(entry.name);
        await expect(row.locator('td').nth(2)).toHaveText(String(category.usesPoints ? entry.points : entry.count));
      }
      for (const entry of category.entries) {
        expect(entry.matches.length).toBe(entry.count);
        expect(entry.matches.reduce((sum, match) => sum + match.points, 0)).toBe(entry.points);
      }
      const entry = leaders[0];
      const trigger = podium.getByRole('button', { name: `Ver premios de ${entry.name} en ${category.label}`, exact: true });
      await trigger.click();
      const history = page.getByRole('dialog', { name: `Fechas de ${category.label}`, exact: true });
      await expect(history).toBeVisible();
      await expect(history).toContainText(entry.name);
      await expect(history.locator('tbody tr')).toHaveCount(entry.count);
      for (const [index, match] of entry.matches.entries()) {
        const row = history.locator('tbody tr').nth(index);
        await expect(row).toContainText(match.dateLabel);
        await expect(row).toContainText(match.title);
        if (category.usesPoints) await expect(row.locator('td').last()).toContainText(`${match.points} ${match.points === 1 ? 'punto' : 'puntos'}`);
      }
      expect(await history.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.keyboard.press('Escape');
      await expect(history).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    const category = payload.awardLeaderboards.find(category => category.entries.length > 3);
    const section = panel.getByRole('region', { name: `Podio de ${category.label}`, exact: true });
    await section.locator('summary').click();
    await expect(section.getByRole('table', { name: `Ranking completo de ${category.label}`, exact: true }).locator('tbody tr')).toHaveCount(category.entries.length);
    const last = category.entries.at(-1);
    await section.getByRole('table', { name: `Ranking completo de ${category.label}`, exact: true }).getByRole('button', { name: `Ver premios de ${last.name} en ${category.label}`, exact: true }).click();
    await expect(page.getByRole('dialog').locator('tbody tr')).toHaveCount(last.count);
    await page.getByRole('button', { name: 'Cerrar fechas del premio', exact: true }).click();
    await section.locator('summary').click();
    const scorers = panel.getByRole('table', { name: 'Tabla de goleadores', exact: true });
    await expect(scorers.locator('tbody tr')).toHaveCount(payload.scorers.length);
    await expect(scorers.locator('tbody tr').nth(0)).toContainText('MARIAN');
    await expect(scorers.locator('tbody tr').nth(0).locator('td').last()).toHaveText('62');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: `outputs/players-awards-tab-${width}.png` });
    await tabs.getByRole('tab', { name: 'Jugadores', exact: true }).click();
    await expect(page.getByRole('searchbox', { name: 'Buscar jugador' })).toBeVisible();
  });
}
