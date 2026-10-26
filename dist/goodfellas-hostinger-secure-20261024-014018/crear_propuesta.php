<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/director_proposals.php';
require_directivo_or_admin();
if (!is_directivo()) redirect('editar_partidos.php');
ensure_director_proposals_schema();
$matchId = (int) ($_GET['match_id'] ?? $_POST['match_id'] ?? 0);
$match = repo_match_by_id($matchId);
if (!$match) { flash('error', 'Fecha no encontrada.'); redirect('editar_partidos.php'); }
if (!director_proposal_roster_ready($match)) {
    flash('info', 'El administrador debe completar la fecha y seleccionar todos los jugadores.');
    redirect('editar_partidos.php');
}
$own = director_proposal_for_user($matchId);
if (!empty($match['director_proposals_enabled']) && !director_proposal_can_edit($match)) {
    flash('info', 'Las propuestas estan bloqueadas desde el inicio de la votacion.');
    redirect('propuestas_equipos.php?match_id=' . $matchId);
}
if ($own) redirect('sorteo_legacy_csv.php?match_id=' . $matchId . '&proposal=1&edit_proposal=1');
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        director_proposal_check_csrf((string) ($_POST['csrf'] ?? ''));
        director_proposals_start($matchId);
        $manual = (string) ($_POST['method'] ?? '') === 'manual';
        redirect(($manual ? 'equipos_manual.php' : 'sorteo_legacy_csv.php') . '?match_id=' . $matchId . '&proposal=1');
    } catch (Throwable $e) { flash('error', $e->getMessage()); redirect('crear_propuesta.php?match_id=' . $matchId); }
}
$title = 'Crear mi propuesta | ' . APP_NAME;
$activePage = 'editar_partidos.php';
require __DIR__ . '/includes/header.php';
?>
<section class="card">
  <h1>Crear mi propuesta</h1>
  <h2><?= h((string) ($match['title'] ?: 'Fecha #' . $matchId)) ?></h2>
  <p>Elegí cómo armar los equipos. Después podés acomodar las formaciones, las posiciones y los suplentes. Tu propuesta será visible cuando decidas guardarla.</p>
  <form method="post">
    <input type="hidden" name="match_id" value="<?= $matchId ?>">
    <input type="hidden" name="csrf" value="<?= h(director_proposal_csrf()) ?>">
    <button class="btn" name="method" value="random" type="submit">Por sorteo</button>
    <button class="btn" name="method" value="manual" type="submit">De forma manual</button>
  </form>
  <p><a href="editar_partidos.php">Volver a fechas</a></p>
</section>
<?php require __DIR__ . '/includes/footer.php'; ?>
