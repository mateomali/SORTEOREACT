const {test,expect}=require('@playwright/test');
for(const width of [1440,390,320])test(`create match steps at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.goto('http://127.0.0.1:8000/login.php?next=crear_partido.php');
 await page.getByRole('button',{name:'Administrador',exact:true}).click();
 await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD||'Goodfellas2026');
 await page.getByRole('button',{name:'Entrar como admin'}).click();
 await page.waitForURL('**/crear_partido.php');
 const config=page.locator('[data-wizard-panel="1"]'), players=page.locator('[data-wizard-panel="2"]');
 await expect(config).toBeVisible();await expect(players).toBeHidden();
 const duration=page.getByLabel('Duración de cada partido (minutos)',{exact:true});
 await page.locator('[data-num-teams]').fill('2');
 await expect(duration).toBeHidden();await expect(duration).toBeDisabled();
 for(const teams of ['3','4']){
  await page.locator('[data-num-teams]').fill(teams);
  await expect(duration).toBeVisible();await expect(duration).toBeEnabled();
  if(teams==='3'){
   await expect(page.locator('[data-players-per-team]')).toHaveValue('7');
   await expect(page.locator('[data-match-cup-total]').first()).toHaveText('21');
   await page.locator('[data-players-per-team]').fill('8');
   await page.locator('[data-players-per-team]').blur();
   await expect(page.locator('[data-players-per-team]')).toHaveValue('8');
  }
 }
 await duration.fill('15');
 await page.locator('[data-num-teams]').fill('2');
 await expect(duration).toBeHidden();await expect(duration).toBeDisabled();
 await page.locator('[data-num-teams]').fill('3');
 await expect(duration).toHaveValue('15');
 await duration.fill('0');
 await page.locator('[data-match-next]').click();
 await expect(config).toBeVisible();await expect(players).toBeHidden();
 await duration.fill('15');
 await page.locator('[data-num-teams]').fill('5');
 await page.locator('[data-match-next]').click();await expect(config).toBeVisible();
 await page.locator('[data-num-teams]').fill('2');
 await page.locator('[data-players-per-team]').fill('3');
 await page.locator('[data-match-next]').click();
 await expect(players).toBeVisible();await expect(config).toBeHidden();
 await expect(page.locator('.participant-search-toolbar')).toContainText('/6 convocados');
 const row=page.locator('[data-player-row]:visible').first();
 const id=await row.getAttribute('data-player-id');
 await row.locator('[data-participant-toggle]').click();
 await page.getByRole('button',{name:'Convocados',exact:true}).click();
 await expect(page.locator('[data-player-row]:visible')).toHaveCount(1);
 await page.getByRole('button',{name:'Todos',exact:true}).click();
 await page.locator('#participantSearchReact').fill('zzzz-no-player');
 await expect(page.locator('[data-player-row]:visible')).toHaveCount(0);
 await page.locator('#participantSearchReact').fill('');
 await page.locator('[data-match-back]').click();
 await expect(config).toBeVisible();await page.locator('[data-match-next]').click();
 await expect(page.locator(`input[name="participants[]"][value="${id}"]`)).toBeChecked();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`outputs/create-match-steps-${width}.png`,fullPage:true});
});
