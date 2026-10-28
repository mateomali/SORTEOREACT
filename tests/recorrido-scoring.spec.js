const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

test('one selector and three visible scoring modes, GEN preview, frozen draw settings and responsive layout', async ({ page }) => {
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  const roles=['ARQ','DEF/MED','DEF','MED','DEL'];
  const players=[0,1].flatMap(t=>roles.map((position,i)=>({
    id:t*10+i+1,name:`Jugador ${t}-${i}`,positions:position,skill:4,technique:2,
    pass_vision:2,rhythm:3,stamina:4,defense_physical:6,attack:1,teamwork:4,
    mentality:4,regularity:3.5,goalkeeper_skill:3,
  })));
  const payload={matchId:999,players,numTeams:2,links:{}};
  let posted;
  await page.route('**/guardar_sorteo.php',route=>{
    posted=route.request().postDataJSON();
    return route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({ok:false,message:'Captura de prueba'})});
  });
  await page.route('**/__recorrido_scoring',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${fs.readFileSync('assets/player-rating-policy.json','utf8')}</script><div data-react-root data-react-island="sorteo_legacy_page" data-payload='${JSON.stringify(payload)}'></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>`}));
  await page.goto('http://127.0.0.1:8000/__recorrido_scoring');
  const settings=page.getByRole('region',{name:'Criterios del sorteo'});
  await expect(settings.getByLabel('Jugador para comparar')).toBeHidden();
  await settings.locator('[data-player-comparison] > summary').click();
  await settings.getByLabel('Jugador para comparar').selectOption('2');
  const mode=page.locator('#draw-rating-mode');
  await expect(page.locator('#draw-position-rating-discount')).toHaveCount(0);
  await mode.selectOption('general');
  const value=async role=>Number(await settings.locator(`[data-rating-preview="${role}"]`).locator('[data-gen-value]').innerText());
  expect(await value('DEF')).toBe(await value('DEL'));
  await expect(settings.getByRole('table',{name:'Comparación del puntaje general'})).toBeVisible();
  expect(await value('DEF')).toBeGreaterThan(6);
  await expect(settings).not.toContainText('/ 6');
  await expect(mode.locator('option')).toHaveCount(3);
  const fixedGeneral=await value('DEF');
  await mode.selectOption('penalty');

  expect(await value('DEF')).toBe(fixedGeneral);
  expect(await value('MED')).toBe(Math.round(fixedGeneral * 0.95));
  expect(await value('DEL')).toBe(Math.round(fixedGeneral * 0.9));
  expect(await value('DEL')).toBeLessThan(await value('MED'));
  await expect(page.locator('#draw-position-rating-help')).toContainText('5%');
  await mode.selectOption('skill');

  expect(await value('DEF')).toBeGreaterThan(await value('DEL'));
  for(const width of [1440,390,320]) {
    await page.setViewportSize({width,height:950});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await settings.screenshot({path:`outputs/recorrido-scoring-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:950});
  await page.locator('#generateTeamsButton').click();
  await expect(page.locator('[data-sorteo-team-card]')).toHaveCount(2,{timeout:60000});
  const before=await page.locator('[data-sorteo-drag-player]').allTextContents();
  await mode.selectOption('general');
  expect(await page.locator('[data-sorteo-drag-player]').allTextContents()).toEqual(before);
  await page.getByRole('button',{name:'Analizar equipos',exact:true}).click();
  await expect(page.locator('[data-recorrido-explanation]')).toContainText('Puntaje por habilidad y posición');
  await expect(page.locator('[data-recorrido-explanation]')).toContainText('sin descuento adicional');
  await expect(page.locator('[data-recorrido-explanation]')).not.toContainText('/ 6');
  await page.getByRole('button',{name:'Guardar equipos y continuar',exact:true}).click();
  await expect(page.getByText('Captura de prueba',{exact:true})).toBeVisible();
  expect(posted.position_rating_mode).toBe('skill');
  expect(posted.position_rating_discount).toBe(false);
  expect(posted.draw_audit_snapshot.criteria.first_balance_priority).toMatchObject({recorrido:0.5,general:0.5});
  expect(errors).toEqual([]);
});
