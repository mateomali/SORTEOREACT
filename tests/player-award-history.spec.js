const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

function databaseReference(playerId) {
  return JSON.parse(execFileSync('C:/xampp/php/php.exe', [], {
    input: `<?php require 'lib/db.php'; require 'lib/goal_corrections.php';
      $pid=${Number(playerId)}; $year=(int)date('Y');
      $q=db()->prepare("SELECT m.id,DATE(m.match_date) date,COALESCE(NULLIF(TRIM(m.title),''),'Fecha sin nombre') title,ma.award_code code,
        CASE WHEN (SELECT COUNT(*) FROM match_awards s WHERE s.match_id=ma.match_id AND s.award_code=ma.award_code)>1 THEN ma.award_position ELSE 0 END position
        FROM match_awards ma JOIN matches m ON m.id=ma.match_id WHERE ma.player_id=? AND m.status='finalizado' AND YEAR(m.match_date)=? ORDER BY m.match_date DESC,m.id DESC");
      $q->execute([$pid,$year]);$awards=$q->fetchAll();
      $q=db()->prepare("SELECT COALESCE(SUM(mp.goals),0) goals FROM match_players mp JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=? AND m.status='finalizado' AND YEAR(m.match_date)=?");
      $q->execute([$pid,$year]);echo json_encode(['awards'=>$awards,'goals'=>max(0,(int)$q->fetchColumn()+(goal_corrections($year)[$pid]??0))]);`,
    encoding: 'utf8',
  }));
}

for (const width of [1366, 390]) {
  test(`player award dates and annual goals at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${BASE}/jugadores2.php`);
    const payload = await page.locator('[data-react-island="jugadores2_page"]').evaluate(node => JSON.parse(node.dataset.payload || node.querySelector('script[type="application/json"]').textContent));
    const player = payload.players.find(p => p.annualAwards.some(a => a.code !== 'monthly' && a.matches?.length >= 2) && p.annualResults.goals > 0);
    expect(player).toBeTruthy();
    // Include inactive recipients too: the directory only exposes active players.
    const allAwards = JSON.parse(execFileSync('C:/xampp/php/php.exe', [], {
      input: `<?php require 'lib/db.php'; require 'lib/awards.php';
        $year=(int)date('Y');
        $rows=db()->query("SELECT ma.player_id id,p.name,ma.award_code code,ma.award_position raw_position,
          CASE WHEN (SELECT COUNT(*) FROM match_awards s WHERE s.match_id=ma.match_id AND s.award_code=ma.award_code)>1 THEN ma.award_position ELSE 0 END position
          FROM match_awards ma JOIN players p ON p.id=ma.player_id JOIN matches m ON m.id=ma.match_id WHERE m.status='finalizado' AND YEAR(m.match_date)=$year")->fetchAll();
        foreach(monthly_player_awards() as $award) {
          if(substr($award['month_start'],0,4)==$year) $rows[]=['id'=>$award['player_id'],'name'=>db()->query('SELECT name FROM players WHERE id='.(int)$award['player_id'])->fetchColumn(),'code'=>'monthly','position'=>1];
        }
        foreach($rows as &$row) $row['points']=award_max_recipients($row['code'])>1 ? max(1,4-(int)$row['raw_position']) : 1;
        echo json_encode($rows);`, encoding: 'utf8',
    }));
    const rankingCounts = new Map();
    const rankingPoints = new Map();
    for (const award of allAwards) {
      const key = award.code;
      if (!rankingCounts.has(key)) rankingCounts.set(key, new Map());
      if (!rankingPoints.has(key)) rankingPoints.set(key, new Map());
      const counts = rankingCounts.get(key);
      const points = rankingPoints.get(key);
      counts.set(Number(award.id), (counts.get(Number(award.id)) || 0) + 1);
      points.set(Number(award.id), (points.get(Number(award.id)) || 0) + Number(award.points));
    }
    for (const candidate of payload.players) {
      for (const award of candidate.annualAwards) {
        const counts = rankingCounts.get(award.code);
        const points = rankingPoints.get(award.code);
        const ownCount = counts.get(Number(candidate.id));
        const ownPoints = points.get(Number(candidate.id));
        expect(award.ranking).toMatchObject({
          position: 1 + [...points.values()].filter(score => score > ownPoints).length,
          totalPlayers: counts.size,
          count: ownCount,
          totalAwards: [...counts.values()].reduce((sum, count) => sum + count, 0),
          points: ownPoints,
          usesPoints: ['masterful_pass', 'wall', 'capocannoniere', 'terminator', 'guinda', 'golosa', 'putita', 'chenemigo', 'goodfellas'].includes(award.code),
        });
        const expectedIds = [...points].filter(([id, score]) => id !== Number(candidate.id) && score === ownPoints).map(([id]) => id).sort((a, b) => a - b);
        expect(award.ranking.sharedWith.map(p => p.id).sort((a, b) => a - b)).toEqual(expectedIds);
        for (const peer of award.ranking.sharedWith) expect(peer.name).toBe(allAwards.find(row => Number(row.id) === peer.id).name);
      }
    }
    const reference = databaseReference(player.id);
    expect(player.annualResults.goals).toBe(reference.goals);
    expect(player.annualResults.ranks.goals).toBeGreaterThan(0);
    const award = player.annualAwards.find(a => a.code !== 'monthly' && a.matches?.length >= 2);
    const expectedMatches = reference.awards.filter(a => a.code === award.code && Number(a.position) === award.position);
    expect(award.count).toBe(expectedMatches.length);
    expect(award.matches.map(m => ({ id: m.id, date: m.date, title: m.title }))).toEqual(expectedMatches.map(m => ({ id: Number(m.id), date: m.date, title: m.title })));

    await page.getByRole('searchbox', { name: 'Buscar jugador' }).fill(player.name);
    await page.locator('.directory-player-name:visible').first().click();
    const profile = page.getByRole('dialog', { name: `Ficha de ${player.name}`, exact: true });
    await expect(profile).toBeVisible();
    await expect(profile.getByRole('tab')).toHaveCount(2);
    await expect(profile.getByRole('tab', { name: 'Descripción y estadísticas', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(profile.getByRole('tabpanel', { name: 'Descripción y estadísticas', exact: true })).toBeVisible();
    await expect(profile.locator('.player-story')).toBeVisible();
    await expect(profile.getByRole('button', { name: `Ver radar completo de ${player.name}` })).toBeVisible();
    await profile.getByRole('tab', { name: 'Descripción y estadísticas', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(profile.getByRole('tab', { name: 'Premios', exact: true })).toBeFocused();
    await profile.getByRole('tab', { name: 'Premios', exact: true }).click();
    await expect(profile.getByRole('tabpanel', { name: 'Premios', exact: true })).toBeVisible();
    await expect(profile.getByRole('tabpanel', { name: 'Descripción y estadísticas', exact: true })).toBeHidden();
    expect(await profile.locator('.player-profile-content').evaluate(node => node.scrollTop)).toBe(0);
    expect(await profile.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: `outputs/player-profile-tabs-${width}.png` });
    const goals = profile.locator('.player-annual-results article').filter({ hasText: 'Goles del año' });
    await expect(goals.locator('strong')).toHaveText(String(reference.goals));
    await expect(goals.locator('p b')).toHaveText(`${player.annualResults.ranks.goals}°`);
    const label = `Ver fechas de ${award.label}${award.position > 0 ? `, ${award.position}.º puesto` : ''}`;
    const trigger = profile.getByRole('button', { name: label, exact: true });
    await expect(trigger.locator('.player-award-ranking')).toHaveText(`${award.ranking.position}.º en el ranking de ${award.label}`);
    for (const podiumAward of player.annualAwards.filter(a => a.position > 0 && a.code !== 'monthly')) {
      const card = profile.getByRole('button', { name: `Ver fechas de ${podiumAward.label}, ${podiumAward.position}.º puesto`, exact: true });
      await expect(card.locator('.player-award-date-position')).toHaveText(`Premio recibido: ${podiumAward.position}.º puesto en la fecha`);
    }
    for (const peer of award.ranking.sharedWith) await expect(trigger.locator('.player-award-ranking-shared')).toContainText(peer.name);
    if (!award.ranking.sharedWith.length) await expect(trigger.locator('.player-award-ranking-shared')).toHaveCount(0);
    await trigger.click();
    const history = page.getByRole('dialog', { name: `Fechas de ${award.label}`, exact: true });
    await expect(history).toBeVisible();
    await expect(history.locator('tbody tr')).toHaveCount(expectedMatches.length);
    for (const match of award.matches) {
      await expect(history.locator('tbody')).toContainText(match.dateLabel);
      await expect(history.locator('tbody')).toContainText(match.title);
    }
    expect(await history.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: `outputs/player-award-history-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(history).toHaveCount(0);
    await expect(profile).toBeVisible();
    await expect(trigger).toBeFocused();
    await trigger.click();
    await history.getByRole('button', { name: 'Cerrar fechas del premio' }).click();
    await expect(history).toHaveCount(0);
    await expect(profile).toBeVisible();
  });
}
