<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/director_proposals.php';
ensure_director_proposals_schema();
director_proposals_finalize_due();
$matchId = (int) ($_GET['match_id'] ?? $_POST['match_id'] ?? 0);
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        director_proposal_check_csrf((string) ($_POST['csrf'] ?? ''));
        $action = (string) ($_POST['action'] ?? '');
        if ($action === 'start') {
            redirect('crear_propuesta.php?match_id=' . $matchId);
        } elseif ($action === 'open_voting') {
            director_proposal_open_voting($matchId, (int) ($_POST['duration_minutes'] ?? 60));
            flash('success', 'Votación habilitada. Las propuestas quedaron bloqueadas hasta el cierre.');
        } elseif ($action === 'close_voting') {
            director_proposal_close_voting($matchId, (int) ($_POST['tiebreak_option_id'] ?? 0));
            flash('success', 'Votación terminada. La propuesta ganadora se publicó como formación oficial.');
        } elseif ($action === 'vote') {
            director_proposal_vote($matchId, (int) ($_POST['option_id'] ?? 0));
            flash('success', 'Voto guardado. Podes cambiarlo hasta el cierre.');
        } elseif ($action === 'resolve') {
            if (!is_admin()) throw new RuntimeException('Solo el administrador puede resolver la votacion.');
            $match = repo_match_by_id($matchId);
            if (!$match || empty($match['director_proposals_enabled'])) throw new RuntimeException('Votacion invalida.');
            multiple_draw_apply_option($matchId, (int) ($_POST['option_id'] ?? 0));
            flash('success', 'Formación final publicada.');
        } elseif ($action === 'reveal') {
            if (!is_admin()) throw new RuntimeException('Solo el administrador puede mostrar las propuestas antes del inicio.');
            $match = repo_match_by_id($matchId);
            if (!$match || empty($match['director_proposals_enabled'])) throw new RuntimeException('Fecha invalida.');
            db()->prepare('UPDATE matches SET director_proposals_revealed_at = COALESCE(director_proposals_revealed_at, NOW()) WHERE id = ?')->execute([$matchId]);
            flash('success', 'Propuestas visibles. La votacion conserva su horario de inicio.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('propuestas_equipos.php' . ($matchId > 0 ? '?match_id=' . $matchId : ''));
}
$match = $matchId > 0 ? repo_match_by_id($matchId) : director_proposal_latest_match();
$matchId = (int) ($match['id'] ?? 0);
$title = 'Propuestas próximo partido | ' . APP_NAME;
$activePage = 'propuestas_equipos.php';
require __DIR__ . '/includes/header.php';
?>
<section class="card proposal-page">

  <?php if (!$match): ?>
    <h1>Propuestas próximo partido</h1>
    <p>No hay un próximo partido presentado. El administrador debe crear la fecha y completar la convocatoria.</p>
  <?php else:
    $options = multiple_draw_options($matchId);
    $enabled = !empty($match['director_proposals_enabled']);
    $open = $enabled && multiple_draw_is_open($match);
    $canEdit = $enabled && director_proposal_can_edit($match);
    $closed = $enabled && time() >= multiple_draw_deadline($match);
    $winnerId = (int) ($match['multi_draw_winner_option_id'] ?? 0);
    $selected = 0;
    if (current_user_id() > 0) {
        $stmt = db()->prepare('SELECT option_id FROM director_proposal_votes WHERE match_id = ? AND user_id = ?');
        $stmt->execute([$matchId, current_user_id()]);
        $selected = (int) $stmt->fetchColumn();
    }
    $own = array_filter($options, static fn(array $option): bool => (int) ($option['author_user_id'] ?? 0) === current_user_id());
    $canVote = $open && current_user_id() > 0 && in_array(current_role(), ['usuario', 'jugador'], true);
    $maxVotes = $options ? max(array_column($options, 'vote_count')) : 0;
  ?>
    <header class="proposal-page-head">
      <a class="proposal-back" href="propuestas_equipos.php">Propuestas próximo partido</a>
      <h1><?= h((string) ($match['title'] ?: 'Fecha #' . $matchId)) ?></h1>
      <p class="proposal-match-time">Partido: <?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?></p>
    </header>
    <p>Los directivos preparan sus equipos para esta fecha. El administrador puede habilitar la votación en cualquier momento y definir su duración. Al cerrar, la propuesta ganadora será la formación oficial del partido.</p>
    <?php if ($open): ?>
      <p>Votación habilitada · Tiempo restante: <strong data-proposal-countdown="<?= multiple_draw_deadline($match) ?>">Calculando…</strong></p>
    <?php endif; ?>
    <?php if (is_admin() && $enabled && $options && !$winnerId && $match['status'] === 'programado'): ?>
      <?php if (time() < director_proposal_voting_start($match)): ?>
        <form method="post">
          <input type="hidden" name="match_id" value="<?= $matchId ?>">
          <input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>">
          <label>Duración de votación (minutos) <input type="number" name="duration_minutes" value="60" min="1" max="10080" required></label>
          <button class="btn" name="action" value="open_voting" type="submit">Iniciar votación ahora</button>
        </form>
      <?php elseif ($open): ?>
        <form method="post">
          <input type="hidden" name="match_id" value="<?= $matchId ?>">
          <input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>">
          <label>Elección al cerrar
            <select name="tiebreak_option_id">
              <option value="0">Más votada; en empate, sorteo automático</option>
              <?php foreach ($options as $candidate): if ((int) $candidate['vote_count'] !== (int) $maxVotes) continue; ?>
                <option value="<?= (int) $candidate['id'] ?>">Propuesta <?= (int) $candidate['option_number'] ?> · <?= (int) $candidate['vote_count'] ?> votos</option>
              <?php endforeach; ?>
            </select>
          </label>
          <button class="btn" name="action" value="close_voting" type="submit" data-confirm="¿Terminar la votación y publicar la propuesta más votada?">Terminar votación ahora</button>
        </form>
      <?php endif; ?>
    <?php endif; ?>
    <div class="proposal-action-bar">
      <div>
        <p class="proposal-state"><?= $winnerId ? 'Formación final publicada' : ($canEdit ? ($own ? 'Tu propuesta está guardada' : 'Prepará tu propuesta') : ($open ? 'Votación abierta' : ($closed ? 'Votación cerrada' : 'Propuestas pendientes'))) ?></p>
        <?php if (is_directivo() && $canEdit): ?>
          <p>Podés modificar tu elección hasta el inicio de la votación.</p>
        <?php elseif ($open): ?>
          <p>Las propuestas están bloqueadas. <?= is_directivo() ? 'Podés consultar los votos.' : 'Elegí tu propuesta preferida.' ?></p>
        <?php elseif ($closed && !$winnerId): ?>
          <p><?= $options ? 'Al cerrar se publica la más votada; los empates sin elección del administrador se resuelven por sorteo.' : 'No se guardaron propuestas.' ?></p>
        <?php endif; ?>
      </div>
      <?php if (is_directivo() && $own && $canEdit): ?>
        <a class="proposal-primary" aria-label="Editar mi formación" href="sorteo_legacy_csv.php?match_id=<?= $matchId ?>&amp;proposal=1&amp;edit_proposal=1">Editar mi formación <span aria-hidden="true">→</span></a>
      <?php elseif (is_directivo() && !$own && director_proposal_can_create($match)): ?>
        <a class="proposal-primary" href="crear_propuesta.php?match_id=<?= $matchId ?>">Crear mi propuesta</a>
      <?php elseif ($open && current_user_id() <= 0): ?>
        <a class="proposal-primary" href="login.php?next=<?= h(rawurlencode('propuestas_equipos.php?match_id=' . $matchId)) ?>">Ingresar para votar</a>
      <?php endif; ?>
    </div>
    <?php if ($enabled): ?>
      <dl class="proposal-schedule">
        <div><dt>Inicio de votación</dt><dd><?= h(date('d/m/Y H:i', director_proposal_voting_start($match))) ?></dd></div>
        <div><dt>Cierre de votación</dt><dd><?= h(date('d/m/Y H:i', multiple_draw_deadline($match))) ?></dd></div>
      </dl>
      <p class="proposal-timezone">Hora de Argentina</p>
    <?php endif; ?>
    <?php if (is_admin() && $enabled && empty($match['director_proposals_revealed_at']) && time() < director_proposal_voting_start($match)): ?>
      <form method="post">
        <input type="hidden" name="match_id" value="<?= $matchId ?>">
        <input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>">
        <button class="btn" name="action" value="reveal" type="submit">Mostrar propuestas en Inicio</button>
      </form>
    <?php endif; ?>
    <?php if (!$enabled): ?>
      <p>Esta fecha todavía no tiene una votación de propuestas de directivos.</p>
    <?php elseif (!director_proposals_are_visible($match)): ?>
      <p class="proposal-availability">Las propuestas aparecerán al iniciar la votación o cuando el administrador las habilite.</p>
    <?php elseif (!$options): ?>
      <p>Todavía no se publicaron propuestas.</p>
    <?php else: ?>
      <nav class="proposal-jump-nav" aria-label="Ir a una propuesta">
        <strong>Ir a propuesta</strong>
        <?php foreach ($options as $jumpOption): ?>
          <a href="#proposal-option-<?= (int) $jumpOption['id'] ?>">Propuesta <?= (int) $jumpOption['option_number'] ?> · <?= (int) $jumpOption['vote_count'] ?> votos<?= (int) $jumpOption['id'] === $winnerId ? ' · Ganadora' : '' ?></a>
        <?php endforeach; ?>
      </nav>
      <div class="grid gap-4 director-proposals">
      <?php foreach ($options as $option): ?>
        <section class="card">
          <?= multiple_draw_render_option($option, $selected === (int) $option['id'], false, (int) $option['id'] === $winnerId) ?>
          <?php if ($canVote || (is_admin() && $closed && !$winnerId && (int) $option['vote_count'] === (int) $maxVotes)): ?>
            <form method="post">
              <input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>">
              <input type="hidden" name="match_id" value="<?= $matchId ?>">
              <input type="hidden" name="option_id" value="<?= (int) $option['id'] ?>">
              <button class="btn" name="action" value="<?= $canVote ? 'vote' : 'resolve' ?>" type="submit"><?= $canVote ? ($selected === (int) $option['id'] ? 'Tu voto actual' : 'Votar esta propuesta') : 'Elegir y publicar formación final' ?></button>
            </form>
          <?php endif; ?>
        </section>
      <?php endforeach; ?>
      </div>
    <?php endif; ?>

  <?php endif; ?>
  <details class="proposal-rules"><summary>Cómo funciona la votación</summary>
  <p>Cada directivo publica una formación por fecha. Los usuarios eligen con un voto que pueden cambiar hasta el cierre.</p>
  <p>La más votada se publica como formación oficial. Si hay empate, el administrador puede elegir entre las más votadas al cerrar. Si no elige, se sortea automáticamente entre ellas. Sin votos, el sorteo incluye todas las propuestas.</p>
  </details>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
