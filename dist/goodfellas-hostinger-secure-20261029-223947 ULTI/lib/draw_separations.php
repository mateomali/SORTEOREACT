<?php
declare(strict_types=1);

function draw_separations_validate($raw): array
{
    if (!is_array($raw) || array_values($raw) !== $raw || count($raw) > 100) {
        throw new InvalidArgumentException('La lista de parejas a separar no es válida (máximo 100).');
    }
    $pairs = [];
    foreach ($raw as $pair) {
        if (!is_array($pair) || array_values($pair) !== $pair || (count($pair) < 2 || count($pair) > 4)) {
            throw new InvalidArgumentException('Cada separación debe contener entre dos y cuatro jugadores.');
        }
        foreach ($pair as $id) {
            if (!is_scalar($id) || !preg_match('/^[1-9][0-9]*$/', (string) $id)) {
                throw new InvalidArgumentException('Usá jugadores registrados para guardar separaciones.');
            }
        }
        $ids = array_map('strval', $pair);
        sort($ids, SORT_STRING);
        if (count(array_unique($ids)) !== count($ids)) throw new InvalidArgumentException('Elegí jugadores distintos.');
        $pairs[implode(':', $ids)] = $ids;
    }
    return array_values($pairs);
}

function draw_separations_from_match(array $match): array
{
    $audit = json_decode((string) ($match['draw_audit_snapshot'] ?? '{}'), true);
    return draw_separations_validate($audit['criteria']['separated_pairs'] ?? []);
}

function draw_separations_assert(array $pairs, array $teamsByPlayer): void
{
    foreach ($pairs as $group) {
        $seen = [];
        foreach ($group as $id) {
            $team = (int) ($teamsByPlayer[$id] ?? 0);
            if ($team <= 0) continue;
            if (isset($seen[$team])) {
                throw new InvalidArgumentException('Hay jugadores marcados para separar en el mismo equipo. Intercambiá un jugador o quitá esa regla.');
            }
            $seen[$team] = true;
        }
    }
}

function draw_separations_assert_registered(array $pairs): void
{
    $ids = array_values(array_unique(array_merge([], ...$pairs)));
    if (!$ids) return;
    $stmt = db()->prepare('SELECT COUNT(*) FROM players WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')');
    $stmt->execute($ids);
    if ((int) $stmt->fetchColumn() !== count($ids)) {
        throw new InvalidArgumentException('Hay jugadores que ya no están registrados. Revisá las parejas a separar.');
    }
}
