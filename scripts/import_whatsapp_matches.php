<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/helpers.php';
require_once __DIR__ . '/../lib/awards.php';

$inputPath = 'C:\\Users\\Usuario\\Downloads\\Chat de WhatsApp con GOODFELLAS\\Chat de WhatsApp con GOODFELLAS - solo resumenes de partidos.txt';
$commit = in_array('--commit', $argv, true);
$createMissing = in_array('--create-missing', $argv, true);

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

$awardAliases = [
    'MAN OF THE MATCH' => 'player_of_match',
    'GOL DE LA FECHA' => 'goal_of_week',
    'LIRICO' => 'lyrical',
    'LIRICO' => 'lyrical',
    'EL MURO' => 'wall',
    'CAPOCANNONIERE' => 'capocannoniere',
    'TERMINATOR' => 'terminator',
    'EL TRACTOR' => 'tractor',
    'TRACTOR' => 'tractor',
    'LA GUINDA' => 'guinda',
    'PORTERO IMBATIBLE' => 'keeper',
    'GOLERO IMBATIBLE' => 'keeper',
    'GOODFELLAS' => 'goodfellas',
    'LA PUTITA' => 'putita',
    'EL FANTASMA' => 'ghost',
];

function import_normalize(string $value): string
{
    $value = trim($value);
    $value = str_replace(["\xC2\xA0", "\t"], ' ', $value);
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    $value = mb_strtoupper($value, 'UTF-8');
    $value = strtr($value, [
        'Á' => 'A',
        'É' => 'E',
        'Í' => 'I',
        'Ó' => 'O',
        'Ú' => 'U',
        'Ü' => 'U',
        'Ñ' => 'N',
    ]);
    $value = preg_replace('/[^A-Z0-9 ]/u', '', $value) ?? $value;
    return trim($value);
}

function import_parse_date(string $heading, int $year): DateTimeImmutable
{
    global $months;
    if (!preg_match('/^Fecha\s+(\d{1,2})\s+de\s+([[:alpha:]]+)/iu', trim($heading), $matches)) {
        throw new RuntimeException('No pude leer el membrete: ' . $heading);
    }
    $monthKey = import_normalize((string) $matches[2]);
    $monthKey = strtolower(strtr($monthKey, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u']));
    if (!isset($months[$monthKey])) {
        throw new RuntimeException('Mes desconocido en: ' . $heading);
    }
    return new DateTimeImmutable(sprintf('%04d-%02d-%02d', $year, $months[$monthKey], (int) $matches[1]));
}

function import_player_key(string $rawName, array $playersByKey, array $manualAliases): ?string
{
    $key = import_normalize($rawName);
    if (preg_match('/^(.+)\s+(\d)\s+(\d)$/', $key, $matches)) {
        $key = trim((string) $matches[1]);
    }
    if ($key === '' || $key === 'VACANTE' || str_starts_with($key, 'TODOS LOS ')) {
        return null;
    }
    if (isset($manualAliases[$key])) {
        return $manualAliases[$key];
    }
    if (isset($playersByKey[$key])) {
        return $key;
    }
    return $key;
}

function import_award_key(string $line, array $awardAliases): ?string
{
    $key = import_normalize($line);
    foreach ($awardAliases as $label => $code) {
        if (str_contains($key, $label)) {
            return $code;
        }
    }
    return null;
}

function import_parse_blocks(string $text): array
{
    return array_values(array_filter(array_map('trim', preg_split('/\R\R---\R\R/u', $text) ?: [])));
}

function import_parse_match(string $block, int $year): array
{
    $lines = preg_split('/\R/u', $block) ?: [];
    $lines = array_map(static fn(string $line): string => trim($line), $lines);
    $heading = array_shift($lines) ?? '';
    $date = import_parse_date($heading, $year);

    $title = '';
    if (isset($lines[0]) && $lines[0] !== '' && !str_starts_with(import_normalize($lines[0]), 'EQUIPO')) {
        $title = array_shift($lines);
    }
    if ($title === '') {
        $title = $heading;
    }

    $teams = [];
    $awards = [];
    $goals = [];
    $section = 'teams';
    $currentTeam = null;
    $pendingAward = null;
    $readGoals = false;

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
            $section = 'teams';
            $pendingAward = null;
            $readGoals = false;
            continue;
        }

        if (preg_match('/^Goles:?$/iu', $line)) {
            $readGoals = true;
            $section = 'goals';
            $pendingAward = null;
            continue;
        }

        $awardCode = import_award_key($line, $GLOBALS['awardAliases']);
        if ($awardCode !== null) {
            $pendingAward = $awardCode;
            $section = 'awards';
            $readGoals = false;
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

        if ($pendingAward !== null) {
            $awards[$pendingAward] = $line;
            $pendingAward = null;
            continue;
        }

        if ($section === 'teams' && $currentTeam !== null && preg_match('/^(.+?)\s+(\d+)\s+(\d)$/u', $line, $splitDecimalMatches)) {
            $teams[$currentTeam]['players'][] = [
                'name' => trim((string) $splitDecimalMatches[1]),
                'rating' => (float) ((string) $splitDecimalMatches[2] . '.' . (string) $splitDecimalMatches[3]),
            ];
            continue;
        }

        if ($section === 'teams' && $currentTeam !== null && preg_match('/^([[:alpha:]ÁÉÍÓÚÜÑáéíóúüñ ]{3,})(\d+(?:[,.]\d+)?)$/u', $line, $stuckRatingMatches)) {
            $teams[$currentTeam]['players'][] = [
                'name' => trim((string) $stuckRatingMatches[1]),
                'rating' => (float) str_replace(',', '.', (string) $stuckRatingMatches[2]),
            ];
            continue;
        }

        if ($section === 'teams' && $currentTeam !== null && preg_match('/^(.+?)\s+(\d+(?:[,.]\d+)?)$/u', $line, $matches)) {
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
        'awards' => $awards,
        'goals' => $goals,
    ];
}

function import_color_name(string $label, int $teamNumber): string
{
    $normalized = import_normalize($label);
    if (str_contains($label, '🩷') || str_contains($label, '💖') || str_contains($normalized, 'ROSA')) {
        return 'ROSA';
    }
    if (str_contains($label, '💙') || str_contains($normalized, 'AZUL')) {
        return 'AZUL';
    }
    if (str_contains($label, '🧡') || str_contains($normalized, 'NARANJA')) {
        return 'NARANJA';
    }
    return $teamNumber === 1 ? 'ROSA' : 'AZUL';
}

function import_display_name_from_key(string $key): string
{
    $special = [
        'FRANCOK' => 'FRANCOK',
    ];
    if (isset($special[$key])) {
        return $special[$key];
    }
    return mb_convert_case($key, MB_CASE_TITLE, 'UTF-8');
}

function import_create_player(PDO $pdo, string $playerKey): array
{
    $name = import_display_name_from_key($playerKey);
    $stmt = $pdo->prepare(
        "INSERT INTO players (name, positions, pace, skill, teamwork, mentality, active)
         VALUES (:name, 'MED', 'rapido', 3.0, 3.0, 3.0, 1)"
    );
    $stmt->execute(['name' => $name]);
    $select = $pdo->prepare('SELECT * FROM players WHERE id = :id');
    $select->execute(['id' => (int) $pdo->lastInsertId()]);
    $player = $select->fetch();
    if (!$player) {
        throw new RuntimeException('No pude crear el jugador ' . $name);
    }
    return $player;
}

function import_virtual_player(string $playerKey): array
{
    return [
        'id' => -abs(crc32($playerKey)),
        'name' => import_display_name_from_key($playerKey),
        'positions' => 'MED',
        'pace' => 'rapido',
        'skill' => 3.0,
        'technique' => null,
        'rhythm' => null,
        'defense_physical' => null,
        'attack' => null,
        'teamwork' => 3.0,
        'mentality' => 3.0,
        'regularity' => null,
        'goalkeeper_skill' => null,
        'active' => 1,
    ];
}

function import_default_position(array $player): string
{
    $positions = explode('/', (string) ($player['positions'] ?? 'MED'));
    $position = strtoupper(trim((string) ($positions[0] ?? 'MED')));
    return in_array($position, ['ARQ', 'DEF', 'MED', 'DEL'], true) ? $position : 'MED';
}

$pdo = db();
$players = $pdo->query('SELECT * FROM players ORDER BY name ASC')->fetchAll();
$playersByKey = [];
foreach ($players as $player) {
    $playersByKey[import_normalize((string) $player['name'])] = $player;
}
$createdPlayerKeys = [];

$text = file_get_contents($inputPath);
if ($text === false) {
    throw new RuntimeException('No pude leer ' . $inputPath);
}

$blocks = import_parse_blocks($text);
$matches = [];
$year = 2025;
$previousMonth = 0;
foreach ($blocks as $block) {
    $firstLine = strtok($block, "\r\n") ?: '';
    if (preg_match('/^Fecha\s+\d{1,2}\s+de\s+([[:alpha:]]+)/iu', $firstLine, $matchesMonth)) {
        $monthKey = strtolower(import_normalize((string) $matchesMonth[1]));
        $monthNumber = $months[$monthKey] ?? 0;
        if ($previousMonth >= 10 && $monthNumber > 0 && $monthNumber <= 3) {
            $year = 2026;
        }
        $previousMonth = $monthNumber;
    }
    $matches[] = import_parse_match($block, $year);
}

$unresolved = [];
$warnings = [];
$duplicates = [];
$prepared = [];
$seenImportKeys = [];

$courtStmt = $pdo->prepare('SELECT * FROM rental_courts WHERE active = 1 AND weekday = :weekday ORDER BY id ASC LIMIT 1');
$existingStmt = $pdo->prepare("SELECT id FROM matches WHERE match_date = :match_date AND notes LIKE :notes LIMIT 1");

foreach ($matches as $index => $match) {
    $date = $match['date'];
    $weekday = (int) $date->format('N');
    $courtStmt->execute(['weekday' => $weekday]);
    $court = $courtStmt->fetch();
    if (!$court) {
        $unresolved[] = sprintf('%s: no hay cancha activa para weekday %d', $match['heading'], $weekday);
        continue;
    }
    $matchDate = $date->format('Y-m-d') . ' ' . (string) $court['time_value'];
    $importKey = 'whatsapp:' . $date->format('Y-m-d') . ':' . md5(json_encode($match['teams'], JSON_UNESCAPED_UNICODE));
    if (isset($seenImportKeys[$importKey])) {
        $duplicates[] = $match['heading'] . ' duplicado dentro del TXT';
        continue;
    }
    $seenImportKeys[$importKey] = true;

    $existingStmt->execute(['match_date' => $matchDate, 'notes' => '%' . $importKey . '%']);
    if ($existingStmt->fetchColumn()) {
        $duplicates[] = $match['heading'] . ' ya importado';
        continue;
    }

    $resolvedTeams = [];
    $allowedPlayerKeys = [];
    foreach ($match['teams'] as $teamNumber => $team) {
        $resolvedPlayers = [];
        foreach ($team['players'] as $linePlayer) {
            $playerKey = import_player_key((string) $linePlayer['name'], $playersByKey, $manualAliases);
            if ($playerKey === null) {
                $unresolved[] = sprintf('%s: jugador "%s"', $match['heading'], $linePlayer['name']);
                continue;
            }
            if (!isset($playersByKey[$playerKey])) {
                if (!$createMissing) {
                    $unresolved[] = sprintf('%s: jugador nuevo "%s" => %s', $match['heading'], $linePlayer['name'], $playerKey);
                    continue;
                }
                $playersByKey[$playerKey] = $commit
                    ? import_create_player($pdo, $playerKey)
                    : import_virtual_player($playerKey);
                $createdPlayerKeys[$playerKey] = true;
            }
            $allowedPlayerKeys[$playerKey] = true;
            $resolvedPlayers[] = [
                'raw_name' => $linePlayer['name'],
                'rating' => $linePlayer['rating'],
                'player' => $playersByKey[$playerKey],
            ];
        }
        $resolvedTeams[(int) $teamNumber] = $team + ['resolved_players' => $resolvedPlayers];
    }

    $resolvedAwards = [];
    foreach ($match['awards'] as $awardCode => $rawWinner) {
        $playerKey = import_player_key((string) $rawWinner, $playersByKey, $manualAliases);
        if ($playerKey === null) {
            continue;
        }
        if (!isset($playersByKey[$playerKey]) || !isset($allowedPlayerKeys[$playerKey])) {
            // El resumen a veces premia a nombres escritos distinto o a menciones multiples.
            // No bloqueamos el partido completo por un premio dudoso.
            continue;
        }
        $resolvedAwards[$awardCode] = $playersByKey[$playerKey];
    }

    $resolvedGoals = [];
    foreach ($match['goals'] as $goalRow) {
        $playerKey = import_player_key((string) $goalRow['name'], $playersByKey, $manualAliases);
        if ($playerKey === null || !isset($playersByKey[$playerKey]) || !isset($allowedPlayerKeys[$playerKey])) {
            $warnings[] = sprintf('%s: goleador omitido "%s"', $match['heading'], $goalRow['name']);
            continue;
        }
        $resolvedGoals[(int) $playersByKey[$playerKey]['id']] = ((int) ($resolvedGoals[(int) $playersByKey[$playerKey]['id']] ?? 0)) + (int) $goalRow['goals'];
    }

    $prepared[] = [
        'import_key' => $importKey,
        'match_date' => $matchDate,
        'court' => $court,
        'match' => $match,
        'teams' => $resolvedTeams,
        'awards' => $resolvedAwards,
        'goals' => $resolvedGoals,
    ];
}

$unresolved = array_values(array_unique($unresolved));
if ($unresolved) {
    echo "DRY-RUN BLOQUEADO: hay nombres o datos sin resolver.\n\n";
    foreach ($unresolved as $line) {
        echo "- {$line}\n";
    }
    echo "\nNo se inserto nada. Ajusta aliases en este script o en jugadores y volve a correr.\n";
    exit(2);
}

echo ($commit ? "IMPORT\n" : "DRY-RUN\n");
echo 'Partidos parseados: ' . count($matches) . "\n";
echo 'Preparados: ' . count($prepared) . "\n";
echo 'Duplicados/saltados: ' . count($duplicates) . "\n";
echo 'Jugadores nuevos a crear: ' . count($createdPlayerKeys) . "\n";
foreach (array_keys($createdPlayerKeys) as $playerKey) {
    echo "- nuevo jugador: " . import_display_name_from_key($playerKey) . " ({$playerKey})\n";
}
foreach ($duplicates as $duplicate) {
    echo "- {$duplicate}\n";
}
if ($warnings) {
    echo 'Advertencias: ' . count($warnings) . "\n";
    foreach (array_values(array_unique($warnings)) as $warning) {
        echo "- {$warning}\n";
    }
}

if (!$commit) {
    foreach ($prepared as $row) {
        $counts = array_map(static fn(array $team): int => count($team['resolved_players']), $row['teams']);
        echo sprintf(
            "- %s | %s | %s | jugadores %s | premios %d\n",
            $row['match']['heading'],
            $row['match_date'],
            (string) $row['court']['court_key'],
            implode('/', $counts),
            count($row['awards'])
        );
    }
    echo "\nPara insertar: php scripts/import_whatsapp_matches.php --commit --create-missing\n";
    exit(0);
}

$pdo->beginTransaction();
try {
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
         VALUES (:match_id, :player_id, :team_number, :assigned_position, :is_goalkeeper, :lineup_order, :formation_line_order, 'confirmado', :goals, :rating)"
    );
    $insertAward = $pdo->prepare(
        "INSERT INTO match_awards (match_id, award_code, player_id)
         VALUES (:match_id, :award_code, :player_id)"
    );

    foreach ($prepared as $row) {
        $playersPerTeam = max(array_map(static fn(array $team): int => count($team['resolved_players']), $row['teams']));
        $insertMatch->execute([
            'title' => (string) $row['match']['title'],
            'rental_court_id' => (int) $row['court']['id'],
            'match_date' => (string) $row['match_date'],
            'draw_started_at' => (string) $row['match_date'],
            'draw_completed_at' => (string) $row['match_date'],
            'players_per_team' => $playersPerTeam,
            'notes' => "Importado desde WhatsApp\n" . (string) $row['import_key'],
            'result_notes' => (string) $row['match']['heading'],
        ]);
        $matchId = (int) $pdo->lastInsertId();

        foreach ($row['teams'] as $teamNumber => $team) {
            $totalSkill = 0.0;
            $formationData = [];
            $lineOrders = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
            foreach ($team['resolved_players'] as $lineupIndex => $entry) {
                $player = $entry['player'];
                $position = import_default_position($player);
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
                    'goals' => (int) ($row['goals'][(int) $player['id']] ?? 0),
                    'rating' => (float) $entry['rating'],
                ]);
            }
            $counts = ['ARQ' => 0, 'DEF' => 0, 'MED' => 0, 'DEL' => 0];
            foreach ($formationData as $formationPlayer) {
                $counts[(string) $formationPlayer['position']]++;
            }
            $insertTeam->execute([
                'match_id' => $matchId,
                'team_number' => (int) $teamNumber,
                'team_name' => 'Equipo ' . $teamNumber,
                'total_skill' => $totalSkill,
                'formation_name' => implode('-', [$counts['ARQ'], $counts['DEF'], $counts['MED'], $counts['DEL']]),
                'formation_data' => json_encode($formationData, JSON_UNESCAPED_UNICODE),
                'color_name' => import_color_name((string) $team['label'], (int) $teamNumber),
                'goals' => (int) $team['goals'],
            ]);
        }

        foreach ($row['awards'] as $awardCode => $player) {
            $insertAward->execute([
                'match_id' => $matchId,
                'award_code' => (string) $awardCode,
                'player_id' => (int) $player['id'],
            ]);
        }

        echo sprintf("Importado match #%d: %s\n", $matchId, $row['match']['heading']);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
