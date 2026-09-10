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
$voteDrawPayload = [
    'matchId' => $matchId,
    'matchLabel' => (string) ($match['title'] ?: ('Fecha #' . $match['id'])),
    'deadline' => date('d/m/Y H:i', $deadline),
    'selectedOptionId' => $selectedOptionId,
    'currentPlayerId' => current_player_id(),
    'options' => array_map(
        static fn(array $option): array => [
            'id' => (int) $option['id'],
            'option_number' => (int) $option['option_number'],
            'total_diff' => (float) $option['total_diff'],
            'vote_count' => (int) ($option['vote_count'] ?? 0),
            'teams' => $option['teams'] ?? [],
        ],
        $options
    ),
];

$title = 'Votar sorteo | ' . APP_NAME;
$activePage = 'perfil.php';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="votar_sorteo_page">
  <script type="application/json">
    <?= json_encode($voteDrawPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
