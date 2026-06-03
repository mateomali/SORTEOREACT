<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/sorteo.php';

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$message}\n");
        exit(1);
    }
}

function test_player(int $id, string $name, string $positions, float $skill, array $overrides = []): array
{
    return array_merge([
        'id' => $id,
        'name' => $name,
        'positions' => $positions,
        'pace' => 'rapido',
        'skill' => $skill,
        'technique' => $skill,
        'rhythm' => $skill,
        'defense_physical' => $skill,
        'attack' => $skill,
        'teamwork' => $skill,
        'mentality' => $skill,
        'regularity' => 4.0,
        'goalkeeper_skill' => $positions === 'ARQ' ? $skill : 2.0,
    ], $overrides);
}

$players = [
    test_player(1, 'Arquero A', 'ARQ', 4.4, ['goalkeeper_skill' => 5.2]),
    test_player(2, 'Arquero B', 'ARQ', 4.2, ['goalkeeper_skill' => 5.0]),
    test_player(3, 'Platinum A', 'MED', 5.8),
    test_player(4, 'Platinum B', 'DEL', 5.7),
    test_player(5, 'Lateral A', 'LAT', 4.0),
    test_player(6, 'Lateral B', 'LAT', 4.1),
    test_player(7, 'Lateral C', 'LAT', 4.2),
    test_player(8, 'Lateral D', 'LAT', 4.0),
    test_player(9, 'Def A', 'DEF', 3.9),
    test_player(10, 'Def B', 'DEF', 3.8),
    test_player(11, 'Def C', 'DEF', 3.7),
    test_player(12, 'Def D', 'DEF', 3.6),
    test_player(13, 'Med A', 'MED', 4.0),
    test_player(14, 'Med B', 'MED', 3.8),
    test_player(15, 'Med C', 'MED', 3.7),
    test_player(16, 'Del A', 'DEL', 4.0),
    test_player(17, 'Del B', 'DEL', 3.8),
    test_player(18, 'Del C', 'DEL', 3.7),
];

$teams = generate_valid_teams($players, 2, 6.0, 2000, 10);
assert_true(is_array($teams), 'generate_valid_teams debe devolver equipos validos.');
assert_true(count($teams) === 2, 'Debe generar 2 equipos.');

$platinumCounts = [];
foreach ($teams as $teamIndex => $team) {
    $playersInTeam = $team['players'] ?? [];
    $lineCounts = $team['line_counts'] ?? array_fill_keys(['ARQ', 'DEF', 'LAT', 'MED', 'DEL'], 0);
    assert_true(count($playersInTeam) === 9, "Equipo {$teamIndex} debe tener 9 jugadores.");
    assert_true($lineCounts['ARQ'] === 1, "Equipo {$teamIndex} debe tener 1 arquero.");
    assert_true($lineCounts['LAT'] >= 2, "Equipo {$teamIndex} debe tener al menos 2 laterales.");
    assert_true($lineCounts['DEF'] >= 1, "Equipo {$teamIndex} debe cubrir defensa.");
    assert_true($lineCounts['MED'] >= 1, "Equipo {$teamIndex} debe cubrir medio.");
    assert_true($lineCounts['DEL'] >= 1, "Equipo {$teamIndex} debe cubrir delantero.");
    $platinumCounts[] = count(array_filter($playersInTeam, 'draw_player_is_platinum'));
}

assert_true(max($platinumCounts) - min($platinumCounts) <= 1, 'Los platinum deben quedar repartidos equitativamente.');

echo "OK sorteo rules\n";
