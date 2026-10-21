<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function award_definitions(bool $includeLegacy = false): array
{
    $definitions = [
        'player_of_match' => ['label' => 'Man of the Match', 'icon' => '🏆', 'type' => 'good'],
        'goal_of_week' => ['label' => 'Gol de la fecha', 'icon' => '⚽', 'type' => 'good'],
        'lyrical' => ['label' => 'Lírico', 'icon' => '🧙🏼‍♂️', 'type' => 'good'],
        'pelusa' => ['label' => 'Pelusa', 'icon' => '🔟', 'type' => 'good'],
        'bochini' => ['label' => 'Bochini', 'icon' => '👴🏼', 'type' => 'good'],
        'masterful_pass' => ['label' => 'Pase magistral', 'icon' => '🎯', 'type' => 'good'],
        'marshal' => ['label' => 'El Mariscal', 'icon' => '🪓', 'type' => 'good'],
        'wall' => ['label' => 'El muro', 'icon' => '🪖', 'type' => 'good'],
        'tractor' => ['label' => 'El tractor', 'icon' => '🚜', 'type' => 'good'],
        'capocannoniere' => ['label' => 'Capocannoniere', 'icon' => '🇮🇹', 'type' => 'good'],
        'keeper' => ['label' => 'Golero imbatible', 'icon' => '🥅', 'type' => 'good'],
        'terminator' => ['label' => 'Terminator', 'icon' => '🦾', 'type' => 'bad'],
        'guinda' => ['label' => 'La guinda', 'icon' => '🏈', 'type' => 'good'],
        'golosa' => ['label' => 'La golosa', 'icon' => '🏳️‍🌈', 'type' => 'bad'],
        'putita' => ['label' => 'La putita', 'icon' => '💋', 'type' => 'bad'],
        'chenemigo' => ['label' => 'Chenemigo', 'icon' => '💩', 'type' => 'bad'],
        'goodfellas' => ['label' => 'Goodfellas', 'icon' => '🧉', 'type' => 'good'],
    ];
    if ($includeLegacy) {
        $definitions['ghost'] = ['label' => 'El fantasma', 'icon' => '👻', 'type' => 'bad'];
    }
    return $definitions;
}

function award_descriptions(): array
{
    return [
        'player_of_match' => 'Jugador del partido.',
        'goal_of_week' => 'Mejor gol.',
        'lyrical' => 'Jugada de fantasía.',
        'pelusa' => 'Segundo mejor jugador, mejor jugador del equipo perdedor.',
        'bochini' => 'Jugador con alto IQ, pensante.',
        'masterful_pass' => 'Jugador con pases magistrales.',
        'marshal' => 'Mejor defensor.',
        'wall' => 'Jugador imposible de pasar.',
        'capocannoniere' => 'Goleador del partido.',
        'terminator' => 'Jugador más sucio o que cometió un foul fuerte.',
        'tractor' => 'Jugador con más empuje, ida y vuelta.',
        'guinda' => 'Mejor asistencia.',
        'golosa' => 'Jugador más individualista.',
        'putita' => 'Jugador llorón o mal perdedor.',
        'chenemigo' => 'Jugador con conducta antideportiva.',
        'ghost' => 'Jugador que erro mucho o participo poco.',
        'keeper' => 'Mejor arquero.',
        'goodfellas' => 'Buen jugador, acción solidaria.',
    ];
}

function monthly_player_award_definition(): array
{
    return ['label' => 'Jugador del mes', 'icon' => '👑', 'type' => 'good'];
}

function monthly_player_award_description(): string
{
    return 'Mejor promedio por cancha en un mes calendario, con asistencia perfecta a las fechas de esa cancha.';
}

function award_month_label(string $monthStart): string
{
    $months = [
        1 => 'enero',
        2 => 'febrero',
        3 => 'marzo',
        4 => 'abril',
        5 => 'mayo',
        6 => 'junio',
        7 => 'julio',
        8 => 'agosto',
        9 => 'septiembre',
        10 => 'octubre',
        11 => 'noviembre',
        12 => 'diciembre',
    ];
    $timestamp = strtotime($monthStart);
    if ($timestamp === false) {
        return $monthStart;
    }
    return ($months[(int) date('n', $timestamp)] ?? date('m', $timestamp)) . ' ' . date('Y', $timestamp);
}

function monthly_player_awards(): array
{
    $pdo = db();
    if (
        (function_exists('schema_table_exists') && !schema_table_exists($pdo, 'rental_courts'))
        || (function_exists('schema_column_exists') && !schema_column_exists($pdo, 'matches', 'rental_court_id'))
    ) {
        return [];
    }

    $stmt = $pdo->query(
        "SELECT
            DATE_FORMAT(m.match_date, '%Y-%m-01') AS month_start,
            rc.id AS court_id,
            rc.court_key,
            rc.place,
            monthly_matches.total_matches,
            p.id AS player_id,
            p.name,
            COUNT(DISTINCT mp.match_id) AS partidos,
            COALESCE(SUM(mp.goals), 0) AS goles,
            ROUND(AVG(mp.rating), 2) AS promedio
         FROM match_players mp
         INNER JOIN matches m ON m.id = mp.match_id AND m.status = 'finalizado'
         INNER JOIN rental_courts rc ON rc.id = m.rental_court_id
         INNER JOIN (
            SELECT
              DATE_FORMAT(match_date, '%Y-%m-01') AS month_start,
              rental_court_id,
              COUNT(DISTINCT id) AS total_matches
            FROM matches
            WHERE status = 'finalizado'
              AND rental_court_id IS NOT NULL
            GROUP BY month_start, rental_court_id
         ) monthly_matches ON monthly_matches.month_start = DATE_FORMAT(m.match_date, '%Y-%m-01')
            AND monthly_matches.rental_court_id = m.rental_court_id
         INNER JOIN players p ON p.id = mp.player_id
         GROUP BY month_start, rc.id, rc.court_key, rc.place, monthly_matches.total_matches, p.id, p.name
         HAVING COUNT(DISTINCT mp.match_id) = monthly_matches.total_matches
         ORDER BY month_start DESC, rc.court_key ASC, promedio DESC, goles DESC, p.name ASC"
    );

    $awards = [];
    foreach ($stmt->fetchAll() as $row) {
        $monthStart = (string) ($row['month_start'] ?? '');
        $courtId = (int) ($row['court_id'] ?? 0);
        $awardKey = $monthStart . ':' . $courtId;
        if ($monthStart === '' || $courtId <= 0 || isset($awards[$awardKey])) {
            continue;
        }
        $monthLabel = award_month_label($monthStart);
        $courtLabel = trim((string) ($row['place'] ?? '')) . ' - ' . trim((string) ($row['court_key'] ?? 'cancha'));
        $awards[$awardKey] = [
            'month_start' => $monthStart,
            'month_label' => $monthLabel,
            'court_id' => $courtId,
            'court_key' => (string) ($row['court_key'] ?? ''),
            'court_label' => $courtLabel,
            'label' => 'Jugador del mes - ' . trim((string) ($row['court_key'] ?? 'cancha')),
            'player_id' => (int) ($row['player_id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'partidos' => (int) ($row['partidos'] ?? 0),
            'total_matches' => (int) ($row['total_matches'] ?? 0),
            'goles' => (int) ($row['goles'] ?? 0),
            'promedio' => $row['promedio'] !== null ? (float) $row['promedio'] : null,
            'tooltip' => 'Jugador del mes - ' . $courtLabel . ': ' . $monthLabel
                . ' | Promedio ' . number_format((float) ($row['promedio'] ?? 0), 2)
                . ' en ' . (int) ($row['partidos'] ?? 0) . '/' . (int) ($row['total_matches'] ?? 0) . ' partidos',
        ];
    }

    return array_values($awards);
}

function monthly_player_awards_for_player(int $playerId): array
{
    return array_values(array_filter(
        monthly_player_awards(),
        static fn(array $award): bool => (int) ($award['player_id'] ?? 0) === $playerId
    ));
}

function award_legend_details_html(array $awardDefinitions, ?array $awardDescriptions = null, string $title = 'Referencia de premios', bool $open = false): string
{
    $awardDescriptions ??= award_descriptions();
    $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $openAttr = $open ? ' open' : '';

    $html = '<details class="card stats-section award-legend-section scroll-mt-20"' . $openAttr . '>';
    $html .= '<summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-lime-50">';
    $html .= $escape($title);
    $html .= '<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-base font-extrabold leading-none text-[#07130f] shadow-sm" aria-hidden="true">?</span>';
    $html .= '</summary>';
    $html .= '<div class="award-legend-grid border-t border-lime-200/30 bg-emerald-950/70 p-3">';

    foreach ($awardDefinitions as $code => $award) {
        $html .= '<article class="award-legend-item">';
        $html .= '<span class="award-legend-icon">' . $escape((string) ($award['icon'] ?? '')) . '</span>';
        $html .= '<span>';
        $html .= '<strong>' . $escape((string) ($award['label'] ?? 'Premio')) . '</strong>';
        $html .= '<small>' . $escape((string) ($awardDescriptions[$code] ?? 'Premio destacado de la fecha.')) . '</small>';
        $html .= '</span>';
        $html .= '</article>';
    }

    $html .= '</div>';
    $html .= '</details>';

    return $html;
}

function ensure_match_awards_schema(): void
{
    db()->exec(
        "CREATE TABLE IF NOT EXISTS match_awards (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            award_code VARCHAR(40) NOT NULL,
            player_id INT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_match_award (match_id, award_code),
            INDEX idx_awards_player (player_id, award_code),
            CONSTRAINT fk_match_awards_match
              FOREIGN KEY (match_id) REFERENCES matches(id)
              ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_match_awards_player
              FOREIGN KEY (player_id) REFERENCES players(id)
              ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function repo_match_awards(int $matchId): array
{
    if (!db()->inTransaction()) {
        ensure_match_awards_schema();
    }
    $stmt = db()->prepare(
        'SELECT ma.award_code, ma.player_id, p.name
         FROM match_awards ma
         INNER JOIN players p ON p.id = ma.player_id
         WHERE ma.match_id = :mid'
    );
    $stmt->execute(['mid' => $matchId]);
    $awards = [];
    foreach ($stmt->fetchAll() as $row) {
        $awards[(string) $row['award_code']] = $row;
    }
    return $awards;
}

function repo_save_match_awards(int $matchId, array $awards, array $allowedPlayerIds): void
{
    if (!db()->inTransaction()) {
        ensure_match_awards_schema();
    }
    $definitions = award_definitions();
    $allowed = array_flip(array_map('intval', $allowedPlayerIds));
    $pdo = db();

    $delete = $pdo->prepare('DELETE FROM match_awards WHERE match_id = :mid AND award_code = :code');
    $upsert = $pdo->prepare(
        'INSERT INTO match_awards (match_id, award_code, player_id)
         VALUES (:mid, :code, :pid)
         ON DUPLICATE KEY UPDATE player_id = VALUES(player_id)'
    );

    foreach ($definitions as $code => $_definition) {
        $playerId = (int) ($awards[$code] ?? 0);
        if ($playerId <= 0) {
            $delete->execute(['mid' => $matchId, 'code' => $code]);
            continue;
        }
        if (!isset($allowed[$playerId])) {
            throw new RuntimeException('Premio invalido: el jugador no participo de la fecha.');
        }
        $upsert->execute(['mid' => $matchId, 'code' => $code, 'pid' => $playerId]);
    }
}
