const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8001';
const ADMIN_PASSWORD = process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026';

async function adminLogin(page, next = 'index.php') {
  await page.goto(`${BASE_URL}/login.php?next=${encodeURIComponent(next)}`, { waitUntil: 'networkidle' });
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  const nextPath = `/${next.split('?')[0]}`;
  await page.waitForURL((url) => url.pathname.endsWith(nextPath), { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

async function clickVisibleNavLink(page, name) {
  let link = page.locator('nav a:visible').filter({ hasText: name }).first();
  if (await link.count() === 0) {
    await page.locator('nav a').filter({ hasText: name }).first().locator('xpath=ancestor::details[1]/summary').click();
    link = page.locator('nav a:visible').filter({ hasText: name }).first();
  }
  await link.click();
}

async function clickVisibleNavHref(page, href) {
  let link = page.locator(`nav a:visible[href="${href}"]`).first();
  if (await link.count() === 0) {
    await page.locator(`nav a[href="${href}"]`).first().locator('xpath=ancestor::details[1]/summary').click();
    link = page.locator(`nav a:visible[href="${href}"]`).first();
  }
  await link.click();
}

for (const profile of [
  { name: 'desktop', viewport: { width: 1366, height: 768 } },
  { name: 'mobile-390', viewport: { width: 390, height: 844 } },
]) {
  test(`partial navigation smoke - ${profile.name}`, async ({ page }) => {
    await page.setViewportSize(profile.viewport);
    const errors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    if (profile.viewport.width <= 760) {
      await page.getByRole('button', { name: /Abrir menu|Menu/i }).click();
    }
    await page.getByRole('link', { name: /Historial/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main.content')).toContainText(/Historial de fechas|No hay fechas/i);

    const search = page.locator('#homeHistorySearch');
    if (await search.count()) {
      await search.fill('zzzz-no-match');
      await expect(page.locator('[data-home-history-empty]')).toBeVisible();
    }

    if (profile.viewport.width <= 760) {
      await page.getByRole('button', { name: /Abrir menu|Menu/i }).click();
    }
    await clickVisibleNavHref(page, 'estadisticas.php');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main.content')).toContainText(/Estadisticas|Ranking|Temporada/i);

    if (profile.viewport.width <= 760) {
      await page.getByRole('button', { name: /Abrir menu|Menu/i }).click();
    }
    await clickVisibleNavHref(page, 'jugadores2.php');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main.content')).toContainText(/Jugadores|Plantilla/i);
    const playerSearch = page.locator('#playerListSearchReact');
    if (await playerSearch.count()) {
      await playerSearch.fill('zzzz-no-player');
      await expect(page.locator('[data-player-list-empty]')).toBeVisible();
      await playerSearch.fill('');
    }

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(horizontalOverflow).toBeFalsy();
    expect(errors).toEqual([]);
  });
}

test('admin player create form reacts without submitting', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'jugadores2.php');
  await expect(page.locator('main.content')).toContainText(/Jugadores/i);

  const addPlayer = page.getByText('Agregar jugador').first();
  if (await addPlayer.count() === 0) {
    expect(errors).toEqual([]);
    return;
  }
  await addPlayer.click();
  const createForm = page.locator('.react-player-create-form');
  await createForm.locator('#reactPlayerName').fill('Jugador Prueba UI');
  await createForm.locator('select[name="positions[]"]').first().selectOption('ARQ');
  await expect(createForm.locator('[data-goalkeeper-stat-row]')).toBeVisible();
  await expect(createForm.locator('[data-attack-stat-row]')).toBeVisible();
  await expect(createForm.locator('[data-general-rating-value]')).toContainText('/6');
  await expect(createForm.locator('[data-player-radar]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('admin encounters history filters with React controls', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'editar_partidos.php');
  await expect(page.locator('main.content')).toContainText(/Historial de fechas|Editar fechas/i);

  const search = page.locator('#encounterHistorySearch');
  if (await search.count()) {
    await search.fill('zzzz-no-match');
    await expect(page.locator('[data-encounter-history-empty]')).toBeVisible();
    await search.fill('');
  }

  const firstStatus = page.locator('[data-encounter-status-filter]').first();
  if (await firstStatus.count()) {
    await firstStatus.click();
    await expect(firstStatus).toHaveClass(/is-active/);
    await page.getByRole('button', { name: /Limpiar filtro/i }).click();
    await expect(firstStatus).not.toHaveClass(/is-active/);
  }

  expect(errors).toEqual([]);
});

test('admin create match participant controls react without submitting', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'crear_partido.php');
  await expect(page.locator('main.content')).toContainText(/Crear fecha|CREAR NUEVA FECHA/i);

  const controls = page.locator('.react-participant-controls');
  if (await controls.count() === 0) {
    expect(errors).toEqual([]);
    return;
  }
  await expect(controls).toBeVisible();
  await controls.locator('input[type="search"]').fill('zzzz-no-player');
  await expect(page.locator('[data-participant-empty]')).toBeVisible();
  await controls.locator('input[type="search"]').fill('');

  const random = controls.getByRole('button', { name: /Seleccion al azar/i });
  if (await random.count()) {
    await random.click();
    await expect(controls.locator('.participant-react-helper')).toContainText(/convocados/i);
  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});

test('finish page loads and valuation search works when available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'editar_partidos.php');

  const finishLink = page.locator('a:visible[href*="finalizar_partido.php?match_id="]').first();
  if (await finishLink.count()) {
    await finishLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main.content')).toContainText(/Finalizar fecha/i);

    const valuationSearch = page.locator('#finishValuationSearch');
    if (await valuationSearch.count()) {
      await valuationSearch.fill('zzzz-no-player');
      await expect(page.locator('[data-finish-valuations-empty]')).toBeVisible();
      await valuationSearch.fill('');
    }
  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});

test('captains page loads without breaking live board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'capitanes.php');
  await expect(page.locator('main.content')).toContainText(/Modo capitanes|Seleccionar fecha|Iniciar draft/i);

  const matchSelect = page.locator('select[name="match_id"][data-auto-submit]').first();
  if (await matchSelect.count()) {
    const values = await matchSelect.locator('option').evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
    if (values.length) {
      await page.evaluate(() => {
        window.__captainsAutoSubmitMarker = 1;
      });
      await matchSelect.selectOption(values[0]);
      await page.waitForURL((url) => url.href.includes(`match_id=${values[0]}`), { timeout: 10000 });
      await expect(page.locator('main.content')).toContainText(/Modo capitanes|Iniciar draft|Pasa estos tokens|Equipos generados/i);
      expect(await page.evaluate(() => window.__captainsAutoSubmitMarker)).toBe(1);
    }
  }

  const tokenInput = page.locator('.captain-token-card input[readonly]').first();
  if (await tokenInput.count()) {
    await tokenInput.click();
    await expect(tokenInput).not.toHaveValue('');
  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});

test('stats React player search filters rows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`${BASE_URL}/estadisticas.php`, { waitUntil: 'networkidle' });
  const search = page.locator('#statsPlayerSearchReact');
  await expect(search).toBeVisible();
  await search.fill('zzzz-no-player');
  await expect(page.locator('[data-stats-player-result]')).toBeHidden();
  await search.fill('');

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});

test('manual teams page loads search assist when manual link exists', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'editar_partidos.php');

  const manualLink = page.locator('a[href*="equipos_manual.php?match_id="]').first();
  if (await manualLink.count()) {
    await manualLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main.content')).toContainText(/Equipos manuales/i);
    const search = page.locator('#manualPlayerSearch');
    if (await search.count()) {
      await search.fill('zzzz-no-player');
      await expect(page.locator('.manual-search-assist')).toContainText(/visibles|jugadores/i);
      await search.fill('');
    }
  }

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});

test('support admin pages load without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'backup.php');
  await expect(page.locator('main.content')).toContainText(/Backup/i);

  await page.goto(`${BASE_URL}/migrar_csv.php`, { waitUntil: 'networkidle' });
  await expect(page.locator('main.content')).toContainText(/Migrar|CSV|Importar/i);

  await page.goto(`${BASE_URL}/login.php`, { waitUntil: 'networkidle' });
  await expect(page.locator('main.content')).toContainText(/Ingreso|Acceso admin inicial/i);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});

test('legacy draw and redirect pages remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('404')) errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await adminLogin(page, 'editar_partidos.php');

  const drawLink = page.locator('a:visible[href*="sorteo_legacy_csv.php?match_id="]').first();
  if (await drawLink.count()) {
    await drawLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toContainText(/Generador(?: de Equipos)? GOODFELLAS/i);
    await expect(page.locator('body')).toContainText(/Jugadores disponibles/i);
  }

  await page.goto(`${BASE_URL}/consulta.php`, { waitUntil: 'networkidle' });
  await expect(page.locator('main.content')).toContainText(/Inicio|Proxima fecha|Historial/i);

  await page.goto(`${BASE_URL}/sorteo.php`, { waitUntil: 'networkidle' });
  await expect(page.locator('body')).toContainText(/Generador(?: de Equipos)? GOODFELLAS|Ingreso admin/i);

  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(horizontalOverflow).toBeFalsy();
  expect(errors).toEqual([]);
});
