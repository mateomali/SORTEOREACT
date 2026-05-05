<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function repo_all_players(bool $onlyActive = false): array
{
    $sql = 'SELECT * FROM players';
    if ($onlyActive) {
        $sql .= ' WHERE active = 1';
    }
    $sql .= ' ORDER BY name ASC';
    return db()->query($sql)->fetchAll();
}

function repo_player_by_id(int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM players WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function repo_matches(string $where = '1=1'): array
{
    $sql = "SELECT m.*,
              (SELECT COUNT(*) FROM match_players mp WHERE mp.match_id = m.id) AS participants_count
            FROM matches m
            WHERE {$where}
            ORDER BY m.created_at DESC, m.id DESC";
    return db()->query($sql)->fetchAll();
}

function repo_match_by_id(int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM matches WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function repo_match_participants(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT p.*, mp.team_number, mp.assigned_position, mp.is_goalkeeper, mp.lineup_order, mp.formation_line_order, mp.goals, mp.rating
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid
         ORDER BY p.name ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    return $stmt->fetchAll();
}

function repo_match_participants_basic(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT p.id, p.name, p.positions, p.pace, p.skill,
                p.technique, p.rhythm, p.defense_physical, p.attack, p.teamwork, p.regularity, p.goalkeeper_skill
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid
         ORDER BY p.name ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    return $stmt->fetchAll();
}

function repo_save_match_participants(int $matchId, array $playerIds): void
{
    $pdo = db();
    $playerIds = array_values(array_unique(array_map('intval', $playerIds)));

    $pdo->beginTransaction();
    try {
        if ($playerIds) {
            $in = implode(',', array_fill(0, count($playerIds), '?'));
            $sqlDelete = "DELETE FROM match_players WHERE match_id = ? AND player_id NOT IN ($in)";
            $params = array_merge([$matchId], $playerIds);
            $stmtDelete = $pdo->prepare($sqlDelete);
            $stmtDelete->execute($params);
        } else {
            $stmtDeleteAll = $pdo->prepare('DELETE FROM match_players WHERE match_id = ?');
            $stmtDeleteAll->execute([$matchId]);
        }

        $insert = $pdo->prepare(
            'INSERT INTO match_players (match_id, player_id)
             VALUES (:match_id, :player_id)
             ON DUPLICATE KEY UPDATE match_id = VALUES(match_id)'
        );
        foreach ($playerIds as $pid) {
            $insert->execute(['match_id' => $matchId, 'player_id' => $pid]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function repo_match_teams(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT * FROM match_teams
         WHERE match_id = :mid
         ORDER BY team_number ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    return $stmt->fetchAll();
}

function repo_match_team_labels(array $match, array $matchTeams): array
{
    $labels = [];
    $captainIds = [];
    foreach ($matchTeams as $team) {
        if (!empty($team['captain_player_id'])) {
            $captainIds[(int) $team['captain_player_id']] = true;
        }
    }

    $captainNames = [];
    if ($captainIds) {
        $ids = array_keys($captainIds);
        $in = implode(',', array_fill(0, count($ids), '?'));
        $stmt = db()->prepare("SELECT id, name FROM players WHERE id IN ($in)");
        $stmt->execute($ids);
        foreach ($stmt->fetchAll() as $row) {
            $captainNames[(int) $row['id']] = (string) $row['name'];
        }
    }

    foreach ($matchTeams as $team) {
        $teamNumber = (int) $team['team_number'];
        if (!empty($team['captain_player_id'])) {
            $captainName = $captainNames[(int) $team['captain_player_id']] ?? ('Capitan ' . $teamNumber);
            $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
            $color = trim((string) ($team['color_name'] ?? '')) ?: ($defaultColors[$teamNumber] ?? '');
            $labels[$teamNumber] = $color !== '' ? ($captainName . ' (' . $color . ')') : $captainName;
            continue;
        }

        $color = trim((string) ($team['color_name'] ?? ''));
        if ($color !== '') {
            $labels[$teamNumber] = 'Equipo (' . $color . ')';
            continue;
        }

        if (($match['draw_mode'] ?? '') !== 'captains') {
            $defaultColors = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
            if (isset($defaultColors[$teamNumber])) {
                $labels[$teamNumber] = 'Equipo (' . $defaultColors[$teamNumber] . ')';
                continue;
            }
        }

        $labels[$teamNumber] = 'Equipo ' . $teamNumber;
    }

    return $labels;
}

function repo_grouped_team_players(int $matchId): array
{
    $players = repo_match_participants($matchId);
    $grouped = [];
    foreach ($players as $p) {
        $team = $p['team_number'] !== null ? (int) $p['team_number'] : 0;
        if ($team < 1) {
            continue;
        }
        if (!isset($grouped[$team])) {
            $grouped[$team] = ['ARQ' => [], 'DEF' => [], 'MED' => [], 'DEL' => []];
        }
        $line = $p['assigned_position'] ?: 'MED';
        if (!isset($grouped[$team][$line])) {
            $line = 'MED';
        }
        $grouped[$team][$line][] = $p;
    }
    ksort($grouped);
    return $grouped;
}

function repo_team_totals(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT mp.team_number,
                COUNT(mp.id) AS players,
                SUM(p.skill) AS total_skill,
                SUM(CASE WHEN p.rhythm <= 2.5 OR (p.rhythm IS NULL AND p.pace = "lento") THEN 1 ELSE 0 END) AS slow_count
         FROM match_players mp
         INNER JOIN players p ON p.id = mp.player_id
         WHERE mp.match_id = :mid AND mp.team_number IS NOT NULL
         GROUP BY mp.team_number
         ORDER BY mp.team_number ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    $rows = $stmt->fetchAll();
    $totals = [];
    foreach ($rows as $row) {
        $team = (int) $row['team_number'];
        $totals[$team] = [
            'players' => (int) $row['players'],
            'total_skill' => (float) $row['total_skill'],
            'slow_count' => (int) $row['slow_count'],
        ];
    }
    return $totals;
}
