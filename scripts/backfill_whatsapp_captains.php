<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/db.php';

$commit = in_array('--commit', $argv, true);
$skipUnresolved = in_array('--skip-unresolved', $argv, true);

$aliases = [
    'ANIBAL' => 'ANIBAL',
    'BRAIAN' => 'BRIAN',
    'BRIAN' => 'BRIAN',
    'CESAR' => 'CESAR',
    'CRISTIAN' => 'CRISTIAN',
    'CUERVO' => 'CUERVO',
    'FACU' => 'FACU',
    'FRANCO' => 'FRANCO',
    'GONZA' => 'GONZA',
    'GUILLE' => 'GUILLE',
    'JAVI' => 'JAVI',
    'MANU' => 'MANU',
    'MARCELO' => 'MARCELO',
    'MARIAN' => 'MARIAN',
    'PABLO K' => 'PABLO CASTILLO',
    'PELA' => 'PELA',
    'VICTOR' => 'VICTOR',
];

function backfill_captain_normalize(string $value): string
{
    $value = trim($value, " \t\n\r\0\x0B.");
    $value = mb_strtoupper($value, 'UTF-8');
    $value = strtr($value, [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
    ]);
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    $value = preg_replace('/[^A-Z0-9 ]/u', '', $value) ?? $value;
    return trim($value);
}

function backfill_captain_key(string $raw, array $aliases): string
{
    $key = backfill_captain_normalize($raw);
    return $aliases[$key] ?? $key;
}

$pdo = db();
$playersByKey = [];
foreach ($pdo->query('SELECT * FROM players WHERE active = 1') as $player) {
    $playersByKey[backfill_captain_normalize((string) $player['name'])] = $player;
}

$matches = $pdo->query(
    "SELECT id, title, match_date
     FROM matches
     WHERE status = 'finalizado'
       AND notes LIKE '%whatsapp:%'
       AND title REGEXP '[[:<:]][Vv][Ss][[:>:]]'
     ORDER BY match_date"
)->fetchAll();

$participantTeamStmt = $pdo->prepare('SELECT team_number FROM match_players WHERE match_id = :mid AND player_id = :pid LIMIT 1');
$draftExistsStmt = $pdo->prepare('SELECT match_id FROM captain_drafts WHERE match_id = :mid');

$prepared = [];
$unresolved = [];
$skipped = [];

foreach ($matches as $match) {
    $title = trim((string) $match['title']);
    if (!preg_match('/^(.+?)\s+v(?:s|S)?\.?\s+(.+)$/iu', $title, $parts)) {
        $skipped[] = '#' . (int) $match['id'] . ' titulo no parseable: ' . $title;
        continue;
    }

    $captainKeys = [
        backfill_captain_key((string) $parts[1], $aliases),
        backfill_captain_key((string) $parts[2], $aliases),
    ];
    $captainsByTeam = [];
    $titleCaptains = [];
    foreach ($captainKeys as $index => $key) {
        if (!isset($playersByKey[$key])) {
            $unresolved[] = sprintf('#%d %s: capitan no resuelto "%s" => %s', (int) $match['id'], $title, $index === 0 ? (string) $parts[1] : (string) $parts[2], $key);
            continue 2;
        }
        $titleCaptains[] = $playersByKey[$key];
        $participantTeamStmt->execute(['mid' => (int) $match['id'], 'pid' => (int) $playersByKey[$key]['id']]);
        $actualTeam = $participantTeamStmt->fetchColumn();
        if (!in_array((int) $actualTeam, [1, 2], true)) {
            $unresolved[] = sprintf('#%d %s: %s no esta en equipo 1/2, esta en %s', (int) $match['id'], $title, (string) $playersByKey[$key]['name'], $actualTeam === false ? 'ninguno' : (string) $actualTeam);
            continue 2;
        }
        if (isset($captainsByTeam[(int) $actualTeam])) {
            $unresolved[] = sprintf('#%d %s: ambos capitanes aparecen en el equipo %d', (int) $match['id'], $title, (int) $actualTeam);
            continue 2;
        }
        $captainsByTeam[(int) $actualTeam] = $playersByKey[$key];
    }

    if (!isset($captainsByTeam[1], $captainsByTeam[2])) {
        $unresolved[] = sprintf('#%d %s: no hay un capitan por equipo', (int) $match['id'], $title);
        continue;
    }

    $draftExistsStmt->execute(['mid' => (int) $match['id']]);
    if ($draftExistsStmt->fetchColumn()) {
        $skipped[] = '#' . (int) $match['id'] . ' ya tenia captain_draft';
        continue;
    }

    $prepared[] = [
        'match' => $match,
        'captain1' => $captainsByTeam[1],
        'captain2' => $captainsByTeam[2],
        'title_order' => $titleCaptains,
    ];
}

if ($unresolved && !$skipUnresolved) {
    echo "DRY-RUN BLOQUEADO: capitanes sin resolver o desalineados.\n";
    foreach ($unresolved as $line) {
        echo "- {$line}\n";
    }
    echo "\nPara cargar los validos y saltar estos casos: php scripts/backfill_whatsapp_captains.php --commit --skip-unresolved\n";
    exit(2);
}

echo ($commit ? "IMPORT\n" : "DRY-RUN\n");
echo 'Preparados: ' . count($prepared) . PHP_EOL;
echo 'Saltados: ' . count($skipped) . PHP_EOL;
if ($unresolved) {
    echo 'No resueltos/saltados: ' . count($unresolved) . PHP_EOL;
    foreach ($unresolved as $line) {
        echo "- {$line}\n";
    }
}
foreach ($skipped as $line) {
    echo "- {$line}\n";
}
foreach ($prepared as $row) {
    echo sprintf(
        "- #%d %s | %s vs %s\n",
        (int) $row['match']['id'],
        (string) $row['match']['title'],
        (string) $row['captain1']['name'],
        (string) $row['captain2']['name']
            . (((int) $row['title_order'][0]['id'] !== (int) $row['captain1']['id']) ? ' (orden del titulo invertido)' : '')
    );
}

if (!$commit) {
    echo "\nPara insertar: php scripts/backfill_whatsapp_captains.php --commit\n";
    exit(0);
}

$insertDraft = $pdo->prepare(
    "INSERT INTO captain_drafts
        (match_id, captain1_player_id, captain2_player_id, captain1_token, captain2_token, current_team, status, started_at, completed_at)
     VALUES
        (:match_id, :captain1_player_id, :captain2_player_id, :captain1_token, :captain2_token, NULL, 'completed', :started_at, :completed_at)"
);
$updateTeam = $pdo->prepare(
    'UPDATE match_teams SET captain_player_id = :captain_player_id WHERE match_id = :match_id AND team_number = :team_number'
);

$pdo->beginTransaction();
try {
    foreach ($prepared as $row) {
        $matchId = (int) $row['match']['id'];
        $tokenSeed = 'whatsapp-captains-' . $matchId . '-';
        $insertDraft->execute([
            'match_id' => $matchId,
            'captain1_player_id' => (int) $row['captain1']['id'],
            'captain2_player_id' => (int) $row['captain2']['id'],
            'captain1_token' => hash('sha256', $tokenSeed . '1'),
            'captain2_token' => hash('sha256', $tokenSeed . '2'),
            'started_at' => (string) $row['match']['match_date'],
            'completed_at' => (string) $row['match']['match_date'],
        ]);
        $updateTeam->execute([
            'match_id' => $matchId,
            'team_number' => 1,
            'captain_player_id' => (int) $row['captain1']['id'],
        ]);
        $updateTeam->execute([
            'match_id' => $matchId,
            'team_number' => 2,
            'captain_player_id' => (int) $row['captain2']['id'],
        ]);
        echo sprintf("Actualizado #%d: %s vs %s\n", $matchId, (string) $row['captain1']['name'], (string) $row['captain2']['name']);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
