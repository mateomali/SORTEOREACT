<?php
declare(strict_types=1);

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

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

function require_admin(): void
{
    if (is_admin()) {
        return;
    }

    $next = $_SERVER['REQUEST_URI'] ?? 'index.php';
    flash('error', 'Debes ingresar como admin para acceder a esa seccion.');
    redirect('login.php?next=' . rawurlencode((string) $next));
}

function normalize_pace(string $pace): string
{
    $value = strtolower(trim($pace));
    if ($value === 'lento') {
        return 'lento';
    }
    if ($value === 'rápido' || $value === 'rapido') {
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

function player_stat_fields(): array
{
    return ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'goalkeeper_skill'];
}

function player_field_stat_fields(): array
{
    return ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork'];
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
        'rhythm' => (($player['pace'] ?? '') === 'lento') ? 2.0 : 4.0,
        'defense_physical' => 3.0,
        default => 3.0,
    };
    return normalize_player_stat($player[$field] ?? null, $fallback);
}

function player_has_goalkeeper_position(array $player): bool
{
    return in_array('ARQ', parse_positions_csv((string) ($player['positions'] ?? '')), true);
}

function player_overall_rating(array $player): float
{
    $baseTotal = 0.0;
    foreach (player_field_stat_fields() as $field) {
        $baseTotal += player_effective_stat($player, $field);
    }

    if (player_has_goalkeeper_position($player)) {
        $baseTotal += player_effective_stat($player, 'goalkeeper_skill') * 2;
        return round($baseTotal / 7, 1);
    }

    return round($baseTotal / 5, 1);
}

function player_is_low_rhythm(array $player): bool
{
    return player_effective_stat($player, 'rhythm') <= 2.5;
}

function player_pace_from_rhythm(float $rhythm): string
{
    return normalize_player_stat($rhythm) <= 2.5 ? 'lento' : 'rapido';
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
    $ordered = [];
    foreach ($allowed as $pos) {
        if (in_array($pos, $parts, true)) {
            $ordered[] = $pos;
        }
    }
    return $ordered;
}

function join_positions(array $positions): string
{
    $allowed = allowed_positions();
    $clean = [];
    foreach ($allowed as $pos) {
        if (in_array($pos, $positions, true)) {
            $clean[] = $pos;
        }
    }
    return implode('/', $clean);
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
