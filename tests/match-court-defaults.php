<?php
declare(strict_types=1);

// Exercise the real save handler's normalization without a database or creating dates.
function rental_court_by_id(int $id): array {
    return ['id' => $id, 'court_key' => 'Test', 'place' => 'Cancha', 'total_players' => 20];
}
function rental_court_next_datetime(array $court): DateTimeImmutable {
    throw new RuntimeException('Saving must not recalculate the chosen date from the court.');
}
function match_valuation_default_mode(): string { return 'both'; }
function normalize_match_valuation_mode(mixed $mode): string { return (string) $mode; }
function match_team_kits(array $match): array { return array_slice(['ROSA', 'AZUL', 'VERDE', 'NEGRO'], 0, $match['num_teams']); }
function match_validate_team_kits(array $kits, int $count): array {
    if (count($kits) !== $count) throw new RuntimeException('Incorrect team count for kits.');
    return $kits;
}

$source = file_get_contents(__DIR__ . '/../encuentros.php');
$start = strpos($source, "    if (\$action === 'save_match') {");
$start = strpos($source, "\n", $start) + 1;
$end = strpos($source, '        if ($participants) {', $start);
if ($end === false) throw new RuntimeException('Save handler not found.');
$handler = substr($source, $start, $end - $start);

foreach ([[3, 7], [2, 9], [4, 6]] as [$teams, $perTeam]) {
    $_POST = [
        'rental_court_id' => 1, 'match_date' => '2026-11-15T19:00',
        'num_teams' => $teams, 'players_per_team' => $perTeam,
        'participants' => range(1, $teams * $perTeam),
    ];
    $adminSettings = [];
    eval($handler);
    if ($numTeams !== $teams || $playersPerTeam !== $perTeam || $targetPlayers !== $teams * $perTeam) {
        throw new RuntimeException('Court defaults overwrote the requested team configuration.');
    }
    if ($matchDate !== $_POST['match_date']) throw new RuntimeException('Chosen date was overwritten.');
}
echo "Court defaults: 3x7, 2x9 and 4x6 preserve the chosen configuration and date. OK\n";
