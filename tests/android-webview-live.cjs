// Requires an Android emulator with the debug APK installed and running.
// All Goodfellas requests are routed to the local server: production is never modified.
const { _android: android, request } = require('playwright');
const { expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const adb = process.env.ANDROID_ADB || 'C:/sorteo/.tools/android-sdk/platform-tools/adb.exe';
const port = Number(process.env.ANDROID_ADB_PORT || 5038);
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
const shell = (...args) => execFileSync(adb, ['-P', String(port), '-s', serial, 'shell', ...args], { encoding: 'utf8' });
const fixture = (action, ...args) => JSON.parse(execFileSync('php', ['tests/live-matches-fixture.php', action, ...args.map(String)], { encoding: 'utf8' }) || 'null');
const origin = 'https://www.sudokumerlo.com/sorteo/';
(async () => {
  const devices = await android.devices({ port });
  const device = devices.find(d => d.serial() === serial);
  if (!device) throw new Error('Start the Android emulator first');
  device.setDefaultTimeout(15000);
  const webview = await device.webView({ pkg: 'com.goodfellas.sorteo' });
  const page = await webview.page();
  page.setDefaultTimeout(15000);
  const errors = [];
  let offline = false;
  const proxy = await request.newContext();
  page.on('pageerror', e => errors.push(e.message));
  await page.context().route('https://www.sudokumerlo.com/sorteo/**', async route => {
    if (offline && route.request().url().includes('api=1')) return route.abort('internetdisconnected');
    const local = route.request().url().replace(origin, process.env.BASE_URL || 'http://127.0.0.1:8000/');
    const req = route.request();
    const response = await proxy.fetch(local, { method: req.method(), headers: req.headers(), data: req.postDataBuffer() || undefined, maxRedirects: 0 });
    const headers = response.headers();
    if (process.env.ANDROID_AUDIT_DEBUG && /login.php|editar_partidos.php/.test(req.url())) console.log(req.method(), req.url(), response.status(), headers.location || '', !!req.headers().cookie);
    if (headers.location) headers.location = new URL(headers.location, req.url()).href;
    // WebView's redirected network requests can bypass CDP interception. Start a
    // fresh navigation so every request, including login redirects, stays local.
    if (headers.location) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(headers.location)})</script>` });
      return;
    }
    await route.fulfill({ status: response.status(), headers, body: await response.body() });
  });
  try {
    await page.goto(`${origin}login.php?next=editar_partidos.php`);
    await page.getByRole('button', { name: 'Administrador', exact: true }).click();
    await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
    await page.getByRole('button', { name: 'Entrar como admin', exact: true }).click();
    await page.waitForURL('**/editar_partidos.php');
    console.log('Android runtime:', await page.evaluate(() => ({ agent: navigator.userAgent, speech: 'speechSynthesis' in window, audio: !!window.AudioContext, bridge: !!window.GoodfellasNative })));
    for (const count of [2, 3, 4]) {
      const data = fixture('create', count);
      try {
        await page.goto(`${origin}partidos_en_vivo.php?match_id=${data.id}`);
        await page.getByRole('button', { name: 'Preparar primer partido' }).click();
        await page.getByRole('button', { name: 'Comenzar partido', exact: true }).click();
        await expect(page.getByRole('timer')).toContainText(count === 2 ? '59:' : '09:');
        await page.getByRole('button', { name: 'Pausar', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Reanudar', exact: true })).toBeVisible();
        const frozen = await page.getByRole('timer').textContent();
        await page.waitForTimeout(1200);
        expect(await page.getByRole('timer').textContent()).toBe(frozen);
        await page.getByRole('button', { name: 'Reanudar', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
        shell('input', 'keyevent', 'KEYCODE_HOME');
        await page.waitForTimeout(1500);
        shell('am', 'start', '-n', 'com.goodfellas.sorteo/.MainActivity');
        await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole('button', { name: 'Pausar', exact: true })).toBeVisible();
        await expect.poll(() => /fl=[^\n]*KEEP_SCREEN_ON/.test(shell('dumpsys', 'window', 'windows'))).toBe(true);
        await page.getByRole('button', { name: 'Activar avisos sonoros' }).click();
        fixture('near-alert', data.id);
        await expect(page.getByRole('alert')).toContainText(count === 2 ? 'CAMBIO!!' : 'MINUTO', { timeout: 10000 });
        console.log('Native speech queue:', await page.evaluate(async () => {
          try { await window.goodfellasSpeak('ÚLTIMO MINUTO'); return 'accepted'; }
          catch { return 'Spanish voice unavailable on this device'; }
        }));
        offline = true;
        await page.getByRole('button', { name: 'Pausar', exact: true }).click();
        await expect(page.locator('.live-error')).toBeVisible();
        expect(fixture('inspect', data.id).session.state.games[0].status).toBe('playing');
        offline = false;
        await page.evaluate(() => window.dispatchEvent(new Event('online')));
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (let i = 0; i < 3; i++) {
          await page.getByRole('button', { name: '+ Agregar gol', exact: true }).first().click();
          await page.getByRole('button', { name: 'Guardar gol', exact: true }).click();
          await expect(page.getByRole('dialog')).toHaveCount(0);
        }
        let saved = fixture('inspect', data.id);
        expect(saved.session.state.games[0].status).toBe(count === 2 ? 'playing' : 'finished');
        if (count === 2) {
          fixture('overtime', data.id);
          await page.reload();
          await expect(page.getByRole('timer')).toContainText('00:00');
        }
        await page.getByRole('button', { name: 'Finalizar fecha', exact: true }).click();
        await page.getByRole('dialog').getByRole('button', { name: /Finalizar fecha|Confirmar/ }).click();
        await expect.poll(() => fixture('inspect', data.id).session.state.closed).toBe(true);
        fs.mkdirSync('outputs/android-live', { recursive: true });
        fs.writeFileSync(`outputs/android-live/${count}-teams.png`, execFileSync(adb, ['-P', String(port), '-s', serial, 'exec-out', 'screencap', '-p']));
        await page.goto(`${origin}index.php`);
        await expect.poll(() => /fl=[^\n]*KEEP_SCREEN_ON/.test(shell('dumpsys', 'window', 'windows'))).toBe(false);
        console.log(`PASS Android WebView: ${count} teams, clock, pause/resume, background, reload, alerts, offline protection, goals and closure`);
      } finally { fixture('delete', data.id); }
    }
    expect(errors).toEqual([]);
  } finally { await page.goto('about:blank'); await page.context().unrouteAll({ behavior: 'wait' }); await proxy.dispose(); await Promise.all(devices.map(d => d.close())); }
})().catch(error => { console.error(error); process.exitCode = 1; });
