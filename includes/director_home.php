<?php
declare(strict_types=1);
$directorMatch = director_proposal_latest_match();
$lastMatch = $lastFinalizedMatch ?? $latestFinalizedMatch;
$lastDeadline = $lastMatch ? directive_voting_deadline($lastMatch) : null;
require __DIR__ . '/header.php';
?>
<div class="director-home">
  <header class="page-head">
    <h1>Inicio del directivo</h1>
    <a class="btn home-app-download" href="goodfellas.apk" download>Descarga la app</a>
  </header>

  <section class="card director-home-section" aria-labelledby="director-next-title">
    <h2 id="director-next-title">Mi propuesta para la próxima fecha</h2>
    <?php if (!$directorMatch): ?>
      <p>No hay una próxima fecha cargada.</p>
    <?php else:
        $mid = (int) $directorMatch['id'];
        $own = director_proposal_for_user($mid);
        $ready = director_proposal_roster_ready($directorMatch);
        $canEdit = director_proposal_can_edit($directorMatch);
        $canCreate = !$own && director_proposal_can_create($directorMatch);
        $rosterCount = count(multiple_draw_participant_ids($mid));
    ?>
      <h3><?= h((string) ($directorMatch['title'] ?: 'Fecha #' . $mid)) ?></h3>
      <p><?= h(date('d/m/Y H:i', strtotime((string) $directorMatch['match_date']))) ?> · <?= $rosterCount ?>/<?= (int) $directorMatch['num_teams'] * (int) $directorMatch['players_per_team'] ?> jugadores convocados</p>
      <?php $directorCourt = !empty($directorMatch['rental_court_id']) ? rental_court_by_id((int) $directorMatch['rental_court_id']) : null; ?>
      <p class="small-muted">Estado: <?= h(match_status_label((string) $directorMatch['status'])) ?><?= $directorCourt ? ' · Cancha: ' . h((string) $directorCourt['court_key'] . ' — ' . (string) $directorCourt['place']) : '' ?></p>
      <?php if ($canEdit && $own): ?>
        <p>Tu propuesta está guardada. Podés editarla o volver a empezar antes del inicio de la votación.</p>
        <a class="btn btn-primary" href="sorteo_legacy_csv.php?match_id=<?= $mid ?>&amp;proposal=1&amp;edit_proposal=1">Editar mi formación</a>
      <?php elseif ($canCreate): ?>
        <p>La convocatoria está completa. Elegí sorteo o armado manual y guardá tu propuesta cuando esté lista.</p>
        <a class="btn btn-primary" href="crear_propuesta.php?match_id=<?= $mid ?>">Crear mi propuesta</a>
      <?php elseif (!$ready): ?>
        <p>El administrador debe completar la lista de jugadores para habilitar tu propuesta.</p>
      <?php else: ?>
        <p>El período de preparación terminó. Las propuestas están bloqueadas.</p>
        <a class="btn" href="propuestas_equipos.php?match_id=<?= $mid ?>">Ver propuestas y votación</a>
      <?php endif; ?>
      <?php if (!empty($directorMatch['director_proposals_enabled'])): ?>
        <p class="small-muted"><?= time() < director_proposal_voting_start($directorMatch) ? 'Podés cambiar tu elección hasta' : 'Propuestas bloqueadas desde' ?> <?= h(date('d/m/Y H:i', director_proposal_voting_start($directorMatch))) ?>. Cierre de votación: <?= h(date('d/m/Y H:i', multiple_draw_deadline($directorMatch))) ?>.</p>
      <?php endif; ?>
      <?php if (($directorMatch['draw_mode'] ?? '') === 'captains'): ?>
        <form class="home-captain-access" method="post" action="capitanes.php">
          <input type="hidden" name="action" value="captain_token_login">
          <label for="homeCaptainToken">Token de capitán</label>
          <input id="homeCaptainToken" name="captain_token" maxlength="4" inputmode="numeric" required>
          <button class="btn" type="submit">Soy capitán</button>
        </form>
      <?php endif; ?>
      <p><a href="historial.php?match_id=<?= $mid ?>">Detalles de la fecha</a> · <a href="editar_partidos.php">Ver todas las fechas</a></p>
    <?php endif; ?>
  </section>

  <?php if ($lastMatch && $lastDeadline !== null && time() < $lastDeadline): ?>
    <section class="card director-home-section" aria-labelledby="director-last-title">
      <h2 id="director-last-title">Último partido: premios y puntajes</h2>
      <h3><?= h((string) ($lastMatch['title'] ?: 'Fecha #' . $lastMatch['id'])) ?></h3>
      <p><?= h(date('d/m/Y H:i', strtotime((string) $lastMatch['match_date']))) ?></p>
      <?php
        $lastTeams = repo_match_teams((int) $lastMatch['id']);
        $goals = [];
        foreach ($lastTeams as $team) $goals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
        if ($lastTeams) echo render_match_scoreboard($goals, repo_match_team_labels($lastMatch, $lastTeams));
      ?>
      <?php if ($pendingDirectiveMatch && (int) $pendingDirectiveMatch['id'] === (int) $lastMatch['id']):
          $mode = match_valuation_mode($lastMatch);
      ?>
        <p><?= $mode === 'both' ? 'Te falta completar premios y puntajes.' : ($mode === 'ratings' ? 'Te falta completar los puntajes.' : 'Te falta completar los premios.') ?></p>
        <a class="btn btn-primary" href="junta_votaciones.php?match_id=<?= (int) $lastMatch['id'] ?>"><?= $mode === 'both' ? 'Completar premios y puntajes' : ($mode === 'ratings' ? 'Completar puntajes' : 'Completar premios') ?></a>
      <?php else: ?>
        <p>Tus valoraciones están completas o la valoración ya fue publicada.</p>
      <?php endif; ?>
      <p class="small-muted">Plazo de valoración: <?= h(date('d/m/Y H:i', $lastDeadline)) ?>.</p>
      <a href="historial.php?match_id=<?= (int) $lastMatch['id'] ?>">Detalles del último partido</a>
    </section>
  <?php endif; ?>

  <section class="card director-home-section director-home-proposals" aria-labelledby="director-vote-title">
    <h2 id="director-vote-title">Propuestas y estado de la votación</h2>
    <?php if (!$directorMatch || !director_proposals_are_visible($directorMatch)): ?>
      <p>La vista de propuestas se habilita al comenzar la votación o cuando el administrador lo decida.</p>
      <?php if ($directorMatch && !empty($directorMatch['director_proposals_enabled'])): ?>
        <p>Inicio: <?= h(date('d/m/Y H:i', director_proposal_voting_start($directorMatch))) ?>.</p>
      <?php endif; ?>
    <?php else:
        $options = multiple_draw_options((int) $directorMatch['id']);
        $votingOpen = multiple_draw_is_open($directorMatch);
        $winner = (int) ($directorMatch['multi_draw_winner_option_id'] ?? 0);
    ?>
      <p><?= $winner ? 'Votación resuelta. Formación final publicada.' : ($votingOpen ? 'Votación abierta. Las propuestas están bloqueadas. En empate, si el administrador no elige al cerrar, se resuelve por sorteo.' : (time() < director_proposal_voting_start($directorMatch) ? 'Vista habilitada por el administrador. La votación todavía no comenzó.' : 'Votación cerrada. Los empates se resuelven por sorteo automático.')) ?></p>
      <p>Como directivo, tu elección es tu propia formación. Podés consultar todos los votos; no votás en esta elección.</p>
      <p class="small-muted">Inicio: <?= h(date('d/m/Y H:i', director_proposal_voting_start($directorMatch))) ?> · Cierre: <?= h(date('d/m/Y H:i', multiple_draw_deadline($directorMatch))) ?></p>
      <a class="btn" href="index.php?match_id=<?= (int) $directorMatch['id'] ?>">Actualizar votos</a>
      <div class="director-home-proposal-list lg:grid-cols-3">
        <?php foreach ($options as $option): ?>
          <?= multiple_draw_render_option($option, false, false, (int) $option['id'] === $winner) ?>
        <?php endforeach; ?>
      </div>
      <?php if (!$options): ?><p>No se guardaron propuestas para esta fecha.</p><?php endif; ?>
      <a href="propuestas_equipos.php?match_id=<?= (int) $directorMatch['id'] ?>">Ver estado de la votación</a>
    <?php endif; ?>
  </section>
</div>
<?php require __DIR__ . '/footer.php'; ?>
