const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
const php = code => execFileSync('php', [], {input:'<?php require getcwd()."/lib/helpers.php"; '+code, encoding:'utf8'}).trim();
for (const width of [390,1440]) test(`separate statistics and linked accounts at ${width}px`, async ({page,context}) => {
 const fixture=JSON.parse(php(`ensure_auth_schema(); ensure_control_schema(); $name='PERSONAS LINK TEST '.bin2hex(random_bytes(4)); $s=db()->prepare("INSERT INTO players (name,positions,skill) VALUES (?, 'MED', 3)"); $s->execute([$name]); $_SESSION=['is_admin'=>true]; echo json_encode(['player'=>(int)db()->lastInsertId(),'name'=>$name,'session'=>session_id(),'username'=>'linktest_'.bin2hex(random_bytes(5))]); session_write_close();`));
 try {
  await context.addCookies([{name:'PHPSESSID',value:fixture.session,url:BASE}]);
  await page.setViewportSize({width,height:900});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${BASE}/jugadores2.php`);
  await expect(page.getByRole('heading',{name:'Jugadores',exact:true})).toBeVisible();
  await expect(page.locator('[name="username"]')).toHaveCount(0);
  await expect(page.getByRole('navigation',{name:'Filtrar cuentas'})).toHaveCount(0);
  await page.getByLabel('Buscar jugador',{exact:true}).fill(fixture.name);
  await page.getByRole('button',{name:`Editar ficha de ${fixture.name}`,exact:true}).click();
  await expect(page.getByRole('dialog',{name:`Ficha de ${fixture.name}`})).toBeVisible();
  await expect(page.getByRole('dialog',{name:`Ficha de ${fixture.name}`}).locator('[name="name"]')).toHaveValue(fixture.name);
  await page.goto(`${BASE}/personas.php`);
  await expect(page.getByRole('heading',{name:'Personas',exact:true})).toBeVisible();
  await expect(page.locator('[data-react-island="jugadores2_page"]')).toHaveCount(0);
  await page.getByRole('navigation',{name:'Filtrar cuentas'}).getByRole('button',{name:'Directivos',exact:true}).click();
  const form=page.locator('#crear-usuario form');
  await expect(form.locator('[name="user_role"]')).toHaveValue('directivo');
  await form.locator('[name="username"]').fill(fixture.username);
  await form.locator('[name="temporary_password"]').fill('test-link-password');
  await form.locator('[name="player_id"]').selectOption(String(fixture.player));
  page.on('dialog',dialog=>dialog.accept());
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/personas.php\?tab=directivos/);
  await expect(page.locator('main')).toContainText(fixture.username);
  const account=JSON.parse(php(`$s=db()->prepare('SELECT role,player_id,password_hash FROM site_users WHERE username=?'); $s->execute(['${fixture.username}']); $u=$s->fetch(); echo json_encode(['role'=>$u['role'],'player'=>(int)$u['player_id'],'password'=>password_verify('test-link-password',$u['password_hash'])]);`));
  expect(account).toEqual({role:'directivo',player:fixture.player,password:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
 } finally {
  php(`db()->exec("DELETE FROM directive_members WHERE site_user_id IN (SELECT id FROM site_users WHERE username='${fixture.username}')"); db()->exec("DELETE FROM site_users WHERE username='${fixture.username}'"); db()->exec('DELETE FROM players WHERE id=${fixture.player}');`);
 }
});
