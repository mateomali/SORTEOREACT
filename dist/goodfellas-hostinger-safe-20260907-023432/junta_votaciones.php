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

function junta_summary_payload(array $summary, int $selectedMatchId): array
{
    $match = $summary['match'];
    $matchId = (int) $match['id'];
    $publication = $summary['publication'];
    $historyStatus = $publication
        ? ('Publicado por ' . junta_publication_reason_label((string) $publication['reason']))
        : ($summary['directivo_complete'] ? 'Tu voto cargado' : 'Sin publicar');

    return [
        'id' => $matchId,
        'label' => junta_match_label($match),
        'date' => date('d/m/Y H:i', strtotime((string) $match['match_date'])),
        'deadline' => junta_format_datetime($summary['deadline']),
        'submitted' => (int) ($summary['status']['submitted'] ?? 0),
        'eligible' => (int) ($summary['status']['eligible'] ?? 0),
        'selected' => $selectedMatchId === $matchId,
        'historyStatus' => $historyStatus,
    ];
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
        directive_publish_if_ready($match, $participants);
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

$voteParticipants = array_values(array_filter(
    array_map(
        static function (array $player) use ($teamLabels, $myRatingVotes): ?array {
            if ($player['team_number'] === null) {
                return null;
            }
            $playerId = (int) $player['id'];
            $ratingValue = $myRatingVotes[$playerId] ?? ($player['rating'] !== null && $player['rating'] !== '' ? (string) $player['rating'] : '5');
            return [
                'id' => $playerId,
                'name' => (string) $player['name'],
                'teamLabel' => junta_player_team_label($player, $teamLabels),
                'ratingValue' => (string) $ratingValue,
                'finalRating' => $player['rating'] !== null && $player['rating'] !== '' ? number_format((float) $player['rating'], 1) : '-',
                'awardValue' => (string) $player['name'] . ' (#' . $playerId . ')',
                'isGoalkeeper' => in_array('ARQ', parse_positions_csv((string) $player['positions']), true),
            ];
        },
        $participants
    ),
    static fn(?array $player): bool => $player !== null
));

$awardsPayload = [];
foreach ($awardDefinitions as $code => $award) {
    $winner = $savedAwards[$code] ?? null;
    $awardsPayload[] = [
        'code' => (string) $code,
        'label' => (string) $award['label'],
        'icon' => (string) $award['icon'],
        'listId' => $code === 'keeper' ? 'matchAwardGoalkeepers' : 'matchAwardPlayers',
        'value' => junta_award_value($myAwardVotes, (string) $code),
        'winner' => $winner ? (string) $winner['name'] : '-',
    ];
}

$selectedMatchPayload = null;
if ($selectedMatch) {
    $publishedMessage = '';
    if ($publication) {
        $publishedMessage = $shouldReturnHomeAfterVote
            ? 'gracias por votar, retornando al sitio...'
            : 'Publicado el ' . date('d/m/Y H:i', strtotime((string) $publication['published_at'])) . ' por ' . junta_publication_reason_label((string) $publication['reason']) . '.';
    } elseif ($myVoteComplete) {
        $publishedMessage = $shouldReturnHomeAfterVote
            ? 'gracias por votar, retornando al sitio...'
            : 'Tu voto esta cargado. Los resultados se publican cuando vote toda la junta o al cumplirse el plazo.';
    }

    $selectedMatchPayload = [
        'id' => (int) $selectedMatch['id'],
        'label' => junta_match_label($selectedMatch),
        'submitted' => (int) ($voteStatus['submitted'] ?? 0),
        'eligible' => (int) ($voteStatus['eligible'] ?? 0),
        'deadline' => junta_format_datetime($deadline),
        'progress' => $voteProgressPercent,
        'isOpen' => $isOpen,
        'publication' => $publication ? [
            'publishedAt' => date('d/m/Y H:i', strtotime((string) $publication['published_at'])),
            'reason' => junta_publication_reason_label((string) $publication['reason']),
        ] : null,
        'statusLabel' => $publication ? 'Resultados publicados' : ($isOpen ? 'Votacion abierta' : 'En cierre automatico'),
        'statusMessage' => $publishedMessage,
        'showReturnHome' => $shouldReturnHomeAfterVote && ($publication || $myVoteComplete),
        'myVoteComplete' => $myVoteComplete,
        'currentVoteMemberId' => $currentVoteMemberId,
        'isAdmin' => is_admin(),
        'isDirectivo' => is_directivo(),
        'participants' => $voteParticipants,
        'awards' => $awardsPayload,
        'inviteRows' => array_map(
            static fn(array $invite): array => [
                'player_name' => (string) $invite['player_name'],
                'token' => (string) $invite['token'],
                'vote_complete' => (bool) $invite['vote_complete'],
            ],
            $inviteRows
        ),
        'invitePlayerOptions' => array_map(
            static fn(array $player): array => [
                'id' => (int) $player['id'],
                'name' => (string) $player['name'],
            ],
            $invitePlayerOptions
        ),
    ];
}

$juntaIslandPayload = [
    'isAdmin' => is_admin(),
    'isDirectivo' => is_directivo(),
    'hasMatches' => count($matches) > 0,
    'openVoteMatches' => array_map(static fn(array $summary): array => junta_summary_payload($summary, $selectedMatchId), $openVoteMatches),
    'historyVoteMatches' => array_map(static fn(array $summary): array => junta_summary_payload($summary, $selectedMatchId), $historyVoteMatches),
    'selectedMatch' => $selectedMatchPayload,
];

$title = 'Junta directiva | ' . APP_NAME;
$activePage = 'junta_votaciones.php';
$bodyClass = 'page-junta-votaciones';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="junta_votaciones_page">
  <script type="application/json">
    <?= json_encode($juntaIslandPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
