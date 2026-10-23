<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/schema.php';

function award_max_recipients(string $code): int
{
    return in_array($code, ['masterful_pass', 'wall', 'capocannoniere', 'terminator', 'guinda', 'golosa', 'putita', 'chenemigo', 'goodfellas'], true) ? 3 : 1;
}

function award_ensure_position_schema(string $table, string $oldIndex, string $columns): void
{
    $pdo = db();
    schema_add_column($pdo, $table, 'award_position', 'award_position TINYINT UNSIGNED NOT NULL DEFAULT 1');
    $newIndex = $oldIndex . '_position';
    if (!schema_index_exists($pdo, $table, $newIndex)) $pdo->exec("ALTER TABLE `$table` ADD UNIQUE KEY `$newIndex` ($columns, award_position)");
    if (schema_index_exists($pdo, $table, $oldIndex)) $pdo->exec("ALTER TABLE `$table` DROP INDEX `$oldIndex`");
}

function award_group_rows(array $rows): array
{
    $grouped = [];
    foreach ($rows as $row) {
        $code = (string) $row['award_code'];
        if (!isset($grouped[$code])) $grouped[$code] = $row + ['podium' => []];
        $grouped[$code]['podium'][] = $row;
    }
    return $grouped;
}

function award_flatten_rows(array $awards): array
{
    $rows = [];
    foreach ($awards as $code => $award) foreach ($award['podium'] ?? [$award] as $row) $rows[] = $row + ['award_code' => $code, 'award_position' => 1, 'recipient_count' => count($award['podium'] ?? [$award])];
    return $rows;
}

function award_display_name(array $award): string
{
    return implode(' · ', array_map(static fn(array $row): string => (count($award['podium'] ?? [$award]) > 1 ? award_position_label((int) $row['award_position']) . ' ' : '') . $row['name'], $award['podium'] ?? [$award]));
}

function award_position_label(int $position): string
{
    return $position . '.º';
}

function award_parse_form(array $input): array
{
    $parsed = [];
    foreach (award_definitions() as $code => $_definition) {
        $raw = $input[$code] ?? '';
        $values = is_array($raw) ? array_values($raw) : [$raw];
        $ids = [];
        $gap = false;
        foreach ($values as $value) {
            if (!is_scalar($value)) throw new RuntimeException('Selección de premio inválida.');
            $value = trim((string) $value);
            if ($value === '') { $gap = true; continue; }
            if ($gap) throw new RuntimeException('Completá el podio sin dejar posiciones vacías.');
            if (!preg_match('/#(\d+)\)$/', $value, $selection)) throw new RuntimeException('Seleccioná los premios desde la lista de jugadores.');
            $ids[] = (int) $selection[1];
        }
        $parsed[$code] = $ids;
    }
    return $parsed;
}

function award_validate_recipients(string $code, mixed $input, array $participantIds, array $allPlayerIds): array
{
    $ids = is_array($input) ? array_values($input) : ((int) $input > 0 ? [(int) $input] : []);
    if (count($ids) > award_max_recipients($code)) throw new RuntimeException(award_definitions()[$code]['label'] . ': permite hasta ' . award_max_recipients($code) . ' jugador(es).');
    $allowed = array_flip(array_map('intval', $code === 'goodfellas' ? $allPlayerIds : $participantIds));
    $seen = [];
    foreach ($ids as $id) {
        if (filter_var($id, FILTER_VALIDATE_INT) === false || (int) $id <= 0 || !isset($allowed[(int) $id])) throw new RuntimeException('Premio inválido: elegí un jugador de la lista habilitada para esa categoría.');
        if (isset($seen[(int) $id])) throw new RuntimeException('Un jugador no puede ocupar dos posiciones del mismo podio. Puede recibir otros premios.');
        $seen[(int) $id] = true;
    }
    return array_map('intval', $ids);
}

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
        'player_of_match' => 'El mejor jugador del partido. Quien tuvo el rendimiento más destacado, fue determinante para su equipo y marcó la diferencia en la cancha. Debe pertenecer al equipo ganador.',
        'goal_of_week' => 'El mejor gol del partido. Una definición espectacular, una jugada individual brillante o un remate inolvidable que merece ser recordado.',
        'lyrical' => 'El artista de la cancha. El protagonista de la mejor jugada de fantasía, gambeta, lujo o demostración de habilidad que despertó admiración.',
        'pelusa' => 'El segundo mejor jugador del partido. Tuvo una actuación sobresaliente y estuvo muy cerca de quedarse con el premio mayor.',
        'bochini' => 'El cerebro del equipo. El jugador que mejor trató la pelota, distribuyó el juego con inteligencia y se destacó por su precisión, criterio y calidad técnica.',
        'masterful_pass' => 'La mejor asistencia o habilitación del partido. Un pase brillante, preciso o inesperado que dejó a todos admirados, haya terminado en gol o no.',
        'marshal' => 'El dueño de la defensa. El jugador que mejor defendió durante todo el partido, destacándose por sus anticipos, quites, marca y seguridad.',
        'wall' => 'El protagonista de la mejor acción defensiva del partido. Una barrida salvadora, un bloqueo imposible o un quite fundamental que evitó una situación peligrosa.',
        'capocannoniere' => 'El máximo goleador de la jornada. El jugador que convirtió más goles y demostró tener el arco entre ceja y ceja.',
        'terminator' => 'El jugador que protagonizó la acción más brusca del partido. Una patada memorable, un choque contundente o una entrada que hizo temblar hasta al árbitro.',
        'tractor' => 'El jugador que impuso su potencia física. Avanzó con fuerza, atropelló rivales y fue imparable en sus embestidas, aunque no siempre con demasiada delicadeza.',
        'guinda' => 'El protagonista de una definición desastrosa o un remate que terminó en cualquier lado menos en el arco. Una oportunidad desperdiciada digna de recordar.',
        'golosa' => 'El jugador más individualista del partido. El que se enamoró de la pelota, quiso resolver todas las jugadas solo y se olvidó de sus compañeros.',
        'putita' => 'El jugador que más protestó, exageró contactos o reclamó faltas durante el partido. Siempre tiene algo para decir cuando una jugada no le favorece.',
        'chenemigo' => 'El compañero que terminó jugando para el rival sin querer. Un pase comprometedor, una pérdida absurda o un error que benefició directamente al equipo contrario.',
        'ghost' => 'Jugador que erro mucho o participo poco.',
        'keeper' => 'El arquero más destacado del partido. Aquel que se lució con atajadas decisivas, reflejos y seguridad bajo los tres palos.',
        'goodfellas' => 'El reconocimiento al compañerismo. Para quien colaboró con la organización, ayudó al grupo o estuvo presente aportando buena onda, incluso sin jugar.',
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
    static $done = false;
    if ($done) return;
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
    award_ensure_position_schema('match_awards', 'uniq_match_award', 'match_id, award_code');
    $done = true;
}

function repo_match_awards(int $matchId): array
{
    if (!db()->inTransaction()) {
        ensure_match_awards_schema();
    }
    $stmt = db()->prepare(
        'SELECT ma.award_code, ma.player_id, ma.award_position, p.name
         FROM match_awards ma
         INNER JOIN players p ON p.id = ma.player_id
         WHERE ma.match_id = :mid ORDER BY ma.award_code, ma.award_position'
    );
    $stmt->execute(['mid' => $matchId]);
    return award_group_rows($stmt->fetchAll());
}

function repo_save_match_awards(int $matchId, array $awards, array $allowedPlayerIds): void
{
    if (!db()->inTransaction()) {
        ensure_match_awards_schema();
    }
    $definitions = award_definitions();
    $pdo = db();
    $allPlayers = $pdo->query('SELECT id FROM players')->fetchAll(PDO::FETCH_COLUMN);
    $validated = [];
    foreach ($definitions as $code => $_definition) $validated[$code] = award_validate_recipients($code, $awards[$code] ?? [], $allowedPlayerIds, $allPlayers);

    $delete = $pdo->prepare('DELETE FROM match_awards WHERE match_id = :mid AND award_code = :code');
    $upsert = $pdo->prepare(
        'INSERT INTO match_awards (match_id, award_code, player_id, award_position)
         VALUES (:mid, :code, :pid, :position)
         ON DUPLICATE KEY UPDATE player_id = VALUES(player_id)'
    );

    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) $pdo->beginTransaction();
    try {
        foreach ($definitions as $code => $_definition) {
            $delete->execute(['mid' => $matchId, 'code' => $code]);
            foreach ($validated[$code] as $index => $playerId) $upsert->execute(['mid' => $matchId, 'code' => $code, 'pid' => $playerId, 'position' => $index + 1]);
        }
        if ($ownsTransaction) $pdo->commit();
    } catch (Throwable $error) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
