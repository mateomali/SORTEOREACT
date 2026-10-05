const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const policy = fs.readFileSync('assets/player-rating-policy.json', 'utf8');

test('newly generated teams allow drag and detail exchanges', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const roles = ['ARQ', 'DEF', 'DEF/LAT', 'LAT/MED', 'MED', 'MED/DEL', 'DEL', 'DEL', 'DEF/MED'];
  const players = [0, 1].flatMap(team => roles.map((positions, index) => ({
    id: team * 10 + index + 1, name: `Jugador ${team * 10 + index + 1}`, positions,
    skill: 3.5, regularity: 3.5, rhythm: 3.5, selected: true,
  })));
  const payload = { players, initialTeams: [], numTeams: 2, teamColors: ['ROSA', 'AZUL'], links: {}, mode: 'draw' };
  await page.route('**/__generated_exchange', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><link rel="stylesheet" href="/assets/tailwind.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.goto('http://127.0.0.1:8000/__generated_exchange');
  await page.locator('#generateTeamsButton').click();
  const cards = team => page.locator(`[data-sorteo-drag-player][data-team-index="${team}"]:not([data-assigned-position="ARQ"])`);
  await expect(cards(0).first()).toBeVisible({ timeout: 60000 });
  for (const team of await page.locator('[data-sorteo-team-card]').all()) await expect(team.locator('select').filter({has:page.locator('option[value="highest-score"]')})).toHaveValue('balanced-teams');
  const signature = () => page.locator('[data-sorteo-team-card]').evaluateAll(nodes => nodes.map(node => [...node.querySelectorAll('[data-sorteo-drag-player]')].map(player => player.dataset.playerKey).sort().join(',')).sort().join('|'));
  const seen = new Set([await signature()]);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('#generateTeamsButton')).toBeEnabled({timeout:60000});
    const next = await signature();
    expect(seen.has(next)).toBe(false);
    seen.add(next);
    const totals = await page.locator('.gf-premium-score strong').allTextContents();
    const points = totals.map(Number);
    expect(Math.max(...points) - Math.min(...points)).toBeLessThanOrEqual(2);
  }
  const source = cards(0).first(), target = cards(1).first();
  const key = await source.getAttribute('data-player-key');
  const targetKey = await target.getAttribute('data-player-key');
  await source.scrollIntoViewIfNeeded(); await target.scrollIntoViewIfNeeded();
  const a = await source.boundingBox(), b = await target.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 20 });
  await page.mouse.up();
  const card = id => page.locator(`[data-sorteo-drag-player][data-player-key="${id}"]`);
  await expect(card(key)).toHaveAttribute('data-team-index', '1');
  await expect(card(targetKey)).toHaveAttribute('data-team-index', '0');
  await card(key).dblclick();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /Bloquear en/ })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Desbloquear posicion', exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Todos', exact: true }).click();
  const destination = dialog.locator('[data-exchange-player]:enabled').first();
  await expect(destination).toBeVisible();
  await destination.click();
  await expect(card(key)).toHaveAttribute('data-team-index', '0');
});
