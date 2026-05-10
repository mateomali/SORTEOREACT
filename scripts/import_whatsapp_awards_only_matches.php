<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/awards.php';

$commit = in_array('--commit', $argv, true);
$includeAmbiguous = in_array('--include-ambiguous', $argv, true);
$onlyArg = null;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--only=')) {
        $onlyArg = substr($arg, 7);
    }
}
$onlyDates = $onlyArg !== null && $onlyArg !== ''
    ? array_flip(array_map('trim', explode(',', $onlyArg)))
    : [];

$manualAliases = [
    'ALEJO' => 'ALEJO',
    'ALEXIS' => 'ALEXIS',
    'ANIBAL' => 'ANIBAL',
    'BRAIAN' => 'BRIAN',
    'BRIAN' => 'BRIAN',
    'CAMILO' => 'CAMILO',
    'CESAR' => 'CESAR',
    'CRISTIAN' => 'CRISTIAN',
    'CUERVO' => 'CUERVO',
    'EL CUERVO' => 'CUERVO',
    'ELIAN' => 'ELIAN',
    'FACU' => 'FACU',
    'FRAN COMOLLI' => 'FRANCO COMOLLI',
    'FRANCO COMOLLI' => 'FRANCO COMOLLI',
    'FRANCO K' => 'FRANCOK',
    'FRANCOK' => 'FRANCOK',
    'FRANCISCO' => 'FRANCISCO',
    'GONZA' => 'GONZA',
    'GUILLE' => 'GUILLE',
    'ISMA' => 'ISMA',
    'JEAN FRANCO' => 'JEAN FRANCO',
    'KINGO' => 'VIKINGO',
    'LUCAS' => 'VIKINGO',
    'LUKAS' => 'VIKINGO',
    'MANU' => 'MANU',
    'MARCELO' => 'MARCELO',
    'MARIAN' => 'MARIAN',
    'MATI' => 'MATI',
    'MATI ROSALES' => 'MATI ROSALES',
    'MAURI' => 'MAURI',
    'NICO' => 'NICO',
    'OCTAVIO' => 'OCTAVIO',
    'PABLO' => 'PABLO',
    'PABLO CASTILLO' => 'PABLO CASTILLO',
    'PELA' => 'PELA',
    'PULY' => 'PULY',
    'RODRI' => 'RODRI SUAREZ',
    'RODRI CHAVEZ' => 'RODRI CHAVEZ',
    'RODRI SUAREZ' => 'RODRI SUAREZ',
    'TEBO' => 'TEBO',
    'TIMO' => 'TIMO',
];

$awardCodes = [
    'mvp' => 'player_of_match',
    'gol' => 'goal_of_week',
    'lirico' => 'lyrical',
    'muro' => 'wall',
    'terminator' => 'terminator',
    'tractor' => 'tractor',
    'goodfellas' => 'goodfellas',
    'pase' => 'guinda',
];

$candidateMatches = [
    [
        'date' => '2026-01-14',
        'title' => 'Premios miercoles 14',
        'notes' => 'Premios detectados en mensaje del 21/01/2026. Sin equipos en el chat filtrado.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Gonza',
            'gol' => 'Marcelo',
            'lirico' => 'Marcelo',
            'muro' => 'Timo',
            'tractor' => 'Isma',
            'goodfellas' => 'Francisco',
        ],
    ],
    [
        'date' => '2026-01-28',
        'title' => 'Premios miercoles 28',
        'notes' => 'Sin equipos en el chat filtrado.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Lucas',
            'gol' => 'Marcelo',
            'lirico' => 'Isma',
            'muro' => 'Timo',
            'terminator' => 'Timo',
            'tractor' => 'Jean Franco',
            'goodfellas' => 'Jean Franco',
        ],
    ],
    [
        'date' => '2026-02-20',
        'title' => 'Premios miercoles 20 febrero',
        'notes' => 'Fecha ya deberia existir con puntajes; se salta si ya esta cargada.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Braian',
            'gol' => 'Isma',
            'lirico' => 'Marcelo',
            'muro' => 'Francisco',
            'tractor' => 'Octavio',
            'goodfellas' => 'Puly',
        ],
    ],
    [
        'date' => '2026-02-27',
        'title' => 'Premios miercoles 27 febrero',
        'notes' => 'Fecha ya deberia existir con puntajes; se salta si ya esta cargada.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Braian',
            'gol' => 'Kingo',
            'lirico' => 'Marcelo',
            'muro' => 'Octavio',
            'terminator' => 'Alejo',
            'tractor' => 'Isma',
            'goodfellas' => 'Francisco',
        ],
    ],
    [
        'date' => '2026-03-04',
        'title' => 'Premios miercoles 4 de Marzo',
        'notes' => 'Sin equipos en el chat filtrado.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Octavio',
            'gol' => 'Guille',
            'lirico' => 'Braian',
            'muro' => 'Octavio',
            'terminator' => 'Facu',
            'tractor' => 'Facu',
            'goodfellas' => 'Franco K',
        ],
    ],
    [
        'date' => '2026-03-27',
        'title' => 'Premios viernes 27 de Marzo',
        'notes' => 'Sin equipos en el chat filtrado.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Mati Rosales',
            'gol' => 'Pablo Castillo',
            'lirico' => 'Mati Rosales',
            'muro' => 'Rodri Suarez',
            'terminator' => 'Mati Rosales',
            'tractor' => 'Pela',
            'goodfellas' => 'Marcelo',
        ],
    ],
    [
        'date' => '2026-04-03',
        'title' => 'Copa Heroes de Malvinas',
        'notes' => 'Equipos tomados del ultimo mensaje Viernes 22 hs techada Kikers; premios del 04/04/2026.',
        'teams' => [
            ['label' => 'Equipo naranja', 'players' => ['Braian', 'Cuervo', 'Pablo Castillo', 'Anibal', 'Guille', 'Cristian']],
            ['label' => 'Descamisados', 'players' => ['Fran Comolli', 'Pela', 'Cesar', 'Marcelo', 'Rodri', 'Francisco']],
        ],
        'awards' => [
            'mvp' => 'Fran Comolli',
            'gol' => 'Cuervo',
            'lirico' => 'Anibal',
            'muro' => 'Rodri Suarez',
            'terminator' => 'Cesar',
            'tractor' => 'Francisco',
            'pase' => 'Marcelo',
            'goodfellas' => 'Pela',
        ],
    ],
    [
        'date' => '2026-04-10',
        'title' => 'Copa Bernardo Houssay',
        'notes' => 'Premios sin equipos en el chat filtrado.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Fran Comolli',
            'gol' => 'Fran Comolli',
            'lirico' => 'Mati Rosales',
            'muro' => 'Cesar',
            'terminator' => 'Cesar',
            'tractor' => 'Facu',
            'pase' => 'Cesar',
            'goodfellas' => 'Rodri Chavez',
        ],
    ],
    [
        'date' => '2026-04-17',
        'title' => 'Copa hemofilia',
        'notes' => 'Premios sin equipos en el chat filtrado.',
        'teams' => [],
        'awards' => [
            'mvp' => 'Rodri Suarez',
            'gol' => 'Cristian',
            'lirico' => 'Marcelo',
            'muro' => 'Cesar',
            'tractor' => 'Facu',
            'pase' => 'Pablo Castillo',
            'goodfellas' => 'Pela',
        ],
    ],
    [
        'date' => '2026-04-24',
        'title' => 'Copa Genocidio Armenio',
        'notes' => 'AMBIGUA: el mensaje fue enviado el 25/04/2026 pero dice "viernes 10 de abril".',
        'ambiguous' => true,
        'teams' => [],
        'awards' => [
            'mvp' => 'Braian',
            'gol' => 'Marcelo',
            'lirico' => 'Braian',
            'muro' => 'Anibal',
            'tractor' => 'Alexis',
            'pase' => 'Braian',
            'goodfellas' => 'Pablo Castillo',
        ],
    ],
    [
        'date' => '2026-05-01',
        'title' => 'Copa Martires de Chicago',
        'notes' => 'Equipos y goles tomados del ultimo mensaje del 01/05/2026; premios del 02/05/2026.',
        'teams' => [
            ['label' => 'Descamisados FC', 'players' => ['Camilo', 'Alexis', 'Cesar', 'Pela', 'Marcelo', 'Rodri Suarez']],
            ['label' => 'Equipo naranja', 'players' => ['Braian', 'Mati', 'Pablo Castillo', 'Nico', 'Guille', 'Elian']],
        ],
        'awards' => [
            'mvp' => 'Camilo',
            'gol' => 'Marcelo',
            'lirico' => 'Marcelo',
            'muro' => 'Cesar',
            'terminator' => 'Rodri Suarez',
            'tractor' => 'Alexis',
            'pase' => 'Cesar',
            'goodfellas' => 'Pablo Castillo',
        ],
    ],
];

function awards_only_normalize(string $value): string
{
    $value = trim($value);
    $value = str_replace(["\xC2\xA0", "\t"], ' ', $value);
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    $value = mb_strtoupper($value, 'UTF-8');
    $value = strtr($value, [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N',
        'Ã' => 'A', 'Ã‰' => 'E', 'Ã' => 'I', 'Ã“' => 'O', 'Ãš' => 'U', 'Ãœ' => 'U', 'Ã‘' => 'N',
    ]);
    $value = preg_replace('/[^A-Z0-9 ]/u', '', $value) ?? $value;
    return trim($value);
}

function awards_only_player_key(string $rawName, array $aliases): ?string
{
    $key = awards_only_normalize($rawName);
    if ($key === '' || $key === 'VACANTE') {
        return null;
    }
    return $aliases[$key] ?? $key;
}

function awards_only_court_weekday(DateTimeImmutable $date): int
{
    $weekday = (int) $date->format('N');
    return $weekday === 3 ? 5 : $weekday;
}

function awards_only_default_position(array $player): string
{
    $positions = explode('/', (string) ($player['positions'] ?? 'MED'));
    $position = strtoupper(trim((string) ($positions[0] ?? 'MED')));
    return in_array($position, ['ARQ', 'DEF', 'MED', 'DEL'], true) ? $position : 'MED';
}

function awards_only_color_name(string $label, int $teamNumber): string
{
    $normalized = awards_only_normalize($label);
    if (str_contains($normalized, 'NARANJA')) {
        return 'NARANJA';
    }
    if (str_contains($normalized, 'DESCAMISADOS')) {
        return 'BLANCO';
    }
    return $teamNumber === 1 ? 'ROSA' : 'AZUL';
}

$pdo = db();
$players = $pdo->query('SELECT * FROM players ORDER BY name ASC')->fetchAll();
$playersByKey = [];
foreach ($players as $player) {
    $playersByKey[awards_only_normalize((string) $player['name'])] = $player;
}

$courtStmt = $pdo->prepare('SELECT * FROM rental_courts WHERE active = 1 AND weekday = :weekday ORDER BY id ASC LIMIT 1');
$existingDateStmt = $pdo->prepare('SELECT id, title FROM matches WHERE DATE(match_date) = :match_date ORDER BY id ASC LIMIT 1');
$existingImportStmt = $pdo->prepare("SELECT id FROM matches WHERE notes LIKE :notes LIMIT 1");

$prepared = [];
$skipped = [];
$unresolved = [];

foreach ($candidateMatches as $candidate) {
    if ($onlyDates !== [] && !isset($onlyDates[(string) $candidate['date']])) {
        continue;
    }
    if (!empty($candidate['ambiguous']) && !$includeAmbiguous) {
        $skipped[] = (string) $candidate['date'] . ' ' . (string) $candidate['title'] . ' saltado: requiere --include-ambiguous';
        continue;
    }

    $date = new DateTimeImmutable((string) $candidate['date']);
    $courtStmt->execute(['weekday' => awards_only_court_weekday($date)]);
    $court = $courtStmt->fetch();
    if (!$court) {
        $unresolved[] = (string) $candidate['date'] . ': no hay cancha para weekday ' . awards_only_court_weekday($date);
        continue;
    }

    $importKey = 'whatsapp-awards-only:' . (string) $candidate['date'] . ':' . md5(json_encode($candidate, JSON_UNESCAPED_UNICODE));
    $existingImportStmt->execute(['notes' => '%' . $importKey . '%']);
    if ($existingImportStmt->fetchColumn()) {
        $skipped[] = (string) $candidate['date'] . ' ya importado';
        continue;
    }

    $existingDateStmt->execute(['match_date' => (string) $candidate['date']]);
    $existingOnDate = $existingDateStmt->fetch();
    if ($existingOnDate) {
        $skipped[] = sprintf('%s saltado: ya existe match #%d (%s)', (string) $candidate['date'], (int) $existingOnDate['id'], (string) $existingOnDate['title']);
        continue;
    }

    $resolvedTeams = [];
    $resolvedPlayerIds = [];
    foreach ($candidate['teams'] as $teamIndex => $team) {
        $teamNumber = $teamIndex + 1;
        $resolvedPlayers = [];
        foreach ($team['players'] as $rawPlayerName) {
            $playerKey = awards_only_player_key((string) $rawPlayerName, $manualAliases);
            if ($playerKey === null || !isset($playersByKey[$playerKey])) {
                $unresolved[] = sprintf('%s: jugador de equipo sin resolver "%s" => %s', (string) $candidate['date'], (string) $rawPlayerName, (string) $playerKey);
                continue;
            }
            $player = $playersByKey[$playerKey];
            $resolvedPlayerIds[(int) $player['id']] = true;
            $resolvedPlayers[] = ['raw_name' => (string) $rawPlayerName, 'player' => $player];
        }
        $resolvedTeams[$teamNumber] = [
            'label' => (string) $team['label'],
            'players' => $resolvedPlayers,
        ];
    }

    $resolvedAwards = [];
    foreach ($candidate['awards'] as $awardLabel => $rawPlayerName) {
        if (!isset($awardCodes[$awardLabel])) {
            $unresolved[] = sprintf('%s: premio desconocido "%s"', (string) $candidate['date'], (string) $awardLabel);
            continue;
        }
        $playerKey = awards_only_player_key((string) $rawPlayerName, $manualAliases);
        if ($playerKey === null) {
            continue;
        }
        if (!isset($playersByKey[$playerKey])) {
            $unresolved[] = sprintf('%s: premio sin jugador resuelto "%s" => %s', (string) $candidate['date'], (string) $rawPlayerName, $playerKey);
            continue;
        }
        $resolvedAwards[$awardCodes[$awardLabel]] = $playersByKey[$playerKey];
    }

    $prepared[] = [
        'candidate' => $candidate,
        'date' => $date,
        'match_date' => $date->format('Y-m-d') . ' ' . (string) $court['time_value'],
        'court' => $court,
        'import_key' => $importKey,
        'teams' => $resolvedTeams,
        'awards' => $resolvedAwards,
        'participant_ids' => $resolvedPlayerIds,
    ];
}

if ($unresolved) {
    echo "DRY-RUN BLOQUEADO: hay datos sin resolver.\n";
    foreach (array_values(array_unique($unresolved)) as $line) {
        echo "- {$line}\n";
    }
    exit(2);
}

echo ($commit ? "IMPORT\n" : "DRY-RUN\n");
echo 'Preparados: ' . count($prepared) . PHP_EOL;
echo 'Saltados: ' . count($skipped) . PHP_EOL;
foreach ($skipped as $line) {
    echo "- {$line}\n";
}
foreach ($prepared as $row) {
    $teamCounts = array_map(static fn(array $team): int => count($team['players']), $row['teams']);
    echo sprintf(
        "- %s | %s | %s | equipos %s | premios %d%s\n",
        (string) $row['candidate']['date'],
        (string) $row['candidate']['title'],
        (string) $row['court']['court_key'],
        $teamCounts ? implode('/', $teamCounts) : 'sin equipos',
        count($row['awards']),
        !empty($row['candidate']['ambiguous']) ? ' | AMBIGUA' : ''
    );
}

if (!$commit) {
    echo "\nPara insertar: php scripts/import_whatsapp_awards_only_matches.php --commit\n";
    echo "Para incluir la fecha ambigua del 24/04: agregar --include-ambiguous\n";
    exit(0);
}

$insertMatch = $pdo->prepare(
    "INSERT INTO matches (title, rental_court_id, match_date, num_teams, players_per_team, max_diff, allow_redraw, redraw_limit, status, draw_mode, draw_started_at, draw_completed_at, finalized_at, notes, result_notes)
     VALUES (:title, :rental_court_id, :match_date, 2, :players_per_team, 0.0, 0, 0, 'finalizado', 'manual', :draw_started_at, :draw_completed_at, NOW(), :notes, :result_notes)"
);
$insertTeam = $pdo->prepare(
    "INSERT INTO match_teams (match_id, team_number, team_name, total_skill, formation_name, formation_data, color_name, goals)
     VALUES (:match_id, :team_number, :team_name, :total_skill, :formation_name, :formation_data, :color_name, :goals)"
);
$insertPlayer = $pdo->prepare(
    "INSERT INTO match_players (match_id, player_id, team_number, assigned_position, is_goalkeeper, lineup_order, formation_line_order, availability_status, goals, rating)
     VALUES (:match_id, :player_id, :team_number, :assigned_position, :is_goalkeeper, :lineup_order, :formation_line_order, 'confirmado', :goals, NULL)"
);
$insertAward = $pdo->prepare(
    "INSERT INTO match_awards (match_id, award_code, player_id)
     VALUES (:match_id, :award_code, :player_id)"
);

$pdo->beginTransaction();
try {
    foreach ($prepared as $row) {
        $playersPerTeam = $row['teams'] ? max(array_map(static fn(array $team): int => count($team['players']), $row['teams'])) : 1;
        $insertMatch->execute([
            'title' => (string) $row['candidate']['title'],
            'rental_court_id' => (int) $row['court']['id'],
            'match_date' => (string) $row['match_date'],
            'draw_started_at' => (string) $row['match_date'],
            'draw_completed_at' => (string) $row['match_date'],
            'players_per_team' => $playersPerTeam,
            'notes' => "Importado desde WhatsApp sin puntajes\n" . (string) $row['candidate']['notes'] . "\n" . (string) $row['import_key'],
            'result_notes' => 'Premios sin puntajes importados desde WhatsApp',
        ]);
        $matchId = (int) $pdo->lastInsertId();

        foreach ($row['teams'] as $teamNumber => $team) {
            $lineOrders = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
            $totalSkill = 0.0;
            $formationData = [];
            foreach ($team['players'] as $lineupIndex => $entry) {
                $player = $entry['player'];
                $position = awards_only_default_position($player);
                $lineOrders[$position]++;
                $totalSkill += player_overall_rating($player);
                $formationData[] = ['id' => (int) $player['id'], 'position' => $position];
                $insertPlayer->execute([
                    'match_id' => $matchId,
                    'player_id' => (int) $player['id'],
                    'team_number' => (int) $teamNumber,
                    'assigned_position' => $position,
                    'is_goalkeeper' => $position === 'ARQ' ? 1 : 0,
                    'lineup_order' => $lineupIndex + 1,
                    'formation_line_order' => $lineOrders[$position],
                    'goals' => 0,
                ]);
            }
            $counts = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
            foreach ($formationData as $formationPlayer) {
                $counts[(string) $formationPlayer['position']]++;
            }
            $insertTeam->execute([
                'match_id' => $matchId,
                'team_number' => (int) $teamNumber,
                'team_name' => (string) $team['label'],
                'total_skill' => $totalSkill,
                'formation_name' => implode('-', [$counts['ARQ'], $counts['DEF'], $counts['MED'], $counts['DEL']]),
                'formation_data' => json_encode($formationData, JSON_UNESCAPED_UNICODE),
                'color_name' => awards_only_color_name((string) $team['label'], (int) $teamNumber),
                'goals' => 0,
            ]);
        }

        foreach ($row['awards'] as $awardCode => $player) {
            $insertAward->execute([
                'match_id' => $matchId,
                'award_code' => (string) $awardCode,
                'player_id' => (int) $player['id'],
            ]);
        }
        echo sprintf("Importado match #%d: %s %s\n", $matchId, (string) $row['candidate']['date'], (string) $row['candidate']['title']);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
