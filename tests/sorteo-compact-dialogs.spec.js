const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const policy = fs.readFileSync('assets/player-rating-policy.json','utf8');
for (const invitationMode of [false,true]) test(`compact dialogs and equal pitches, invitation=${invitationMode}`, async ({ page }) => {
  const roles=['ARQ','DEF','DEF','MED','MED','DEL','DEL'];
  const teams=[0,1,2].map(t => roles.map((positions,i)=>({ id:t*7+i+1, name: t === 1 ? `Jugador de nombre largo ${i+1}` : `Jugador ${t*7+i+1}`, positions, assigned_position:positions, skill:4 })));
  const payload={ players:teams.flat(), initialTeams:teams, numTeams:3, matchId:42, invitationMode, savedGoalkeeperIds:['1','8','15'], separatedPairs:[['2','9','16'],['3','10']], links:{} };
  await page.route('**/__compact', route=>route.fulfill({ contentType:'text/html',body:`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assets/tailwind.css"></head><body class="page-sorteo-legacy sorteo-page"><main class="content"><script src="/assets/player-rating.js"></script><script type="application/json" data-player-rating-policy>${policy}</script><div data-react-root data-react-island="sorteo_legacy_page" data-payload='${JSON.stringify(payload)}'></div></main><script type="module" src="/assets/react/react-app.js"></script></body></html>` }));
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:8000/__compact');
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
  await page.setViewportSize({width:390,height:844});
  await playerButton.click();
  await roster.screenshot({path:`.tmp/compact-roster-${invitationMode}.png`});
});
