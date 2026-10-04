<?php
declare(strict_types=1);
require __DIR__ . '/../lib/admin_config.php';
$courts = [
    ['id' => 5, 'weekday' => 5, 'time_value' => '21:00:00', 'active' => 1],
    ['id' => 1, 'weekday' => 1, 'time_value' => '21:00:00', 'active' => 1],
    ['id' => 9, 'weekday' => 2, 'time_value' => '10:00:00', 'active' => 0],
];
foreach ([['2026-10-04 12:00', 1], ['2026-10-06 12:00', 5], ['2026-10-05 20:00', 1], ['2026-10-05 22:00', 5], ['2026-10-09 22:00', 1]] as [$date, $expected]) {
    $actual = rental_court_next_available($courts, new DateTimeImmutable($date));
    if (($actual['id'] ?? null) !== $expected) throw new RuntimeException('Wrong default court for ' . $date);
}
if (rental_court_next_available([]) !== null) throw new RuntimeException('Empty courts should have no default');
if (rental_court_next_available([$courts[2]]) !== null) throw new RuntimeException('Inactive court selected');
echo "Next court checks passed.\n";
