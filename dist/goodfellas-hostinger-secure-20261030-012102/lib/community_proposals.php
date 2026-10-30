<?php
declare(strict_types=1);
require_once __DIR__ . '/director_proposals.php';
require_once __DIR__ . '/draw_pots.php';

function community_schema(): void {
    static $ready = false;
    if ($ready) return;
    ensure_director_proposals_schema();
    ensure_draw_pots_schema();
    db()->exec("CREATE TABLE IF NOT EXISTS community_ballots (
        match_id INT UNSIGNED PRIMARY KEY, access_code CHAR(4) NOT NULL,
        state VARCHAR(16) NOT NULL DEFAULT 'collecting', winner_id INT UNSIGNED NULL,
        opened_at DATETIME NULL, closed_at DATETIME NULL,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    db()->exec("CREATE TABLE IF NOT EXISTS community_proposals (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, match_id INT UNSIGNED NOT NULL,
        author_player_id INT UNSIGNED NOT NULL, teams_json MEDIUMTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY one_author (match_id,author_player_id),
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (author_player_id) REFERENCES players(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    db()->exec("CREATE TABLE IF NOT EXISTS community_votes (
        match_id INT UNSIGNED NOT NULL, player_id INT UNSIGNED NOT NULL, proposal_id INT UNSIGNED NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (match_id,player_id),
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (proposal_id) REFERENCES community_proposals(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $ready = true;
}
function community_player(int $id): bool {
    $s=db()->prepare('SELECT id FROM players WHERE id=?'); $s->execute([$id]); return (bool)$s->fetchColumn();
}
function community_ballot(int $id): ?array {
    $s=db()->prepare('SELECT * FROM community_ballots WHERE match_id=?'); $s->execute([$id]); return $s->fetch() ?: null;
}
function community_lock(int $id): array {
    $s=db()->prepare('SELECT * FROM community_ballots WHERE match_id=? FOR UPDATE'); $s->execute([$id]);
    $b=$s->fetch(); if(!$b) throw new RuntimeException('No hay propuestas para esta fecha.'); return $b;
}
function community_authorize(int $id, string $code = ''): bool {
    if(is_admin()) return true;
    $b=community_ballot($id);
    if(!$b) return false;
    if($code !== '' && preg_match('/^[0-9]{4}$/D',$code) && hash_equals($b['access_code'],$code)) $_SESSION['community_access'][$id]=$code;
    return isset($_SESSION['community_access'][$id]) && hash_equals($b['access_code'],(string)$_SESSION['community_access'][$id]);
}
function community_normalize_teams(array $match, $raw, $groups): array {
    if(!is_array($raw) || count($raw)!==(int)$match['num_teams']) throw new RuntimeException('Cantidad de equipos invalida.');
    $roster=repo_match_participants((int)$match['id']); $byId=array_column($roster,null,'id');
    $seen=[]; $teams=[]; $teamByPlayer=[]; $colors=[];
    $preparation=json_decode((string)($match['draw_preparation_json']??'{}'),true) ?: [];
    $fixed=$preparation['goalkeeper_ids']??array_column(array_filter($roster,fn($p)=>strtoupper(explode('/',(string)$p['positions'])[0])==='ARQ'),'id');
    $fixed=array_map('intval',$fixed); $actualKeepers=[];
    foreach($raw as $index=>$team) {
        if(!is_array($team) || !is_array($team['players']??null)) throw new RuntimeException('Equipos invalidos.');
        $color=(string)($team['color_name']??'');
        if(!in_array($color,match_team_kits($match),true) || in_array($color,$colors,true)) throw new RuntimeException('Camisetas invalidas.');
        $colors[]=$color; $players=[]; $keepers=0; $total=0;
        foreach($team['players'] as $order=>$row) {
            $id=(int)($row['id']??0); $position=(string)($row['assigned_position']??'');
            if(!isset($byId[$id]) || isset($seen[$id]) || !in_array($position,allowed_positions(),true)) throw new RuntimeException('Los jugadores y puestos deben corresponder a la fecha.');
            $seen[$id]=true; $teamByPlayer[$id]=$index+1;
            if($position==='ARQ') { $keepers++; $actualKeepers[]=$id; }
            $p=$byId[$id]; $rating=player_overall_rating($p); $total+=$rating;
            $players[]=array_merge($p,['id'=>$id,'assigned_position'=>$position,'is_goalkeeper'=>(int)($position==='ARQ'),'is_substitute'=>0,'lineup_order'=>$order,'formation_line_order'=>$order,'availability_percent'=>(int)($p['availability_percent']??100)]);
        }
        if($keepers!==1 || count($players)*(int)$match['num_teams']!==count($roster)) throw new RuntimeException('Cada equipo debe tener un arquero y la misma cantidad de jugadores.');
        $teams[]=['team_number'=>$index+1,'team_name'=>$color,'color_name'=>$color,'total_skill'=>$total,'formation_name'=>'Propuesta','players'=>$players];
    }
    if(count($seen)!==count($byId)) throw new RuntimeException('La propuesta debe incluir todo el plantel.');
    sort($actualKeepers); sort($fixed);
    if($actualKeepers!==$fixed) throw new RuntimeException('Los arqueros definidos por la fecha no pueden cambiar.');
    $rules=draw_separations_validate($groups); draw_separations_assert_registered($rules); draw_separations_assert($rules,$teamByPlayer);
    $teams[0]['separated_pairs']=$rules;
    return $teams;
}
function community_submit(int $id, int $author, string $invite, $raw, $rules): void {
    community_schema();
    $pdo=db();$pdo->beginTransaction();
    try {
        $s=$pdo->prepare('SELECT * FROM matches WHERE id=? FOR UPDATE');$s->execute([$id]);$match=$s->fetch();
        if(!$match || !$invite || empty($match['draw_invitation_token']) || !hash_equals($match['draw_invitation_token'],$invite) || $match['status']==='finalizado') throw new RuntimeException('Invitacion no disponible.');
        if(!community_player($author)) throw new RuntimeException('Elegi tu nombre del padron.');
        $pdo->prepare('INSERT IGNORE INTO community_ballots (match_id,access_code) VALUES (?,?)')->execute([$id,str_pad((string)random_int(0,9999),4,'0',STR_PAD_LEFT)]);
        $b=community_lock($id);
        if($b['state']!=='collecting') throw new RuntimeException('La recepcion de propuestas ya cerro.');
        $teams=community_normalize_teams($match,$raw,$rules);
        $pdo->prepare('INSERT INTO community_proposals (match_id,author_player_id,teams_json) VALUES (?,?,?) ON DUPLICATE KEY UPDATE teams_json=VALUES(teams_json)')->execute([$id,$author,json_encode($teams,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);
        $pdo->commit();
    } catch(Throwable $e) { if($pdo->inTransaction())$pdo->rollBack();throw $e; }
}
function community_vote(int $id,int $player,int $proposal): void {
    $pdo=db();$pdo->beginTransaction();
    try {
        $b=community_lock($id);
        if(!community_authorize($id) || $b['state']!=='open') throw new RuntimeException('La votacion no esta abierta.');
        if(!community_player($player)) throw new RuntimeException('Elegi un jugador del padron.');
        $s=$pdo->prepare('SELECT id FROM community_proposals WHERE id=? AND match_id=?');$s->execute([$proposal,$id]);if(!$s->fetchColumn())throw new RuntimeException('Propuesta invalida.');
        $pdo->prepare('INSERT INTO community_votes (match_id,player_id,proposal_id) VALUES (?,?,?) ON DUPLICATE KEY UPDATE proposal_id=VALUES(proposal_id),updated_at=CURRENT_TIMESTAMP')->execute([$id,$player,$proposal]);
        $_SESSION['community_identity'][$id]=$player;
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function community_options(int $id): array {
    $s=db()->prepare('SELECT id,teams_json FROM community_proposals WHERE match_id=? ORDER BY id');$s->execute([$id]);$options=$s->fetchAll();
    $v=db()->prepare('SELECT v.proposal_id,v.player_id,p.name FROM community_votes v JOIN players p ON p.id=v.player_id WHERE v.match_id=? ORDER BY p.name');$v->execute([$id]);$votes=$v->fetchAll();
    foreach($options as &$option){$option['teams']=json_decode($option['teams_json'],true);unset($option['teams_json']);$option['voters']=array_values(array_filter($votes,fn($v)=>(int)$v['proposal_id']===(int)$option['id']));$option['count']=count($option['voters']);}unset($option);return $options;
}
function community_transition(int $id,string $action,int $winner=0): void {
    if(!is_admin())throw new RuntimeException('Solo el administrador puede gestionar la votacion.');
    $pdo=db();$pdo->beginTransaction();
    try {
        $b=community_lock($id);$options=community_options($id);
        $lock=$pdo->prepare('SELECT * FROM matches WHERE id=? FOR UPDATE');$lock->execute([$id]);$match=$lock->fetch();if(!$match || $match['status']==='finalizado')throw new RuntimeException('La fecha esta finalizada.');
        if($action==='open' && $b['state']==='collecting' && $options) $pdo->prepare("UPDATE community_ballots SET state='open',opened_at=NOW() WHERE match_id=?")->execute([$id]);
        elseif($action==='close' && $b['state']==='open') $pdo->prepare("UPDATE community_ballots SET state='closed',closed_at=NOW() WHERE match_id=?")->execute([$id]);
        elseif($action==='publish' && $b['state']==='closed') {
            $highest=max(array_column($options,'count'));$selected=null;
            foreach($options as $option)if((int)$option['id']===$winner && $option['count']===$highest)$selected=$option;
            if(!$selected)throw new RuntimeException('Elegi una propuesta con la mayor cantidad de votos.');
            // Validate again against the current roster and goalkeeper configuration.
            community_normalize_teams($match,$selected['teams'],$selected['teams'][0]['separated_pairs']??[]);
            // Publication uses the same application routine as the existing proposals.
            $s=$pdo->prepare('SELECT COALESCE(MAX(option_number),0)+1 FROM match_draw_options WHERE match_id=?');$s->execute([$id]);$number=(int)$s->fetchColumn();
            if($number>255)throw new RuntimeException('No se pueden agregar mas opciones.');
            $pdo->prepare('INSERT INTO match_draw_options (match_id,option_number,teams_json,total_diff) VALUES (?,?,?,0)')->execute([$id,$number,json_encode($selected['teams'],JSON_THROW_ON_ERROR)]);
            $optionId=(int)$pdo->lastInsertId();
            // The caller holds the ballot lock; the application routine joins this transaction.
            multiple_draw_apply_option($id,$optionId,false,true);
            $pdo->prepare('UPDATE matches SET teams_published_at=NOW() WHERE id=?')->execute([$id]);
            $pdo->prepare("UPDATE community_ballots SET state='published',winner_id=? WHERE match_id=?")->execute([$winner,$id]);
        }else throw new RuntimeException('Ese cambio de estado no esta permitido.');
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function community_home_controls(): void {
    if(!is_admin())return;
    community_schema();
    $rows=db()->query("SELECT b.*,m.title,(SELECT COUNT(*) FROM community_votes v WHERE v.match_id=b.match_id) AS votes,(SELECT COUNT(*) FROM community_proposals p WHERE p.match_id=b.match_id) AS proposals FROM community_ballots b JOIN matches m ON m.id=b.match_id WHERE b.state <> 'published' AND m.status <> 'finalizado' ORDER BY m.match_date DESC")->fetchAll();
    if(!$rows)return;
    echo '<section class="card"><h2>Propuestas y votos</h2>';
    $states=['collecting'=>'Recibiendo propuestas','open'=>'Votacion abierta','closed'=>'Votacion cerrada: pendiente de publicar'];
    foreach($rows as $row){echo '<div class="community-admin-row"><strong>'.h($row['title']).'</strong><span>'.(int)$row['proposals'].' propuestas &middot; '.(int)$row['votes'].' votos</span><span>'.h($states[$row['state']]??$row['state']).'</span><a class="btn btn-muted" href="votacion_formaciones.php?match_id='.(int)$row['match_id'].'">Ver votacion</a>';if(in_array($row['state'],['collecting','open'],true)){echo '<form method="post" action="votacion_formaciones.php"><input type="hidden" name="csrf" value="'.h(director_proposal_csrf()).'"><input type="hidden" name="match_id" value="'.(int)$row['match_id'].'"><button class="btn btn-primary" name="action" value="'.($row['state']==='open'?'close':'open').'">'.($row['state']==='open'?'Finalizar votacion':'Iniciar votacion').'</button></form>';}echo '</div>';}echo '</section>';
}
