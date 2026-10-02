const { test, expect } = require('@playwright/test');
test.use({hasTouch:true});
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
test('real match 204 loads and both courts fit the mobile viewport', async ({page}) => {
  test.setTimeout(90000);
  const errors=[]; page.on('pageerror', e=>errors.push(e.message));
  await page.goto(`${BASE}/login.php?next=sorteo_legacy_csv.php%3Fmatch_id%3D204`);
  await page.locator('#login-admin').evaluate(n=>n.open=true);
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button',{name:/Entrar como admin|Ingresar/i}).click();
  if (!await page.locator('.team-formation').count()) await page.locator('#generateTeamsButton').click();
  await expect(page.locator('.team-formation')).toHaveCount(2,{timeout:60000});
  for (const width of [320,360,390,430,768,1024,1440]) {
    await page.setViewportSize({width,height:950});
    const geometry=await page.locator('.team-formation').evaluateAll(fields=>({fields:fields.map(f=>{const r=f.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,width:r.width,height:r.height}}), page:document.documentElement.scrollWidth}));

    expect(geometry.page).toBeLessThanOrEqual(width);
    expect(geometry.fields[0].right).toBeLessThanOrEqual(geometry.fields[1].left);
    expect(geometry.fields[1].right).toBeLessThanOrEqual(width);
    expect(Math.abs(geometry.fields[0].height-geometry.fields[1].height)).toBeLessThan(1);
    await page.locator('[data-teams-scroller]').screenshot({path:`outputs/workflow-courts-${width}.png`});
  }
  await page.screenshot({path:'outputs/workflow-desktop-full.png',fullPage:true});
  await page.setViewportSize({width:390,height:950});
  await page.screenshot({path:'outputs/workflow-mobile-full.png',fullPage:true});
  await expect(page.locator('.gf-team-navigation')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mostrar ambos', exact: true })).toHaveCount(0);
  const toggles = page.locator('.gf-pitch-size-toggle');
  const scroller = page.locator('[data-teams-scroller]');
  await expect(toggles.first()).toBeVisible();
  for (const index of [1, 0]) {
    await toggles.nth(index).click();
    await expect(scroller).toHaveAttribute('data-show-both', 'false');
    await expect(toggles.nth(index)).toHaveAttribute('aria-label', 'Compactar cancha');
    await expect.poll(() => page.locator('.team-formation').nth(index).evaluate(field => {
      const rect = field.getBoundingClientRect();
      return rect.width > 300 && rect.left >= 0 && rect.right <= 390;
    })).toBe(true);
    await toggles.nth(index).click();
    await expect(scroller).toHaveAttribute('data-show-both', 'true');
  }
  const bounds = await page.locator('.team-formation').evaluateAll(fields => fields.map(field => { const r = field.getBoundingClientRect(); return { left: r.left, right: r.right }; }));
  expect(bounds[0].right).toBeLessThanOrEqual(bounds[1].left);
  expect(bounds[1].right).toBeLessThanOrEqual(390);
  await expect(page.getByText('Datos de las alternativas', { exact: true })).toHaveCount(0);
  const rosa = page.locator('.team-head h3').filter({ hasText: /ROSA/i }).locator('span').first();
  if (await rosa.count()) await expect(rosa).toHaveCSS('background-color', 'rgb(244, 114, 182)');
  await page.setViewportSize({ width: 1280, height: 950 });
  for (const toggle of await toggles.all()) await expect(toggle).toBeHidden();
  expect(errors).toEqual([]);
});

const { execFileSync } = require('node:child_process');
const fixture = (action,id) => execFileSync('php',['tests/sorteo-workflow-fixture.php',action,...(id ? [String(id)] : [])],{encoding:'utf8'}).trim();
const stateOf = id => JSON.parse(fixture('inspect',id));
async function loginMatch(page,id) {
  await page.goto(`${BASE}/login.php?next=${encodeURIComponent(`sorteo_legacy_csv.php?match_id=${id}`)}`);
  await page.locator('#login-admin').evaluate(n=>n.open=true);
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button',{name:/Entrar como admin|Ingresar/i}).click();
}
const rosterOnPage = page => page.locator('[data-sorteo-drag-player]').evaluateAll(cards=>cards.map(card=>({id:card.dataset.playerKey,team:Number(card.dataset.teamIndex)+1,pos:card.dataset.assignedPosition})).sort((a,b)=>a.id.localeCompare(b.id)));

test('prepare, redraw, alternatives, save, reload and continue use the real persistence flow', async ({page})=>{
  test.setTimeout(180000);
  const id=Number(fixture('create'));
  const errors=[]; const failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`)});
  try {
    await page.setViewportSize({width:1440,height:1000});
    await loginMatch(page,id);
    await expect(page.locator('.gf-workflow-progress')).toBeVisible();
    await expect(page.getByRole('button',{name:'Configurar formaciones →',exact:true})).toHaveCount(0);
    await page.locator('.gf-player-preparation').getByRole('button',{name:'Editar',exact:true}).click();
    await expect(page.locator('#jugadores-container')).toBeVisible();
    await page.locator('#jugadores-container').getByRole('button',{name:/Editar /}).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button',{name:'Cancelar',exact:true}).click();
    await page.locator('.gf-player-preparation').getByRole('button',{name:'Cerrar',exact:true}).click();
    const keepers=page.locator('.gf-goalkeeper-preparation');
    if (await keepers.getByRole('button',{name:'Editar',exact:true}).count()) await keepers.getByRole('button',{name:'Editar',exact:true}).click();
    // Complete the existing keeper controls; no automatic selection rules are changed.
    const natural=keepers.locator('label').filter({hasText:'FRANCOK'}).locator('input[type=checkbox]');
    await natural.uncheck(); await natural.check();
    await keepers.locator('label').filter({hasText:'GUILLE'}).locator('input[type=checkbox]').check();
    await expect(keepers.locator('input[type=checkbox]:checked')).toHaveCount(2);
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('.team-formation')).toHaveCount(2,{timeout:60000});
    await expect(page.locator('[data-draw-attempts]')).toContainText('3 intentos');
    await page.getByLabel('Equilibrio objetivo').fill('6');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#generateTeamsButton').click();
    await expect(page.locator('[data-draw-attempts]')).toContainText('2 intentos',{timeout:60000});
    const team=page.locator('[data-sorteo-team-card]').first();
    await team.locator('select').nth(0).selectOption('VERDE');
    await team.locator('select').nth(1).selectOption('auto');
    await team.locator('.gf-team-tactics > summary').click();
    const tops=await page.locator('.team-formation').evaluateAll(fields=>fields.map(f=>f.getBoundingClientRect().top));
    expect(Math.abs(tops[0]-tops[1])).toBeLessThan(1);
    const variants=team.getByLabel(/Variante de/);
    const values=await variants.locator('option').evaluateAll(options=>options.filter(o=>!o.disabled).map(o=>o.value));
    for(const value of values)await variants.selectOption(value);
    await team.locator('.gf-team-tactics > summary').click();
    await expect(page.getByRole('region',{name:'Análisis rápido'})).toBeVisible();
    await page.getByRole('button',{name:/Ver análisis completo/}).click();
    await expect(page.locator('[data-sorteo-analysis]')).toBeVisible();
    await expect(page.locator('[data-sorteo-analysis] svg').first()).toBeVisible();
    await page.getByRole('button',{name:'Ocultar análisis completo',exact:true}).click();
    const before=await rosterOnPage(page);
    await page.locator('#download-controls').getByRole('button',{name:'Guardar equipos y continuar',exact:true}).click();
    await expect(page).toHaveURL(/editar_partidos\.php/);
    await page.goto(`${BASE}/sorteo_legacy_csv.php?match_id=${id}`);
    await expect(page.locator('#download-controls')).toHaveAttribute('data-save-state','saved');
    const saved=stateOf(id);
    expect(saved.match.status).toBe('sorteado');
    expect(Number(saved.match.redraw_count)).toBe(1);
    expect(saved.teams[0].color_name).toBe('VERDE');
    await page.reload();
    await expect(page.locator('#download-controls')).toHaveAttribute('data-save-state','saved');
    expect(await rosterOnPage(page)).toEqual(before);
    // Re-selecting the same shirt is not a real unsaved change.
    await page.locator('[data-sorteo-team-card]').first().locator('select').nth(0).selectOption('VERDE');
    await expect(page.locator('#download-controls')).toHaveAttribute('data-save-state','saved');
    await page.locator('[data-sorteo-team-card]').first().locator('select').nth(0).selectOption('NARANJA');
    await expect(page.locator('#download-controls')).toHaveAttribute('data-save-state','dirty');
    await page.locator('#download-controls').getByRole('button',{name:'Guardar equipos y continuar',exact:true}).click();
    await expect(page).toHaveURL(/editar_partidos\.php/);
    await page.goto(`${BASE}/sorteo_legacy_csv.php?match_id=${id}`);
    await expect(page.locator('#download-controls')).toHaveAttribute('data-save-state','saved');
    expect(stateOf(id).teams[0].color_name).toBe('NARANJA');
    expect(Number(stateOf(id).match.redraw_count)).toBe(1);
    await page.locator('#download-controls').getByRole('button',{name:'Configurar formaciones →',exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`finalizar_partido.php\\?match_id=${id}&edit_formations=1`));
    await expect(page.locator('.team-formation')).toHaveCount(2);
    expect(await rosterOnPage(page)).toEqual(before);
    await page.goBack();
    await expect(page.locator('.gf-workflow-progress')).toBeVisible();
    expect(await rosterOnPage(page)).toEqual(before);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  } finally { fixture('delete',id); }
});

test('both directions of mouse drag, mobile tap and touch drag share the existing swap operation', async({page})=>{
  test.setTimeout(90000);
  page.setDefaultTimeout(15000);
  await page.setViewportSize({width:1440,height:1000});
  await loginMatch(page,204);
  if(!await page.locator('.team-formation').count())await page.locator('#generateTeamsButton').click();
  const cards = team => page.locator(`[data-sorteo-drag-player][data-team-index="${team}"]:not([data-assigned-position=ARQ])`);
  await expect(cards(0).first()).toBeVisible({timeout:60000});
  const source=cards(0).first(), target=cards(1).first();
  const key=await source.getAttribute('data-player-key'), targetKey=await target.getAttribute('data-player-key');
  async function mouseSwap(from,to){
    await from.scrollIntoViewIfNeeded(); await to.scrollIntoViewIfNeeded();
    const a=await from.boundingBox(),b=await to.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});await page.mouse.up();
  }
  await mouseSwap(source,target);
  const find=id=>page.locator(`[data-sorteo-drag-player][data-player-key="${id}"]`);
  await expect(find(key)).toHaveAttribute('data-team-index','1');
  await mouseSwap(find(key),find(targetKey));
  await expect(find(key)).toHaveAttribute('data-team-index','0');
  await page.setViewportSize({width:390,height:950});
  await find(key).tap();
  await expect(page.locator('.gf-selection-status')).toContainText('seleccionado');
  await find(targetKey).tap();
  await expect(find(key)).toHaveAttribute('data-team-index','1');
  const cdp=await page.context().newCDPSession(page);
  await find(key).scrollIntoViewIfNeeded();
  const a=await find(key).boundingBox(),b=await find(targetKey).boundingBox();
  const points=(x,y)=>[{x,y,id:1}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(a.x+a.width/2,a.y+a.height/2)});
  await page.waitForTimeout(500);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(b.x+b.width/2,b.y+b.height/2)});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect(find(key)).toHaveAttribute('data-team-index','0');
});

test('featured match appears only above the date search', async ({page}) => {
  await loginMatch(page,204);
  await page.goto(`${BASE}/editar_partidos.php`);
  await expect(page.getByLabel('Buscar fecha')).toBeVisible();
  const latest=await page.evaluate(()=>{
    const payloads=[...document.querySelectorAll('[data-payload],script[type="application/json"]')].map(node=>{try{return JSON.parse(node.dataset.payload || node.textContent)}catch{return {}}});
    const payload=payloads.find(item=>item.latestId);
    return payload.matches.find(match=>Number(match.id)===Number(payload.latestId));
  });
  await expect(page.locator(`#partido-admin-${latest.id}`)).toHaveCount(0);
  await expect(page.getByText(latest.title,{exact:true})).toHaveCount(1);
  const history=page.getByRole('region',{name:'Historial de fechas'});
  await expect(history.locator('article').first()).toBeVisible();
  await page.getByLabel('Buscar fecha').fill(latest.title);
  await expect(page.locator(`#partido-admin-${latest.id}`)).toHaveCount(0);
  await expect(page.getByText(latest.title,{exact:true})).toHaveCount(1);
});
