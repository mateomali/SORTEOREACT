const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const policy=fs.readFileSync('assets/player-rating-policy.json','utf8');
const BASE=process.env.BASE_URL || 'http://127.0.0.1:8000';
for(const width of [1440,390]) test(`manual positions and compact exchange filters at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const roles=['ARQ','DEF','DEF','DEF/MED','MED/DEL','DEL','DEL'];
  const assigned=['ARQ','DEF','DEF','MED','DEL','DEL','DEL'];
  const teams=[0,1].map(team=>roles.map((positions,index)=>({
    id:team*10+index+1,name:`Player ${team*10+index+1}`,positions,assigned_position:assigned[index],
    skill:3.5,technique:3.5,pass_vision:3.5,defense_physical:3.5,attack:3.5,rhythm:3.5,stamina:3.5,
    teamwork:3.5,mentality:3.5,goalkeeper_skill:3.5,regularity:3.5,
  })));
  const payload={players:teams.flat(),initialTeams:teams,numTeams:2,teamColors:['ROSA','AZUL'],links:{}};
  await page.route('**/__line_controls_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>`}));
  await page.goto(`${BASE}/__line_controls_fixture`);
  const card=key=>page.locator(`[data-sorteo-drag-player][data-player-key="${key}"]`);
  const source=card('7');
  await expect(source).toBeVisible();
  if(width===1440) {
    const target=card('4');
    await source.scrollIntoViewIfNeeded(); await target.scrollIntoViewIfNeeded();
    const a=await source.boundingBox(),b=await target.boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);
    await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});
    await page.mouse.up();
    await expect(card('4')).toHaveAttribute('data-assigned-position','DEL');
  } else {
    await source.click();
    await page.getByRole('region',{name:'Mover o intercambiar jugador'}).getByRole('button',{name:'MED',exact:true}).click();
  }
  await expect(source).toHaveAttribute('data-assigned-position','MED');
  await expect(source.locator('.sorteo-position-penalty')).toContainText('-10%');
  await page.locator('[data-sorteo-team-card]').first().getByRole('button',{name:'Deshacer ultimo cambio',exact:true}).click();
  await expect(source).toHaveAttribute('data-assigned-position','DEL');
  await source.click();
  if(width===390) await page.getByRole('region',{name:'Mover o intercambiar jugador'}).getByRole('button',{name:'Ficha',exact:true}).click();
  const dialog=page.getByRole('dialog');
  const options=dialog.locator('[data-exchange-options]');
  const candidates=options.locator('[data-exchange-player]');
  await expect(candidates).toHaveCount(3);
  expect(await candidates.evaluateAll(rows=>rows.every(row=>row.dataset.exchangePosition==='DEL'))).toBe(true);
  await options.getByRole('button',{name:'Todos',exact:true}).click();
  await expect(candidates).toHaveCount(7);
  const target=options.locator('[data-exchange-player="12"]');
  await expect(target).toBeEnabled();
  expect(Number(await target.getAttribute('data-exchange-delta'))).toBeLessThan(0);
  expect(await candidates.evaluateAll(rows=>rows.every(row=>row.getBoundingClientRect().height<=52))).toBe(true);
  await options.screenshot({path:`.tmp/exchange-compact-${width}.png`});
  await target.click();
  await expect(dialog).toHaveCount(0);
  await expect(source).toHaveAttribute('data-team-index','1');
  await expect(source).toHaveAttribute('data-assigned-position','DEF');
  await expect(source.locator('.sorteo-position-penalty')).toContainText('-10%');
  await expect(card('12')).toHaveAttribute('data-team-index','0');
  await expect(card('12')).toHaveAttribute('data-assigned-position','DEL');
  expect(errors).toEqual([]);
});
