<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/sorteo.php';
// Load only the API's real validation function, without executing request handling.
$api = str_replace("\r\n", "\n", file_get_contents(__DIR__ . '/../capitanes_api.php'));
preg_match('/function validate_captain_formation_line_counts\(array \$counts\): void\n\{.*?\n\}/s', $api, $match);
eval($match[0]);
$cases = [];
foreach (range(3, 9) as $size) {
    foreach (range(0, 2) as $keeper) {
        for ($def = 0; $def <= $size - $keeper; $def++) {
            for ($lat = 0; $lat <= $size - $keeper - $def; $lat++) {
                for ($med = 0; $med <= $size - $keeper - $def - $lat; $med++) {
                    $del = $size - $keeper - $def - $lat - $med;
                    $counts = ['ARQ' => $keeper, 'DEF' => $def, 'LAT' => $lat, 'MED' => $med, 'DEL' => $del];
                    $expected = $keeper === 1 && $def + $lat >= 2 && $med >= 1 && $del >= 1;
                    $valid = draw_line_counts_fit_limits($counts, $size);
                    try {
                        validate_captain_formation_line_counts($counts);
                        $captainValid = true;
                    } catch (RuntimeException) {
                        $captainValid = false;
                    }
                    if ($valid !== $expected || $captainValid !== $expected) {
                        throw new RuntimeException('Invalid small-team rule: ' . json_encode($counts));
                    }
                    $cases[] = ['size' => $size, 'counts' => $counts, 'valid' => $valid];
                }
            }
        }
    }
}
if (draw_pitch_line_minimum('MED', 8) !== 1 || draw_main_field_line_limit(8) !== 7) {
    throw new RuntimeException('Eight-player teams must require one midfielder.');
}
foreach (range(8, 11) as $size) {
    foreach ([
        ['ARQ'=>1,'DEF'=>2,'LAT'=>0,'MED'=>1,'DEL'=>$size-4],
        ['ARQ'=>1,'DEF'=>0,'LAT'=>2,'MED'=>1,'DEL'=>$size-4],
        ['ARQ'=>1,'DEF'=>1,'LAT'=>0,'MED'=>3,'DEL'=>$size-5],
    ] as $counts) {
        $pitch = draw_pitch_line_counts($counts);
        $expected = $pitch['DEF'] >= 2 && $pitch['MED'] >= 1 && $pitch['DEL'] >= 1
            && max($pitch['DEF'], $pitch['MED'], $pitch['DEL']) <= draw_main_field_line_limit($size);
        if (draw_line_counts_fit_limits($counts, $size) !== $expected) throw new RuntimeException('Large-team minimum mismatch');
        try { validate_captain_formation_line_counts($counts); $captainValid = true; }
        catch (RuntimeException) { $captainValid = false; }
        if ($captainValid !== ($pitch['DEF'] >= 2 && ($size < 10 || max($pitch['DEF'], $pitch['MED'], $pitch['DEL']) <= 4))) throw new RuntimeException('Captain defense minimum mismatch');
        $cases[] = ['size'=>$size, 'counts'=>$counts, 'valid'=>$expected];
    }
}
$roster = [['id' => 1, 'name' => 'Keeper', 'positions' => 'ARQ', 'skill' => 3.5]];
foreach (range(2, 10) as $id) {
    $roster[] = ['id' => $id, 'name' => 'Player ' . $id, 'positions' => $id <= 5 ? 'DEF' : 'DEL', 'skill' => $id <= 5 ? 2.0 : 4.0];
}
$prepared = prepare_emergency_goalkeepers($roster, 2);
foreach ($prepared as $player) {
    if (is_emergency_goalkeeper($player) && in_array('DEF', ordered_player_positions($player), true)) {
        throw new RuntimeException('Emergency goalkeeper selection must preserve the four required defenders.');
    }
}
foreach (range(5,7) as $size) {
    $teams = [];
    foreach (range(0,1) as $index) {
        $team = [['id'=>100+$index*20,'name'=>'Keeper','positions'=>'ARQ','skill'=>3.5]];
        foreach (range(1,$size-1) as $offset) $team[] = ['id'=>100+$index*20+$offset,'name'=>'Defender','positions'=>'DEF','skill'=>3.5];
        $teams[] = $team;
    }
    $assignments = array_map(static fn(array $team): array => build_team_position_assignment($team)['assignment'], $teams);
    if (!draw_assignments_respect_positions($teams,$assignments)) throw new RuntimeException('True roster shortages must permit the minimum adaptations.');
    foreach ($teams as $team) {
        $data = build_team_position_assignment($team);
        if (!$data['line_limit_ok'] || $data['line_counts']['MED'] !== 1 || $data['line_counts']['DEL'] !== 1) throw new RuntimeException('Every pitch line must be covered.');
    }
}
$teams = [];
foreach (range(0,1) as $index) {
    $team = [];
    foreach (['ARQ','DEF','DEF','MED/DEL','DEL'] as $offset=>$role) $team[] = ['id'=>300+$index*20+$offset,'name'=>'Natural','positions'=>$role,'skill'=>3.5];
    $teams[] = $team;
}
$assignments = array_map(static fn(array $team): array => build_team_position_assignment($team)['assignment'],$teams);
if (!draw_assignments_respect_positions($teams,$assignments)) throw new RuntimeException('Secondary positions must be preserved.');
$assignments[0][301] = 'MED'; $assignments[0][303] = 'DEF';
if (draw_assignments_respect_positions($teams,$assignments)) throw new RuntimeException('Unnecessary manual adaptations must be rejected.');
echo json_encode($cases, JSON_THROW_ON_ERROR);
