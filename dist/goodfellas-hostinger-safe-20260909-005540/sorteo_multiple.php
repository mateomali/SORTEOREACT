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
$multiDrawPayload = [
    'matchId' => $matchId,
    'matchLabel' => (string) ($match['title'] ?: ('Fecha #' . $match['id'])),
    'deadline' => date('d/m/Y H:i', $deadline),
    'participantsCount' => count($participants),
    'drawCount' => (int) ($match['multi_draw_count'] ?? 3),
    'lockMinutes' => (int) ($match['multi_draw_lock_minutes'] ?? 60),
    'winnerId' => $winnerId,
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

$title = 'Sorteo multiple | ' . APP_NAME;
$activePage = 'editar_partidos.php';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="sorteo_multiple_page">
  <script type="application/json">
    <?= json_encode($multiDrawPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
