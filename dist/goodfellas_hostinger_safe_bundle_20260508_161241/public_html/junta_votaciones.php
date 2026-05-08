<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/directivos.php';

ensure_control_schema();
ensure_match_awards_schema();
ensure_directivos_schema();

function junta_current_guest_vote_invite(): ?array
{
    $inviteId = (int) ($_SESSION['guest_vote_invite_id'] ?? 0);
    if ($inviteId <= 0) {
        return null;
    }
    $invite = directive_vote_invite_by_id($inviteId);
    if (!$invite) {
        unset($_SESSION['guest_vote_invite_id'], $_SESSION['guest_vote_match_id'], $_SESSION['guest_vote_voter_id'], $_SESSION['guest_vote_name']);
        return null;
    }
    return $invite;
}

$guestVoteInvite = junta_current_guest_vote_invite();
$isGuestVoter = $guestVoteInvite !== null;
if (!is_admin() && !is_directivo() && !$isGuestVoter) {
    flash('error', 'Debes ingresar como directivo, admin o con token de votacion.');
    redirect('login.php?next=' . rawurlencode('junta_votaciones.php'));
}

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

function junta_publication_reason_label(string $reason): string
{
    return match ($reason) {
        'all_voted' => 'voto completo de la junta',
        'admin' => 'cierre manual del admin',
        default => 'fin de plazo',
    };
}

try {
    directive_publish_due_results();
} catch (Throwable $e) {
    flash('error', 'No se pudo revisar la publicacion automatica: ' . $e->getMessage());
}
$matches = repo_matches("m.status = 'finalizado'");

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'force_publish_directive_vote') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $match = repo_match_by_id($matchId);
    try {
        if (!is_admin()) {
            throw new RuntimeException('Solo el admin puede finalizar la votacion manualmente.');
        }
        if (!$match || !directive_match_ready_for_voting($match)) {
            throw new RuntimeException('Primero hay que finalizar el partido con el resultado cargado.');
        }
        $published = directive_publish_match_results($match, repo_match_participants($matchId), 'admin', true);
        flash($published ? 'success' : 'info', $published ? 'Votacion finalizada y resultados publicados.' : 'La votacion ya estaba publicada.');
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('junta_votaciones.php?match_id=' . $matchId . '#junta-voto-estado');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'create_vote_invite') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $playerId = (int) ($_POST['player_id'] ?? 0);
    try {
        if (!is_admin()) {
            throw new RuntimeException('Solo el admin puede invitar jugadores a votar.');
        }
        $invite = directive_create_vote_invite($matchId, $playerId);
        flash('success', 'Token para ' . (string) $invite['player_name'] . ': ' . (string) $invite['token']);
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('junta_votaciones.php?match_id=' . $matchId);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_directive_vote') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $match = repo_match_by_id($matchId);
    $redirectHash = '';
    try {
        $currentVoterId = is_directivo() ? current_directivo_id() : (int) ($_SESSION['guest_vote_voter_id'] ?? 0);
        $currentGuestMatchId = (int) ($_SESSION['guest_vote_match_id'] ?? 0);
        if (!is_directivo() && (!$isGuestVoter || $currentGuestMatchId !== $matchId || $currentVoterId <= 0)) {
            throw new RuntimeException('Necesitas ingresar con un token valido para votar.');
        }
        if (!$match || !directive_match_ready_for_voting($match)) {
            throw new RuntimeException('Primero hay que finalizar el partido con el resultado cargado.');
        }
        if (!directive_voting_is_open($match)) {
            throw new RuntimeException('La votacion de esta fecha ya no esta abierta.');
        }
        $participants = repo_match_participants($matchId);
        $participantIds = junta_participant_ids($participants);
        directive_save_vote(
            $matchId,
            $currentVoterId,
            is_array($_POST['rating'] ?? null) ? $_POST['rating'] : [],
            is_array($_POST['awards'] ?? null) ? $_POST['awards'] : [],
            $participantIds
        );
        $published = directive_publish_if_ready($match, $participants);
        $redirectHash = '&vote_saved=1#junta-voto-estado';
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('junta_votaciones.php?match_id=' . $matchId . $redirectHash);
}

$matchSummaries = [];
$openVoteMatches = [];
$historyVoteMatches = [];
foreach ($matches as $match) {
    if (!directive_match_ready_for_voting($match)) {
        continue;
    }
    $matchId = (int) $match['id'];
    $matchParticipants = repo_match_participants($matchId);
    $matchParticipantCount = count(junta_participant_ids($matchParticipants));
    $matchPublication = directive_publication($matchId);
    $matchStatus = directive_vote_status($matchId, $matchParticipantCount);
    $matchDeadline = directive_voting_deadline($match);
    $matchOpen = directive_voting_is_open($match);
    $matchDirectivoComplete = is_directivo()
        ? directive_member_completed_match($matchId, current_directivo_id(), $matchParticipantCount)
        : ($isGuestVoter && (int) $guestVoteInvite['match_id'] === $matchId
            ? directive_member_completed_match($matchId, (int) $guestVoteInvite['voter_member_id'], $matchParticipantCount)
            : false);
    $summary = [
        'match' => $match,
        'participants_count' => $matchParticipantCount,
        'publication' => $matchPublication,
        'status' => $matchStatus,
        'deadline' => $matchDeadline,
        'open' => $matchOpen,
        'directivo_complete' => $matchDirectivoComplete,
    ];
    $matchSummaries[$matchId] = $summary;
    if ($isGuestVoter && (int) $guestVoteInvite['match_id'] !== $matchId) {
        continue;
    }
    if ($matchOpen) {
        $openVoteMatches[] = $summary;
    } elseif (is_admin() || $matchDirectivoComplete) {
        $historyVoteMatches[] = $summary;
    }
}

$selectedMatchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
if ($selectedMatchId <= 0 && $openVoteMatches) {
    $selectedMatchId = (int) $openVoteMatches[0]['match']['id'];
}
if ($selectedMatchId <= 0 && $historyVoteMatches) {
    $selectedMatchId = (int) $historyVoteMatches[0]['match']['id'];
}
if ($selectedMatchId <= 0 && $matches) {
    $selectedMatchId = (int) $matches[0]['id'];
}
$selectedMatch = $selectedMatchId > 0 ? repo_match_by_id($selectedMatchId) : null;
if ($selectedMatch && !directive_match_ready_for_voting($selectedMatch)) {
    $selectedMatch = null;
}
if ($selectedMatch && $isGuestVoter && (int) $guestVoteInvite['match_id'] !== (int) $selectedMatch['id']) {
    redirect('junta_votaciones.php?match_id=' . (int) $guestVoteInvite['match_id']);
}

$participants = $selectedMatch ? repo_match_participants((int) $selectedMatch['id']) : [];
$participantIds = junta_participant_ids($participants);
$participantCount = count($participantIds);
$teams = $selectedMatch ? repo_match_teams((int) $selectedMatch['id']) : [];
$teamLabels = $selectedMatch ? repo_match_team_labels($selectedMatch, $teams) : [];
$awardDefinitions = award_definitions();
$publication = $selectedMatch ? directive_publication((int) $selectedMatch['id']) : null;
$voteStatus = $selectedMatch ? directive_vote_status((int) $selectedMatch['id'], $participantCount) : ['eligible' => 0, 'submitted' => 0];
$voteProgressPercent = (int) ($voteStatus['eligible'] ?? 0) > 0
    ? min(100, (int) round(((int) ($voteStatus['submitted'] ?? 0) / (int) $voteStatus['eligible']) * 100))
    : 0;
$inviteRows = (is_admin() && $selectedMatch) ? directive_vote_invites_for_match((int) $selectedMatch['id'], $participantCount) : [];
$invitePlayerOptions = [];
if (is_admin() && $selectedMatch) {
    $invitedPlayerIds = array_flip(array_map(static fn(array $invite): int => (int) $invite['player_id'], $inviteRows));
    $invitePlayerOptions = array_values(array_filter(
        repo_all_players(true),
        static fn(array $player): bool => !isset($invitedPlayerIds[(int) $player['id']])
    ));
}
$deadline = $selectedMatch ? directive_voting_deadline($selectedMatch) : null;
$isOpen = $selectedMatch ? directive_voting_is_open($selectedMatch) : false;
$currentVoteMemberId = is_directivo() ? current_directivo_id() : ($isGuestVoter ? (int) $guestVoteInvite['voter_member_id'] : 0);
$myRatingVotes = ($currentVoteMemberId > 0 && $selectedMatch) ? directive_member_rating_votes((int) $selectedMatch['id'], $currentVoteMemberId) : [];
$myAwardVotes = ($currentVoteMemberId > 0 && $selectedMatch) ? directive_member_award_votes((int) $selectedMatch['id'], $currentVoteMemberId) : [];
$myVoteComplete = ($currentVoteMemberId > 0 && $selectedMatch) ? directive_member_completed_match((int) $selectedMatch['id'], $currentVoteMemberId, $participantCount) : false;
$savedAwards = $selectedMatch ? repo_match_awards((int) $selectedMatch['id']) : [];
$shouldReturnHomeAfterVote = (string) ($_GET['vote_saved'] ?? '') === '1';

$title = 'Junta directiva | ' . APP_NAME;
$activePage = 'junta_votaciones.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head junta-page-head">
  <div>
    <h1>Junta directiva</h1>
    <p class="small-muted">Votacion de puntajes y premios de fechas finalizadas.</p>
  </div>
  <?php if (is_admin()): ?>
    <a class="btn btn-muted" href="directivos.php">Administrar directivos</a>
  <?php endif; ?>
</section>

<?php if (!$matches): ?>
  <section class="junta-panel">
    <p class="small-muted">No hay fechas finalizadas para votar.</p>
  </section>
<?php else: ?>
  <section class="junta-panel mb-3">
    <div class="junta-panel-head">
      <div>
        <h3>Votaciones abiertas</h3>
        <p class="small-muted">Fechas con votacion activa y tiempo disponible.</p>
      </div>
      <span class="chip"><?= h((string) count($openVoteMatches)) ?> abiertas</span>
    </div>
    <?php if (!$openVoteMatches): ?>
      <p class="small-muted">No hay votaciones abiertas en este momento.</p>
    <?php else: ?>
      <div class="junta-vote-grid">
        <?php foreach ($openVoteMatches as $summary): ?>
          <?php
            $match = $summary['match'];
            $matchId = (int) $match['id'];
            $matchStatus = $summary['status'];
            $matchDeadline = $summary['deadline'];
          ?>
          <a class="junta-vote-card <?= $selectedMatchId === $matchId ? 'active' : '' ?>" href="junta_votaciones.php?match_id=<?= $matchId ?>">
            <h3><?= h(junta_match_label($match)) ?></h3>
            <p class="small-muted"><?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?></p>
            <div class="stats-grid mt-2">
              <span class="chip"><?= (int) $matchStatus['submitted'] ?>/<?= (int) $matchStatus['eligible'] ?> votos</span>
              <span class="chip">Abierta</span>
            </div>
            <small class="small-muted">Cierre: <?= h(junta_format_datetime($matchDeadline)) ?></small>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>

  <details class="junta-panel junta-history finish-collapse mb-3">
    <summary>
      <span>Historial de votaciones</span>
      <small><?= h((string) count($historyVoteMatches)) ?> fechas</small>
    </summary>
    <?php if (!$historyVoteMatches): ?>
      <p class="small-muted junta-history-empty">Todavia no hay historial de votaciones cerradas.</p>
    <?php else: ?>
      <div class="match-list junta-history-list">
        <?php foreach ($historyVoteMatches as $summary): ?>
          <?php
            $match = $summary['match'];
            $matchId = (int) $match['id'];
            $matchStatus = $summary['status'];
            $matchPublication = $summary['publication'];
            $historyStatus = $matchPublication
                ? ('Publicado por ' . junta_publication_reason_label((string) $matchPublication['reason']))
                : ($summary['directivo_complete'] ? 'Tu voto cargado' : 'Sin publicar');
          ?>
          <a class="match-list-item <?= $selectedMatchId === $matchId ? 'active' : '' ?>" href="junta_votaciones.php?match_id=<?= $matchId ?>">
            <span>
              <strong><?= h(junta_match_label($match)) ?></strong>
              <small><?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?> | <?= h($historyStatus) ?></small>
            </span>
            <span class="match-list-side">
              <span class="badge"><?= (int) $matchStatus['submitted'] ?>/<?= (int) $matchStatus['eligible'] ?> votos</span>
            </span>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </details>

  <?php if ($selectedMatch): ?>
    <section class="junta-panel junta-status-panel mb-3">
      <div class="junta-panel-head">
        <div>
          <h3><?= h(junta_match_label($selectedMatch)) ?></h3>
          <p class="small-muted">
            <?= h((string) $voteStatus['submitted']) ?>/<?= h((string) $voteStatus['eligible']) ?> directivos votaron.
            Cierre automatico: <?= h(junta_format_datetime($deadline)) ?>.
          </p>
          <div class="junta-vote-progress" aria-label="Progreso de votacion <?= h((string) $voteProgressPercent) ?>%">
            <span style="width: <?= h((string) $voteProgressPercent) ?>%"></span>
          </div>
        </div>
        <span class="chip"><?= $publication ? 'Resultados publicados' : ($isOpen ? 'Votacion abierta' : 'En cierre automatico') ?></span>
      </div>
      <?php if (is_admin() && !$publication): ?>
        <form method="post" class="junta-admin-actions mb-3">
          <input type="hidden" name="action" value="force_publish_directive_vote">
          <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
          <button class="btn btn-warning" type="submit" data-confirm="Finalizar la votacion y publicar resultados con los votos cargados hasta ahora?">Finalizar votacion</button>
        </form>
      <?php endif; ?>
      <?php if ($publication): ?>
        <p id="junta-voto-estado" class="<?= $shouldReturnHomeAfterVote ? 'flash flash-success' : 'small-muted' ?>" tabindex="-1" <?= $shouldReturnHomeAfterVote ? 'role="status" data-junta-return-home="1"' : '' ?>><?= h($shouldReturnHomeAfterVote ? 'gracias por votar, retornando al sitio...' : ('Publicado el ' . date('d/m/Y H:i', strtotime((string) $publication['published_at'])) . ' por ' . junta_publication_reason_label((string) $publication['reason']) . '.')) ?></p>
      <?php elseif ($myVoteComplete): ?>
        <p id="junta-voto-estado" class="flash flash-success" tabindex="-1" role="status" <?= $shouldReturnHomeAfterVote ? 'data-junta-return-home="1"' : '' ?>><?= h($shouldReturnHomeAfterVote ? 'gracias por votar, retornando al sitio...' : 'Tu voto esta cargado. Los resultados se publican cuando vote toda la junta o al cumplirse el plazo.') ?></p>
      <?php elseif (!is_directivo()): ?>
        <p class="flash flash-info"><?= is_admin() ? 'Como admin podes ver el estado, invitar jugadores y cerrar la votacion.' : 'Ingresa los puntajes y premios con tu token de invitacion.' ?></p>
      <?php endif; ?>
    </section>

    <?php if (is_admin() && !$publication && $isOpen): ?>
      <section class="junta-panel junta-invite-panel mb-3">
        <div class="junta-panel-head">
          <div>
            <h3>Invitar jugadores a votar</h3>
            <p class="small-muted">Genera tokens numericos de 5 cifras. Cada token sirve solo para esta fecha.</p>
          </div>
        </div>
        <?php if ($invitePlayerOptions): ?>
          <form method="post" class="junta-invite-form mb-3">
            <input type="hidden" name="action" value="create_vote_invite">
            <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
            <div class="form-row">
              <label>Jugador invitado</label>
              <select name="player_id" required>
                <option value="">Seleccionar jugador</option>
                <?php foreach ($invitePlayerOptions as $player): ?>
                  <option value="<?= (int) $player['id'] ?>"><?= h((string) $player['name']) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="btn-row">
              <button class="btn btn-primary" type="submit" data-confirm="Generar token para este jugador y esta votacion?">Generar token</button>
            </div>
          </form>
        <?php else: ?>
          <p class="small-muted">Todos los jugadores activos ya tienen token para esta votacion.</p>
        <?php endif; ?>
        <?php if (!$inviteRows): ?>
          <p class="small-muted">Todavia no hay invitados para esta votacion.</p>
        <?php else: ?>
          <div class="match-list">
            <?php foreach ($inviteRows as $invite): ?>
              <div class="match-list-item">
                <span>
                  <strong><?= h((string) $invite['player_name']) ?></strong>
                  <small><span class="badge <?= ((bool) $invite['vote_complete']) ? 'done' : 'warn' ?>"><?= ((bool) $invite['vote_complete']) ? 'Usado' : 'Pendiente' ?></span></small>
                </span>
                <span class="match-list-side">
                  <span class="badge"><?= h((string) $invite['token']) ?></span>
                  <button class="btn btn-muted token-copy-btn" type="button" data-copy-token="<?= h((string) $invite['token']) ?>">Copiar</button>
                </span>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endif; ?>
      </section>
    <?php endif; ?>

    <?php if ($publication): ?>
      <section class="junta-panel mb-3">
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

      <section class="junta-panel">
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
    <?php elseif ($currentVoteMemberId > 0 && $isOpen): ?>
      <form method="post" class="junta-vote-form" data-junta-vote-submit="1">
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

        <details class="junta-panel finish-collapse finish-valuations" open>
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

        <details class="junta-panel finish-collapse finish-awards" open>
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

        <div class="junta-submit-row finish-valuations-actions">
          <button class="btn btn-primary" type="submit">Enviar voto</button>
        </div>
      </form>
    <?php else: ?>
      <section class="junta-panel">
        <p class="small-muted">La votacion no esta abierta para este usuario o ya termino el plazo. Al refrescar la pagina se revisa si corresponde publicar.</p>
      </section>
    <?php endif; ?>
  <?php endif; ?>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
