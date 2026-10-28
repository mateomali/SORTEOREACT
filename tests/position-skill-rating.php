<?php
declare(strict_types=1);
require __DIR__ . '/../lib/helpers.php';
$player = ['id'=>123, 'positions'=>'DEF/MED', 'skill'=>4, 'technique'=>2, 'pass_vision'=>2,
    'rhythm'=>3, 'stamina'=>4, 'defense_physical'=>6, 'attack'=>1, 'teamwork'=>4,
    'mentality'=>4, 'regularity'=>3.5, 'goalkeeper_skill'=>1];
$cases = [];
foreach (['legacy','general','penalty','skill'] as $mode) foreach ([true,false] as $discount) foreach (['ARQ','DEF','LAT','MED','DEL'] as $position) {
    $raw = $player + ['position_rating_mode'=>$mode,'position_rating_discount'=>$discount];
    $cases[] = ['player'=>$raw,'position'=>$position,'expected'=>player_position_rating($raw,$position)];
    if ($mode !== 'legacy') {
        $raw['rendimiento_historico_ajuste'] = 0.2;
        $cases[] = ['player'=>$raw,'position'=>$position,'expected'=>player_position_rating($raw,$position)];
    }
}
foreach ([1, 4, 6] as $level) {
    $raw = array_merge($player, array_fill_keys(['technique','pass_vision','rhythm','stamina','defense_physical','attack','teamwork','mentality','goalkeeper_skill'], $level), ['position_rating_mode'=>'penalty']);
    foreach (['DEF', 'MED', 'DEL'] as $position) {
        $cases[] = ['player'=>$raw,'position'=>$position,'expected'=>player_position_rating($raw,$position)];
        $expectedGen = (int) round([1=>60,4=>80,6=>99][$level] * ($position === 'DEF' ? 1 : ($position === 'MED' ? 0.95 : 0.9)));
        if (player_rating_gen(player_position_rating($raw,$position)) !== $expectedGen) throw new RuntimeException('GEN penalty must survive the internal conversion');
    }
}
echo json_encode(['policy'=>array_replace(player_rating_policy(), ['weights'=>player_position_stat_weights_config()]),'cases'=>$cases],JSON_THROW_ON_ERROR);
