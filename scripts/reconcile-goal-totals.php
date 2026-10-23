<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/goal_corrections.php';
$apply = in_array('--apply', $argv, true);
$before = db()->query("SELECT p.id,p.name,COALESCE(SUM(CASE WHEN m.status='finalizado'
    AND m.match_date >= '2026-01-01' AND m.match_date < '2027-01-01' THEN mp.goals ELSE 0 END),0) goals
    FROM players p LEFT JOIN match_players mp ON mp.player_id=p.id
    LEFT JOIN matches m ON m.id=mp.match_id GROUP BY p.id,p.name")->fetchAll();
$expected = verified_goal_totals_2026();
$report = [];
foreach ($before as $row) {
    if (!array_key_exists($row['name'], $expected)) continue;
    $report[] = ['id' => (int) $row['id'], 'name' => $row['name'], 'recorded' => (int) $row['goals'],
        'verified' => $expected[$row['name']], 'difference' => $expected[$row['name']] - (int) $row['goals']];
}
if (count($report) !== count($expected)) throw new RuntimeException('No se identificaron todos los jugadores.');
if ($apply) ensure_goal_corrections();
echo json_encode(['year' => 2026, 'applied' => $apply, 'players' => $report], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
