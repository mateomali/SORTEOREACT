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
        'pass_vision' => $skill,
        'rhythm' => $skill,
        'stamina' => $skill,
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

$keeperRawOnly = test_player(50, 'Arquero Raw', 'ARQ', 3.0, [
    'goalkeeper_skill' => 5.0,
    'defense_physical' => 2.0,
    'rhythm' => 2.0,
    'technique' => 2.0,
    'teamwork' => 2.0,
    'mentality' => 2.0,
]);
$keeperComplete = test_player(51, 'Arquero Completo', 'ARQ', 3.0, [
    'goalkeeper_skill' => 5.0,
    'defense_physical' => 5.0,
    'rhythm' => 5.0,
    'technique' => 5.0,
    'teamwork' => 5.0,
    'mentality' => 5.0,
]);
assert_true(
    player_position_rating($keeperComplete, 'ARQ') > player_position_rating($keeperRawOnly, 'ARQ'),
    'El puntaje ARQ debe ponderar caracteristicas principales, no solo habilidad de arquero.'
);

$customWeights = player_normalize_position_stat_weights([
    'MED' => [
        'technique' => 0.75,
        'rhythm' => 0.25,
        'teamwork' => 0,
        'mentality' => 0,
        'stamina' => 0,
        'pass_vision' => 0,
        'defense_physical' => 0,
        'attack' => 0,
        'ignored_field' => 99,
    ],
    'BAD' => [
        'attack' => 1,
    ],
]);
assert_true(abs(array_sum($customWeights['MED']) - 1.0) < 0.001, 'Los pesos MED personalizados deben normalizar a 1.');
assert_true(abs($customWeights['MED']['technique'] - 0.75) < 0.001, 'La tecnica MED debe respetar el peso relativo personalizado.');
assert_true(!isset($customWeights['BAD']), 'Las posiciones no soportadas no deben persistir en pesos normalizados.');
foreach (player_position_stat_weight_defaults() as $position => $_weights) {
    assert_true(abs(array_sum($customWeights[$position]) - 1.0) < 0.001, "Los pesos {$position} deben sumar 1.");
}

$secondaryForward = test_player(80, 'Secundario', 'MED/DEL', 4.0);
$adaptedForward = test_player(81, 'Adaptado', 'DEF', 4.0);
assert_true(
    player_position_rating($secondaryForward, 'DEL', true) > player_position_rating($secondaryForward, 'DEL'),
    'En cancha chica no se debe bajar puntaje por posicion secundaria.'
);
assert_true(
    player_position_rating($adaptedForward, 'MED', true) > player_position_rating($adaptedForward, 'MED'),
    'En cancha chica no se debe bajar puntaje por adaptacion de linea.'
);

$threeTeamPlayers = [
    test_player(101, 'Arquero 1', 'ARQ', 4.4, ['goalkeeper_skill' => 5.2]),
    test_player(102, 'Arquero 2', 'ARQ', 4.2, ['goalkeeper_skill' => 5.1]),
    test_player(103, 'Arquero 3', 'ARQ', 4.1, ['goalkeeper_skill' => 5.0]),
];
for ($i = 0; $i < 3; $i++) {
    $base = 110 + ($i * 8);
    $threeTeamPlayers[] = test_player($base + 1, "LAT {$i}A", 'LAT', 4.0);
    $threeTeamPlayers[] = test_player($base + 2, "LAT {$i}B", 'LAT', 3.9);
    $threeTeamPlayers[] = test_player($base + 3, "DEF {$i}", 'DEF', 3.8);
    $threeTeamPlayers[] = test_player($base + 4, "MED {$i}A", 'MED', 4.0);
    $threeTeamPlayers[] = test_player($base + 5, "MED {$i}B", 'MED/DEL', 3.9);
    $threeTeamPlayers[] = test_player($base + 6, "DEL {$i}A", 'DEL', 4.0);
    $threeTeamPlayers[] = test_player($base + 7, "DEL {$i}B", 'DEL/MED', 3.8);
    $threeTeamPlayers[] = test_player($base + 8, "DEF {$i}B", 'DEF/LAT', 3.7);
}
$threeTeams = generate_valid_teams($threeTeamPlayers, 3, 6.0, 3000, 10);
assert_true(is_array($threeTeams), 'Debe generar equipos validos para 3 equipos.');
foreach ($threeTeams as $teamIndex => $team) {
    $lineCounts = $team['line_counts'] ?? [];
    assert_true(($lineCounts['ARQ'] ?? 0) === 1, "Equipo triple {$teamIndex} debe tener 1 arquero.");
    assert_true(($lineCounts['LAT'] ?? 0) >= 2, "Equipo triple {$teamIndex} debe tener 2 laterales.");
    assert_true(($lineCounts['DEF'] ?? 0) >= 1, "Equipo triple {$teamIndex} debe cubrir defensa.");
    assert_true(($lineCounts['MED'] ?? 0) >= 1, "Equipo triple {$teamIndex} debe cubrir medio.");
    assert_true(($lineCounts['DEL'] ?? 0) >= 1, "Equipo triple {$teamIndex} debe cubrir delantero.");
}

echo "OK sorteo rules\n";
