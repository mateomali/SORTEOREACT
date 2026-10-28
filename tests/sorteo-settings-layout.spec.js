const { test, expect } = require('@playwright/test');

test('match 232 has compact settings, requested defaults and optional descriptions', async ({ page }) => {
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:8000/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D232');
  await page.getByRole('button',{name:'Administrador',exact:true}).click();
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button',{name:'Entrar como admin',exact:true}).click();
  const settings=page.getByRole('region',{name:'Criterios del sorteo'});
  await expect(page.locator('#draw-rating-mode')).toHaveValue('skill');
  await expect(page.locator('#draw-position-rating-discount')).toHaveCount(0);
  const help=settings.locator('[data-player-comparison]');
  await expect(help).not.toHaveAttribute('open','');
  await expect(settings.locator('.gf-scoring-help-body').first()).toBeHidden();
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:950});
    await settings.scrollIntoViewIfNeeded();
    await expect(settings.getByLabel('Jugador para comparar')).toBeHidden();
    await expect(settings.locator('[data-rating-preview="DEL"]')).toBeHidden();
    await expect(settings.locator('select')).toHaveCount(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await settings.screenshot({path:`outputs/sorteo-settings-compact-${width}.png`});
    const separations=page.getByRole('region',{name:'Separar jugadores',exact:true});
    await expect(separations.getByLabel('Primer jugador',{exact:true})).toBeVisible();
    await expect(separations.getByLabel('Segundo jugador',{exact:true})).toBeVisible();
    expect((await separations.boundingBox()).height).toBeLessThan(240);
    await help.locator('summary').click();
    await expect(settings.getByLabel('Jugador para comparar')).toBeVisible();
    await expect(settings.locator('[data-rating-preview="DEL"]')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await settings.screenshot({path:`outputs/sorteo-settings-expanded-${width}.png`});
    await help.locator('summary').click();
  }
  await page.setViewportSize({width:390,height:950});
  await page.screenshot({path:'outputs/sorteo-settings-page-390.png',fullPage:true});
  expect(errors).toEqual([]);
});
