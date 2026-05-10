<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/db.php';

$commit = in_array('--commit', $argv, true);
$pdo = db();

$allWhatsapp = in_array('--all-whatsapp', $argv, true);
$where = $allWhatsapp
    ? "notes LIKE '%whatsapp:%' OR notes LIKE '%whatsapp-awards-only:%'"
    : "notes LIKE '%whatsapp-awards-only:%'";

$matchIds = $pdo->query(
    "SELECT id
     FROM matches
     WHERE {$where}"
)->fetchAll(PDO::FETCH_COLUMN);

if (!$matchIds) {
    echo "No hay partidos importados para reparar.\n";
    exit(0);
}

$in = implode(',', array_fill(0, count($matchIds), '?'));
$playerRows = $pdo->prepare(
    "SELECT mp.match_id, p.name, mp.goals
     FROM match_players mp
     INNER JOIN players p ON p.id = mp.player_id
     WHERE mp.match_id IN ($in) AND mp.goals > 0
     ORDER BY mp.match_id, p.name"
);
$playerRows->execute($matchIds);

$teamRows = $pdo->prepare(
    "SELECT match_id, team_number, goals
     FROM match_teams
     WHERE match_id IN ($in) AND goals > 0
     ORDER BY match_id, team_number"
);
$teamRows->execute($matchIds);

$playersToFix = $playerRows->fetchAll();
$teamsToFix = $teamRows->fetchAll();

echo ($commit ? "REPAIR\n" : "DRY-RUN\n");
echo 'Alcance: ' . ($allWhatsapp ? 'todos los importados desde WhatsApp' : 'solo whatsapp-awards-only') . PHP_EOL;
echo 'Partidos revisados: ' . count($matchIds) . PHP_EOL;
echo 'Jugadores con goles a limpiar: ' . count($playersToFix) . PHP_EOL;
foreach ($playersToFix as $row) {
    echo sprintf("- match #%d | %s | goles %d\n", (int) $row['match_id'], (string) $row['name'], (int) $row['goals']);
}
echo 'Equipos con marcador a limpiar: ' . count($teamsToFix) . PHP_EOL;
foreach ($teamsToFix as $row) {
    echo sprintf("- match #%d | equipo %d | goles %d\n", (int) $row['match_id'], (int) $row['team_number'], (int) $row['goals']);
}

if (!$commit) {
    echo "\nPara reparar solo awards-only: php scripts/repair_awards_only_payment_icons.php --commit\n";
    echo "Para reparar todos los WhatsApp: php scripts/repair_awards_only_payment_icons.php --commit --all-whatsapp\n";
    exit(0);
}

$pdo->beginTransaction();
try {
    $updatePlayers = $pdo->prepare("UPDATE match_players SET goals = 0 WHERE match_id IN ($in)");
    $updatePlayers->execute($matchIds);
    $updateTeams = $pdo->prepare("UPDATE match_teams SET goals = 0 WHERE match_id IN ($in)");
    $updateTeams->execute($matchIds);
    $pdo->commit();
    echo "Goles y marcadores limpiados.\n";
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
