const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8001';
const ADMIN_PASSWORD = process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('main PHP pages avoid executable inline handlers/scripts', async () => {
  const repoRoot = path.resolve(__dirname, '..');
  const pages = [
    'capitanes.php',
    'equipos_manual.php',
    'finalizar_partido.php',
    'index.php',
    'jugadores2.php',
    'sorteo_legacy_csv.php',
  ];

  for (const page of pages) {
    const source = fs.readFileSync(path.join(repoRoot, page), 'utf8');
    expect(source, `${page} should not use inline event handlers`).not.toMatch(/\son(?:click|change|input|submit)=/i);
    const executableInlineScripts = [...source.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/json["'])[^>]*>/gi)];
    expect(executableInlineScripts, `${page} should not use executable inline scripts`).toHaveLength(0);
  }
});

function captureBrowserErrors(page) {
  const consoleErrors = [];
  const failedResponses = [];

  page.on('pageerror', (error) => {
    consoleErrors.push(`pageerror: ${error.message}`);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('ERR_SOCKET_NOT_CONNECTED')) {
      consoleErrors.push(`console: ${text}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return { consoleErrors, failedResponses };
}

async function adminLogin(page, next = 'index.php') {
  await page.goto(`${BASE_URL}/login.php?next=${encodeURIComponent(next)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.waitForURL((url) => url.href.includes(next.split('?')[0]), { timeout: 10000 });
  await page.waitForSelector('main.content');
}

async function clickAndCheckPartial(page, selector, expectedUrlPart, expectedSelector = 'main.content') {
  await page.evaluate(() => {
    window.__partialSmokeMarker = (window.__partialSmokeMarker || 0) + 1;
  });
  const markerBefore = await page.evaluate(() => window.__partialSmokeMarker);
  const beforeUrl = page.url();

  await page.locator(selector).click();
  await page.waitForURL((url) => url.href.includes(expectedUrlPart), { timeout: 10000 });
  await page.waitForSelector(expectedSelector, { timeout: 10000 });
  await wait(400);

  const markerAfter = await page.evaluate(() => window.__partialSmokeMarker).catch(() => null);
  return { beforeUrl, afterUrl: page.url(), partial: markerAfter === markerBefore };
}

test('progressive SPA navigation, legacy draw, and player row save', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 });
  const { consoleErrors, failedResponses } = captureBrowserErrors(page);

  await adminLogin(page);

  const checks = [];
  checks.push(await clickAndCheckPartial(page, 'nav a[href="jugadores2.php"]', 'jugadores2.php', 'text=Plantilla, posiciones y rendimiento actual.'));
  checks.push(await clickAndCheckPartial(page, 'nav a[href="estadisticas.php"]', 'estadisticas.php'));
  checks.push(await clickAndCheckPartial(page, 'nav a[href="editar_partidos.php"]', 'editar_partidos.php'));

  for (const check of checks) {
    expect(check.partial).toBeTruthy();
  }

  const sortLinks = page.locator('a[href^="sorteo_legacy_csv.php?match_id="]');
  if (await sortLinks.count()) {
    const legacyHref = await sortLinks.first().getAttribute('href');
    const redirectedHref = legacyHref.replace('sorteo_legacy_csv.php', 'sorteo_partido.php');

    await page.evaluate(() => {
      window.__partialSmokeMarker = (window.__partialSmokeMarker || 0) + 1;
    });
    const markerBefore = await page.evaluate(() => window.__partialSmokeMarker);

    await sortLinks.first().click();
    await page.waitForURL((url) => url.href.includes('sorteo_legacy_csv.php'), { timeout: 10000 });
    await page.waitForSelector('main.content .sorteo-page', { timeout: 10000 });
    await page.waitForSelector('#generateTeamsButton', { timeout: 10000 });
    await wait(700);

    await expect(page.locator('main.content')).toContainText('Generador de Equipos GOODFELLAS');
    expect(await page.evaluate(() => window.__partialSmokeMarker)).toBe(markerBefore);
    expect(await page.evaluate(() => typeof window.goodfellasPartialNavigate)).toBe('function');
    expect(await page.evaluate(() => typeof window.generarEquipos)).toBe('function');

    const colorSelects = page.locator('#team-color-settings select');
    if (await colorSelects.count()) {
      await colorSelects.first().selectOption({ index: 1 });
    }

    await page.locator('#generateTeamsButton').click();
    await page.waitForSelector('#equipos-generados .team', { timeout: 25000 });
    expect(await page.locator('#equipos-generados .team').count()).toBeGreaterThanOrEqual(2);
    await expect(page.locator('#success')).toContainText(/Equipos generados|mejor equilibrio/);

    await clickAndCheckPartial(page, 'button:has-text("Volver a fechas")', 'editar_partidos.php');
    await page.evaluate((href) => window.goodfellasPartialNavigate(href), redirectedHref);
    await page.waitForURL((url) => url.href.includes('sorteo_legacy_csv.php'), { timeout: 10000 });
    await page.waitForSelector('#generateTeamsButton', { timeout: 10000 });
    expect(await page.evaluate(() => typeof window.generarEquipos)).toBe('function');

    await clickAndCheckPartial(page, 'button:has-text("Volver a fechas")', 'editar_partidos.php');
    await sortLinks.first().click();
    await page.waitForURL((url) => url.href.includes('sorteo_legacy_csv.php'), { timeout: 10000 });
    await page.waitForSelector('#generateTeamsButton', { timeout: 10000 });
    await wait(700);
    expect(await page.evaluate(() => typeof window.generarEquipos)).toBe('function');
    await page.locator('#generateTeamsButton').click();
    await page.waitForSelector('#equipos-generados .team', { timeout: 25000 });
    expect(await page.locator('#equipos-generados .team').count()).toBeGreaterThanOrEqual(2);
  }

  await page.goto(`${BASE_URL}/jugadores.php`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main.content');
  await wait(500);

  const rowSaveButtons = page.locator('[data-player-row-save]');
  if (await rowSaveButtons.count()) {
    await page.evaluate(() => {
      window.__rowSaveMarker = 1;
    });
    await rowSaveButtons.first().scrollIntoViewIfNeeded();
    const beforeUrl = page.url();
    const beforeY = await page.evaluate(() => window.scrollY);

    await rowSaveButtons.first().click();
    await page.waitForSelector('[data-toast-stack]', { timeout: 10000 });
    await wait(500);

    expect(page.url()).toBe(beforeUrl);
    expect(await page.evaluate(() => window.__rowSaveMarker === 1)).toBeTruthy();
    expect(Math.abs((await page.evaluate(() => window.scrollY)) - beforeY)).toBeLessThanOrEqual(2);
  }

  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
