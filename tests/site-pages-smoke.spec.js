const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const ADMIN_PASSWORD = process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026';

const publicPages = [
  ['index.php', 'GOODFELLAS'],
  ['historial.php', 'Historial'],
  ['estadisticas.php', 'Estadísticas'],
  ['jugadores2.php', 'Jugadores'],
  ['jugadores-card-preview.php', 'Preview tarjetas'],
  ['login.php', 'Ingreso'],
];

const adminPages = [
  ['crear_partido.php', 'Crear fecha'],
  ['editar_partidos.php', 'Editar fechas'],
  ['directivos.php', 'Directivos'],
  ['junta_votaciones.php', 'Junta directiva'],
  ['configuracion.php', 'Pesos por posicion'],
  ['equipos_manual.php', 'Equipos manuales'],
  ['backup.php', 'Backup'],
  ['migrar_csv.php', 'Migracion desde CSV'],
  ['card_design_previews.php', 'Previews de card'],
  ['capitanes.php', 'Modo capitanes'],
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
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.waitForURL((url) => url.href.includes('editar_partidos.php'), { timeout: 10000 });

  for (const [path, heading] of adminPages) {
    const response = await page.goto(`${BASE_URL}/${path}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status(), path).toBeLessThan(400);
    await expect(page.locator('main.content')).toContainText(heading);
    if (path === 'configuracion.php') {
      await expect(page.locator('input[name^="position_weights["]').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Restaurar pesos por defecto/i })).toBeVisible();
    }
    if (path === 'migrar_csv.php') {
      await expect(page.locator('[data-react-island="migrar_csv_page"]')).toHaveCount(1);
      await expect(page.locator('input[name="action"][value="export_players"]')).toHaveCount(1);
      await expect(page.locator('input[name="action"][value="import_default"]')).toHaveCount(1);
      await expect(page.locator('input[name="action"][value="import_upload"]')).toHaveCount(1);
      await expect(page.locator('input[type="file"][name="csv_file"]')).toHaveCount(1);
    }
    if (path === 'equipos_manual.php') {
      await expect(page.locator('[data-react-island="equipos_manual_page"]')).toHaveCount(1);
      await expect(page.locator('main.content')).toContainText(/Fecha no encontrada/i);
    }
  }
});
