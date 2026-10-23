const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const fixture = (action, ...args) => execFileSync('php', ['tests/live-matches-fixture.php', action, ...args.map(String)], { encoding: 'utf8' }).trim();
async function login(page) {
  await page.goto(`${BASE}/login.php?next=editar_partidos.php`);
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: 'Entrar como admin', exact: true }).click();
  await page.waitForURL('**/editar_partidos.php');
}

test('saved goals can be removed before preparing the next match', async ({ page }) => {
  const data = JSON.parse(fixture('create', 3));
  try {
    await login(page);
    await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
    await page.getByRole('button', { name: 'Preparar primer partido' }).click();
    await page.getByRole('button', { name: '+ Agregar gol', exact: true }).first().click();
    await page.getByRole('button', { name: 'Guardar gol', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Finalizar partido', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar y finalizar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Corregir resultado', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Quitar', exact: true }).click();
    await page.getByRole('dialog').getByRole('radio').last().check();
    await page.getByRole('dialog').getByRole('button', { name: 'Quitar gol', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel(/Goles de .*: 0/)).toHaveCount(2);
    const saved = JSON.parse(fixture('inspect', data.id));
    expect(saved.session.state.games[0].goals).toHaveLength(0);
    expect(saved.session.state.games[0].status).toBe('finished');
    expect(saved.teams.reduce((sum, team) => sum + Number(team.goals), 0)).toBe(0);
    await page.getByRole('button', { name: 'Preparar próximo partido' }).click();
    await expect(page.getByRole('heading', { name: 'Partido 2', exact: true })).toBeVisible();
    expect(JSON.parse(fixture('inspect', data.id)).session.state.games[1].teams).toContain(saved.session.state.games[0].teams[1]);
  } finally { fixture('delete', data.id); }
});
test('live scoring, persisted clock, bulk attribution, conflicts and closing from mobile', async ({ page, context }) => {
  const data = JSON.parse(fixture('create', 3));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto(`${BASE}/finalizar_partido.php?match_id=${data.id}&show_score=1`);
    await expect(page).toHaveURL(new RegExp(`partidos_en_vivo.php\\?match_id=${data.id}`));
    await page.getByRole('button', { name: 'Preparar primer partido' }).click();
    await expect(page.getByRole('heading', { name: 'Partido 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Comenzar partido', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
    fixture('overtime', data.id);
    await page.reload();
    await expect(page.getByRole('timer')).toContainText('−00:');
    await expect(page.getByText('Tiempo extra', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
    const paused = await page.getByRole('timer').textContent();
    await page.waitForTimeout(1100);
    expect(await page.getByRole('timer').textContent()).toBe(paused);
    await page.getByRole('button', { name: 'Fixture', exact: true }).click();
    await expect(page.getByRole('timer')).toContainText('−00:');
    await page.getByRole('button', { name: 'Ir al partido', exact: true }).click();
    await page.getByRole('button', { name: '+ Agregar gol', exact: true }).first().click();
    await page.getByRole('dialog').getByText('Gol en contra', { exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(0);
    await expect(page.getByRole('searchbox', { name: 'Buscar goleador' })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Gol en contra', exact: true }).uncheck();
    const opponent = data.players.find((p) => Number(p.team_number) === 2);
    const teammate = data.players.find((p) => Number(p.team_number) === 1);
    await page.getByRole('searchbox', { name: 'Buscar goleador' }).fill('zzzzsincoincidencias');
    await expect(page.getByRole('dialog')).toContainText('No hay jugadores con ese nombre.');
    await page.getByRole('searchbox', { name: 'Buscar goleador' }).fill(teammate.name);
    await expect(page.getByRole('radio', { name: teammate.name, exact: true })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar goleador' }).fill('');
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 700 });
      const saveBox = await page.getByRole('button', { name: 'Guardar gol', exact: true }).boundingBox();
      expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(700);
      await page.getByRole('dialog').screenshot({ path: `outputs/live-add-goal-${width}.png` });
    }
    await page.getByRole('radio', { name: teammate.name, exact: true }).check();
    await page.getByRole('checkbox', { name: 'Gol en contra', exact: true }).check();
    await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(0);
    await page.getByRole('button', { name: 'Guardar gol', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel(/Goles de .*: 1/)).toBeVisible();
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const button of await page.locator('.live-goal-action').all()) {
        const box = await button.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
      await page.locator('.live-events').screenshot({ path: `outputs/live-goal-actions-${width}.png` });
    }
    await page.screenshot({ path: 'outputs/live-matches-mobile-active.png', fullPage: true });
    await page.getByText('Cargar resultado al finalizar', { exact: true }).click();
    await page.locator('input[name="2"]').fill('1');
    await page.getByRole('button', { name: 'Guardar marcador', exact: true }).click();
    await expect(page.getByLabel(/Goles de .*: 1/)).toHaveCount(2);
    await page.getByRole('button', { name: 'Finalizar partido', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('¿Qué equipo marcó primero?');
    await page.getByRole('dialog').getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Guardar y finalizar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const session = JSON.parse(fixture('inspect', data.id));
    expect(session.players.find((p) => Number(p.id) === Number(opponent.id)).goals).toBe(0);
    expect(session.session.state.games[0].goals[0]).toMatchObject({ own: true, player: null });
    await page.getByRole('button', { name: 'Asignar', exact: true }).click();
    await page.getByRole('radio', { name: opponent.name, exact: true }).check();
    await page.getByRole('button', { name: 'Guardar goleador', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({ path: 'outputs/live-matches-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Stale revision must reject a duplicate write without silently retrying it.
    const conflict = await page.evaluate(async ({ id }) => {
      const root = document.querySelector('[data-react-island="live_matches"]');
      const payload = JSON.parse(root.dataset.payload);
      const endpoint = `partidos_en_vivo.php?match_id=${id}&api=1`;
      const latest = await (await fetch(endpoint)).json();
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': payload.csrf }, body: JSON.stringify({ action: 'next', revision: latest.session.revision - 1 }) });
      return response.status;
    }, { id: data.id });
    expect(conflict).toBe(409);
    await page.getByRole('button', { name: 'Preparar próximo partido' }).click();
    await expect(page.getByRole('heading', { name: 'Partido 2', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Finalizar partido', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(0);
    await page.getByRole('button', { name: 'Guardar y finalizar', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Finalizar fecha', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Todavía quedan 4 partidos');
    await page.getByRole('dialog').getByRole('button', { name: 'Finalizar fecha', exact: true }).click();
    await expect(page.getByText('Fecha finalizada.', { exact: true })).toBeVisible();
    const final = JSON.parse(fixture('inspect', data.id));
    expect(final.match.status).toBe('finalizado');
    expect(final.teams.reduce((n, t) => n + Number(t.goals), 0)).toBe(2);
    expect(final.players.find((p) => Number(p.id) === Number(opponent.id)).goals).toBe(1);
    expect(fixture('award-test', data.id)).toContain('OK');
    await page.getByRole('button', { name: 'Fixture', exact: true }).click();
    await expect(page.getByText('Ver goles y criterio del cruce', { exact: true })).toHaveCount(0);
    const fixtureGoals = page.locator('.live-fixture-list .live-goal-list');
    await expect(fixtureGoals).toHaveCount(2);
    await expect(fixtureGoals.last()).toContainText(opponent.name);
    await expect(fixtureGoals.first()).toContainText('Gol en contra');
    await expect(page.locator('.live-fixture-scorers').first()).not.toContainText('Cargado al finalizar');
    await expect(page.locator('.live-fixture-scorers').first()).not.toContainText('′');
    for (const width of [320, 390, 760, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.locator('.live-fixture-game').first().screenshot({ path: `outputs/live-fixture-hierarchy-${width}.png` });
    }
    await page.getByRole('button', { name: 'Corregir resultado', exact: true }).first().click();
    // A closed date retains its fixture; correcting a score needs no new tie priority.
    await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(0);
    await page.getByRole('button', { name: 'Guardar corrección', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.goto(`${BASE}/finalizar_partido.php?match_id=${data.id}&edit_details=1`);
    await expect(page.getByRole('link', { name: 'Abrir partidos en vivo' })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { fixture('delete', data.id); }
});

test('four-team fixture completes twelve games and permits individual extras', async ({ page }) => {
  const data = JSON.parse(fixture('create', 4));
  try {
    await login(page);
    await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
    await page.getByRole('button', { name: 'Preparar primer partido' }).click();
    for (let i = 0; i < 12; i++) {
      await expect(page.getByRole('heading', { name: `Partido ${i + 1}`, exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Finalizar partido', exact: true }).click();
      if (i === 0) await page.getByRole('dialog').getByRole('radio').first().check();
      else await expect(page.getByRole('dialog').getByRole('radio')).toHaveCount(0);
      await page.getByRole('button', { name: 'Guardar y finalizar', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      if (i < 11) await page.getByRole('button', { name: 'Preparar próximo partido' }).click();
    }
    await page.getByRole('button', { name: 'Fixture', exact: true }).click();
    await expect(page.locator('.live-pair-progress')).toContainText('2 / 2');
    expect(await page.locator('.live-pair-progress > div').count()).toBe(6);
    await page.screenshot({ path: 'outputs/live-matches-desktop-fixture.png', fullPage: true });
    await page.getByRole('button', { name: 'Partido', exact: true }).click();
    await page.getByRole('button', { name: '+ Agregar un partido', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Partido 13 · Adicional', exact: true })).toBeVisible();
    await page.screenshot({ path: 'outputs/live-matches-desktop-active.png', fullPage: true });
    const session = JSON.parse(fixture('inspect', data.id)).session;
    expect(session.state.games[12].teams).toEqual(session.state.games[0].teams);
  } finally { fixture('delete', data.id); }
});

test('directivos operate live matches, CSRF is enforced, and legacy dates keep their fixture', async ({ page, context }) => {
  const data = JSON.parse(fixture('create', 3));
  try {
    const cookie = JSON.parse(fixture('director-session', data.id));
    await context.addCookies([{ ...cookie, url: BASE }]);
    await page.goto(`${BASE}/editar_partidos.php?focus_match=${data.id}`);
    await expect(page.getByRole('link', { name: 'Partidos en vivo', exact: true }).first()).toBeVisible();
    await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
    await page.getByRole('button', { name: 'Preparar primer partido' }).click();
    await page.getByRole('button', { name: 'Comenzar partido', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
    const denied = await page.request.post(`${BASE}/partidos_en_vivo.php?match_id=${data.id}&api=1`, { data: { action: 'pause', revision: 2 } });
    expect(denied.status()).toBe(403);
    expect(JSON.parse(fixture('inspect', data.id)).session.revision).toBe(2);
    // A different administrator can see the same live state immediately.
    await context.clearCookies();
    await login(page);
    fixture('legacy', data.id);
    await page.goto(`${BASE}/finalizar_partido.php?match_id=${data.id}`);
    await expect(page).toHaveURL(new RegExp(`finalizar_partido.php\\?match_id=${data.id}`));
    await expect(page.locator('[data-round-robin-form]')).toBeVisible();
    await expect(page.locator('[data-round-robin-legs-toggle]')).toBeVisible();
    await page.goto(`${BASE}/configuracion.php`);
    await expect(page.locator('[name="game_duration_minutes_default"]')).toHaveValue('10');
    await page.goto(`${BASE}/crear_partido.php`);
    await expect(page.locator('[name="game_duration_minutes"]')).toHaveValue('10');
  } finally { fixture('delete', data.id); }
});

test('new date creation saves the dynamic mode and its own duration', async ({ page }) => {
  const data = JSON.parse(fixture('create', 3));
  let createdId;
  try {
    await login(page);
    const form = new URLSearchParams({ action: 'save_match', id: '0', title: 'Temporary live matches validation', match_date: '2026-12-20T21:00', num_teams: '3', players_per_team: '2', valuation_mode: 'both', game_duration_minutes: '12' });
    data.players.forEach((p) => form.append('participants[]', String(p.id)));
    ['VERDE', 'NEGRO', 'NARANJA'].forEach((kit) => form.append('team_kits[]', kit));
    const response = await page.request.post(`${BASE}/crear_partido.php`, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, data: form.toString() });
    createdId = Number(new URL(response.url()).searchParams.get('focus_match'));
    expect(createdId).toBeGreaterThan(0);
    const created = JSON.parse(fixture('inspect', createdId));
    expect(Number(created.match.dynamic_fixture)).toBe(1);
    expect(Number(created.match.game_duration_minutes)).toBe(12);
    expect(created.session.state.duration).toBe(720);
  } finally {
    if (createdId) fixture('delete-date-only', createdId);
    fixture('delete', data.id);
  }
});

test('an open scoring dialog cannot overwrite changes received from another screen', async ({ page }) => {
  const data = JSON.parse(fixture('create', 3));
  try {
    await login(page);
    await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
    await page.getByRole('button', { name: 'Preparar primer partido' }).click();
    await expect(page.getByRole('heading', { name: 'Partido 1', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '+ Agregar gol', exact: true }).first().click();
    const csrf = await page.locator('[data-react-island="live_matches"]').getAttribute('data-payload').then((raw) => JSON.parse(raw).csrf);
    const external = await page.request.post(`${BASE}/partidos_en_vivo.php?match_id=${data.id}&api=1`, { headers: { 'X-CSRF-Token': csrf }, data: { action: 'goal', revision: 1, team: 2 } });
    expect(external.status()).toBe(200);
    await expect(page.getByLabel(/Goles de .*: 1/)).toBeVisible({ timeout: 7000 });
    await page.getByRole('button', { name: 'Guardar gol', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Otra pantalla');
    const state = JSON.parse(fixture('inspect', data.id)).session.state;
    expect(state.games[0].goals).toHaveLength(1);
    expect(state.games[0].goals[0].team).toBe(2);
  } finally { fixture('delete', data.id); }
});
