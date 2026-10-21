<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/live_matches.php';
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function rejects(callable $fn, string $message): void { try { $fn(); } catch (RuntimeException $e) { return; } throw new RuntimeException($message); }

// Exhaust every win/loss path for three teams, every initial pair, and all 0-0 choices.
$paths = 0;
foreach (live_pairs([1, 2, 3]) as $first) {
    for ($mask = 0; $mask < 64; $mask++) {
        foreach (['scored', 'goalless'] as $mode) {
            $state = ['games' => [], 'duration' => 600, 'closed' => false];
            for ($i = 0; $i < 6; $i++) {
                $state = live_apply_action($state, 'next', ['teams' => $first], [1, 2, 3], []);
                $game = $state['games'][$i];
                foreach ($game['teams'] as $t) check(live_streak($state['games'], $t) <= 2, 'Three consecutive appearances');
                $winner = $game['teams'][($mask >> $i) & 1];
                if ($mode === 'scored') $state = live_apply_action($state, 'goal', ['team' => $winner], [1, 2, 3], []);
                $state = live_apply_action($state, 'finish', ['tie_choice' => $winner], [1, 2, 3], []);
            }
            foreach (live_pairs([1, 2, 3]) as $pair) check(count(array_filter($state['games'], static fn($g) => live_pair_key($g['teams']) === live_pair_key($pair))) === 2, 'Missing home/return pairing');
            rejects(fn() => live_apply_action($state, 'next', [], [1, 2, 3], []), 'Extra match requires explicit request');
            for ($i = 0; $i < 10; $i++) {
                $state = live_apply_action($state, 'next', ['extra' => true], [1, 2, 3], []);
                foreach ($state['games'][6 + $i]['teams'] as $t) check(live_streak($state['games'], $t) <= 2, 'Extra match violated rest');
                $state = live_apply_action($state, 'finish', ['tie_choice' => $state['games'][6 + $i]['teams'][0]], [1, 2, 3], []);
            }
            $paths++;
        }
    }
}
// Four teams: complement, random crossed winners/losers, remaining pairs, repeated return leg.
foreach (live_pairs([1, 2, 3, 4]) as $first) for ($trial = 0; $trial < 30; $trial++) {
    $state = ['games' => [], 'duration' => 600, 'closed' => false];
    for ($i = 0; $i < 15; $i++) {
        $state = live_apply_action($state, 'next', ['teams' => $first, 'extra' => true], [1, 2, 3, 4], []);
        $game = $state['games'][$i];
        if ($i === 1 || $i === 3 || $i === 5) check(!array_intersect($game['teams'], $state['games'][$i - 1]['teams']), 'Both teams must leave');
        if ($i === 2) {
            $a = live_winner($state['games'][0]); $b = live_winner($state['games'][1], false);
            check(in_array($a, $game['teams'], true) !== in_array($b, $game['teams'], true), 'Cross must be winner vs loser');
        }
        if ($i >= 6) check($game['teams'] === $state['games'][$i % 6]['teams'], 'Return and extras must follow the first sequence');
        $winner = $game['teams'][random_int(0, 1)];
        $state = live_apply_action($state, 'finish', ['tie_choice' => $winner], [1, 2, 3, 4], []);
    }
    foreach (live_pairs([1, 2, 3, 4]) as $pair) check(count(array_filter(array_slice($state['games'], 0, 12), static fn($g) => live_pair_key($g['teams']) === live_pair_key($pair))) === 2, 'Four-team missing pairing');
}
$players = [['id' => 10, 'team_number' => 1], ['id' => 20, 'team_number' => 2], ['id' => 30, 'team_number' => 3]];
$s = ['games' => [], 'duration' => 600, 'closed' => false];
$s = live_apply_action($s, 'next', ['teams' => [1, 2]], [1, 2, 3], $players, 1000);
$s = live_apply_action($s, 'start', [], [1, 2, 3], $players, 1000);
check(live_elapsed($s['games'][0], 1615) === 615.0, 'Overtime must continue');
rejects(fn() => live_apply_action($s, 'start', [], [1, 2, 3], $players, 1100), 'Duplicate start');
$s = live_apply_action($s, 'pause', [], [1, 2, 3], $players, 1615);
check(live_elapsed($s['games'][0], 3000) === 615.0, 'Pause must freeze time');
$s = live_apply_action($s, 'start', [], [1, 2, 3], $players, 3000);
check(live_elapsed($s['games'][0], 3010) === 625.0, 'Resume must preserve elapsed time');
rejects(fn() => live_apply_action($s, 'goal', ['team' => 1, 'player' => 20], [1, 2, 3], $players), 'Scorer from wrong team');
check(live_validate_goal(1, ['player' => 30, 'own' => true], $s['games'][0], $players)['player'] === null, 'Own goal does not require or retain a scorer');
$s = live_apply_action($s, 'goal', ['team' => 1, 'player' => 20, 'own' => true], [1, 2, 3], $players, 3010);
$s = live_apply_action($s, 'goal', ['team' => 2], [1, 2, 3], $players, 3011);
check(live_winner($s['games'][0]) === 1, 'First goal wins tied priority including own goal');
$s = live_apply_action($s, 'finish', [], [1, 2, 3], $players, 3012);
check($s['games'][0]['running_since'] === null && live_elapsed($s['games'][0], 4000) === 627.0, 'Finish stops clock');
$table = live_standings($s, [1, 2, 3]);
check($table[0]['points'] === 1 && $table[1]['points'] === 1, 'Tiebreak priority must not award a win');
$s = live_apply_action($s, 'edit_goal', ['game' => 0, 'goal' => 1, 'player' => 20], [1, 2, 3], $players);
check($s['games'][0]['goals'][1]['player'] === 20, 'Attribution after game');
$removed = live_apply_action($s, 'remove_goal', ['game' => 0, 'goal' => 0], [1, 2, 3], $players);
check(live_score($removed['games'][0]) === [1 => 0, 2 => 1], 'Remove saved goal updates finished score');
check($removed['games'][0]['status'] === 'finished', 'Correction keeps the match finished');
rejects(fn() => live_apply_action($removed, 'remove_goal', ['game' => 0, 'goal' => 0], [1, 2, 3], $players), 'Removing last goal requires tie priority');
$zero = live_apply_action($removed, 'remove_goal', ['game' => 0, 'goal' => 0, 'tie_choice' => 2], [1, 2, 3], $players);
check(live_winner($zero['games'][0]) === 2, 'Corrected 0-0 preserves chosen priority');
$next = live_apply_action($removed, 'next', [], [1, 2, 3], $players);
check(in_array(2, $next['games'][1]['teams'], true), 'Next pairing uses corrected winner');
rejects(fn() => live_apply_action($next, 'remove_goal', ['game' => 0, 'goal' => 0], [1, 2, 3], $players), 'Cannot remove old goal after preparing next match');
$s = live_apply_action($s, 'next', [], [1, 2, 3], $players);
rejects(fn() => live_apply_action($s, 'next', [], [1, 2, 3], $players), 'Cannot skip active match');
rejects(fn() => live_apply_action($s, 'close', [], [1, 2, 3], $players), 'Cannot close active match');
check(live_apply_action($s, 'finish', [], [1, 2, 3], $players)['games'][1]['status'] === 'finished', 'Later 0-0 finishes without priority');
$s = live_apply_action($s, 'set_score', ['scores' => array_fill_keys($s['games'][1]['teams'], 2)], [1, 2, 3], $players);
check(live_apply_action($s, 'finish', [], [1, 2, 3], $players)['games'][1]['status'] === 'finished', 'Later tied score finishes without first goal');
$s = live_apply_action($s, 'finish', ['tie_choice' => $s['games'][1]['teams'][0]], [1, 2, 3], $players);
$s = live_apply_action($s, 'close', [], [1, 2, 3], $players);
rejects(fn() => live_apply_action($s, 'next', [], [1, 2, 3], $players), 'Closed dates cannot add matches');
echo "OK: {$paths} exhaustive three-team paths, 180 four-team sequences, clocks, attribution and guards.\n";
