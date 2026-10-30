<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/director_proposals.php';
require_directivo_or_admin();
$matchId = (int) ($_POST['match_id'] ?? 0);
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
try {
    director_proposal_check_csrf((string) ($_POST['proposal_csrf'] ?? ''));
    director_proposal_restart($matchId);
    flash('success', 'Tu propuesta fue borrada. Podes elegir nuevamente sorteo o armado manual.');
    redirect('crear_propuesta.php?match_id=' . $matchId);
} catch (Throwable $e) {
    flash('error', $e->getMessage());
    redirect('propuestas_equipos.php?match_id=' . $matchId);
}
