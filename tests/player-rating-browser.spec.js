const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

test('creation preview uses the current policy and survives partial navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${BASE_URL}/login.php?next=jugadores.php`);
  await page.locator('#login-admin').evaluate(node => { node.open = true; });
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.waitForURL(url => url.pathname.endsWith('/jugadores.php'));
  const form = page.locator('.react-player-create-form');
  await expect(form).toHaveCount(1);
  await form.locator('xpath=..').evaluate(node => { node.open = true; });
  await form.locator('select[name="positions[]"]').first().selectOption('DEF');
  const slider = form.locator('input[name="defense_physical"]').locator('..').locator('[data-stat-rating-range]');
  await slider.evaluate(node => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, '6');
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const expected = await page.evaluate(() => {
    const stats = Object.fromEntries([...document.querySelectorAll('.react-player-create-form [data-stat-rating-input]')].map(node => [node.name, Number(node.value)]));
    return GoodfellasRating.card(GoodfellasRating.position(stats, 'DEF'));
  });
  await expect(form.locator('[data-general-card-value]')).toHaveText(String(expected));
  await expect(form.locator('input[name="defense_physical"]')).toHaveValue('6');
  // Simulate a fresh page policy without changing saved settings or player data.
  await page.evaluate(() => {
    const node = document.querySelector('[data-player-rating-policy]');
    const policy = JSON.parse(node.textContent);
    policy.weights.DEF = { defense_physical: 1 };
    node.textContent = JSON.stringify(policy);
  });
  await form.locator('select[name="positions[]"]').first().selectOption('MED');
  await form.locator('select[name="positions[]"]').first().selectOption('DEF');
  await expect(form.locator('[data-general-card-value]')).toHaveText('99');
  const link = page.locator('nav a[href="jugadores2.php"]').first();
  await link.evaluate(node => {
    const details = node.closest('details');
    if (details) details.open = true;
  });
  await page.evaluate(() => { window.ratingTestMarker = true; });
  await link.click();
  await page.waitForURL(url => url.pathname.endsWith('/jugadores2.php'));
  await expect(page.locator('[data-player-rating-policy]')).toHaveCount(1);
  expect(await page.evaluate(() => GoodfellasRating.policy().weights.DEF.defense_physical)).toBeLessThan(1);
  expect(await page.evaluate(() => window.ratingTestMarker)).toBe(true);
  expect(errors).toEqual([]);
});
