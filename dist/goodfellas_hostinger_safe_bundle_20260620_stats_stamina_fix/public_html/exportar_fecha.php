<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/awards.php';

require_admin();

$pdo = db();
ensure_control_schema();

$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$mode = strtolower(trim((string) ($_GET['mode'] ?? 'completo')));
if (!in_array($mode, ['completo', 'convocados'], true)) {
    $mode = 'completo';
}

$match = repo_match_by_id($matchId);
if (!$match) {
    http_response_code(404);
    echo 'Fecha no encontrada.';
    exit;
}

function export_match_safe_filename(string $value): string
{
    $value = trim($value);
    $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
    if (is_string($ascii) && $ascii !== '') {
        $value = $ascii;
    }
    $value = strtolower($value);
    $value = preg_replace('/[^a-z0-9]+/', '-', $value) ?? '';
    $value = trim($value, '-');
    return $value !== '' ? $value : 'fecha';
}

function export_match_csv_row($handle, array $row): void
{
    fputcsv($handle, $row, ';');
}

function export_match_court_label(array $match): string
{
    if (empty($match['rental_court_id'])) {
        return '';
    }
    $stmt = db()->prepare('SELECT court_key, place FROM rental_courts WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => (int) $match['rental_court_id']]);
    $court = $stmt->fetch();
    if (!$court) {
        return '';
    }
    $key = trim((string) ($court['court_key'] ?? ''));
    $place = trim((string) ($court['place'] ?? ''));
    return trim($key . ($key !== '' && $place !== '' ? ' - ' : '') . $place);
}

function export_match_awards(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT ma.award_code, p.name AS player_name
         FROM match_awards ma
         INNER JOIN players p ON p.id = ma.player_id
         WHERE ma.match_id = :mid
         ORDER BY ma.award_code ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    return $stmt->fetchAll();
}

function export_match_director_ratings(PDO $pdo, int $matchId): array
{
    if (!schema_table_exists($pdo, 'match_director_rating_votes')) {
        return [];
    }

    $stmt = $pdo->prepare(
        'SELECT player_id, ROUND(AVG(rating), 1) AS avg_rating, COUNT(*) AS vote_count
         FROM match_director_rating_votes
         WHERE match_id = :mid
         GROUP BY player_id'
    );
    $stmt->execute(['mid' => $matchId]);
    $ratings = [];
    foreach ($stmt->fetchAll() as $row) {
        $ratings[(int) $row['player_id']] = [
            'avg_rating' => $row['avg_rating'] !== null ? (float) $row['avg_rating'] : null,
            'vote_count' => (int) ($row['vote_count'] ?? 0),
        ];
    }
    return $ratings;
}

$participants = repo_match_participants($matchId);
$teams = repo_match_teams($matchId);
$teamLabels = repo_match_team_labels($match, $teams);
$awards = export_match_awards($matchId);
$directorRatings = export_match_director_ratings($pdo, $matchId);
$awardLabels = match_award_definitions();
$courtLabel = export_match_court_label($match);
$matchTitle = trim((string) ($match['title'] ?? '')) ?: ('Fecha #' . $matchId);
$dateSlug = date('Ymd-His', strtotime((string) ($match['match_date'] ?? 'now')));
$filename = export_match_safe_filename($matchTitle) . '-' . $dateSlug . '-' . $mode . '.csv';

header('Content-Type: text/csv; charset=UTF-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$out = fopen('php://output', 'w');
if (!is_resource($out)) {
    exit;
}

fwrite($out, "\xEF\xBB\xBF");

export_match_csv_row($out, ['SECCION', 'CAMPO', 'VALOR']);
export_match_csv_row($out, ['Resumen', 'ID fecha', (string) $matchId]);
export_match_csv_row($out, ['Resumen', 'Titulo', $matchTitle]);
export_match_csv_row($out, ['Resumen', 'Fecha', date('d/m/Y H:i', strtotime((string) $match['match_date']))]);
export_match_csv_row($out, ['Resumen', 'Estado', (string) ($match['status'] ?? '')]);
export_match_csv_row($out, ['Resumen', 'Modo sorteo', (string) ($match['draw_mode'] ?? '')]);
export_match_csv_row($out, ['Resumen', 'Cancha', $courtLabel]);
export_match_csv_row($out, ['Resumen', 'Equipos', (string) ($match['num_teams'] ?? '')]);
export_match_csv_row($out, ['Resumen', 'Jugadores por equipo', (string) ($match['players_per_team'] ?? '')]);
export_match_csv_row($out, ['Resumen', 'Convocados', (string) count($participants)]);
export_match_csv_row($out, []);

if ($mode === 'completo' && $teams) {
    export_match_csv_row($out, ['EQUIPOS']);
    export_match_csv_row($out, ['Equipo', 'Nombre', 'Color', 'Formacion', 'Puntos', 'Goles']);
    foreach ($teams as $team) {
        $teamNumber = (int) ($team['team_number'] ?? 0);
        export_match_csv_row($out, [
            (string) $teamNumber,
            $teamLabels[$teamNumber] ?? (string) ($team['team_name'] ?? ''),
            (string) ($team['color_name'] ?? ''),
            (string) ($team['formation_name'] ?? ''),
            number_format((float) ($team['total_skill'] ?? 0), 1, '.', ''),
            (string) ($team['goals'] ?? 0),
        ]);
    }
    export_match_csv_row($out, []);
}

export_match_csv_row($out, ['JUGADORES']);
export_match_csv_row($out, [
    'Jugador ID',
    'Nombre',
    'Posiciones',
    'Pace',
    'General',
    'Tecnica',
    'Velocidad',
    'Resistencia',
    'Solidez',
    'Ataque',
    'Juego equipo',
    'Mentalidad',
    'Regularidad',
    'Arquero',
    'Equipo',
    'Posicion asignada',
    'Orden equipo',
    'Orden linea',
    'Goles',
    'Puntaje partido',
    'Promedio votos',
    'Cantidad votos',
]);

foreach ($participants as $player) {
    $teamNumber = $player['team_number'] !== null ? (int) $player['team_number'] : 0;
    $directorRating = $directorRatings[(int) ($player['id'] ?? 0)] ?? null;
    export_match_csv_row($out, [
        (string) ($player['id'] ?? ''),
        (string) ($player['name'] ?? ''),
        (string) ($player['positions'] ?? ''),
        (string) ($player['pace'] ?? ''),
        number_format(player_overall_rating($player), 1, '.', ''),
        number_format(player_effective_stat($player, 'technique'), 1, '.', ''),
        number_format(player_effective_stat($player, 'rhythm'), 1, '.', ''),
        number_format(player_effective_stat($player, 'stamina'), 1, '.', ''),
        number_format(player_effective_stat($player, 'defense_physical'), 1, '.', ''),
        number_format(player_effective_stat($player, 'attack'), 1, '.', ''),
        number_format(player_effective_stat($player, 'teamwork'), 1, '.', ''),
        number_format(player_effective_stat($player, 'mentality'), 1, '.', ''),
        number_format(player_effective_stat($player, 'regularity'), 1, '.', ''),
        $player['goalkeeper_skill'] !== null ? number_format((float) $player['goalkeeper_skill'], 1, '.', '') : '',
        $teamNumber > 0 ? ($teamLabels[$teamNumber] ?? ('Equipo ' . $teamNumber)) : '',
        (string) ($player['assigned_position'] ?? ''),
        $player['lineup_order'] !== null ? (string) $player['lineup_order'] : '',
        $player['formation_line_order'] !== null ? (string) $player['formation_line_order'] : '',
        (string) ($player['goals'] ?? 0),
        $player['rating'] !== null ? number_format((float) $player['rating'], 1, '.', '') : '',
        $directorRating && $directorRating['avg_rating'] !== null ? number_format((float) $directorRating['avg_rating'], 1, '.', '') : '',
        $directorRating ? (string) $directorRating['vote_count'] : '',
    ]);
}

if ($mode === 'completo') {
    export_match_csv_row($out, []);
    export_match_csv_row($out, ['PREMIOS']);
    export_match_csv_row($out, ['Premio', 'Jugador']);
    foreach ($awards as $award) {
        $code = (string) ($award['award_code'] ?? '');
        $label = (string) ($awardLabels[$code]['label'] ?? $code);
        export_match_csv_row($out, [$label, (string) ($award['player_name'] ?? '')]);
    }
}

fclose($out);
