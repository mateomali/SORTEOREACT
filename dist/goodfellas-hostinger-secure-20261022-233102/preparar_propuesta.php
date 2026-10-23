<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/director_proposals.php';
require_directivo_or_admin();
ensure_director_proposals_schema();
header('Content-Type: application/json; charset=utf-8');
try {
    if (!is_directivo() || $_SERVER['REQUEST_METHOD'] !== 'POST') throw new RuntimeException('Acceso no permitido.');
    $data = json_decode((string) file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    director_proposal_check_csrf((string) ($data['proposal_csrf'] ?? ''));
    $mid = (int) ($data['match_id'] ?? 0);
    $match = repo_match_by_id($mid);
    if (!$match) throw new RuntimeException('Fecha no encontrada.');
    director_proposal_assert_open($match);
    $teams = $data['teams'] ?? [];
    if (!is_array($teams) || count($teams) !== (int) $match['num_teams']) throw new RuntimeException('Cantidad de equipos invalida.');
    $ids = [];
    foreach ($teams as $team) {
        if (!is_array($team['players'] ?? null) || count($team['players']) !== (int) $match['players_per_team']) throw new RuntimeException('Completa todos los equipos.');
        foreach ($team['players'] as $player) $ids[] = (int) ($player['id'] ?? 0);
    }
    sort($ids);
    if ($ids !== multiple_draw_participant_ids($mid)) throw new RuntimeException('Inclui todos los convocados una sola vez.');
    $_SESSION['proposal_manual_drafts'][current_user_id()][$mid] = $teams;
    echo json_encode(['ok' => true, 'message' => 'Equipos preparados. Acomoda la formacion antes de guardar tu propuesta.', 'next_url' => 'sorteo_legacy_csv.php?match_id=' . $mid . '&proposal=1&manual_draft=1']);
} catch (Throwable $e) { http_response_code(422); echo json_encode(['ok' => false, 'message' => $e->getMessage()]); }
