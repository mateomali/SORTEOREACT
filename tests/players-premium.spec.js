const { test, expect } = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const OUTPUT = 'outputs/players-premium';

async function assertFits(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function assertTextContrast(locator) {
  const ratio = await locator.evaluate(el => {
    const rgb = value => value.match(/[\d.]+/g).map(Number);
    const style = getComputedStyle(el);
    const foreground = rgb(style.webkitTextFillColor || style.color);
    let background;
    for (let node = el; node; node = node.parentElement) {
      const candidate = rgb(getComputedStyle(node).backgroundColor);
      if (candidate.length === 3 || candidate[3] === 1) { background = candidate; break; }
    }
    if (!background) throw new Error('No opaque background found');
    const luminance = color => color.slice(0,3).map(channel => {
      const srgb = channel / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
}

test('directory stays usable at all eight target widths', async ({ page }) => {
  test.setTimeout(120000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/jugadores2.php`);
    await expect(page.getByRole('heading', { name: 'Jugadores', exact: true })).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Buscar jugador' })).toBeVisible();
    for (const selector of ['h1', '.players-directory-list-heading h2', 'input[type="search"]', '.directory-sort select', '.directory-rating strong']) {
      await assertTextContrast(page.locator(`${selector}:visible`).first());
    }
    await assertFits(page);
    await page.screenshot({ path: `${OUTPUT}/list-${width}.png` });
    // Both actions remain reachable and labelled at phone widths.
    for (const selector of ['.directory-credential', '.directory-open']) {
      const button = page.locator(`${selector}:visible`).first();
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
  expect(errors).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`search, position, sort, profile, radar and credential at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/jugadores2.php`);
    const payload = await page.locator('[data-react-island="jugadores2_page"]').evaluate(el => JSON.parse(el.dataset.payload));
    const search = page.getByRole('searchbox', { name: 'Buscar jugador' });
    await search.fill('NO-EXISTE-TEST-GF2');
    await expect(page.getByText('No hay jugadores que coincidan con la busqueda.')).toBeVisible();
    await search.fill('');
    const position = payload.positions.find(position => payload.players.some(player => player.positions.includes(position.value)));
    await page.getByRole('group', { name: 'Filtrar por posición' }).getByRole('button', { name: position.value, exact: true }).click();
    const expected = payload.players.filter(player => player.positions.includes(position.value)).length;
    await expect(page.getByRole('status')).toContainText(`${expected} de ${payload.players.length}`);
    await page.getByRole('button', { name: 'Todos', exact: true }).click();
    await page.getByLabel('Ordenar por').selectOption('overall:desc');
    const highest = payload.players.slice().sort((a,b) => b.overall-a.overall || a.name.localeCompare(b.name, 'es-AR'))[0];
    const firstRow = page.locator(width < 768 ? '.players-directory-mobile article' : '.players-directory-table tbody tr').first();
    await expect(firstRow).toContainText(highest.name);
    await firstRow.locator('.directory-credential').click();
    const credential = page.getByRole('dialog', { name: `Credencial de ${highest.name}`, exact: true });
    await expect(credential).toBeVisible();
    await expect(credential).toContainText(highest.name);
    await page.screenshot({ path: `${OUTPUT}/credential-${width}.png` });
    await page.getByRole('button', { name: 'Cerrar credencial', exact: true }).last().click();
    await firstRow.locator('.directory-open').click();
    const profile = page.getByRole('dialog', { name: `Ficha de ${highest.name}`, exact: true });
    await expect(profile).toBeVisible();
    await assertFits(page);
    await page.screenshot({ path: `${OUTPUT}/profile-${width}.png` });
    await profile.getByRole('button', { name: `Ver radar completo de ${highest.name}` }).click();
    await expect(page.getByRole('dialog', { name: `Radar completo de ${highest.name}` })).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar radar', exact: true }).last().click();
    await profile.getByRole('tab', { name: 'Premios', exact: true }).click();
    await expect(profile.getByRole('tabpanel', { name: 'Premios', exact: true })).toBeVisible();
    await page.screenshot({ path: `${OUTPUT}/profile-awards-${width}.png` });
    await profile.getByRole('button', { name: 'Cerrar ficha', exact: true }).click();
  });
}

test('theme follows partial navigation without changing the home theme', async ({ page }) => {
  await page.goto(`${BASE}/index.php`);
  const original = await page.locator('main.content').evaluate(el => getComputedStyle(el).backgroundColor);
  await page.waitForFunction(() => typeof window.goodfellasPartialNavigate === 'function');
  await page.evaluate(() => { window.__premiumNavigation = true; });
  await page.evaluate(() => window.goodfellasPartialNavigate('jugadores2.php'));
  await expect(page.locator('body')).toHaveClass(/goodfellas-2/);
  await expect(page.locator('.directory-avatar:visible').first()).toBeVisible();
  expect(await page.evaluate(() => window.__premiumNavigation)).toBe(true);
  await page.evaluate(() => window.goodfellasPartialNavigate('index.php'));
  await expect(page.locator('body')).not.toHaveClass(/goodfellas-2/);
  expect(await page.locator('main.content').evaluate(el => getComputedStyle(el).backgroundColor)).toBe(original);
});

for (const width of [320, 1440]) {
  test(`admin controls and editor remain available at ${width}px without saving`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/login.php?next=jugadores2.php`);
    await page.getByRole('button', { name: 'Administrador', exact: true }).click();
    await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
    await page.getByRole('button', { name: 'Entrar como admin', exact: true }).click();
    await page.waitForURL(url => url.pathname.endsWith('/jugadores2.php'));
    await expect(page.locator('body')).toHaveClass(/goodfellas-2/);
    await expect(page.locator('main.content')).toHaveCSS('background-color', 'rgb(16, 21, 19)');
    await expect(page.getByRole('link', { name: 'Ver inactivos', exact: true }).last()).toBeVisible();
    await page.locator('.directory-open:visible').first().click();
    const profile = page.getByRole('dialog').first();
    await expect(profile.locator('input[name="name"]')).toBeVisible();
    await assertTextContrast(profile.locator('input[name="name"]'));
    await assertTextContrast(profile.locator('.player-story p').first());
    await expect(profile.getByRole('button', { name: 'Eliminar jugador', exact: true })).toBeAttached();
    await assertFits(page);
    await page.screenshot({ path: `${OUTPUT}/admin-${width}.png` });
    await profile.getByRole('button', { name: 'Cerrar ficha', exact: true }).click();
    await page.goto(`${BASE}/jugadores2.php?create=1#crear-jugador`);
    await expect(page.locator('#crear-jugador')).toHaveAttribute('open', '');
    await expect(page.locator('#crear-jugador input[name="name"]')).toBeVisible();
    await assertFits(page);
    await page.screenshot({ path: `${OUTPUT}/create-${width}.png` });
  });
}
