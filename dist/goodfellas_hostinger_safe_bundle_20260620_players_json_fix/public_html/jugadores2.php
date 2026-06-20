<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/player_profile_visual.php';

ensure_control_schema();

$isAdmin = is_admin();
$showInactive = $isAdmin && (($_GET['show_inactive'] ?? '') === '1');

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

    if ($action === 'save') {
        $id = (int) ($_POST['id'] ?? 0);
        $existingPlayer = $id > 0 ? repo_player_by_id($id) : null;
        $name = jugadores2_normalize_player_name((string) ($_POST['name'] ?? ''));
        $positionsCsv = join_positions(array_map('strval', $_POST['positions'] ?? []));
        $active = isset($_POST['active']) ? 1 : 0;
        $photoPositionX = jugadores2_photo_position_from_post('photo_position_x', player_photo_position_x($existingPlayer ?? []));
        $photoPositionY = jugadores2_photo_position_from_post('photo_position_y', player_photo_position_y($existingPlayer ?? []));
        $photoZoom = jugadores2_photo_zoom_from_post('photo_zoom', player_photo_zoom($existingPlayer ?? []));

        if ($id <= 0 || !$existingPlayer || $name === '' || $positionsCsv === '') {
            flash('error', 'Nombre y posicion son obligatorios.');
            redirect($returnUrl);
        }

        $photoPath = jugadores2_photo_public_path((string) ($existingPlayer['photo_path'] ?? ''));
        try {
            if (isset($_FILES['player_photo']) && is_array($_FILES['player_photo'])) {
                $uploadedPath = jugadores2_uploaded_photo_path($_FILES['player_photo'], $id, $photoPath);
                if ($uploadedPath !== null) {
                    $photoPath = $uploadedPath;
                }
            }
        } catch (Throwable $e) {
            flash('error', $e->getMessage());
            redirect($returnUrl);
        }

        $statFromPost = static function (string $field, float $fallback = 3.0): float {
            $overallKey = $field . '_overall';
            if (isset($_POST[$overallKey]) && $_POST[$overallKey] !== '') {
                return shared_profile_fifa_overall_to_rating($_POST[$overallKey]);
            }
            return normalize_player_stat($_POST[$field] ?? null, $fallback);
        };
        $technique = $statFromPost('technique');
        $rhythm = $statFromPost('rhythm');
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
            'rhythm' => $rhythm,
            'defense_physical' => $defensePhysical,
            'attack' => $attack,
            'teamwork' => $teamwork,
            'mentality' => $mentality,
            'regularity' => $regularity,
            'goalkeeper_skill' => $goalkeeperSkill,
        ];
        $skill = player_overall_rating($ratingPlayer);
        $pace = player_pace_from_rhythm($rhythm);

        $stmt = db()->prepare(
            'UPDATE players
             SET name = :name, positions = :positions, pace = :pace, skill = :skill,
                 technique = :technique, rhythm = :rhythm, defense_physical = :defense_physical,
                 attack = :attack, teamwork = :teamwork, mentality = :mentality, regularity = :regularity,
                 goalkeeper_skill = :goalkeeper_skill, photo_path = :photo_path,
                 photo_position_x = :photo_position_x, photo_position_y = :photo_position_y, photo_zoom = :photo_zoom,
                 active = :active
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'name' => $name,
            'positions' => $positionsCsv,
            'pace' => $pace,
            'skill' => $skill,
            'technique' => $technique,
            'rhythm' => $rhythm,
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
        ]);
        flash('success', 'Jugador actualizado desde jugadores2.');
        redirect($returnUrl);
    }
}

$players = repo_all_players(!$isAdmin || !$showInactive);

$statLabels = shared_profile_stat_labels();
$statHelp = shared_profile_stat_help();

$statShortLabels = [
    'technique' => 'TEC',
    'rhythm' => 'RIT',
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
    $path = jugadores2_photo_public_path((string) ($player['photo_path'] ?? ''));
    return $path !== '' ? $path : jugadores2_card_photo($player);
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
$positionLabels = player_position_labels();
$positionsPayload = array_map(
    static fn(string $position): array => [
        'value' => $position,
        'label' => (string) ($positionLabels[$position] ?? $position),
    ],
    allowed_positions()
);
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
            ['label' => 'RIT', 'value' => jugadores2_card_stat($player, 'rhythm')],
            ['label' => 'DEF', 'value' => jugadores2_card_stat($player, 'defense_physical')],
            ['label' => 'TEC', 'value' => jugadores2_card_stat($player, 'technique')],
            ['label' => 'EQU', 'value' => jugadores2_card_stat($player, 'teamwork')],
            ['label' => 'MEN', 'value' => jugadores2_card_stat($player, 'mentality')],
        ]
        : [
            ['label' => 'TEC', 'value' => jugadores2_card_stat($player, 'technique')],
            ['label' => 'RIT', 'value' => jugadores2_card_stat($player, 'rhythm')],
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
    ];
}
$jugadores2Payload = [
    'isAdmin' => $isAdmin,
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
