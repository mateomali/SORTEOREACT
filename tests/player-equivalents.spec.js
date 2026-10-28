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
    const pace = panel.locator('[data-pace-explanation]');
    await expect(pace).toBeVisible();
    await expect(pace.locator('[data-pace-team]')).toHaveCount(2);
    await expect(pace.locator('[data-pace-verdict]')).toContainText('Justificación del reparto actual');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await panel.screenshot({ path: `outputs/player-analysis-232-${width}.png` });
    await page.getByRole('button', { name: 'Ocultar análisis', exact: true }).click();
    await expect(panel).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});

test('pace explanation uses effective speed and excludes goalkeepers', async ({ page }) => {
  const fs = require('node:fs');
  const roles = ['ARQ', 'DEF', 'DEF', 'MED', 'MED', 'DEL', 'DEL'];
  const teams = [0, 1].map(t => roles.map((position, i) => ({
    id: t * 10 + i + 1, name: `Prueba ${t}-${i}`, positions: position,
    assigned_position: position, skill: 4, rhythm: i === 0 ? 1 : i === 1 ? 3 : 5,
    availability_percent: i === 2 ? 50 : 100, regularity: 3.5,
  })));
  const payload = { players: teams.flat(), initialTeams: teams, numTeams: 2, links: {} };
  await page.route('**/__pace_explanation', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><link rel="stylesheet" href="/assets/tailwind.css"></head><body><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${fs.readFileSync('assets/player-rating-policy.json', 'utf8')}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.goto('http://127.0.0.1:8000/__pace_explanation');
  await page.getByRole('button', { name: 'Analizar equipos', exact: true }).click();
  const team = page.locator('[data-pace-team="0"]');
  await expect(team.locator('[data-pace-group="slow"]')).toContainText('Lentos (2)');
  await expect(team.locator('[data-pace-group="slow"]')).toContainText('Prueba 0-1 (3.0)');
  await expect(team.locator('[data-pace-group="slow"]')).toContainText('Prueba 0-2 (2.5)');
  await expect(team.locator('[data-pace-group="slow"]')).not.toContainText('Prueba 0-0');
  await expect(team.locator('[data-pace-group="fast"]')).toContainText('Rápidos (4)');
  await expect(page.locator('[data-pace-verdict]')).toContainText('Todos tienen la misma cantidad de lentos');
});
