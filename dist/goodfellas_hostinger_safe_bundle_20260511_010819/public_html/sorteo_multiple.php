<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/sorteo_multiple.php';

require_admin();
ensure_multiple_draw_schema();

$matchId = (int) ($_GET['match_id'] ?? $_POST['match_id'] ?? 0);
$match = $matchId > 0 ? repo_match_by_id($matchId) : null;
if (!$match) {
    flash('error', 'Fecha no encontrada.');
    redirect('editar_partidos.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    try {
        if ($action === 'save_settings') {
            $count = max(1, min(10, (int) ($_POST['multi_draw_count'] ?? 3)));
            $lockMinutes = max(0, min(1440, (int) ($_POST['multi_draw_lock_minutes'] ?? 60)));
            $stmt = db()->prepare(
                'UPDATE matches
                 SET multi_draw_count = :draw_count,
                     multi_draw_lock_minutes = :lock_minutes
                 WHERE id = :id'
            );
            $stmt->execute(['draw_count' => $count, 'lock_minutes' => $lockMinutes, 'id' => $matchId]);
            flash('success', 'Configuracion de sorteo multiple guardada.');
        } elseif ($action === 'generate_options') {
            $fresh = repo_match_by_id($matchId) ?: $match;
            multiple_draw_generate($matchId, (int) ($fresh['multi_draw_count'] ?? 3), true);
            flash('success', 'Variantes generadas correctamente.');
        } elseif ($action === 'apply_current_winner') {
            $optionId = multiple_draw_winning_option_id($matchId);
            if ($optionId <= 0) {
                throw new RuntimeException('Todavia no hay opciones para aplicar.');
            }
            multiple_draw_apply_option($matchId, $optionId);
            flash('success', 'Votacion finalizada por admin. Se aplico la opcion ganadora actual.');
        } elseif ($action === 'finalize_due') {
            $fresh = repo_match_by_id($matchId) ?: $match;
            if (multiple_draw_finalize_if_due($fresh)) {
                flash('success', 'Se aplico automaticamente la opcion ganadora.');
            } else {
                flash('info', 'Todavia no hay una opcion para aplicar automaticamente.');
            }
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('sorteo_multiple.php?match_id=' . $matchId);
}

$match = repo_match_by_id($matchId) ?: $match;
multiple_draw_finalize_if_due($match);
$match = repo_match_by_id($matchId) ?: $match;
$options = multiple_draw_options($matchId);
$winnerId = (int) ($match['multi_draw_winner_option_id'] ?? 0);
if (!$options && $winnerId <= 0 && (string) ($match['status'] ?? '') === 'programado') {
    try {
        multiple_draw_generate($matchId, (int) ($match['multi_draw_count'] ?? 3), true);
        flash('success', 'Variantes generadas y votacion iniciada.');
        $match = repo_match_by_id($matchId) ?: $match;
        $options = multiple_draw_options($matchId);
    } catch (Throwable $e) {
        flash('error', 'No se pudieron generar las variantes: ' . $e->getMessage());
    }
}
$participants = repo_match_participants($matchId);
$deadline = multiple_draw_deadline($match);
$winnerId = (int) ($match['multi_draw_winner_option_id'] ?? 0);
$title = 'Sorteo multiple | ' . APP_NAME;
$activePage = 'editar_partidos.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head multi-draw-page-head">
  <div>
    <h1>Sorteo multiple</h1>
    <p class="small-muted"><?= h((string) ($match['title'] ?: ('Fecha #' . $match['id']))) ?> - cierre <?= h(date('d/m/Y H:i', $deadline)) ?></p>
  </div>
  <a class="btn btn-muted multi-draw-back-action" href="editar_partidos.php">Volver</a>
</section>

<section class="grid cols-3 multi-draw-summary mb-3">
  <article class="stat-box">
    <div class="label">Jugadores</div>
    <div class="value"><?= h((string) count($participants)) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Variantes</div>
    <div class="value"><?= h((string) (int) ($match['multi_draw_count'] ?? 3)) ?></div>
  </article>
  <article class="stat-box">
    <div class="label">Cierre</div>
    <div class="value"><?= h((string) (int) ($match['multi_draw_lock_minutes'] ?? 60)) ?>m</div>
  </article>
</section>

<section class="card multi-draw-variants-card mb-3">
  <div class="section-toolbar multi-draw-section-toolbar">
    <div>
      <h3>Variantes</h3>
      <p class="small-muted">La votacion es opcional. El admin puede cerrar cuando quiera o dejar que cierre por tiempo.</p>
    </div>
    <?php if ($options && $winnerId <= 0): ?>
      <form method="post">
        <input type="hidden" name="match_id" value="<?= $matchId ?>">
        <button class="btn btn-warning multi-draw-regenerate-action" type="submit" name="action" value="generate_options" data-confirm="Regenerar las variantes? Se borraran los votos existentes.">Regenerar variantes</button>
      </form>
    <?php endif; ?>
  </div>
  <?php if (!$options): ?>
    <p class="small-muted">Las variantes se generan automaticamente al abrir esta pantalla si la fecha esta programada y tiene convocados validos.</p>
  <?php else: ?>
    <?php if ($winnerId <= 0): ?>
      <form method="post" class="mb-3">
        <input type="hidden" name="match_id" value="<?= $matchId ?>">
        <button class="btn btn-primary w-full multi-draw-finalize-action" type="submit" name="action" value="apply_current_winner" data-confirm="Finalizar la votacion ahora y aplicar la opcion ganadora actual?">Finalizar votacion y aplicar ganadora</button>
      </form>
    <?php endif; ?>
    <div class="multi-draw-options-grid">
      <?php foreach ($options as $option): ?>
        <?= multiple_draw_render_option($option, $winnerId === (int) $option['id']) ?>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<?php if ($options && $winnerId <= 0): ?>
  <section class="card multi-draw-close-card">
    <h3>Cierre automatico</h3>
    <p class="small-muted mb-3">Al llegar el cierre, gana la opcion con mas votos. Si hay empate, gana la mas equilibrada.</p>
    <form method="post">
      <input type="hidden" name="match_id" value="<?= $matchId ?>">
      <button class="btn btn-muted multi-draw-test-close-action" type="submit" name="action" value="finalize_due">Probar cierre automatico ahora</button>
    </form>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
