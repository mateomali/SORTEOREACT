const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
function php(code) {
  return execFileSync('php', [], { input: '<?php require "lib/repository.php"; ' + code, encoding: 'utf8' }).trim();
}
for (const mode of ['awards', 'ratings', 'both', 'round_robin']) {
  test(`finalization requires all scorers and displays them: ${mode}`, async ({ page, context }) => {
    const fixture = JSON.parse(php(`
      $pdo = db(); $pdo->beginTransaction();
      function copy_row($table, $row) {
        unset($row['id']);
        $columns = implode(',', array_map(fn($key) => '\\x60'.$key.'\\x60', array_keys($row)));
        $columns = str_replace('\\x60', chr(96), $columns);
        db()->prepare('INSERT INTO '.$table.' ('.$columns.') VALUES ('.implode(',', array_fill(0,count($row),'?')).')')->execute(array_values($row));
      }
      $row = repo_match_by_id(243); $row['title'] = 'Temporary scorer validation';
      $row['status']='sorteado'; $row['finalized_at']=null; $row['result_saved_at']=null;
      $row['valuation_mode']='${mode === 'round_robin' ? 'both' : mode}'; $row['match_date']=date('Y-m-d H:i:s');
      copy_row('matches',$row); $id=(int)$pdo->lastInsertId();
      foreach (['match_players','match_teams'] as $table) {
        foreach ($pdo->query('SELECT * FROM '.$table.' WHERE match_id=243')->fetchAll() as $row) {
          $row['match_id']=$id; $row['goals']=0;
          if ($table==='match_players') $row['rating']=null;
          copy_row($table,$row);
        }
      }
      ${mode === 'round_robin' ? `
      $pdo->prepare('UPDATE matches SET num_teams=3 WHERE id=?')->execute([$id]);
      $row=repo_match_teams($id)[1]; $row['team_number']=3; $row['color_name']='VERDE'; copy_row('match_teams',$row);
      $pdo->prepare('UPDATE match_players SET team_number=3 WHERE match_id=? AND team_number=2 ORDER BY player_id DESC LIMIT 2')->execute([$id]);
      ` : ''}
      $pdo->commit(); $_SESSION['is_admin']=true;
      echo json_encode(['id'=>$id,'session'=>session_id(),'players'=>repo_match_participants($id)]); session_write_close();
    `));
    try {
      await context.addCookies([{ name: 'PHPSESSID', value: fixture.session, url: BASE }]);
      const url = `${BASE}/finalizar_partido.php?match_id=${fixture.id}`;
      const scorer = fixture.players.find(player => Number(player.team_number) === 1);
      let scoreForm = { action:'save_score', match_id:String(fixture.id), 'team_goals[1]':'2', 'team_goals[2]':'0' };
      if (mode === 'round_robin') {
        await page.goto(url);
        const names=await page.locator('[name^="round_robin["]').evaluateAll(nodes=>nodes.map(node=>node.name));
        scoreForm = {action:'finalize_round_robin_date',match_id:String(fixture.id),round_robin_legs:'1',ajax:'1'};
        for (const name of names) scoreForm[name]=/^round_robin\[1-\d-1\]\[home\]$/.test(name)?'2':'0';
      }
      if (mode !== 'round_robin') {
        await page.goto(url);
        const team = page.locator('[data-finish-goals-team="1"]');
        await page.locator('[data-finish-team-goals][data-team-number="1"]').fill('2');
        await expect(team.locator('[data-finish-goals-progress]')).toContainText('Faltan 2 goles');
        await team.locator(`input[name="goals[${scorer.id}]"]`).fill('2');
        await expect(team.locator('[data-finish-goals-progress]')).toContainText('Completo');
        await expect(page.locator(`input[name="goals[${scorer.id}]"]`)).toHaveCount(1);
        await page.setViewportSize({width:390,height:844});
        await page.locator('#resultado').screenshot({path:`outputs/unified-goals-${mode}.png`});
      }
      const missing = await page.request.post(url, { form:scoreForm });
      expect(await missing.text()).toContain('Completa los goleadores');
      scoreForm[`goals[${scorer.id}]`]='2';
      const scoreResponse = await page.request.post(url, { form:scoreForm });
      if(mode === 'round_robin') { const payload=await scoreResponse.json(); expect(payload,payload.message).toMatchObject({ok:true}); }
      expect(php(`echo repo_match_by_id(${fixture.id})['status'];`)).toBe('finalizado');
      expect(php(`require "lib/directivos.php"; echo directive_voting_is_open(repo_match_by_id(${fixture.id})) ? 'open' : 'closed';`)).toBe('open');
      await page.goto(url);
      await expect(page.getByRole('heading', {name:'Goles', exact:true})).toBeVisible();
      await expect(page.getByRole('link', {name:/Ver formaciones/})).toHaveCount(0);
      if (mode !== 'round_robin') await expect(page.getByRole('heading', {name:'Resultado del partido', exact:true})).toBeVisible();
      const valuations = page.locator('#valoraciones');
      await expect(valuations).not.toHaveAttribute('open', '');
      await expect(page.getByRole('heading', {name:mode === 'ratings' ? 'Puntajes' : 'Premios', exact:true})).toBeVisible();
      await expect(page.getByRole('button', {name:'Finalizar fecha', exact:true})).toBeVisible();
      await valuations.locator('summary').click();
      await expect(valuations).toHaveAttribute('open', '');
      await expect(page.locator('.finish-ratings-menu')).toHaveCount(0);
      await expect(page.locator('input[name^="rating["]')).toHaveCount(0);
      await expect(page.locator('#valoraciones input[name^="awards["]')).toHaveCount(mode === 'ratings' ? 0 : 17);
      await expect(page.locator('input[name^="goals["]')).toHaveCount(fixture.players.length);
      if (mode !== 'ratings') {
        await page.locator('#award-player_of_match').fill(`${scorer.name} (#${scorer.id})`);
        page.on('dialog', dialog => dialog.accept());
        await page.getByRole('button', {name:'Finalizar fecha', exact:true}).click();
        await expect.poll(() => php(`require "lib/awards.php"; echo repo_match_awards(${fixture.id})['player_of_match']['player_id'] ?? 0;`)).toBe(String(scorer.id));
      }
      await page.locator('#resultado').screenshot({path:`outputs/finalization-goals-${mode}.png`});
      await page.locator('#valoraciones').screenshot({path:`outputs/finalization-awards-${mode}.png`});
      for (const route of ['index.php', 'historial.php']) {
        await page.goto(`${BASE}/${route}?match_id=${fixture.id}`);
        const badge = page.locator('.formation-scorer-badge').filter({ hasText: 'x2' }).first();
        await expect(badge).toHaveCount(1);
        await expect(badge).toHaveAttribute('aria-label', `${scorer.name}: 2 goles`);
        const courtMarkup = await badge.evaluate(node => node.closest('.public-teams').outerHTML);
        await page.evaluate(markup => {
          const main = document.createElement('main'); main.className='content'; main.innerHTML=markup;
          document.body.replaceChildren(main);
        }, courtMarkup);
        await page.setViewportSize({ width:390, height:844 });
        await badge.evaluate(node => { for(let parent=node.parentElement;parent;parent=parent.parentElement) if(parent.tagName==='DETAILS') parent.open=true; });
        const card = badge.locator('..');
        const geometry = await card.evaluate(node => {
          const badge=node.querySelector('.formation-scorer-badge').getBoundingClientRect();
          const card=node.getBoundingClientRect();
          const photo=node.querySelector('.formation-card-photo').getBoundingClientRect();
          return {right:badge.right, cardRight:card.right, bottom:badge.bottom, photoTop:photo.top};
        });
        expect(geometry.right).toBeLessThanOrEqual(geometry.cardRight+1);
        expect(geometry.bottom).toBeLessThanOrEqual(geometry.photoTop+1);
        await page.locator('.team-formation').first().screenshot({path:`outputs/scorers-${mode}-${route}.png`});
      }
    } finally {
      php(`$id=${fixture.id}; foreach (['match_awards','match_round_robin_results','match_players','match_teams'] as $table) db()->prepare('DELETE FROM '.$table.' WHERE match_id=?')->execute([$id]); db()->prepare('DELETE FROM matches WHERE id=?')->execute([$id]);`);
    }
  });
}
