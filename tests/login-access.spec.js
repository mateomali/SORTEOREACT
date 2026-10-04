const { test, expect } = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
for (const width of [1440, 390, 320]) {
  test(`login access and password visibility at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${BASE}/login.php`);
    await expect(page.getByRole('heading', { name: 'Iniciar sesi\u00f3n' })).toBeVisible();
    await expect(page.getByLabel('Usuario', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Administrador', exact: true })).toBeInViewport();
    for (const id of ['userPassword', 'adminPassword']) {
      if (id === 'adminPassword') await page.getByRole('button', { name: 'Administrador', exact: true }).click();
      const input = page.locator(`#${id}`);
      const toggle = page.locator(`[aria-controls="${id}"]`);
      await input.fill('test-visibility');
      await toggle.click();
      await expect(input).toHaveAttribute('type', 'text');
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await toggle.click();
      await expect(input).toHaveAttribute('type', 'password');
      expect(await input.inputValue()).toBe('test-visibility');
    }
    await expect(page.getByRole('button', { name: 'Entrar como admin' })).toBeInViewport();
    await expect(page.locator('#loginUsername')).toBeHidden();
    await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await expect(page.getByLabel('Mi jugador')).toBeInViewport();
    await expect(page.locator('#adminPassword')).toBeHidden();
    await page.getByLabel('Usuario', { exact: true }).last().fill('borrador');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page.locator('#userPassword')).toHaveValue('test-visibility');
    await page.getByRole('button', { name: 'Crear usuario', exact: true }).click();
    await expect(page.locator('#registerUsername')).toHaveValue('borrador');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `outputs/login-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}
test('failed login preserves username and destination', async ({ page }) => {
  await page.goto(`${BASE}/login.php?next=editar_partidos.php`);
  await page.locator('#loginUsername').fill('usuario_prueba_inexistente');
  await page.locator('#userPassword').fill('clave-incorrecta');
  await page.locator('#access-login button[type="submit"]').first().click();
  await expect(page.locator('.flash-error')).toContainText('Usuario o clave incorrectos');
  await expect(page.locator('#loginUsername')).toHaveValue('usuario_prueba_inexistente');
  await expect(page.locator('#access-login input[name="next"]')).toHaveValue('editar_partidos.php');
});
test('global admin login reaches administration', async ({ page }) => {
  await page.goto(`${BASE}/login.php?next=editar_partidos.php`);
  await page.getByRole('button', { name: 'Administrador', exact: true }).click();
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: 'Entrar como admin' }).click();
  await expect(page).toHaveURL(/editar_partidos\.php/);
});

