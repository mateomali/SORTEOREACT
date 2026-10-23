<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/goal_corrections.php';
function check_goals(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function recorded_goals_rows(): array {
    return db()->query("SELECT p.id,p.name,COALESCE(SUM(CASE WHEN m.status='finalizado'
        AND YEAR(m.match_date)=2026 THEN mp.goals ELSE 0 END),0) goals
        FROM players p LEFT JOIN match_players mp ON mp.player_id=p.id
        LEFT JOIN matches m ON m.id=mp.match_id GROUP BY p.id,p.name")->fetchAll();
}
$pdo = db();
$before = $pdo->query('SELECT * FROM match_players ORDER BY id')->fetchAll();
$rows = apply_goal_corrections(recorded_goals_rows(), 'goals', 2026);
$expected = verified_goal_totals_2026();
foreach ($rows as $row) if (isset($expected[$row['name']])) {
    check_goals($row['goals'] === $expected[$row['name']], 'Total incorrecto: ' . $row['name']);
}
check_goals($before === $pdo->query('SELECT * FROM match_players ORDER BY id')->fetchAll(), 'Se modificaron participaciones originales');
check_goals(goal_corrections(2025) === [], 'La corrección afectó otro año');
$baseline = $pdo->query('SELECT * FROM player_goal_corrections ORDER BY player_id')->fetchAll();
// A separate request reruns initialization without resetting the baseline.
exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/../scripts/reconcile-goal-totals.php') . ' --apply', $output, $code);
check_goals($code === 0, 'Falló reaplicación');
check_goals($baseline === $pdo->query('SELECT * FROM player_goal_corrections ORDER BY player_id')->fetchAll(), 'La reaplicación cambió el acumulado');
$pdo->beginTransaction();
try {
    $record = $pdo->query("SELECT mp.id,mp.player_id FROM match_players mp JOIN matches m ON m.id=mp.match_id
        JOIN players p ON p.id=mp.player_id WHERE p.name='MARIAN' AND YEAR(m.match_date)=2026 AND m.status='finalizado' LIMIT 1")->fetch();
    $pdo->exec('UPDATE match_players SET goals=goals+1 WHERE id=' . (int) $record['id']);
    $future = apply_goal_corrections(recorded_goals_rows(), 'goals', 2026);
    foreach ($future as $row) if ($row['name'] === 'MARIAN') check_goals($row['goals'] === 63, 'Los goles posteriores no suman');
} finally { $pdo->rollBack(); }
check_goals($before === $pdo->query('SELECT * FROM match_players ORDER BY id')->fetchAll(), 'La prueba no restauró los registros');
echo count($expected) . " totales verificados; historial intacto; reaplicación segura; goles posteriores suman.\n";
