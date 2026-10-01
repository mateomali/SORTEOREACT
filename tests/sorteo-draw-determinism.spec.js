const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const MATCH_URL = `${BASE_URL}/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D188`;
const SNAPSHOT = path.join(__dirname, 'fixtures', 'draw-snapshot.json');
const SEEDS = [123456789, 987654321, 24681357];

test.use({ hasTouch: true });

/**
 * El sorteo usa Math.random, asi que se reemplaza por un generador con semilla fija para
 * poder comparar resultados entre corridas. Protege al algoritmo de balance (y sus
 * optimizaciones) de cambios silenciosos en el resultado.
 */
async function generateWithSeed(page, seed) {
  await page.goto(MATCH_URL);
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.evaluate((nextSeed) => {
    let state = nextSeed >>> 0;
    Math.random = () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }, seed);
  await page.locator('#generateTeamsButton').click();
  await expect(page.locator('[data-teams-scroller]')).toBeVisible({ timeout: 180000 });
  await page.waitForTimeout(200);
  return page.evaluate(() => [...document.querySelectorAll('[data-sorteo-team-card]')].map((card) => (
    [...card.querySelectorAll('[data-sorteo-drag-player]')]
      .map((node) => ({ key: node.dataset.playerKey, position: node.dataset.assignedPosition }))
      .sort((a, b) => (a.key < b.key ? -1 : 1))
  )));
}

test('el sorteo da siempre el mismo resultado con la misma semilla', async ({ page }) => {
  test.setTimeout(600000);
  const results = {};
  for (const seed of SEEDS) {
    results[`seed-${seed}`] = await generateWithSeed(page, seed);
  }
  const serialized = `${JSON.stringify(results, null, 2)}\n`;
  if (process.env.DRAW_SNAPSHOT_WRITE === '1') {
    fs.writeFileSync(SNAPSHOT, serialized);
    return;
  }
  expect(fs.existsSync(SNAPSHOT), `falta el archivo de referencia ${SNAPSHOT}`).toBe(true);
  expect(serialized).toBe(fs.readFileSync(SNAPSHOT, 'utf8'));
});
