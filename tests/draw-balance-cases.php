<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/sorteo.php';

function test_player(int $id, string $name, string $positions, float $rating, string $pace = 'rapido'): array
{
    return [
        'id' => $id,
        'name' => $name,
        'positions' => $positions,
        'pace' => $pace,
        'skill' => $rating,
        'technique' => $rating,
        'pass_vision' => $rating,
        'rhythm' => $pace === 'lento' ? min($rating, 3.0) : max($rating, 4.0),
        'stamina' => $rating,
        'defense_physical' => $rating,
        'attack' => $rating,
        'teamwork' => $rating,
        'mentality' => $rating,
        'regularity' => 3.5,
        'goalkeeper_skill' => str_contains($positions, 'ARQ') ? $rating : null,
    ];
}

function flatten_draw_teams(array $decoratedTeams): array
{
    return array_map(static fn(array $team): array => $team['players'], $decoratedTeams);
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assert_formation_limits(array $players, bool $expected, string $message): void
{
    $assignment = build_team_position_assignment($players);
    assert_true((bool) $assignment['line_limit_ok'] === $expected, $message);
}

function draw_case_summary(string $caseName, array $teams, array $bands): string
{
    $plainTeams = flatten_draw_teams($teams);
    $totals = array_map(static fn(array $team): float => array_sum(array_map('player_overall_rating', $team)), $plainTeams);
    $lowCounts = draw_team_band_counts($plainTeams, $bands['low']);
    $highCounts = draw_team_band_counts($plainTeams, $bands['high']);
    return sprintf(
        "%s | totals=%s | low=%s | high=%s",
        $caseName,
        implode('/', array_map(static fn(float $v): string => number_format($v, 1, '.', ''), $totals)),
        implode('/', $lowCounts),
        implode('/', $highCounts)
    );
}

$cases = [
    'caso-12-convocados-3-flojos' => [
        test_player(1, 'MATI ARQ', 'ARQ', 3.0),
        test_player(2, 'GONZA', 'ARQ', 4.0),
        test_player(3, 'MARCELO', 'DEF', 1.5, 'lento'),
        test_player(4, 'GUILLE', 'DEF/ARQ', 1.0, 'lento'),
        test_player(5, 'CRISTIAN', 'DEL', 1.0, 'lento'),
        test_player(6, 'FRANQUITO', 'MED', 3.0),
        test_player(7, 'NICO', 'MED', 3.0),
        test_player(8, 'JAVI', 'DEF/LAT', 4.0),
        test_player(9, 'ALEJO', 'DEL', 4.0),
        test_player(10, 'AUGUSTO', 'MED', 5.0),
        test_player(11, 'BRIAN', 'DEL', 5.0),
        test_player(12, 'VIKINGO', 'LAT/MED', 5.5),
    ],
    'caso-csv-goodfellas-18-jugadores' => [
        test_player(1, 'MARCELO', 'DEF', 1.5, 'lento'),
        test_player(2, 'RODRI SUAREZ', 'DEF/ARQ', 2.5, 'lento'),
        test_player(3, 'ALEJO', 'DEL', 4.0),
        test_player(4, 'FRANQUITO', 'MED', 3.0),
        test_player(5, 'JAVI', 'DEF/LAT', 4.0),
        test_player(6, 'PELA', 'DEL', 4.5, 'lento'),
        test_player(7, 'CUERVO', 'MED/DEL', 5.0, 'lento'),
        test_player(8, 'NICO', 'MED', 3.0),
        test_player(9, 'AUGUSTO', 'MED', 5.0),
        test_player(10, 'BRIAN', 'DEL', 5.0),
        test_player(11, 'MANU', 'MED', 5.5),
        test_player(12, 'VIKINGO', 'LAT/MED', 5.5),
        test_player(13, 'ANIBAL', 'ARQ/DEL', 2.0, 'lento'),
        test_player(14, 'PABLO', 'DEF/LAT', 4.5),
        test_player(15, 'MAURI', 'DEL', 3.0, 'lento'),
        test_player(16, 'ALE CUERVO', 'DEF', 2.5),
        test_player(17, 'CESAR', 'DEF', 4.0, 'lento'),
        test_player(18, 'GONZA', 'ARQ', 4.0),
    ],
];

foreach ($cases as $caseName => $players) {
    mt_srand(1234);
    $teams = generate_valid_teams($players, 2, 4.0, 5000);
    assert_true($teams !== null, $caseName . ': no genero equipos validos');

    $plainTeams = flatten_draw_teams($teams);
    $bands = draw_player_band_ids($players);
    $lowSpread = draw_count_spread(draw_team_band_counts($plainTeams, $bands['low']));
    $highSpread = draw_count_spread(draw_team_band_counts($plainTeams, $bands['high']));
    $scoreSpread = max(array_map(static fn(array $team): float => array_sum(array_map('player_overall_rating', $team)), $plainTeams))
        - min(array_map(static fn(array $team): float => array_sum(array_map('player_overall_rating', $team)), $plainTeams));

    assert_true($lowSpread <= 1, $caseName . ': concentro demasiados jugadores flojos');
    assert_true($highSpread <= 1, $caseName . ': concentro demasiados jugadores top');
    assert_true($scoreSpread <= 4.0, $caseName . ': diferencia total fuera de rango');
    echo draw_case_summary($caseName, $teams, $bands) . PHP_EOL;
}

$ninePlayerValidSplit = [
    test_player(101, 'ARQ', 'ARQ', 4.0),
    test_player(102, 'DEF 1', 'DEF', 4.0),
    test_player(103, 'DEF 2', 'DEF', 4.0),
    test_player(104, 'LAT 1', 'LAT', 4.0),
    test_player(105, 'LAT 2', 'LAT', 4.0),
    test_player(106, 'MED 1', 'MED', 4.0),
    test_player(107, 'MED 2', 'MED', 4.0),
    test_player(108, 'DEL 1', 'DEL', 4.0),
    test_player(109, 'DEL 2', 'DEL', 4.0),
];

$ninePlayerTooManyForwards = [
    test_player(201, 'ARQ', 'ARQ', 4.0),
    test_player(202, 'DEF 1', 'DEF', 4.0),
    test_player(203, 'DEF 2', 'DEF', 4.0),
    test_player(204, 'LAT 1', 'LAT', 4.0),
    test_player(205, 'MED 1', 'MED', 4.0),
    test_player(206, 'DEL 1', 'DEL', 4.0),
    test_player(207, 'DEL 2', 'DEL', 4.0),
    test_player(208, 'DEL 3', 'DEL', 4.0),
    test_player(209, 'DEL 4', 'DEL', 4.0),
];

$ninePlayerTooManyDefenders = [
    test_player(301, 'ARQ', 'ARQ', 4.0),
    test_player(302, 'DEF 1', 'DEF', 4.0),
    test_player(303, 'DEF 2', 'DEF', 4.0),
    test_player(304, 'DEF 3', 'DEF', 4.0),
    test_player(305, 'LAT 1', 'LAT', 4.0),
    test_player(306, 'MED 1', 'MED', 4.0),
    test_player(307, 'MED 2', 'MED', 4.0),
    test_player(308, 'DEL 1', 'DEL', 4.0),
    test_player(309, 'DEL 2', 'DEL', 4.0),
];

assert_formation_limits($ninePlayerValidSplit, true, '9 jugadores: 2 DEF + 2 LAT debe ser valido');
assert_formation_limits($ninePlayerTooManyForwards, true, '9 jugadores: 4 DEL es valido si la asignacion corrige el minimo de MED');
assert_formation_limits($ninePlayerTooManyDefenders, true, '9 jugadores: 4 DEF/LAT es valido porque el maximo combinado por linea es 4');

$unevenFloorTeams = [
    [
        test_player(401, 'FLOJO', 'MED', 1.0),
        test_player(402, 'TOP 1', 'MED', 5.0),
        test_player(403, 'TOP 2', 'DEL', 5.0),
        test_player(404, 'TOP 3', 'DEF', 5.0),
    ],
    [
        test_player(405, 'PAREJO 1', 'MED', 4.0),
        test_player(406, 'PAREJO 2', 'MED', 4.0),
        test_player(407, 'PAREJO 3', 'DEL', 4.0),
        test_player(408, 'PAREJO 4', 'DEF', 4.0),
    ],
];

assert_true(draw_team_floor_spread($unevenFloorTeams, 2) > 1.0, 'piso competitivo: debe detectar diferencia entre los 2 peores de cada equipo');
assert_true(draw_player_low_liability(test_player(501, 'CRISTIAN BAJO', 'DEL', 1.6)) > draw_player_low_liability(test_player(502, 'BAJO MODERADO', 'MED', 2.3)), 'bajo severo: 1.6 debe pesar mas que 2.3');
assert_true(draw_team_low_liability_spread($unevenFloorTeams) > 1.0, 'bajo severo: debe penalizar concentrar jugadores muy bajos');
