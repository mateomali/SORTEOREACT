const { test, expect } = require('@playwright/test');
test.use({ hasTouch: true });
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

function squads() {
  return [0, 1].map(team => ['ARQ', 'DEF', 'DEF', 'MED', 'DEL', 'DEL'].map((pos, i) => ({
    id: team * 10 + i + 1, nombre: `Jugador ${team}-${i}`, posicion: pos,
    assigned_position: pos, puntuacion: 4, selected: true,
  })));
}
async function openFixture(page, { mobile = false, reserved = false, mode = 'sorteo' } = {}) {
  await page.setViewportSize({ width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 });
  const initialTeams = squads();
  if (reserved) initialTeams[0][3].is_substitute = 1;
  const payload = { mode, matchId: 188, initialTeams, players: initialTeams.flat(), numTeams: 2, teamColors: ['ROSA', 'AZUL'], hasSavedDraw: true, links: { back: 'bench-fixture.php' } };
  await page.route('**/bench-fixture.php', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><link rel="stylesheet" href="/assets/tailwind.css"></head><body class="page-sorteo-legacy"><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.goto(`${BASE_URL}/bench-fixture.php`);
  await expect(page.locator('[data-sorteo-drag-player]')).toHaveCount(reserved ? 11 : 12);
}
const card = (page, id) => page.locator(`[data-sorteo-drag-player][data-player-key="${id}"]`);

test('mobile bench reorganizes midfield, restores players and supports undo', async ({ page }) => {
  await openFixture(page, { mobile: true });
  await card(page, 4).tap();
  await page.getByRole('region', { name: 'Mover o intercambiar jugador' }).getByRole('button', { name: 'Enviar al banco' }).click();
  await expect(card(page, 4)).toHaveCount(0);
  await expect(page.locator('[data-bench-player="4"]')).toBeVisible();
  await page.screenshot({ path: 'test-results/sorteo-bench-mobile.png', fullPage: true });
  await expect(page.locator('[data-team-index="0"][data-assigned-position="MED"]')).not.toHaveCount(0);
  await expect(page.locator('[data-team-index="0"][data-assigned-position="ARQ"]')).toHaveCount(1);
  await expect(page.locator('[data-sorteo-drag-player][data-team-index="0"]')).toHaveCount(5);
  await page.locator('[data-bench-player="4"]').getByRole('button', { name: 'Ingresar' }).click();
  await expect(card(page, 4)).toHaveCount(1);
  await expect(page.locator('[data-bench-player]')).toHaveCount(0);
  await page.locator('[data-sorteo-team-card][data-team-index="0"]').getByRole('button', { name: 'Deshacer ultimo cambio' }).click();
  await expect(page.locator('[data-bench-player="4"]')).toBeVisible();
  await page.locator('[data-sorteo-team-card][data-team-index="0"]').getByRole('button', { name: 'Deshacer ultimo cambio' }).click();
  await expect(card(page, 4)).toHaveCount(1);
  await expect(page.locator('[data-bench-player]')).toHaveCount(0);
});

test('desktop goalkeeper can go to bench and draw save retains the full roster', async ({ page }) => {
  await openFixture(page);
  await card(page, 1).click();
  await page.getByRole('button', { name: 'Enviar al banco', exact: true }).click();
  await expect(page.locator('[data-bench-player="1"]')).toBeVisible();
  await expect(page.locator('[data-team-index="0"][data-assigned-position="ARQ"]')).toHaveCount(1);
  let posted;
  await page.route('**/guardar_sorteo.php', async route => {
    posted = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true, message: 'Guardado' } });
  });
  await page.locator('#download-controls').getByRole('button', { name: /Guardar/ }).click();
  await expect.poll(() => posted?.teams?.[0]?.players?.length).toBe(6);
  expect(posted.teams[0].players.filter(p => p.is_substitute).map(p => p.id)).toEqual([1]);
  expect(posted.teams[0].players.filter(p => !p.is_substitute && p.assigned_position === 'ARQ')).toHaveLength(1);
});

test('saved reserves reload in formation editor and are included in formation save', async ({ page }) => {
  await openFixture(page, { reserved: true, mode: 'formation_editor' });
  await expect(page.locator('[data-bench-player="4"]')).toBeVisible();
  let posted;
  await page.route('**/finalizar_partido.php?**', async route => {
    posted = route.request().postData();
    await route.fulfill({ json: { ok: true } });
  });
  await page.locator('#download-controls').getByRole('button', { name: /Guardar/ }).click();
  await expect.poll(() => posted).toContain('name="player_substitute[4]"\r\n\r\n1');
  expect(posted).toContain('name="player_team[4]"\r\n\r\n1');
});
