const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const policy = fs.readFileSync('assets/player-rating-policy.json', 'utf8');

test('separation editor and suggested swaps resolve the concentration without changing ratings', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const roles = ['ARQ', 'DEF', 'DEF', 'MED', 'MED', 'DEL', 'DEL'];
  const teams = [0,1].map(t => roles.map((position, i) => ({
    id: t * 10 + i + 1, name: t === 0 && i === 1 ? 'GUILLE' : t === 0 && i === 3 ? 'MARCELO' : `Prueba ${t}-${i}`,
    positions: position, assigned_position: position, skill: 4, technique: 4, pass_vision: 4,
    defense_physical: 4, attack: 4, rhythm: i === 1 || i === 3 ? (t === 0 ? i === 1 ? 1.8 : 2.2 : 2.9) : 5,
    stamina: 4, teamwork: 4, mentality: 4, regularity: 3.5,
  })));
  const payload = { players: teams.flat(), initialTeams: teams, numTeams: 2, links: {} };
  await page.route('**/__mobility', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page" data-payload='${JSON.stringify(payload)}'></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.goto('http://127.0.0.1:8000/__mobility');
  const editor = page.getByRole('region', { name: 'Separar jugadores', exact: true });
  await editor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption('2');
  await editor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption('4');
  await editor.getByRole('button', { name:'Agregar restricción', exact:true }).click();
  await expect(editor).toContainText('GUILLE y MARCELO');
  await page.getByRole('button', { name:'Analizar equipos', exact:true }).click();
  const suggestions = page.getByRole('region', { name:'Intercambios para mejorar movilidad' });
  await expect(suggestions.getByRole('alert')).toBeVisible();
  await expect(suggestions.locator('[data-mobility-suggestion]').first()).toBeVisible();
  await suggestions.getByRole('button', { name:/Aplicar intercambio/ }).first().click();
  await expect(suggestions.getByRole('alert')).toHaveCount(0);
  // Query the explicit card attributes because player names also occur in the analysis.
  const guille = page.locator('[data-sorteo-drag-player][data-player-key="2"]');
  const marcelo = page.locator('[data-sorteo-drag-player][data-player-key="4"]');
  expect(await guille.getAttribute('data-team-index')).not.toBe(await marcelo.getAttribute('data-team-index'));
  const pace = page.locator('[data-pace-explanation]');
  await expect(pace).toContainText('GUILLE (1.8)');
  await expect(pace).toContainText('MARCELO (2.2)');
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height:950 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await pace.screenshot({ path:`outputs/mobility-explanation-${width}.png` });
  }
  await editor.getByRole('button', { name:/Ver restricciones/ }).click();
  await editor.getByRole('button', { name:/Quitar separación/, includeHidden:true }).click();
  await page.getByRole('button', { name:'Cerrar Estos jugadores no pueden jugar juntos', exact:true }).click();
  await expect(editor).toContainText('Sin restricciones guardadas');
  expect(errors).toEqual([]);
});

test('separations persist with a temporary date and are enforced by both save endpoints', async ({ page }) => {
  test.setTimeout(120000);
  const fixture = (action, id) => execFileSync('php', ['tests/sorteo-workflow-fixture.php', action, ...(id ? [String(id)] : [])], { encoding:'utf8' }).trim();
  const id = Number(fixture('create'));
  try {
    await page.goto(`http://127.0.0.1:8000/login.php?next=${encodeURIComponent(`sorteo_legacy_csv.php?match_id=${id}`)}`);
    await page.getByRole('button', { name:'Administrador', exact:true }).click();
    await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
    await page.getByRole('button', { name:'Entrar como admin', exact:true }).click();
    const payload = await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(node => JSON.parse(node.dataset.payload));
    const rulesEditor = page.getByRole('region', { name:'Separar jugadores', exact:true });
    await rulesEditor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption(String(payload.players[0].id));
    await rulesEditor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption(String(payload.players[1].id));
    await rulesEditor.getByRole('button', { name:'Agregar restricción', exact:true }).click();
    const keeperEditor = rulesEditor.locator('.gf-goalkeeper-preparation');
    if (await keeperEditor.getByRole('button', { name:'Editar', exact:true }).count()) await keeperEditor.getByRole('button', { name:'Editar', exact:true }).click();
    await keeperEditor.getByRole('tab', { name:'Todos los jugadores', exact:true }).click();
    for (const checked of await keeperEditor.locator('input:checked').all()) await checked.uncheck();
    const chosenKeeper = keeperEditor.locator('input[type=checkbox]').first();
    await chosenKeeper.check();
    const keeperLabel = await chosenKeeper.locator('..').innerText();
    await rulesEditor.getByRole('button', { name:'Guardar arqueros y restricciones', exact:true }).click();
    await expect(rulesEditor.getByRole('status')).toHaveText('Arqueros y restricciones guardados para esta fecha.');
    await page.reload();
    await expect(rulesEditor.getByRole('button', { name:/Quitar separación/, includeHidden:true })).toHaveCount(1);
    const persisted = await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(node => JSON.parse(node.dataset.payload));
    expect(persisted.savedGoalkeeperIds).toHaveLength(1);
    await expect(rulesEditor).toContainText(keeperLabel.split('\n')[0]);
    await rulesEditor.getByRole('button', { name:/Ver restricciones/ }).click();
    await rulesEditor.getByRole('button', { name:/Quitar separación/, includeHidden:true }).click();
    await page.getByRole('button', { name:'Cerrar Estos jugadores no pueden jugar juntos', exact:true }).click();
    await rulesEditor.getByRole('button', { name:'Guardar arqueros y restricciones', exact:true }).click();
    await expect(rulesEditor.getByRole('status')).toHaveText('Arqueros y restricciones guardados para esta fecha.');
    await page.locator('#draw-rating-mode').selectOption('skill');
    const keepers = page.locator('.gf-goalkeeper-preparation');
    if (await keepers.getByRole('button', { name:'Editar', exact:true }).count()) await keepers.getByRole('button', { name:'Editar', exact:true }).click();
    await keepers.getByRole('tab', { name:'Todos los jugadores', exact:true }).click();
    for (const checked of await keepers.locator('input:checked').all()) await checked.uncheck();
    const options = payload.players.filter(p => (p.posicion || p.positions).split('/').includes('ARQ')).slice(0,2);
    for (const keeper of options) await keepers.locator('label').filter({ hasText:keeper.nombre || keeper.name }).locator('input[type=checkbox]').check();
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('[data-sorteo-team-card]')).toHaveCount(2, { timeout:90000 });
    const rosters = await page.locator('[data-sorteo-drag-player]').evaluateAll(nodes => [0,1].map(index => nodes.filter(node => Number(node.dataset.teamIndex) === index).map(node => ({ id:Number(node.dataset.playerKey), assigned_position:node.dataset.assignedPosition }))));
    const pair = [String(rosters[0][1].id), String(rosters[1][1].id)].sort();
    const body = { match_id:id, num_teams:2, position_rating_mode:'skill', position_rating_discount:false, teams:rosters.map((players,index) => ({ color_name:index ? 'AZUL' : 'ROSA', players })), separated_pairs:[pair] };
    const saved = await page.request.post('http://127.0.0.1:8000/guardar_sorteo.php', { data:body });
    expect(await saved.json()).toMatchObject({ ok:true });
    await page.reload();
    const editor = page.getByRole('region', { name:'Separar jugadores', exact:true });
    await expect(editor.getByRole('button', { name:/Quitar separación/, includeHidden:true })).toHaveCount(1);
    const loaded = await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(node => JSON.parse(node.dataset.payload));
    expect(loaded.separatedPairs).toEqual([pair]);
    expect(loaded.positionRatingMode).toBe('skill');
    expect(loaded.positionRatingDiscount).toBe(false);
    // All three modes must survive the real save/load path. Obsolete discount
    // flags cannot turn fixed or skill mode into another calculation.
    for (const mode of ['general', 'penalty', 'skill']) {
      const modeId = Number(fixture('create'));
      try {
        const response = await page.request.post('http://127.0.0.1:8000/guardar_sorteo.php', {
          data:{ ...body, match_id:modeId, position_rating_mode:mode, position_rating_discount:mode !== 'penalty' },
        });
        expect(await response.json()).toMatchObject({ ok:true });
        await page.goto(`http://127.0.0.1:8000/sorteo_legacy_csv.php?match_id=${modeId}`);
        const roundTrip = await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(node => JSON.parse(node.dataset.payload));
        expect(roundTrip.positionRatingMode).toBe(mode);
        expect(roundTrip.positionRatingDiscount).toBe(mode === 'penalty');
        expect(roundTrip.initialTeams.flat().length).toBe(rosters.flat().length);
      } finally { fixture('delete', modeId); }
    }
    await page.goto(`http://127.0.0.1:8000/sorteo_legacy_csv.php?match_id=${id}`);
    const stateBefore = JSON.parse(fixture('inspect', id));
    const conflicting = [String(rosters[0][0].id), String(rosters[0][1].id)];
    const rejected = await page.request.post('http://127.0.0.1:8000/guardar_sorteo.php', { data:{ ...body, separated_pairs:[conflicting] } });
    expect(rejected.status()).toBe(422);
    const formationRejected = await page.request.post(`http://127.0.0.1:8000/finalizar_partido.php?match_id=${id}&edit_formations=1`, { headers:{ Accept:'application/json' }, form:{ action:'save_formations', match_id:String(id), separated_pairs:JSON.stringify([conflicting]) } });
    expect(formationRejected.status()).toBe(422);
    expect(JSON.parse(fixture('inspect', id)).match.draw_audit_snapshot).toEqual(stateBefore.match.draw_audit_snapshot);
    const newPair = [String(rosters[0][2].id), String(rosters[1][2].id)].sort();
    await editor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption(newPair[0]);
    await editor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption(newPair[1]);
    await editor.getByRole('button', { name:'Agregar restricción', exact:true }).click();
    const saveResponse = page.waitForResponse(response => response.request().method() === 'POST' && /finalizar_partido\.php|guardar_sorteo\.php/.test(response.url()));
    await page.locator('#download-controls').getByRole('button', { name:'Guardar equipos y continuar', exact:true }).click();
    expect(await (await saveResponse).json()).toMatchObject({ ok:true });
    await expect(page).toHaveURL(/editar_partidos.php/);
    const audit = JSON.parse(JSON.parse(fixture('inspect', id)).match.draw_audit_snapshot);
    expect(audit.criteria.separated_pairs).toEqual([pair, newPair]);
    await page.goto(`http://127.0.0.1:8000/finalizar_partido.php?match_id=${id}&edit_formations=1`);
    await expect(page.getByRole('region', { name:'Separar jugadores', exact:true }).getByRole('button', { name:/Quitar separación/, includeHidden:true })).toHaveCount(2);
    const formationPayload = await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(node => JSON.parse(node.dataset.payload));
    expect(formationPayload.positionRatingMode).toBe('skill');
    expect(formationPayload.positionRatingDiscount).toBe(false);
  } finally { fixture('delete', id); }
});

for (const numTeams of [2, 3, 4]) {
  test(`separation editor accepts ${numTeams} players`, async ({ page }) => {
    const players = Array.from({ length: 12 }, (_, i) => ({ id:i + 1, name:`Jugador ${i+1}`, positions:'MED', skill:4 }));
    const payload = { players, numTeams, links:{} };
    await page.route('**/__groups', route => route.fulfill({ contentType:'text/html', body:`<html><body><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page" data-payload='${JSON.stringify(payload)}'></div><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
    await page.goto('http://127.0.0.1:8000/__groups');
    const editor = page.getByRole('region', { name:'Separar jugadores', exact:true });
    await expect(editor.getByRole('button', { name:'Agregar restricción', exact:true })).toBeDisabled();
    for (let i = 0; i < numTeams; i++) await editor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption(String(i+1));
    await expect(editor.getByLabel('Agregar jugador a la restricción', { exact:true })).toBeDisabled();
    await editor.getByRole('button', { name:'Quitar del grupo a Jugador 1', exact:true }).click();
    await expect(editor.getByLabel('Agregar jugador a la restricción', { exact:true })).toBeEnabled();
    await editor.getByLabel('Agregar jugador a la restricción', { exact:true }).selectOption('1');
    await editor.getByRole('button', { name:'Agregar restricción', exact:true }).click();
    await expect(editor.locator('li')).toHaveCount(1);
    await expect(editor.locator('li')).toContainText(`Jugador ${numTeams}`);
  });
}
