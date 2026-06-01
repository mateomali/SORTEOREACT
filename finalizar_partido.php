<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/awards.php';
require_once __DIR__ . '/lib/schema.php';

$isRoundRobinAjaxRequest = $_SERVER['REQUEST_METHOD'] === 'POST'
    && (string) ($_POST['ajax'] ?? '') === '1'
    && in_array((string) ($_POST['action'] ?? ''), ['save_round_robin_scores', 'calculate_round_robin_winner', 'finalize_round_robin_date'], true);

function finish_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!is_admin()) {
    if ($isRoundRobinAjaxRequest) {
        finish_json_response(['ok' => false, 'message' => 'La sesion admin vencio. Vuelve a ingresar y reintenta.'], 401);
    }
    require_admin();
}

try {
    $pdo = db();
    ensure_control_schema();
    ensure_match_awards_schema();
    ensure_round_robin_results_schema();
    ensure_round_robin_settings_schema();
} catch (Throwable $e) {
    if ($isRoundRobinAjaxRequest) {
        finish_json_response(['ok' => false, 'message' => 'No se pudo preparar la base de datos: ' . $e->getMessage()], 500);
    }
    throw $e;
}

$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$detailFormError = '';
$forceEditDetails = false;
$postedTeamGoalsData = [];
$postedGoalsData = [];
$postedRatingData = [];
$postedAwardData = [];

function valuations_locked_after_deadline(array $match): bool
{
    if ((string) ($match['status'] ?? '') !== 'finalizado') {
        return false;
    }

    $finalizedAt = trim((string) ($match['finalized_at'] ?? ''));
    if ($finalizedAt === '') {
        $finalizedAt = trim((string) ($match['updated_at'] ?? $match['match_date'] ?? ''));
    }
    $finalizedTimestamp = strtotime($finalizedAt);
    if ($finalizedTimestamp === false) {
        return false;
    }

    return time() >= ($finalizedTimestamp + (7 * 24 * 60 * 60));
}

function build_match_share_summary(array $match, array $matchTeams, array $teamLabels, array $groupedTeams, array $awardDefinitions, array $savedAwards): string
{
    $title = (string) ($match['title'] ?: ('Fecha #' . $match['id']));
    $date = date('d/m/Y H:i', strtotime((string) $match['match_date']));
    $teamGoals = [];
    foreach ($matchTeams as $team) {
        $teamGoals[(int) $team['team_number']] = (int) ($team['goals'] ?? 0);
    }
    ksort($teamGoals);

    $scoreParts = [];
    foreach ($teamGoals as $teamNumber => $goals) {
        $scoreParts[] = ($teamLabels[$teamNumber] ?? ('Equipo ' . $teamNumber)) . ' ' . $goals;
    }

    $awardsByPlayer = [];
    foreach ($savedAwards as $code => $awardRow) {
        $playerId = (int) ($awardRow['player_id'] ?? 0);
        if ($playerId <= 0 || !isset($awardDefinitions[$code])) {
            continue;
        }
        $awardsByPlayer[$playerId][] = [
            'icon' => (string) $awardDefinitions[$code]['icon'],
            'label' => (string) $awardDefinitions[$code]['label'],
            'name' => (string) ($awardRow['name'] ?? ''),
        ];
    }

    $lines = [
        APP_NAME . ' - ' . $title,
        $date,
        '',
        'Resultado',
        implode(' - ', $scoreParts),
        '',
    ];

    foreach ($groupedTeams as $teamNumber => $positionLines) {
        $lines[] = (string) ($teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber));
        foreach (player_formation_lines() as $line) {
            foreach ($positionLines[$line] as $player) {
                $playerParts = ['- ' . (string) $player['name']];
                $goals = (int) ($player['goals'] ?? 0);
                if ($goals > 0) {
                    $playerParts[] = $goals . ' ' . ($goals === 1 ? 'gol' : 'goles');
                }
                if ($player['rating'] !== null && $player['rating'] !== '') {
                    $playerParts[] = number_format((float) $player['rating'], 1) . ' pts';
                }
                foreach ($awardsByPlayer[(int) $player['id']] ?? [] as $award) {
                    $playerParts[] = $award['icon'] . ' ' . $award['label'];
                }
                $lines[] = implode(' | ', $playerParts);
            }
        }
        $lines[] = '';
    }

    if ($savedAwards) {
        $lines[] = 'Premios';
        foreach ($savedAwards as $code => $awardRow) {
            if (!isset($awardDefinitions[$code])) {
                continue;
            }
            $lines[] = (string) $awardDefinitions[$code]['icon'] . ' ' . (string) $awardDefinitions[$code]['label'] . ': ' . (string) $awardRow['name'];
        }
    }

    return trim(implode("\n", $lines));
}

function finish_shirt_options(): array
{
    return ['ROSA', 'AZUL', 'NARANJA', 'NEGRO', 'VERDE', 'CAMISADO', 'DESCAMISADO'];
}

function finish_default_team_shirt(int $teamNumber): string
{
    $defaults = [1 => 'ROSA', 2 => 'AZUL', 3 => 'NARANJA', 4 => 'NEGRO', 5 => 'VERDE'];
    return $defaults[$teamNumber] ?? 'CAMISADO';
}

function finish_normalize_shirt(mixed $value, int $teamNumber): string
{
    $shirt = strtoupper(trim((string) $value));
    return in_array($shirt, finish_shirt_options(), true) ? $shirt : finish_default_team_shirt($teamNumber);
}

function finish_player_position(array $player): string
{
    $position = strtoupper(trim((string) ($player['assigned_position'] ?? '')));
    if (in_array($position, allowed_positions(), true)) {
        return $position;
    }
    return player_primary_position($player);
}

function finish_formation_name_from_counts(array $counts): string
{
    return implode('-', [
        (int) ($counts['DEF'] ?? 0) + (int) ($counts['LAT'] ?? 0),
        (int) ($counts['MED'] ?? 0),
        (int) ($counts['DEL'] ?? 0),
    ]);
}

function finish_save_match_formations(int $matchId, array $participants, array $teams, array $teamColorData, array $teamAssignments, array $positionAssignments): void
{
    $teamNumbers = array_map(static fn(array $team): int => (int) $team['team_number'], $teams);
    $teamNumberSet = array_flip($teamNumbers);
    $allowedPositions = allowed_positions();
    $formationRows = [];

    foreach ($participants as $player) {
        if ($player['team_number'] === null) {
            continue;
        }
        $playerId = (int) $player['id'];
        $teamNumber = (int) ($teamAssignments[$playerId] ?? $player['team_number']);
        if (!isset($teamNumberSet[$teamNumber])) {
            throw new RuntimeException('Hay una asignacion de equipo invalida.');
        }
        $position = strtoupper(trim((string) ($positionAssignments[$playerId] ?? finish_player_position($player))));
        if (!in_array($position, $allowedPositions, true)) {
            throw new RuntimeException('Hay una posicion invalida en la formacion.');
        }
        $formationRows[] = [
            'id' => $playerId,
            'team_number' => $teamNumber,
            'position' => $position,
            'skill' => (float) ($player['skill'] ?? 0),
        ];
    }

    if (!$formationRows) {
        throw new RuntimeException('No hay jugadores asignados para guardar la formacion.');
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $lineOrder = [];
        $lineupOrder = [];
        $updateAssignment = $pdo->prepare(
            'UPDATE match_players
             SET team_number = :team_number, assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper,
                 lineup_order = :lineup_order, formation_line_order = :formation_line_order
             WHERE match_id = :mid AND player_id = :pid'
        );
        foreach ($formationRows as $row) {
            $teamNumber = (int) $row['team_number'];
            $position = (string) $row['position'];
            $lineOrder[$teamNumber] = $lineOrder[$teamNumber] ?? array_fill_keys(player_formation_lines(), 0);
            $lineupOrder[$teamNumber] = ($lineupOrder[$teamNumber] ?? 0) + 1;
            $lineOrder[$teamNumber][$position]++;
            $updateAssignment->execute([
                'mid' => $matchId,
                'pid' => (int) $row['id'],
                'team_number' => $teamNumber,
                'assigned_position' => $position,
                'is_goalkeeper' => $position === 'ARQ' ? 1 : 0,
                'lineup_order' => $lineupOrder[$teamNumber],
                'formation_line_order' => $lineOrder[$teamNumber][$position],
            ]);
        }

        $updateTeamFormation = $pdo->prepare(
            'UPDATE match_teams
             SET color_name = :color_name, total_skill = :total_skill, formation_name = :formation_name, formation_data = :formation_data, updated_at = NOW()
             WHERE match_id = :mid AND team_number = :team_number'
        );
        foreach ($teamNumbers as $teamNumber) {
            $teamRows = array_values(array_filter($formationRows, static fn(array $row): bool => (int) $row['team_number'] === (int) $teamNumber));
            $counts = array_fill_keys(player_formation_lines(), 0);
            $totalSkill = 0.0;
            foreach ($teamRows as $row) {
                $counts[(string) $row['position']]++;
                $totalSkill += (float) $row['skill'];
            }
            $updateTeamFormation->execute([
                'mid' => $matchId,
                'team_number' => $teamNumber,
                'color_name' => finish_normalize_shirt($teamColorData[$teamNumber] ?? '', $teamNumber),
                'total_skill' => $totalSkill,
                'formation_name' => finish_formation_name_from_counts($counts),
                'formation_data' => json_encode(array_map(static fn(array $row): array => [
                    'id' => (int) $row['id'],
                    'position' => (string) $row['position'],
                ], $teamRows), JSON_UNESCAPED_UNICODE),
            ]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function finish_save_team_goals(int $matchId, array $teams, array $teamGoalsData): void
{
    $saveTeamGoals = db()->prepare(
        'UPDATE match_teams
         SET goals = :goals, updated_at = NOW()
         WHERE match_id = :mid AND team_number = :team_number'
    );
    $verifyTeamGoals = db()->prepare(
        'SELECT goals
         FROM match_teams
         WHERE match_id = :mid AND team_number = :team_number
         LIMIT 1'
    );

    foreach ($teams as $team) {
        $teamNumber = (int) ($team['team_number'] ?? 0);
        if ($teamNumber <= 0) {
            throw new RuntimeException('Hay un equipo invalido en la fecha.');
        }
        if (!array_key_exists($teamNumber, $teamGoalsData) && !array_key_exists((string) $teamNumber, $teamGoalsData)) {
            throw new RuntimeException('Falta el resultado del equipo ' . $teamNumber . '.');
        }

        $goals = max(0, (int) ($teamGoalsData[$teamNumber] ?? $teamGoalsData[(string) $teamNumber] ?? 0));
        $saveTeamGoals->execute([
            'mid' => $matchId,
            'team_number' => $teamNumber,
            'goals' => $goals,
        ]);

        $verifyTeamGoals->execute([
            'mid' => $matchId,
            'team_number' => $teamNumber,
        ]);
        $savedGoals = $verifyTeamGoals->fetchColumn();
        if ($savedGoals === false || (int) $savedGoals !== $goals) {
            throw new RuntimeException('No se pudo guardar el resultado del equipo ' . $teamNumber . '.');
        }
    }
}

function ensure_round_robin_results_schema(): void
{
    $pdo = db();
    if (schema_table_exists($pdo, 'match_round_robin_results')) {
        return;
    }
    $pdo->exec(
        "CREATE TABLE match_round_robin_results (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            home_team_number TINYINT UNSIGNED NOT NULL,
            away_team_number TINYINT UNSIGNED NOT NULL,
            leg TINYINT UNSIGNED NOT NULL,
            home_goals SMALLINT UNSIGNED NULL,
            away_goals SMALLINT UNSIGNED NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_round_robin_fixture (match_id, home_team_number, away_team_number, leg),
            INDEX idx_round_robin_match (match_id),
            CONSTRAINT fk_round_robin_match
              FOREIGN KEY (match_id) REFERENCES matches(id)
              ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

function ensure_round_robin_settings_schema(): void
{
    $pdo = db();
    if (!schema_column_exists($pdo, 'matches', 'round_robin_legs')) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN round_robin_legs TINYINT UNSIGNED NOT NULL DEFAULT 2 AFTER result_notes');
    }
}

function normalize_round_robin_legs(mixed $value): int
{
    return (int) $value === 1 ? 1 : 2;
}

function round_robin_fixtures(array $teams, int $legs = 2): array
{
    $teamNumbers = array_map(static fn(array $team): int => (int) $team['team_number'], $teams);
    sort($teamNumbers);
    $legs = normalize_round_robin_legs($legs);

    $firstLeg = [];
    $secondLeg = [];
    $rotation = $teamNumbers;
    if (count($rotation) % 2 === 1) {
        $rotation[] = 0;
    }

    $roundCount = max(0, count($rotation) - 1);
    $half = (int) (count($rotation) / 2);
    for ($round = 0; $round < $roundCount; $round++) {
        for ($i = 0; $i < $half; $i++) {
            $a = (int) $rotation[$i];
            $b = (int) $rotation[count($rotation) - 1 - $i];
            if ($a === 0 || $b === 0) {
                continue;
            }

            if ($round % 2 === 1) {
                [$a, $b] = [$b, $a];
            }
            $firstLeg[] = ['home' => $a, 'away' => $b, 'leg' => 1];
            $secondLeg[] = ['home' => $b, 'away' => $a, 'leg' => 2];
        }

        $fixed = array_shift($rotation);
        $last = array_pop($rotation);
        array_unshift($rotation, $fixed);
        array_splice($rotation, 1, 0, [$last]);
    }

    return $legs === 1 ? $firstLeg : array_merge($firstLeg, $secondLeg);
}

function round_robin_result_key(int $homeTeam, int $awayTeam, int $leg): string
{
    return $homeTeam . '-' . $awayTeam . '-' . $leg;
}

function repo_round_robin_results(int $matchId): array
{
    $stmt = db()->prepare(
        'SELECT *
         FROM match_round_robin_results
         WHERE match_id = :mid
         ORDER BY leg ASC, home_team_number ASC, away_team_number ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $rows[round_robin_result_key((int) $row['home_team_number'], (int) $row['away_team_number'], (int) $row['leg'])] = $row;
    }
    return $rows;
}

function finish_team_color_from_label(string $label): string
{
    if (preg_match('/\(([^)]+)\)\s*$/i', $label, $matches) !== 1) {
        return '';
    }

    $color = mb_strtoupper(trim($matches[1]), 'UTF-8');
    $knownColors = ['ROSA', 'AZUL', 'VERDE', 'NEGRO', 'NARANJA', 'CAMISADO', 'DESCAMISADO'];
    return in_array($color, $knownColors, true) ? $color : '';
}

function finish_team_heart_color(string $color): string
{
    return match ($color) {
        'ROSA' => '#ec4899',
        'AZUL' => '#2563eb',
        'VERDE' => '#16a34a',
        'NEGRO' => '#111827',
        'NARANJA' => '#f97316',
        'CAMISADO' => '#f8fafc',
        'DESCAMISADO' => '#d6d3d1',
        default => '#047857',
    };
}

function finish_render_team_label(string $label): string
{
    $color = finish_team_color_from_label($label);
    if ($color === '') {
        return h($label);
    }

    $name = trim((string) preg_replace('/\s*\([^)]+\)\s*$/', '', $label));
    if ($name === '') {
        $name = 'Equipo';
    }
    $heartColor = finish_team_heart_color($color);
    return '<span class="team-label-with-heart" title="' . h($label) . '">' .
        '<span>' . h($name) . '</span>' .
        '<svg class="team-heart-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="' . h($heartColor) . '" style="--team-heart-fill: ' . h($heartColor) . '">' .
        '<path fill="' . h($heartColor) . '" style="fill: var(--team-heart-fill, ' . h($heartColor) . ')" d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" />' .
        '</svg>' .
        '</span>';
}

function parse_round_robin_post_scores(array $fixtures, array $scoreData, bool $requireComplete): array
{
    $scores = [];
    foreach ($fixtures as $fixture) {
        $home = (int) $fixture['home'];
        $away = (int) $fixture['away'];
        $leg = (int) $fixture['leg'];
        $key = round_robin_result_key($home, $away, $leg);
        $homeRaw = $scoreData[$key]['home'] ?? '';
        $awayRaw = $scoreData[$key]['away'] ?? '';
        $homeBlank = trim((string) $homeRaw) === '';
        $awayBlank = trim((string) $awayRaw) === '';

        if ($homeBlank || $awayBlank) {
            if ($requireComplete) {
                throw new RuntimeException('Completa todos los cruces antes de calcular el ganador definitivo.');
            }
            if ($homeBlank !== $awayBlank) {
                throw new RuntimeException('Cada cruce parcial debe tener goles para local y visitante.');
            }
            $scores[$key] = ['home' => null, 'away' => null];
            continue;
        }

        $scores[$key] = [
            'home' => max(0, (int) $homeRaw),
            'away' => max(0, (int) $awayRaw),
        ];
    }
    return $scores;
}

function save_round_robin_results(int $matchId, array $fixtures, array $scores): void
{
    $stmt = db()->prepare(
        'INSERT INTO match_round_robin_results (match_id, home_team_number, away_team_number, leg, home_goals, away_goals)
         VALUES (:mid, :home_team, :away_team, :leg, :home_goals, :away_goals)
         ON DUPLICATE KEY UPDATE
           home_goals = VALUES(home_goals),
           away_goals = VALUES(away_goals),
           updated_at = CURRENT_TIMESTAMP'
    );

    foreach ($fixtures as $fixture) {
        $home = (int) $fixture['home'];
        $away = (int) $fixture['away'];
        $leg = (int) $fixture['leg'];
        $score = $scores[round_robin_result_key($home, $away, $leg)] ?? ['home' => null, 'away' => null];
        $stmt->execute([
            'mid' => $matchId,
            'home_team' => $home,
            'away_team' => $away,
            'leg' => $leg,
            'home_goals' => $score['home'],
            'away_goals' => $score['away'],
        ]);
    }
}

function calculate_round_robin_table(array $teams, array $fixtures, array $scores): array
{
    $table = [];
    $validTeams = [];
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        $validTeams[$teamNumber] = true;
        $table[$teamNumber] = [
            'team_number' => $teamNumber,
            'points' => 0,
            'played' => 0,
            'won' => 0,
            'drawn' => 0,
            'lost' => 0,
            'gf' => 0,
            'ga' => 0,
            'gd' => 0,
        ];
    }

    foreach ($fixtures as $fixture) {
        $home = (int) $fixture['home'];
        $away = (int) $fixture['away'];
        $leg = (int) $fixture['leg'];
        if (!isset($validTeams[$home], $validTeams[$away])) {
            continue;
        }

        $score = $scores[round_robin_result_key($home, $away, $leg)] ?? null;
        if (!$score || $score['home'] === null || $score['away'] === null) {
            continue;
        }

        $homeGoals = (int) $score['home'];
        $awayGoals = (int) $score['away'];
        $table[$home]['played']++;
        $table[$away]['played']++;
        $table[$home]['gf'] += $homeGoals;
        $table[$home]['ga'] += $awayGoals;
        $table[$away]['gf'] += $awayGoals;
        $table[$away]['ga'] += $homeGoals;

        if ($homeGoals > $awayGoals) {
            $table[$home]['points'] += 3;
            $table[$home]['won']++;
            $table[$away]['lost']++;
        } elseif ($homeGoals < $awayGoals) {
            $table[$away]['points'] += 3;
            $table[$away]['won']++;
            $table[$home]['lost']++;
        } else {
            $table[$home]['points']++;
            $table[$away]['points']++;
            $table[$home]['drawn']++;
            $table[$away]['drawn']++;
        }
    }

    foreach ($table as &$row) {
        $row['gd'] = $row['gf'] - $row['ga'];
    }
    unset($row);

    uasort($table, static function (array $a, array $b): int {
        return ($b['points'] <=> $a['points'])
            ?: ($b['gd'] <=> $a['gd'])
            ?: ($b['gf'] <=> $a['gf'])
            ?: ($a['team_number'] <=> $b['team_number']);
    });

    return $table;
}

function render_round_robin_standings_table(array $roundRobinTable, array $teamLabels): string
{
    ob_start();
    ?>
    <div class="table-wrap mt-3" data-round-robin-standings-wrap>
      <table class="finish-table round-robin-standings">
        <thead>
          <tr>
            <th>Equipo</th>
            <th>Pts</th>
            <th>PJ</th>
            <th>G</th>
            <th>E</th>
            <th>P</th>
            <th>GF</th>
            <th>GC</th>
            <th>DG</th>
          </tr>
        </thead>
        <tbody>
          <?php foreach ($roundRobinTable as $standing): ?>
            <?php $standingTeam = (int) $standing['team_number']; ?>
            <tr>
              <td data-label="Equipo" class="round-robin-standing-team"><strong><?= finish_render_team_label($teamLabels[$standingTeam] ?? ('Equipo ' . $standingTeam)) ?></strong></td>
              <td data-label="Pts"><?= h((string) $standing['points']) ?></td>
              <td data-label="PJ"><?= h((string) $standing['played']) ?></td>
              <td data-label="G"><?= h((string) $standing['won']) ?></td>
              <td data-label="E"><?= h((string) $standing['drawn']) ?></td>
              <td data-label="P"><?= h((string) $standing['lost']) ?></td>
              <td data-label="GF"><?= h((string) $standing['gf']) ?></td>
              <td data-label="GC"><?= h((string) $standing['ga']) ?></td>
              <td data-label="DG"><?= h((string) $standing['gd']) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
    <?php
    return (string) ob_get_clean();
}

function render_round_robin_winner_panel(array $winner, array $teamLabels): string
{
    $teamNumber = (int) ($winner['team_number'] ?? 0);
    $label = $teamLabels[$teamNumber] ?? ('Equipo ' . $teamNumber);
    $points = (int) ($winner['points'] ?? 0);
    ob_start();
    ?>
    <div class="round-robin-winner-panel" role="status" data-round-robin-winner-panel>
      <span>GANADOR</span>
      <strong><?= finish_render_team_label($label) ?></strong>
      <small><?= h((string) $points) ?> <?= $points === 1 ? 'punto' : 'puntos' ?></small>
    </div>
    <?php
    return (string) ob_get_clean();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_formations') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Fecha invalida.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se pueden editar formaciones de una fecha con equipos ya formados.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $participants = repo_match_participants($matchId);
    $teams = repo_match_teams($matchId);
    $assignedCount = 0;
    foreach ($participants as $player) {
        if ($player['team_number'] !== null) {
            $assignedCount++;
        }
    }
    if (!$participants || $assignedCount !== count($participants) || count($teams) !== (int) $match['num_teams']) {
        flash('error', 'La fecha no tiene todos los jugadores asignados a equipos.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $teamColorData = is_array($_POST['team_color'] ?? null) ? $_POST['team_color'] : [];
    $teamAssignments = is_array($_POST['player_team'] ?? null) ? $_POST['player_team'] : [];
    $positionAssignments = is_array($_POST['player_position'] ?? null) ? $_POST['player_position'] : [];

    try {
        finish_save_match_formations($matchId, $participants, $teams, $teamColorData, $teamAssignments, $positionAssignments);
        flash('success', 'Formaciones y camisetas guardadas.');
    } catch (Throwable $e) {
        flash('error', 'No se pudieron guardar las formaciones: ' . $e->getMessage());
    }
    redirect('finalizar_partido.php?match_id=' . $matchId . '&edit_formations=1&formation_saved=1#formaciones');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_result') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $teamGoalsData = $_POST['team_goals'] ?? [];
    $goalsData = $_POST['goals'] ?? [];
    $ratingData = $_POST['rating'] ?? [];
    $awardData = $_POST['awards'] ?? [];
    $postedTeamGoalsData = is_array($teamGoalsData) ? $teamGoalsData : [];
    $postedGoalsData = is_array($goalsData) ? $goalsData : [];
    $postedRatingData = is_array($ratingData) ? $ratingData : [];
    $postedAwardData = is_array($awardData) ? $awardData : [];

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Fecha invalida.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se puede finalizar una fecha con equipos ya sorteados o capitanes completos.');
        redirect('finalizar_partido.php?match_id=' . $matchId . '&edit_details=1#valoraciones');
    }
    if (valuations_locked_after_deadline($match)) {
        flash('error', 'Las valoraciones ya no se pueden editar porque pasaron mas de 7 dias desde la finalizacion de la fecha.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $participants = repo_match_participants($matchId);
    $assignedCount = 0;
    $teamsSeen = [];
    foreach ($participants as $p) {
        if ($p['team_number'] !== null) {
            $assignedCount++;
            $teamsSeen[(int) $p['team_number']] = true;
        }
    }
    if (!$participants || $assignedCount !== count($participants) || count($teamsSeen) !== (int) $match['num_teams']) {
        flash('error', 'La fecha no tiene todos los jugadores asignados a equipos.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $teams = repo_match_teams($matchId);
    if (count($teams) !== (int) $match['num_teams']) {
        flash('error', 'Faltan datos de equipos. Vuelve a generar el sorteo o completa capitanes.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        if (!isset($teamGoalsData[$teamNumber]) || trim((string) $teamGoalsData[$teamNumber]) === '') {
            flash('error', 'Primero carga el resultado de la fecha.');
            redirect('finalizar_partido.php?match_id=' . $matchId);
        }
    }

    $expectedTeamGoals = [];
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        $expectedTeamGoals[$teamNumber] = max(0, (int) ($teamGoalsData[$teamNumber] ?? 0));
    }

    $playerGoalsByTeam = [];
    foreach ($participants as $player) {
        if ($player['team_number'] === null) {
            continue;
        }
        $teamNumber = (int) $player['team_number'];
        $pid = (int) $player['id'];
        $playerGoalsByTeam[$teamNumber] = ($playerGoalsByTeam[$teamNumber] ?? 0) + max(0, (int) ($goalsData[$pid] ?? 0));
    }

    foreach ($expectedTeamGoals as $teamNumber => $expectedGoals) {
        $loadedGoals = (int) ($playerGoalsByTeam[$teamNumber] ?? 0);
        if ($loadedGoals !== $expectedGoals) {
            $matchTeams = repo_match_teams($matchId);
            $teamLabels = repo_match_team_labels($match, $matchTeams);
            $teamLabel = $teamLabels[$teamNumber] ?? ('Equipo ' . $teamNumber);
            $diff = $expectedGoals - $loadedGoals;
            $detail = $diff > 0
                ? 'faltan ' . $diff . ' gol' . ($diff === 1 ? '' : 'es')
                : 'sobran ' . abs($diff) . ' gol' . (abs($diff) === 1 ? '' : 'es');
            $detailFormError = "{$teamLabel}: el resultado indica {$expectedGoals} goles y los jugadores suman {$loadedGoals}; {$detail}. Corrige los goles por jugador antes de guardar.";
            $forceEditDetails = true;
            break;
        }
    }

    if ($detailFormError === '') {
        $pdo->beginTransaction();
        try {
            finish_save_team_goals($matchId, $teams, is_array($teamGoalsData) ? $teamGoalsData : []);

            $upd = $pdo->prepare(
                'UPDATE match_players
                 SET goals = :goals, rating = :rating
                 WHERE match_id = :mid AND player_id = :pid'
            );

            $allowedAwardPlayerIds = [];
            foreach ($participants as $player) {
                $pid = (int) $player['id'];
                if ($player['team_number'] === null) {
                    continue;
                }
                $allowedAwardPlayerIds[] = $pid;
                $goals = max(0, (int) ($goalsData[$pid] ?? 0));
                $ratingRaw = $ratingData[$pid] ?? '';
                $rating = null;
                if ($ratingRaw !== '' && $ratingRaw !== null) {
                    $rating = max(1.0, min(10.0, round(((float) $ratingRaw) * 2) / 2));
                }
                $upd->execute([
                    'mid' => $matchId,
                    'pid' => $pid,
                    'goals' => $goals,
                    'rating' => $rating,
                ]);
            }

            $teamAssignments = is_array($_POST['player_team'] ?? null) ? $_POST['player_team'] : [];
            $positionAssignments = is_array($_POST['player_position'] ?? null) ? $_POST['player_position'] : [];
            $allowedPositions = player_formation_lines();
            $participantIds = array_map(static fn(array $player): int => (int) $player['id'], $participants);
            $participantIdSet = array_flip($participantIds);
            $teamNumbers = array_map(static fn(array $team): int => (int) $team['team_number'], repo_match_teams($matchId));
            $teamNumberSet = array_flip($teamNumbers);

            if ($teamAssignments || $positionAssignments) {
                $formationRows = [];
                foreach ($participants as $player) {
                    $pid = (int) $player['id'];
                    if (!isset($participantIdSet[$pid]) || $player['team_number'] === null) {
                        continue;
                    }
                    $teamNumber = (int) ($teamAssignments[$pid] ?? $player['team_number']);
                    if (!isset($teamNumberSet[$teamNumber])) {
                        throw new RuntimeException('Hay una asignacion de equipo invalida.');
                    }
                    $position = strtoupper(trim((string) ($positionAssignments[$pid] ?? ($player['assigned_position'] ?: 'MED'))));
                    if (!in_array($position, $allowedPositions, true)) {
                        $position = 'MED';
                    }
                    $formationRows[] = [
                        'id' => $pid,
                        'team_number' => $teamNumber,
                        'position' => $position,
                        'skill' => (float) ($player['skill'] ?? 0),
                    ];
                }

                $lineOrder = [];
                $lineupOrder = [];
                $updateAssignment = $pdo->prepare(
                    'UPDATE match_players
                     SET team_number = :team_number, assigned_position = :assigned_position, is_goalkeeper = :is_goalkeeper,
                         lineup_order = :lineup_order, formation_line_order = :formation_line_order
                     WHERE match_id = :mid AND player_id = :pid'
                );
                foreach ($formationRows as $index => $row) {
                    $teamNumber = (int) $row['team_number'];
                    $position = (string) $row['position'];
                    $lineOrder[$teamNumber] = $lineOrder[$teamNumber] ?? array_fill_keys(player_formation_lines(), 0);
                    $lineupOrder[$teamNumber] = ($lineupOrder[$teamNumber] ?? 0) + 1;
                    $lineOrder[$teamNumber][$position]++;
                    $updateAssignment->execute([
                        'mid' => $matchId,
                        'pid' => (int) $row['id'],
                        'team_number' => $teamNumber,
                        'assigned_position' => $position,
                        'is_goalkeeper' => $position === 'ARQ' ? 1 : 0,
                        'lineup_order' => $lineupOrder[$teamNumber],
                        'formation_line_order' => $lineOrder[$teamNumber][$position],
                    ]);
                }

                $updateTeamFormation = $pdo->prepare(
                    'UPDATE match_teams
                     SET total_skill = :total_skill, formation_name = :formation_name, formation_data = :formation_data
                     WHERE match_id = :mid AND team_number = :team_number'
                );
                foreach ($teamNumbers as $teamNumber) {
                    $teamRows = array_values(array_filter($formationRows, static fn(array $row): bool => (int) $row['team_number'] === (int) $teamNumber));
                    $counts = array_fill_keys(player_formation_lines(), 0);
                    $totalSkill = 0.0;
                    foreach ($teamRows as $row) {
                        $counts[(string) $row['position']]++;
                        $totalSkill += (float) $row['skill'];
                    }
                    $updateTeamFormation->execute([
                        'mid' => $matchId,
                        'team_number' => $teamNumber,
                        'total_skill' => $totalSkill,
                        'formation_name' => finish_formation_name_from_counts($counts),
                        'formation_data' => json_encode(array_map(static fn(array $row): array => [
                            'id' => (int) $row['id'],
                            'position' => (string) $row['position'],
                        ], $teamRows), JSON_UNESCAPED_UNICODE),
                    ]);
                }
            }

            $parsedAwards = [];
            foreach (award_definitions() as $code => $_definition) {
                $rawAward = trim((string) ($awardData[$code] ?? ''));
                if ($rawAward === '') {
                    $parsedAwards[$code] = 0;
                    continue;
                }
                if (preg_match('/#(\d+)/', $rawAward, $matchAward)) {
                    $parsedAwards[$code] = (int) $matchAward[1];
                    continue;
                }
                throw new RuntimeException('Selecciona los premios desde la lista de jugadores de la fecha.');
            }
            repo_save_match_awards($matchId, $parsedAwards, $allowedAwardPlayerIds);

            $stmt = $pdo->prepare('UPDATE matches SET status = :status, finalized_at = NOW(), result_saved_at = COALESCE(result_saved_at, NOW()) WHERE id = :id');
            $stmt->execute(['status' => 'finalizado', 'id' => $matchId]);

            $pdo->commit();
            flash('success', 'Datos de la fecha guardados. Fecha finalizada.');
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            flash('error', 'No se pudo guardar: ' . $e->getMessage());
        }
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'save_score') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $teamGoalsData = $_POST['team_goals'] ?? [];

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        flash('error', 'Fecha invalida.');
        redirect('finalizar_partido.php');
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        flash('error', 'Solo se puede cargar resultado de una fecha con equipos ya formados.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $teams = repo_match_teams($matchId);
    if (!$teams) {
        flash('error', 'Faltan datos de equipos. Vuelve a generar el sorteo o completa capitanes.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
    foreach ($teams as $team) {
        $teamNumber = (int) $team['team_number'];
        if (!isset($teamGoalsData[$teamNumber]) || trim((string) $teamGoalsData[$teamNumber]) === '') {
            flash('error', 'Carga el resultado de la fecha.');
            redirect('finalizar_partido.php?match_id=' . $matchId);
        }
    }

    $pdo->beginTransaction();
    try {
        finish_save_team_goals($matchId, $teams, is_array($teamGoalsData) ? $teamGoalsData : []);
        $stmt = $pdo->prepare('UPDATE matches SET status = :status, finalized_at = COALESCE(finalized_at, NOW()), result_saved_at = NOW() WHERE id = :id');
        $stmt->execute(['status' => 'finalizado', 'id' => $matchId]);
        $pdo->commit();
        flash('success', 'Resultado guardado. Fecha finalizada.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        flash('error', 'No se pudo guardar el resultado: ' . $e->getMessage());
    }
    redirect('finalizar_partido.php?match_id=' . $matchId);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array((string) ($_POST['action'] ?? ''), ['save_round_robin_scores', 'calculate_round_robin_winner', 'finalize_round_robin_date'], true)) {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $scoreData = $_POST['round_robin'] ?? [];
    $scoreData = is_array($scoreData) ? $scoreData : [];
    $roundRobinAction = (string) ($_POST['action'] ?? '');
    $shouldCalculate = $roundRobinAction === 'calculate_round_robin_winner';
    $shouldFinalizeRoundRobin = $roundRobinAction === 'finalize_round_robin_date';
    $roundRobinLegs = normalize_round_robin_legs($_POST['round_robin_legs'] ?? 1);
    $isAjax = (string) ($_POST['ajax'] ?? '') === '1';

    $match = $matchId > 0 ? repo_match_by_id($matchId) : null;
    if (!$match) {
        if ($isAjax) {
            finish_json_response(['ok' => false, 'message' => 'Fecha invalida.'], 404);
        }
        flash('error', 'Fecha invalida.');
        redirect('finalizar_partido.php');
    }
    if ((int) ($match['num_teams'] ?? 0) <= 2) {
        if ($isAjax) {
            finish_json_response(['ok' => false, 'message' => 'La modalidad todos contra todos solo aplica a fechas con mas de 2 equipos.'], 422);
        }
        flash('error', 'La modalidad todos contra todos solo aplica a fechas con mas de 2 equipos.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }
    if (!in_array((string) $match['status'], ['sorteado', 'finalizado'], true)) {
        if ($isAjax) {
            finish_json_response(['ok' => false, 'message' => 'Solo se puede cargar resultado de una fecha con equipos ya formados.'], 422);
        }
        flash('error', 'Solo se puede cargar resultado de una fecha con equipos ya formados.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $teams = repo_match_teams($matchId);
    if (count($teams) !== (int) $match['num_teams']) {
        if ($isAjax) {
            finish_json_response(['ok' => false, 'message' => 'Faltan datos de equipos. Vuelve a generar el sorteo o completa capitanes.'], 422);
        }
        flash('error', 'Faltan datos de equipos. Vuelve a generar el sorteo o completa capitanes.');
        redirect('finalizar_partido.php?match_id=' . $matchId);
    }

    $fixtures = round_robin_fixtures($teams, $roundRobinLegs);
    try {
        $scores = parse_round_robin_post_scores($fixtures, $scoreData, false);
        $playedCount = count(array_filter($scores, static fn(array $score): bool => $score['home'] !== null && $score['away'] !== null));
        $roundRobinComplete = $playedCount === count($fixtures);
        $table = calculate_round_robin_table($teams, $fixtures, $scores);
        if ($shouldFinalizeRoundRobin && $playedCount === 0) {
            throw new RuntimeException('Carga al menos un resultado antes de finalizar la fecha.');
        }
        $pdo->beginTransaction();
        $saveLegs = $pdo->prepare('UPDATE matches SET round_robin_legs = :legs WHERE id = :id');
        $saveLegs->execute(['legs' => $roundRobinLegs, 'id' => $matchId]);
        if ($roundRobinLegs === 1) {
            $clearSecondLeg = $pdo->prepare('DELETE FROM match_round_robin_results WHERE match_id = :mid AND leg = 2');
            $clearSecondLeg->execute(['mid' => $matchId]);
        }
        save_round_robin_results($matchId, $fixtures, $scores);

        if ($shouldFinalizeRoundRobin) {
            $roundRobinTeamGoals = [];
            foreach ($table as $teamNumber => $row) {
                $roundRobinTeamGoals[(int) $teamNumber] = (int) $row['gf'];
            }
            finish_save_team_goals($matchId, $teams, $roundRobinTeamGoals);
            $stmt = $pdo->prepare('UPDATE matches SET status = :status, finalized_at = COALESCE(finalized_at, NOW()), result_saved_at = NOW() WHERE id = :id');
            $stmt->execute(['status' => 'finalizado', 'id' => $matchId]);
        }

        $pdo->commit();
        if ($isAjax) {
            $teamLabels = repo_match_team_labels($match, $teams);
            $winner = array_values($table)[0] ?? null;
            $winnerLabel = $winner ? ($teamLabels[(int) $winner['team_number']] ?? ('Equipo ' . (int) $winner['team_number'])) : '';
            $winnerPoints = $winner ? (int) ($winner['points'] ?? 0) : 0;
            $message = $shouldCalculate && $winnerLabel !== ''
                ? $winnerLabel . ' gano con ' . $winnerPoints . ' ' . ($winnerPoints === 1 ? 'punto' : 'puntos') . '.'
                : 'Resultados parciales guardados.';
            finish_json_response([
                'ok' => true,
                'message' => $message,
                'played_count' => $playedCount,
                'complete' => $roundRobinComplete,
                'standings_html' => $playedCount > 0 ? render_round_robin_standings_table($table, $teamLabels) : '',
                'winner_html' => $shouldCalculate && $winner ? render_round_robin_winner_panel($winner, $teamLabels) : '',
            ]);
        }
        if ($shouldCalculate) {
            $winner = array_values($table)[0] ?? null;
            $teamLabels = repo_match_team_labels($match, $teams);
            $winnerLabel = $winner ? ($teamLabels[(int) $winner['team_number']] ?? ('Equipo ' . (int) $winner['team_number'])) : 'ganador';
            flash('success', 'Ganador actual: ' . $winnerLabel . '.');
            redirect('finalizar_partido.php?match_id=' . $matchId);
        }
        if ($shouldFinalizeRoundRobin) {
            flash('success', 'Fecha finalizada. Resultado guardado.');
            redirect('finalizar_partido.php?match_id=' . $matchId);
        }
        flash('success', 'Resultados parciales guardados.');
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($isAjax) {
            finish_json_response(['ok' => false, 'message' => 'No se pudo guardar el fixture: ' . $e->getMessage()], 422);
        }
        flash('error', 'No se pudo guardar el fixture: ' . $e->getMessage());
    }
    redirect('finalizar_partido.php?match_id=' . $matchId);
}

$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants((int) $selectedMatch['id']) : [];
$groupedTeams = $selectedMatch ? repo_grouped_team_players((int) $selectedMatch['id']) : [];
$awardDefinitions = award_definitions();
$awardDescriptions = award_descriptions();
$savedAwards = $selectedMatch ? repo_match_awards((int) $selectedMatch['id']) : [];
$valuationsLocked = $selectedMatch ? valuations_locked_after_deadline($selectedMatch) : false;
$editDetails = !$valuationsLocked && ($forceEditDetails || (isset($_GET['edit_details']) && $_GET['edit_details'] === '1'));
$editFormations = isset($_GET['edit_formations']) && $_GET['edit_formations'] === '1';
$backUrl = 'editar_partidos.php';
$referer = (string) ($_SERVER['HTTP_REFERER'] ?? '');
if ($referer !== '') {
    $refererParts = parse_url($referer);
    $currentHost = (string) ($_SERVER['HTTP_HOST'] ?? '');
    $refererHost = (string) ($refererParts['host'] ?? '');
    $refererPath = (string) ($refererParts['path'] ?? '');
    if ($refererHost === $currentHost && !str_ends_with($refererPath, '/finalizar_partido.php')) {
        $backUrl = $referer;
    }
}

$title = 'Finalizar fecha | ' . APP_NAME;
$activePage = 'finalizar_partido.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Finalizar fecha</h1>
    <p class="small-muted">Carga goles y calificacion por jugador para cerrar la fecha y sumar estadisticas.</p>
  </div>
  <a class="btn btn-muted" href="<?= h($backUrl) ?>">Volver</a>
</section>

<?php if ($selectedMatch): ?>
  <section class="card mb-3.5">
    <h3><?= h((string) ($selectedMatch['title'] ?: ('Fecha #' . $selectedMatch['id']))) ?></h3>
    <p class="small-muted">Estado actual: <strong><?= h((string) $selectedMatch['status']) ?></strong></p>
    <?php if (!$groupedTeams): ?>
      <p>No hay equipos sorteados todavia para esta fecha.</p>
    <?php else: ?>
      <?php
        $matchTeams = repo_match_teams((int) $selectedMatch['id']);
        $teamLabels = repo_match_team_labels($selectedMatch, $matchTeams);
        $isRoundRobinMatch = (int) ($selectedMatch['num_teams'] ?? 0) > 2;
        $roundRobinLegs = normalize_round_robin_legs($selectedMatch['round_robin_legs'] ?? 2);
        $roundRobinFixtures = $isRoundRobinMatch ? round_robin_fixtures($matchTeams, $roundRobinLegs) : [];
        $roundRobinDisplayFixtures = $isRoundRobinMatch ? round_robin_fixtures($matchTeams, 2) : [];
        $roundRobinResults = $isRoundRobinMatch ? repo_round_robin_results((int) $selectedMatch['id']) : [];
        $roundRobinScores = [];
        foreach ($roundRobinDisplayFixtures as $fixture) {
            $fixtureKey = round_robin_result_key((int) $fixture['home'], (int) $fixture['away'], (int) $fixture['leg']);
            $resultRow = $roundRobinResults[$fixtureKey] ?? null;
            $roundRobinScores[$fixtureKey] = [
                'home' => $resultRow && $resultRow['home_goals'] !== null ? (int) $resultRow['home_goals'] : null,
                'away' => $resultRow && $resultRow['away_goals'] !== null ? (int) $resultRow['away_goals'] : null,
            ];
        }
        $roundRobinPlayedCount = count(array_filter($roundRobinFixtures, static function (array $fixture) use ($roundRobinScores): bool {
            $key = round_robin_result_key((int) $fixture['home'], (int) $fixture['away'], (int) $fixture['leg']);
            $score = $roundRobinScores[$key] ?? null;
            return is_array($score) && $score['home'] !== null && $score['away'] !== null;
        }));
        $roundRobinHasScores = $roundRobinPlayedCount > 0;
        $roundRobinComplete = $isRoundRobinMatch && $roundRobinPlayedCount === count($roundRobinFixtures);
        $roundRobinTable = $isRoundRobinMatch ? calculate_round_robin_table($matchTeams, $roundRobinFixtures, $roundRobinScores) : [];
        $scoreSaved = repo_match_has_saved_result($selectedMatch, $matchTeams);
        $canEditFormations = count($matchTeams) > 0 && in_array((string) ($selectedMatch['status'] ?? ''), ['sorteado', 'finalizado'], true);
        $hasSavedRatings = count(array_filter($participants, static fn(array $player): bool => $player['rating'] !== null && $player['rating'] !== '')) > 0;
        $hasSavedAwards = count($savedAwards) > 0;
        $canShareMatchSummary = $scoreSaved;
        $shareSummary = $canShareMatchSummary
            ? build_match_share_summary($selectedMatch, $matchTeams, $teamLabels, $groupedTeams, $awardDefinitions, $savedAwards)
            : '';
      ?>
      <section class="finish-score-shell">
        <?php if ($isRoundRobinMatch): ?>
          <details class="card finish-collapse finish-round-robin-fixture" data-round-robin-fixture-details <?= $scoreSaved ? '' : 'open' ?>>
            <summary>
              <span>Fixture todos contra todos</span>
              <small><?= $scoreSaved ? 'Compactado' : 'Cargar resultados' ?></small>
            </summary>
          <form method="post" action="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>" data-round-robin-form>
            <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
            <div class="finish-score-head">
              <div>
                <p class="small-muted">Carga ida y vuelta. El sistema calcula puntos, diferencia de gol y goles totales por equipo.</p>
              </div>
            </div>
            <label class="round-robin-mode-toggle">
              <input type="checkbox" name="round_robin_legs" value="2" data-round-robin-legs-toggle <?= $roundRobinLegs === 2 ? 'checked' : '' ?>>
              <span>Jugar ida y vuelta</span>
            </label>
            <div class="table-wrap">
              <table class="finish-table round-robin-table">
                <thead>
                  <tr>
                    <th>Cruce</th>
                    <th>Local</th>
                    <th>Resultado</th>
                    <th>Visitante</th>
                    <th>Guardar</th>
                  </tr>
                </thead>
                <tbody>
                  <?php foreach ($roundRobinDisplayFixtures as $fixture): ?>
                    <?php
                      $homeTeam = (int) $fixture['home'];
                      $awayTeam = (int) $fixture['away'];
                      $leg = (int) $fixture['leg'];
                      $fixtureKey = round_robin_result_key($homeTeam, $awayTeam, $leg);
                      $fixtureScore = $roundRobinScores[$fixtureKey] ?? ['home' => null, 'away' => null];
                      $fixtureSaved = $fixtureScore['home'] !== null && $fixtureScore['away'] !== null;
                    ?>
                    <tr class="<?= $fixtureSaved ? 'is-round-robin-saved' : '' ?>" data-round-robin-row data-round-robin-leg="<?= (int) $leg ?>" data-round-robin-home="<?= $homeTeam ?>" data-round-robin-away="<?= $awayTeam ?>">
                      <td data-label="Cruce"><strong><?= $leg === 1 ? 'Ida' : 'Vuelta' ?></strong></td>
                      <td data-label="Local" class="round-robin-team-cell" data-team-number="<?= $homeTeam ?>"><?= finish_render_team_label($teamLabels[$homeTeam] ?? ('Equipo ' . $homeTeam)) ?></td>
                      <td data-label="Resultado">
                        <div class="round-robin-score-inputs">
                          <input class="finish-number-input" type="number" min="0" step="1" name="round_robin[<?= h($fixtureKey) ?>][home]" value="<?= $fixtureScore['home'] === null ? '' : h((string) $fixtureScore['home']) ?>" aria-label="Goles local">
                          <span>-</span>
                          <input class="finish-number-input" type="number" min="0" step="1" name="round_robin[<?= h($fixtureKey) ?>][away]" value="<?= $fixtureScore['away'] === null ? '' : h((string) $fixtureScore['away']) ?>" aria-label="Goles visitante">
                        </div>
                      </td>
                      <td data-label="Visitante" class="round-robin-team-cell" data-team-number="<?= $awayTeam ?>"><?= finish_render_team_label($teamLabels[$awayTeam] ?? ('Equipo ' . $awayTeam)) ?></td>
                      <td data-label="Guardar" class="round-robin-save-cell">
                        <button class="btn <?= $fixtureSaved ? 'btn-primary is-saved' : 'btn-muted' ?> round-robin-row-save" type="submit" name="action" value="save_round_robin_scores"><?= $fixtureSaved ? 'Guardado' : 'Guardar' ?></button>
                      </td>
                    </tr>
                  <?php endforeach; ?>
                </tbody>
              </table>
            </div>
            <div data-round-robin-standings-target>
              <?php if ($roundRobinHasScores): ?>
                <?= render_round_robin_standings_table($roundRobinTable, $teamLabels) ?>
              <?php endif; ?>
            </div>
            <div data-round-robin-winner-target></div>
            <div class="btn-row finish-score-actions">
              <button class="btn btn-primary" type="submit" name="action" value="calculate_round_robin_winner">Calcular ganador</button>
              <button class="btn btn-warning" type="submit" name="action" value="finalize_round_robin_date" data-confirm="Finalizar esta fecha y publicar el ganador?">Finalizar fecha</button>
              <?php if ($scoreSaved && !$valuationsLocked): ?>
                <a class="btn <?= $editDetails ? 'btn-primary' : 'btn-muted' ?> finish-edit-btn" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>&edit_details=<?= $editDetails ? '0' : '1' ?><?= $editDetails ? '' : '#valoraciones' ?>" title="<?= $editDetails ? 'Ocultar puntajes y premios' : 'Editar puntajes y premios' ?>"><span class="finish-edit-icon"><?= $editDetails ? '-' : '+' ?></span><span><?= $editDetails ? 'Ocultar valoraciones' : 'Abrir valoraciones' ?></span></a>
              <?php endif; ?>
              <?php if ($canEditFormations): ?>
                <a class="btn <?= $editFormations ? 'btn-primary' : 'btn-muted' ?> finish-edit-btn" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>&edit_formations=<?= $editFormations ? '0' : '1' ?><?= $editFormations ? '' : '#formaciones' ?>" title="<?= $editFormations ? 'Ocultar formaciones y camisetas' : 'Editar formaciones y camisetas' ?>"><span class="finish-edit-icon"><?= $editFormations ? '-' : '+' ?></span><span><?= $editFormations ? 'Ocultar formaciones' : 'Ver formaciones' ?></span></a>
              <?php endif; ?>
            </div>
          </form>
          </details>
        <?php else: ?>
          <div class="card">
          <form method="post" action="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>" data-no-partial>
            <input type="hidden" name="action" value="save_score">
            <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
            <div class="finish-score-head">
              <div>
                <h3>Resultado de la fecha</h3>
                <p class="small-muted">Primero guarda como salio la fecha.</p>
              </div>
            </div>
            <div class="finish-result-grid">
              <?php foreach ($matchTeams as $team): ?>
                <div class="finish-result-team">
                  <label><?= h($teamLabels[(int) $team['team_number']] ?? ('Equipo ' . (int) $team['team_number'])) ?></label>
                  <input type="number" min="0" step="1" name="team_goals[<?= (int) $team['team_number'] ?>]" value="<?= h((string) ((int) ($team['goals'] ?? 0))) ?>" required>
                </div>
              <?php endforeach; ?>
            </div>
            <div class="btn-row finish-score-actions">
              <button class="btn btn-primary" type="submit" name="action" value="save_score" data-confirm="Guardar este resultado?">Guardar resultado</button>
              <?php if ($scoreSaved && !$valuationsLocked): ?>
                <a class="btn <?= $editDetails ? 'btn-primary' : 'btn-muted' ?> finish-edit-btn" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>&edit_details=<?= $editDetails ? '0' : '1' ?><?= $editDetails ? '' : '#valoraciones' ?>" title="<?= $editDetails ? 'Ocultar puntajes y premios' : 'Editar puntajes y premios' ?>"><span class="finish-edit-icon"><?= $editDetails ? '-' : '+' ?></span><span><?= $editDetails ? 'Ocultar valoraciones' : 'Abrir valoraciones' ?></span></a>
              <?php elseif ($scoreSaved && $valuationsLocked): ?>
                <span class="btn btn-disabled finish-edit-btn" title="Pasaron mas de 7 dias desde la finalizacion de la fecha"><span class="finish-edit-icon">&#9999;</span><span>Valoraciones bloqueadas</span></span>
              <?php else: ?>
                <span class="btn btn-disabled finish-edit-btn" title="Guarda el resultado para habilitar puntajes y premios"><span class="finish-edit-icon">&#9999;</span><span>Valoraciones</span></span>
              <?php endif; ?>
              <?php if ($canEditFormations): ?>
                <a class="btn <?= $editFormations ? 'btn-primary' : 'btn-muted' ?> finish-edit-btn" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>&edit_formations=<?= $editFormations ? '0' : '1' ?><?= $editFormations ? '' : '#formaciones' ?>" title="<?= $editFormations ? 'Ocultar formaciones y camisetas' : 'Editar formaciones y camisetas' ?>"><span class="finish-edit-icon"><?= $editFormations ? '-' : '+' ?></span><span><?= $editFormations ? 'Ocultar formaciones' : 'Ver formaciones' ?></span></a>
              <?php endif; ?>
            </div>
          </form>
          </div>
        <?php endif; ?>
      </section>

      <?php if ($canShareMatchSummary): ?>
        <section class="card finish-share-card">
          <div>
            <h3>Compartir datos</h3>
            <p class="small-muted">Resumen con resultado, equipos y datos opcionales cargados.</p>
          </div>
          <textarea class="sr-only" data-finish-share-text readonly><?= h($shareSummary) ?></textarea>
          <div class="btn-row finish-share-actions">
            <button class="btn btn-primary" type="button" data-finish-share>Compartir resumen</button>
            <button class="btn btn-muted" type="button" data-finish-copy>Copiar resumen</button>
          </div>
        </section>
      <?php endif; ?>

      <?php if ($scoreSaved && $valuationsLocked): ?>
        <p class="flash flash-info">Las valoraciones quedaron bloqueadas porque pasaron mas de 7 dias desde la finalizacion de la fecha.</p>
      <?php endif; ?>

      <?php if ($canEditFormations && $editFormations): ?>
        <?php
          $shirtOptions = finish_shirt_options();
          $teamPlayerRows = [];
          foreach ($matchTeams as $team) {
              $teamPlayerRows[(int) $team['team_number']] = [];
          }
          foreach ($groupedTeams as $teamNumber => $lines) {
              foreach (player_formation_lines() as $line) {
                  foreach ($lines[$line] as $player) {
                      $teamPlayerRows[(int) $teamNumber][] = $player;
                  }
              }
          }
        ?>
        <form method="post" id="formaciones" class="card finish-formation-editor" data-no-partial>
          <input type="hidden" name="action" value="save_formations">
          <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
          <script type="application/json" data-finish-team-analysis-config><?= json_encode([
            'numTeams' => (int) ($selectedMatch['num_teams'] ?? count($matchTeams)),
            'playersPerTeam' => (int) ($selectedMatch['players_per_team'] ?? 1),
            'maxDiff' => (float) ($selectedMatch['max_diff'] ?? 0.5),
            'players' => array_map(static fn(array $p): array => [
                'id' => (int) $p['id'],
                'name' => (string) $p['name'],
                'positions' => (string) ($p['positions'] ?? ''),
                'pace' => (string) ($p['pace'] ?? ''),
                'skill' => (float) ($p['skill'] ?? 0),
                'technique' => player_effective_stat($p, 'technique'),
                'rhythm' => player_effective_stat($p, 'rhythm'),
                'defense_physical' => player_effective_stat($p, 'defense_physical'),
                'attack' => player_effective_stat($p, 'attack'),
                'teamwork' => player_effective_stat($p, 'teamwork'),
                'mentality' => player_effective_stat($p, 'mentality'),
                'regularity' => player_effective_stat($p, 'regularity'),
                'goalkeeper_skill' => player_effective_stat($p, 'goalkeeper_skill'),
                'photo_path' => player_photo_path($p),
                'photo_custom' => player_has_custom_photo($p),
            ], $participants),
          ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?></script>
          <div class="finish-formation-head">
            <div>
              <h3>Formaciones y camisetas</h3>
              <p class="small-muted">Ajusta como quedo parado cada equipo y que camiseta uso en este partido.</p>
            </div>
            <div class="finish-formation-head-actions">
              <button class="btn btn-muted" type="button" data-finish-analyze-teams>Analizar equipos</button>
              <button class="btn btn-primary" type="submit" name="action" value="save_formations" data-confirm="Guardar formaciones y camisetas de esta fecha?">Guardar formaciones</button>
            </div>
          </div>
          <div class="finish-formation-grid">
            <?php foreach ($matchTeams as $team): ?>
              <?php
                $teamNumber = (int) $team['team_number'];
                $currentShirt = finish_normalize_shirt($team['color_name'] ?? '', $teamNumber);
                $teamRows = $teamPlayerRows[$teamNumber] ?? [];
              ?>
              <article class="finish-formation-team" data-finish-formation-team="<?= $teamNumber ?>">
                <header>
                  <div>
                    <small>Equipo <?= $teamNumber ?></small>
                    <h4><?= finish_render_team_label($teamLabels[$teamNumber] ?? ('Equipo ' . $teamNumber)) ?></h4>
                  </div>
                  <label class="finish-formation-shirt">
                    <span>Camiseta</span>
                    <select name="team_color[<?= $teamNumber ?>]" aria-label="Camiseta del equipo <?= $teamNumber ?>">
                      <?php foreach ($shirtOptions as $shirt): ?>
                        <option value="<?= h($shirt) ?>" <?= selected_attr($currentShirt === $shirt) ?>><?= h($shirt) ?></option>
                      <?php endforeach; ?>
                    </select>
                  </label>
                </header>
                <div class="table-wrap finish-formation-table-wrap">
                  <table class="finish-table finish-formation-table">
                    <thead>
                      <tr>
                        <th>Jugador</th>
                        <th>Equipo</th>
                        <th>Linea</th>
                      </tr>
                    </thead>
                    <tbody>
                      <?php foreach ($teamRows as $player): ?>
                        <?php
                          $playerId = (int) $player['id'];
                          $currentTeam = (int) ($player['team_number'] ?? $teamNumber);
                          $currentPosition = finish_player_position($player);
                        ?>
                        <tr data-finish-formation-row data-player-id="<?= $playerId ?>">
                          <td data-label="Jugador">
                            <strong><?= h((string) $player['name']) ?></strong>
                            <small><?= h((string) ($player['positions'] ?? '')) ?></small>
                          </td>
                          <td data-label="Equipo">
                            <select name="player_team[<?= $playerId ?>]" aria-label="Equipo de <?= h((string) $player['name']) ?>">
                              <?php foreach ($matchTeams as $targetTeam): ?>
                                <?php $targetTeamNumber = (int) $targetTeam['team_number']; ?>
                                <option value="<?= $targetTeamNumber ?>" <?= selected_attr($currentTeam === $targetTeamNumber) ?>><?= h($teamLabels[$targetTeamNumber] ?? ('Equipo ' . $targetTeamNumber)) ?></option>
                              <?php endforeach; ?>
                            </select>
                          </td>
                          <td data-label="Linea">
                            <select name="player_position[<?= $playerId ?>]" aria-label="Linea de <?= h((string) $player['name']) ?>">
                              <?php foreach (allowed_positions() as $position): ?>
                                <option value="<?= h($position) ?>" <?= selected_attr($currentPosition === $position) ?>><?= h($position) ?></option>
                              <?php endforeach; ?>
                            </select>
                          </td>
                        </tr>
                      <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </article>
            <?php endforeach; ?>
          </div>
          <div class="finish-formation-pitch-preview" data-finish-formation-pitch></div>
          <div class="manual-analysis-panel finish-team-analysis-panel" data-finish-team-analysis hidden></div>
          <div class="btn-row finish-formation-actions">
            <button class="btn btn-muted" type="button" data-finish-analyze-teams>Analizar equipos</button>
            <button class="btn btn-primary" type="submit" name="action" value="save_formations" data-confirm="Guardar formaciones y camisetas de esta fecha?">Guardar formaciones</button>
          </div>
        </form>
      <?php endif; ?>

      <?php if ($scoreSaved && $editDetails): ?>
      <form method="post">
        <input type="hidden" name="action" value="save_result">
        <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
        <datalist id="matchAwardPlayers">
          <?php foreach ($participants as $player): ?>
            <?php if ($player['team_number'] === null) continue; ?>
            <option value="<?= h((string) $player['name'] . ' (#' . (int) $player['id'] . ')') ?>"></option>
          <?php endforeach; ?>
        </datalist>
        <datalist id="matchAwardGoalkeepers">
          <?php foreach ($participants as $player): ?>
            <?php if ($player['team_number'] === null || !in_array('ARQ', parse_positions_csv((string) $player['positions']), true)) continue; ?>
            <option value="<?= h((string) $player['name'] . ' (#' . (int) $player['id'] . ')') ?>"></option>
          <?php endforeach; ?>
        </datalist>

        <?php foreach ($matchTeams as $team): ?>
          <?php
            $hiddenTeamNumber = (int) $team['team_number'];
            $hiddenTeamGoals = $detailFormError !== ''
                ? (string) max(0, (int) ($postedTeamGoalsData[$hiddenTeamNumber] ?? 0))
                : (string) ((int) ($team['goals'] ?? 0));
          ?>
          <input type="hidden" name="team_goals[<?= $hiddenTeamNumber ?>]" value="<?= h($hiddenTeamGoals) ?>">
        <?php endforeach; ?>

        <details class="card finish-collapse finish-valuations" id="valoraciones" open>
          <summary>
            <span>Puntajes y premios</span>
            <small>Menu</small>
          </summary>
          <div class="finish-valuations-menu">
            <details class="finish-submenu finish-collapse finish-ratings-menu" open>
              <summary>
                <span>Puntajes</span>
                <small>Goles</small>
              </summary>
          <div
            data-react-root
            data-react-island="finish_valuation_controls"
            data-total="<?= h((string) count(array_filter($participants, static fn(array $player): bool => $player['team_number'] !== null))) ?>"
          ></div>
          <p class="small-muted" data-finish-valuations-empty hidden>No hay jugadores que coincidan con la busqueda.</p>
          <div class="finish-valuations-body">
            <?php foreach ($groupedTeams as $teamNumber => $lines): ?>
              <article class="finish-rating-team" data-finish-team="<?= (int) $teamNumber ?>">
                <h4><?= finish_render_team_label($teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber)) ?></h4>
                <div class="table-wrap">
                  <table class="finish-table" data-finish-swap-table>
                    <thead>
                      <tr>
                        <th>Jugador</th>
                        <th>Goles</th>
                        <th>Puntuacion</th>
                      </tr>
                    </thead>
                    <tbody>
                    <?php foreach (player_formation_lines() as $line): ?>
                      <?php foreach ($lines[$line] as $p): ?>
                        <?php
                          $playerId = (int) $p['id'];
                          $goalsValue = $detailFormError !== ''
                              ? (string) max(0, (int) ($postedGoalsData[$playerId] ?? 0))
                              : (string) ((int) ($p['goals'] ?? 0));
                          $ratingValue = $detailFormError !== ''
                              ? (string) ($postedRatingData[$playerId] ?? '')
                              : ($p['rating'] !== null && $p['rating'] !== '' ? (string) $p['rating'] : '');
                        ?>
                        <tr draggable="true" data-finish-player-row data-player-id="<?= $playerId ?>" data-team-number="<?= (int) $teamNumber ?>" data-position="<?= h((string) $line) ?>" data-search="<?= h(mb_strtolower((string) $p['name'] . ' ' . (string) $line . ' ' . ($teamLabels[(int) $teamNumber] ?? ('Equipo ' . (int) $teamNumber)), 'UTF-8')) ?>">
                          <td data-label="Jugador">
                            <strong><?= h((string) $p['name']) ?></strong>
                            <small data-finish-player-position-label><?= h((string) $line) ?></small>
                            <input type="hidden" name="player_team[<?= $playerId ?>]" value="<?= (int) $teamNumber ?>" data-finish-player-team-input>
                            <input type="hidden" name="player_position[<?= $playerId ?>]" value="<?= h((string) $line) ?>" data-finish-player-position-input>
                          </td>
                          <td data-label="Goles">
                            <input class="finish-number-input" type="number" min="0" step="1" name="goals[<?= $playerId ?>]" value="<?= h($goalsValue) ?>">
                          </td>
                          <td data-label="Puntuacion">
                            <input class="finish-number-input" type="number" min="1" max="10" step="0.5" name="rating[<?= $playerId ?>]" value="<?= h($ratingValue) ?>" placeholder="Opcional">
                          </td>
                        </tr>
                      <?php endforeach; ?>
                    <?php endforeach; ?>
                    </tbody>
                  </table>
                </div>
              </article>
            <?php endforeach; ?>
          </div>
            </details>

            <details class="finish-submenu finish-collapse finish-awards">
          <summary>
            <span>Premios</span>
            <small>Opcional</small>
          </summary>
          <p class="small-muted">Busca y elige un jugador convocado para cada premio.</p>
          <?= award_legend_details_html($awardDefinitions, $awardDescriptions) ?>
          <div class="award-grid">
            <?php foreach ($awardDefinitions as $code => $award): ?>
              <?php
                $savedAward = $savedAwards[$code] ?? null;
                $savedValue = $detailFormError !== ''
                    ? (string) ($postedAwardData[$code] ?? '')
                    : ($savedAward ? (string) $savedAward['name'] . ' (#' . (int) $savedAward['player_id'] . ')' : '');
              ?>
              <div class="award-field">
                <label for="award-<?= h($code) ?>">
                  <span class="award-icon" title="<?= h($award['label']) ?>"><?= h($award['icon']) ?></span>
                  <span><?= h($award['label']) ?></span>
                </label>
                <input id="award-<?= h($code) ?>" type="text" list="<?= $code === 'keeper' ? 'matchAwardGoalkeepers' : 'matchAwardPlayers' ?>" name="awards[<?= h($code) ?>]" value="<?= h($savedValue) ?>" placeholder="Buscar jugador">
              </div>
            <?php endforeach; ?>
          </div>
            </details>
          </div>
        </details>

        <div class="btn-row finish-valuations-actions">
          <button class="btn btn-primary" type="submit" data-confirm="Guardar valoraciones y premios de esta fecha?">GUARDAR VALORACIONES</button>
        </div>
      </form>
      <?php if ($detailFormError !== ''): ?>
        <div class="floating-form-alert" role="alert" aria-live="assertive" data-dismissible-alert>
          <button type="button" class="floating-form-alert-close" aria-label="Cerrar aviso" data-dismissible-alert-close>x</button>
          <span><?= h($detailFormError) ?></span>
        </div>
      <?php endif; ?>
      <?php elseif (!$scoreSaved): ?>
        <p class="flash flash-info">Guarda el resultado para habilitar la carga de puntajes y premios.</p>
      <?php endif; ?>
    <?php endif; ?>
  </section>
<?php endif; ?>

<script src="assets/finalizar-partido.js"></script>

<?php require __DIR__ . '/includes/footer.php'; ?>
