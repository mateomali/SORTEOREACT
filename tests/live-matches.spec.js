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
    await page.reload();
    await expect(page.getByRole('timer')).toContainText('09:');
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
    const paused = await page.getByRole('timer').textContent();
    await page.waitForTimeout(1100);
    expect(await page.getByRole('timer').textContent()).toBe(paused);
    await page.getByRole('button', { name: 'Fixture', exact: true }).click();
    await expect(page.getByRole('timer')).toContainText('09:');
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
for (const count of [2, 3, 4]) {
  test(`public live alerts, permissions and automatic endings with ${count} teams`, async ({ page, browser }) => {
    const data = JSON.parse(fixture('create', count));
    const spectator = await browser.newContext();
    try {
      await login(page);
      await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
      await page.getByRole('button', { name: 'Preparar primer partido' }).click();
      await page.getByRole('button', { name: 'Comenzar partido', exact: true }).click();
      fixture('near-alert', data.id);
      const viewer = await spectator.newPage();
      await viewer.addInitScript(() => { window.__liveSpoken = []; window.speechSynthesis.speak = value => window.__liveSpoken.push(value.text); });
      await viewer.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
      await expect(viewer.getByRole('timer')).toBeVisible();
      await expect(viewer.getByRole('button', { name: 'Pausar', exact: true })).toBeDisabled();
      await expect(viewer.getByRole('button', { name: '+ Agregar gol', exact: true }).first()).toBeDisabled();
      await expect(viewer.getByRole('alert')).toContainText(count === 2 ? 'PRÓXIMA PELOTA AFUERA CAMBIO!!' : 'ÚLTIMO MINUTO', { timeout: 8000 });
      expect(await viewer.evaluate(async id => (await fetch(`partidos_en_vivo.php?match_id=${id}&api=1`, { method: 'POST', body: JSON.stringify({ action: 'pause' }) })).status, data.id)).toBe(403);
      await viewer.getByRole('button', { name: 'Activar avisos sonoros' }).click();
      await expect.poll(() => viewer.evaluate(() => window.__liveSpoken)).toContain(count === 2 ? 'PR\u00d3XIMA PELOTA AFUERA CAMBIO!!' : '\u00daLTIMO MINUTO');
      await page.reload();
      const result = await page.evaluate(async ({ id }) => {
        const payload = JSON.parse(document.querySelector('[data-react-island="live_matches"]').dataset.payload);
        const endpoint = `partidos_en_vivo.php?match_id=${id}&api=1`;
        for (let i = 0; i < 3; i++) {
          const latest = await (await fetch(endpoint)).json();
          const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': payload.csrf }, body: JSON.stringify({ action: 'goal', team: 1, revision: latest.session.revision }) });
          if (!response.ok) throw new Error(await response.text());
        }
        return (await (await fetch(endpoint)).json()).session.state.games[0];
      }, { id: data.id });
      expect(result.status).toBe(count === 2 ? 'playing' : 'finished');
      if (count > 2) expect(result.finish_reason).toBe('three_goals');
      if (count > 2) {
        await page.reload();
        await page.getByRole('button', { name: 'Preparar próximo partido', exact: true }).click();
        await page.getByRole('button', { name: 'Comenzar partido', exact: true }).click();
      }
      fixture('overtime', data.id);
      await viewer.reload();
      await expect(viewer.getByRole('timer')).toContainText('00:00');
      await expect(viewer.getByText('Partido finalizado: se cumplió el tiempo acordado.', { exact: true })).toBeVisible();
      const saved = JSON.parse(fixture('inspect', data.id));
      expect(saved.session.state.games.at(-1).status).toBe('finished');
      expect(saved.session.state.games.at(-1).elapsed).toBe(count === 2 ? 3600 : 600);
      expect(saved.teams.reduce((sum, t) => sum + Number(t.goals), 0)).toBe(3);
    } finally { await spectator.close(); fixture('delete', data.id); }
  });
}

test('two-team result editors preserve live state and support aggregate entry', async ({ page }) => {
  const data = JSON.parse(fixture('create', 2));
  try {
    await login(page);
    await page.goto(`${BASE}/finalizar_partido.php?match_id=${data.id}`);
    await expect(page).toHaveURL(new RegExp(`partidos_en_vivo.php\\?match_id=${data.id}`));
    await page.getByRole('link', { name: 'Cargar goles y premios', exact: true }).click();
    await expect(page.locator('[name="direct_result"]')).toHaveValue('1');
    await page.locator('[name="team_goals[1]"]').fill('2');
    await page.locator('[name="team_goals[2]"]').fill('1');
    await page.locator(`[name="goals[${data.players.find(p => Number(p.team_number) === 1).id}]"]`).fill('2');
    await page.locator(`[name="goals[${data.players.find(p => Number(p.team_number) === 2).id}]"]`).fill('1');
    page.on('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Finalizar fecha con goles y premios', exact: true }).click();
    await expect.poll(() => JSON.parse(fixture('inspect', data.id)).session.state.closed).toBe(true);
    const saved = JSON.parse(fixture('inspect', data.id));
    expect(saved.session.state.summary.team_goals).toMatchObject({ 1: 2, 2: 1 });
    expect(saved.teams.map(team => Number(team.goals))).toEqual([2, 1]);
    await page.goto(`${BASE}/finalizar_partido.php?match_id=${data.id}&edit_details=1`);
    await expect(page.getByRole('link', { name: 'Abrir partidos en vivo' })).toBeVisible();
    await expect(page.locator('[name="team_goals[1]"]')).toHaveCount(0);
    await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
    await expect(page.getByRole('heading', { name: 'Resultado general de la fecha' })).toBeVisible();
  } finally { fixture('delete', data.id); }
});

test('expired bulk draw asks for the first scorer and old two-team writes cannot replace live scores', async ({ page }) => {
  for (const count of [2, 3, 4]) {
    const data = JSON.parse(fixture('create', count));
    try {
      await login(page);
      await page.goto(`${BASE}/partidos_en_vivo.php?match_id=${data.id}`);
      const send = async (action, input = {}) => page.evaluate(async ({ action, input }) => {
        const payload = JSON.parse(document.querySelector('[data-react-island="live_matches"]').dataset.payload);
        const url = `partidos_en_vivo.php?match_id=${payload.matchId}&api=1`;
        const latest = await (await fetch(url)).json();
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': payload.csrf }, body: JSON.stringify({ action, ...input, revision: latest.session.revision }) });
        return { status: response.status, data: await response.json() };
      }, { action, input });
      expect((await send('next', { teams: [1, 2] })).status).toBe(200);
      if (count > 2) expect((await send('set_score', { scores: { 1: 3, 2: 3 } })).status).toBe(422);
      expect((await send('set_score', { scores: { 1: 1, 2: 1 } })).status).toBe(200);
      expect((await send('start')).status).toBe(200);
      fixture('overtime', data.id);
      await page.reload();
      if (count > 2) {
        expect((await send('next')).status).toBe(422);
        await expect(page.getByText(/Empate:.*primer gol/)).toBeVisible();
        await page.locator('.live-notice').filter({ hasText: /Empate:.*primer gol/ }).getByRole('button').last().click();
        await expect.poll(() => JSON.parse(fixture('inspect', data.id)).session.state.games[0].tie_choice).toBe(2);
        const next = await send('next');
        expect(next.status).toBe(200);
        if (count === 3) expect(next.data.session.state.games[1].teams).toContain(2);
      } else {
        expect((await send('correct_game', { game: 0, scores: { 1: 0, 2: 0 } })).status).toBe(200);
        const before = JSON.parse(fixture('inspect', data.id));
        await page.request.post(`${BASE}/finalizar_partido.php`, { form: { action: 'save_score', match_id: String(data.id), 'team_goals[1]': '9', 'team_goals[2]': '9' } });
        const after = JSON.parse(fixture('inspect', data.id));
        expect(after.session).toEqual(before.session);
        expect(after.teams.map(team => Number(team.goals))).toEqual([0, 0]);
        await page.goto(`${BASE}/finalizar_partido.php?match_id=${data.id}&direct_result=1`);
        await expect(page).toHaveURL(new RegExp(`partidos_en_vivo.php\\?match_id=${data.id}`));
      }
    } finally { fixture('delete', data.id); }
  }
});

for (const count of [3, 4]) {
  test(`home and Fechas expose started ${count}-team tournaments with role permissions`, async ({ page, browser }) => {
    test.setTimeout(90000);
    const data = JSON.parse(fixture('create', count));
    const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const player = await browser.newContext();
    const director = await browser.newContext();
    const link = `partidos_en_vivo.php?match_id=${data.id}`;
    try {
      await login(page);
      await page.goto(`${BASE}/${link}`);
      await page.getByRole('button', { name: 'Preparar primer partido' }).click();
      const viewer = await guest.newPage();
      await viewer.goto(`${BASE}/index.php`);
      await expect(viewer.locator(`main a[href="${link}"]`).filter({ hasText: 'Seguimiento en vivo' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Comenzar partido', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
      await viewer.reload();
      await expect(viewer.locator(`main a[href="${link}"]`).filter({ hasText: 'Seguimiento en vivo' })).toBeVisible();
      await viewer.locator('#menuToggle').click();
      await viewer.locator('#mainNav summary').filter({ hasText: /^Fechas/ }).click();
      await expect(viewer.locator('#mainNav a[href="seguimiento_en_vivo.php"]')).toBeVisible();
      await viewer.locator('#mainNav a[href="seguimiento_en_vivo.php"]').click();
      if (!viewer.url().includes(link)) await viewer.locator(`a[href="${link}"]`).filter({ hasText: /Temporary/ }).click();
      await expect(viewer.getByRole('timer')).toBeVisible();
      await expect(viewer.getByRole('button', { name: 'Pausar', exact: true })).toBeDisabled();
      const blocked = await viewer.request.post(`${BASE}/${link}&api=1`, { data: { action: 'pause' } });
      expect(blocked.status()).toBe(403);
      await player.addCookies([{ ...JSON.parse(fixture('player-session', data.id)), url: BASE }]);
      const playerPage = await player.newPage();
      await playerPage.goto(`${BASE}/${link}`);
      await expect(playerPage.getByRole('button', { name: 'Pausar', exact: true })).toBeDisabled();
      expect((await playerPage.request.post(`${BASE}/${link}&api=1`, { data: { action: 'pause' } })).status()).toBe(403);
      await expect(playerPage.getByRole('link', { name: 'Volver al inicio', exact: true })).toBeVisible();
      await director.addCookies([{ ...JSON.parse(fixture('director-session', data.id)), url: BASE }]);
      const directorPage = await director.newPage();
      await directorPage.goto(`${BASE}/${link}`);
      await expect(directorPage.getByRole('button', { name: 'Pausar', exact: true })).toBeEnabled();
      await directorPage.getByRole('button', { name: 'Pausar', exact: true }).click();
      await expect(directorPage.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
      await page.goto(`${BASE}/index.php`);
      await page.locator('#mainNav summary').filter({ hasText: /^Fechas/ }).click();
      await expect(page.locator('#mainNav a[href="seguimiento_en_vivo.php"]')).toBeVisible();
      await viewer.goto(`${BASE}/index.php`);
      await expect(viewer.locator(`main a[href="${link}"]`).filter({ hasText: 'Seguimiento en vivo' })).toBeVisible();
      await directorPage.getByRole('button', { name: 'Finalizar partido', exact: true }).click();
      await directorPage.getByRole('dialog').getByRole('radio').first().check();
      await directorPage.getByRole('button', { name: 'Guardar y finalizar' }).click();
      await expect(directorPage.getByRole('dialog')).toHaveCount(0);
      await viewer.reload();
      await expect(viewer.locator(`main a[href="${link}"]`).filter({ hasText: 'Seguimiento en vivo' })).toBeVisible();
      await directorPage.getByRole('button', { name: 'Finalizar fecha', exact: true }).click();
      await directorPage.getByRole('dialog').getByRole('button', { name: 'Finalizar fecha', exact: true }).click();
      await expect.poll(() => JSON.parse(fixture('inspect', data.id)).session.state.closed).toBe(true);
      await viewer.reload();
      await expect(viewer.locator(`main a[href="${link}"]`).filter({ hasText: 'Seguimiento en vivo' })).toHaveCount(0);
    } finally { await Promise.allSettled([guest.close(), player.close(), director.close()]); fixture('delete', data.id); }
  });
}
