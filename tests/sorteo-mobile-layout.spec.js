const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';

test('mobile pitch keeps cards, ratings and projected laterals inside their rows', async ({ page }) => {
  test.setTimeout(90000);
  const consoleErrors = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
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

  for (const width of [320, 360, 390, 412, 430, 760, 820, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `page overflow at ${width}px`).toBeLessThanOrEqual(width);
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
            const name = card.querySelector('.gf-player-name').getBoundingClientRect();
            if (name.bottom > rect.bottom + 1 || name.left < rect.left || name.right > rect.right) errors.push('name escapes card');
            const rating = card.querySelector('.sorteo-compact-rating > strong').getBoundingClientRect();
            const photo = card.querySelector('.sorteo-compact-photo').getBoundingClientRect();
            if (photo.width < 1 || photo.height < 1) errors.push('photo has no visible area');
            if (overlaps(rating, photo)) errors.push('photo covers rating');
          });
        }
      }
      return errors;
    });
    expect(problems, `pitch layout at ${width}px`).toEqual([]);
    if (width === 320) {
      await pitches.first().evaluate((field) => field.scrollIntoView({ block: 'start' }));
      await page.locator('.gf-pitch-panel').first().screenshot({ path: 'test-results/sorteo-mobile-320.png' });
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  const heights = await pitches.evaluateAll((fields) => fields.map((field) => field.getBoundingClientRect().height));
  expect(Math.abs(heights[0] - heights[1])).toBeLessThan(1);
  await pitches.first().screenshot({ path: 'test-results/sorteo-cancha-desktop.png' });

  expect(consoleErrors).toEqual([]);

  // DOM-only stress fixtures: no assignment or stored player data is modified.
  for (const width of [320, 760, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const count of [1, 2, 3, 4, 5]) {
      const issues = await pitches.first().evaluate((field, count) => {
        const row = field.querySelector('[data-sorteo-drop-line=MED]');
        const line = row.querySelector('.line-players');
        const template = field.querySelector('[data-sorteo-line-player-item]').cloneNode(true);
        row.style.setProperty('--gf-player-count', count);
        line.dataset.playerCount = String(count);
        line.replaceChildren(...Array.from({ length: count }, (_, i) => {
          const slot = template.cloneNode(true);
          slot.querySelector('.gf-player-name-text').textContent = i % 2 ? 'Juan Francisco Apellido Muy Largo' : 'Leo';
          slot.querySelector('.gf-player-name').style.fontSize = i % 2 ? 'clamp(5px, 9cqw, 12px)' : 'clamp(7px, 13cqw, 14px)';
          if (i % 2) slot.querySelector('img').src = '/assets/players/default-player-silhouette.png';
          if (!slot.querySelector('.sorteo-position-penalty')) {
            const badge = document.createElement('span'); badge.className = 'sorteo-position-penalty'; badge.textContent = '-25%'; slot.querySelector('button').append(badge);
          }
          return slot;
        }));
        const cards = [...line.querySelectorAll('button[data-card-tier]')];
        const errors = [];
        const bounds = line.getBoundingClientRect();
        cards.forEach((card, i) => {
          const r = card.getBoundingClientRect();
          const name = card.querySelector('.gf-player-name');
          if (r.top < bounds.top - 1 || r.bottom > bounds.bottom + 1) errors.push('card escapes row height');
          if (r.left < bounds.left - 1 || r.right > bounds.right + 1) errors.push('card escapes usable field');
          const text = name.querySelector('.gf-player-name-text');
          if (text.getBoundingClientRect().bottom > name.getBoundingClientRect().bottom + 1) errors.push('name escapes internal area');
          if (text.scrollHeight > text.clientHeight + 1 && getComputedStyle(text).webkitLineClamp !== '2') errors.push('long name lacks ellipsis');
          if (cards[i + 1]) { const next = cards[i + 1].getBoundingClientRect(); if (r.left < next.right && r.right > next.left && r.top < next.bottom && r.bottom > next.top) errors.push('overlap'); }
        });
        return errors;
      }, count);
      expect(issues, `${count} players at ${width}px`).toEqual([]);
    }
  }
});
