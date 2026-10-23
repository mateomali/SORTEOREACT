const { test, expect } = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
for (const width of [390, 760]) {
  test(`mobile menu hierarchy and active award destination at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/jugadores2.php?tab=awards`);
    const toggle = page.locator('#menuToggle');
    await toggle.click();
    const nav = page.getByRole('navigation', { name: 'Navegacion principal' });
    await expect(nav).toBeVisible();
    await expect(nav.locator(':scope > a').nth(1)).toHaveText('Iniciar sesi\u00f3n');
    await expect(nav.locator('a[href="login.php"]')).toHaveCount(1);
    await nav.locator('summary').filter({ hasText: 'Jugadores' }).click();
    const awards = nav.getByRole('link', { name: 'Premios', exact: true });
    const profiles = nav.getByRole('link', { name: 'Fichas', exact: true });
    await expect(awards).toHaveClass(/gf-nav-current/);
    await expect(profiles).not.toHaveClass(/gf-nav-current/);
    await expect(awards).toHaveCSS('background-color', 'rgb(220, 235, 207)');
    await expect(awards).toHaveCSS('color', 'rgb(23, 60, 37)');
    await expect(nav).toHaveCSS('background-color', 'rgb(16, 44, 32)');
    await expect(profiles).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Estadísticas', exact: true })).toBeVisible();
    expect(await nav.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: `outputs/mobile-menu-hierarchy-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await nav.locator('summary').filter({ hasText: 'Jugadores' }).click();
    await profiles.click();
    await expect(page.getByRole('tab', { name: 'Jugadores', exact: true })).toHaveAttribute('aria-selected', 'true');
  });
}
