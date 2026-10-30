<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/community_proposals.php';
community_schema();
header('Cache-Control: private, no-store');
header('Referrer-Policy: no-referrer');
$id=(int)($_POST['match_id']??$_GET['match_id']??0);
$authorized=$id>0 && community_authorize($id,(string)($_GET['code']??''));
if($_SERVER['REQUEST_METHOD']==='POST'){
    try{
        director_proposal_check_csrf((string)($_POST['csrf']??''));
        $action=(string)($_POST['action']??'');
        if($action==='access'){
            $attempts=$_SESSION['community_attempts'][$id]??['time'=>time(),'count'=>0];
            if(time()-$attempts['time']>60)$attempts=['time'=>time(),'count'=>0];
            $attempts['count']++;$_SESSION['community_attempts'][$id]=$attempts;
            if($attempts['count']>20 || !community_authorize($id,(string)($_POST['code']??'')))throw new RuntimeException('Codigo incorrecto. Revisa el codigo o espera un minuto.');
        }elseif(in_array($action,['open','close','publish'],true)){
            community_transition($id,$action,(int)($_POST['proposal_id']??0));flash('success','Estado actualizado.');
        }elseif($authorized && $action==='identify'){
            $player=(int)($_POST['player_id']??0);if(!community_player($player))throw new RuntimeException('Elegi tu nombre del padron.');$_SESSION['community_identity'][$id]=$player;
        }elseif($authorized && $action==='vote'){
            community_vote($id,(int)($_SESSION['community_identity'][$id]??0),(int)($_POST['proposal_id']??0));flash('success','Voto guardado. Podes cambiarlo hasta el cierre.');
        }else throw new RuntimeException('Acceso no autorizado.');
    }catch(Throwable $e){flash('error',$e->getMessage());}
    redirect('votacion_formaciones.php?match_id='.$id);
}
$ballot=$id?community_ballot($id):null;
$match=$id?repo_match_by_id($id):null;
$options=$authorized?community_options($id):[];
$identity=(int)($_SESSION['community_identity'][$id]??0);
$players=db()->query('SELECT id,name FROM players ORDER BY name')->fetchAll();
$names=array_column($players,'name','id');
if(!isset($names[$identity]))$identity=0;
$labels=['collecting'=>'Recibiendo propuestas','open'=>'Votacion abierta','closed'=>'Votacion cerrada: pendiente de publicar','published'=>'Propuesta ganadora publicada'];
if(isset($_GET['poll'])){
    header('Content-Type: application/json; charset=utf-8');
    if(!$authorized){http_response_code(403);echo '{}';exit;}
    echo json_encode(['state'=>$ballot['state'],'winner_id'=>$ballot['winner_id'],'options'=>array_map(fn($o)=>['id'=>(int)$o['id'],'count'=>$o['count'],'voters'=>array_column($o['voters'],'name')],$options)],JSON_UNESCAPED_UNICODE);exit;
}
$title='Propuestas y votos | '.APP_NAME;$activePage='votacion_formaciones.php';
require __DIR__.'/includes/header.php';
?>
<section class="community-page">
<header class="community-status"><h1>Propuestas y votos</h1><?php if($match): ?><p class="community-match-title"><?= h($match['title']) ?></p><?php endif; ?>
<?php if($ballot): ?><strong data-community-state><?= h($labels[$ballot['state']]??$ballot['state']) ?></strong><?php endif; ?>
<?php if($authorized && $options): ?><nav class="community-jump" aria-label="Ir a una propuesta"><?php foreach($options as $i=>$o): ?><a href="#propuesta-<?= (int)$o['id'] ?>" data-jump-proposal="<?= (int)$o['id'] ?>">Propuesta <?= $i+1 ?> <span><span data-jump-count><?= (int)$o['count'] ?></span> votos</span></a><?php endforeach; ?></nav><?php endif; ?></header>
<?php if(!$id): ?>
<div class="community-dates">
<?php foreach(db()->query('SELECT b.match_id,b.state,m.title,m.match_date FROM community_ballots b JOIN matches m ON m.id=b.match_id ORDER BY m.match_date DESC')->fetchAll() as $row): ?>
<a class="card" href="votacion_formaciones.php?match_id=<?= (int)$row['match_id'] ?>"><strong><?= h($row['title']) ?></strong><span><?= h($labels[$row['state']]??'') ?></span></a>
<?php endforeach; ?></div>
<?php elseif(!$ballot): ?><p>Todavia no se recibieron propuestas para esta fecha.</p>
<?php elseif(!$authorized): ?>
<form method="post" class="community-identity"><input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>"><input type="hidden" name="match_id" value="<?= $id ?>"><label>Codigo de 4 digitos<input name="code" inputmode="numeric" pattern="[0-9]{4}" minlength="4" maxlength="4" required autocomplete="off"></label><button class="btn btn-primary" name="action" value="access">Entrar a la votacion</button></form>
<?php else:
$maximum=$options?max(array_column($options,'count')):0;
$total=array_sum(array_column($options,'count'));
$selected=0;foreach($options as $option)foreach($option['voters'] as $voter)if((int)$voter['player_id']===$identity)$selected=(int)$option['id'];
?>
<?php if(is_admin()): ?><section class="card community-admin">
<strong>Administrar votacion</strong>
<label>Enlace con codigo incluido<input readonly aria-label="Enlace de votacion" value="" data-community-link="<?= h('votacion_formaciones.php?match_id='.$id.'&code='.$ballot['access_code']) ?>" onfocus="this.select()"></label>
<p>Codigo: <strong><?= h($ballot['access_code']) ?></strong></p>
<form method="post"><input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>"><input type="hidden" name="match_id" value="<?= $id ?>">
<?php if($ballot['state']==='collecting'): ?><button class="btn btn-primary" name="action" value="open">Iniciar votacion</button><?php elseif($ballot['state']==='open'): ?><button class="btn btn-primary" name="action" value="close">Finalizar votacion</button><?php elseif($ballot['state']==='closed'): ?><p>Elegi abajo la propuesta mas votada para publicarla. Si hay empate, elegi entre las empatadas.</p><?php endif; ?></form></section><?php endif; ?>
<div class="community-player-context"><?php if($identity): ?><p class="community-myself">Estas viendo las propuestas como <strong><?= h($names[$identity]) ?></strong>. Tu jugador aparece resaltado.</p><?php endif; ?><button type="button" class="btn btn-muted" data-change-identity>Cambiar jugador</button></div>
<dialog class="community-identity-dialog" aria-label="Que jugador sos"><h2>Que jugador sos</h2>
<form method="post" class="community-identity"><input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>"><input type="hidden" name="match_id" value="<?= $id ?>"><label>Buscar jugador<input type="search" data-player-search autocomplete="off"></label><label>Que jugador sos<select name="player_id" aria-label="Que jugador sos" size="6" required><option value="">Elegir mi nombre</option><?php foreach($players as $p): ?><option value="<?= (int)$p['id'] ?>" <?= $identity===(int)$p['id']?'selected':'' ?>><?= h($p['name']) ?></option><?php endforeach; ?></select></label><button class="btn btn-primary" name="action" value="identify">Identificarme</button><p role="status" data-player-empty hidden>No hay jugadores con ese nombre.</p></form><button type="button" class="btn btn-muted" data-close-identity>Cerrar</button></dialog>
<p><strong><?= count($options) ?> propuestas</strong> · <span data-votes-total><?= $total ?></span> votos. Los votos y sus nombres son visibles. Las propuestas son anonimas.</p>

<div class="community-options">
<?php foreach($options as $index=>$option): $oid=(int)$option['id']; ?>
<article class="community-option card" id="propuesta-<?= $oid ?>" data-proposal="<?= $oid ?>">
<header><h2>Propuesta <?= $index+1 ?></h2><strong><span data-count><?= $option['count'] ?></span> votos</strong><?php if((int)$ballot['winner_id']===$oid): ?><strong>Publicada</strong><?php endif; ?></header>
<?php foreach($option['teams'] as $team): ?><div class="community-team-list"><strong><?= h($team['team_name']) ?></strong><div><?php foreach($team['players'] as $player): ?><span class="<?= $identity===(int)$player['id']?'community-highlight':'' ?>"><?= h($player['name']) ?><?= $identity===(int)$player['id']?' (vos)':'' ?></span><?php endforeach; ?></div></div><?php endforeach; ?>
<details><summary>Ver formaciones en cancha</summary><?= formation_view_render_pitch($option['teams'],['highlight_player_id'=>$identity,'proposal'=>true,'grid_class'=>'community-pitches']) ?></details>
<div class="community-voters"><strong>Votaron esta propuesta</strong><p data-voters><?= h(implode(', ',array_column($option['voters'],'name'))?:'Todavia no tiene votos') ?></p></div>
<?php if($ballot['state']==='open' && $identity): ?><form method="post"><input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>"><input type="hidden" name="match_id" value="<?= $id ?>"><input type="hidden" name="proposal_id" value="<?= $oid ?>"><button class="btn <?= $selected===$oid?'btn-muted':'btn-primary' ?>" name="action" value="vote" <?= $selected===$oid?'disabled':'' ?>><?= $selected===$oid?'Tu voto actual':'Votar esta propuesta' ?></button></form><?php endif; ?>
<?php if(is_admin() && $ballot['state']==='closed' && $option['count']===$maximum): ?><form method="post"><input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>"><input type="hidden" name="match_id" value="<?= $id ?>"><input type="hidden" name="proposal_id" value="<?= $oid ?>"><button class="btn btn-primary" name="action" value="publish">Publicar esta propuesta<?= count(array_filter($options,fn($o)=>$o['count']===$maximum))>1?' (resolver empate)':'' ?></button></form><?php endif; ?>
</article><?php endforeach; ?></div>
<script>
for(const input of document.querySelectorAll('[data-community-link]'))input.value=new URL(input.dataset.communityLink,location.href).href;
const statusBar=document.querySelector('.community-status');
if(statusBar && window.ResizeObserver)new ResizeObserver(()=>document.querySelector('.community-page').style.setProperty('--community-status-height',statusBar.offsetHeight+'px')).observe(statusBar);
const identityDialog=document.querySelector('.community-identity-dialog');
const search=identityDialog.querySelector('[data-player-search]');
const select=identityDialog.querySelector('select');
const roster=Array.from(select.options).map(option=>({value:option.value,text:option.textContent}));
const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
search.addEventListener('input',()=>{const filtered=roster.filter(option=>option.value && normalize(option.text).includes(normalize(search.value)));select.replaceChildren(new Option('Elegir mi nombre',''),...filtered.map(option=>new Option(option.text,option.value)));select.value='';identityDialog.querySelector('[data-player-empty]').hidden=filtered.length>0;});
document.querySelector('[data-change-identity]').addEventListener('click',()=>identityDialog.showModal());
identityDialog.querySelector('[data-close-identity]').addEventListener('click',()=>identityDialog.close());
<?php if(!$identity && !is_admin()): ?>identityDialog.showModal();<?php endif; ?>
let busy=false;
setInterval(async()=>{if(busy)return;busy=true;try{const response=await fetch('votacion_formaciones.php?match_id=<?= $id ?>&poll=1',{cache:'no-store'});if(!response.ok)return;const data=await response.json();if(data.options.length!==document.querySelectorAll('[data-proposal]').length){location.reload();return;}if(data.state!==<?= json_encode($ballot['state']) ?>){location.reload();return;}let total=0;for(const option of data.options){total+=option.count;const card=document.querySelector('[data-proposal="'+option.id+'"]');if(card){card.querySelector('[data-count]').textContent=option.count;const jump=document.querySelector('[data-jump-proposal="'+option.id+'"] [data-jump-count]');if(jump)jump.textContent=option.count;card.querySelector('[data-voters]').textContent=option.voters.join(', ')||'Todavia no tiene votos';}}document.querySelector('[data-votes-total]').textContent=total;}catch{}finally{busy=false;}},10000);
</script>
<?php endif; ?></section>
<?php require __DIR__.'/includes/footer.php'; ?>
