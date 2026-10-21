<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/live_match_repository.php';

$isApi = isset($_GET['api']);
function live_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    exit;
}
if ($isApi && !is_admin() && !is_directivo()) live_json(['message' => 'Tu sesión venció. Volvé a ingresar.'], 401);
require_directivo_or_admin();
ensure_control_schema();
ensure_live_match_schema();
$matchId = (int) ($_GET['match_id'] ?? 0);
$match = repo_match_by_id($matchId);
if (!$match || (empty($match['dynamic_fixture']) && $match['status'] !== 'finalizado') || !in_array((int) $match['num_teams'], [3, 4], true)) {
    if ($isApi) live_json(['message' => 'Esta fecha no usa el fixture dinámico.'], 404);
    flash('error', 'Esta fecha no usa el fixture dinámico.');
    redirect('editar_partidos.php');
}
$_SESSION['live_csrf'] ??= bin2hex(random_bytes(32));
$csrf = $_SESSION['live_csrf'];
$teamRows = repo_match_teams($matchId);
$teams = array_map(static fn(array $t): int => (int) $t['team_number'], $teamRows);
$participants = repo_match_participants($matchId);
$labels = repo_match_team_labels($match, $teamRows);
if ($isApi) {
    $pdo = db();
    try {
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $input = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
            if (!is_array($input) || !hash_equals($csrf, (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) live_json(['message' => 'La sesión cambió. Recargá la página.'], 403);
            $pdo->beginTransaction();
            // Lock the parent even before a live session exists; prevent double starts and lost goals.
            $lock = $pdo->prepare('SELECT * FROM matches WHERE id = ? FOR UPDATE');
            $lock->execute([$matchId]);
            $match = $lock->fetch();
            $action = (string) ($input['action'] ?? '');
            $correction = in_array($action, ['edit_goal', 'correct_game', 'add_finished_game', 'delete_game', 'add_finished_goal', 'remove_goal', 'set_pending_scorers'], true);
            $teamRows = repo_match_teams($matchId);
            $teams = array_map(static fn(array $t): int => (int) $t['team_number'], $teamRows);
            $participants = repo_match_participants($matchId);
            if (!$match || (empty($match['dynamic_fixture']) && !($correction && $match['status'] === 'finalizado')) || !repo_match_teams_are_public($match) || !in_array($match['status'], $correction ? ['sorteado', 'finalizado'] : ['sorteado'], true) || count($teams) !== (int) $match['num_teams']) throw new RuntimeException('La fecha debe estar publicada y tener todos sus equipos para jugar.');
            $session = live_load_session($match);
            if (($input['revision'] ?? -1) !== $session['revision']) {
                $pdo->rollBack();
                live_json(['message' => 'Otra pantalla actualizó el partido. Revisá los datos; si hay un diálogo abierto, cerralo y volvé a abrir la acción.', 'session' => $session, 'server_now' => microtime(true)], 409);
            }
            $state = live_apply_action($session['state'], $action, $input, $teams, $participants);
            $revision = $session['revision'] + 1;
            live_store_session($matchId, $state, $revision);
            if (in_array($action, ['finish', 'edit_goal', 'remove_goal', 'correct_game', 'close', 'add_finished_game', 'delete_game', 'add_finished_goal', 'set_pending_scorers'], true)) {
                live_sync_totals($matchId, $state, $teams, $participants);
                $pdo->prepare('UPDATE matches SET result_saved_at = NOW() WHERE id = ?')->execute([$matchId]);
            }
            if ($action === 'duration') $pdo->prepare('UPDATE matches SET game_duration_minutes = ? WHERE id = ?')->execute([intdiv($state['duration'], 60), $matchId]);
            if ($action === 'close') $pdo->prepare("UPDATE matches SET status = 'finalizado', finalized_at = COALESCE(finalized_at, NOW()), result_saved_at = NOW() WHERE id = ?")->execute([$matchId]);
            $pdo->commit();
            live_json(['session' => ['state' => $state, 'revision' => $revision], 'server_now' => microtime(true)]);
        }
        if ($_SERVER['REQUEST_METHOD'] !== 'GET') live_json(['message' => 'Método no permitido.'], 405);
        live_json(['session' => live_load_session($match), 'server_now' => microtime(true)]);
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($error instanceof PDOException) error_log('Live match save failed: ' . $error->getMessage());
        live_json(['message' => $error instanceof RuntimeException && !($error instanceof PDOException) ? $error->getMessage() : 'No se pudo guardar. Recargá para verificar antes de reintentar.'], 422);
    }
}
$payload = ['matchId' => $matchId, 'title' => $match['title'] ?: 'Fecha #' . $matchId,
    'teams' => array_map(static function (array $team) use ($labels): array {
        $id = (int) $team['team_number'];
        $color = strtoupper(trim((string) ($team['color_name'] ?? '')));
        $name = $labels[$id] ?? 'Equipo ' . $id;
        if ($color !== '') {
            $suffix = ' (' . $color . ')';
            if (str_ends_with($name, $suffix)) $name = substr($name, 0, -strlen($suffix));
            if ($name === 'Equipo') $name .= ' ' . mb_convert_case($color, MB_CASE_TITLE, 'UTF-8');
        }
        return ['id' => $id, 'label' => $name, 'color' => $color];
    }, $teamRows),
    'players' => array_map(static fn(array $p): array => ['id' => (int) $p['id'], 'name' => $p['name'], 'team' => (int) $p['team_number']], array_values(array_filter($participants, static fn(array $p): bool => $p['team_number'] !== null))),
    'session' => live_load_session($match), 'serverNow' => microtime(true), 'csrf' => $csrf,
    'canPlay' => repo_match_teams_are_public($match) && $match['status'] === 'sorteado' && count($teams) === (int) $match['num_teams'],
    'canCorrect' => repo_match_teams_are_public($match) && in_array($match['status'], ['sorteado', 'finalizado'], true),
    'isAdmin' => is_admin()];
$title = 'Partidos en vivo | ' . APP_NAME;
$activePage = 'editar_partidos.php';
require __DIR__ . '/includes/header.php';
?>
<link rel="stylesheet" href="assets/partidos-en-vivo.css?v=<?= h((string) filemtime(__DIR__ . '/assets/partidos-en-vivo.css')) ?>">
<div data-react-root data-react-island="live_matches"><script type="application/json"><?= json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script></div>
<noscript>Activá JavaScript para usar el marcador y el cronómetro.</noscript>
<?php require __DIR__ . '/includes/footer.php'; ?>
