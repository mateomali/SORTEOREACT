<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** Verified annual totals. Names intentionally resolve against each deployment's roster. */
function verified_goal_totals_2026(): array
{
    return [
        'MARIAN' => 62, 'FRANCO COMOLLI' => 57, 'MAURI' => 40, 'PELA' => 32,
        'ANIBAL' => 22, 'VIKINGO' => 18, 'BRIAN' => 16, 'CAMILO' => 13,
        'JUAN PRECE' => 11, 'AUGUSTO' => 10, 'ISMA' => 9, 'ALEXIS' => 9,
        'URIEL' => 7, 'JAVI' => 7, 'RODRI CHAVEZ' => 7, 'MANU' => 6,
        'CESAR' => 6, 'NICO' => 5, 'CRIS MAZZA' => 4, 'MAXI' => 4,
        'GUILLE' => 4, 'LUCAS RAYO' => 4, 'PABLO' => 3, 'PABLO K' => 3, 'ELIAN' => 2,
        'MARCELO' => 2, 'CRIS PODESTÁ' => 2, 'FRANCO' => 2, 'RODRI SUAREZ' => 1,
        'SANTI' => 1, 'PABLO GARCIA' => 1, 'EZE VILLALBA' => 1,
    ];
}

function ensure_goal_corrections(): void
{
    static $ready = false;
    if ($ready) return;
    $pdo = db();
    $pdo->exec("CREATE TABLE IF NOT EXISTS player_goal_corrections (
        source VARCHAR(80) NOT NULL,
        player_id INT NOT NULL,
        goal_year SMALLINT NOT NULL,
        verified_total INT NOT NULL,
        recorded_total INT NOT NULL,
        goal_delta INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (source, player_id, goal_year)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $find = $pdo->prepare('SELECT id FROM players WHERE UPPER(TRIM(name)) = UPPER(:name)');
    $insert = $pdo->prepare("INSERT INTO player_goal_corrections
        (source, player_id, goal_year, verified_total, recorded_total, goal_delta)
        SELECT :source, :player_id, 2026, :verified, totals.goals, :target - totals.goals
        FROM (SELECT COALESCE(SUM(mp.goals),0) goals FROM match_players mp
          JOIN matches m ON m.id=mp.match_id WHERE mp.player_id=:pid
          AND m.status='finalizado' AND m.match_date >= '2026-01-01' AND m.match_date < '2027-01-01') totals
        ON DUPLICATE KEY UPDATE source = VALUES(source)");
    $resolved = [];
    foreach (verified_goal_totals_2026() as $name => $total) {
        $find->execute(['name' => $name]);
        $ids = $find->fetchAll(PDO::FETCH_COLUMN);
        if (count($ids) !== 1) throw new RuntimeException('No se pudo identificar unívocamente al goleador: ' . $name);
        $resolved[(int) $ids[0]] = $total;
    }
    $ownsTransaction = !$pdo->inTransaction();
    if ($ownsTransaction) $pdo->beginTransaction();
    try {
        foreach ($resolved as $id => $total) {
            $insert->execute(['source' => 'user-verified-20261022', 'player_id' => $id, 'verified' => $total, 'target' => $total, 'pid' => $id]);
        }
        if ($ownsTransaction) $pdo->commit();
    } catch (Throwable $error) {
        if ($ownsTransaction && $pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
    $ready = true;
}

function goal_corrections(?int $year = null): array
{
    ensure_goal_corrections();
    $stmt = db()->prepare('SELECT player_id, SUM(goal_delta) delta FROM player_goal_corrections'
        . ($year !== null ? ' WHERE goal_year = :year' : '') . ' GROUP BY player_id');
    $stmt->execute($year !== null ? ['year' => $year] : []);
    $result = [];
    foreach ($stmt->fetchAll() as $row) $result[(int) $row['player_id']] = (int) $row['delta'];
    return $result;
}

/** Keep historical appearances intact; corrected scorers can have no recorded appearances. */
function apply_goal_corrections(array $rows, string $field, ?int $year, bool $includeMissing = false): array
{
    $corrections = goal_corrections($year);
    $seen = [];
    foreach ($rows as &$row) {
        $id = (int) $row['id'];
        $seen[$id] = true;
        $row[$field] = max(0, (int) ($row[$field] ?? 0) + ($corrections[$id] ?? 0));
        $row['goal_correction'] = $corrections[$id] ?? 0;
        if (array_key_exists('gol_por_partido', $row)) $row['gol_por_partido'] = (int) $row['partidos'] > 0 ? round($row[$field] / (int) $row['partidos'], 2) : null;
    }
    unset($row);
    if ($includeMissing) {
        foreach (db()->query('SELECT id, name, positions, pace FROM players')->fetchAll() as $player) {
            $id = (int) $player['id'];
            if (isset($seen[$id]) || ($corrections[$id] ?? 0) <= 0) continue;
            $rows[] = $player + [$field => $corrections[$id], 'goal_correction' => $corrections[$id],
                'partidos' => 0, 'played' => 0, 'won' => 0, 'drawn' => 0, 'lost' => 0,
                'pg' => 0, 'pe' => 0, 'pp' => 0, 'average' => null, 'rating_promedio' => null,
                'gol_por_partido' => null, 'indice_rendimiento' => 0];
        }
    }
    return $rows;
}
