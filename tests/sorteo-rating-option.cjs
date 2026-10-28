const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const players = Array.from({ length: 2 }, (_, team) => ['ARQ', 'DEF', 'DEF', 'MED', 'DEL'].map((positions, index) => ({
        id: team * 5 + index + 1, name: `Player ${team * 5 + index + 1}`, positions,
        skill: 4, technique: 4, pass_vision: 4, rhythm: 4, stamina: 4,
        defense_physical: 4, attack: 4, teamwork: 4, mentality: 4, regularity: 3.5, goalkeeper_skill: 4,
      }))).flat();
      const payload = { matchId: 999, players, numTeams: 2, teamColors: ['ROSA', 'AZUL'], links: {} };
      let posted;
      await page.route('http://fixture.test/**', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/guardar_sorteo.php') {
          posted = route.request().postDataJSON();
          await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ ok: false, message: 'Captured test request' }) });
        } else if (url.pathname.startsWith('/assets/')) {
          const file = path.join(process.cwd(), url.pathname.slice(1));
          const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
          if (fs.existsSync(file)) await route.fulfill({ contentType: type, body: fs.readFileSync(file) });
          else await route.fulfill({ status: 404, body: '' });
        } else {
          await route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"></head><body><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${fs.readFileSync('assets/player-rating-policy.json', 'utf8')}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div><script type="module" src="/assets/react/react-app.js"></script></body></html>` });
        }
      });
      await page.goto('http://fixture.test/');
      const choice = page.locator('#draw-rating-mode');
      await choice.selectOption('general');
      const generate = page.locator('#generateTeamsButton');
      assert.ok((await choice.boundingBox()).y < (await generate.boundingBox()).y, 'Choice must precede the draw button');
      await generate.click();
      await page.locator('[data-sorteo-team-card]').first().waitFor({ timeout: 120000 });
      assert.equal(await page.locator('.sorteo-position-penalty').count(), 0, 'Disabled adjustment must show no penalties');
      // Changing the next-draw choice must not alter the already generated teams or their saved rule.
      await choice.selectOption('penalty');
      const save = width < 760
        ? page.getByRole('button', { name: 'Guardar', exact: true }).first()
        : page.getByRole('button', { name: 'Guardar equipos y continuar', exact: true });
      await save.click();
      await page.getByText('Captured test request', { exact: true }).waitFor();
      assert.equal(posted.position_rating_discount, false);
      assert.equal(posted.teams.length, 2);
      assert.equal(posted.teams.flatMap(team => team.players).filter(player => player.assigned_position === 'ARQ').length, 2);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('PASS: pre-draw choice, generation, goalkeeper rules and saved rule at mobile/desktop widths');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
