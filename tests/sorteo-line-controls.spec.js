const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const policy=fs.readFileSync('assets/player-rating-policy.json','utf8');
const BASE=process.env.BASE_URL || 'http://127.0.0.1:8000';
for(const width of [1440,390]) test(`line +/- redistributes players and undo restores the lineup at ${width}px`,async({page})=>{
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
  const team=page.locator('[data-sorteo-team-card]').first();
  const cards=team.locator('[data-sorteo-drag-player]');
  await expect(cards).toHaveCount(7);
  const snapshot=()=>cards.evaluateAll(cards=>Object.fromEntries(cards.map(card=>[card.dataset.playerKey,card.dataset.assignedPosition])));
  const before=await snapshot();
  const counts=async()=>Object.values(await snapshot()).reduce((counts,role)=>{counts[role==='LAT'?'DEF':role]++;return counts;},{ARQ:0,DEF:0,MED:0,DEL:0});
  await team.getByRole('button',{name:'Agregar jugador a DEF/LAT',exact:true}).click();
  await expect.poll(counts).toEqual({ARQ:1,DEF:3,MED:1,DEL:2});
  expect((await snapshot())['4']).toBe('DEF');
  expect((await snapshot())['5']).toBe('MED');
  await team.getByRole('button',{name:'Deshacer ultimo cambio',exact:true}).click();
  await expect.poll(snapshot).toEqual(before);
  // Lowering attack must move the secondary-position player into midfield.
  await team.getByRole('button',{name:'Quitar jugador de DEL',exact:true}).click();
  await expect.poll(counts).toEqual({ARQ:1,DEF:2,MED:2,DEL:2});
  await team.getByRole('button',{name:'Deshacer ultimo cambio',exact:true}).click();
  await expect.poll(snapshot).toEqual(before);
  // Removing a minimum defender must explain the restriction and keep every card.
  await team.getByRole('button',{name:'Quitar jugador de DEF/LAT',exact:true}).click();
  await expect(page.getByText(/debe conservar al menos 2 jugadores/)).toBeVisible();
  expect(await snapshot()).toEqual(before);
  expect(errors).toEqual([]);
});
