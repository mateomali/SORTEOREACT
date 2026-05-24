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
                 goalkeeper_skill = :goalkeeper_skill, photo_path = :photo_path, active = :active
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
    if ($overall >= 90) {
        return 'elite';
    }
    if ($overall >= 80) {
        return 'gold';
    }
    if ($overall >= 65) {
        return 'silver';
    }
    return 'bronze';
}

function jugadores2_card_photo(array $player): string
{
    $photoPath = jugadores2_photo_public_path((string) ($player['photo_path'] ?? ''));
    if ($photoPath !== '') {
        return $photoPath;
    }
    return 'assets/players/default-player-silhouette.png';
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

function jugadores2_rating_tone(float $value): string
{
    if ($value >= 4.0) {
        return 'is-good';
    }
    if ($value < 3.0) {
        return 'is-weak';
    }
    return 'is-mid';
}

function jugadores2_top_stats(array $player, array $statLabels, array $statShortLabels, int $limit = 3): array
{
    $stats = [];
    foreach ($statLabels as $field => $label) {
        $value = player_effective_stat($player, (string) $field);
        if ($value <= 0) {
            continue;
        }
        $stats[] = [
            'field' => (string) $field,
            'label' => (string) $label,
            'short' => (string) ($statShortLabels[$field] ?? $label),
            'value' => $value,
        ];
    }
    usort($stats, static fn(array $a, array $b): int => $b['value'] <=> $a['value']);
    return array_slice($stats, 0, $limit);
}

function jugadores2_stat_bar(array $stat): string
{
    $value = (float) $stat['value'];
    $overall = shared_profile_player_fifa_overall($value);
    $percent = max(10, min(100, ($overall / 99) * 100));
    return '<div class="j2-stat-line">'
        . '<span>' . h((string) $stat['short']) . '</span>'
        . '<div class="j2-stat-track"><i class="' . h(jugadores2_rating_tone($value)) . '" style="width:' . h(number_format($percent, 2, '.', '')) . '%"></i></div>'
        . '<b>' . h((string) $overall) . '</b>'
        . '</div>';
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

function jugadores2_radar_point(float $centerX, float $centerY, float $radius, int $index, int $total): array
{
    $angle = (-90 + (360 / $total) * $index) * M_PI / 180;
    return [
        'x' => $centerX + cos($angle) * $radius,
        'y' => $centerY + sin($angle) * $radius,
    ];
}

function jugadores2_radar_svg(array $stats): string
{
    $visibleStats = array_values(array_filter(
        $stats,
        static fn(array $stat): bool => (float) $stat['value'] > 0
    ));
    if (count($visibleStats) < 3) {
        return '<div class="j2-radar-empty">Radar no disponible</div>';
    }

    $size = 260;
    $center = 130.0;
    $maxRadius = 86.0;
    $total = count($visibleStats);
    $polygonPoints = [];
    foreach ($visibleStats as $index => $stat) {
        $point = jugadores2_radar_point($center, $center, $maxRadius * ((float) $stat['value'] / 6), $index, $total);
        $polygonPoints[] = number_format($point['x'], 1, '.', '') . ',' . number_format($point['y'], 1, '.', '');
    }

    $html = '<svg class="j2-radar-svg" viewBox="0 0 ' . $size . ' ' . $size . '" role="img" aria-label="Radar de stats">';
    foreach ([0.25, 0.5, 0.75, 1.0] as $step) {
        $ring = [];
        foreach ($visibleStats as $index => $_stat) {
            $point = jugadores2_radar_point($center, $center, $maxRadius * $step, $index, $total);
            $ring[] = number_format($point['x'], 1, '.', '') . ',' . number_format($point['y'], 1, '.', '');
        }
        $html .= '<polygon class="j2-radar-ring" points="' . h(implode(' ', $ring)) . '"></polygon>';
    }
    foreach ($visibleStats as $index => $stat) {
        $axis = jugadores2_radar_point($center, $center, $maxRadius, $index, $total);
        $label = jugadores2_radar_point($center, $center, $maxRadius + 22, $index, $total);
        $html .= '<line class="j2-radar-axis" x1="' . $center . '" y1="' . $center . '" x2="' . h(number_format($axis['x'], 1, '.', '')) . '" y2="' . h(number_format($axis['y'], 1, '.', '')) . '"></line>';
        $html .= '<text class="j2-radar-label" x="' . h(number_format($label['x'], 1, '.', '')) . '" y="' . h(number_format($label['y'], 1, '.', '')) . '" text-anchor="middle">' . h((string) $stat['short']) . '</text>';
    }
    $html .= '<polygon class="j2-radar-shape" points="' . h(implode(' ', $polygonPoints)) . '"></polygon>';
    foreach ($visibleStats as $index => $stat) {
        $point = jugadores2_radar_point($center, $center, $maxRadius * ((float) $stat['value'] / 6), $index, $total);
        $html .= '<circle class="j2-radar-dot" cx="' . h(number_format($point['x'], 1, '.', '')) . '" cy="' . h(number_format($point['y'], 1, '.', '')) . '" r="3.8"><title>' . h((string) $stat['label'] . ' ' . number_format((float) $stat['value'], 1) . '/6') . '</title></circle>';
    }
    $html .= '</svg>';
    return $html;
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

function jugadores2_position_select(string $name, array $selectedPositions, int $index): string
{
    $labels = player_position_labels();
    $current = $selectedPositions[$index] ?? '';
    $required = $index === 0 ? ' required' : '';
    $html = '<select name="' . h($name) . '[]"' . $required . ' data-j2-position-select>';
    $html .= $index === 0 ? '<option value="" disabled>Elegir</option>' : '<option value="">Sin posicion</option>';
    foreach (allowed_positions() as $position) {
        $html .= '<option value="' . h($position) . '"' . selected_attr($current === $position) . '>' . h($labels[$position] ?? $position) . '</option>';
    }
    $html .= '</select>';
    return $html;
}

function jugadores2_admin_stat_control(string $field, float $value, array $statLabels, array $statHelp): string
{
    $rating = normalize_player_stat($value, $field === 'regularity' ? 3.5 : 3.0);
    $ratingLabel = number_format($rating, 1, '.', '');
    $ratingDisplay = rtrim(rtrim($ratingLabel, '0'), '.');
    $overall = shared_profile_player_fifa_overall($rating);
    $label = (string) ($statLabels[$field] ?? $field);
    $help = (string) ($statHelp[$field] ?? '');
    $percent = max(10, min(100, ($overall / 99) * 100));

    return '<label class="j2-edit-stat" data-j2-edit-stat="' . h($field) . '" data-j2-initial-overall="' . h((string) $overall) . '">'
        . '<span class="j2-edit-stat-info" role="button" tabindex="0" aria-expanded="false" data-j2-stat-info-toggle><b>' . h($label) . '</b><em>' . h($help) . '</em></span>'
        . '<input type="hidden" name="' . h($field) . '" value="' . h($ratingLabel) . '" data-j2-six-input>'
        . '<input class="j2-stat-number" type="number" name="' . h($field) . '_overall" min="35" max="99" step="1" inputmode="numeric" value="' . h((string) $overall) . '" data-j2-stat-overall-input aria-label="' . h($label . ' en escala 1 a 99') . '">'
        . '<button class="j2-stat-row-save" type="submit" data-j2-stat-row-save hidden aria-label="' . h('Guardar ' . $label) . '"></button>'
        . '<div class="j2-stat-range-wrap"><input class="j2-stat-range" type="range" min="35" max="99" step="1" value="' . h((string) $overall) . '" data-j2-stat-range aria-label="' . h('Ajustar ' . $label . ' en escala 1 a 99') . '"><i><u data-j2-stat-fill style="width:' . h(number_format($percent, 2, '.', '')) . '%"></u></i></div>'
        . '<small class="j2-stat-six" data-j2-stat-six hidden>' . h($ratingDisplay) . '/6</small>'
        . '</label>';
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
require __DIR__ . '/includes/header.php';
$cssVersion = (string) (@filemtime(__DIR__ . '/assets/jugadores2.css') ?: time());
$jsVersion = (string) (@filemtime(__DIR__ . '/assets/jugadores2.js') ?: time());
?>

<link rel="stylesheet" href="assets/jugadores2.css?v=<?= h($cssVersion) ?>">

<section class="j2-head">
  <div>
    <h1>Jugadores</h1>
    <p>Plantilla, posiciones y rendimiento actual.</p>
  </div>
  <div class="j2-summary" aria-label="Resumen de jugadores">
    <article><span>Activos</span><strong><?= h((string) $activeCount) ?></strong></article>
    <article><span>Promedio</span><strong><?= h((string) (int) round($averageRating)) ?></strong></article>
    <article><span>Top</span><strong><?= h((string) $topOverall) ?></strong></article>
  </div>
</section>

<section class="j2-controls" aria-label="Controles de jugadores">
  <div class="j2-search">
    <span class="j2-search-icon" aria-hidden="true"></span>
    <input id="j2Search" type="search" placeholder="Buscar jugador, posicion o stat" aria-label="Buscar jugador">
    <button class="j2-search-button" type="button" aria-label="Buscar"></button>
  </div>
  <div class="j2-filters" aria-label="Filtrar jugadores">
    <button class="is-selected" type="button" data-j2-filter="all">Todos</button>
    <button type="button" data-j2-filter="arq">Arq</button>
    <button type="button" data-j2-filter="def">Def</button>
    <button type="button" data-j2-filter="med">Med</button>
    <button type="button" data-j2-filter="del">Del</button>
    <button type="button" data-j2-sort="overall">Top</button>
  </div>
  <div class="j2-admin-links">
    <?php if ($isAdmin): ?>
      <a href="<?= $showInactive ? 'jugadores2.php' : 'jugadores2.php?show_inactive=1' ?>"><?= $showInactive ? 'Ver solo activos' : 'Ver inactivos' ?></a>
      <a href="jugadores.php<?= $showInactive ? '?show_inactive=1' : '' ?>">Backup jugadores</a>
    <?php else: ?>
      <a href="jugadores.php">Backup jugadores</a>
    <?php endif; ?>
  </div>
</section>

<p class="j2-empty" data-j2-empty hidden>No hay jugadores que coincidan con la busqueda.</p>

<section class="j2-mobile-list" data-j2-mobile-list aria-label="Tarjetas de jugadores">
  <?php foreach ($players as $player): ?>
    <?php
      $id = (int) $player['id'];
      $name = (string) $player['name'];
      $positions = (string) $player['positions'];
      $positionList = parse_positions_csv($positions);
      $primaryPosition = $positionList[0] ?? 'MED';
      $secondaryPosition = $positionList[1] ?? '';
      $rating = player_overall_rating($player);
      $overall = shared_profile_player_fifa_overall($rating);
      $group = jugadores2_position_group($positions);
      $search = strtolower(trim($name . ' ' . $positions . ' ' . number_format($rating, 1) . ' ' . $overall . ' ' . implode(' ', array_values($statLabels))));
      $cardStats = $primaryPosition === 'ARQ'
          ? [
              'ARQ' => jugadores2_card_stat($player, 'goalkeeper_skill'),
              'RIT' => jugadores2_card_stat($player, 'rhythm'),
              'DEF' => jugadores2_card_stat($player, 'defense_physical'),
              'TEC' => jugadores2_card_stat($player, 'technique'),
              'EQU' => jugadores2_card_stat($player, 'teamwork'),
              'MEN' => jugadores2_card_stat($player, 'mentality'),
          ]
          : [
              'TEC' => jugadores2_card_stat($player, 'technique'),
              'RIT' => jugadores2_card_stat($player, 'rhythm'),
              'DEF' => jugadores2_card_stat($player, 'defense_physical'),
              'ATA' => jugadores2_card_stat($player, 'attack'),
              'EQU' => jugadores2_card_stat($player, 'teamwork'),
              'MEN' => jugadores2_card_stat($player, 'mentality'),
          ];
      $tier = jugadores2_card_tier($overall);
      $cardPhoto = jugadores2_card_photo($player);
      $hasCustomPhoto = jugadores2_has_player_photo($player);
      $isActive = (int) ($player['active'] ?? 0) === 1;
      [$regularityForm, $regularityLabel] = jugadores2_regularidad_form(player_effective_stat($player, 'regularity'));
    ?>
    <article
      class="j2-player-card j2-card-shell"
      data-j2-player
      data-j2-id="<?= h((string) $id) ?>"
      data-j2-search="<?= h($search) ?>"
      data-j2-group="<?= h($group) ?>"
      data-j2-overall="<?= h((string) $overall) ?>"
      data-j2-rating="<?= h(number_format($rating, 3, '.', '')) ?>"
    >
      <button class="j2-fut-card card-pro-relieve formation-player formation-card-sin-stat formation-card-tier-<?= h($tier) ?> tier-<?= h($tier) ?>" type="button" data-j2-open="<?= h((string) $id) ?>" aria-label="Ver ficha de <?= h($name) ?>">
        <span class="player-card-rating" title="Puntaje general">
          <strong><?= h((string) $overall) ?></strong>
          <span>GEN</span>
        </span>
        <span class="formation-card-photo<?= $hasCustomPhoto ? ' is-custom' : ' is-default' ?>" aria-hidden="true">
          <?php if ($cardPhoto !== ''): ?>
            <img src="<?= h($cardPhoto) ?>" alt="">
          <?php else: ?>
            <?= h(jugadores2_player_initials($name)) ?>
          <?php endif; ?>
        </span>
        <strong class="formation-player-name"><?= h($name) ?></strong>
        <span class="formation-player-meta formation-player-position formation-card-position<?= $secondaryPosition !== '' ? ' has-secondary' : '' ?>" title="<?= h($secondaryPosition !== '' ? ('Primaria: ' . $primaryPosition . ' · Secundaria: ' . $secondaryPosition) : ('Primaria: ' . $primaryPosition)) ?>"><?= h($primaryPosition) ?></span>
        <?php if ($secondaryPosition !== ''): ?>
          <span class="formation-card-secondary-position" title="<?= h('Secundaria: ' . $secondaryPosition) ?>"><?= h($secondaryPosition) ?></span>
        <?php endif; ?>
        <span class="formation-card-regularity is-<?= h($regularityForm) ?>" title="<?= h($regularityLabel) ?>" aria-label="<?= h($regularityLabel) ?>"></span>
        <span class="formation-card-stats" aria-label="Stats del jugador">
          <?php foreach ($cardStats as $label => $value): ?>
            <span class="formation-card-stat"><span><?= h($label) ?></span><strong><?= h((string) $value) ?></strong></span>
          <?php endforeach; ?>
        </span>
      </button>
    </article>
  <?php endforeach; ?>
</section>

<section class="j2-table-wrap" aria-label="Tabla de jugadores">
  <table class="j2-table">
    <thead>
      <tr>
        <th>Jugador</th>
        <th>Posicion</th>
        <th>Media</th>
        <th>Ficha</th>
      </tr>
    </thead>
    <tbody data-j2-table-body>
      <?php foreach ($players as $player): ?>
        <?php
          $id = (int) $player['id'];
          $name = (string) $player['name'];
          $positions = (string) $player['positions'];
          $positionList = parse_positions_csv($positions);
          $rating = player_overall_rating($player);
          $overall = shared_profile_player_fifa_overall($rating);
          $group = jugadores2_position_group($positions);
          $search = strtolower(trim($name . ' ' . $positions . ' ' . number_format($rating, 1) . ' ' . $overall . ' ' . implode(' ', array_values($statLabels))));
          $topStats = jugadores2_top_stats($player, $statLabels, $statShortLabels, 3);
        ?>
        <tr
          data-j2-player
          data-j2-id="<?= h((string) $id) ?>"
          data-j2-search="<?= h($search) ?>"
          data-j2-group="<?= h($group) ?>"
          data-j2-overall="<?= h((string) $overall) ?>"
          data-j2-rating="<?= h(number_format($rating, 3, '.', '')) ?>"
        >
          <td>
            <button class="j2-row-identity" type="button" data-j2-open="<?= h((string) $id) ?>">
              <span class="j2-avatar"><?= h(jugadores2_player_initials($name)) ?></span>
              <span>
                <strong><?= h($name) ?></strong>
                <small><?= (int) ($player['active'] ?? 0) === 1 ? 'Activo' : 'Inactivo' ?> · GEN <?= h((string) $overall) ?></small>
              </span>
            </button>
          </td>
          <td>
            <div class="j2-position-chips">
              <?php foreach ($positionList ?: ['Sin posicion'] as $position): ?>
                <span><?= h((string) $position) ?></span>
              <?php endforeach; ?>
            </div>
          </td>
          <td><span class="j2-overall"><b><?= h((string) $overall) ?></b><em>GEN</em></span></td>
          <td><button class="j2-table-action" type="button" data-j2-open="<?= h((string) $id) ?>">Ver ficha</button></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</section>

<div class="j2-modal-backdrop" data-j2-close hidden></div>
<?php foreach ($players as $player): ?>
  <?php
    $id = (int) $player['id'];
    $name = (string) $player['name'];
    $positions = (string) $player['positions'];
    $positionList = parse_positions_csv($positions);
    $rating = player_overall_rating($player);
    $overall = shared_profile_player_fifa_overall($rating);
    $topStats = jugadores2_top_stats($player, $statLabels, $statShortLabels, 2);
    $allStats = jugadores2_all_stats($player, $statLabels, $statShortLabels);
    [$bestStat, $weakStat] = jugadores2_best_and_weak_stats($allStats);
    $description = shared_profile_player_description($player, $statLabels);
    $cardPhoto = jugadores2_card_photo($player);
    $hasCustomPhoto = jugadores2_has_player_photo($player);
  ?>
  <section class="j2-player-modal" data-j2-modal="<?= h((string) $id) ?>" hidden>
    <div class="j2-modal-head">
      <div>
        <h2><?= h($name) ?></h2>
        <p><?= h($positions !== '' ? $positions : 'Sin posicion') ?> · <?= (int) ($player['active'] ?? 0) === 1 ? 'Activo' : 'Inactivo' ?></p>
      </div>
      <span class="j2-overall j2-modal-rating"><b><?= h((string) $overall) ?></b><em>GEN</em></span>
      <button class="j2-modal-close-icon" type="button" data-j2-close aria-label="Cerrar ficha"></button>
    </div>
    <div class="j2-modal-body">
      <?php if (!$isAdmin): ?>
      <div class="j2-profile-layout">
        <aside class="j2-profile-card" aria-label="Radar de <?= h($name) ?>">
          <?= jugadores2_radar_svg($allStats) ?>
        </aside>
        <div class="j2-profile-copy<?= $isAdmin ? ' j2-admin-readonly-summary' : '' ?>">
          <div class="j2-position-chips">
            <?php foreach ($positionList ?: ['Sin posicion'] as $position): ?>
              <span><?= h((string) $position) ?></span>
            <?php endforeach; ?>
          </div>
          <p class="j2-player-description"><?= h($description) ?></p>
          <div class="j2-modal-summary">
            <article><span>Promedio</span><strong><?= h((string) $overall) ?></strong></article>
            <article><span>Fuerte</span><strong><?= h((string) ($bestStat['label'] ?? '-')) ?></strong></article>
            <article><span>A cuidar</span><strong><?= h((string) ($weakStat['label'] ?? '-')) ?></strong></article>
          </div>
        </div>
      </div>
      <div class="j2-modal-stats">
        <?php foreach ($allStats as $stat): ?>
          <article class="j2-stat-card">
            <?= jugadores2_stat_bar($stat) ?>
            <p><?= h((string) ($statHelp[$stat['field']] ?? 'Sin descripcion disponible.')) ?></p>
          </article>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>
      <?php if ($isAdmin): ?>
        <form class="j2-admin-edit" method="post" enctype="multipart/form-data" data-j2-edit-form>
          <input type="hidden" name="action" value="save">
          <input type="hidden" name="id" value="<?= h((string) $id) ?>">
          <div class="j2-admin-edit-head">
            <strong>Editar jugador</strong>
          </div>
          <div class="j2-edit-grid">
            <label class="j2-edit-field">
              <span>Nombre</span>
              <input type="text" name="name" required value="<?= h($name) ?>">
            </label>
            <label class="j2-edit-field">
              <span>Primaria</span>
              <?= jugadores2_position_select('positions', $positionList, 0) ?>
            </label>
            <label class="j2-edit-field">
              <span>Secundaria</span>
              <?= jugadores2_position_select('positions', $positionList, 1) ?>
            </label>
            <label class="j2-edit-active">
              <input type="checkbox" name="active" value="1" <?= checked_attr((int) ($player['active'] ?? 0) === 1) ?>>
              <span>Activo</span>
            </label>
            <label class="j2-edit-photo">
              <span>Rostro</span>
              <span class="j2-upload-control">
                <input type="file" name="player_photo" accept="image/png,image/jpeg,image/webp" data-j2-photo-input>
                <span class="j2-upload-icon" aria-hidden="true"></span>
                <span class="j2-upload-copy">
                  <strong>Subir foto del jugador</strong>
                  <em data-j2-photo-filename><?= $hasCustomPhoto ? 'Foto actual cargada. Elegi otra para reemplazarla.' : 'JPG, PNG o WEBP hasta 3 MB' ?></em>
                </span>
                <span class="j2-upload-action"><?= $hasCustomPhoto ? 'Cambiar foto' : 'Elegir foto' ?></span>
              </span>
            </label>
          </div>
          <div class="j2-admin-context">
            <aside class="j2-profile-card" aria-label="Radar de <?= h($name) ?>">
              <?= jugadores2_radar_svg($allStats) ?>
            </aside>
            <aside class="j2-photo-preview" aria-label="Foto de <?= h($name) ?>">
              <span class="j2-photo-frame<?= $hasCustomPhoto ? ' is-custom' : ' is-default' ?>" data-j2-photo-preview>
                <img src="<?= h($cardPhoto) ?>" alt="">
              </span>
              <p><?= $hasCustomPhoto ? 'Foto cargada para la tarjeta.' : 'Sin foto cargada: se usa la silueta.' ?></p>
            </aside>
            <div class="j2-admin-story">
              <strong>Relato</strong>
              <p><?= h($description) ?></p>
              <div class="j2-modal-summary">
                <article><span>Promedio</span><strong><?= h((string) $overall) ?></strong></article>
                <article><span>Fuerte</span><strong><?= h((string) ($bestStat['label'] ?? '-')) ?></strong></article>
                <article><span>A cuidar</span><strong><?= h((string) ($weakStat['label'] ?? '-')) ?></strong></article>
              </div>
            </div>
          </div>
          <div class="j2-edit-stats">
            <?php foreach (['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity'] as $field): ?>
              <?= jugadores2_admin_stat_control($field, player_effective_stat($player, $field), $statLabels, $statHelp) ?>
            <?php endforeach; ?>
            <div data-j2-goalkeeper-row>
              <?= jugadores2_admin_stat_control('goalkeeper_skill', player_effective_stat($player, 'goalkeeper_skill'), $statLabels, $statHelp) ?>
            </div>
          </div>
          <div class="j2-admin-save-all">
            <button type="submit">Guardar todo</button>
          </div>
        </form>
      <?php endif; ?>
      <details class="j2-modal-help">
        <summary>Ver ayuda de stats</summary>
        <p>La ficha muestra el radar, la lectura general y la explicacion de cada stat. Esta pagina es experimental; la original sigue intacta.</p>
      </details>
      <button class="j2-close-button" type="button" data-j2-close>Cerrar</button>
    </div>
  </section>
<?php endforeach; ?>

<script src="assets/jugadores2.js?v=<?= h($jsVersion) ?>"></script>

<?php require __DIR__ . '/includes/footer.php'; ?>
