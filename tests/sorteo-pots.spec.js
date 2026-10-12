const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const fixture = (action, id) => execFileSync('php', ['tests/draw-pots-fixture.php', action, ...(id ? [String(id)] : [])], { encoding: 'utf8' }).trim();
const configFixture = (action, value) => execFileSync('php', ['tests/draw-pots-fixture.php', action, ...(value ? [value] : [])], { encoding: 'utf8' }).trim();
const editorWidth = page => page.evaluate(() => document.documentElement.scrollWidth);

test.use({ actionTimeout: 15000 });

test('pots can be edited, persisted, drawn, saved and reviewed on mobile', async ({ page }) => {
  test.setTimeout(240000);
  const snapshot = configFixture('snapshot');
  const id = Number(fixture('create'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  try {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto(`${BASE}/login.php?next=${encodeURIComponent(`sorteo_legacy_csv.php?match_id=${id}`)}`);
    await page.getByRole('button', { name: 'Administrador', exact: true }).click();
    await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
    await page.getByRole('button', { name: 'Entrar como admin', exact: true }).click();
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('.team-formation')).toHaveCount(2, { timeout: 90000 });
    // Pair the known-valid teams to obtain an arbitrary, feasible template.
    const teams = await page.locator('[data-sorteo-team-card]').evaluateAll(cards => cards.map(card => [...card.querySelectorAll('[data-sorteo-drag-player]')].map(player => player.dataset.playerKey)));
    expect(teams[0].length).toBe(teams[1].length);
    const pots = teams[0].map((key, index) => ({ name: `Pote ${index + 1}`, playerIds: [key, teams[1][index]] }));
    const csrf = await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(root => JSON.parse(root.dataset.payload).potsCsrf);
    const rejected = await page.request.post(`${BASE}/guardar_potes.php`, { data: { csrf: 'invalid', pots } });
    expect(rejected.status()).toBe(403);
    const duplicate = await page.request.post(`${BASE}/guardar_potes.php`, { data: { csrf, pots: [...pots, pots[0]] } });
    expect(duplicate.status()).toBe(422);
    const response = await page.request.post(`${BASE}/guardar_potes.php`, { data: { csrf, pots } });
    expect(response.ok()).toBe(true);
    await page.reload();
    await page.getByRole('combobox', { name: 'Modalidad de sorteo', exact: true }).selectOption('pots');
    await expect(page.locator('[data-pot-row]')).toHaveCount(pots.length);
    await page.getByRole('combobox',{name:'Armado de potes',exact:true}).selectOption('automatic');
    await page.getByRole('button',{name:'Armar potes automáticamente',exact:true}).click();
    await expect(page.locator('[data-pot-row]')).toHaveCount(5);
    await expect(page.locator('[data-pot-row]').first()).toContainText('Pote 1');
    await expect(page.getByLabel('Nombre del pote 1')).toHaveValue('ARQ · Arqueros');
    await expect(page.locator('[data-pot-row]').first()).toContainText(/Promedio \d+ GEN/);
    await expect(page.locator('[data-draw-pots]').getByRole('status')).toContainText('Propuesta automática lista');
    await page.getByRole('button', { name: 'Deshacer armado automático', exact: true }).click();
    await expect(page.getByLabel('Nombre del pote 1')).toHaveValue(pots[0].name);
    await page.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(page.getByLabel('Nombre del pote 1')).not.toHaveValue(pots[0].name);
    await page.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await expect(page.getByLabel('Nombre del pote 1')).toHaveValue(pots[0].name);
    await page.getByRole('button',{name:'Armar potes automáticamente',exact:true}).click();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      expect(await editorWidth(page)).toBeLessThanOrEqual(width);
      await page.locator('[data-draw-pots]').screenshot({ path: `outputs/potes-editor-${width}.png` });
    }
    await page.getByRole('button',{name:'Bajar pote 1',exact:true}).click();
    await expect(page.locator('[data-pot-row]')).toHaveCount(5);
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('.team-formation')).toHaveCount(2,{timeout:90000});
    await expect(page.locator('[data-team-pots]')).toHaveCount(2);
    // The automatically built proposal stays fully editable. Reload the
    // saved manual fixture to exercise both ways of preparing the draw.
    await page.reload();
    await page.getByRole('combobox', { name: 'Modalidad de sorteo', exact: true }).selectOption('pots');
    // Unassigned members block generation; reassigning restores readiness.
    const editor = page.locator('[data-draw-pots]');
    const playerLabel = await editor.locator('select[aria-label^="Pote de "]').first().getAttribute('aria-label');
    const select = editor.getByRole('combobox', { name: playerLabel, exact: true });
    const original = await select.inputValue();
    const playerName = playerLabel.replace('Pote de ', '');
    await editor.getByRole('button', { name: `Quitar a ${playerName} del pote`, exact: true }).click();
    await expect(editor.getByLabel('Jugadores sin pote').getByRole('combobox', { name: playerLabel, exact: true })).toHaveValue('');
    await expect(page.locator('#generateTeamsButton')).toBeDisabled();
    await editor.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(select).toHaveValue(original);
    await editor.getByRole('button', { name: 'Rehacer', exact: true }).click();
    await expect(select).toHaveValue('');
    await select.selectOption(original);
    const playerNode = select.locator('..');
    const key = await playerNode.getAttribute('data-pot-player');
    const nextPot = (Number(original) + 1) % pots.length;
    await playerNode.dragTo(editor.locator('[data-pot-row]').nth(nextPot), { sourcePosition: { x: 10, y: 15 }, targetPosition: { x: 8, y: 8 } });
    await expect(select).toHaveValue(String(nextPot));
    await editor.getByRole('button', { name: 'Deshacer', exact: true }).click();
    await expect(select).toHaveValue(original);
    await editor.getByRole('button', { name: 'Agregar pote', exact: true }).click();
    await expect(page.locator('[data-pot-row]')).toHaveCount(pots.length + 1);
    await page.getByLabel(`Nombre del pote ${pots.length + 1}`).fill('Invitados');
    await editor.getByRole('button', { name: `Subir pote ${pots.length + 1}`, exact: true }).click();
    await expect(page.getByLabel(`Nombre del pote ${pots.length}`)).toHaveValue('Invitados');
    await editor.getByRole('button', { name: `Eliminar pote ${pots.length}`, exact: true }).click();
    await page.getByLabel('Nombre del pote 1').fill('Cabezas de serie');
    await editor.getByRole('button', { name: 'Guardar potes para próximas fechas', exact: true }).click();
    await expect(editor.getByRole('status')).toContainText('Plantilla compartida guardada');
    await page.reload();
    await page.getByRole('combobox', { name: 'Modalidad de sorteo', exact: true }).selectOption('pots');
    await expect(page.getByLabel('Nombre del pote 1')).toHaveValue('Cabezas de serie');
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('.team-formation')).toHaveCount(2, { timeout: 90000 });
    await expect(page.locator('[data-team-pots]')).toHaveCount(2);
    // Fine adjustments keep membership from the generated draw even if the
    // next-draw editor is changed or switched back to habitual mode.
    const source = page.locator('[data-sorteo-drag-player][data-team-index="0"][data-assigned-position="DEF"]').first();
    const sourceKey = await source.getAttribute('data-player-key');
    const sourcePot = pots.find(pot => pot.playerIds.includes(sourceKey));
    const samePotKey = sourcePot.playerIds.find(key => key !== sourceKey);
    const otherKey = await page.locator(`[data-sorteo-drag-player][data-team-index="1"][data-assigned-position="DEF"]:not([data-player-key="${samePotKey}"])`).first().getAttribute('data-player-key');
    await page.getByRole('combobox', { name: 'Modalidad de sorteo', exact: true }).selectOption('standard');
    await source.click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Todos', exact: true }).click();
    await expect(dialog.locator(`[data-exchange-player="${samePotKey}"]`)).toBeEnabled();
    const otherPotButton = dialog.locator(`[data-exchange-player="${otherKey}"]`);
    const sourceLevel = pots.findIndex(pot => pot.playerIds.includes(sourceKey));
    const otherDistance = Math.abs(sourceLevel - pots.findIndex(pot => pot.playerIds.includes(otherKey)));
    await expect(otherPotButton).toBeDisabled();
    await expect(otherPotButton).toContainText(`${otherDistance} nivel${otherDistance === 1 ? '' : 'es'} de distancia`);
    await expect(otherPotButton).toHaveAttribute('data-exchange-pot-distance', String(otherDistance));
    await expect(otherPotButton).toHaveAttribute('title',/equipos distintos/);
    const distantKey = await page.locator('[data-sorteo-drag-player][data-team-index="1"][data-assigned-position="DEL"]').first().getAttribute('data-player-key');
    await expect(dialog.locator(`[data-exchange-player="${distantKey}"]`)).toBeDisabled();
    const distantDistance = Math.abs(sourceLevel - pots.findIndex(pot => pot.playerIds.includes(distantKey)));
    await expect(dialog.locator(`[data-exchange-player="${distantKey}"]`)).toHaveAttribute('data-exchange-pot-distance', String(distantDistance));
    await dialog.locator(`[data-exchange-player="${samePotKey}"]`).click();
    await expect(page.locator(`[data-sorteo-drag-player][data-player-key="${sourceKey}"]`)).toHaveAttribute('data-team-index', '1');
    await expect(page.locator(`[data-sorteo-drag-player][data-player-key="${samePotKey}"]`)).toHaveAttribute('data-team-index', '0');
    const savedResponse = page.waitForResponse(response => response.url().endsWith('/guardar_sorteo.php') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Guardar equipos y continuar', exact: true }).click();
    expect((await savedResponse).ok()).toBe(true);
    const saved = JSON.parse(fixture('inspect', id));
    expect(JSON.parse(saved.match.draw_pots_json)).toHaveLength(pots.length);
    await page.goto(`${BASE}/sorteo_legacy_csv.php?match_id=${id}`);
    await expect(page.locator('[data-team-pots]')).toHaveCount(2);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      await page.getByRole('combobox', { name: 'Modalidad de sorteo', exact: true }).selectOption('pots');
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.screenshot({ path: `outputs/potes-${width}.png`, fullPage: true });
    }
    await page.goto(`${BASE}/finalizar_partido.php?match_id=${id}&edit_formations=1`);
    await expect(page.locator('[data-team-pots]')).toHaveCount(2);
    const persistedPlayers = saved.players;
    const origin = persistedPlayers.find(player => String(player.id) === sourceKey);
    const target = persistedPlayers.find(player => player.positions === 'DEF' && player.team_number !== origin.team_number && !sourcePot.playerIds.includes(String(player.id)));
    const flexible = await page.request.post(`${BASE}/finalizar_partido.php?match_id=${id}`, {
      headers: { Accept: 'application/json' },
      form: { action: 'save_formations', match_id: String(id), [`player_team[${origin.id}]`]: String(target.team_number), [`player_team[${target.id}]`]: String(origin.team_number) },
    });
    expect(flexible.status()).toBe(422);
    expect((await flexible.json()).message).toContain('equipos distintos');
    const afterFlexible = JSON.parse(fixture('inspect', id));
    expect(afterFlexible.players.find(player => player.id === origin.id).team_number).toBe(origin.team_number);
    expect(afterFlexible.players.find(player => player.id === target.id).team_number).toBe(target.team_number);
    expect(errors).toEqual([]);
  } finally {
    configFixture('restore', Buffer.from(snapshot).toString('base64'));
    fixture('delete', id);
  }
});
