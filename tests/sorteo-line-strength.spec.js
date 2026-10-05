const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const policy = fs.readFileSync('assets/player-rating-policy.json', 'utf8');

for (const numTeams of [2, 3]) for (const width of [1440, 390, 320]) test(`weaker reinforcement increases line power for ${numTeams} teams at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  const roles = ['ARQ', 'DEF', 'DEF', 'DEF/MED', 'MED', 'DEL', 'DEL'];
  const positions = ['ARQ', 'DEF', 'DEF', 'DEF', 'MED', 'DEL', 'DEL'];
  const teams = Array.from({length: numTeams}, (_, index) => index).map(team => roles.map((role, index) => {
    const value = index === 4 ? 5 : 3;
    return { id: team * 10 + index + 1, name: `Jugador ${team * 10 + index + 1}`,
      positions: role, assigned_position: positions[index], skill: value, technique: value,
      pass_vision: value, defense_physical: value, attack: value, rhythm: value,
      stamina: value, teamwork: value, mentality: value, goalkeeper_skill: value, regularity: 3.5 };
  }));
  const payload = { players: teams.flat(), initialTeams: teams, numTeams, teamColors: ['ROSA', 'AZUL', 'NARANJA'], links: {} };
  await page.route('**/__line_strength', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.goto('http://127.0.0.1:8000/__line_strength');
  const team = page.locator('[data-sorteo-team-card]').first();
  await expect(page.locator('.gf-team-metrics')).toHaveCount(0);
  const analysis = page.locator('.gf-analysis-compact');
  await expect(analysis).not.toHaveAttribute('open', '');
  if (width <= 390) {
    const actions = page.locator('.gf-sticky-save');
    await expect(actions).toBeInViewport();
    await actions.locator('summary').click();
    for (const name of ['Exportar JPG', 'Copiar equipos', 'Descargar texto']) await expect(actions.getByRole('button', {name, exact:true})).toBeInViewport();
    await actions.screenshot({path: `outputs/mobile-actions-${numTeams}-${width}.png`});
    await actions.locator('summary').click();
  }
  const comparison = page.locator('.gf-strength-comparison');
  await expect(comparison).not.toHaveAttribute('open', '');
  await comparison.locator('summary').click();
  const row = comparison.locator('[data-comparison-line="MED"] [data-comparison-team="0"]');
  const meter = row.getByRole('meter');
  await expect(meter).toBeVisible();
  await expect(team.locator('.gf-pitch-direction')).toHaveCount(0);
  await expect(comparison.locator('[data-comparison-line="ARQ"] [role="meter"]')).toHaveCount(numTeams);
  await expect(comparison.getByRole('meter')).toHaveCount(numTeams * 5);
  const lineMeters = comparison.locator('[data-comparison-line]:not([data-comparison-line="TOTAL"]) [role="meter"]');
  const scales = await lineMeters.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-valuemax')));
  expect(new Set(scales).size).toBe(1);
  const before = Number(await meter.getAttribute('aria-valuenow'));
  const quality = async () => Number((await row.locator('.gf-comparison-name small').innerText()).match(/Media (\d+)/)[1]);
  const qualityBefore = await quality();
  await team.locator('summary[aria-label="Ajustar linea MED"]').click();
  await team.getByRole('button', { name: 'Agregar jugador a MED', exact: true }).click();
  await expect.poll(async () => Number(await meter.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
  expect(await quality()).toBeLessThan(qualityBefore);
  await expect(row).toContainText('2 jugadores');
  await expect(row.locator('.gf-comparison-delta')).toHaveAttribute('data-direction', 'up');
  const updatedScales = await lineMeters.evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-valuemax')));
  expect(new Set(updatedScales).size).toBe(1);
  await team.getByRole('button', { name: 'Deshacer ultimo cambio', exact: true }).click();
  await expect(meter).toHaveAttribute('aria-valuenow', String(before));
  await expect(row.locator('.gf-comparison-delta')).toHaveAttribute('data-direction', 'down');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await comparison.screenshot({ path: `outputs/team-comparison-${numTeams}-${width}.png` });
});
