<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function award_definitions(): array
{
    return [
        'player_of_match' => ['label' => 'Man of the Match', 'icon' => '🏆', 'type' => 'good'],
        'goal_of_week' => ['label' => 'Gol de la fecha', 'icon' => '🤯', 'type' => 'good'],
        'lyrical' => ['label' => 'Lírico', 'icon' => '🧙🏼‍♂️', 'type' => 'good'],
        'wall' => ['label' => 'El muro', 'icon' => '🚧', 'type' => 'good'],
        'capocannoniere' => ['label' => 'Capocannoniere', 'icon' => '💣', 'type' => 'good'],
        'terminator' => ['label' => 'Terminator', 'icon' => '👊', 'type' => 'bad'],
        'tractor' => ['label' => 'Tractor', 'icon' => '🚜', 'type' => 'good'],
        'guinda' => ['label' => 'La guinda', 'icon' => '🎯', 'type' => 'good'],
        'putita' => ['label' => 'La putita', 'icon' => '🏳️‍🌈', 'type' => 'bad'],
        'ghost' => ['label' => 'El fantasma', 'icon' => '👻', 'type' => 'bad'],
        'keeper' => ['label' => 'Portero imbatible', 'icon' => '🥅', 'type' => 'good'],
        'goodfellas' => ['label' => 'Goodfellas', 'icon' => '🧉', 'type' => 'good'],
    ];
}

function award_descriptions(): array
{
    return [
        'player_of_match' => 'Jugador de la fecha.',
        'goal_of_week' => 'Mejor gol de la fecha.',
        'lyrical' => 'Jugada fantastica o recurso tecnico destacado.',
        'wall' => 'Mejor defensor de la fecha.',
        'capocannoniere' => 'Goleador destacado de la fecha.',
        'terminator' => 'Jugador mas bruto o jugada mas fuerte.',
        'tractor' => 'Jugador mas aguerrido e intenso.',
        'guinda' => 'Mejor pase o asistencia.',
        'putita' => 'Jugador no comprometido o problematico.',
        'ghost' => 'Jugador que erro mucho o participo poco.',
        'keeper' => 'Mejor arquero de la fecha.',
        'goodfellas' => 'Mejor actitud y buen companero.',
    ];
}

function award_legend_details_html(array $awardDefinitions, ?array $awardDescriptions = null, string $title = 'Referencia de premios', bool $open = false): string
{
    $awardDescriptions ??= award_descriptions();
    $escape = static fn(string $value): string => htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $openAttr = $open ? ' open' : '';

    $html = '<details class="card stats-section award-legend-section scroll-mt-20"' . $openAttr . '>';
    $html .= '<summary class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-lime-50">';
    $html .= $escape($title);
    $html .= '<span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime-100 text-base font-extrabold leading-none text-emerald-950 shadow-sm" aria-hidden="true">?</span>';
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
