<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/sorteo_multiple.php';

ensure_multiple_draw_schema();
require_player_user();

$matchId = (int) ($_GET['match_id'] ?? $_POST['match_id'] ?? 0);
$match = $matchId > 0 ? repo_match_by_id($matchId) : null;
if (!$match) {
    flash('error', 'Fecha no encontrada.');
    redirect('perfil.php');
}

multiple_draw_finalize_if_due($match);
$match = repo_match_by_id($matchId) ?: $match;

if (!multiple_draw_user_can_vote($match)) {
    flash('error', 'No podes votar este sorteo o la votacion ya cerro.');
    redirect('perfil.php');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        multiple_draw_save_vote($matchId, (int) ($_POST['option_id'] ?? 0));
        flash('success', 'Voto guardado.');
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('votar_sorteo.php?match_id=' . $matchId);
}

$options = multiple_draw_options($matchId);
$selectedOptionId = multiple_draw_vote_for_user($matchId, current_user_id());
$deadline = multiple_draw_deadline($match);
$title = 'Votar sorteo | ' . APP_NAME;
$activePage = 'perfil.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head multi-draw-page-head multi-draw-vote-head">
  <div>
    <h1>Votar sorteo</h1>
    <p class="small-muted"><?= h((string) ($match['title'] ?: ('Fecha #' . $match['id']))) ?> - podes cambiar tu voto hasta <?= h(date('d/m/Y H:i', $deadline)) ?>.</p>
  </div>
  <a class="btn btn-muted" href="perfil.php">Mi perfil</a>
</section>

<?php if (!$options): ?>
  <section class="card multi-draw-empty-card">
    <p class="small-muted">El admin todavia no genero las opciones de sorteo para esta fecha.</p>
  </section>
<?php else: ?>
  <section class="grid gap-3 pb-2 lg:grid-cols-3">
    <?php foreach ($options as $option): ?>
      <form method="post" class="min-w-0 rounded-2xl border border-lime-200/25 bg-emerald-950/55 p-2 shadow-md shadow-emerald-950/15">
        <input type="hidden" name="match_id" value="<?= $matchId ?>">
        <input type="hidden" name="option_id" value="<?= (int) $option['id'] ?>">
        <?= multiple_draw_render_option($option, $selectedOptionId === (int) $option['id']) ?>
        <button class="btn <?= $selectedOptionId === (int) $option['id'] ? 'btn-muted' : 'btn-primary' ?> w-full mt-2" type="submit">
          <?= $selectedOptionId === (int) $option['id'] ? 'Votado' : 'Votar esta opcion' ?>
        </button>
      </form>
    <?php endforeach; ?>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
