<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';

require_admin();
ensure_control_schema();

$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants_basic($matchId) : [];
$numTeams = $selectedMatch ? max(2, min(4, (int) ($selectedMatch['num_teams'] ?? 2))) : 2;
$playersPerTeam = $selectedMatch ? max(1, (int) ($selectedMatch['players_per_team'] ?? 1)) : 1;
$expectedPlayers = $numTeams * $playersPerTeam;

$players = array_map(static fn(array $p): array => [
    'id' => (int) $p['id'],
    'name' => (string) $p['name'],
    'positions' => (string) $p['positions'],
    'pace' => (string) $p['pace'],
    'skill' => (float) $p['skill'],
], $participants);

$title = 'Equipos manuales | ' . APP_NAME;
$activePage = 'editar_partidos.php';
$backUrl = 'editar_partidos.php' . ($selectedMatch ? '#partido-admin-' . (int) $selectedMatch['id'] : '');
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Equipos manuales</h1>
    <p class="small-muted">Asigna cada convocado a un equipo y guarda la fecha sin sorteo ni draft.</p>
  </div>
  <a class="btn btn-muted" href="<?= h($backUrl) ?>">Volver a fechas</a>
</section>

<?php if (!$selectedMatch): ?>
  <section class="card">
    <p class="flash flash-error">Fecha no encontrada.</p>
  </section>
<?php elseif ((string) $selectedMatch['status'] === 'finalizado'): ?>
  <section class="card">
    <p class="flash flash-error">La fecha ya esta finalizada.</p>
  </section>
<?php else: ?>
  <section class="card manual-teams-shell" data-manual-teams>
    <div class="section-toolbar">
      <div>
        <h3><?= h((string) ($selectedMatch['title'] ?: ('Fecha #' . $selectedMatch['id']))) ?></h3>
        <p class="small-muted">
          <?= h(date('d/m/Y H:i', strtotime((string) $selectedMatch['match_date']))) ?>
          | <?= h((string) count($players)) ?>/<?= h((string) $expectedPlayers) ?> convocados
          | <?= h((string) $numTeams) ?> equipos de <?= h((string) $playersPerTeam) ?>
        </p>
      </div>
      <button class="btn btn-primary" type="button" data-manual-save>Guardar equipos</button>
    </div>

    <?php if (count($players) !== $expectedPlayers): ?>
      <div class="flash flash-error mt-3">
        La fecha tiene <?= h((string) count($players)) ?> convocados y necesita <?= h((string) $expectedPlayers) ?> para armar equipos iguales.
      </div>
    <?php endif; ?>

    <div class="manual-teams-status mt-3" data-manual-status></div>
    <div class="manual-teams-board mt-3" data-manual-board></div>
  </section>

  <script>
    window.manualTeamsConfig = {
      matchId: <?= (int) $selectedMatch['id'] ?>,
      numTeams: <?= (int) $numTeams ?>,
      playersPerTeam: <?= (int) $playersPerTeam ?>,
      players: <?= json_encode($players, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
    };
  </script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
