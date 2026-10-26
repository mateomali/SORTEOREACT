<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/live_match_repository.php';

$liveFollowMatches = live_follow_matches();
if (count($liveFollowMatches) === 1) {
    redirect('partidos_en_vivo.php?match_id=' . (int) $liveFollowMatches[0]['id']);
}
$title = 'Seguimiento en vivo | ' . APP_NAME;
$activePage = 'seguimiento_en_vivo.php';
require __DIR__ . '/includes/header.php';
?>
<section class="card">
  <h1>Seguimiento en vivo</h1>
  <?php if (!$liveFollowMatches): ?>
    <p>No hay triangulares ni cuadrangulares en marcha.</p>
  <?php else: ?>
    <?php foreach ($liveFollowMatches as $liveFollowMatch): ?>
      <p><a class="btn btn-primary" href="partidos_en_vivo.php?match_id=<?= (int) $liveFollowMatch['id'] ?>"><?= h((string) ($liveFollowMatch['title'] ?: ('Fecha #' . $liveFollowMatch['id']))) ?> · <?= (int) $liveFollowMatch['num_teams'] === 3 ? 'Triangular' : 'Cuadrangular' ?></a></p>
    <?php endforeach; ?>
  <?php endif; ?>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
