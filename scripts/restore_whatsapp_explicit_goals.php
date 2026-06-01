<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/db.php';

$inputPath = 'C:\\Users\\Usuario\\Downloads\\Chat de WhatsApp con GOODFELLAS\\Chat de WhatsApp con GOODFELLAS - solo resumenes de partidos.txt';
$commit = in_array('--commit', $argv, true);

$months = [
    'enero' => 1,
    'febrero' => 2,
    'marzo' => 3,
    'abril' => 4,
    'mayo' => 5,
    'junio' => 6,
    'julio' => 7,
    'agosto' => 8,
    'septiembre' => 9,
    'setiembre' => 9,
    'octubre' => 10,
    'noviembre' => 11,
    'diciembre' => 12,
];

$manualAliases = [
    'AGUSTO' => 'AUGUSTO',
    'ANIBAL' => 'ANIBAL',
    'BRAI' => 'BRIAN',
    'BRAIAN' => 'BRIAN',
    'BRIAN' => 'BRIAN',
    'BRIAN PORTILLO' => 'BRIAN',
    'BRAIN' => 'BRIAN',
    'CESAR' => 'CESAR',
    'CAYE' => 'COMANCHE',
    'CRIS' => 'CRISTIAN',
    'EL CUERVO' => 'CUERVO',
    'FACU' => 'FACU',
    'FRAN' => 'FRANQUITO',
    'FRAN F' => 'FRANQUITO',
    'FRAN K' => 'FRANCOK',
    'FRANCO' => 'FRANCO',
    'FRANCO F' => 'FRANCO',
    'FRANCO K' => 'FRANCOK',
    'FRANCOK' => 'FRANCOK',
    'FRANQUITO' => 'FRANQUITO',
    'GONZA' => 'GONZA',
    'GUILLE' => 'GUILLE',
    'ISMA' => 'ISMA',
    'JAVIER' => 'JAVI',
    'JAVI' => 'JAVI',
    'KINGO' => 'VIKINGO',
    'GARCIA' => 'PABLO GARCIA',
    'LUCAS' => 'VIKINGO',
    'LUCAS2' => 'LUCAS2',
    'LUKAS' => 'VIKINGO',
    'MANU' => 'MANU',
    'MARCE' => 'MARCELO',
    'MARCELO' => 'MARCELO',
    'MARIAN' => 'MARIAN',
    'MARIANO' => 'MARIAN',
    'MARIANO PLANAS' => 'MARIANO PLANAS',
    'MAURI' => 'MAURI',
    'MATI C' => 'MATIAS C',
    'MATI CESAR' => 'MATIAS C',
    'MATY C' => 'MATIAS C',
    'NICO' => 'NICO',
    'PABLO' => 'PABLO',
    'PABLO GARCIA' => 'PABLO GARCIA',
    'PABLO GARCÍA' => 'PABLO GARCIA',
    'PABLO G' => 'PABLO GARCIA',
    'PABLO K' => 'PABLO CASTILLO',
    'PELADO' => 'PELA',
    'PELA' => 'PELA',
    'PLANAS' => 'MARIANO PLANAS',
    'BETO PIKI' => 'BETO',
    'RODRI CHAVEZ' => 'RODRI CHAVEZ',
    'RODRI CHÁVEZ' => 'RODRI CHAVEZ',
    'RODRI' => 'RODRI SUAREZ',
    'RODRI SUAREZ' => 'RODRI SUAREZ',
    'RODRI SUÁREZ' => 'RODRI SUAREZ',
    'SEBA' => 'SEBACORTEZ',
    'SEBA CORTEZ' => 'SEBACORTEZ',
    'TEBO' => 'TEBO',
    'TEBA' => 'TEBO',
    'TIMO' => 'TIMO',
    'VICTOR' => 'VICTOR',
    'VIKINGO' => 'VIKINGO',
    'R CHAVEZ' => 'RODRI CHAVEZ',
    'R CHÁVEZ' => 'RODRI CHAVEZ',
];

$goalOverrides = [
    '2025-10-31|RODRI' => 'RODRI CHAVEZ',
    '2026-01-26|FRANCO K' => 'FRANCO',
];

function restore_goals_normalize(string $value): string
{
    $value = trim($value);
    $value = str_replace(["\xC2\xA0", "\t"], ' ', $value);
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    $value = mb_strtoupper($value, 'UTF-8');
    $value = strtr($value, [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
    ]);
    $value = preg_replace('/[^A-Z0-9 ]/u', '', $value) ?? $value;
    return trim($value);
}

function restore_goals_player_key(string $rawName, array $manualAliases): ?string
{
    $key = restore_goals_normalize($rawName);
    if (preg_match('/^(.+)\s+(\d)\s+(\d)$/', $key, $matches)) {
        $key = trim((string) $matches[1]);
    }
    if ($key === '' || $key === 'VACANTE' || str_starts_with($key, 'TODOS LOS ')) {
        return null;
    }
    return $manualAliases[$key] ?? $key;
}

function restore_goals_parse_date(string $heading, int $year, array $months): DateTimeImmutable
{
    if (!preg_match('/^Fecha\s+(\d{1,2})\s+de\s+([[:alpha:]]+)/iu', trim($heading), $matches)) {
        throw new RuntimeException('No pude leer el membrete: ' . $heading);
    }
    $monthKey = strtolower(restore_goals_normalize((string) $matches[2]));
    if (!isset($months[$monthKey])) {
        throw new RuntimeException('Mes desconocido en: ' . $heading);
    }
    return new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $months[$monthKey], (int) $matches[1]));
}

function restore_goals_parse_match(string $block, int $year, array $months): array
{
    $lines = preg_split('/\R/u', $block) ?: [];
    $lines = array_map(static fn(string $line): string => trim($line), $lines);
    $heading = array_shift($lines) ?? '';
    $date = restore_goals_parse_date($heading, $year, $months);

    $title = '';
    if (isset($lines[0]) && $lines[0] !== '' && !str_starts_with(restore_goals_normalize($lines[0]), 'EQUIPO')) {
        $title = array_shift($lines);
    }
    if ($title === '') {
        $title = $heading;
    }

    $teams = [];
    $goals = [];
    $currentTeam = null;
    $readGoals = false;
    $pendingAward = false;

    foreach ($lines as $line) {
        if ($line === '') {
            continue;
        }
        if (preg_match('/^Equipo\.?\s*(.*?)\s*(\d+)?$/iu', $line, $matches)) {
            $currentTeam = count($teams) + 1;
            $teams[$currentTeam] = [
                'label' => trim((string) ($matches[1] ?? '')),
                'goals' => isset($matches[2]) && $matches[2] !== '' ? (int) $matches[2] : 0,
                'players' => [],
            ];
            $readGoals = false;
            $pendingAward = false;
            continue;
        }
        if (preg_match('/^Goles:?$/iu', $line)) {
            $readGoals = true;
            $pendingAward = false;
            continue;
        }
        if (preg_match('/Man of the Match|Gol de la fecha|Lirico|El muro|Capocannoniere|Terminator|Tractor|Guinda|Putita|Portero|Golero|Goodfellas/iu', $line)) {
            $pendingAward = true;
            $readGoals = false;
            continue;
        }
        if ($pendingAward) {
            $pendingAward = false;
            continue;
        }
        if ($readGoals) {
            if (preg_match('/^(.+?)\s+(\d+)$/u', $line, $matches)) {
                $goals[] = ['name' => trim((string) $matches[1]), 'goals' => (int) $matches[2]];
            } elseif (preg_match('/^(\d+)\s+(.+?)$/u', $line, $matches)) {
                $goals[] = ['name' => trim((string) $matches[2]), 'goals' => (int) $matches[1]];
            }
            continue;
        }
        if ($currentTeam !== null && preg_match('/^(.+?)\s+(\d)\s+(\d)$/u', $line, $splitDecimalMatches)) {
            $teams[$currentTeam]['players'][] = [
                'name' => trim((string) $splitDecimalMatches[1]),
                'rating' => (float) ((string) $splitDecimalMatches[2] . '.' . (string) $splitDecimalMatches[3]),
            ];
            continue;
        }
        if ($currentTeam !== null && preg_match('/^([[:alpha:]ÁÉÍÓÚÜÑáéíóúüñ ]{3,})(\d+(?:[,.]\d+)?)$/u', $line, $stuckRatingMatches)) {
            $teams[$currentTeam]['players'][] = [
                'name' => trim((string) $stuckRatingMatches[1]),
                'rating' => (float) str_replace(',', '.', (string) $stuckRatingMatches[2]),
            ];
            continue;
        }
        if ($currentTeam !== null && preg_match('/^(.+?)\s+(\d+(?:[,.]\d+)?)$/u', $line, $matches)) {
            $teams[$currentTeam]['players'][] = [
                'name' => trim((string) $matches[1]),
                'rating' => (float) str_replace(',', '.', (string) $matches[2]),
            ];
        }
    }

    return [
        'heading' => $heading,
        'date' => $date,
        'title' => $title,
        'teams' => $teams,
        'goals' => $goals,
    ];
}

$text = file_get_contents($inputPath);
if ($text === false) {
    throw new RuntimeException('No pude leer ' . $inputPath);
}

$blocks = array_values(array_filter(array_map('trim', preg_split('/^\s*---\s*$/mu', $text) ?: [])));
$matches = [];
$year = 2025;
$previousMonth = 0;
foreach ($blocks as $block) {
    $firstLine = strtok($block, "\r\n") ?: '';
    if (preg_match('/^Fecha\s+\d{1,2}\s+de\s+([[:alpha:]]+)/iu', $firstLine, $matchesMonth)) {
        $monthNumber = $months[strtolower(restore_goals_normalize((string) $matchesMonth[1]))] ?? 0;
        if ($previousMonth >= 10 && $monthNumber > 0 && $monthNumber <= 3) {
            $year = 2026;
        }
        $previousMonth = $monthNumber;
    }
    $matches[] = restore_goals_parse_match($block, $year, $months);
}

$pdo = db();
$playersByKey = [];
foreach ($pdo->query('SELECT * FROM players') as $player) {
    $playersByKey[restore_goals_normalize((string) $player['name'])] = $player;
}

$matchStmt = $pdo->prepare("SELECT id FROM matches WHERE notes LIKE :needle LIMIT 1");
$participantStmt = $pdo->prepare('SELECT team_number FROM match_players WHERE match_id = :mid AND player_id = :pid LIMIT 1');

$prepared = [];
$unresolved = [];
$skipped = [];

foreach ($matches as $match) {
    $importKey = 'whatsapp:' . $match['date']->format('Y-m-d') . ':' . md5(json_encode($match['teams'], JSON_UNESCAPED_UNICODE));
    $matchStmt->execute(['needle' => '%' . $importKey . '%']);
    $matchId = (int) ($matchStmt->fetchColumn() ?: 0);
    if ($matchId <= 0) {
        $skipped[] = $match['heading'] . ' no encontrado por import key';
        continue;
    }

    $playerGoals = [];
    $teamGoals = [];
    foreach ($match['goals'] as $goalRow) {
        $rawGoalKey = restore_goals_normalize((string) $goalRow['name']);
        $overrideKey = $match['date']->format('Y-m-d') . '|' . $rawGoalKey;
        $playerKey = $goalOverrides[$overrideKey] ?? restore_goals_player_key((string) $goalRow['name'], $manualAliases);
        if ($playerKey === null || !isset($playersByKey[$playerKey])) {
            $unresolved[] = sprintf('%s: goleador sin resolver "%s" => %s', $match['heading'], (string) $goalRow['name'], (string) $playerKey);
            continue 2;
        }
        $playerId = (int) $playersByKey[$playerKey]['id'];
        $participantStmt->execute(['mid' => $matchId, 'pid' => $playerId]);
        $teamNumber = $participantStmt->fetchColumn();
        if ($teamNumber === false) {
            $unresolved[] = sprintf('%s: goleador "%s" no participa en match #%d', $match['heading'], (string) $goalRow['name'], $matchId);
            continue 2;
        }
        $goals = (int) $goalRow['goals'];
        $playerGoals[$playerId] = ((int) ($playerGoals[$playerId] ?? 0)) + $goals;
        $teamGoals[(int) $teamNumber] = ((int) ($teamGoals[(int) $teamNumber] ?? 0)) + $goals;
    }

    $prepared[] = [
        'match_id' => $matchId,
        'heading' => $match['heading'],
        'date' => $match['date']->format('Y-m-d'),
        'player_goals' => $playerGoals,
        'team_goals' => $teamGoals,
    ];
}

if ($unresolved) {
    echo "DRY-RUN BLOQUEADO\n";
    foreach ($unresolved as $line) {
        echo "- {$line}\n";
    }
    exit(2);
}

echo ($commit ? "RESTORE\n" : "DRY-RUN\n");
echo 'Partidos parseados: ' . count($matches) . PHP_EOL;
echo 'Preparados: ' . count($prepared) . PHP_EOL;
echo 'Saltados: ' . count($skipped) . PHP_EOL;
foreach ($skipped as $line) {
    echo "- {$line}\n";
}
foreach ($prepared as $row) {
    echo sprintf(
        "- #%d %s | jugadores con goles %d | total goles %d\n",
        (int) $row['match_id'],
        (string) $row['heading'],
        count($row['player_goals']),
        array_sum($row['player_goals'])
    );
}

if (!$commit) {
    echo "\nPara restaurar: php scripts/restore_whatsapp_explicit_goals.php --commit\n";
    exit(0);
}

$zeroPlayers = $pdo->prepare("UPDATE match_players mp INNER JOIN matches m ON m.id = mp.match_id SET mp.goals = 0 WHERE m.notes LIKE '%whatsapp:%'");
$zeroTeams = $pdo->prepare("UPDATE match_teams mt INNER JOIN matches m ON m.id = mt.match_id SET mt.goals = 0 WHERE m.notes LIKE '%whatsapp:%'");
$updatePlayer = $pdo->prepare('UPDATE match_players SET goals = :goals WHERE match_id = :mid AND player_id = :pid');
$updateTeam = $pdo->prepare('UPDATE match_teams SET goals = :goals WHERE match_id = :mid AND team_number = :team');

$pdo->beginTransaction();
try {
    $zeroPlayers->execute();
    $zeroTeams->execute();
    foreach ($prepared as $row) {
        foreach ($row['player_goals'] as $playerId => $goals) {
            $updatePlayer->execute(['mid' => (int) $row['match_id'], 'pid' => (int) $playerId, 'goals' => (int) $goals]);
        }
        foreach ($row['team_goals'] as $teamNumber => $goals) {
            $updateTeam->execute(['mid' => (int) $row['match_id'], 'team' => (int) $teamNumber, 'goals' => (int) $goals]);
        }
    }
    $pdo->commit();
    echo "Goles explicitos restaurados.\n";
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
