<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/player_profile_visual.php';
require_once __DIR__ . '/lib/awards.php';

ensure_control_schema();

$isAdmin = is_admin();
$showInactive = $isAdmin && (($_GET['show_inactive'] ?? $_POST['show_inactive'] ?? '') === '1');
if ($isAdmin && empty($_SESSION['jugadores2_delete_token'])) {
    $_SESSION['jugadores2_delete_token'] = bin2hex(random_bytes(32));
}

function jugadores2_normalize_player_name(string $name): string
{
    $name = trim(preg_replace('/\s+/', ' ', $name) ?? '');
    if (function_exists('mb_strtoupper')) {
        return mb_strtoupper($name, 'UTF-8');
    }
    return strtoupper($name);
}

function jugadores2_upload_dir(): string
{
    return __DIR__ . '/uploads/players';
}

function jugadores2_photo_public_path(string $path): string
{
    $path = trim(str_replace('\\', '/', $path));
    if ($path === '' || str_contains($path, '..') || !str_starts_with($path, 'uploads/players/')) {
        return '';
    }
    return $path;
}

function jugadores2_has_player_photo(array $player): bool
{
    return jugadores2_photo_public_path((string) ($player['photo_path'] ?? '')) !== '';
}

function jugadores2_photo_position_from_post(string $key, int $fallback): int
{
    $raw = $_POST[$key] ?? null;
    if ($raw === null || $raw === '' || !is_numeric($raw)) {
        return $fallback;
    }

    return max(0, min(100, (int) round((float) $raw)));
}

function jugadores2_photo_zoom_from_post(string $key, int $fallback): int
{
    $raw = $_POST[$key] ?? null;
    if ($raw === null || $raw === '' || !is_numeric($raw)) {
        return $fallback;
    }

    return max(50, min(180, (int) round((float) $raw)));
}

function jugadores2_delete_player_photo(string $path): void
{
    $publicPath = jugadores2_photo_public_path($path);
    if ($publicPath === '') {
        return;
    }

    $fullPath = __DIR__ . '/' . $publicPath;
    $uploadRoot = realpath(jugadores2_upload_dir());
    $resolved = realpath($fullPath);
    if ($uploadRoot !== false && $resolved !== false && str_starts_with($resolved, $uploadRoot) && is_file($resolved)) {
        @unlink($resolved);
    }
}

function jugadores2_uploaded_photo_path(array $file, int $playerId, string $previousPath): ?string
{
    $error = (int) ($file['error'] ?? UPLOAD_ERR_NO_FILE);
    if ($error === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($error !== UPLOAD_ERR_OK) {
        throw new RuntimeException('No se pudo subir la imagen del jugador.');
    }

    $tmpName = (string) ($file['tmp_name'] ?? '');
    if ($tmpName === '' || !is_uploaded_file($tmpName)) {
        throw new RuntimeException('La imagen subida no es valida.');
    }

    $maxBytes = 3 * 1024 * 1024;
    if ((int) ($file['size'] ?? 0) > $maxBytes) {
        throw new RuntimeException('La imagen no puede superar 3 MB.');
    }

    $mime = '';
    if (function_exists('finfo_open')) {
        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        if ($finfo !== false) {
            $mime = (string) finfo_file($finfo, $tmpName);
            finfo_close($finfo);
        }
    }
    if ($mime === '') {
        $imageInfo = @getimagesize($tmpName);
        $mime = is_array($imageInfo) ? (string) ($imageInfo['mime'] ?? '') : '';
    }

    $extensions = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];
    if (!isset($extensions[$mime])) {
        throw new RuntimeException('Usa una imagen JPG, PNG o WEBP.');
    }

    $dir = jugadores2_upload_dir();
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new RuntimeException('No se pudo crear la carpeta uploads/players.');
    }

    $filename = 'player-' . $playerId . '-' . bin2hex(random_bytes(8)) . '.' . $extensions[$mime];
    $target = $dir . '/' . $filename;
    if (!move_uploaded_file($tmpName, $target)) {
        throw new RuntimeException('No se pudo guardar la imagen del jugador.');
    }

    jugadores2_delete_player_photo($previousPath);
    return 'uploads/players/' . $filename;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$isAdmin) {
        flash('error', 'Solo un administrador puede modificar jugadores.');
        redirect('jugadores2.php');
    }

    $action = (string) ($_POST['action'] ?? '');
    $returnUrl = 'jugadores2.php' . ($showInactive ? '?show_inactive=1' : '');

    if ($action === 'remove_photo') {
        $token = $_POST['delete_token'] ?? '';
        if (!is_string($token) || !hash_equals((string) $_SESSION['jugadores2_delete_token'], $token)) {
            http_response_code(403);
            exit('Solicitud no valida. Recarga la pagina e intenta nuevamente.');
        }
        $id = (int) ($_POST['id'] ?? 0);
        if ($id <= 0 || !repo_player_by_id($id)) {
            flash('error', 'No se encontro el jugador.');
            redirect($returnUrl);
        }
        db()->prepare('UPDATE players SET photo_path = NULL, photo_position_x = 50, photo_position_y = 50, photo_zoom = 100 WHERE id = :id')->execute(['id' => $id]);
        flash('success', 'Foto quitada. El jugador vuelve a usar la imagen predeterminada.');
        redirect($returnUrl);
    }

    if ($action === 'delete') {
        $token = $_POST['delete_token'] ?? '';
        if (!is_string($token) || !hash_equals((string) $_SESSION['jugadores2_delete_token'], $token)) {
            http_response_code(403);
            exit('Solicitud no valida. Recarga la pagina e intenta nuevamente.');
        }
        $id = (int) ($_POST['id'] ?? 0);
        $player = $id > 0 ? repo_player_by_id($id) : null;
        if (!$player) {
            flash('error', 'No se encontro el jugador.');
            redirect($returnUrl);
        }
        try {
            // Never remove participation history, including schemas with cascading keys.
            $history = db()->prepare('SELECT 1 FROM match_players WHERE player_id = :id LIMIT 1');
            $history->execute(['id' => $id]);
            if ($history->fetchColumn()) {
                db()->prepare('UPDATE players SET active = 0 WHERE id = :id')->execute(['id' => $id]);
                flash('info', 'El jugador tiene historial. Se desactivo y se conservan sus partidos, premios y estadisticas.');
            } else {
                try {
                    db()->prepare('DELETE FROM players WHERE id = :id')->execute(['id' => $id]);
                    flash('success', 'Jugador eliminado correctamente.');
                } catch (PDOException $e) {
                    if ((string) $e->getCode() !== '23000') throw $e;
                    db()->prepare('UPDATE players SET active = 0 WHERE id = :id')->execute(['id' => $id]);
                    flash('info', 'El jugador tiene registros vinculados. Se desactivo para conservarlos.');
                }
            }
        } catch (Throwable $e) {
            error_log('jugadores2 delete failed: ' . $e->getMessage());
            flash('error', 'No se pudo eliminar el jugador. Intenta nuevamente.');
        }
        redirect($returnUrl);
    }

    if ($action === 'save') {
        $id = (int) ($_POST['id'] ?? 0);
        $existingPlayer = $id > 0 ? repo_player_by_id($id) : null;
        $name = jugadores2_normalize_player_name((string) ($_POST['name'] ?? ''));
        $positionsCsv = join_positions(array_map('strval', $_POST['positions'] ?? []));
        $active = isset($_POST['active']) ? 1 : 0;
        $photoPositionX = jugadores2_photo_position_from_post('photo_position_x', player_photo_position_x($existingPlayer ?? []));
        $photoPositionY = jugadores2_photo_position_from_post('photo_position_y', player_photo_position_y($existingPlayer ?? []));
        $photoZoom = jugadores2_photo_zoom_from_post('photo_zoom', player_photo_zoom($existingPlayer ?? []));

        if (($id > 0 && !$existingPlayer) || $name === '' || $positionsCsv === '') {
            flash('error', 'Nombre y posicion son obligatorios.');
            redirect($returnUrl);
        }

        $photoPath = jugadores2_photo_public_path((string) ($existingPlayer['photo_path'] ?? ''));

        $statFromPost = static function (string $field, float $fallback = 3.0): float {
            $overallKey = $field . '_overall';
            if (isset($_POST[$overallKey]) && $_POST[$overallKey] !== '') {
                return shared_profile_fifa_overall_to_rating($_POST[$overallKey]);
            }
            return normalize_player_stat($_POST[$field] ?? null, $fallback);
        };
        $technique = $statFromPost('technique');
        $passVision = $statFromPost('pass_vision', $technique);
        $rhythm = $statFromPost('rhythm');
        $stamina = $statFromPost('stamina', $rhythm);
        $defensePhysical = $statFromPost('defense_physical');
        $attack = $statFromPost('attack');
        $teamwork = $statFromPost('teamwork');
        $mentality = $statFromPost('mentality');
        $regularity = $statFromPost('regularity', 3.5);
        $goalkeeperSkill = str_contains($positionsCsv, 'ARQ')
            ? $statFromPost('goalkeeper_skill')
            : null;
        $ratingPlayer = [
            'positions' => $positionsCsv,
            'technique' => $technique,
            'pass_vision' => $passVision,
            'rhythm' => $rhythm,
            'stamina' => $stamina,
            'defense_physical' => $defensePhysical,
            'attack' => $attack,
            'teamwork' => $teamwork,
            'mentality' => $mentality,
            'regularity' => $regularity,
            'goalkeeper_skill' => $goalkeeperSkill,
        ];
        $skill = player_overall_rating($ratingPlayer);
        $pace = player_pace_from_rhythm($rhythm);

        $playerData = [
            'name' => $name,
            'positions' => $positionsCsv,
            'pace' => $pace,
            'skill' => $skill,
            'technique' => $technique,
            'pass_vision' => $passVision,
            'rhythm' => $rhythm,
            'stamina' => $stamina,
            'defense_physical' => $defensePhysical,
            'attack' => $attack,
            'teamwork' => $teamwork,
            'mentality' => $mentality,
            'regularity' => $regularity,
            'goalkeeper_skill' => $goalkeeperSkill,
            'photo_path' => $photoPath !== '' ? $photoPath : null,
            'photo_position_x' => $photoPositionX,
            'photo_position_y' => $photoPositionY,
            'photo_zoom' => $photoZoom,
            'active' => $active,
        ];

        $pdo = db();
        if ($id > 0) {
            try {
                if (isset($_FILES['player_photo']) && is_array($_FILES['player_photo'])) {
                    $uploadedPath = jugadores2_uploaded_photo_path($_FILES['player_photo'], $id, $photoPath);
                    if ($uploadedPath !== null) {
                        $photoPath = $uploadedPath;
                        $playerData['photo_path'] = $photoPath;
                    }
                }
            } catch (Throwable $e) {
                flash('error', $e->getMessage());
                redirect($returnUrl);
            }

            $stmt = $pdo->prepare(
                'UPDATE players
                 SET name = :name, positions = :positions, pace = :pace, skill = :skill,
                     technique = :technique, pass_vision = :pass_vision, rhythm = :rhythm, stamina = :stamina, defense_physical = :defense_physical,
                     attack = :attack, teamwork = :teamwork, mentality = :mentality, regularity = :regularity,
                     goalkeeper_skill = :goalkeeper_skill, photo_path = :photo_path,
                     photo_position_x = :photo_position_x, photo_position_y = :photo_position_y, photo_zoom = :photo_zoom,
                     active = :active
                 WHERE id = :id'
            );
            $stmt->execute(['id' => $id] + $playerData);
            flash('success', 'Jugador actualizado desde jugadores2.');
        } else {
            $stmt = $pdo->prepare(
                'INSERT INTO players
                   (name, positions, pace, skill, technique, pass_vision, rhythm, stamina, defense_physical, attack, teamwork, mentality, regularity, goalkeeper_skill, photo_path, photo_position_x, photo_position_y, photo_zoom, active)
                 VALUES
                   (:name, :positions, :pace, :skill, :technique, :pass_vision, :rhythm, :stamina, :defense_physical, :attack, :teamwork, :mentality, :regularity, :goalkeeper_skill, :photo_path, :photo_position_x, :photo_position_y, :photo_zoom, :active)'
            );
            $stmt->execute($playerData);
            $id = (int) $pdo->lastInsertId();

            try {
                if ($id > 0 && isset($_FILES['player_photo']) && is_array($_FILES['player_photo'])) {
                    $uploadedPath = jugadores2_uploaded_photo_path($_FILES['player_photo'], $id, '');
                    if ($uploadedPath !== null) {
                        $photoPath = $uploadedPath;
                        $updatePhoto = $pdo->prepare('UPDATE players SET photo_path = :photo_path WHERE id = :id');
                        $updatePhoto->execute(['photo_path' => $photoPath, 'id' => $id]);
                    }
                }
            } catch (Throwable $e) {
                flash('error', $e->getMessage());
                redirect($returnUrl);
            }

            flash('success', 'Jugador creado correctamente.');
        }
        redirect($returnUrl);
    }
}

$players = repo_all_players(!$isAdmin || !$showInactive);

$statLabels = shared_profile_stat_labels();
$statHelp = shared_profile_stat_help();

$statShortLabels = [
    'technique' => 'TEC',
    'pass_vision' => 'PAS',
    'rhythm' => 'VEL',
    'stamina' => 'IDV',
    'defense_physical' => 'SOL',
    'attack' => 'ATA',
    'teamwork' => 'EQU',
    'mentality' => 'MEN',
    'regularity' => 'REG',
    'goalkeeper_skill' => 'ARQ',
];

function jugadores2_position_group(string $positions): string
{
    $text = strtoupper($positions);
    if (str_contains($text, 'ARQ')) {
        return 'arq';
    }
    if (str_contains($text, 'DEF') || str_contains($text, 'LAT')) {
        return 'def';
    }
    if (str_contains($text, 'MED')) {
        return 'med';
    }
    if (str_contains($text, 'DEL')) {
        return 'del';
    }
    return 'otros';
}

function jugadores2_player_initials(string $name): string
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $letters = '';
    foreach (array_slice(array_filter($parts), 0, 2) as $part) {
        $letters .= strtoupper(substr($part, 0, 1));
    }
    return $letters !== '' ? $letters : 'J';
}

function jugadores2_card_stat(array $player, string $field): int
{
    return shared_profile_player_fifa_overall(player_effective_stat($player, $field));
}

function jugadores2_card_tier(int $overall): string
{
    if ($overall >= 88) {
        return 'supreme';
    }
    if ($overall >= 84) {
        return 'elite';
    }
    if ($overall >= 76) {
        return 'gold';
    }
    if ($overall >= 66) {
        return 'silver';
    }
    return 'bronze';
}

function jugadores2_position_ratings(array $player, array $positions): array
{
    $ratings = [];
    foreach ($positions as $position) {
        $ratings[] = [
            'position' => (string) $position,
            'overall' => shared_profile_player_fifa_overall(player_position_rating($player, (string) $position)),
        ];
    }
    return $ratings;
}

function jugadores2_card_photo(array $player): string
{
    return player_photo_path($player);
}

function jugadores2_edit_photo(array $player): string
{
    return player_photo_path($player);
}

function jugadores2_regularidad_form(float $value): array
{
    $rating = normalize_player_stat($value, 3.5);
    if ($rating >= 4.5) {
        return ['up', 'Regularidad alta'];
    }
    if ($rating < 3.0) {
        return ['down', 'Regularidad baja'];
    }
    return ['right', 'Regularidad normal'];
}

function jugadores2_all_stats(array $player, array $statLabels, array $statShortLabels): array
{
    $stats = [];
    foreach ($statLabels as $field => $label) {
        $stats[] = [
            'field' => (string) $field,
            'label' => (string) $label,
            'short' => (string) ($statShortLabels[$field] ?? $label),
            'value' => player_effective_stat($player, (string) $field),
        ];
    }
    return $stats;
}

function jugadores2_best_and_weak_stats(array $stats): array
{
    $usable = array_values(array_filter($stats, static fn(array $stat): bool => (float) $stat['value'] > 0));
    usort($usable, static fn(array $a, array $b): int => $b['value'] <=> $a['value']);
    $best = $usable[0] ?? null;
    usort($usable, static fn(array $a, array $b): int => $a['value'] <=> $b['value']);
    $weak = $usable[0] ?? null;
    return [$best, $weak];
}

$ratings = array_map(static fn(array $player): float => player_overall_rating($player), $players);
$overallRatings = array_map(static fn(float $rating): int => shared_profile_player_fifa_overall($rating), $ratings);
$activeCount = count(array_filter($players, static fn(array $player): bool => (int) ($player['active'] ?? 0) === 1));
$averageRating = count($overallRatings) > 0 ? array_sum($overallRatings) / count($overallRatings) : 0.0;
$topOverall = 0;
foreach ($overallRatings as $rating) {
    $topOverall = max($topOverall, $rating);
}

$title = 'Jugadores | ' . APP_NAME;
$activePage = 'jugadores2.php';
$bodyClass = 'page-jugadores2';
$headExtraHtml = '<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&display=swap" rel="stylesheet">';
$headExtraHtml .= '<link rel="stylesheet" href="assets/jugadores-directory.css?v=' . (string) filemtime(__DIR__ . '/assets/jugadores-directory.css') . '">';
$positionLabels = player_position_labels();
$positionsPayload = array_map(
    static fn(string $position): array => [
        'value' => $position,
        'label' => (string) ($positionLabels[$position] ?? $position),
    ],
    allowed_positions()
);
// Aggregate all players in one query; use match dates rather than award creation dates.
ensure_match_awards_schema();
$awardYear = (int) date('Y');
$awardStart = sprintf('%04d-01-01', $awardYear);
$awardEnd = sprintf('%04d-01-01', $awardYear + 1);
$awardDefinitions = award_definitions(true);
$awardDescriptions = award_descriptions();
$annualAwards = [];
$annualAwardStmt = db()->prepare("SELECT ma.player_id, ma.award_code, m.id AS match_id, m.title, m.match_date,
    CASE WHEN EXISTS (SELECT 1 FROM match_awards siblings WHERE siblings.match_id = ma.match_id AND siblings.award_code = ma.award_code AND siblings.player_id <> ma.player_id) THEN ma.award_position ELSE 0 END AS display_position,
    ma.award_position
    FROM match_awards ma INNER JOIN matches m ON m.id = ma.match_id
    WHERE m.status = 'finalizado' AND m.match_date >= :start AND m.match_date < :end
    ORDER BY ma.award_code, display_position, m.match_date DESC, m.id DESC");
$annualAwardStmt->execute(['start' => $awardStart, 'end' => $awardEnd]);
foreach ($annualAwardStmt->fetchAll() as $awardRow) {
    $code = (string) $awardRow['award_code'];
    if (!isset($awardDefinitions[$code])) continue;
    $playerId = (int) $awardRow['player_id'];
    $key = $code . ':' . (int) $awardRow['display_position'];
    if (!isset($annualAwards[$playerId][$key])) {
        $annualAwards[$playerId][$key] = $awardDefinitions[$code] + [
            'code' => $code, 'description' => $awardDescriptions[$code] ?? '',
            'position' => (int) $awardRow['display_position'], 'count' => 0, 'rankingPoints' => 0, 'matches' => [],
        ];
    }
    $annualAwards[$playerId][$key]['count']++;
    $annualAwards[$playerId][$key]['rankingPoints'] += award_max_recipients($code) > 1
        ? max(1, 4 - (int) $awardRow['award_position']) : 1;
    $annualAwards[$playerId][$key]['matches'][] = [
        'id' => (int) $awardRow['match_id'],
        'date' => substr((string) $awardRow['match_date'], 0, 10),
        'dateLabel' => date('d/m/Y', strtotime((string) $awardRow['match_date'])),
        'title' => trim((string) $awardRow['title']) ?: 'Fecha sin nombre',
        'position' => (int) $awardRow['display_position'],
        'awardedPosition' => (int) $awardRow['award_position'],
        'points' => award_max_recipients($code) > 1 ? max(1, 4 - (int) $awardRow['award_position']) : 1,
    ];
}
foreach (monthly_player_awards() as $monthlyAward) {
    if ($monthlyAward['month_start'] < $awardStart || $monthlyAward['month_start'] >= $awardEnd) continue;
    $annualAwards[(int) $monthlyAward['player_id']][] = monthly_player_award_definition() + [
        'code' => 'monthly', 'description' => $monthlyAward['tooltip'],
        'detail' => $monthlyAward['month_label'] . ' - ' . $monthlyAward['court_label'],
        'position' => 1, 'count' => 1,
        'matches' => [[
            'date' => substr($monthlyAward['month_start'], 0, 7),
            'dateLabel' => $monthlyAward['month_label'],
            'title' => 'Jugador del mes · ' . $monthlyAward['court_label'],
        ]],
    ];
}
// One ranking per category, combining all podium positions and all recipients.
$awardRankingCounts = [];
$awardRankingPoints = [];
$awardPlayerNames = [];
foreach (db()->query('SELECT id, name FROM players')->fetchAll() as $awardPlayer) {
    $awardPlayerNames[(int) $awardPlayer['id']] = (string) $awardPlayer['name'];
}
foreach ($annualAwards as $playerId => $playerAwards) {
    foreach ($playerAwards as $award) {
        $rankingKey = $award['code'];
        $awardRankingCounts[$rankingKey][$playerId] = ($awardRankingCounts[$rankingKey][$playerId] ?? 0) + $award['count'];
        $awardRankingPoints[$rankingKey][$playerId] = ($awardRankingPoints[$rankingKey][$playerId] ?? 0) + ($award['rankingPoints'] ?? $award['count']);
    }
}
foreach ($annualAwards as $playerId => &$playerAwards) {
    foreach ($playerAwards as &$award) {
        $counts = $awardRankingCounts[$award['code']];
        $points = $awardRankingPoints[$award['code']];
        $ownCount = $counts[$playerId];
        $sharedWith = [];
        foreach ($points as $otherId => $score) {
            if ($otherId !== $playerId && $score === $points[$playerId]) {
                $sharedWith[] = ['id' => (int) $otherId, 'name' => $awardPlayerNames[$otherId]];
            }
        }
        usort($sharedWith, static fn($a, $b) => strcasecmp($a['name'], $b['name']) ?: ($a['id'] <=> $b['id']));
        $award['ranking'] = [
            'position' => 1 + count(array_filter($points, static fn($score) => $score > $points[$playerId])),
            'totalPlayers' => count($counts),
            'count' => $ownCount,
            'totalAwards' => array_sum($counts),
            'points' => $points[$playerId],
            'usesPoints' => award_max_recipients($award['code']) > 1,
            'sharedWith' => $sharedWith,
        ];
    }
    unset($award);
}
unset($playerAwards);
$annualResultsStmt = db()->prepare("SELECT p.id, p.name,
    COUNT(DISTINCT mp.match_id) AS played, ROUND(AVG(mp.rating), 2) AS average,
    COALESCE(SUM(mp.goals), 0) AS goals,
    SUM(CASE WHEN mt.goals > opponent.goals THEN 1 ELSE 0 END) AS won,
    SUM(CASE WHEN mt.goals = opponent.goals THEN 1 ELSE 0 END) AS drawn,
    SUM(CASE WHEN mt.goals < opponent.goals THEN 1 ELSE 0 END) AS lost
    FROM match_players mp
    INNER JOIN players p ON p.id = mp.player_id
    INNER JOIN matches m ON m.id = mp.match_id AND m.status = 'finalizado'
    LEFT JOIN match_teams mt ON mt.match_id = mp.match_id AND mt.team_number = mp.team_number
    LEFT JOIN (
        SELECT own.match_id, own.team_number, MAX(other.goals) AS goals
        FROM match_teams own INNER JOIN match_teams other
          ON other.match_id = own.match_id AND other.team_number <> own.team_number
        GROUP BY own.match_id, own.team_number
    ) opponent ON opponent.match_id = mp.match_id AND opponent.team_number = mp.team_number
    WHERE m.match_date >= :start AND m.match_date < :end
    GROUP BY p.id, p.name");
$annualResultsStmt->execute(['start' => $awardStart, 'end' => $awardEnd]);
require_once __DIR__ . '/lib/goal_corrections.php';
$annualResultRows = apply_goal_corrections($annualResultsStmt->fetchAll(), 'goals', $awardYear, true);
$annualResults = [];
$annualRankRules = [
    'goals' => ['desc', ['played' => 'asc', 'average' => 'desc']],
    'played' => ['desc', ['average' => 'desc']],
    'won' => ['desc', ['played' => 'asc', 'average' => 'desc']],
    'drawn' => ['desc', ['played' => 'asc', 'average' => 'desc']],
    'lost' => ['asc', ['played' => 'desc', 'average' => 'desc']],
];
foreach ($annualResultRows as $row) {
    $annualResults[(int) $row['id']] = [
        'played' => (int) $row['played'], 'won' => (int) $row['won'],
        'drawn' => (int) $row['drawn'], 'lost' => (int) $row['lost'],
        'goals' => (int) $row['goals'],
        'totalPlayers' => count($annualResultRows), 'ranks' => [],
    ];
}
foreach ($annualRankRules as $metric => [$direction, $tieBreakers]) {
    $ranked = $metric === 'goals' ? $annualResultRows : array_values(array_filter($annualResultRows, static fn($row) => (int) $row['played'] > 0));
    usort($ranked, static function (array $a, array $b) use ($metric, $direction, $tieBreakers): int {
        foreach ([$metric => $direction] + $tieBreakers as $field => $order) {
            $comparison = (float) ($a[$field] ?? 0) <=> (float) ($b[$field] ?? 0);
            if ($comparison !== 0) return $order === 'desc' ? -$comparison : $comparison;
        }
        return strcasecmp((string) $a['name'], (string) $b['name']) ?: ((int) $a['id'] <=> (int) $b['id']);
    });
    foreach ($ranked as $index => $row) {
        $annualResults[(int) $row['id']]['ranks'][$metric] = $index + 1;
    }
}
$playersPayload = [];
foreach ($players as $player) {
    $id = (int) $player['id'];
    $name = (string) $player['name'];
    $positions = (string) $player['positions'];
    $positionList = parse_positions_csv($positions);
    $primaryPosition = $positionList[0] ?? 'MED';
    $secondaryPosition = $positionList[1] ?? '';
    $rating = player_overall_rating($player);
    $overall = shared_profile_player_fifa_overall($rating);
    $positionRatings = jugadores2_position_ratings($player, $positionList);
    $allStats = jugadores2_all_stats($player, $statLabels, $statShortLabels);
    $allStatsPayload = array_map(
        static fn(array $stat): array => [
            'field' => (string) $stat['field'],
            'label' => (string) $stat['label'],
            'short' => (string) $stat['short'],
            'value' => (float) $stat['value'],
            'overall' => shared_profile_player_fifa_overall((float) $stat['value']),
            'help' => (string) ($statHelp[$stat['field']] ?? 'Sin descripcion disponible.'),
        ],
        $allStats
    );
    [$bestStat, $weakStat] = jugadores2_best_and_weak_stats($allStats);
    $cardStats = $primaryPosition === 'ARQ'
        ? [
            ['label' => 'ARQ', 'value' => jugadores2_card_stat($player, 'goalkeeper_skill')],
            ['label' => 'VEL', 'value' => jugadores2_card_stat($player, 'rhythm')],
            ['label' => 'DEF', 'value' => jugadores2_card_stat($player, 'defense_physical')],
            ['label' => 'TEC', 'value' => jugadores2_card_stat($player, 'technique')],
            ['label' => 'EQU', 'value' => jugadores2_card_stat($player, 'teamwork')],
            ['label' => 'MEN', 'value' => jugadores2_card_stat($player, 'mentality')],
        ]
        : [
            ['label' => 'TEC', 'value' => jugadores2_card_stat($player, 'technique')],
            ['label' => 'VEL', 'value' => jugadores2_card_stat($player, 'rhythm')],
            ['label' => 'DEF', 'value' => jugadores2_card_stat($player, 'defense_physical')],
            ['label' => 'ATA', 'value' => jugadores2_card_stat($player, 'attack')],
            ['label' => 'EQU', 'value' => jugadores2_card_stat($player, 'teamwork')],
            ['label' => 'MEN', 'value' => jugadores2_card_stat($player, 'mentality')],
        ];
    [$regularityForm, $regularityLabel] = jugadores2_regularidad_form(player_effective_stat($player, 'regularity'));
    $playersPayload[] = [
        'id' => $id,
        'name' => $name,
        'initials' => jugadores2_player_initials($name),
        'positions' => $positionList,
        'positionRatings' => $positionRatings,
        'positionsText' => $positions,
        'primaryPosition' => $primaryPosition,
        'secondaryPosition' => $secondaryPosition,
        'group' => jugadores2_position_group($positions),
        'search' => strtolower(trim($name . ' ' . $positions . ' ' . number_format($rating, 1) . ' ' . $overall . ' ' . implode(' ', array_values($statLabels)) . ' ' . implode(' ', array_map(static fn(array $positionRating): string => $positionRating['position'] . ' ' . $positionRating['overall'], $positionRatings)))),
        'rating' => number_format($rating, 3, '.', ''),
        'overall' => $overall,
        'tier' => jugadores2_card_tier($overall),
        'photo' => jugadores2_card_photo($player),
        'photoEdit' => jugadores2_edit_photo($player),
        'hasCustomPhoto' => jugadores2_has_player_photo($player),
        'photoPositionX' => player_photo_position_x($player),
        'photoPositionY' => player_photo_position_y($player),
        'photoZoom' => player_photo_zoom($player),
        'isActive' => (int) ($player['active'] ?? 0) === 1,
        'regularityForm' => $regularityForm,
        'regularityLabel' => $regularityLabel,
        'cardStats' => $cardStats,
        'allStats' => $allStatsPayload,
        'bestStat' => $bestStat !== null ? ['label' => (string) $bestStat['label']] : null,
        'weakStat' => $weakStat !== null ? ['label' => (string) $weakStat['label']] : null,
        'description' => shared_profile_player_description($player, $statLabels),
        'awardYear' => $awardYear,
        'annualResults' => $annualResults[$id] ?? ['played' => 0, 'won' => 0, 'drawn' => 0, 'lost' => 0, 'goals' => 0, 'totalPlayers' => count($annualResultRows), 'ranks' => []],
        'annualAwards' => array_values($annualAwards[$id] ?? []),
    ];
}
$awardLeaderboards = [];
foreach ($awardRankingCounts as $code => $counts) {
    $entries = [];
    foreach ($counts as $playerId => $count) {
        $score = $awardRankingPoints[$code][$playerId];
        $awardHistory = [];
        foreach ($annualAwards[$playerId] as $playerAward) {
            if ($playerAward['code'] !== $code) continue;
            foreach ($playerAward['matches'] as $match) $awardHistory[] = $match + ['points' => 1];
        }
        usort($awardHistory, static fn($a, $b) => strcmp($b['date'], $a['date']) ?: (($b['id'] ?? 0) <=> ($a['id'] ?? 0)));
        $entries[] = ['id' => (int) $playerId, 'name' => $awardPlayerNames[$playerId],
            'count' => $count, 'points' => $score, 'matches' => $awardHistory,
            'position' => 1 + count(array_filter($awardRankingPoints[$code], static fn($other) => $other > $score))];
    }
    usort($entries, static fn($a, $b) => ($b['points'] <=> $a['points']) ?: strcasecmp($a['name'], $b['name']));
    $definition = $code === 'monthly' ? monthly_player_award_definition() : $awardDefinitions[$code];
    $awardLeaderboards[] = ['code' => $code, 'label' => $definition['label'], 'icon' => $definition['icon'],
        'description' => $code === 'monthly' ? monthly_player_award_description() : ($awardDescriptions[$code] ?? ''),
        'usesPoints' => award_max_recipients($code) > 1, 'entries' => $entries];
}
$annualScorers = array_values(array_filter($annualResultRows, static fn($row) => (int) $row['goals'] > 0));
usort($annualScorers, static fn($a, $b) => ((int) $b['goals'] <=> (int) $a['goals']) ?: strcasecmp($a['name'], $b['name']));
$scorerEntries = [];
foreach ($annualScorers as $row) {
    $scorerEntries[] = ['id' => (int) $row['id'], 'name' => $row['name'], 'goals' => (int) $row['goals'],
        'position' => 1 + count(array_filter($annualScorers, static fn($other) => (int) $other['goals'] > (int) $row['goals']))];
}
$jugadores2Payload = [
    'awardYear' => $awardYear,
    'awardLeaderboards' => $awardLeaderboards,
    'scorers' => $scorerEntries,
    'isAdmin' => $isAdmin,
    'deleteToken' => $isAdmin ? (string) $_SESSION['jugadores2_delete_token'] : '',
    'showInactive' => $showInactive,
    'summary' => [
        'active' => $activeCount,
        'average' => (int) round($averageRating),
        'top' => $topOverall,
    ],
    'links' => [
        'toggleInactive' => $isAdmin ? ($showInactive ? 'jugadores2.php' : 'jugadores2.php?show_inactive=1') : '',
        'backup' => 'jugadores.php' . ($showInactive ? '?show_inactive=1' : ''),
    ],
    'statLabels' => $statLabels,
    'statHelp' => $statHelp,
    'createOpen' => $isAdmin && (($_GET['create'] ?? '') === '1'),
    'positions' => $positionsPayload,
    'players' => $playersPayload,
];
$jugadores2PayloadJson = json_encode(
    $jugadores2Payload,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_HEX_AMP
);
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="jugadores2_page" data-payload="<?= h($jugadores2PayloadJson !== false ? $jugadores2PayloadJson : '{}') ?>"></div>
<noscript>
  <p class="border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">Esta pagina necesita JavaScript para renderizar la interfaz React.</p>
</noscript>

<?php require __DIR__ . '/includes/footer.php'; return; ?>
