const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const catalog = JSON.parse(execFileSync('php', [], {
  input: '<?php require "lib/awards.php"; echo json_encode([award_definitions(), award_descriptions(), award_definitions(true)]);',
  encoding: 'utf8',
}));

test('award catalog preserves historical codes and contains the requested 17 awards', () => {
  expect(Object.values(catalog[0]).map((award) => award.label)).toEqual([
    'Man of the Match', 'Gol de la fecha', 'Lírico', 'Pelusa', 'Bochini',
    'Pase magistral', 'El Mariscal', 'El muro', 'El tractor', 'Capocannoniere',
    'Golero imbatible', 'Terminator', 'La guinda', 'La golosa', 'La putita',
    'Chenemigo', 'Goodfellas',
  ]);
  expect(catalog[0].ghost).toBeUndefined();
  expect(catalog[2].ghost.label).toBe('El fantasma');
  for (const code of Object.keys(catalog[0])) expect(catalog[1][code]).toBeTruthy();
});

for (const mode of ['both', 'awards', 'ratings']) {
  test(`award clearing submits an empty field and preserves other selections: ${mode}`, async ({ page }) => {
    const awards = Object.entries(catalog[0]).map(([code, award]) => ({
      ...award, code, description: catalog[1][code], listId: 'matchAwardPlayers',
      value: code === 'player_of_match' ? 'Jugador Uno (#1)' : '', winner: '-',
    }));
    const payload = {
      isDirectivo: true, hasMatches: true, openVoteMatches: [], historyVoteMatches: [],
      selectedMatch: {
        id: 204, label: 'Fecha de prueba', isOpen: true, currentVoteMemberId: 7,
        ratingsEnabled: mode !== 'awards', awardsEnabled: mode !== 'ratings',
        submitted: 0, eligible: 2, progress: 0, isDirectivo: true,
        participants: [{ id: 1, name: 'Jugador Uno', awardValue: 'Jugador Uno (#1)', ratingValue: '5', teamLabel: 'Equipo 1' }],
        awards, inviteRows: [], invitePlayerOptions: [],
      },
    };
    await page.route('http://awards.test/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/assets/')) {
        return route.fulfill({ body: fs.readFileSync(path.join(process.cwd(), url.pathname)), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript' });
      }
      await route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><div data-react-root data-react-island="junta_votaciones_page"><script type="application/json">${JSON.stringify(payload)}</script></div><script type="module" src="/assets/react/react-app.js"></script>` });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://awards.test/junta_votaciones.php?match_id=204');
    if (mode === 'ratings') {
      await expect(page.locator('[name^="awards["]')).toHaveCount(0);
      await expect(page.locator('[name="rating[1]"]')).toBeVisible();
      return;
    }
    await expect(page.locator('[name^="awards["]')).toHaveCount(17);
    await expect(page.locator('#award-player_of_match')).toHaveValue('Jugador Uno (#1)');
    await expect(page.getByRole('button', { name: /^Quitar selección de / })).toHaveCount(1);
    await page.locator('#award-pelusa').fill('Jugador');
    await expect(page.getByRole('button', { name: 'Quitar selección de Pelusa', exact: true })).toHaveCount(0);
    await page.locator('#award-pelusa').fill('Jugador Uno (#1)');
    await expect(page.getByRole('button', { name: 'Quitar selección de Pelusa', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Quitar selección de Man of the Match', exact: true }).click();
    await expect(page.locator('#award-player_of_match')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Quitar selección de Man of the Match', exact: true })).toHaveCount(0);
    await expect(page.locator('#award-pelusa')).toHaveValue('Jugador Uno (#1)');
    const values = await page.locator('form[data-junta-vote-submit]').evaluate((form) => Object.fromEntries(new FormData(form)));
    expect(values['awards[player_of_match]']).toBe('');
    expect(values['awards[pelusa]']).toBe('Jugador Uno (#1)');
    await page.locator('#award-player_of_match').fill('Jugador Uno (#1)');
    await expect(page.locator('#award-player_of_match')).toHaveValue('Jugador Uno (#1)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
