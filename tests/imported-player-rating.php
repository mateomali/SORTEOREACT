<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/helpers.php';
$player = ['positions'=>'MED','skill'=>5.0,'technique'=>3.0,'pass_vision'=>3.0,'rhythm'=>3.0,'stamina'=>3.0,'defense_physical'=>3.0,'attack'=>3.0,'teamwork'=>3.0,'mentality'=>3.0,'regularity'=>3.5];
if (player_overall_rating($player)!==3.0) throw new RuntimeException('Ordinary ratings must keep the current calculation');
$player['preserve_stored_skill']=1;
if (player_overall_rating($player)!==5.0) throw new RuntimeException('Imported general must match the server');
if (player_position_rating($player,'MED')!==3.0) throw new RuntimeException('Positional scoring must remain available');
$player['pass_vision']=6.0;
if (player_overall_rating($player)!==5.0) throw new RuntimeException('Read operations must not overwrite imported general');
$player['skill']=player_position_rating($player,player_primary_position($player));
if (player_overall_rating($player)!==$player['skill']) throw new RuntimeException('Explicit valuations can update stored general');
echo "PASS: imported general is authoritative, ordinary and positional calculations remain available\n";
