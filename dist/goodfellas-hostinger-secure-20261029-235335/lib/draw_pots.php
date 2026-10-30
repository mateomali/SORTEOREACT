<?php
declare(strict_types=1);

function ensure_draw_pots_schema(): void
{
    if (!schema_column_exists(db(), 'matches', 'draw_invitation_token')) {
        db()->exec('ALTER TABLE matches ADD COLUMN draw_invitation_token VARCHAR(64) NULL');
    }
    if (!schema_column_exists(db(), 'matches', 'draw_preparation_json')) {
        db()->exec('ALTER TABLE matches ADD COLUMN draw_preparation_json TEXT NULL');
    }
    if (!schema_column_exists(db(), 'matches', 'draw_pots_json')) {
        db()->exec('ALTER TABLE matches ADD COLUMN draw_pots_json TEXT NULL');
    }
}

// Reusable membership template. Only players attending a draw take part in it.
function draw_pots_template(): array
{
    $stmt = db()->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ?');
    $stmt->execute(['draw_pots_template']);
    $value = json_decode((string) ($stmt->fetchColumn() ?: '[]'), true);
    return is_array($value) ? $value : [];
}

function draw_pots_csrf(): string
{
    if (empty($_SESSION['draw_pots_csrf'])) $_SESSION['draw_pots_csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['draw_pots_csrf'];
}

function draw_pots_validate_template($raw): array
{
    if (!is_array($raw) || array_values($raw) !== $raw || count($raw) > 100) {
        throw new InvalidArgumentException('La lista de potes no es válida (máximo 100).');
    }
    $seen = [];
    $result = [];
    foreach ($raw as $index => $pot) {
        if (!is_array($pot) || !is_array($pot['playerIds'] ?? null) || array_values($pot['playerIds']) !== $pot['playerIds']) {
            throw new InvalidArgumentException('Cada pote debe incluir una lista de jugadores.');
        }
        $name = trim((string) ($pot['name'] ?? ''));
        if ($name === '' || strlen($name) > 120) throw new InvalidArgumentException('Escribí un nombre de hasta 120 bytes para cada pote.');
        $ids = [];
        foreach ($pot['playerIds'] as $rawId) {
            if (!is_scalar($rawId) || !preg_match('/^[1-9][0-9]*$/', (string) $rawId)) {
                throw new InvalidArgumentException('Para guardar los potes usá jugadores registrados.');
            }
            $id = (int) $rawId;
            if (isset($seen[$id])) throw new InvalidArgumentException('Un jugador no puede estar en más de un pote.');
            $seen[$id] = true;
            $ids[] = (string) $id;
        }
        $result[] = ['name' => $name, 'playerIds' => $ids];
    }
    if (count($seen) > 1000) throw new InvalidArgumentException('La plantilla admite hasta 1000 jugadores.');
    return $result;
}

function draw_pots_pairs_separated(array $participants, array $teamAssignments, array $pots): bool
{
    $teams = [];
    foreach ($participants as $player) {
        $id = (int) $player['id'];
        $teams[$id] = (int) ($teamAssignments[$id] ?? $player['team_number'] ?? 0);
    }
    foreach ($pots as $pot) {
        $ids = array_values(array_filter(array_map('intval', $pot['playerIds']), static fn($id) => isset($teams[$id])));
        if (count($ids) === 2 && $teams[$ids[0]] > 0 && $teams[$ids[0]] === $teams[$ids[1]]) return false;
    }
    return true;
}
