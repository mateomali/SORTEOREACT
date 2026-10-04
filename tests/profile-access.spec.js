const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
function php(code) {
  return execFileSync('php', [], { input: '<?php require getcwd()."/lib/helpers.php"; '+code, encoding: 'utf8' }).trim();
}
for (const role of ['jugador', 'directivo']) {
  test(`own profile and photo for ${role}`, async ({ page, context }) => {
    const fixture = JSON.parse(php(`
      ensure_auth_schema(); ensure_control_schema();
      db()->exec("INSERT INTO players (name, positions, skill) VALUES ('PROFILE TEST', 'MED', 3)");
      $pid = (int) db()->lastInsertId();
      $name = 'profile_test_' . bin2hex(random_bytes(5));
      $stmt = db()->prepare('INSERT INTO site_users (username, password_hash, role, player_id, active, password_needs_reset) VALUES (?, ?, ?, ?, 1, 0)');
      $stmt->execute([$name, password_hash('test-profile-password', PASSWORD_DEFAULT), '${role}', $pid]);
      $uid = (int) db()->lastInsertId();
      $_SESSION['user_id'] = $uid; $_SESSION['username'] = $name; $_SESSION['user_role'] = '${role}'; $_SESSION['player_id'] = $pid;
      echo json_encode(['player' => $pid, 'user' => $uid, 'session' => session_id()]); session_write_close();
    `));
    try {
      await context.addCookies([{ name: 'PHPSESSID', value: fixture.session, url: BASE }]);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE}/perfil.php`);
      await expect(page.getByRole('heading', { name: 'Mi perfil', exact: true })).toBeVisible();
      await expect(page.locator('.profile-identity-grid')).toContainText(role === 'directivo' ? 'Directivo' : 'Jugador');
      await expect(page.locator('.profile-summary-grid')).toContainText('Premios obtenidos');
      await expect(page.locator('.profile-summary-grid')).toContainText('Partidos');
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1cAAAAASUVORK5CYII=', 'base64');
      await page.locator('#profilePhoto').setInputFiles({ name: 'photo.png', mimeType: 'image/png', buffer: png });
      await page.getByRole('button', { name: 'Guardar foto', exact: true }).click();
      await expect(page.locator('.flash-success')).toContainText('Tu foto se actualizó');
      await expect(page.locator('#mi-foto img')).toHaveAttribute('src', new RegExp(`uploads/players/player-${fixture.player}-`));
      await page.locator('#profilePhoto').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
      await page.getByRole('button', { name: 'Guardar foto', exact: true }).click();
      await expect(page.locator('.flash-error')).toContainText('imagen JPG');
      const token = await page.locator('input[name="profile_photo_token"]').inputValue();
      await page.request.post(`${BASE}/perfil.php`, { multipart: { profile_photo_token: 'invalid', photo: { name: 'photo.png', mimeType: 'image/png', buffer: png } } });
      await page.goto(`${BASE}/perfil.php`);
      await expect(page.locator('#mi-foto img')).toHaveAttribute('src', new RegExp(`uploads/players/player-${fixture.player}-`));
      expect(token.length).toBe(64);
      await page.screenshot({ path: `outputs/profile-${role}-390.png`, fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      php(`db()->exec('UPDATE site_users SET player_id=NULL WHERE id=${fixture.user}');`);
      await page.goto(`${BASE}/perfil.php`);
      await expect(page.getByRole('heading', { name: 'Mi perfil', exact: true })).toBeVisible();
      await expect(page.locator('main')).toContainText('no tiene un jugador vinculado');
      await expect(page.locator('#profilePhoto')).toHaveCount(0);
    } finally {
      php(`$s=db()->prepare('SELECT photo_path FROM players WHERE id=?'); $s->execute([${fixture.player}]); $path=$s->fetchColumn(); if ($path && str_starts_with($path, 'uploads/players/player-${fixture.player}-')) @unlink(getcwd().'/'.$path); db()->exec('DELETE FROM site_users WHERE id=${fixture.user}'); db()->exec('DELETE FROM players WHERE id=${fixture.player}');`);
    }
  });
}
