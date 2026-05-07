<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/directivos.php';

require_directivo_or_admin();
ensure_control_schema();
ensure_match_awards_schema();
ensure_directivos_schema();

function junta_match_label(array $match): string
{
    $title = trim((string) ($match['title'] ?? ''));
    if ($title !== '') {
        return $title;
    }
    return 'Fecha #' . (int) $match['id'];
}

function junta_format_datetime(?int $timestamp): string
{
    return $timestamp ? date('d/m/Y H:i', $timestamp) : '-';
}

function junta_participant_ids(array $participants): array
{
    return array_values(array_map(
        static fn(array $p): int => (int) $p['id'],
        array_filter($participants, static fn(array $p): bool => $p['team_number'] !== null)
    ));
}

function junta_award_value(array $votes, string $code): string
{
    $vote = $votes[$code] ?? null;
    if (!$vote) {
        return '';
    }
    return (string) $vote['name'] . ' (#' . (int) $vote['player_id'] . ')';
}

function junta_player_team_label(array $player, array $teamLabels): string
{
    $team = (int) ($player['team_number'] ?? 0);
    $position = (string) ($player['assigned_position'] ?: '');
    $pieces = [];
    if ($team > 0) {
        $pieces[] = $teamLabels[$team] ?? ('Equipo ' . $team);
    }
    if ($position !== '') {
        $pieces[] = $position;
    }
    return implode(' - ', $pieces);
}

try {
    directive_publish_due_results();
} catch (Throwable $e) {
    flash('error', 'No se pudo revisar la publicacion automatica: ' . $e->getMessage());
}
$matches = repo_matches("m.status = 'finalizado'");

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_directive_vote') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $match = repo_match_by_id($matchId);
    try {
        if (!is_directivo()) {
            throw new RuntimeException('El admin administra la junta, pero no vota como directivo.');
        }
        if (!$match || (string) $match['status'] !== 'finalizado') {
            throw new RuntimeException('Fecha invalida.');
        }
        if (!directive_voting_is_open($match)) {
            throw new RuntimeException('La votacion de esta fecha ya no esta abierta.');
        }
        $participants = repo_match_participants($matchId);
        $participantIds = junta_participant_ids($participants);
        directive_save_vote(
            $matchId,
            current_directivo_id(),
            is_array($_POST['rating'] ?? null) ? $_POST['rating'] : [],
            is_array($_POST['awards'] ?? null) ? $_POST['awards'] : [],
            $participantIds
        );
        $published = directive_publish_if_ready($match, $participants);
        flash('success', $published ? 'Voto guardado y resultados publicados.' : 'Voto guardado.');
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('junta_votaciones.php?match_id=' . $matchId);
}

$selectedMatchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
if ($selectedMatchId <= 0 && $matches) {
    $selectedMatchId = (int) $matches[0]['id'];
}
$selectedMatch = $selectedMatchId > 0 ? repo_match_by_id($selectedMatchId) : null;
if ($selectedMatch && (string) $selectedMatch['status'] !== 'finalizado') {
    $selectedMatch = null;
}

$participants = $selectedMatch ? repo_match_participants((int) $selectedMatch['id']) : [];
$participantIds = junta_participant_ids($participants);
$participantCount = count($participantIds);
$teams = $selectedMatch ? repo_match_teams((int) $selectedMatch['id']) : [];
$teamLabels = $selectedMatch ? repo_match_team_labels($selectedMatch, $teams) : [];
$awardDefinitions = award_definitions();
$publication = $selectedMatch ? directive_publication((int) $selectedMatch['id']) : null;
$voteStatus = $selectedMatch ? directive_vote_status((int) $selectedMatch['id'], $participantCount) : ['eligible' => 0, 'submitted' => 0];
$deadline = $selectedMatch ? directive_voting_deadline($selectedMatch) : null;
$isOpen = $selectedMatch ? directive_voting_is_open($selectedMatch) : false;
$myRatingVotes = (is_directivo() && $selectedMatch) ? directive_member_rating_votes((int) $selectedMatch['id'], current_directivo_id()) : [];
$myAwardVotes = (is_directivo() && $selectedMatch) ? directive_member_award_votes((int) $selectedMatch['id'], current_directivo_id()) : [];
$myVoteComplete = (is_directivo() && $selectedMatch) ? directive_member_completed_match((int) $selectedMatch['id'], current_directivo_id(), $participantCount) : false;
$savedAwards = $selectedMatch ? repo_match_awards((int) $selectedMatch['id']) : [];

$title = 'Junta directiva | ' . APP_NAME;
$activePage = 'junta_votaciones.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Junta directiva</h1>
    <p class="small-muted">Votacion de puntajes y premios de fechas finalizadas.</p>
  </div>
  <?php if (is_admin()): ?>
    <a class="btn btn-muted" href="directivos.php">Administrar directivos</a>
  <?php endif; ?>
</section>

<?php if (!$matches): ?>
  <section class="card">
    <p class="small-muted">No hay fechas finalizadas para votar.</p>
  </section>
<?php else: ?>
  <section class="grid cols-2 mb-3">
    <?php foreach ($matches as $match): ?>
      <?php
        $matchId = (int) $match['id'];
        $matchParticipants = repo_match_participants($matchId);
        $matchParticipantCount = count(junta_participant_ids($matchParticipants));
        $matchPublication = directive_publication($matchId);
        $matchStatus = directive_vote_status($matchId, $matchParticipantCount);
        $matchDeadline = directive_voting_deadline($match);
        $matchOpen = directive_voting_is_open($match);
      ?>
      <a class="card home-next-card <?= $selectedMatchId === $matchId ? 'active' : '' ?>" href="junta_votaciones.php?match_id=<?= $matchId ?>">
        <h3><?= h(junta_match_label($match)) ?></h3>
        <p class="small-muted"><?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?></p>
        <div class="stats-grid mt-2">
          <span class="chip"><?= (int) $matchStatus['submitted'] ?>/<?= (int) $matchStatus['eligible'] ?> votos</span>
          <span class="chip"><?= $matchPublication ? 'Publicado' : ($matchOpen ? 'Abierto' : 'Pendiente') ?></span>
        </div>
        <small class="small-muted">Cierre: <?= h(junta_format_datetime($matchDeadline)) ?></small>
      </a>
    <?php endforeach; ?>
  </section>

  <?php if ($selectedMatch): ?>
    <section class="card mb-3">
      <div class="finish-score-head">
        <div>
          <h3><?= h(junta_match_label($selectedMatch)) ?></h3>
          <p class="small-muted">
            <?= h((string) $voteStatus['submitted']) ?>/<?= h((string) $voteStatus['eligible']) ?> directivos votaron.
            Cierre automatico: <?= h(junta_format_datetime($deadline)) ?>.
          </p>
        </div>
        <span class="chip"><?= $publication ? 'Resultados publicados' : ($isOpen ? 'Votacion abierta' : 'En cierre automatico') ?></span>
      </div>
      <?php if ($publication): ?>
        <p class="small-muted">Publicado el <?= h(date('d/m/Y H:i', strtotime((string) $publication['published_at']))) ?> por <?= h($publication['reason'] === 'all_voted' ? 'voto completo de la junta' : 'fin de plazo') ?>.</p>
      <?php elseif ($myVoteComplete): ?>
        <p class="flash flash-success">Tu voto esta cargado. Los resultados se publican cuando vote toda la junta o al cumplirse el plazo.</p>
      <?php elseif (!is_directivo()): ?>
        <p class="flash flash-info">Como admin podes ver el estado y habilitar directivos, pero el voto lo carga cada directivo con su usuario.</p>
      <?php endif; ?>
    </section>

    <?php if ($publication): ?>
      <section class="card mb-3">
        <h3>Resultados publicados</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jugador</th>
                <th>Equipo</th>
                <th>Puntaje final</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($participants as $player): ?>
                <?php if ($player['team_number'] === null) continue; ?>
                <tr>
                  <td data-label="Jugador"><strong><?= h((string) $player['name']) ?></strong></td>
                  <td data-label="Equipo"><?= h(junta_player_team_label($player, $teamLabels)) ?></td>
                  <td data-label="Puntaje final"><strong><?= $player['rating'] !== null && $player['rating'] !== '' ? h(number_format((float) $player['rating'], 1)) : '-' ?></strong></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h3>Premios</h3>
        <div class="award-grid">
          <?php foreach ($awardDefinitions as $code => $award): ?>
            <?php $winner = $savedAwards[$code] ?? null; ?>
            <div class="award-field">
              <label>
                <span class="award-icon" title="<?= h((string) $award['label']) ?>"><?= h((string) $award['icon']) ?></span>
                <span><?= h((string) $award['label']) ?></span>
              </label>
              <strong><?= $winner ? h((string) $winner['name']) : '-' ?></strong>
            </div>
          <?php endforeach; ?>
        </div>
      </section>
    <?php elseif (is_directivo() && $isOpen): ?>
      <form method="post">
        <input type="hidden" name="action" value="save_directive_vote">
        <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
        <datalist id="matchAwardPlayers">
          <?php foreach ($participants as $player): ?>
            <?php if ($player['team_number'] === null) continue; ?>
            <option value="<?= h((string) $player['name'] . ' (#' . (int) $player['id'] . ')') ?>"></option>
          <?php endforeach; ?>
        </datalist>
        <datalist id="matchAwardGoalkeepers">
          <?php foreach ($participants as $player): ?>
            <?php if ($player['team_number'] === null || !in_array('ARQ', parse_positions_csv((string) $player['positions']), true)) continue; ?>
            <option value="<?= h((string) $player['name'] . ' (#' . (int) $player['id'] . ')') ?>"></option>
          <?php endforeach; ?>
        </datalist>

        <details class="card finish-collapse finish-valuations" open>
          <summary>
            <span>Puntajes</span>
            <small>Promedio final por junta</small>
          </summary>
          <div class="finish-valuations-body">
            <article class="finish-rating-team">
              <div class="table-wrap">
                <table class="finish-table">
                  <thead>
                    <tr>
                      <th>Jugador</th>
                      <th>Equipo</th>
                      <th>Puntaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    <?php foreach ($participants as $player): ?>
                      <?php if ($player['team_number'] === null) continue; ?>
                      <?php
                        $playerId = (int) $player['id'];
                        $ratingValue = $myRatingVotes[$playerId] ?? ($player['rating'] !== null && $player['rating'] !== '' ? (string) $player['rating'] : '5');
                      ?>
                      <tr>
                        <td data-label="Jugador"><strong><?= h((string) $player['name']) ?></strong></td>
                        <td data-label="Equipo"><small><?= h(junta_player_team_label($player, $teamLabels)) ?></small></td>
                        <td data-label="Puntaje">
                          <input class="finish-number-input" type="number" min="1" max="10" step="0.5" name="rating[<?= $playerId ?>]" value="<?= h($ratingValue) ?>" required>
                        </td>
                      </tr>
                    <?php endforeach; ?>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </details>

        <details class="card finish-collapse finish-awards" open>
          <summary>
            <span>Premios</span>
            <small>Gana quien tenga mas votos</small>
          </summary>
          <p class="small-muted">En caso de empate define: mas promedio de junta, mas goles y luego nombre alfabetico.</p>
          <div class="award-grid">
            <?php foreach ($awardDefinitions as $code => $award): ?>
              <div class="award-field">
                <label for="award-<?= h($code) ?>">
                  <span class="award-icon" title="<?= h((string) $award['label']) ?>"><?= h((string) $award['icon']) ?></span>
                  <span><?= h((string) $award['label']) ?></span>
                </label>
                <input id="award-<?= h($code) ?>" type="text" list="<?= $code === 'keeper' ? 'matchAwardGoalkeepers' : 'matchAwardPlayers' ?>" name="awards[<?= h($code) ?>]" value="<?= h(junta_award_value($myAwardVotes, $code)) ?>" placeholder="Buscar jugador">
              </div>
            <?php endforeach; ?>
          </div>
        </details>

        <div class="btn-row finish-valuations-actions">
          <button class="btn btn-primary" type="submit">Enviar voto</button>
        </div>
      </form>
    <?php else: ?>
      <section class="card">
        <p class="small-muted">La votacion no esta abierta para este usuario o ya termino el plazo. Al refrescar la pagina se revisa si corresponde publicar.</p>
      </section>
    <?php endif; ?>
  <?php endif; ?>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
