<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/sorteo_multiple.php';
require_once __DIR__ . '/lib/admin_config.php';

require_admin();

if (basename((string) ($_SERVER['SCRIPT_NAME'] ?? '')) === 'encuentros.php' && !defined('MATCH_ADMIN_VIEW')) {
    redirect('editar_partidos.php');
}

$pdo = db();
ensure_control_schema();
ensure_multiple_draw_schema();
ensure_admin_config_schema();
$adminSettings = admin_config_settings();
$activeRentalCourts = rental_courts(true);
$allRentalCourts = rental_courts(false);
$rentalCourtsById = [];
foreach ($allRentalCourts as $rentalCourtRow) {
    $rentalCourtsById[(int) $rentalCourtRow['id']] = $rentalCourtRow;
}

$matchAdminView = defined('MATCH_ADMIN_VIEW') ? (string) MATCH_ADMIN_VIEW : 'edit';
$showCreateSection = in_array($matchAdminView, ['create', 'all'], true);
$showEditSection = in_array($matchAdminView, ['edit', 'all'], true);
$matchFormPage = 'crear_partido.php';
$matchListPage = 'editar_partidos.php';

function clear_match_draw_data(PDO $pdo, int $matchId): void
{
    $pdo->prepare('DELETE FROM match_draw_options WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
    $pdo->prepare(
        'UPDATE match_players
         SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0, lineup_order = NULL, formation_line_order = NULL, goals = 0, rating = NULL
         WHERE match_id = :mid'
    )->execute(['mid' => $matchId]);
    $pdo->prepare(
        'UPDATE matches
         SET draw_mode = "none", draw_started_at = NULL, draw_completed_at = NULL, finalized_at = NULL, formation_edit_deadline = DATE_SUB(match_date, INTERVAL 1 HOUR), redraw_count = 0, multi_draw_winner_option_id = NULL
         WHERE id = :mid'
    )->execute(['mid' => $matchId]);
}

function delete_match_cascade(PDO $pdo, int $matchId): void
{
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_awards WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_players WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $stmt = $pdo->prepare('DELETE FROM matches WHERE id = :id');
        $stmt->execute(['id' => $matchId]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function admin_rental_court_label(?array $court): string
{
    if (!$court) {
        return 'Sin cancha';
    }

    $key = trim((string) ($court['court_key'] ?? ''));
    $place = trim((string) ($court['place'] ?? ''));
    if ($key === '') {
        return $place !== '' ? $place : 'Cancha';
    }
    if ($place === '') {
        return $key;
    }

    return $key . ' - ' . $place;
}

function normalize_import_player_name(string $value): string
{
    $value = trim($value);
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    $candidates = [$value];
    $repaired = @mb_convert_encoding($value, 'UTF-8', 'Windows-1252');
    if (is_string($repaired) && $repaired !== $value) {
        $candidates[] = $repaired;
    }

    $best = '';
    $bestScore = PHP_INT_MAX;
    foreach ($candidates as $candidate) {
        $candidate = mb_strtolower($candidate, 'UTF-8');
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $candidate);
        if (!is_string($ascii)) {
            $ascii = $candidate;
        }
        $ascii = strtolower($ascii);
        $ascii = preg_replace('/[^a-z0-9 ]+/', '', $ascii) ?? $ascii;
        $ascii = trim(preg_replace('/\s+/', ' ', $ascii) ?? $ascii);
        $score = preg_match('/[\x{00C2}\x{00C3}\x{FFFD}]/u', $candidate) === 1 ? 10 : 0;
        $score += substr_count($ascii, '?');
        if ($ascii !== '' && $score < $bestScore) {
            $best = $ascii;
            $bestScore = $score;
        }
    }

    return $best;
}

function parse_import_player_list(string $text, int $maxPlayers = 0): array
{
    $items = [];
    $errors = [];
    $lines = preg_split('/\R/u', $text) ?: [];
    $numbered = [];

    foreach ($lines as $lineIndex => $line) {
        $line = trim((string) $line);
        if ($line === '') {
            continue;
        }

        if (preg_match('/^\s*(\d+)(?:[\s\.\)\-]+)(.+?)\s*$/u', $line, $matches) !== 1) {
            continue;
        }

        $numbered[] = [
            'line' => $lineIndex + 1,
            'number' => (int) $matches[1],
            'name' => trim((string) $matches[2]),
        ];
    }

    $byNumber = [];
    if ($maxPlayers > 0) {
        foreach ($numbered as $startIndex => $startRow) {
            if ((int) $startRow['number'] !== 1) {
                continue;
            }

            $candidate = [];
            for ($index = $startIndex; $index < count($numbered); $index++) {
                $row = $numbered[$index];
                $number = (int) $row['number'];
                if ($index > $startIndex && $number === 1) {
                    break;
                }
                if ($number > $maxPlayers) {
                    break;
                }
                if ($number < 1 || isset($candidate[$number])) {
                    continue;
                }
                $candidate[$number] = [
                    'number' => $number,
                    'name' => (string) $row['name'],
                ];
                if (count($candidate) >= $maxPlayers) {
                    break;
                }
            }

            if (count($candidate) > count($byNumber)) {
                $byNumber = $candidate;
            }
            if (count($byNumber) >= $maxPlayers) {
                break;
            }
        }
    } else {
        foreach ($numbered as $row) {
            $number = (int) $row['number'];
            if ($number < 1 || isset($byNumber[$number])) {
                continue;
            }
            $byNumber[$number] = [
                'number' => $number,
                'name' => (string) $row['name'],
            ];
        }
    }

    ksort($byNumber);
    $items = array_values($byNumber);

    if (!$items) {
        $errors[] = $maxPlayers > 0
            ? 'No se encontro una lista numerada que empiece en 1 y llegue hasta el cupo de la fecha.'
            : 'No se encontro ningun jugador para importar.';
    }

    return ['items' => $items, 'errors' => $errors];
}

function import_player_aliases(): array
{
    $aliases = $_SESSION['match_import_aliases'] ?? [];
    return is_array($aliases) ? $aliases : [];
}

function set_import_player_alias(string $importName, int $playerId): void
{
    $key = normalize_import_player_name($importName);
    if ($key === '' || $playerId <= 0) {
        return;
    }
    if (!isset($_SESSION['match_import_aliases']) || !is_array($_SESSION['match_import_aliases'])) {
        $_SESSION['match_import_aliases'] = [];
    }
    $_SESSION['match_import_aliases'][$key] = $playerId;
}

function import_player_suggestions(string $name, array $players, int $limit = 4): array
{
    $needle = normalize_import_player_name($name);
    if ($needle === '') {
        return [];
    }

    $suggestions = [];
    foreach ($players as $player) {
        $candidate = normalize_import_player_name((string) $player['name']);
        if ($candidate === '') {
            continue;
        }

        $score = 0;
        if ($candidate === $needle) {
            $score = 100;
        } elseif (str_contains($candidate, $needle) || str_contains($needle, $candidate)) {
            $score = 82;
        } else {
            similar_text($needle, $candidate, $percent);
            $score = (int) round($percent);
        }

        if ($score >= 58) {
            $suggestions[] = ['player' => $player, 'score' => $score];
        }
    }

    usort($suggestions, static function (array $a, array $b): int {
        if ($a['score'] !== $b['score']) {
            return $b['score'] <=> $a['score'];
        }
        return strcmp((string) $a['player']['name'], (string) $b['player']['name']);
    });

    return array_slice($suggestions, 0, $limit);
}

function resolve_imported_player_list(PDO $pdo, string $text, int $maxPlayers = 0): array
{
    $parsed = parse_import_player_list($text, $maxPlayers);
    $players = repo_all_players(true);
    $playersByName = [];
    $playersById = [];
    $aliases = import_player_aliases();

    foreach ($players as $player) {
        $playersById[(int) $player['id']] = $player;
        $key = normalize_import_player_name((string) $player['name']);
        if ($key !== '' && !isset($playersByName[$key])) {
            $playersByName[$key] = $player;
        }
    }

    $matched = [];
    $missing = [];
    $matchedIds = [];
    foreach ($parsed['items'] as $item) {
        $key = normalize_import_player_name((string) $item['name']);
        $aliasedId = (int) ($aliases[$key] ?? 0);
        if ($aliasedId > 0 && isset($playersById[$aliasedId])) {
            $player = $playersById[$aliasedId];
            $matched[] = [
                'number' => (int) $item['number'],
                'import_name' => (string) $item['name'],
                'player' => $player,
                'alias' => true,
            ];
            $matchedIds[] = (int) $player['id'];
            continue;
        }

        if ($key !== '' && isset($playersByName[$key])) {
            $player = $playersByName[$key];
            $matched[] = [
                'number' => (int) $item['number'],
                'import_name' => (string) $item['name'],
                'player' => $player,
            ];
            $matchedIds[] = (int) $player['id'];
            continue;
        }

        $missing[] = $item;
    }

    return [
        'source' => $text,
        'max_players' => $maxPlayers,
        'items' => $parsed['items'],
        'errors' => $parsed['errors'],
        'matched' => $matched,
        'missing' => $missing,
        'matched_ids' => array_values(array_unique($matchedIds)),
    ];
}

function store_imported_player_list(PDO $pdo, string $text, int $maxPlayers = 0): array
{
    $result = resolve_imported_player_list($pdo, $text, $maxPlayers);
    $_SESSION['match_import_list'] = $result;
    return $result;
}

function save_imported_player(PDO $pdo): void
{
    $importName = trim((string) ($_POST['import_name'] ?? ''));
    $name = trim((string) ($_POST['name'] ?? ''));
    $positions = $_POST['positions'] ?? [];
    $pace = normalize_pace((string) ($_POST['pace'] ?? 'rapido'));
    $skill = (float) ($_POST['skill'] ?? 1);
    $active = isset($_POST['active']) ? 1 : 0;
    $skill = max(1.0, min(6.0, round($skill * 2) / 2));

    if ($name === '' || !$positions) {
        flash('error', 'Nombre y posiciones son obligatorios para agregar el jugador.');
        return;
    }

    $positionsCsv = join_positions(array_map('strval', $positions));
    if ($positionsCsv === '') {
        flash('error', 'Debes seleccionar al menos una posicion valida.');
        return;
    }

    $existingPlayer = null;
    foreach (repo_all_players(false) as $player) {
        if (normalize_import_player_name((string) $player['name']) === normalize_import_player_name($name)) {
            $existingPlayer = $player;
            break;
        }
    }

    $params = [
        'name' => $name,
        'positions' => $positionsCsv,
        'pace' => $pace,
        'skill' => $skill,
        'technique' => $skill,
        'rhythm' => $pace === 'lento' ? 2.0 : 4.0,
        'defense_physical' => 3.0,
        'attack' => $skill,
        'teamwork' => $skill,
        'mentality' => 3.0,
        'regularity' => 3.5,
        'goalkeeper_skill' => str_contains($positionsCsv, 'ARQ') ? $skill : null,
        'active' => $active,
    ];

    if ($existingPlayer) {
        $existingId = (int) $existingPlayer['id'];
        if ((int) ($existingPlayer['active'] ?? 0) !== 1 && $active === 1) {
            $stmt = $pdo->prepare(
                'UPDATE players
                 SET name = :name, positions = :positions, pace = :pace, skill = :skill,
                     technique = :technique, rhythm = :rhythm, defense_physical = :defense_physical,
                     attack = :attack, teamwork = :teamwork, mentality = :mentality, regularity = :regularity, goalkeeper_skill = :goalkeeper_skill,
                     active = :active
                 WHERE id = :id'
            );
            $stmt->execute($params + ['id' => $existingId]);
        }
        set_import_player_alias($importName !== '' ? $importName : $name, $existingId);
        flash('info', 'Jugador ya existente detectado. Se usara el jugador actual en la importacion.');
        return;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO players
           (name, positions, pace, skill, technique, rhythm, defense_physical, attack, teamwork, mentality, regularity, goalkeeper_skill, active)
         VALUES
           (:name, :positions, :pace, :skill, :technique, :rhythm, :defense_physical, :attack, :teamwork, :mentality, :regularity, :goalkeeper_skill, :active)'
    );
    $stmt->execute($params);
    flash('success', 'Jugador agregado y disponible para la importacion.');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');

    if ($action === 'import_players_list') {
        $text = trim((string) ($_POST['import_players_text'] ?? ''));
        $maxPlayers = max(1, min(72, (int) ($_POST['import_max_players'] ?? 18)));
        if ($text === '') {
            unset($_SESSION['match_import_list']);
            flash('error', 'Pega una lista de jugadores para importar.');
            redirect($matchFormPage);
        }

        unset($_SESSION['match_import_aliases']);
        $result = store_imported_player_list($pdo, $text, $maxPlayers);
        if ($result['errors']) {
            flash('error', 'Hay lineas con formato invalido. Revisalas antes de crear la fecha.');
        } elseif ($result['missing']) {
            flash('info', 'Se importaron coincidencias. Agrega los jugadores faltantes para completar la lista.');
        } else {
            flash('success', 'Listado importado: todos los jugadores coinciden y quedaron seleccionados.');
        }
        redirect($matchFormPage);
    }

    if ($action === 'clear_import_players_list') {
        unset($_SESSION['match_import_list']);
        unset($_SESSION['match_import_aliases']);
        flash('info', 'Importacion descartada.');
        redirect($matchFormPage);
    }

    if ($action === 'use_import_existing_player') {
        $importName = trim((string) ($_POST['import_name'] ?? ''));
        $playerId = (int) ($_POST['player_id'] ?? 0);
        $player = $playerId > 0 ? repo_player_by_id($playerId) : null;
        if ($importName !== '' && $player && (int) ($player['active'] ?? 0) === 1) {
            set_import_player_alias($importName, $playerId);
            flash('success', 'Se usara el jugador existente: ' . (string) $player['name'] . '.');
        } else {
            flash('error', 'No se pudo usar ese jugador existente. Verifica que este activo.');
        }
        $source = (string) ($_SESSION['match_import_list']['source'] ?? '');
        $maxPlayers = (int) ($_SESSION['match_import_list']['max_players'] ?? 0);
        if ($source !== '') {
            store_imported_player_list($pdo, $source, $maxPlayers);
        }
        redirect($matchFormPage);
    }

    if ($action === 'create_import_player') {
        save_imported_player($pdo);
        $source = (string) ($_SESSION['match_import_list']['source'] ?? '');
        $maxPlayers = (int) ($_SESSION['match_import_list']['max_players'] ?? 0);
        if ($source !== '') {
            store_imported_player_list($pdo, $source, $maxPlayers);
        }
        redirect($matchFormPage);
    }

    if ($action === 'delete_match') {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id > 0) {
            try {
                delete_match_cascade($pdo, $id);
                flash('success', 'Fecha eliminada junto con convocados, equipos, capitanes, puntajes y premios.');
            } catch (Throwable $e) {
                flash('error', 'No se pudo eliminar la fecha: ' . $e->getMessage());
            }
        }
        redirect($matchListPage);
    }

    if ($action === 'update_match_court') {
        $id = (int) ($_POST['id'] ?? 0);
        $selectedCourtId = max(0, (int) ($_POST['rental_court_id'] ?? 0));
        $selectedCourt = $selectedCourtId > 0 ? ($rentalCourtsById[$selectedCourtId] ?? null) : null;

        if ($id <= 0 || !repo_match_by_id($id)) {
            flash('error', 'La fecha seleccionada no existe.');
            redirect($matchListPage);
        }

        if ($selectedCourtId > 0 && !$selectedCourt) {
            flash('error', 'La cancha seleccionada no existe.');
            redirect($matchListPage . '?focus_match=' . $id);
        }

        $stmt = $pdo->prepare('UPDATE matches SET rental_court_id = :rental_court_id WHERE id = :id');
        $stmt->execute([
            'id' => $id,
            'rental_court_id' => $selectedCourt ? (int) $selectedCourt['id'] : null,
        ]);

        flash('success', 'Cancha de la fecha actualizada.');
        redirect($matchListPage . '?focus_match=' . $id);
    }

    if ($action === 'save_match') {
        $id = (int) ($_POST['id'] ?? 0);
        $titleTxt = trim((string) ($_POST['title'] ?? ''));
        $selectedCourtId = max(0, (int) ($_POST['rental_court_id'] ?? 0));
        $selectedCourt = $selectedCourtId > 0 ? rental_court_by_id($selectedCourtId) : null;
        $matchDate = trim((string) ($_POST['match_date'] ?? ''));
        $numTeams = max(2, min(4, (int) ($_POST['num_teams'] ?? 2)));
        $playersPerTeam = max(1, min(12, (int) ($_POST['players_per_team'] ?? 9)));
        $maxDiff = 0.5;
        $allowRedraw = (int) ($_POST['allow_redraw'] ?? ($adminSettings['allow_redraw_default'] ?? 1)) === 1 ? 1 : 0;
        $redrawLimit = max(0, min(20, (int) ($_POST['redraw_limit'] ?? ($adminSettings['redraw_limit_default'] ?? 3))));
        $multiDrawCount = max(1, min(10, (int) ($_POST['multi_draw_count'] ?? ($adminSettings['multi_draw_count_default'] ?? 3))));
        $multiDrawLockMinutes = max(0, min(1440, (int) ($_POST['multi_draw_lock_minutes'] ?? ($adminSettings['multi_draw_lock_minutes_default'] ?? 60))));
        $notes = '';
        $participants = array_map('intval', $_POST['participants'] ?? []);
        $participants = array_values(array_unique(array_filter($participants, static fn(int $id): bool => $id > 0)));

        if ($selectedCourt) {
            $matchDate = rental_court_next_datetime($selectedCourt)->format('Y-m-d\TH:i');
            $numTeams = 2;
            $playersPerTeam = max(1, min(12, (int) ((int) $selectedCourt['total_players'] / 2)));
            $titleTxt = $titleTxt === '' ? (string) $selectedCourt['court_key'] . ' - ' . (string) $selectedCourt['place'] : $titleTxt;
        }
        $targetPlayers = $numTeams * $playersPerTeam;

        if ($matchDate === '') {
            flash('error', 'La fecha es obligatoria.');
            redirect($id ? $matchFormPage . '?edit=' . $id : $matchFormPage);
        }
        if (count($participants) !== $targetPlayers) {
            flash('error', "Debes seleccionar exactamente {$targetPlayers} jugadores ({$playersPerTeam} por equipo x {$numTeams} equipos).");
            redirect($id ? $matchFormPage . '?edit=' . $id : $matchFormPage);
        }
        if ($participants) {
            $in = implode(',', array_fill(0, count($participants), '?'));
            $activeStmt = $pdo->prepare("SELECT COUNT(*) FROM players WHERE active = 1 AND id IN ($in)");
            $activeStmt->execute($participants);
            if ((int) $activeStmt->fetchColumn() !== count($participants)) {
                flash('error', 'Solo se pueden convocar jugadores con estado activo.');
                redirect($id ? $matchFormPage . '?edit=' . $id : $matchFormPage);
            }
        }

        if ($id > 0) {
            $existing = repo_match_by_id($id);
            if (!$existing) {
                flash('error', 'La fecha a editar no existe.');
                redirect($matchListPage);
            }
            if ($existing['status'] === 'finalizado') {
                flash('error', 'No se puede editar una fecha finalizada.');
                redirect($matchListPage);
            }
            $stmt = $pdo->prepare(
                'UPDATE matches
                 SET title = :title, rental_court_id = :rental_court_id, match_date = :match_date, num_teams = :num_teams, players_per_team = :players_per_team, max_diff = :max_diff, allow_redraw = :allow_redraw, redraw_limit = :redraw_limit, multi_draw_count = :multi_draw_count, multi_draw_lock_minutes = :multi_draw_lock_minutes, notes = :notes, status = :status,
                     draw_mode = "none", draw_started_at = NULL, draw_completed_at = NULL, finalized_at = NULL, formation_edit_deadline = :formation_edit_deadline
                 WHERE id = :id'
            );
            $savedMatchDate = date('Y-m-d H:00:00', strtotime($matchDate));
            $stmt->execute([
                'id' => $id,
                'title' => $titleTxt === '' ? null : $titleTxt,
                'rental_court_id' => $selectedCourt ? (int) $selectedCourt['id'] : null,
                'match_date' => $savedMatchDate,
                'num_teams' => $numTeams,
                'players_per_team' => $playersPerTeam,
                'max_diff' => $maxDiff,
                'allow_redraw' => $allowRedraw,
                'redraw_limit' => $redrawLimit,
                'multi_draw_count' => $multiDrawCount,
                'multi_draw_lock_minutes' => $multiDrawLockMinutes,
                'notes' => $notes === '' ? null : $notes,
                'status' => 'programado',
                'formation_edit_deadline' => date('Y-m-d H:i:s', strtotime($savedMatchDate . ' -1 hour')),
            ]);
            clear_match_draw_data($pdo, $id);
            repo_save_match_participants($id, $participants);
            unset($_SESSION['match_import_list']);
            unset($_SESSION['match_import_aliases']);
            flash('success', 'Fecha actualizada.');
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO matches (title, rental_court_id, match_date, num_teams, players_per_team, max_diff, allow_redraw, redraw_limit, redraw_count, multi_draw_count, multi_draw_lock_minutes, status, draw_mode, formation_edit_deadline, notes)
                 VALUES (:title, :rental_court_id, :match_date, :num_teams, :players_per_team, :max_diff, :allow_redraw, :redraw_limit, 0, :multi_draw_count, :multi_draw_lock_minutes, :status, :draw_mode, :formation_edit_deadline, :notes)'
            );
            $savedMatchDate = date('Y-m-d H:00:00', strtotime($matchDate));
            $stmt->execute([
                'title' => $titleTxt === '' ? null : $titleTxt,
                'rental_court_id' => $selectedCourt ? (int) $selectedCourt['id'] : null,
                'match_date' => $savedMatchDate,
                'num_teams' => $numTeams,
                'players_per_team' => $playersPerTeam,
                'max_diff' => $maxDiff,
                'allow_redraw' => $allowRedraw,
                'redraw_limit' => $redrawLimit,
                'multi_draw_count' => $multiDrawCount,
                'multi_draw_lock_minutes' => $multiDrawLockMinutes,
                'status' => 'programado',
                'draw_mode' => 'none',
                'formation_edit_deadline' => date('Y-m-d H:i:s', strtotime($savedMatchDate . ' -1 hour')),
                'notes' => $notes === '' ? null : $notes,
            ]);
            $newId = (int) $pdo->lastInsertId();
            repo_save_match_participants($newId, $participants);
            unset($_SESSION['match_import_list']);
            unset($_SESSION['match_import_aliases']);
            flash('success', 'Fecha creada.');
            redirect($matchListPage . '?focus_match=' . $newId);
        }
        redirect($matchListPage);
    }
}

$activePlayers = repo_all_players(true);
$importList = $_SESSION['match_import_list'] ?? null;
if (!is_array($importList)) {
    $importList = null;
}
$matches = repo_matches();
$latestMatch = null;
foreach ($matches as $candidateMatch) {
    if (
        !$latestMatch
        || strtotime((string) $candidateMatch['match_date']) > strtotime((string) $latestMatch['match_date'])
        || (
            strtotime((string) $candidateMatch['match_date']) === strtotime((string) $latestMatch['match_date'])
            && (int) $candidateMatch['id'] > (int) $latestMatch['id']
        )
    ) {
        $latestMatch = $candidateMatch;
    }
}
$matchesPerPage = 10;
$totalMatches = count($matches);
$totalPages = max(1, (int) ceil($totalMatches / $matchesPerPage));
$focusedMatchId = max(0, (int) ($_GET['focus_match'] ?? 0));
$focusedMatchPage = 0;
if ($focusedMatchId > 0) {
    foreach ($matches as $focusIndex => $focusMatch) {
        if ((int) $focusMatch['id'] === $focusedMatchId) {
            $focusedMatchPage = intdiv($focusIndex, $matchesPerPage) + 1;
            break;
        }
    }
}
$requestedPage = isset($_GET['page']) ? (int) $_GET['page'] : ($focusedMatchPage ?: 1);
$currentPage = max(1, min($totalPages, $requestedPage));
$pageOffset = ($currentPage - 1) * $matchesPerPage;
$pagedMatches = array_slice($matches, $pageOffset, $matchesPerPage);
$historyTeamsByMatch = [];
$historyCaptainNames = [];
$historyAwardCounts = [];
$historyRatingCounts = [];
$historyMatchIds = array_map(static fn(array $match): int => (int) $match['id'], $matches);
if ($historyMatchIds) {
    $in = implode(',', array_fill(0, count($historyMatchIds), '?'));
    $stmtHistoryTeams = $pdo->prepare(
        "SELECT *
         FROM match_teams
         WHERE match_id IN ($in)
         ORDER BY match_id ASC, team_number ASC"
    );
    $stmtHistoryTeams->execute($historyMatchIds);
    $historyCaptainIds = [];
    foreach ($stmtHistoryTeams->fetchAll() as $teamRow) {
        $historyTeamsByMatch[(int) $teamRow['match_id']][] = $teamRow;
        if (!empty($teamRow['captain_player_id'])) {
            $historyCaptainIds[(int) $teamRow['captain_player_id']] = true;
        }
    }
    if ($historyCaptainIds) {
        $captainIds = array_keys($historyCaptainIds);
        $captainIn = implode(',', array_fill(0, count($captainIds), '?'));
        $stmtCaptains = $pdo->prepare("SELECT id, name FROM players WHERE id IN ($captainIn)");
        $stmtCaptains->execute($captainIds);
        foreach ($stmtCaptains->fetchAll() as $captainRow) {
            $historyCaptainNames[(int) $captainRow['id']] = (string) $captainRow['name'];
        }
    }

    $stmtAwardCounts = $pdo->prepare(
        "SELECT match_id, COUNT(*) AS award_count
         FROM match_awards
         WHERE match_id IN ($in)
         GROUP BY match_id"
    );
    $stmtAwardCounts->execute($historyMatchIds);
    foreach ($stmtAwardCounts->fetchAll() as $awardRow) {
        $historyAwardCounts[(int) $awardRow['match_id']] = (int) $awardRow['award_count'];
    }

    $stmtRatingCounts = $pdo->prepare(
        "SELECT match_id,
                COUNT(*) AS player_count,
                SUM(CASE WHEN rating IS NOT NULL THEN 1 ELSE 0 END) AS rated_count
         FROM match_players
         WHERE match_id IN ($in)
         GROUP BY match_id"
    );
    $stmtRatingCounts->execute($historyMatchIds);
    foreach ($stmtRatingCounts->fetchAll() as $ratingRow) {
        $historyRatingCounts[(int) $ratingRow['match_id']] = [
            'player_count' => (int) $ratingRow['player_count'],
            'rated_count' => (int) $ratingRow['rated_count'],
        ];
    }
}

$editId = isset($_GET['edit']) ? (int) $_GET['edit'] : 0;
$editing = $editId > 0 ? repo_match_by_id($editId) : null;
$editingParticipants = [];
if ($editing) {
    foreach (repo_match_participants($editId) as $row) {
        $editingParticipants[] = (int) $row['id'];
    }
}

$form = $editing ?: [
    'id' => 0,
    'title' => '',
    'rental_court_id' => 0,
    'match_date' => date('Y-m-d H:i'),
    'num_teams' => 2,
    'players_per_team' => 9,
    'max_diff' => 0.5,
    'status' => 'programado',
    'notes' => '',
];
$form['players_per_team'] = $form['players_per_team'] ?? 9;
$form['allow_redraw'] = (int) ($form['allow_redraw'] ?? ($adminSettings['allow_redraw_default'] ?? 1));
$form['redraw_limit'] = max(0, min(20, (int) ($form['redraw_limit'] ?? ($adminSettings['redraw_limit_default'] ?? 3))));
$form['redraw_count'] = max(0, (int) ($form['redraw_count'] ?? 0));
$form['multi_draw_count'] = max(1, min(10, (int) ($form['multi_draw_count'] ?? ($adminSettings['multi_draw_count_default'] ?? 3))));
$form['multi_draw_lock_minutes'] = max(0, min(1440, (int) ($form['multi_draw_lock_minutes'] ?? ($adminSettings['multi_draw_lock_minutes_default'] ?? 60))));
$courtFormOptions = [];
foreach ($activeRentalCourts as $court) {
    $nextDate = rental_court_next_datetime($court);
    $courtFormOptions[] = [
        'id' => (int) $court['id'],
        'label' => (string) $court['court_key'] . ' - ' . (string) $court['place'] . ' - ' . rental_weekday_label((int) $court['weekday']) . ' ' . substr((string) $court['time_value'], 0, 5) . ' - ' . (int) $court['total_players'] . ' jugadores',
        'date' => $nextDate->format('Y-m-d\TH:i'),
        'dateLabel' => $nextDate->format('d/m/Y H:i'),
        'numTeams' => 2,
        'playersPerTeam' => max(1, min(12, (int) ((int) $court['total_players'] / 2))),
    ];
}
$targetSelection = (int) $form['num_teams'] * (int) $form['players_per_team'];
$nextMatchId = $matches
    ? (max(array_map(static fn(array $match): int => (int) $match['id'], $matches)) + 1)
    : 1;
$titlePlaceholder = 'Fecha #' . (string) ((int) ($form['id'] ?? 0) > 0 ? (int) $form['id'] : $nextMatchId);
$importMatched = is_array($importList['matched'] ?? null) ? $importList['matched'] : [];
$importMissing = is_array($importList['missing'] ?? null) ? $importList['missing'] : [];
$importErrors = is_array($importList['errors'] ?? null) ? $importList['errors'] : [];
$importMatchedIds = array_values(array_map('intval', $importList['matched_ids'] ?? []));

function admin_match_status_label(string $status): string
{
    return match ($status) {
        'finalizado' => 'Finalizado',
        'sorteado' => 'Equipos listos',
        default => 'Programado',
    };
}

function admin_history_team_label(array $match, array $team, array $captainNames): string
{
    if (!empty($team['captain_player_id'])) {
        $captainName = $captainNames[(int) $team['captain_player_id']] ?? ('Capitan ' . (int) ($team['team_number'] ?? 0));
        return mb_strtoupper(trim($captainName), 'UTF-8');
    }

    $teamNumber = (int) ($team['team_number'] ?? 0);
    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color === '' && (($match['draw_mode'] ?? '') !== 'captains')) {
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
        $color = $defaultColors[$teamNumber] ?? '';
    }

    $heartByColor = [
        'ROSA' => 'ðŸ’—',
        'AZUL' => 'ðŸ’™',
        'VERDE' => 'ðŸ’š',
        'NEGRO' => 'ðŸ–¤',
        'NARANJA' => 'ðŸ§¡',
    ];
    $normalizedColor = mb_strtoupper($color, 'UTF-8');
    if (isset($heartByColor[$normalizedColor])) {
        return 'EQUIPO ' . $heartByColor[$normalizedColor];
    }

    $label = trim((string) ($team['team_name'] ?? '')) ?: ('Equipo ' . $teamNumber);
    return mb_strtoupper($label, 'UTF-8');
}

function admin_history_match_score_line(array $match, array $teams, array $captainNames): string
{
    if (!$teams) {
        return '';
    }

    $showGoals = count($teams) === 2
        && (
            (string) ($match['status'] ?? '') === 'finalizado'
            || array_sum(array_map(static fn(array $team): int => (int) ($team['goals'] ?? 0), $teams)) > 0
        );

    $parts = [];
    foreach ($teams as $team) {
        $label = admin_history_team_label($match, $team, $captainNames);
        $parts[] = $showGoals ? ($label . ' ( ' . (int) ($team['goals'] ?? 0) . ' )') : $label;
    }

    return implode(' VS ', $parts);
}

function admin_team_color_from_label(string $label): string
{
    if (preg_match('/\(([^)]+)\)\s*$/i', $label, $matches) !== 1) {
        return '';
    }

    $color = mb_strtoupper(trim($matches[1]), 'UTF-8');
    $knownColors = ['ROSA', 'AZUL', 'VERDE', 'NEGRO', 'NARANJA'];
    return in_array($color, $knownColors, true) ? $color : '';
}

function admin_team_heart_color(string $color): string
{
    return match ($color) {
        'ROSA' => '#ec4899',
        'AZUL' => '#2563eb',
        'VERDE' => '#16a34a',
        'NEGRO' => '#111827',
        'NARANJA' => '#f97316',
        default => '#047857',
    };
}

function admin_render_team_label(string $label): string
{
    $color = admin_team_color_from_label($label);
    if ($color === '') {
        return h($label);
    }

    $name = trim((string) preg_replace('/\s*\([^)]+\)\s*$/', '', $label));
    if ($name === '') {
        $name = 'Equipo';
    }
    $heartColor = admin_team_heart_color($color);
    return '<span class="team-label-with-heart" title="' . h($label) . '">' .
        '<span>' . h($name) . '</span>' .
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="' . h($heartColor) . '">' .
        '<path d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />' .
        '</svg>' .
        '</span>';
}

function admin_history_team_scoreboard_label(array $match, array $team, array $captainNames): string
{
    $teamNumber = (int) ($team['team_number'] ?? 0);
    if (!empty($team['captain_player_id'])) {
        $captainName = $captainNames[(int) $team['captain_player_id']] ?? ('Capitan ' . $teamNumber);
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
        $color = trim((string) ($team['color_name'] ?? '')) ?: ($defaultColors[$teamNumber] ?? '');
        return $color !== '' ? ($captainName . ' (' . $color . ')') : $captainName;
    }

    $color = trim((string) ($team['color_name'] ?? ''));
    if ($color !== '') {
        return 'Equipo (' . mb_strtoupper($color, 'UTF-8') . ')';
    }

    if (($match['draw_mode'] ?? '') !== 'captains') {
        $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
        if (isset($defaultColors[$teamNumber])) {
            return 'Equipo (' . $defaultColors[$teamNumber] . ')';
        }
    }

    return trim((string) ($team['team_name'] ?? '')) ?: ('Equipo ' . $teamNumber);
}

function admin_render_match_scoreboard(array $match, array $teams, array $captainNames): string
{
    if (!$teams) {
        return '';
    }

    $scoreboardStyle = 'background:#0a5b0a!important;background-color:#0a5b0a!important;background-image:none!important;border-color:#094b0a!important;color:#f0fced!important;-webkit-text-fill-color:#f0fced!important;';
    $scoreboardTeamStyle = 'background:#0a5b0a!important;background-color:#0a5b0a!important;background-image:none!important;border-color:#094b0a!important;color:#f0fced!important;-webkit-text-fill-color:#f0fced!important;';
    $scoreboardTeamTextStyle = 'color:#f0fced!important;-webkit-text-fill-color:#f0fced!important;';
    $scoreboardScoreStyle = 'background:#b6f0aa!important;background-color:#b6f0aa!important;background-image:none!important;border-color:#0e900b!important;color:#021703!important;-webkit-text-fill-color:#021703!important;';
    $renderScoreboardTeam = static function (string $label) use ($scoreboardTeamStyle, $scoreboardTeamTextStyle): string {
        $html = admin_render_team_label($label);
        $html = str_replace('class="team-label-with-heart"', 'class="team-label-with-heart" style="' . h($scoreboardTeamStyle) . '"', $html);
        return str_replace('<span>', '<span style="' . h($scoreboardTeamTextStyle) . '">', $html);
    };
    $items = [];
    foreach ($teams as $team) {
        $items[] = [
            'label' => admin_history_team_scoreboard_label($match, $team, $captainNames),
            'goals' => (int) ($team['goals'] ?? 0),
        ];
    }

    if (count($items) !== 2) {
        $parts = [];
        foreach ($items as $item) {
            $parts[] = '<span class="scoreboard-team" style="' . h($scoreboardTeamStyle) . '">' . $renderScoreboardTeam((string) $item['label']) . '</span>';
        }
        return '<span class="match-scoreboard match-scoreboard-multi" style="' . h($scoreboardStyle) . '">' . implode('<span class="scoreboard-vs" style="' . h($scoreboardTeamStyle) . '">vs</span>', $parts) . '</span>';
    }

    return '<span class="match-scoreboard" style="' . h($scoreboardStyle) . '">' .
        '<span class="scoreboard-team" style="' . h($scoreboardTeamStyle) . '">' . $renderScoreboardTeam((string) $items[0]['label']) . '</span>' .
        '<strong class="scoreboard-score" style="' . h($scoreboardScoreStyle) . '">' . h((string) $items[0]['goals']) . ' - ' . h((string) $items[1]['goals']) . '</strong>' .
        '<span class="scoreboard-team scoreboard-team-away" style="' . h($scoreboardTeamStyle) . '">' . $renderScoreboardTeam((string) $items[1]['label']) . '</span>' .
        '</span>';
}

$scheduledCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'programado'));
$readyCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'sorteado'));
$finishedCount = count(array_filter($matches, static fn(array $m): bool => (string) $m['status'] === 'finalizado'));

$pageHeading = $showCreateSection && !$showEditSection ? 'Crear fecha' : 'Editar fechas';
$pageDescription = $showCreateSection && !$showEditSection
    ? 'Carga una nueva fecha, define cupos y selecciona los jugadores convocados.'
    : 'Administra fechas cargadas, acciones disponibles, sorteo, capitanes y resultados.';
$title = $pageHeading . ' | ' . APP_NAME;
$activePage = $showCreateSection && !$showEditSection ? $matchFormPage : $matchListPage;
$bodyClass = $showEditSection ? 'page-editar-partidos' : 'page-crear-partido';
require __DIR__ . '/includes/header.php';

$encounterOverviewStyle = 'background:#fbfdfc!important;background-color:#fbfdfc!important;background-image:none!important;border-color:#cfe0d9!important;color:#10231d!important;';
$encounterOverviewLabelStyle = 'color:#315247!important;';
$encounterOverviewValueStyle = 'color:#082017!important;';
$encounterHistoryPanelStyle = 'background:#ffffff!important;background-color:#ffffff!important;background-image:none!important;border-color:#cfe0d9!important;color:#10231d!important;';
$encounterCardStyle = 'background:#fbfdfc!important;background-color:#fbfdfc!important;background-image:none!important;border-color:#dbe7e2!important;color:#10231d!important;';
$encounterDateStyle = 'color:#047857!important;font-weight:900!important;';
$encounterTitleStyle = 'color:#082017!important;';
$encounterBadgeStyle = 'background:#ecfdf5!important;background-color:#ecfdf5!important;background-image:none!important;border-color:#b9dfcd!important;color:#063d2b!important;';
$encounterNoteStyle = 'color:#315247!important;';
$encounterActionsStyle = 'background:#f3f8f6!important;background-color:#f3f8f6!important;background-image:none!important;border-color:#dbe7e2!important;color:#10231d!important;';
$encounterLatestStyle = 'background:#f2fbf6!important;background-color:#f2fbf6!important;background-image:none!important;border-color:#b9dfcd!important;color:#10231d!important;';
$encounterMutedTextStyle = 'color:#315247!important;';
$encounterPrimaryActionStyle = 'background:#063d2b!important;background-color:#063d2b!important;background-image:none!important;border-color:#022c22!important;color:#ffffff!important;-webkit-text-fill-color:#ffffff!important;';
?>

<section class="<?= $showCreateSection && !$showEditSection ? 'crear-partido-hero mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-lime-200/30 bg-gradient-to-br from-emerald-950 via-emerald-950 to-emerald-900 p-4 text-lime-50 shadow-xl shadow-emerald-950/30 max-[760px]:rounded-xl max-[760px]:p-3' : 'page-head' ?>">
  <div>
    <h1 class="<?= $showCreateSection && !$showEditSection ? 'mb-1 text-3xl font-extrabold leading-tight tracking-normal text-lime-50 max-[760px]:text-2xl' : '' ?>"><?= h($pageHeading) ?></h1>
    <p class="<?= $showCreateSection && !$showEditSection ? 'max-w-2xl text-sm text-emerald-100/80' : 'small-muted' ?>"><?= h($pageDescription) ?></p>
  </div>
  <?php if ($showCreateSection && !$showEditSection): ?>
    <a class="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3.5 py-2.5 text-sm font-extrabold text-lime-100 no-underline shadow-md shadow-emerald-950/15 transition hover:border-lime-200/65 hover:bg-lime-100/12" href="<?= h($matchListPage) ?>">Ver fechas cargadas</a>
  <?php endif; ?>
</section>

<?php if ($showEditSection): ?>
<section class="encounters-overview">
  <article class="stat-box encounter-overview-panel" role="button" tabindex="0" data-encounter-status-filter="programado" aria-pressed="false" style="<?= h($encounterOverviewStyle) ?>">
    <div class="label" style="<?= h($encounterOverviewLabelStyle) ?>">Programados</div>
    <div class="value" style="<?= h($encounterOverviewValueStyle) ?>"><?= h((string) $scheduledCount) ?></div>
  </article>
  <article class="stat-box encounter-overview-panel" role="button" tabindex="0" data-encounter-status-filter="sorteado" aria-pressed="false" style="<?= h($encounterOverviewStyle) ?>">
    <div class="label" style="<?= h($encounterOverviewLabelStyle) ?>">Listos para finalizar</div>
    <div class="value" style="<?= h($encounterOverviewValueStyle) ?>"><?= h((string) $readyCount) ?></div>
  </article>
  <article class="stat-box encounter-overview-panel" role="button" tabindex="0" data-encounter-status-filter="finalizado" aria-pressed="false" style="<?= h($encounterOverviewStyle) ?>">
    <div class="label" style="<?= h($encounterOverviewLabelStyle) ?>">Finalizados</div>
    <div class="value" style="<?= h($encounterOverviewValueStyle) ?>"><?= h((string) $finishedCount) ?></div>
  </article>
</section>
<?php endif; ?>

<?php if ($showCreateSection): ?>
<details class="<?= $showCreateSection && !$showEditSection ? 'crear-partido-drawer relative mb-4 min-h-0 overflow-hidden rounded-2xl border border-lime-200/38 bg-emerald-950/88 p-0 shadow-xl shadow-emerald-950/24' : 'encounter-drawer ' . ($form['id'] ? 'is-editing' : 'is-new') ?>" <?= ($form['id'] || !$showEditSection) ? 'open' : '' ?>>
  <summary class="<?= $showCreateSection && !$showEditSection ? 'flex cursor-pointer list-none items-center justify-between gap-3 border-b border-lime-200/25 bg-emerald-950 px-4 py-3 text-lime-50 [&::-webkit-details-marker]:hidden' : 'encounter-drawer-tab' ?>">
    <span class="<?= $showCreateSection && !$showEditSection ? 'text-sm font-black uppercase tracking-wide text-lime-50' : '' ?>"><?= $form['id'] ? 'Editar fecha' : 'CREAR NUEVA FECHA' ?></span>
    <small class="<?= $showCreateSection && !$showEditSection ? 'rounded-full border border-lime-200/45 bg-lime-100 px-3 py-1 text-xs font-extrabold uppercase leading-none text-emerald-950 shadow-sm shadow-emerald-950/10' : '' ?>"><?= $targetSelection ?> convocados requeridos</small>
  </summary>
  <section class="<?= $showCreateSection && !$showEditSection ? 'bg-emerald-950/72 p-4 text-lime-50 max-[760px]:p-3' : 'card encounter-drawer-body' ?>">
  <div class="<?= $showCreateSection && !$showEditSection ? 'mb-4 grid items-start gap-3 border-b border-lime-200/20 pb-4 md:grid-cols-[minmax(0,1fr)_auto] max-[760px]:grid-cols-1 max-[760px]:gap-2 max-[760px]:pb-3' : '' ?>">
    <div>
      <span class="<?= $showCreateSection && !$showEditSection ? 'mb-1 inline-flex rounded-full border border-lime-200/45 bg-lime-100 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-950' : '' ?>"><?= $form['id'] ? 'Edicion' : 'Nueva fecha' ?></span>
      <h3 class="<?= $showCreateSection && !$showEditSection ? 'm-0 text-2xl font-extrabold leading-tight text-lime-50 max-[760px]:text-xl' : '' ?>"><?= $form['id'] ? 'Editar fecha' : 'Crear nueva fecha' ?></h3>
    </div>
    <div class="<?= $showCreateSection && !$showEditSection ? 'flex flex-wrap gap-2 md:justify-end max-[760px]:grid max-[760px]:grid-cols-3 max-[760px]:gap-1.5' : '' ?>" aria-label="Resumen de cupos">
      <span class="<?= $showCreateSection && !$showEditSection ? 'inline-flex min-h-10 items-center gap-1 rounded-xl border border-lime-200/35 bg-emerald-950 px-3 py-2 text-xs font-extrabold text-lime-100 max-[760px]:min-h-9 max-[760px]:justify-center max-[760px]:px-2 max-[760px]:py-1.5 max-[760px]:text-center max-[760px]:text-[10px] max-[760px]:leading-tight' : '' ?>"><strong class="text-base text-lime-100"><?= h((string) $targetSelection) ?></strong> cupos</span>
      <span class="<?= $showCreateSection && !$showEditSection ? 'inline-flex min-h-10 items-center gap-1 rounded-xl border border-lime-200/35 bg-emerald-950 px-3 py-2 text-xs font-extrabold text-lime-100 max-[760px]:min-h-9 max-[760px]:justify-center max-[760px]:px-2 max-[760px]:py-1.5 max-[760px]:text-center max-[760px]:text-[10px] max-[760px]:leading-tight' : '' ?>"><strong class="text-base text-lime-100"><?= h((string) min(4, max(2, (int) $form['num_teams']))) ?></strong> equipos</span>
      <span class="<?= $showCreateSection && !$showEditSection ? 'inline-flex min-h-10 items-center gap-1 rounded-xl border border-lime-200/35 bg-emerald-950 px-3 py-2 text-xs font-extrabold text-lime-100 max-[760px]:min-h-9 max-[760px]:justify-center max-[760px]:px-2 max-[760px]:py-1.5 max-[760px]:text-center max-[760px]:text-[10px] max-[760px]:leading-tight' : '' ?>"><strong class="text-base text-lime-100"><?= h((string) $form['players_per_team']) ?></strong> por equipo</span>
    </div>
  </div>

  <?php if (!$form['id']): ?>
    <form id="importPlayersForm" method="post" class="hidden">
      <input type="hidden" name="action" value="import_players_list">
    </form>
    <form id="clearImportPlayersForm" method="post" class="hidden">
      <input type="hidden" name="action" value="clear_import_players_list">
    </form>
    <?php foreach ($importMissing as $missingIndex => $missing): ?>
      <form id="createImportPlayerForm<?= h((string) $missingIndex) ?>" method="post" class="hidden">
        <input type="hidden" name="action" value="create_import_player">
        <input type="hidden" name="import_name" value="<?= h((string) $missing['name']) ?>">
      </form>
      <form id="useExistingImportPlayerForm<?= h((string) $missingIndex) ?>" method="post" class="hidden">
        <input type="hidden" name="action" value="use_import_existing_player">
        <input type="hidden" name="import_name" value="<?= h((string) $missing['name']) ?>">
        <input type="hidden" name="player_id" value="" data-use-existing-player-input="<?= h((string) $missingIndex) ?>">
      </form>
    <?php endforeach; ?>
  <?php endif; ?>

  <form method="post" class="<?= $showCreateSection && !$showEditSection ? 'grid gap-4' : '' ?>">
    <input type="hidden" name="action" value="save_match">
    <input type="hidden" name="id" value="<?= (int) $form['id'] ?>">
    <input type="hidden" name="allow_redraw" value="<?= (int) $form['allow_redraw'] ?>">
    <input type="hidden" name="redraw_limit" value="<?= (int) $form['redraw_limit'] ?>">
    <input type="hidden" name="multi_draw_count" value="<?= (int) $form['multi_draw_count'] ?>">
    <input type="hidden" name="multi_draw_lock_minutes" value="<?= (int) $form['multi_draw_lock_minutes'] ?>">
    <script type="application/json" data-rental-court-options><?= json_encode($courtFormOptions, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>

    <div class="<?= $showCreateSection && !$showEditSection ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'form-grid' ?>">
      <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 rounded-xl border border-lime-200/28 bg-emerald-900/42 p-3 shadow-sm shadow-emerald-950/15' : 'form-row' ?>">
        <label class="<?= $showCreateSection && !$showEditSection ? 'mb-1.5 block text-xs font-black uppercase tracking-wide text-lime-100/85' : '' ?>">Titulo (opcional)</label>
        <input class="<?= $showCreateSection && !$showEditSection ? 'w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/45 focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25' : '' ?>" type="text" name="title" value="<?= h((string) ($form['title'] ?? '')) ?>" placeholder="<?= h($titlePlaceholder) ?>">
      </div>
      <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 rounded-xl border border-lime-200/28 bg-emerald-900/42 p-3 shadow-sm shadow-emerald-950/15' : 'form-row' ?>">
        <label class="<?= $showCreateSection && !$showEditSection ? 'mb-1.5 block text-xs font-black uppercase tracking-wide text-lime-100/85' : '' ?>">Cancha alquilada</label>
        <select class="<?= $showCreateSection && !$showEditSection ? 'w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25' : '' ?>" name="rental_court_id" data-rental-court-select>
          <option value="0">Personalizado</option>
          <?php foreach ($courtFormOptions as $courtOption): ?>
            <option value="<?= (int) $courtOption['id'] ?>" <?= selected_attr((int) ($form['rental_court_id'] ?? 0) === (int) $courtOption['id']) ?>><?= h((string) $courtOption['label']) ?></option>
          <?php endforeach; ?>
        </select>
        <small class="<?= $showCreateSection && !$showEditSection ? 'mt-1.5 block text-xs font-semibold text-lime-50/72' : '' ?>">Al elegir una cancha se autocompleta fecha, equipos y jugadores por equipo.</small>
        <span class="<?= $showCreateSection && !$showEditSection ? 'mt-2 hidden w-fit rounded-lg border border-lime-200/30 bg-emerald-950/75 px-2.5 py-1 text-xs font-black text-lime-100' : 'hidden' ?>" data-rental-court-next-preview></span>
      </div>
      <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 rounded-xl border border-lime-200/28 bg-emerald-900/42 p-3 shadow-sm shadow-emerald-950/15' : 'form-row' ?>">
        <label class="<?= $showCreateSection && !$showEditSection ? 'mb-1.5 block text-xs font-black uppercase tracking-wide text-lime-100/85' : '' ?>">Fecha y hora</label>
        <input class="<?= $showCreateSection && !$showEditSection ? 'w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/45 transition focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25' : '' ?>" type="datetime-local" name="match_date" step="3600" required value="<?= h(date('Y-m-d\TH:00', strtotime((string) $form['match_date']))) ?>" data-rental-court-date-input>
        <span class="<?= $showCreateSection && !$showEditSection ? 'mt-2 hidden w-fit rounded-lg border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-xs font-black text-emerald-950 shadow-sm shadow-lime-200/15' : 'hidden' ?>" data-rental-court-date-changed>Fecha actualizada por cancha</span>
      </div>
      <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 rounded-xl border border-lime-200/28 bg-emerald-900/42 p-3 shadow-sm shadow-emerald-950/15' : 'form-row' ?>">
        <label class="<?= $showCreateSection && !$showEditSection ? 'mb-1.5 block text-xs font-black uppercase tracking-wide text-lime-100/85' : '' ?>">Numero de equipos</label>
        <input class="<?= $showCreateSection && !$showEditSection ? 'w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/45 transition focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25' : '' ?>" type="number" name="num_teams" min="2" max="4" value="<?= h((string) min(4, max(2, (int) $form['num_teams']))) ?>" required data-num-teams data-rental-court-field-input>
        <span class="<?= $showCreateSection && !$showEditSection ? 'mt-2 hidden w-fit rounded-lg border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-xs font-black text-emerald-950 shadow-sm shadow-lime-200/15' : 'hidden' ?>" data-rental-court-field-changed>Actualizado por cancha</span>
      </div>
      <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 rounded-xl border border-lime-200/28 bg-emerald-900/42 p-3 shadow-sm shadow-emerald-950/15' : 'form-row' ?>">
        <label class="<?= $showCreateSection && !$showEditSection ? 'mb-1.5 block text-xs font-black uppercase tracking-wide text-lime-100/85' : '' ?>">Jugadores por equipo</label>
        <input class="<?= $showCreateSection && !$showEditSection ? 'w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/45 transition focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25' : '' ?>" type="number" name="players_per_team" min="1" max="12" value="<?= h((string) $form['players_per_team']) ?>" required data-players-per-team data-rental-court-field-input>
        <span class="<?= $showCreateSection && !$showEditSection ? 'mt-2 hidden w-fit rounded-lg border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-xs font-black text-emerald-950 shadow-sm shadow-lime-200/15' : 'hidden' ?>" data-rental-court-field-changed>Actualizado por cancha</span>
      </div>
      <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 rounded-xl border border-lime-200/28 bg-emerald-900/42 p-3 text-sm font-semibold text-emerald-100/85 shadow-sm shadow-emerald-950/15 md:col-span-2' : 'form-row' ?>">
        <strong class="block text-xs font-black uppercase text-lime-100/85">Configuracion aplicada</strong>
        <span>Rehacer sorteo: <?= (int) $form['allow_redraw'] === 1 ? 'si' : 'no' ?> | Veces permitidas: <?= h((string) $form['redraw_limit']) ?> | Sorteo multiple: <?= h((string) $form['multi_draw_count']) ?> opciones | Cierre: <?= h((string) $form['multi_draw_lock_minutes']) ?> min antes.</span>
        <a class="mt-2 inline-flex w-fit rounded-lg border border-lime-200/35 bg-emerald-950/70 px-2.5 py-1 text-xs font-black text-lime-100 no-underline" href="configuracion.php">Editar configuracion</a>
      </div>
    </div>

    <div class="<?= $showCreateSection && !$showEditSection ? 'mb-0 grid gap-3 rounded-2xl border border-lime-200/28 bg-emerald-900/28 p-3 shadow-inner shadow-emerald-950/15' : 'form-row' ?>">
      <div class="<?= $showCreateSection && !$showEditSection ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-lime-200/30 bg-emerald-950 px-3 py-2.5 text-lime-50 shadow-md shadow-emerald-950/20' : 'participant-head' ?>">
        <label class="<?= $showCreateSection && !$showEditSection ? 'm-0 text-base font-black text-lime-50' : '' ?>">Jugadores convocados</label>
        <span class="<?= $showCreateSection && !$showEditSection ? 'rounded-full border border-lime-200/45 bg-lime-100 px-3 py-1.5 text-sm font-bold text-emerald-950 shadow-sm shadow-emerald-950/10' : 'participant-count' ?>">
          Seleccionados: <strong data-selection-count="participants">0</strong> / <strong data-selection-max="participants"><?= $targetSelection ?></strong>
        </span>
      </div>
      <?php if (!$form['id']): ?>
        <details class="rounded-2xl border border-lime-200/38 bg-emerald-950/88 text-lime-50 shadow-lg shadow-emerald-950/16" id="importar-listado" <?= $importList ? 'open' : '' ?>>
          <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl border border-lime-200/30 bg-emerald-950 px-4 py-3 text-sm font-extrabold text-lime-50 shadow-md shadow-emerald-950/20 [&::-webkit-details-marker]:hidden">
            <span>Importar listado</span>
            <small class="rounded-full border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-xs font-extrabold uppercase leading-none text-emerald-950 shadow-sm shadow-emerald-950/10"><?= $importList ? h((string) count($importMatched)) . ' encontrados | ' . h((string) count($importMissing)) . ' faltantes' : 'Pegar lista numerada' ?></small>
          </summary>

          <div class="p-3">
            <script type="application/json" data-existing-import-players><?= json_encode(array_map(static fn(array $player): array => [
                'id' => (int) $player['id'],
                'name' => (string) $player['name'],
                'meta' => (string) $player['positions'] . ' | ' . pace_label((string) $player['pace']) . ' | ' . skill_label((float) $player['skill']),
            ], $activePlayers), JSON_THROW_ON_ERROR | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
            <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 class="m-0 text-base font-extrabold text-lime-50">Importar listado</h4>
              </div>
              <?php if ($importList): ?>
                <button class="inline-flex min-h-10 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3.5 py-2.5 text-sm font-extrabold text-lime-50 transition hover:border-lime-200/65 hover:bg-lime-100/12 hover:text-lime-100" type="submit" form="clearImportPlayersForm">Limpiar</button>
              <?php endif; ?>
            </div>

            <div class="grid gap-3">
              <input type="hidden" name="import_max_players" value="<?= h((string) $targetSelection) ?>" data-import-max-players form="importPlayersForm">
              <textarea
                class="min-h-44 w-full resize-y rounded-2xl border border-lime-200/35 bg-emerald-950/95 px-4 py-3 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/45 focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25"
                name="import_players_text"
                rows="8"
                placeholder="1 Marcelo&#10;2 Pela&#10;3 Mauri&#10;4 Tebo"
                form="importPlayersForm"><?= h((string) ($importList['source'] ?? '')) ?></textarea>
              <button class="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200/75 bg-lime-100 px-3.5 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-lime-950/25 transition hover:bg-lime-200" type="submit" form="importPlayersForm">Importar listado</button>
            </div>

            <?php if ($importList): ?>
              <script type="application/json" data-imported-player-ids><?= h(json_encode($importMatchedIds, JSON_THROW_ON_ERROR)) ?></script>
              <div class="mt-3 grid gap-3">
                <div class="flex flex-wrap gap-2">
                  <span class="rounded-full bg-emerald-950/95 px-3 py-1.5 text-xs font-extrabold text-lime-100"><?= h((string) count($importMatched)) ?> encontrados</span>
                  <span class="rounded-full bg-emerald-950/95 px-3 py-1.5 text-xs font-extrabold text-lime-100"><?= h((string) count($importMissing)) ?> faltantes</span>
                  <?php if ($importErrors): ?>
                    <span class="rounded-full bg-emerald-950/95 px-3 py-1.5 text-xs font-extrabold text-lime-100"><?= h((string) count($importErrors)) ?> lineas a revisar</span>
                  <?php endif; ?>
                </div>

                <?php if ($importErrors): ?>
                  <div class="rounded-xl border border-red-200 bg-red-950/85 px-3 py-2 text-sm font-bold text-red-100">
                    <?php foreach ($importErrors as $error): ?>
                      <p class="m-0"><?= h((string) $error) ?></p>
                    <?php endforeach; ?>
                  </div>
                <?php endif; ?>

                <?php if ($importMatched): ?>
                  <div class="flex max-h-36 flex-wrap gap-1.5 overflow-auto rounded-xl border border-lime-200/35 bg-emerald-950/95 p-2">
                    <?php foreach ($importMatched as $matchRow): ?>
                      <?php $matchedPlayer = $matchRow['player']; ?>
                      <span class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900/80 px-2.5 py-1.5 text-xs font-bold text-lime-50">
                        <strong><?= h((string) $matchRow['number']) ?>.</strong>
                        <?= h((string) $matchedPlayer['name']) ?>
                        <button
                          type="button"
                          class="inline-flex h-5 min-h-5 w-5 items-center justify-center rounded-full bg-emerald-950 p-0 text-xs font-extrabold leading-none text-lime-50 transition hover:bg-red-700 hover:text-white"
                          data-remove-import-participant="<?= h((string) ((int) $matchedPlayer['id'])) ?>"
                          aria-label="Quitar <?= h((string) $matchedPlayer['name']) ?> de convocados"
                          title="Quitar de convocados"
                        >x</button>
                      </span>
                    <?php endforeach; ?>
                  </div>
                <?php endif; ?>

                <?php if ($importMissing): ?>
                  <div class="grid gap-2">
                    <?php foreach ($importMissing as $missingIndex => $missing): ?>
                      <?php
                        $missingFormId = 'missing-player-' . $missingIndex;
                        $createFormId = 'createImportPlayerForm' . $missingIndex;
                        $useExistingFormId = 'useExistingImportPlayerForm' . $missingIndex;
                        $suggestions = import_player_suggestions((string) $missing['name'], $activePlayers);
                      ?>
                      <details class="rounded-xl border border-lime-200/35 bg-emerald-950/90 p-2 text-lime-50">
                        <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm font-extrabold text-lime-50 [&::-webkit-details-marker]:hidden">
                          <span><?= h((string) $missing['number']) ?>. <?= h((string) $missing['name']) ?></span>
                          <strong class="rounded-full bg-lime-100 px-3 py-1 text-xs text-emerald-950">Agregar jugador</strong>
                        </summary>
                        <div class="mt-2 rounded-xl border border-lime-200/35 bg-emerald-950/90 p-3">
                          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div class="mb-2">
                              <label class="mb-1.5 block text-sm font-bold text-emerald-100" for="<?= h($missingFormId) ?>-name">Nombre</label>
                              <input
                                class="w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/45 focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25"
                                id="<?= h($missingFormId) ?>-name"
                                type="text"
                                name="name"
                                required
                                value="<?= h((string) $missing['name']) ?>"
                                form="<?= h($createFormId) ?>"
                                data-import-player-name-input
                                data-missing-index="<?= h((string) $missingIndex) ?>"
                              >
                            </div>
                            <div class="mb-2">
                              <label class="mb-1.5 block text-sm font-bold text-emerald-100" for="<?= h($missingFormId) ?>-pace">Ritmo</label>
                              <select class="w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" id="<?= h($missingFormId) ?>-pace" name="pace" form="<?= h($createFormId) ?>">
                                <option value="rapido">Rapido</option>
                                <option value="lento">Lento</option>
                              </select>
                            </div>
                            <div class="mb-2">
                              <label class="mb-1.5 block text-sm font-bold text-emerald-100" for="<?= h($missingFormId) ?>-skill">Puntuacion Base (1 a 6)</label>
                              <input class="w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" id="<?= h($missingFormId) ?>-skill" type="number" name="skill" min="1" max="6" step="0.5" value="1.0" form="<?= h($createFormId) ?>">
                            </div>
                            <div class="mb-2">
                              <label class="mb-1.5 block text-sm font-bold text-emerald-100">Estado</label>
                              <label class="inline-flex items-center gap-2 rounded-full border border-lime-200/35 bg-emerald-950/95 px-3 py-2 text-sm text-lime-50">
                                <input type="checkbox" name="active" value="1" checked form="<?= h($createFormId) ?>">
                                Jugador activo
                              </label>
                            </div>
                          </div>

                          <div class="mb-2">
                            <label class="mb-1.5 block text-sm font-bold text-emerald-100">Posiciones</label>
                            <div class="flex flex-wrap gap-2">
                              <?php foreach (allowed_positions() as $pos): ?>
                                <label class="inline-flex items-center gap-2 rounded-full border border-lime-200/35 bg-emerald-950/95 px-3 py-2 text-sm text-lime-50">
                                  <input type="checkbox" name="positions[]" value="<?= h($pos) ?>" form="<?= h($createFormId) ?>">
                                  <?= h($pos) ?>
                                </label>
                              <?php endforeach; ?>
                            </div>
                          </div>

                          <div class="<?= $suggestions ? '' : 'hidden' ?> mb-3 grid gap-2 rounded-xl border border-lime-200/35 bg-emerald-950/90 px-3 py-2" data-existing-player-panel="<?= h((string) $missingIndex) ?>">
                            <strong class="text-sm text-lime-50" data-existing-player-title><?= $suggestions && (int) $suggestions[0]['score'] === 100 ? 'Jugador ya existente' : 'Posibles coincidencias' ?></strong>
                            <div class="flex flex-wrap gap-2" data-existing-player-options>
                              <?php foreach ($suggestions as $suggestion): ?>
                                <?php $suggestedPlayer = $suggestion['player']; ?>
                                <button
                                  class="inline-flex min-h-10 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3.5 py-2.5 text-sm font-extrabold text-lime-50 transition hover:border-lime-200/65 hover:bg-lime-100/12 hover:text-lime-100"
                                  type="submit"
                                  form="<?= h($useExistingFormId) ?>"
                                  data-use-existing-player="<?= h((string) $missingIndex) ?>"
                                  data-player-id="<?= h((string) $suggestedPlayer['id']) ?>"
                                >
                                  Usar <?= h((string) $suggestedPlayer['name']) ?>
                                </button>
                              <?php endforeach; ?>
                            </div>
                          </div>

                          <button class="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200/75 bg-lime-100 px-3.5 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-lime-950/25 transition hover:bg-lime-200" type="submit" form="<?= h($createFormId) ?>">Guardar jugador</button>
                        </div>
                      </details>
                    <?php endforeach; ?>
                  </div>
                <?php endif; ?>
              </div>
            <?php endif; ?>
          </div>
        </details>
      <?php endif; ?>

      <div
        data-react-root
        data-react-island="participant_controls"
        data-limit="<?= h((string) $targetSelection) ?>"
      ></div>

      <div class="grid grid-cols-1 items-start gap-3 pb-24 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <section class="min-w-0 rounded-2xl border-2 border-lime-200/38 bg-emerald-950/88 p-3 text-lime-50 shadow-lg shadow-emerald-950/16">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-lime-200/30 bg-emerald-950 px-3 py-2.5 text-lime-50 shadow-md shadow-emerald-950/20">
          <div>
            <span class="mb-1 inline-flex rounded-full border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-emerald-950">Disponibles</span>
            <h4 class="m-0 text-base font-extrabold text-lime-50">Lista de jugadores activos</h4>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full border border-lime-200/35 bg-emerald-950 px-3 py-1.5 text-xs font-extrabold text-lime-100"><?= h((string) count($activePlayers)) ?> activos</span>
            <span class="rounded-full border border-lime-200/35 bg-emerald-950 px-3 py-1.5 text-xs font-extrabold text-lime-100"><strong data-selection-count="participants">0</strong> / <strong data-selection-max="participants"><?= $targetSelection ?></strong> jugadores elegidos</span>
          </div>
        </div>
        <div class="grid max-h-[34rem] gap-1.5 overflow-auto rounded-xl border border-lime-200/28 bg-emerald-950/74 p-2" data-participant-list>
          <?php foreach ($activePlayers as $p): ?>
            <?php
              $pid = (int) $p['id'];
              $checked = in_array($pid, $editingParticipants, true);
              $searchText = strtolower(trim((string) $p['name'] . ' ' . $p['positions'] . ' ' . pace_label((string) $p['pace']) . ' ' . number_format((float) $p['skill'], 1)));
            ?>
            <article class="flex items-center justify-between gap-2 rounded-lg border border-lime-200/24 bg-emerald-900/72 px-2.5 py-2 text-sm text-lime-50 shadow-sm shadow-emerald-950/18 transition hover:border-lime-200/52 hover:bg-emerald-800/82 <?= $checked ? '!border-lime-200/70 !bg-emerald-800/90 ring-2 ring-lime-200/25' : '' ?>" data-player-row data-player-id="<?= $pid ?>" data-search="<?= h($searchText) ?>">
              <span class="min-w-0">
                <strong class="block truncate text-sm font-extrabold text-lime-50"><?= h((string) $p['name']) ?></strong>
                <small class="block truncate text-xs text-emerald-100/82"><?= h((string) $p['positions']) ?> | <?= h(pace_label((string) $p['pace'])) ?> | <?= h(skill_label((float) $p['skill'])) ?></small>
              </span>
              <span class="flex shrink-0 items-center gap-1.5">
                <button class="inline-flex h-9 min-h-9 w-9 items-center justify-center rounded-xl border border-red-300/55 bg-red-950/85 px-0 py-2 text-sm font-extrabold text-red-100 transition hover:bg-red-900 hover:text-white <?= $checked ? 'cursor-not-allowed opacity-40' : '' ?>" type="button" data-remove-player-row aria-label="Quitar <?= h((string) $p['name']) ?>" title="Quitar">X</button>
                <button class="inline-flex min-h-9 items-center justify-center rounded-full px-3 py-1.5 text-sm font-extrabold transition <?= $checked ? '!bg-emerald-600 !text-white hover:!bg-emerald-700' : '!bg-lime-100 !text-emerald-950 hover:!bg-lime-200' ?>" type="button" data-participant-toggle><?= $checked ? 'Convocado' : 'Agregar' ?></button>
              </span>
              <input
                class="sr-only"
                type="checkbox"
                name="participants[]"
                value="<?= $pid ?>"
                data-player-name="<?= h((string) $p['name']) ?>"
                data-player-meta="<?= h((string) $p['positions'] . ' | ' . pace_label((string) $p['pace']) . ' | ' . skill_label((float) $p['skill'])) ?>"
                <?= checked_attr($checked) ?>
              >
            </article>
          <?php endforeach; ?>
        </div>
        <p class="hidden text-sm text-emerald-100/82" data-participant-empty>No hay jugadores que coincidan con la busqueda.</p>
      </section>

      <section class="min-w-0 rounded-2xl border-2 border-lime-200/38 bg-emerald-950/88 p-3 text-lime-50 shadow-lg shadow-emerald-950/16 lg:sticky lg:top-3 max-[760px]:hidden">
        <div class="mb-2 flex items-start justify-between gap-3 rounded-xl border border-lime-200/30 bg-emerald-950 px-3 py-2.5 text-lime-50 shadow-md shadow-emerald-950/20">
          <div>
            <span class="mb-1 inline-flex rounded-full border border-lime-200/45 bg-lime-100 px-2.5 py-1 text-[10px] font-extrabold uppercase text-emerald-950">Convocados</span>
            <h4 class="m-0 text-base font-extrabold text-lime-50">Seleccionados para esta fecha</h4>
          </div>
          <span class="inline-flex shrink-0 rounded-full border border-lime-200/35 bg-emerald-950 px-3 py-1.5 text-xs font-extrabold text-lime-100"><strong data-selection-count="participants">0</strong>/<strong data-selection-max="participants"><?= $targetSelection ?></strong></span>
        </div>
        <div class="grid max-h-[34rem] gap-2 overflow-auto" data-selected-participants></div>
        <p class="text-sm text-emerald-100/82" data-selected-empty>Agrega jugadores desde la lista.</p>
      </section>
      </div>

      <details class="fixed inset-x-3 bottom-3 z-40 hidden overflow-hidden rounded-2xl border border-emerald-800 bg-emerald-950 text-white shadow-2xl shadow-emerald-950/35 max-[760px]:block" data-participant-marquee>
        <summary class="grid cursor-pointer list-none items-center gap-2 px-3 py-3 [grid-template-columns:minmax(0,1fr)_auto_auto_auto] [&::-webkit-details-marker]:hidden">
          <span class="text-sm font-extrabold">CONVOCADOS</span>
          <strong class="rounded-full bg-emerald-950/95 px-3 py-1 text-sm font-extrabold text-lime-50"><span data-selection-count="participants">0</span> / <span data-selection-max="participants"><?= $targetSelection ?></span></strong>
          <button class="m-0 inline-flex min-h-8 w-auto items-center justify-center rounded-full bg-lime-100/15 px-3 py-1 text-[11px] font-extrabold text-emerald-100/70 disabled:cursor-not-allowed disabled:opacity-70" type="submit" data-mobile-submit disabled>
            CONTINUAR
          </button>
        </summary>
        <div class="grid max-h-[45dvh] gap-2 overflow-y-auto border-t border-white/10 bg-emerald-950/95 p-2 text-lime-50" data-selected-participants></div>
        <p class="m-0 border-t border-white/10 bg-emerald-950/95 px-3 py-2 text-xs text-emerald-100/70" data-selected-empty>Agrega jugadores desde la lista.</p>
      </details>
    </div>

    <div class="sticky bottom-3 z-30 mt-0 flex flex-wrap gap-2 rounded-2xl border border-lime-200/35 bg-emerald-950/92 p-2 shadow-2xl shadow-emerald-950/25 max-[760px]:fixed max-[760px]:inset-x-3 max-[760px]:grid max-[760px]:grid-cols-1">
      <button class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-lime-200/75 bg-lime-100 px-3.5 py-2.5 text-sm font-extrabold text-emerald-950 shadow-lg shadow-lime-950/25 transition hover:bg-lime-200" type="submit" data-confirm="<?= $form['id'] ? 'Guardar cambios de esta fecha?' : 'Crear esta fecha con los jugadores convocados?' ?>"><?= $form['id'] ? 'Guardar cambios' : 'Crear fecha' ?></button>
      <?php if ($form['id']): ?>
        <a class="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3.5 py-2.5 text-sm font-extrabold text-lime-50 no-underline transition hover:border-lime-200/65 hover:bg-lime-100/12 hover:text-lime-100" href="<?= h($matchListPage) ?>">Cancelar</a>
      <?php endif; ?>
    </div>
  </form>
  </section>
</details>
<?php endif; ?>

<?php if ($showEditSection): ?>
<section class="card encounters-history" style="<?= h($encounterHistoryPanelStyle) ?>">
  <div class="section-toolbar">
    <div>
      <h3>Historial de fechas</h3>
      <p class="small-muted" style="color:#375647!important;">Resumen rapido de estado, resultado y acciones disponibles. <?= h((string) $totalMatches) ?> fechas cargadas.</p>
    </div>
  </div>

  <?php if (!$matches): ?>
    <p>No hay fechas cargadas.</p>
  <?php else: ?>
    <?php if ($latestMatch): ?>
      <?php
        $latestId = (int) $latestMatch['id'];
        $latestIsScheduled = (string) $latestMatch['status'] === 'programado';
        $latestCanFinalize = (string) $latestMatch['status'] === 'sorteado';
        $latestIsFinalized = (string) $latestMatch['status'] === 'finalizado';
        $latestCanEditCaptainFormation = $latestCanFinalize;
        $latestPlayersPerTeam = (int) ($latestMatch['players_per_team'] ?? ((int) $latestMatch['participants_count'] / max(1, (int) $latestMatch['num_teams'])));
        $latestExpectedPlayers = (int) $latestMatch['num_teams'] * max(1, $latestPlayersPerTeam);
        $latestParticipantsCount = (int) $latestMatch['participants_count'];
        $latestTeams = $historyTeamsByMatch[$latestId] ?? [];
        $latestScoreboard = admin_render_match_scoreboard($latestMatch, $latestTeams, $historyCaptainNames);
      ?>
      <article class="encounter-latest-card" style="<?= h($encounterLatestStyle) ?>">
        <div>
          <span class="encounter-latest-kicker" style="<?= h($encounterBadgeStyle) ?>">Ultima fecha cargada</span>
          <h4 style="<?= h($encounterTitleStyle) ?>"><?= h((string) ($latestMatch['title'] ?: ('Fecha #' . $latestMatch['id']))) ?></h4>
          <p style="<?= h($encounterMutedTextStyle) ?>">
            <?= h(date('d/m/Y H:i', strtotime((string) $latestMatch['match_date']))) ?>
            | <?= h((string) $latestParticipantsCount) ?>/<?= h((string) $latestExpectedPlayers) ?> convocados
            | <?= h(admin_match_status_label((string) $latestMatch['status'])) ?>
          </p>
          <?php if ($latestScoreboard !== ''): ?>
            <div class="encounter-latest-score"><?= $latestScoreboard ?></div>
          <?php endif; ?>
        </div>
        <div class="encounter-latest-actions">
          <?php if ($latestIsScheduled): ?>
            <a class="btn btn-muted" href="<?= h($matchFormPage) ?>?edit=<?= $latestId ?>">Editar</a>
            <a class="btn btn-warning" href="sorteo_legacy_csv.php?match_id=<?= $latestId ?>">Sortear</a>
            <a class="btn btn-primary" style="<?= h($encounterPrimaryActionStyle) ?>" href="capitanes.php?match_id=<?= $latestId ?>">Capitanes</a>
            <a class="btn btn-muted" href="equipos_manual.php?match_id=<?= $latestId ?>">Manual</a>
          <?php elseif ($latestCanFinalize): ?>
            <?php if ($latestCanEditCaptainFormation): ?>
              <a class="btn btn-muted" href="capitanes.php?match_id=<?= $latestId ?>#formacion">Formaciones</a>
            <?php endif; ?>
            <a class="btn btn-primary" style="<?= h($encounterPrimaryActionStyle) ?>" href="finalizar_partido.php?match_id=<?= $latestId ?>">Cargar resultado</a>
          <?php elseif ($latestIsFinalized): ?>
            <a class="btn btn-muted" href="finalizar_partido.php?match_id=<?= $latestId ?>">Ver resultado</a>
          <?php endif; ?>
        </div>
      </article>
    <?php endif; ?>

    <div
      data-react-root
      data-react-island="encounter_history_controls"
      data-total="<?= h((string) $totalMatches) ?>"
      data-current-page="<?= h((string) $currentPage) ?>"
    ></div>
    <p class="small-muted encounter-history-empty" data-encounter-history-empty hidden>No hay fechas que coincidan con la busqueda.</p>
    <div class="encounter-card-grid" data-encounter-current-page="<?= h((string) $currentPage) ?>">
      <?php foreach ($matches as $matchIndex => $m): ?>
        <?php
          $canFinalize = (string) $m['status'] === 'sorteado';
          $isFinalized = (string) $m['status'] === 'finalizado';
          $isScheduled = (string) $m['status'] === 'programado';
          $canEditCaptainFormation = $canFinalize;
          $matchId = (int) $m['id'];
          $cardPage = intdiv($matchIndex, $matchesPerPage) + 1;
          $participantsCount = (int) $m['participants_count'];
          $ratingStatus = $historyRatingCounts[$matchId] ?? ['player_count' => $participantsCount, 'rated_count' => 0];
          $missingAwards = $isFinalized && (($historyAwardCounts[$matchId] ?? 0) === 0);
          $missingRating = $isFinalized && (int) $ratingStatus['player_count'] > 0 && (int) $ratingStatus['rated_count'] < (int) $ratingStatus['player_count'];
          $statusClass = $isFinalized ? 'done' : ($canFinalize ? 'ready' : 'warn');
          $historyTeams = $historyTeamsByMatch[$matchId] ?? [];
          $historyScoreboard = admin_render_match_scoreboard($m, $historyTeams, $historyCaptainNames);
          $matchCourt = $rentalCourtsById[(int) ($m['rental_court_id'] ?? 0)] ?? null;
          $matchCourtLabel = admin_rental_court_label($matchCourt);
          $historyCaptainSearch = [];
          foreach ($historyTeams as $historyTeam) {
              if (!empty($historyTeam['captain_player_id'])) {
                  $historyCaptainSearch[] = $historyCaptainNames[(int) $historyTeam['captain_player_id']] ?? '';
              }
          }
          $historySearchText = implode(' ', array_filter([
              (string) ($m['title'] ?: 'Fecha #' . $m['id']),
              (string) $m['id'],
              date('d/m/Y', strtotime((string) $m['match_date'])),
              date('Y-m-d', strtotime((string) $m['match_date'])),
              date('d/m/Y H:i', strtotime((string) $m['match_date'])),
              $matchCourtLabel,
              admin_match_status_label((string) $m['status']),
              implode(' ', $historyCaptainSearch),
              admin_history_match_score_line($m, $historyTeams, $historyCaptainNames),
          ]));
          $isFocusedMatch = $focusedMatchId === $matchId;
          $isLatestMatch = $latestMatch && (int) $latestMatch['id'] === $matchId;
          $isPageVisible = $cardPage === $currentPage;
        ?>
        <article
          class="encounter-card <?= $isPageVisible ? '' : 'encounter-page-hidden' ?> <?= $isFocusedMatch ? 'is-focused' : '' ?> <?= $isLatestMatch ? 'is-latest' : '' ?>"
          id="partido-admin-<?= $matchId ?>"
          tabindex="<?= $isFocusedMatch ? '0' : '-1' ?>"
          data-encounter-card
          data-focus-match="<?= $isFocusedMatch ? '1' : '0' ?>"
          data-page="<?= h((string) $cardPage) ?>"
          data-status="<?= h((string) $m['status']) ?>"
          data-search="<?= h(mb_strtolower($historySearchText, 'UTF-8')) ?>"
          style="<?= h($encounterCardStyle) ?>"
        >
          <div class="encounter-card-head">
            <div>
              <span class="encounter-date" style="<?= h($encounterDateStyle) ?>"><?= h(date('d/m/Y H:00', strtotime((string) $m['match_date']))) ?></span>
              <h4 style="<?= h($encounterTitleStyle) ?>"><?= h((string) ($m['title'] ?: ('Fecha #' . $m['id']))) ?></h4>
            </div>
          </div>

          <div class="encounter-card-score">
            <?php if ($historyScoreboard !== ''): ?>
              <?= $historyScoreboard ?>
            <?php else: ?>
              <span class="encounter-score-empty" style="<?= h($encounterBadgeStyle) ?>">Sin resultado</span>
            <?php endif; ?>
          </div>

          <div class="encounter-card-status-group">
            <span class="badge encounter-card-status <?= h($statusClass) ?>" style="<?= h($encounterBadgeStyle) ?>"><?= h(admin_match_status_label((string) $m['status'])) ?></span>
            <span class="badge encounter-court-badge" style="<?= h($encounterBadgeStyle) ?>">Cancha: <?= h($matchCourtLabel) ?></span>
            <?php if ($missingAwards): ?><span class="badge pending" style="<?= h($encounterBadgeStyle) ?>">Sin premios</span><?php endif; ?>
            <?php if ($missingRating): ?><span class="badge pending" style="<?= h($encounterBadgeStyle) ?>">Sin puntaje</span><?php endif; ?>
          </div>

          <div class="encounter-state-note" style="<?= h($encounterNoteStyle) ?>">
            <?php if ($isScheduled): ?>
              Listo para editar, sortear o iniciar modo capitanes.
            <?php elseif ($canFinalize): ?>
              Equipos generados. Solo resta finalizar la fecha.
            <?php else: ?>
              Fecha cerrada. Resultado y detalle disponibles.
            <?php endif; ?>
          </div>

          <div class="encounter-actions" style="<?= h($encounterActionsStyle) ?>">
            <?php if ($isScheduled): ?>
              <a class="btn btn-muted icon-pencil encounter-icon-action" data-short="" href="<?= h($matchFormPage) ?>?edit=<?= $matchId ?>" aria-label="Editar fecha" title="Editar"></a>
              <a class="btn btn-warning icon-dice" data-short="" href="sorteo_legacy_csv.php?match_id=<?= $matchId ?>">Sortear</a>
              <a class="btn btn-warning icon-dice" data-short="" href="sorteo_multiple.php?match_id=<?= $matchId ?>">Multiple</a>
              <a class="btn btn-primary icon-captain" style="<?= h($encounterPrimaryActionStyle) ?>" data-short="" href="capitanes.php?match_id=<?= $matchId ?>">Capitanes</a>
              <a class="btn btn-muted" data-short="" href="equipos_manual.php?match_id=<?= $matchId ?>">Manual</a>
            <?php else: ?>
              <span class="btn btn-disabled icon-pencil encounter-icon-action" data-short="" aria-label="Editar no disponible" title="Editar"></span>
              <span class="btn btn-disabled icon-dice" data-short=""><?= $canFinalize || $isFinalized ? 'Sorteado' : 'Sortear' ?></span>
              <?php if ($canEditCaptainFormation): ?>
                <a class="btn btn-muted icon-captain" data-short="" href="capitanes.php?match_id=<?= $matchId ?>#formacion">Formaciones</a>
              <?php else: ?>
                <span class="btn btn-disabled icon-captain" data-short="">Capitanes</span>
              <?php endif; ?>
            <?php endif; ?>

            <?php if ($canFinalize): ?>
              <a class="btn btn-primary icon-finish" style="<?= h($encounterPrimaryActionStyle) ?>" data-short="" href="finalizar_partido.php?match_id=<?= $matchId ?>">Finalizar</a>
            <?php elseif ($isFinalized): ?>
              <a class="btn btn-muted" data-short="V" href="finalizar_partido.php?match_id=<?= $matchId ?>" title="Ver resultado">Ver</a>
            <?php else: ?>
              <span class="btn btn-disabled icon-finish" data-short="" title="Primero hay que generar equipos por sorteo o capitanes">Finalizar</span>
            <?php endif; ?>

            <?php if ($isScheduled): ?>
              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger encounter-delete-action" data-short="X" data-confirm="Eliminar fecha y sus datos?" aria-label="Eliminar fecha" title="Eliminar">X</button>
              </form>
            <?php else: ?>
              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger encounter-delete-action" data-short="X" data-confirm="Eliminar esta fecha? Se borraran convocados, equipos, capitanes, puntajes, goles y premios asociados." aria-label="Eliminar fecha" title="Eliminar">X</button>
              </form>
            <?php endif; ?>
          </div>

          <details class="encounter-action-menu">
            <summary>Acciones</summary>
            <div class="encounter-action-menu-list">
              <?php if ($isScheduled): ?>
                <a class="btn btn-muted icon-pencil" data-short="" href="<?= h($matchFormPage) ?>?edit=<?= $matchId ?>">Editar fecha</a>
                <a class="btn btn-warning icon-dice" data-short="" href="sorteo_legacy_csv.php?match_id=<?= $matchId ?>">Sortear equipos</a>
                <a class="btn btn-warning icon-dice" data-short="" href="sorteo_multiple.php?match_id=<?= $matchId ?>">Sorteo multiple</a>
                <a class="btn btn-primary icon-captain" style="<?= h($encounterPrimaryActionStyle) ?>" data-short="" href="capitanes.php?match_id=<?= $matchId ?>">Modo capitanes</a>
                <a class="btn btn-muted" data-short="" href="equipos_manual.php?match_id=<?= $matchId ?>">Equipos manuales</a>
              <?php elseif ($canEditCaptainFormation): ?>
                <a class="btn btn-muted icon-captain" data-short="" href="capitanes.php?match_id=<?= $matchId ?>#formacion">Editar formaciones</a>
              <?php endif; ?>

              <?php if ($canFinalize): ?>
                <a class="btn btn-primary icon-finish" style="<?= h($encounterPrimaryActionStyle) ?>" data-short="" href="finalizar_partido.php?match_id=<?= $matchId ?>">Finalizar fecha</a>
              <?php elseif ($isFinalized): ?>
                <a class="btn btn-muted" data-short="" href="finalizar_partido.php?match_id=<?= $matchId ?>">Ver resultado</a>
              <?php endif; ?>

              <form method="post">
                <input type="hidden" name="action" value="delete_match">
                <input type="hidden" name="id" value="<?= $matchId ?>">
                <button class="btn btn-danger" data-short="" data-confirm="<?= $isScheduled ? 'Eliminar fecha y sus datos?' : 'Eliminar esta fecha? Se borraran convocados, equipos, capitanes, puntajes, goles y premios asociados.' ?>">Eliminar fecha</button>
              </form>
            </div>
          </details>
        </article>
      <?php endforeach; ?>
    </div>
    <?php if ($totalPages > 1): ?>
      <nav class="pagination" aria-label="Paginas de fechas">
        <?php if ($currentPage > 1): ?>
          <a class="pagination-link" href="<?= h($matchListPage) ?>?page=<?= $currentPage - 1 ?>">Anterior</a>
        <?php else: ?>
          <span class="pagination-link disabled">Anterior</span>
        <?php endif; ?>

        <?php for ($page = 1; $page <= $totalPages; $page++): ?>
          <?php if ($page === $currentPage): ?>
            <span class="pagination-link active"><?= $page ?></span>
          <?php else: ?>
            <a class="pagination-link" href="<?= h($matchListPage) ?>?page=<?= $page ?>"><?= $page ?></a>
          <?php endif; ?>
        <?php endfor; ?>

        <?php if ($currentPage < $totalPages): ?>
          <a class="pagination-link" href="<?= h($matchListPage) ?>?page=<?= $currentPage + 1 ?>">Siguiente</a>
        <?php else: ?>
          <span class="pagination-link disabled">Siguiente</span>
        <?php endif; ?>
      </nav>
    <?php endif; ?>
  <?php endif; ?>
</section>

<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>

