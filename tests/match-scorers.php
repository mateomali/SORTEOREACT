<?php
declare(strict_types=1);
require __DIR__ . '/../lib/match_goals.php';
$players = [
    ['id' => 1, 'name' => 'Uno', 'team_number' => 1],
    ['id' => 2, 'name' => 'Dos', 'team_number' => 1],
    ['id' => 3, 'name' => 'Tres', 'team_number' => 2],
];
$valid = match_validate_scorers($players, [1 => 3, 2 => 1], [1 => 2, 2 => 1, 3 => 1]);
if ($valid !== [1 => 2, 2 => 1, 3 => 1]) throw new RuntimeException('Incorrect scorer values');
foreach ([[1 => 1, 2 => 1, 3 => 1], [1 => 4, 3 => 1], [1 => -1], [1 => '1.5'], []] as $invalid) {
    try {
        match_validate_scorers($players, [1 => 3, 2 => 1], $invalid);
    } catch (RuntimeException) {
        continue;
    }
    throw new RuntimeException('Invalid scorer input accepted');
}
match_validate_scorers($players, [1 => 0, 2 => 0], []);
echo "Scorer validation passed: matching scores, missing/excess goals, invalid numbers and 0-0.\n";
