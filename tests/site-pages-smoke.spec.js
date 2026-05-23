const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const ADMIN_PASSWORD = process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026';

const publicPages = [
  ['index.php', 'Inicio'],
  ['historial.php', 'Historial'],
  ['estadisticas.php', 'Estadisticas'],
  ['jugadores2.php', 'Jugadores'],
  ['login.php', 'Ingreso'],
];

const adminPages = [
  ['crear_partido.php', 'Crear fecha'],
  ['editar_partidos.php', 'Editar fechas'],
  ['directivos.php', 'Directivos'],
  ['junta_votaciones.php', 'Junta directiva'],
  ['backup.php', 'Backup'],
];

test('public pages load without browser errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  for (const [path, heading] of publicPages) {
    const response = await page.goto(`${BASE_URL}/${path}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.locator('main.content')).toContainText(heading);
  }

  expect(errors).toEqual([]);
});

test('admin pages load after login', async ({ page }) => {
  await page.goto(`${BASE_URL}/login.php?next=${encodeURIComponent('editar_partidos.php')}`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="password"]').first().fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.waitForURL((url) => url.href.includes('editar_partidos.php'), { timeout: 10000 });

  for (const [path, heading] of adminPages) {
    const response = await page.goto(`${BASE_URL}/${path}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.locator('main.content')).toContainText(heading);
  }
});
