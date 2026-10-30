const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const policy = fs.readFileSync('assets/player-rating-policy.json','utf8');
for (const invitationMode of [false,true]) test(`compact dialogs and equal pitches, invitation=${invitationMode}`, async ({ page }) => {
  test.setTimeout(60000);page.setDefaultTimeout(10000);
  const roles=['ARQ','DEF','DEF','MED','MED','DEL','DEL'];
  const teams=[0,1,2].map(t => roles.map((positions,i)=>({ id:t*7+i+1, name: t === 1 ? `Jugador de nombre largo ${i+1}` : `Jugador ${t*7+i+1}`, positions, assigned_position:positions, skill:4 })));
  const payload={ players:teams.flat(), initialTeams:teams, numTeams:3, matchId:42, invitationMode, communityPlayers:teams.flat().map(player=>({id:player.id,name:player.name})), savedGoalkeeperIds:['1','8','15'], separatedPairs:[['2','9','16'],['3','10']], links:{} };
  await page.route('**/__compact', route=>route.fulfill({ contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page" data-payload='${JSON.stringify(payload)}'></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:8000/__compact');
  if(invitationMode) await expect(page.getByRole('dialog',{name:'Que jugador sos',exact:true})).not.toBeVisible();
  if(invitationMode) await page.locator('[data-invitation-draw-settings] > summary').click();
  for(const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    const help=page.getByRole('button',{name:'Ayuda: Cálculo del puntaje',exact:true});
    await help.click();
    const modal=page.getByRole('dialog',{name:'Cálculo del puntaje',exact:true});
    await expect(modal).toBeVisible();
    await expect(modal.locator('.draw-help-content')).toContainText(/puntaje/);
    expect(await modal.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await modal.screenshot({path:`.tmp/draw-help-${invitationMode}-${width}.png`});
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    await expect(help).toBeFocused();
    expect(await page.evaluate(()=>document.body.style.overflow)).not.toBe('hidden');
    await page.evaluate(()=>scrollTo(0,0));
    await page.screenshot({path:`.tmp/draw-mobile-${invitationMode}-${width}.png`});
  }
  await page.getByLabel('Modalidad de sorteo',{exact:true}).selectOption('pots');
  await page.getByRole('button',{name:'Ayuda: Armado automático de potes',exact:true}).click();
  const potsHelp=page.getByRole('dialog',{name:'Armado automático de potes',exact:true});
  await expect(potsHelp).toBeVisible();
  await page.screenshot({path:`.tmp/draw-pots-help-${invitationMode}.png`});
  await expect(potsHelp.locator('.draw-help-content')).toContainText('posici');
  await potsHelp.getByRole('button',{name:'Cerrar ayuda: Armado automático de potes',exact:true}).click();
  await page.getByLabel('Modalidad de sorteo',{exact:true}).selectOption('standard');
  for(const help of await page.getByRole('button',{name:/^Ayuda:/}).all()) {
    const label=await help.getAttribute('aria-label');
    await help.click();
    const modal=page.getByRole('dialog',{name:label.slice(7),exact:true});
    await expect(modal).toBeVisible();
    expect(await modal.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await modal.getByRole('button',{name:`Cerrar ayuda: ${label.slice(7)}`,exact:true}).click();
    await expect(help).toBeFocused();
  }
  const editor=page.getByRole('region',{name:'Separar jugadores',exact:true});
  const savePreparation=editor.getByRole('button',{name:'Guardar arqueros y restricciones',exact:true});
  await expect(savePreparation).toHaveCount(0);
  await editor.getByRole('button',{name:'Crear restricción',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Jugadores que no pueden compartir equipo',exact:true});
  const search=picker.getByLabel('Buscar jugador',{exact:true});
  await search.fill('zzzznonexistent');
  await expect(picker.getByText('No hay jugadores con ese nombre.',{exact:true})).toBeVisible();
  await search.fill('Jugador 1');
  await picker.getByRole('checkbox',{name:'Seleccionar a Jugador 1',exact:true}).check();
  await search.fill('Jugador 2');
  await picker.getByRole('checkbox',{name:'Seleccionar a Jugador 2',exact:true}).check();
  await expect(picker.getByRole('list',{name:'Jugadores de la nueva restricción',exact:true})).toContainText('Jugador 1');
  for(const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    expect(await picker.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await page.screenshot({path:`.tmp/restriction-picker-${invitationMode}-${width}.png`});
  }
  await picker.getByRole('button',{name:'Agregar restricción',exact:true}).click();
  await expect(picker).not.toBeVisible();
  if(!invitationMode)await expect(savePreparation).toBeEnabled();
  await editor.getByRole('button',{name:'Ver restricciones (3)',exact:true}).click();
  const existing=page.getByRole('dialog',{name:'Estos jugadores no pueden jugar juntos',exact:true});
  await existing.getByRole('button',{name:'Quitar separación entre Jugador 1 y Jugador 2',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(savePreparation).toHaveCount(0);
  await editor.scrollIntoViewIfNeeded();
  await page.evaluate(()=>document.activeElement?.blur());
  await page.screenshot({path:`.tmp/restriction-hierarchy-${invitationMode}.png`});
  for(const width of [320,390]) {
    await page.setViewportSize({width,height:844});
    const title=await editor.locator('.gf-keeper-title').boundingBox();
    const controls=await editor.locator('.gf-keeper-controls').boundingBox();
    expect(title.x+title.width).toBeLessThanOrEqual(controls.x+1);
    expect(await editor.evaluate(node=>node.scrollWidth<=node.clientWidth+1)).toBe(true);
    await editor.screenshot({path:`.tmp/preparation-fixed-${invitationMode}-${width}.png`});
  }

  if(!invitationMode) {
    const keeperEditor=editor.locator('.gf-goalkeeper-preparation');
    await keeperEditor.getByRole('button',{name:'Editar',exact:true}).click();
    const firstKeeper=keeperEditor.locator('input[type=checkbox]:checked').first();
    const keeperName=await firstKeeper.locator('..').locator('strong').innerText();
    await firstKeeper.uncheck();
    await expect(savePreparation).toBeEnabled();
    await keeperEditor.locator('label').filter({has:page.getByText(keeperName,{exact:true})}).locator('input[type=checkbox]').check();
    await expect(savePreparation).toHaveCount(0);
    await keeperEditor.getByRole('button',{name:'Cerrar',exact:true}).click();
    const automatic=page.getByRole('checkbox',{name:'Equilibrio automático desde 0,0',exact:true});
    await expect(page.getByLabel('Equilibrio objetivo',{exact:true})).toHaveCount(0);
    await automatic.uncheck();
    await expect(page.getByLabel('Equilibrio objetivo',{exact:true})).toBeEnabled();
    await page.getByLabel('Equilibrio objetivo',{exact:true}).fill('1.5');
    await automatic.check();
    await expect(page.getByLabel('Equilibrio objetivo',{exact:true})).toHaveCount(0);
  }
  const playerButton=page.getByRole('button',{name:'Ver 21 jugadores seleccionados',exact:true});
  await expect(playerButton).toBeVisible();
  await playerButton.click();
  const roster=page.getByRole('dialog',{name:'Jugadores de la fecha',exact:true});
  await expect(roster).toBeVisible();
  await expect(roster.locator('article')).toHaveCount(21);
  expect(await roster.evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(roster).not.toBeVisible();
  await page.getByRole('button',{name:'Ver restricciones (2)',exact:true}).click();
  const rules=page.getByRole('dialog',{name:'Estos jugadores no pueden jugar juntos',exact:true});
  await expect(rules).toBeVisible();
  await rules.getByRole('button',{name:/Quitar separaci/}).first().click();
  await expect(rules.locator('li')).toHaveCount(1);
  await rules.getByRole('button',{name:'Cerrar Estos jugadores no pueden jugar juntos',exact:true}).click();
  await expect(page.getByRole('button',{name:'Ver restricciones (1)',exact:true})).toBeVisible();
  for(const width of [320,390,760,1440]) {
    await page.setViewportSize({width,height:950});
    const pitches=await page.locator('[data-sorteo-team-card] .team-formation').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height})));
    expect(pitches).toHaveLength(3);
    expect(Math.max(...pitches.map(p=>p.width))-Math.min(...pitches.map(p=>p.width))).toBeLessThan(2);
    expect(Math.max(...pitches.map(p=>p.height))-Math.min(...pitches.map(p=>p.height))).toBeLessThan(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await expect(page.getByRole('button',{name:'Ayuda: Cálculo del puntaje',exact:true})).not.toBeVisible();
  await expect(page.locator('#draw-position-rating-help')).toBeVisible();
  const separationHelp=page.getByRole('button',{name:'Ayuda: Cómo funcionan las separaciones',exact:true});
  await separationHelp.click();
  const explanation=page.getByRole('dialog',{name:'Cómo funcionan las separaciones',exact:true});
  await expect(explanation).toBeVisible();
  await expect(explanation).toContainText('Cada integrante');
  await page.keyboard.press('Escape');
  await expect(separationHelp).toBeFocused();

  await page.setViewportSize({width:390,height:844});
  await playerButton.click();
  await roster.screenshot({path:`.tmp/compact-roster-${invitationMode}.png`});
});
