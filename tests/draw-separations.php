<?php
declare(strict_types=1);
require __DIR__ . '/../lib/draw_separations.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$pairs = draw_separations_validate([[1, 18], [18, 1]]);
check(count($pairs) === 1, 'Deduplicate pairs');
draw_separations_assert($pairs, [1 => 1, 18 => 2]);
draw_separations_assert($pairs, [1 => 1]);
try { draw_separations_assert($pairs, [1 => 1, 18 => 1]); throw new RuntimeException('Accepted conflict'); }
catch (InvalidArgumentException $expected) {}
foreach ([[[1,1]], [[0,18]], [['bad',18]], [[1]], 'bad'] as $invalid) {
    try { draw_separations_validate($invalid); throw new RuntimeException('Accepted malformed pair'); }
    catch (InvalidArgumentException $expected) {}
}
check(draw_separations_from_match(['draw_audit_snapshot' => json_encode(['criteria' => ['separated_pairs' => $pairs]])]) === $pairs, 'Persisted rule round trip');
echo "OK validated separation, missing player, conflicts and audit persistence\n";

foreach ([[1, 18, 20], [1, 18, 20, 25]] as $group) {
    $rules = draw_separations_validate([$group, array_reverse($group)]);
    check(count($rules) === 1, 'Deduplicate groups');
    draw_separations_assert($rules, [1 => 1, 18 => 2, 20 => 3, 25 => 4]);
    try { draw_separations_assert($rules, [18 => 2, 20 => 2]); throw new RuntimeException('Accepted group conflict'); }
    catch (InvalidArgumentException $expected) {}
}
