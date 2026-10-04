const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const policy=fs.readFileSync('assets/player-rating-policy.json','utf8');
const BASE=process.env.BASE_URL || 'http://127.0.0.1:8000';
for(const mode of ['formation_editor','draw']) test(`highest scoring formation option in ${mode}`,async({page})=>{
  const width=1440;
  await page.setViewportSize({width,height:1000});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const roles=['ARQ','DEF','DEF','DEF/MED','MED/DEL','DEL','DEL'];
  const assigned=['ARQ','DEF','DEF','MED','DEL','DEL','DEL'];
  const teams=[0,1].map(team=>roles.map((positions,index)=>({
    id:team*10+index+1,name:`Player ${team*10+index+1}`,positions,assigned_position:assigned[index],
    skill:3.5,technique:3.5,pass_vision:3.5,defense_physical:3.5,attack:3.5,rhythm:3.5,stamina:3.5,
    teamwork:3.5,mentality:3.5,goalkeeper_skill:3.5,regularity:3.5,
  })));
  const payload={players:teams.flat(),initialTeams:teams,numTeams:2,teamColors:['ROSA','AZUL'],links:{},mode};
  await page.route('**/__line_controls_fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"><link rel="stylesheet" href="/assets/contrast-overrides.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page"><script type="application/json">${JSON.stringify(payload)}</script></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>`}));
  await page.goto(`${BASE}/__line_controls_fixture`);
  const card=key=>page.locator(`[data-sorteo-drag-player][data-player-key="${key}"]`);
  const select=page.locator('[data-sorteo-team-card]').first().locator('select').filter({has:page.locator('option[value="highest-score"]')});
  await expect(select).toHaveCount(1);
  await expect(select.locator('option[value="highest-score"]')).toContainText('Mayor puntaje');
  await select.selectOption('highest-score');
  await expect(select).toHaveValue('highest-score');
  await expect(card('1')).toHaveAttribute('data-assigned-position','ARQ');
  await page.locator('[data-sorteo-team-card]').first().getByRole('button',{name:'Deshacer ultimo cambio',exact:true}).click();
  await expect(select).not.toHaveValue('highest-score');
  expect(errors).toEqual([]);
});
