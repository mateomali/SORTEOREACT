const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const fixture = (action,id) => execFileSync('php',['tests/sorteo-workflow-fixture.php',action,...(id?[String(id)]:[])],{encoding:'utf8'}).trim();

test('player detail offers valid exchanges on desktop and mobile',async({page})=>{
  const id=Number(fixture('create'));
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`http://127.0.0.1:8000/login.php?next=${encodeURIComponent(`sorteo_legacy_csv.php?match_id=${id}`)}`);
    await page.locator('#login-admin').evaluate(node=>node.open=true);
    await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD||'Goodfellas2026');
    await page.getByRole('button',{name:/Entrar como admin|Ingresar/i}).click();
    await page.locator('#generateTeamsButton').click();
    const cards=page.locator('[data-sorteo-drag-player][data-team-index="0"]:not([data-assigned-position="ARQ"])');
    await expect(cards.first()).toBeVisible();
    const assertCoverage = async () => {
      const teams = await page.locator('[data-sorteo-drag-player]').evaluateAll(cards => cards.reduce((teams, card) => {
        const counts = teams[card.dataset.teamIndex] ||= {ARQ:0,DEF:0,MED:0,DEL:0};
        const role = card.dataset.assignedPosition === 'LAT' ? 'DEF' : card.dataset.assignedPosition;
        counts[role] = (counts[role] || 0) + 1;
        return teams;
      }, {}));
      expect(Object.keys(teams)).toHaveLength(2);
      for (const counts of Object.values(teams)) {
        expect(counts.ARQ).toBe(1);
        expect(counts.DEF).toBeGreaterThanOrEqual(2);
        expect(counts.MED).toBeGreaterThanOrEqual(1);
        expect(counts.DEL).toBeGreaterThanOrEqual(1);
      }
    };
    await assertCoverage();
    for(const mobile of [false,true]) {
      await page.setViewportSize({width:mobile?390:1440,height:1000});
      const source=cards.first();const key=await source.getAttribute('data-player-key');
      await source.click();
      if(mobile) await page.getByRole('region',{name:'Mover o intercambiar jugador'}).getByRole('button',{name:'Ficha',exact:true}).click();
      const dialog=page.getByRole('dialog');
      await expect(dialog.getByText('Intercambiar con otro equipo',{exact:true})).toBeVisible();
      const destinations=dialog.locator('[data-exchange-player]');
      expect(await destinations.count()).toBeGreaterThan(0);
      await expect(destinations.filter({hasText:'fijado como arquero'}).first()).toBeDisabled();
      const target=dialog.locator('[data-exchange-player]:enabled').first();
      const targetKey=await target.getAttribute('data-exchange-player');
      await target.click();
      await expect(dialog).toHaveCount(0);
      await assertCoverage();
      await expect(page.locator(`[data-sorteo-drag-player][data-player-key="${key}"]`)).toHaveAttribute('data-team-index','1');
      await expect(page.locator(`[data-sorteo-drag-player][data-player-key="${targetKey}"]`)).toHaveAttribute('data-team-index','0');
      await page.locator(`[data-undo-player-exchange="${key}"]`).click();
      await expect(page.locator(`[data-sorteo-drag-player][data-player-key="${key}"]`)).toHaveAttribute('data-team-index','0');
    }
    expect(errors).toEqual([]);
  }finally{fixture('delete',id);}
});
