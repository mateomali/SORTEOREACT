<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/draw_pots.php';
$valid = [['name' => 'Pote 1', 'playerIds' => ['1', '2']], ['name' => 'Pote 2', 'playerIds' => [3]]];
if (draw_pots_validate_template($valid)[1]['playerIds'] !== ['3']) throw new RuntimeException('Normalize IDs');
foreach ([null, [['name'=>'', 'playerIds'=>[]]], [['name'=>'Pote','playerIds'=>['abc']]], [['name'=>'Pote','playerIds'=>['1','1']]], [['name'=>'Uno','playerIds'=>['1']],['name'=>'Dos','playerIds'=>['1']]]] as $invalid) {
    try { draw_pots_validate_template($invalid); } catch (InvalidArgumentException) { continue; }
    throw new RuntimeException('Invalid template accepted');
}
echo "PASS: pot template validation\n";
$players=[['id'=>1,'team_number'=>1],['id'=>2,'team_number'=>2],['id'=>3,'team_number'=>1],['id'=>4,'team_number'=>2]];
$pots=[['name'=>'Uno','playerIds'=>['1','2']],['name'=>'Dos','playerIds'=>['3','4']]];
if(!draw_pots_pairs_separated($players,[1=>2,2=>1],$pots))throw new RuntimeException('Same-pot exchange remains allowed');
if(draw_pots_pairs_separated($players,[1=>2,4=>1],$pots))throw new RuntimeException('Two-member pots must remain separated');
if(!draw_pots_pairs_separated($players,[1=>2,4=>1],[['name'=>'Todos','playerIds'=>['1','2','3','4']]]))throw new RuntimeException('Larger pots remain flexible');
echo "PASS: pair separation and flexibility for larger pots\n";
