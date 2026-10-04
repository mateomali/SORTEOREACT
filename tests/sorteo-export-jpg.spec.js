const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8000';
const MATCH_URL = `${BASE_URL}/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D188`;

test.use({ hasTouch: true });

async function openSorteo(page) {
  await page.goto(MATCH_URL);
  await page.locator('#login-admin').evaluate((node) => { node.open = true; });
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button', { name: /Entrar como admin|Ingresar/i }).click();
  await page.locator('#generateTeamsButton').click();
  await expect(page.locator('[data-teams-scroller]')).toBeVisible({ timeout: 90000 });
}

async function downloadJpg(page, name) {
  await page.locator('.gf-player-name-text').first().evaluate(node => { node.textContent = 'JUAN FRANCISCO DEL CAMPO'; });
  await page.evaluate(() => {
    window.exportContent = null;
    const observer = new MutationObserver(() => {
      const copy = document.querySelector('[data-export-formations]');
      if (!copy) return;
      window.exportContent = {
        names: [...copy.querySelectorAll('.gf-player-name')].map(node => ({ text: node.textContent, fits: node.firstElementChild.scrollHeight <= node.clientHeight + 1 && node.firstElementChild.scrollWidth <= node.clientWidth + 1, clamp: getComputedStyle(node.firstElementChild).webkitLineClamp })),
        teams: copy.querySelectorAll('[data-sorteo-team-card]').length,
        comparison: copy.querySelector('[data-export-comparison]')?.textContent,
        scores: [...copy.querySelectorAll('.gf-premium-score strong')].map(node => node.textContent),
        backgrounds: [...copy.querySelectorAll('[data-export-pitch-background]')].map(node => node.style.backgroundImage),
        sections: [...copy.querySelectorAll('.gf-premium-team')].map(panel => [...panel.children].map(node => node.matches('.team-head') ? 'title' : node.matches('.team-formation') ? 'pitch' : node.matches('[data-exportable-line-balance]') ? 'balance' : 'extra')),
        markings: copy.querySelectorAll('.gf-premium-pitch-markings').length,
        balanceValues: [...copy.querySelectorAll('[role=meter]')].map(node => Number(node.getAttribute('aria-valuenow'))),
        editingButtons: copy.querySelectorAll('button:not([data-sorteo-drag-player])').length,
        extras: copy.querySelectorAll('select, [data-team-bench], .sorteo-team-stats').length,
      };

    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  });
  const downloadReady = page.waitForEvent('download');
  await page.locator('details').filter({ hasText: 'Exportar' }).first().locator('summary').click();
  await page.getByRole('button', { name: 'Exportar JPG', exact:true }).click();
  const download = await downloadReady;
  const exportPath = path.join('test-results', `${name ? 'desktop' : 'mobile'}-jpg-export.jpg`);
  fs.mkdirSync('test-results', { recursive: true });
  await download.saveAs(exportPath);
  const content = await page.evaluate(() => window.exportContent);
  expect(content.comparison).toContain('Comparación rápida');
  expect(content.names.some(name => name.text.trim() === 'JUAN FRANCISCO DEL CAMPO')).toBe(true);
  content.names.forEach(name => { expect(name.fits, name.text).toBe(true); expect(name.clamp).not.toBe('2'); });
  expect(content.comparison).toContain('General');
  content.scores.forEach(score => expect(score).toMatch(/\d+\.\d/));
  content.backgrounds.forEach(background => expect(background).toContain('linear-gradient'));
  expect(content).toMatchObject({ teams: 2, sections: [['title', 'pitch', 'balance'], ['title', 'pitch', 'balance']], markings: 2, editingButtons: 0, extras: 0 });
  expect(content.balanceValues).toHaveLength(6);
  content.balanceValues.forEach(value => { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(100); });
  return fs.readFileSync(exportPath).toString('base64');
}

/** Analiza la captura: tamano, franjas verdes de cancha y marcas grises de borde. */
async function analyseExport(page, base64) {
  return page.evaluate(async (data) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${data}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const pitchRows = [];
    const titleRows = [];
    let grayRuns = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      const pixels = context.getImageData(0, y, canvas.width, 1).data;
      let green = 0;
      let white = 0;
      let grayRun = 0;
      for (let x = 0; x < canvas.width; x += 1) {
        const index = x * 4;
        const [r, g, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];
        if (g > r + 10 && g > b + 3 && g > 20 && g < 150) green += 1;
        if (r > 235 && g > 235 && b > 235) white += 1;
        if (Math.abs(r - g) <= 3 && Math.abs(g - b) <= 3 && r > 200 && r < 210) {
          grayRun += 1;
          if (grayRun >= canvas.width * 0.75) grayRuns += 1;
        } else {
          grayRun = 0;
        }
      }
      if (green > canvas.width * 0.25) pitchRows.push(y);
      // El titulo del equipo es texto sobre fondo claro: banda blanca entre canchas.
      if (white > canvas.width * 0.5) titleRows.push(y);
    }
    const merge = (rows) => {
      const bands = [];
      rows.forEach((y) => {
        const current = bands[bands.length - 1];
        if (current && y - current.end <= 40) current.end = y;
        else bands.push({ start: y, end: y });
      });
      return bands;
    };
    return {
      width: canvas.width,
      height: canvas.height,
      pitchBands: merge(pitchRows).filter((band) => band.end - band.start > 250),
      titleBands: merge(titleRows).filter((band) => band.end - band.start > 8),
      grayRuns,
    };
  }, base64);
}

test('la captura JPG en movil apila los equipos y conserva todo el texto', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openSorteo(page);
  await page.locator('#download-controls').scrollIntoViewIfNeeded();

  const geometry = await page.locator('[data-teams-scroller]').evaluate((node) => ({
    cardWidth: Math.round(node.querySelector('[data-sorteo-team-card]').getBoundingClientRect().width),
    cardHeights: [...node.querySelectorAll('[data-sorteo-team-card]')].map((card) => Math.round(card.querySelector('.team-formation').getBoundingClientRect().height)),
    carouselWidth: Math.round(node.scrollWidth),
  }));
  expect(geometry.cardHeights).toHaveLength(2);

  const base64 = await downloadJpg(page);
  const exportInfo = await analyseExport(page, base64);

  // Un equipo debajo del otro: ancho de una cancha y alto de las dos tarjetas sumadas.
  expect(exportInfo.width).toBeLessThanOrEqual(geometry.cardWidth * 1.5);
  expect(exportInfo.width).toBeGreaterThanOrEqual(geometry.cardWidth * 0.9);
  expect(exportInfo.height).toBeGreaterThanOrEqual((geometry.cardHeights[0] + geometry.cardHeights[1]) * 0.9);
  // Las dos canchas aparecen enteras y separadas verticalmente.
  expect(exportInfo.pitchBands.length).toBeGreaterThanOrEqual(2);
  expect(exportInfo.pitchBands[1].start).toBeGreaterThan(exportInfo.pitchBands[0].end);
  // Sin marcas grises de borde (sombras que html2canvas dibujaba como marcos).
  expect(exportInfo.grayRuns).toBe(0);
});

test('la captura JPG en escritorio apila solo nombres y canchas', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openSorteo(page);
  await page.locator('#download-controls').scrollIntoViewIfNeeded();

  const geometry = await page.locator('#equipos-generados').evaluate((node) => ({
    width: Math.round(node.querySelector('[data-sorteo-team-card]').getBoundingClientRect().width),
    height: Math.round(node.getBoundingClientRect().height),
  }));

  const base64 = await downloadJpg(page, 'Exportar JPG');
  const exportInfo = await analyseExport(page, base64);

  expect(exportInfo.width).toBeGreaterThanOrEqual(geometry.width - 2);
  // Tambien en escritorio se comparten las canchas una debajo de la otra.
  expect(exportInfo.pitchBands.length).toBeGreaterThanOrEqual(2);
  expect(exportInfo.grayRuns).toBe(0);
});

test('los botones de la barra movil mantienen 44px de alto', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await openSorteo(page);
  await page.locator('#download-controls').scrollIntoViewIfNeeded();

  const bar = page.locator('[data-sorteo-mobile-actions="1"]');
  await expect(bar).toBeVisible();
  const buttons = await bar.locator('button').evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { text: node.textContent.trim(), height: Math.round(rect.height), width: Math.round(rect.width), overflows: node.scrollWidth > node.clientWidth + 1 };
  }));
  expect(buttons.length).toBe(1);
  buttons.forEach((button) => {
    expect(button.height, `alto de ${button.text}`).toBeGreaterThanOrEqual(44);
    expect(button.overflows, `desborde de ${button.text}`).toBe(false);
  });
  const barBox = await bar.boundingBox();
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(390.5);
});

// Los telefonos reales usan densidad 2x o 3x: la captura se escala y se recorta con ese
// factor, asi que conviene cubrirlo tambien.
test.describe('captura con densidad 2x', () => {
  test.use({ deviceScaleFactor: 2 });

  test('la imagen sale al doble de resolucion y sin marcas de borde', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 390, height: 844 });
    await openSorteo(page);
    await page.locator('#download-controls').scrollIntoViewIfNeeded();

    const geometry = await page.locator('[data-teams-scroller]').evaluate((node) => ({
      cardWidth: Math.round(node.querySelector('[data-sorteo-team-card]').getBoundingClientRect().width),
      cardHeights: [...node.querySelectorAll('[data-sorteo-team-card]')].map((card) => Math.round(card.querySelector('.team-formation').getBoundingClientRect().height)),
    }));

    const base64 = await downloadJpg(page);
    const exportInfo = await analyseExport(page, base64);

    expect(exportInfo.width).toBeGreaterThanOrEqual(geometry.cardWidth * 2 * 0.95);
    expect(exportInfo.width).toBeLessThanOrEqual(geometry.cardWidth * 2 * 1.05);
    expect(exportInfo.height).toBeGreaterThanOrEqual((geometry.cardHeights[0] + geometry.cardHeights[1]) * 2 * 0.9);
    expect(exportInfo.pitchBands.length).toBeGreaterThanOrEqual(2);
    expect(exportInfo.grayRuns).toBe(0);
  });
});
