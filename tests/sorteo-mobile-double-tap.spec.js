const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const policy=fs.readFileSync('assets/player-rating-policy.json','utf8');
const BASE=process.env.BASE_URL || 'http://127.0.0.1:8000';
test.use({hasTouch:true});
test('mobile double tap opens profiles without an accidental exchange; team labels show their colors',async({page})=>{
  await page.setViewportSize({width:390,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const roles=['ARQ','DEF','DEF','DEF/MED','MED/DEL','DEL','DEL'];
  const assigned=['ARQ','DEF','DEF','MED','DEL','DEL','DEL'];
  const teams=[0,1,2].map(team=>roles.map((positions,index)=>({
    id:team*10+index+1,name:`Player ${team*10+index+1}`,positions,assigned_position:assigned[index],
    skill:3.5,technique:3.5,pass_vision:3.5,defense_physical:3.5,attack:3.5,rhythm:3.5,stamina:3.5,
    teamwork:3.5,mentality:3.5,goalkeeper_skill:3.5,regularity:3.5,
  })));
  const payload={players:teams.flat(),initialTeams:teams,numTeams:3,teamColors:['ROSA','AZUL','NARANJA'],links:{}};
  await page.route('**/__line_controls_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>`}));
  await page.goto(`${BASE}/__line_controls_fixture`);
  const card=key=>page.locator(`[data-sorteo-drag-player][data-player-key="${key}"]`);
  const source=card('7'), target=card('17');
  await expect(source).toBeVisible();
  await source.tap();
  await source.tap();
  let dialog=page.getByRole('dialog',{name:'Ficha de PLAYER 7'});
  await expect(dialog).toBeVisible();
  const labels=dialog.locator('[data-exchange-team-title]');
  await expect(labels).toHaveCount(2);
  expect(await labels.allTextContents()).toEqual(['EQUIPO AZUL','EQUIPO NARANJA']);
  const styles=await labels.evaluateAll(labels=>labels.map(label=>({weight:Number(getComputedStyle(label).fontWeight),color:getComputedStyle(label.querySelector('[data-team-color]')).backgroundColor,border:getComputedStyle(label.closest('fieldset')).borderLeftWidth})));
  expect(styles.every(style=>style.weight>=700 && style.border==='4px')).toBe(true);
  expect(styles[0].color).not.toBe(styles[1].color);
  await dialog.locator('[data-exchange-options]').screenshot({path:'.tmp/mobile-team-separation.png'});
  await dialog.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
  await source.tap();
  await expect(page.getByRole('region',{name:'Mover o intercambiar jugador'})).toBeVisible();
  await target.tap();
  await target.tap();
  dialog=page.getByRole('dialog',{name:'Ficha de PLAYER 17'});
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);
  await expect(source).toHaveAttribute('data-team-index','0');
  await expect(target).toHaveAttribute('data-team-index','1');
  await dialog.getByRole('button',{name:'Cerrar ficha',exact:true}).click();
  // A single tap still selects, and tapping another team still exchanges.
  await source.tap();
  await target.tap();
  await expect(source).toHaveAttribute('data-team-index','1');
  await expect(target).toHaveAttribute('data-team-index','0');
  await source.tap();
  await expect(page.getByRole('region',{name:'Mover o intercambiar jugador'})).toBeVisible();
  // Dispatch both click handlers in one turn to cancel inside the double-tap window.
  await page.evaluate(() => {
    document.querySelector('[data-sorteo-drag-player][data-player-key="17"]').dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));
    const tray=document.querySelector('[aria-label="Mover o intercambiar jugador"]');
    [...tray.querySelectorAll('button')].find(button=>button.textContent.trim()==='Cancelar').click();
  });
  await page.waitForTimeout(400);
  await expect(source).toHaveAttribute('data-team-index','1');
  await expect(target).toHaveAttribute('data-team-index','0');
  expect(errors).toEqual([]);
});
