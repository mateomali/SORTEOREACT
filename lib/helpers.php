<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

function h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function redirect(string $url): void
{
    header('Location: ' . $url);
    exit;
}

function flash(string $type, string $message): void
{
    if (!isset($_SESSION['flash']) || !is_array($_SESSION['flash'])) {
        $_SESSION['flash'] = [];
    }
    $_SESSION['flash'][] = ['type' => $type, 'message' => $message];
}

function consume_flash(): array
{
    $messages = $_SESSION['flash'] ?? [];
    unset($_SESSION['flash']);
    return is_array($messages) ? $messages : [];
}

function is_admin(): bool
{
    return !empty($_SESSION['is_admin']);
}

function ensure_auth_schema(): void
{
    $pdo = db();
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS site_users (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(80) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            password_needs_reset TINYINT(1) NOT NULL DEFAULT 0,
            role ENUM('usuario', 'jugador', 'directivo', 'admin') NOT NULL DEFAULT 'usuario',
            player_id INT UNSIGNED NULL,
            can_vote TINYINT(1) NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_site_users_username (username),
            UNIQUE KEY uniq_site_users_player (player_id),
            INDEX idx_site_users_role (role),
            CONSTRAINT fk_site_users_player
              FOREIGN KEY (player_id) REFERENCES players(id)
              ON DELETE SET NULL ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    try {
        $pdo->exec("ALTER TABLE site_users MODIFY role ENUM('usuario', 'jugador', 'directivo', 'admin') NOT NULL DEFAULT 'usuario'");
    } catch (Throwable) {
        // Some local engines or older MySQL versions may not need this migration.
    }
    if (!schema_column_exists($pdo, 'site_users', 'can_vote')) {
        $pdo->exec("ALTER TABLE site_users ADD COLUMN can_vote TINYINT(1) NOT NULL DEFAULT 0 AFTER player_id");
    }
    if (!schema_column_exists($pdo, 'site_users', 'preferred_stats_court_id')) {
        $pdo->exec("ALTER TABLE site_users ADD COLUMN preferred_stats_court_id INT UNSIGNED NULL AFTER can_vote");
    }
    if (!schema_column_exists($pdo, 'site_users', 'password_needs_reset')) {
        $pdo->exec("ALTER TABLE site_users ADD COLUMN password_needs_reset TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash");
    }
}

function current_user_id(): int
{
    return (int) ($_SESSION['user_id'] ?? 0);
}

function current_player_id(): int
{
    return (int) ($_SESSION['player_id'] ?? 0);
}

function is_player_user(): bool
{
    return current_role() === 'jugador' && current_player_id() > 0;
}

function current_role(): string
{
    if (is_admin()) {
        return 'admin';
    }
    if (!empty($_SESSION['directivo_id'])) {
        return 'directivo';
    }
    if (!empty($_SESSION['user_id'])) {
        return (string) ($_SESSION['user_role'] ?? 'usuario');
    }
    return 'usuario';
}

function is_directivo(): bool
{
    return current_role() === 'directivo';
}

function current_directivo_id(): int
{
    return (int) ($_SESSION['directivo_id'] ?? 0);
}

function require_player_user(): void
{
    if (is_player_user()) {
        return;
    }

    $next = $_SERVER['REQUEST_URI'] ?? 'perfil.php';
    flash('error', 'Debes ingresar como jugador para acceder a esa seccion.');
    redirect('login.php?next=' . rawurlencode((string) $next));
}

function require_admin(): void
{
    if (is_admin()) {
        return;
    }

    $next = $_SERVER['REQUEST_URI'] ?? 'index.php';
    flash('error', 'Debes ingresar como admin para acceder a esa seccion.');
    redirect('login.php?next=' . rawurlencode((string) $next));
}

function require_directivo_or_admin(): void
{
    if (is_admin() || is_directivo()) {
        return;
    }

    $next = $_SERVER['REQUEST_URI'] ?? 'index.php';
    flash('error', 'Debes ingresar como directivo o admin para acceder a esa seccion.');
    redirect('login.php?next=' . rawurlencode((string) $next));
}

function normalize_ascii_token(string $value): string
{
    $value = trim($value);
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
        $ascii = preg_replace('/[^a-z0-9]+/', '', $ascii) ?? $ascii;
        $score = preg_match('/[\x{00C2}\x{00C3}\x{FFFD}]/u', $candidate) === 1 ? 10 : 0;
        $score += substr_count($ascii, '?');
        if ($ascii !== '' && $score < $bestScore) {
            $best = $ascii;
            $bestScore = $score;
        }
    }

    return $best;
}

function normalize_pace(string $pace): string
{
    $value = normalize_ascii_token($pace);
    if ($value === 'lento') {
        return 'lento';
    }
    if ($value === 'rapido') {
        return 'rapido';
    }
    return 'rapido';
}

function pace_label(string $pace): string
{
    return $pace === 'lento' ? 'Lento' : 'Rapido';
}

function skill_label(float $skill): string
{
    $formatted = number_format($skill, 1, '.', '');
    $formatted = rtrim(rtrim($formatted, '0'), '.');
    return $formatted . ' estrellas';
}

function match_status_label(string $status): string
{
    return match ($status) {
        'finalizado' => 'Finalizado',
        'sorteado' => 'Equipos formados',
        default => 'Programado',
    };
}

function player_stat_fields(): array
{
    return ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity', 'goalkeeper_skill'];
}

function player_field_stat_fields(): array
{
    return ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity'];
}

function player_field_stat_weights(?string $position = null): array
{
    return match (strtoupper((string) ($position ?? 'MED'))) {
        'DEF' => [
            'defense_physical' => 0.28,
            'rhythm' => 0.20,
            'technique' => 0.18,
            'teamwork' => 0.13,
            'mentality' => 0.13,
            'attack' => 0.08,
        ],
        'DEL' => [
            'attack' => 0.31,
            'rhythm' => 0.20,
            'technique' => 0.17,
            'teamwork' => 0.14,
            'mentality' => 0.10,
            'defense_physical' => 0.08,
        ],
        default => [
            'technique' => 0.24,
            'rhythm' => 0.23,
            'teamwork' => 0.19,
            'mentality' => 0.13,
            'defense_physical' => 0.12,
            'attack' => 0.09,
        ],
    };
}

function player_goalkeeper_stat_weights(): array
{
    return [
        'goalkeeper_skill' => 0.42,
        'defense_physical' => 0.14,
        'rhythm' => 0.10,
        'technique' => 0.10,
        'teamwork' => 0.14,
        'mentality' => 0.10,
    ];
}

function player_draw_balance_weights(): array
{
    return [
        'general' => 50.0,
        'attack' => 15.0,
        'defense_physical' => 15.0,
        'rhythm' => 18.0,
        'technique' => 5.0,
        'teamwork' => 8.0,
        'mentality' => 10.0,
        'regularity' => 5.0,
        'goalkeeper_skill' => 25.0,
    ];
}

function normalize_player_stat(float|string|int|null $value, float $fallback = 3.0): float
{
    if ($value === null || $value === '') {
        $value = $fallback;
    }
    $stat = (float) $value;
    return max(1.0, min(6.0, round($stat * 2) / 2));
}

function player_effective_stat(array $player, string $field): float
{
    $fallback = match ($field) {
        'technique', 'attack', 'teamwork', 'goalkeeper_skill' => (float) ($player['skill'] ?? 3.0),
        'mentality' => 3.0,
        'regularity' => 3.5,
        'rhythm' => (($player['pace'] ?? '') === 'lento') ? 2.0 : 4.0,
        'defense_physical' => 3.0,
        default => 3.0,
    };
    return normalize_player_stat($player[$field] ?? null, $fallback);
}

function player_has_goalkeeper_position(array $player): bool
{
    return player_primary_position($player) === 'ARQ';
}

function player_overall_rating(array $player): float
{
    $primaryPosition = player_primary_position($player);
    if ($primaryPosition === 'ARQ') {
        $total = 0.0;
        foreach (player_goalkeeper_stat_weights() as $field => $weight) {
            $total += player_effective_stat($player, $field) * $weight;
        }
        return round(player_apply_regularity_adjustment($total, $player), 1);
    }

    $total = 0.0;
    foreach (player_field_stat_weights($primaryPosition) as $field => $weight) {
        $total += player_effective_stat($player, $field) * $weight;
    }
    return round(player_apply_regularity_adjustment($total, $player), 1);
}

function player_apply_regularity_adjustment(float $baseRating, array $player): float
{
    $regularity = player_effective_stat($player, 'regularity');
    $factor = 1.0 + (($regularity - 3.5) / 50.0);
    return max(1.0, min(6.0, $baseRating * $factor));
}

function player_is_low_rhythm(array $player): bool
{
    return player_effective_stat($player, 'rhythm') <= 3.0;
}

function player_pace_from_rhythm(float $rhythm): string
{
    return normalize_player_stat($rhythm) <= 3.0 ? 'lento' : 'rapido';
}

function allowed_positions(): array
{
    return ['ARQ', 'DEF', 'MED', 'DEL'];
}

function parse_positions_csv(string $positions): array
{
    $parts = array_map('trim', explode('/', $positions));
    $parts = array_filter($parts, static fn($p) => $p !== '');
    $allowed = allowed_positions();
    $clean = [];
    foreach ($parts as $pos) {
        if (in_array($pos, $allowed, true) && !in_array($pos, $clean, true)) {
            $clean[] = $pos;
        }
    }
    return array_slice($clean, 0, 2);
}

function player_primary_position(array $player): string
{
    $positions = parse_positions_csv((string) ($player['positions'] ?? ''));
    return $positions[0] ?? 'MED';
}

function join_positions(array $positions): string
{
    $allowed = allowed_positions();
    $clean = [];
    foreach ($positions as $position) {
        $pos = strtoupper(trim((string) $position));
        if (in_array($pos, $allowed, true) && !in_array($pos, $clean, true)) {
            $clean[] = $pos;
        }
    }
    return implode('/', array_slice($clean, 0, 2));
}

function selected_attr(bool $condition): string
{
    return $condition ? 'selected' : '';
}

function checked_attr(bool $condition): string
{
    return $condition ? 'checked' : '';
}

function sort_positions_for_display(array $positions): array
{
    $order = array_flip(allowed_positions());
    usort($positions, static function (string $a, string $b) use ($order): int {
        return ($order[$a] ?? 99) <=> ($order[$b] ?? 99);
    });
    return $positions;
}


