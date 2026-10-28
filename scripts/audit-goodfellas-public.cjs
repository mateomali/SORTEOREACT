// Read-only browser baseline. Never submits forms or authenticates.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const output = path.resolve('outputs/goodfellas-2-audit-20261028');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const width of [320, 360, 390, 430, 768, 1024, 1440, 1920]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
      for (const route of ['index.php', 'jugadores2.php', 'estadisticas.php', 'historial.php', 'login.php', 'propuestas_equipos.php']) {
        const url = `https://www.sudokumerlo.com/sorteo/${route}`;
        try {
          const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
          const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
          const screenshot = `${route.replace('.php', '')}-${width}.png`;
          await page.screenshot({ path: path.join(output, screenshot), fullPage: true });
          results.push({ route, width, status: response.status(), ...dimensions, screenshot, errors: errors.splice(0) });
        } catch (error) {
          results.push({ route, width, error: error.message });
          // Unreachable host: preserve evidence and stop instead of repeating 48 timeouts.
          throw error;
        }
      }
      await page.close();
    }
  } finally {
    fs.writeFileSync(path.join(output, 'baseline.json'), JSON.stringify(results, null, 2));
    await browser.close();
    console.log(JSON.stringify({
      output,
      completed: results.filter(result => result.screenshot).length,
      failures: results.filter(result => result.error),
      overflow: results.filter(result => result.document > result.viewport),
      consoleErrors: results.filter(result => result.errors?.length),
    }, null, 2));
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
