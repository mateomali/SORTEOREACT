const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
const fixturePath = 'tests/director-proposals-fixture.php';

test('resumen movil identifica equipo y permite votar sin abrir detalles', async ({ browser }) => {
  const fixture = JSON.parse(execFileSync('php', [fixturePath, 'create'], { encoding: 'utf8' }));
  const contexts = [];
  try {
    for (const index of [0, 1]) {
      const context = await browser.newContext(); contexts.push(context);
      await context.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[index], url: base }]);
      const page = await context.newPage();
      await page.goto(`${base}/crear_propuesta.php?match_id=${fixture.matchId}`);
      await page.getByRole('button', { name: 'Por sorteo', exact: true }).click();
      const payload = JSON.parse(await page.locator('[data-react-island="sorteo_legacy_page"]').getAttribute('data-payload'));
      const teams = fixture.teams.map(team => ({ ...team, players: team.players.map(player => ({ ...payload.players.find(p => Number(p.id) === player.id), ...player })) }));
      const saved = await context.request.post(`${base}/guardar_sorteo.php`, { data: { proposal_mode: true, proposal_csrf: payload.proposalCsrf, match_id: fixture.matchId, num_teams: 2, teams } });
      expect(await saved.json()).toMatchObject({ ok: true });
    }
    execFileSync('php', [fixturePath, 'activate', JSON.stringify(fixture)]);
    for (const index of [0, 2]) {
      execFileSync('php', [fixturePath, 'link', JSON.stringify(fixture), String(index)]);
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(context);
      await context.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[index], url: base }]);
      const page = await context.newPage();
      await page.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
      const options = page.locator('.multi-draw-option');
      await expect(options).toHaveCount(2);
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(options.first().locator('.proposal-summary-own')).toContainText('ROSA');
        await expect(options.first().locator('.proposal-summary-companions')).toContainText('Tus compañeros');
        await expect(options.first().locator('[data-multi-draw-list-view]')).toBeHidden();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      if (index === 0) {
        await expect(page.getByRole('button', { name: 'Votar esta propuesta', exact: true })).toHaveCount(0);
      } else {
        await page.screenshot({ path: 'outputs/propuestas-mobile-summary-390.png', fullPage: true });
        await page.getByRole('button', { name: 'Votar esta propuesta', exact: true }).first().click();
        await expect(page.getByRole('button', { name: 'Tu voto actual', exact: true })).toBeVisible();
        await page.goto(`${base}/index.php`);
        await expect(page.locator('.proposal-inline-vote')).toHaveCount(2);
        await expect(page.locator('.home-upcoming-section .home-multi-draw-card')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Próximo partido', exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Explorar', exact: true })).toBeVisible();
        await page.screenshot({ path: 'outputs/home-user-hierarchy-390.png', fullPage: true });
      }
      await options.first().locator('[data-proposal-details-toggle]').click();
      await options.last().locator('[data-proposal-details-toggle]').click();
      await expect(options.first().locator('[data-multi-draw-list-view]')).toBeVisible();
      await expect(options.last().locator('[data-multi-draw-list-view]')).toBeVisible();
      await options.first().locator('[data-multi-draw-pitch-toggle]').click();
      await expect(options.first().locator('[data-multi-draw-pitch-view]')).toBeVisible();
    }
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    execFileSync('php', [fixturePath, 'cleanup', JSON.stringify(fixture)], { encoding: 'utf8' });
  }
});

// Supply a deterministic prepared lineup so the test exercises the real save
// button and HTTP persistence without depending on random draw generation.
async function preparedEditor(page, fixture) {
  await page.route('**/sorteo_legacy_csv.php?*', async route => {
    const response = await route.fetch();
    let html = await response.text();
    html = html.replace(/data-payload="([^"]*)"/, (_, encoded) => {
      const decoded = encoded.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      const payload = JSON.parse(decoded);
      payload.initialTeams = fixture.teams.map(team => team.players.map(player => ({ ...payload.players.find(p => Number(p.id) === player.id), ...player })));
      payload.teamColors = fixture.teams.map(team => team.color_name);
      return `data-payload="${JSON.stringify(payload).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"`;
    });
    await route.fulfill({ response, body: html });
  });
}

test('directivos publican y usuarios comunes comparan y cambian su voto', async ({ browser }) => {
  const fixture = JSON.parse(execFileSync('php', [fixturePath, 'create'], { encoding: 'utf8' }));
  const contexts = [];
  try {
    for (let index = 0; index < 2; index++) {
      const context = await browser.newContext(); contexts.push(context);
      await context.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[index], url: base }]);
      const page = await context.newPage();
      if (index === 0) await preparedEditor(page, fixture);
      await page.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
      await page.getByRole('link', { name: 'Crear mi propuesta', exact: true }).click();
      await page.getByRole('button', { name: 'Por sorteo', exact: true }).click();
      await expect(page).toHaveURL(/sorteo_legacy_csv\.php.*proposal=1/);
      if (index === 0) await page.goto(page.url());
      await expect(page.locator('[data-react-island="sorteo_legacy_page"]')).toBeVisible();
      const payload = await page.locator('[data-react-island="sorteo_legacy_page"]').getAttribute('data-payload');
      const csrf = JSON.parse(payload).proposalCsrf;
      const bad = await context.request.post(`${base}/guardar_sorteo.php`, { data: { proposal_mode: true, match_id: fixture.matchId, num_teams: 2, teams: fixture.teams } });
      expect(bad.status()).toBe(403);
      if (index === 0) {
        const responsePromise = page.waitForResponse(response => response.url().endsWith('/guardar_sorteo.php'));
        await page.getByRole('button', { name: 'Guardar mi propuesta', exact: true }).click();
        const published = await responsePromise;
        expect(published.request().postDataJSON()).toMatchObject({ proposal_mode: true, proposal_csrf: csrf });
        expect(await published.json()).toMatchObject({ ok: true });
      } else {
        const published = await context.request.post(`${base}/guardar_sorteo.php`, { data: { proposal_mode: true, proposal_csrf: csrf, match_id: fixture.matchId, num_teams: 2, teams: fixture.teams } });
        expect(await published.json()).toMatchObject({ ok: true });
      }
      await page.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
      await expect(page.getByRole('heading', { name: `Propuesta ${index + 1}`, exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Votar esta propuesta' })).toHaveCount(0);
    }
    execFileSync('php', [fixturePath, 'activate', JSON.stringify(fixture)], { encoding: 'utf8' });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } }); contexts.push(context);
    await context.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[2], url: base }]);
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
    await expect(page.getByRole('button', { name: 'Votar esta propuesta' })).toHaveCount(2);
    await page.getByRole('button', { name: 'Votar esta propuesta' }).first().click();
    await expect(page.getByRole('button', { name: 'Tu voto actual' })).toHaveCount(1);
    await page.getByRole('button', { name: 'Votar esta propuesta' }).click();
    await expect(page.getByRole('button', { name: 'Tu voto actual' })).toHaveCount(1);
    const sections = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'Propuesta 2', exact: true }) });
    await expect(sections.last()).toContainText('1 votos');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'outputs/propuestas-directivos-390.png', fullPage: true });
    await expect(page.locator('.director-proposals')).not.toContainText('Propuesta de');
    for (const toggle of await page.locator('[data-multi-draw-pitch-toggle]').all()) await toggle.click();
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      const rows = await page.locator('.director-proposal-pitch .line-players[data-player-count="2"]').evaluateAll(lines => lines.map(line => {
        const cards = [...line.querySelectorAll('[data-static-formation-player]')].map(card => card.getBoundingClientRect());
        const row = line.getBoundingClientRect();
        const center = (cards[0].left + cards[0].right + cards[1].left + cards[1].right) / 4;
        return cards.length === 2 && cards.every(card => card.width >= 60) && Math.abs(center - (row.left + row.right) / 2) < 2 && Math.abs(cards[0].top - cards[1].top) < 2 && cards[0].right <= cards[1].left;
      }));
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every(Boolean)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `outputs/propuestas-cancha-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    execFileSync('php', [fixturePath, 'cleanup', JSON.stringify(fixture)], { encoding: 'utf8' });
  }
});

test('manual privado, guardado visible y edicion propia desde Formaciones', async ({ browser }) => {
  const fixture = JSON.parse(execFileSync('php', [fixturePath, 'create'], { encoding: 'utf8' }));
  const context = await browser.newContext();
  try {
    await context.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[0], url: base }]);
    const page = await context.newPage();
    await page.goto(`${base}/editar_partidos.php`);
    await expect(page.getByRole('link', { name: 'Crear mi propuesta', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sortear', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Capitanes', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Crear fecha', exact: true })).toHaveCount(0);
    const createDenied = await context.request.get(`${base}/crear_partido.php`, { maxRedirects: 0 });
    expect(createDenied.status()).toBe(302);
    const rosterDenied = await context.request.post(`${base}/editar_partidos.php`, { form: { action: 'save_match', id: String(fixture.matchId) } });
    expect(rosterDenied.status()).toBe(403);
    execFileSync('php', [fixturePath, 'partial', JSON.stringify(fixture)], { encoding: 'utf8' });
    await page.goto(`${base}/index.php?match_id=${fixture.matchId}`);
    await expect(page.getByRole('link', { name: 'Crear mi propuesta', exact: true })).toHaveCount(0);
    await expect(page.locator('main.content')).toContainText('completar la lista de jugadores');
    execFileSync('php', [fixturePath, 'complete', JSON.stringify(fixture)], { encoding: 'utf8' });
    await page.reload();
    await expect(page.getByRole('link', { name: 'Crear mi propuesta', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Crear mi propuesta', exact: true }).click();

    await page.getByRole('button', { name: 'De forma manual', exact: true }).click();
    await expect(page).toHaveURL(/equipos_manual/);
    for (const [index, team] of fixture.teams.entries()) {
      for (const player of team.players) await page.locator(`.manual-player-card[data-player-id="${player.id}"] [data-manual-team]`).selectOption(String(index + 1));
    }
    for (const team of fixture.teams) {
      for (const player of team.players) await page.locator(`.manual-player-card[data-player-id="${player.id}"] [data-manual-position]`).selectOption(player.assigned_position);
    }
    const preparedPromise = page.waitForResponse(response => response.url().endsWith('/preparar_propuesta.php'));
    await page.getByRole('button', { name: 'Acomodar formaciones', exact: true }).click();
    const draft = await (await preparedPromise).json();
    expect(draft.ok).toBe(true);
    const beforeSave = await context.request.get(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
    expect(await beforeSave.text()).not.toContain('<h3>Propuesta 1');
    await page.goto(`${base}/${draft.next_url}`);
    await expect(page.locator('[data-static-formation-player]')).toHaveCount(0);
    const editor = JSON.parse(await page.locator('[data-react-island="sorteo_legacy_page"]').getAttribute('data-payload'));
    expect(editor.mode).toBe('formation_editor');
    expect(editor.initialTeams).toHaveLength(2);
    const saveResponse = page.waitForResponse(response => response.url().endsWith('/guardar_sorteo.php'));
    await page.getByRole('button', { name: 'Guardar mi propuesta', exact: true }).click();
    expect(await (await saveResponse).json()).toMatchObject({ ok: true });
    await expect(page).toHaveURL(/propuestas_equipos/);
    await expect(page.getByRole('link', { name: 'Editar mi formación', exact: true })).toBeVisible();
    await page.goto(`${base}/index.php?match_id=${fixture.matchId}`);
    await expect(page.getByRole('link', { name: 'Crear mi propuesta', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Editar mi formación', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Editar mi formación', exact: true }).click();
    const restored = JSON.parse(await page.locator('[data-react-island="sorteo_legacy_page"]').getAttribute('data-payload'));
    expect(restored.mode).toBe('formation_editor');
    await expect(page.getByText('Camiseta', { exact: true })).toHaveCount(0);
    await expect(page.locator('#error')).toHaveCount(0);
    await expect(page.locator('#success')).toHaveCount(0);
    expect(restored.initialTeams.flat().map(p => p.id).sort()).toEqual(fixture.teams.flatMap(t => t.players).map(p => p.id).sort());
    const updated = page.waitForResponse(response => response.url().endsWith('/guardar_sorteo.php'));
    await page.getByRole('button', { name: 'Guardar mi propuesta', exact: true }).click();
    expect(await (await updated).json()).toMatchObject({ ok: true });
    await expect(page.getByRole('link', { name: 'Editar mi formación', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Propuesta 2', exact: true })).toHaveCount(0);
    execFileSync('php', [fixturePath, 'activate', JSON.stringify(fixture)], { encoding: 'utf8' });
    await page.goto(`${base}/index.php?match_id=${fixture.matchId}`);
    await expect(page.getByRole('heading', { name: 'Propuestas y estado de la votación', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Propuesta 1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Votar esta propuesta', exact: true })).toHaveCount(0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      expect(await page.locator('.director-proposal-pitch .line-players').first().evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.screenshot({ path: `outputs/directivo-inicio-${width}.png`, fullPage: true });
    }
    const frozen = await context.request.post(`${base}/guardar_sorteo.php`, { data: { proposal_mode: true, proposal_csrf: restored.proposalCsrf, match_id: fixture.matchId, num_teams: 2, teams: fixture.teams } });
    expect(frozen.status()).toBe(409);
    const draftAfterStart = await context.request.post(`${base}/preparar_propuesta.php`, { data: { proposal_csrf: restored.proposalCsrf, match_id: fixture.matchId, teams: fixture.teams } });
    expect(draftAfterStart.status()).toBe(422);
    await page.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
    await expect(page.getByRole('link', { name: 'Editar mi formación', exact: true })).toHaveCount(0);
    const forbidden = await context.request.post(`${base}/guardar_sorteo.php`, { data: { match_id: fixture.matchId, num_teams: 2, teams: fixture.teams } });
    expect(forbidden.status()).toBe(403);
  } finally {
    await context.close().catch(() => {});
    execFileSync('php', [fixturePath, 'cleanup', JSON.stringify(fixture)], { encoding: 'utf8' });
  }
});

test('reiniciar solo la propuesta propia y mostrar propuestas por decision del admin', async ({ browser }) => {
  const fixture = JSON.parse(execFileSync('php', [fixturePath, 'create'], { encoding: 'utf8' }));
  const contexts = [];
  try {
    for (const index of [0, 1]) {
      const context = await browser.newContext(); contexts.push(context);
      await context.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[index], url: base }]);
      const page = await context.newPage();
      await page.goto(`${base}/crear_propuesta.php?match_id=${fixture.matchId}`);
      await page.getByRole('button', { name: 'Por sorteo', exact: true }).click();
      const payload = JSON.parse(await page.locator('[data-react-island="sorteo_legacy_page"]').getAttribute('data-payload'));
      const saved = await context.request.post(`${base}/guardar_sorteo.php`, { data: { proposal_mode: true, proposal_csrf: payload.proposalCsrf, match_id: fixture.matchId, num_teams: 2, teams: fixture.teams } });
      expect(await saved.json()).toMatchObject({ ok: true });
    }
    const page = await contexts[0].newPage();
    await page.goto(`${base}/sorteo_legacy_csv.php?match_id=${fixture.matchId}&proposal=1&edit_proposal=1`);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Borrar todo y volver a empezar', exact: true }).click();
    await expect(page).toHaveURL(/crear_propuesta/);
    await expect(page.getByRole('button', { name: 'De forma manual', exact: true })).toBeVisible();
    const admin = await browser.newContext(); contexts.push(admin);
    await admin.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[3], url: base }]);
    const adminPage = await admin.newPage();
    await adminPage.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
    await expect(adminPage.getByRole('heading', { name: 'Propuesta 1', exact: true })).toHaveCount(0);
    await expect(adminPage.getByRole('heading', { name: 'Propuesta 2', exact: true })).toBeVisible();
    const adminProposal = adminPage.locator('.multi-draw-option').first();
    await expect(adminProposal.locator('[data-multi-draw-list-view]')).toBeVisible();
    await expect(adminProposal.locator('[data-multi-draw-pitch-view]')).toBeHidden();
    await adminProposal.locator('[data-multi-draw-pitch-toggle]').click();
    await expect(adminProposal.locator('[data-multi-draw-pitch-view]')).toBeVisible();
    await adminProposal.locator('[data-multi-draw-pitch-close]').click();
    await expect(adminProposal.locator('[data-multi-draw-list-view]')).toBeVisible();
    await adminPage.getByRole('button', { name: 'Mostrar propuestas en Inicio', exact: true }).click();
    await page.goto(`${base}/index.php?match_id=${fixture.matchId}`);
    await expect(page.getByRole('heading', { name: 'Propuesta 2', exact: true })).toBeVisible();
    const directorOption = page.locator('.multi-draw-option').first();
    await expect(directorOption.locator('[data-multi-draw-list-view]')).toBeVisible();
    await expect(directorOption.locator('[data-multi-draw-pitch-view]')).toBeHidden();
    await directorOption.locator('[data-multi-draw-pitch-toggle]').click();
    await expect(directorOption.locator('[data-multi-draw-pitch-view]')).toBeVisible();
    await directorOption.locator('[data-multi-draw-pitch-close]').click();
    await expect(directorOption.locator('[data-multi-draw-list-view]')).toBeVisible();
    await expect(page.locator('main.content')).toContainText('La votación todavía no comenzó');
    const voter = await browser.newContext(); contexts.push(voter);
    await voter.addCookies([{ name: 'PHPSESSID', value: fixture.sessions[2], url: base }]);
    const voterPage = await voter.newPage();
    await voterPage.goto(`${base}/propuestas_equipos.php?match_id=${fixture.matchId}`);
    await expect(voterPage.getByRole('heading', { name: 'Propuesta 2', exact: true })).toBeVisible();
    await expect(voterPage.getByRole('button', { name: 'Votar esta propuesta', exact: true })).toHaveCount(0);
    await adminPage.locator('[name="duration_minutes"]').fill('45');
    await adminPage.getByRole('button', { name: 'Iniciar votación ahora', exact: true }).click();
    await voterPage.goto(`${base}/index.php`);
    await expect(voterPage.getByRole('heading', { name: 'Votación de equipos habilitada', exact: true })).toBeVisible();
    const voterOption = voterPage.locator('.multi-draw-option').first();
    await expect(voterOption.locator('[data-multi-draw-list-view]')).toBeVisible();
    await expect(voterOption.locator('[data-multi-draw-pitch-view]')).toBeHidden();
    await voterOption.locator('[data-multi-draw-pitch-toggle]').click();
    await expect(voterOption.locator('[data-multi-draw-pitch-view]')).toBeVisible();
    await voterOption.locator('[data-multi-draw-pitch-close]').click();
    await expect(voterOption.locator('[data-multi-draw-list-view]')).toBeVisible();
    await expect(voterPage.locator('[data-proposal-countdown]').first()).toContainText('min');
    await page.goto(`${base}/index.php`);
    await expect(page.getByRole('heading', { name: 'Votación de equipos habilitada', exact: true })).toBeVisible();
    await voterPage.goto(`${base}/propuestas_equipos.php`);
    await expect(voterPage.getByRole('heading', { name: fixture.prefix, exact: true })).toBeVisible();
    await voterPage.getByRole('button', { name: 'Votar esta propuesta', exact: true }).click();
    adminPage.once('dialog', dialog => dialog.accept());
    await adminPage.getByRole('button', { name: 'Terminar votación ahora', exact: true }).click();
    await expect(adminPage.getByRole('heading', { name: /Propuesta 2.*Ganadora/ })).toBeVisible();
    await voterPage.goto(`${base}/index.php`);
    await expect(voterPage.getByRole('heading', { name: 'Formación oficial del próximo partido', exact: true })).toBeVisible();
    await expect(voterPage.locator('main.content')).toContainText('Propuesta 2 ganadora');
    await expect(voterPage.locator('[data-proposal-countdown]')).toHaveCount(0);
  } finally {
    for (const context of contexts) await context.close().catch(() => {});
    execFileSync('php', [fixturePath, 'cleanup', JSON.stringify(fixture)], { encoding: 'utf8' });
  }
});
