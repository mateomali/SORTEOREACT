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
            throw new RuntimeException('Premio invalido: el jugador no participo del encuentro.');
        }
        $upsert->execute(['mid' => $matchId, 'code' => $code, 'pid' => $playerId]);
    }
}
