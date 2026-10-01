const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const MATCH_URL = `${BASE_URL}/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D188`;

test.use({ hasTouch: true });

/**
 * La busqueda de equipos es intensiva y antes bloqueaba el hilo principal durante toda la
 * generacion (la barra de progreso no se movia y la pagina quedaba congelada). Este test
 * cuida que el navegador siga pintando y que ningun bloque sea exagerado.
 */
test('la generacion de equipos no congela la interfaz', async ({ page }) => {
  test.setTimeout(300000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const state = { frames: 0, blocks: [], active: false, start: 0 };
    window.__gen = state;
    try {
      new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (state.active) state.blocks.push(Math.round(entry.duration));
        });
      }).observe({ entryTypes: ['longtask'] });
    } catch { /* longtask no disponible */ }
    const tick = () => {
      if (state.active) state.frames += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.__genStart = () => { state.frames = 0; state.blocks = []; state.start = performance.now(); state.active = true; };
    window.__genStop = () => {
      state.active = false;
      return {
        frames: state.frames,
        maxBlock: state.blocks.length ? Math.max(...state.blocks) : 0,
        blockTotal: state.blocks.reduce((sum, value) => sum + value, 0),
        wallMs: Math.round(performance.now() - state.start),
      };
    };
  });

  await page.goto(MATCH_URL);
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();

  await page.evaluate(() => window.__genStart());
  await page.locator('#generateTeamsButton').click();
  await expect(page.locator('[data-teams-scroller]')).toBeVisible({ timeout: 180000 });
  const metrics = await page.evaluate(() => window.__genStop());
  console.log('GENERATION-RESPONSIVENESS', JSON.stringify(metrics));

  // Con el trabajo cortado en porciones el navegador pinta muchas veces durante el sorteo.
  expect(metrics.frames).toBeGreaterThan(100);
  expect(metrics.maxBlock).toBeLessThan(2500);
});
