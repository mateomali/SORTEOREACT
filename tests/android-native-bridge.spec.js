const { test, expect } = require('@playwright/test');
const path = require('node:path');
const bridgePath = path.resolve('android-goodfellas/app/src/main/assets/native-bridge.js');

async function setup(page, cancelled = false) {
  await page.route('https://www.sudokumerlo.com/sorteo/test', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Goodfellas</body></html>' }));
  await page.addInitScript(({ cancelled }) => {
    window.nativeRequests = [];
    window.GoodfellasNative = { postMessage(raw) {
      const message = JSON.parse(raw);
      window.nativeRequests.push(message);
      setTimeout(() => window.GoodfellasNative.onmessage({ data: JSON.stringify({ id: message.id, ok: !cancelled, cancelled, error: 'Cancelado' }) }), 0);
    }};
  }, { cancelled });
  await page.addInitScript({ path: bridgePath });
  await page.goto('https://www.sudokumerlo.com/sorteo/test');
}

test('detached JPG, text and CSV anchors reach the native saver with exact bytes', async ({ page }) => {
  await setup(page);
  const expected = await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 24;
    canvas.getContext('2d').fillRect(0, 0, 24, 24);
    const jpg = canvas.toDataURL('image/jpeg');
    for (const [href, name] of [[jpg, 'equipos.jpg'], [URL.createObjectURL(new Blob(['Equipo 1\nCésar, Aníbal'], { type: 'text/plain;charset=utf-8' })), 'equipos.txt'], [URL.createObjectURL(new Blob(['Nombre,Goles\nMarian,62'], { type: 'text/csv;charset=utf-8' })), 'goleadores.csv']]) {
      const anchor = document.createElement('a'); anchor.href = href; anchor.download = name; anchor.click();
    }
    return jpg.split(',')[1];
  });
  await expect.poll(() => page.evaluate(() => window.nativeRequests.length)).toBe(3);
  const requests = await page.evaluate(() => window.nativeRequests);
  expect(requests.find(r => r.name === 'equipos.jpg').data).toBe(expected);
  expect(Buffer.from(requests.find(r => r.name === 'equipos.txt').data, 'base64').toString()).toBe('Equipo 1\nCésar, Aníbal');
  expect(Buffer.from(requests.find(r => r.name === 'goleadores.csv').data, 'base64').toString()).toContain('Marian,62');
});

test('share files and text, clipboard and print return promises through Android', async ({ page }) => {
  await setup(page);
  await page.evaluate(async () => {
    await navigator.share({ text: 'Equipos del viernes', url: 'https://www.sudokumerlo.com/sorteo/' });
    await navigator.share({ files: [new File(['foto'], 'formacion.jpg', { type: 'image/jpeg' })] });
    await navigator.clipboard.writeText('César y Aníbal');
    window.print();
  });
  await expect.poll(() => page.evaluate(() => window.nativeRequests.length)).toBe(4);
  expect(await page.evaluate(() => window.nativeRequests.map(r => r.action))).toEqual(['share', 'share', 'clipboard', 'print']);
  expect(await page.evaluate(() => navigator.canShare({ files: [new File(['a'], 'a'), new File(['b'], 'b')] }))).toBe(false);
});

test('backup POST retains its body and filename and is not replaced with a GET', async ({ page }) => {
  await setup(page);
  let body;
  await page.route('https://www.sudokumerlo.com/sorteo/backup.php', route => {
    expect(route.request().method()).toBe('POST'); body = route.request().postData();
    return route.fulfill({ contentType: 'application/zip', headers: { 'Content-Disposition': 'attachment; filename="backup.zip"' }, body: 'ZIP-DATA' });
  });
  await page.evaluate(() => {
    document.body.innerHTML = '<form action="backup.php" method="post"><input name="action" value="export_backup"><input name="token" value="csrf-test"><button>Exportar</button></form>';
    document.querySelector('button').click();
  });
  await expect.poll(() => page.evaluate(() => window.nativeRequests.length)).toBe(1);
  expect(body).toContain('csrf-test');
  const request = await page.evaluate(() => window.nativeRequests[0]);
  expect(request.name).toBe('backup.zip');
  expect(Buffer.from(request.data, 'base64').toString()).toBe('ZIP-DATA');
});

test('cancelled native share reports AbortError and regular links are unaffected', async ({ page }) => {
  await setup(page, true);
  expect(await page.evaluate(async () => { try { await navigator.share({ text: 'hola' }); } catch (error) { return error.name; } })).toBe('AbortError');
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '#normal'; document.body.append(a); a.click(); });
  await expect(page).toHaveURL(/#normal$/);
});

test('actual mobile team exporter delivers a valid JPG and team text to Android', async ({ page }) => {
  test.setTimeout(150000);
  const { execFileSync } = require('node:child_process');
  const fixture = (action, id) => execFileSync('C:/xampp/php/php.exe', ['tests/draw-pots-fixture.php', action, ...(id ? [String(id)] : [])], { encoding: 'utf8' }).trim();
  const id = Number(fixture('create'));
  try {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.addInitScript(() => {
      window.nativeRequests = [];
      window.GoodfellasNative = { postMessage(raw) {
        const message = JSON.parse(raw); window.nativeRequests.push(message);
        setTimeout(() => window.GoodfellasNative.onmessage({ data: JSON.stringify({ id: message.id, ok: true }) }), 0);
      }};
    });
    await page.addInitScript({ path: bridgePath });
    const base = process.env.BASE_URL || 'http://127.0.0.1:8000';
    await page.goto(`${base}/login.php?next=${encodeURIComponent(`sorteo_legacy_csv.php?match_id=${id}`)}`);
    await page.getByRole('button', { name: 'Administrador', exact: true }).click();
    await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
    await page.getByRole('button', { name: 'Entrar como admin', exact: true }).click();
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('.team-formation')).toHaveCount(2, { timeout: 90000 });
    await page.locator('.gf-mobile-export summary').click();
    await page.getByRole('button', { name: 'Exportar JPG', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.nativeRequests.filter(r => r.name?.endsWith('.jpg')).length), { timeout: 45000 }).toBe(1);
    const jpg = await page.evaluate(() => window.nativeRequests.find(r => r.name?.endsWith('.jpg')));
    const bytes = Buffer.from(jpg.data, 'base64');
    expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
    expect(bytes.length).toBeGreaterThan(10000);
    await page.locator('.gf-mobile-export summary').click();
    await page.getByRole('button', { name: 'Descargar texto', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.nativeRequests.filter(r => r.name?.endsWith('.txt')).length)).toBe(1);
    const text = await page.evaluate(() => window.nativeRequests.find(r => r.name?.endsWith('.txt')));
    expect(Buffer.from(text.data, 'base64').toString().toUpperCase()).toContain('TEMPORARY POT PLAYER');
  } finally { fixture('delete', id); }
});
