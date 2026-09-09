const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

test('mobile pitch keeps cards, ratings and projected laterals inside their rows', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`${BASE_URL}/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D188`);
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.locator('#generateTeamsButton').click();
  const pitches = page.locator('.team-formation');
  await expect(pitches).toHaveCount(2, { timeout: 60000 });

  // This changes the local preview only; the test never saves a draw.
  const alternative = page.locator('[data-sorteo-team-card]').first().getByRole('button', { name: /Alternativa 2/ });
  if (await alternative.count()) await alternative.click();

  for (const width of [320, 360, 390, 430, 760]) {
    await page.setViewportSize({ width, height: 900 });
    const problems = await pitches.evaluateAll((fields) => {
      const errors = [];
      const overlaps = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
      for (const field of fields) {
        for (const row of field.querySelectorAll('.formation-line')) {
          const bounds = row.getBoundingClientRect();
          const cards = [...row.querySelectorAll('button[data-card-tier]')];
          const label = row.querySelector('.line-label').getBoundingClientRect();
          cards.forEach((card, index) => {
            const rect = card.getBoundingClientRect();
            if (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1 || rect.left < bounds.left - 1 || rect.right > bounds.right + 1) errors.push('card escapes row');
            if (overlaps(rect, label)) errors.push('card covers row controls');
            for (const other of cards.slice(index + 1)) {
              if (overlaps(rect, other.getBoundingClientRect())) errors.push('cards overlap');
            }
            const rating = card.querySelector('.sorteo-compact-rating > strong').getBoundingClientRect();
            const photo = card.querySelector('.sorteo-compact-photo').getBoundingClientRect();
            if (overlaps(rating, photo)) errors.push('photo covers rating');
          });
        }
      }
      return errors;
    });
    expect(problems, `pitch layout at ${width}px`).toEqual([]);
    if (width === 320) {
      await pitches.first().evaluate((field) => field.scrollIntoView({ block: 'start' }));
      await pitches.first().screenshot({ path: 'test-results/sorteo-mobile-320.png' });
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  const heights = await pitches.evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().height));
  expect(heights).toEqual([600, 600]);
});
