<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/awards.php';
require_once __DIR__ . '/repository.php';
require_once __DIR__ . '/schema.php';

function ensure_directivos_schema(): void
{
    ensure_control_schema();
    $pdo = db();
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS directive_members (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            site_user_id INT UNSIGNED NULL,
            name VARCHAR(120) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            password_needs_setup TINYINT(1) NOT NULL DEFAULT 0,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_directive_member_site_user (site_user_id),
            UNIQUE KEY uniq_directive_member_name (name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    try {
        $pdo->exec("ALTER TABLE directive_members ADD COLUMN site_user_id INT UNSIGNED NULL AFTER id");
    } catch (Throwable) {
        // Column already exists.
    }
    try {
        $pdo->exec("ALTER TABLE directive_members ADD UNIQUE KEY uniq_directive_member_site_user (site_user_id)");
    } catch (Throwable) {
        // Index already exists.
    }
    try {
        $pdo->exec("ALTER TABLE directive_members ADD COLUMN password_needs_setup TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash");
    } catch (Throwable) {
        // Column already exists.
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_director_rating_votes (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            voter_id INT UNSIGNED NOT NULL,
            player_id INT UNSIGNED NOT NULL,
            rating DECIMAL(3,1) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_director_rating_vote (match_id, voter_id, player_id),
            INDEX idx_director_rating_match_player (match_id, player_id),
            CONSTRAINT fk_director_rating_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_rating_voter FOREIGN KEY (voter_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_rating_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_director_award_votes (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            voter_id INT UNSIGNED NOT NULL,
            award_code VARCHAR(40) NOT NULL,
            player_id INT UNSIGNED NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_director_award_vote (match_id, voter_id, award_code),
            INDEX idx_director_award_match_code (match_id, award_code),
            CONSTRAINT fk_director_award_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_award_voter FOREIGN KEY (voter_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_award_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE RESTRICT ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_director_publications (
            match_id INT UNSIGNED PRIMARY KEY,
            published_at DATETIME NOT NULL,
            reason ENUM('all_voted', 'deadline', 'admin') NOT NULL,
            eligible_voters SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            submitted_voters SMALLINT UNSIGNED NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_director_publication_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    try {
        $pdo->exec("ALTER TABLE match_director_publications MODIFY reason ENUM('all_voted', 'deadline', 'admin') NOT NULL");
    } catch (Throwable) {
        // Older or non-MySQL local engines may not need this migration.
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS match_director_vote_invites (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            match_id INT UNSIGNED NOT NULL,
            player_id INT UNSIGNED NOT NULL,
            voter_member_id INT UNSIGNED NOT NULL,
            token VARCHAR(5) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_director_vote_invite_match_player (match_id, player_id),
            UNIQUE KEY uniq_director_vote_invite_token (token),
            INDEX idx_director_vote_invite_match (match_id),
            CONSTRAINT fk_director_vote_invite_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_vote_invite_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_vote_invite_voter FOREIGN KEY (voter_member_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS director_player_stat_votes (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            voter_id INT UNSIGNED NOT NULL,
            player_id INT UNSIGNED NOT NULL,
            attack TINYINT UNSIGNED NULL,
            defense_physical TINYINT UNSIGNED NULL,
            technique TINYINT UNSIGNED NULL,
            rhythm TINYINT UNSIGNED NULL,
            stamina TINYINT UNSIGNED NULL,
            teamwork TINYINT UNSIGNED NULL,
            mentality TINYINT UNSIGNED NULL,
            regularity TINYINT UNSIGNED NULL,
            goalkeeper_skill TINYINT UNSIGNED NULL,
            comments TEXT NULL,
            manually_modified TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_director_player_stat_vote (voter_id, player_id),
            INDEX idx_director_player_stat_player (player_id),
            CONSTRAINT fk_director_player_stat_voter FOREIGN KEY (voter_id) REFERENCES directive_members(id) ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT fk_director_player_stat_player FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE ON UPDATE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!schema_column_exists($pdo, 'director_player_stat_votes', 'manually_modified')) {
        $pdo->exec('ALTER TABLE director_player_stat_votes ADD COLUMN manually_modified TINYINT(1) NOT NULL DEFAULT 0 AFTER comments');
    }
    if (!schema_column_exists($pdo, 'director_player_stat_votes', 'stamina')) {
        $pdo->exec('ALTER TABLE director_player_stat_votes ADD COLUMN stamina TINYINT UNSIGNED NULL AFTER rhythm');
    }
    ensure_default_directive_site_users();
}

function default_directive_user_names(): array
{
    return ['Marcelo', 'Braian', 'Cesar', 'Marian', 'Guille', 'Pela', 'Rodri', 'Pablo'];
}

function ensure_default_directive_site_users(string $temporaryPassword = '1234'): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    ensure_auth_schema();
    $pdo = db();
    $selectUser = $pdo->prepare('SELECT * FROM site_users WHERE LOWER(username) = LOWER(:username) LIMIT 1');
    $insertUser = $pdo->prepare(
        'INSERT INTO site_users (username, password_hash, password_needs_reset, role, player_id, can_vote, active)
         VALUES (:username, :password_hash, 1, "directivo", NULL, 1, 1)'
    );
    $updateUser = $pdo->prepare(
        'UPDATE site_users
         SET role = "directivo",
             can_vote = 1,
             active = 1
         WHERE id = :id'
    );
    $selectMemberBySiteUser = $pdo->prepare('SELECT * FROM directive_members WHERE site_user_id = :site_user_id LIMIT 1');
    $selectMemberByName = $pdo->prepare(
        'SELECT * FROM directive_members
         WHERE LOWER(name) = LOWER(:name)
           AND name NOT LIKE "Invitado voto %"
         LIMIT 1'
    );
    $insertMember = $pdo->prepare(
        'INSERT INTO directive_members (site_user_id, name, password_hash, password_needs_setup, active)
         VALUES (:site_user_id, :name, :password_hash, 0, 1)'
    );
    $updateMember = $pdo->prepare(
        'UPDATE directive_members
         SET site_user_id = :site_user_id,
             name = :name,
             active = 1
         WHERE id = :id'
    );
    $detachMember = $pdo->prepare(
        'UPDATE directive_members
         SET site_user_id = NULL,
             active = 0
         WHERE id = :id'
    );
    $memberPasswordHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);

    foreach (default_directive_user_names() as $name) {
        $selectUser->execute(['username' => $name]);
        $user = $selectUser->fetch();
        if ($user) {
            $userId = (int) $user['id'];
            $updateUser->execute(['id' => $userId]);
        } else {
            $insertUser->execute([
                'username' => $name,
                'password_hash' => password_hash($temporaryPassword, PASSWORD_DEFAULT),
            ]);
            $userId = (int) $pdo->lastInsertId();
        }

        $selectMemberByName->execute(['name' => $name]);
        $memberByName = $selectMemberByName->fetch();
        $selectMemberBySiteUser->execute(['site_user_id' => $userId]);
        $memberBySiteUser = $selectMemberBySiteUser->fetch();
        $member = $memberByName ?: $memberBySiteUser;

        if ($member) {
            $updateMember->execute([
                'id' => (int) $member['id'],
                'site_user_id' => $userId,
                'name' => $name,
            ]);
            if ($memberByName && $memberBySiteUser && (int) $memberByName['id'] !== (int) $memberBySiteUser['id']) {
                $detachMember->execute(['id' => (int) $memberBySiteUser['id']]);
            }
        } else {
            $insertMember->execute([
                'site_user_id' => $userId,
                'name' => $name,
                'password_hash' => $memberPasswordHash,
            ]);
        }
    }
}

function director_player_stat_fields(): array
{
    return ['attack', 'defense_physical', 'technique', 'rhythm', 'stamina', 'teamwork', 'mentality', 'regularity', 'goalkeeper_skill'];
}

function director_player_stat_labels(): array
{
    return [
        'attack' => 'Ataque',
        'defense_physical' => 'Solidez',
        'technique' => 'Tecnica',
        'rhythm' => 'Velocidad',
        'stamina' => 'Resistencia',
        'teamwork' => 'Equipo',
        'mentality' => 'Mentalidad',
        'regularity' => 'Regularidad',
        'goalkeeper_skill' => 'Arquero',
    ];
}

function director_stat_0_99_from_internal(float|string|int|null $value): int
{
    $rating = normalize_player_stat($value);
    $anchors = [
        [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
        [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
        [5.2, 93], [5.3, 94], [6.0, 99],
    ];
    for ($index = 0; $index < count($anchors) - 1; $index++) {
        [$fromRating, $fromOverall] = $anchors[$index];
        [$toRating, $toOverall] = $anchors[$index + 1];
        if ($rating <= $toRating) {
            $ratio = ($rating - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }
    return 99;
}

function director_internal_stat_from_0_99(float|string|int|null $value): ?float
{
    if ($value === null || trim((string) $value) === '') {
        return null;
    }
    $overall = max(0.0, min(99.0, (float) $value));
    $anchors = [
        [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
        [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
        [5.2, 93], [5.3, 94], [6.0, 99],
    ];
    if ($overall <= 35) {
        return 1.0;
    }
    for ($index = 0; $index < count($anchors) - 1; $index++) {
        [$fromRating, $fromOverall] = $anchors[$index];
        [$toRating, $toOverall] = $anchors[$index + 1];
        if ($overall <= $toOverall) {
            $ratio = ($overall - $fromOverall) / ($toOverall - $fromOverall);
            return normalize_player_stat($fromRating + (($toRating - $fromRating) * $ratio));
        }
    }
    return 6.0;
}

function director_clamp_stat_0_99(float|string|int|null $value): ?int
{
    if ($value === null || trim((string) $value) === '') {
        return null;
    }
    return max(0, min(99, (int) round((float) $value)));
}

function director_member_stat_votes(int $voterId): array
{
    ensure_directivos_schema();
    $stmt = db()->prepare('SELECT * FROM director_player_stat_votes WHERE voter_id = :voter_id');
    $stmt->execute(['voter_id' => $voterId]);
    $votes = [];
    foreach ($stmt->fetchAll() as $row) {
        $votes[(int) $row['player_id']] = $row;
    }
    return $votes;
}

function director_player_stat_vote_progress(int $activePlayerCount): array
{
    ensure_directivos_schema();
    if ($activePlayerCount <= 0) {
        return [];
    }
    $stmt = db()->query(
        'SELECT dm.id, dm.name, COUNT(p.id) AS voted_players
         FROM directive_members dm
         LEFT JOIN director_player_stat_votes v ON v.voter_id = dm.id AND v.manually_modified = 1
         LEFT JOIN players p ON p.id = v.player_id AND p.active = 1
         WHERE dm.active = 1 AND dm.name NOT LIKE \'Invitado voto %\'
         GROUP BY dm.id, dm.name
         ORDER BY dm.name ASC'
    );
    $rows = [];
    foreach ($stmt->fetchAll() as $row) {
        $rows[] = [
            'id' => (int) $row['id'],
            'name' => (string) $row['name'],
            'voted_players' => (int) $row['voted_players'],
            'complete' => (int) $row['voted_players'] >= $activePlayerCount,
        ];
    }
    return $rows;
}

function director_recalculate_player_stats(array $playerIds = []): void
{
    ensure_directivos_schema();
    $fields = director_player_stat_fields();
    $fieldSql = implode(', ', array_map(static fn(string $field): string => "AVG(v.$field) AS $field", $fields));
    $params = [];
    $where = '';
    if ($playerIds) {
        $playerIds = array_values(array_unique(array_map('intval', $playerIds)));
        $where = ' AND v.player_id IN (' . implode(',', array_fill(0, count($playerIds), '?')) . ')';
        $params = $playerIds;
    }
    $stmt = db()->prepare(
        "SELECT v.player_id, $fieldSql
         FROM director_player_stat_votes v
         INNER JOIN players p ON p.id = v.player_id AND p.active = 1
         WHERE v.manually_modified = 1$where
         GROUP BY v.player_id"
    );
    $stmt->execute($params);
    $averages = [];
    foreach ($stmt->fetchAll() as $row) {
        $averages[(int) $row['player_id']] = $row;
    }
    if (!$playerIds) {
        $playerIds = array_keys($averages);
    }
    if (!$playerIds) {
        return;
    }
    $selectPlayers = db()->prepare('SELECT * FROM players WHERE id = :id AND active = 1 LIMIT 1');
    $update = db()->prepare(
        'UPDATE players
         SET pace = :pace, skill = :skill,
             technique = :technique, rhythm = :rhythm, stamina = :stamina, defense_physical = :defense_physical,
             attack = :attack, teamwork = :teamwork, mentality = :mentality, regularity = :regularity, goalkeeper_skill = :goalkeeper_skill
         WHERE id = :id'
    );
    foreach ($playerIds as $playerId) {
        $avg = $averages[(int) $playerId] ?? null;
        if (!$avg) {
            continue;
        }
        $selectPlayers->execute(['id' => (int) $playerId]);
        $player = $selectPlayers->fetch();
        if (!$player) {
            continue;
        }
        $next = $player;
        foreach ($fields as $field) {
            if ($avg[$field] !== null) {
                $next[$field] = director_internal_stat_from_0_99((int) round((float) $avg[$field]));
            }
        }
        $skill = player_overall_rating($next);
        $pace = player_pace_from_rhythm((float) player_effective_stat($next, 'rhythm'));
        $update->execute([
            'id' => (int) $playerId,
            'pace' => $pace,
            'skill' => $skill,
            'technique' => $next['technique'],
            'rhythm' => $next['rhythm'],
            'stamina' => $next['stamina'],
            'defense_physical' => $next['defense_physical'],
            'attack' => $next['attack'],
            'teamwork' => $next['teamwork'],
            'mentality' => $next['mentality'],
            'regularity' => $next['regularity'],
            'goalkeeper_skill' => $next['goalkeeper_skill'],
        ]);
    }
}

function director_save_player_stat_votes(int $voterId, array $input): int
{
    ensure_directivos_schema();
    if ($voterId <= 0) {
        throw new RuntimeException('Directivo invalido.');
    }
    $fields = director_player_stat_fields();
    $players = repo_all_players(true);
    $playersById = [];
    foreach ($players as $player) {
        $playersById[(int) $player['id']] = $player;
    }
    $playerIds = array_map(static fn(array $player): int => (int) $player['id'], $players);
    $allowed = array_flip($playerIds);
    $existingVotes = director_member_stat_votes($voterId);
    $pdo = db();
    $pdo->beginTransaction();
    $saved = 0;
    $savedPlayerIds = [];
    try {
        $stmt = $pdo->prepare(
            'INSERT INTO director_player_stat_votes
               (voter_id, player_id, attack, defense_physical, technique, rhythm, stamina, teamwork, mentality, regularity, goalkeeper_skill, comments, manually_modified)
             VALUES
               (:voter_id, :player_id, :attack, :defense_physical, :technique, :rhythm, :stamina, :teamwork, :mentality, :regularity, :goalkeeper_skill, :comments, 1)
             ON DUPLICATE KEY UPDATE
               attack = VALUES(attack), defense_physical = VALUES(defense_physical), technique = VALUES(technique),
               rhythm = VALUES(rhythm), stamina = VALUES(stamina), teamwork = VALUES(teamwork), mentality = VALUES(mentality),
               regularity = VALUES(regularity), goalkeeper_skill = VALUES(goalkeeper_skill),
               comments = VALUES(comments), manually_modified = 1, updated_at = CURRENT_TIMESTAMP'
        );
        foreach ($input as $playerId => $row) {
            $pid = (int) $playerId;
            if (!isset($allowed[$pid]) || !is_array($row)) {
                continue;
            }
            $player = $playersById[$pid] ?? null;
            if (!$player) {
                continue;
            }
            $existingVote = $existingVotes[$pid] ?? null;
            $existingManualVote = $existingVote && (int) ($existingVote['manually_modified'] ?? 0) === 1;
            $params = ['voter_id' => $voterId, 'player_id' => $pid, 'comments' => trim((string) ($row['comments'] ?? ''))];
            $hasValue = $params['comments'] !== '';
            $hasChanges = $existingManualVote
                ? $params['comments'] !== trim((string) ($existingVote['comments'] ?? ''))
                : $params['comments'] !== '';
            foreach ($fields as $field) {
                $params[$field] = director_clamp_stat_0_99($row[$field] ?? null);
                if ($params[$field] !== null) {
                    $hasValue = true;
                }
                if ($existingManualVote) {
                    $baseline = $existingVote[$field] !== null && $existingVote[$field] !== ''
                        ? (int) $existingVote[$field]
                        : null;
                } else {
                    $baseline = director_stat_0_99_from_internal(player_effective_stat($player, $field));
                }
                if ($params[$field] !== $baseline) {
                    $hasChanges = true;
                }
            }
            if (!$hasValue || !$hasChanges) {
                continue;
            }
            $stmt->execute($params);
            $saved++;
            $savedPlayerIds[] = $pid;
        }
        if ($savedPlayerIds) {
            director_recalculate_player_stats($savedPlayerIds);
        }
        $pdo->commit();
        return $saved;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function directive_members(bool $onlyActive = false): array
{
    ensure_directivos_schema();
    $sql = 'SELECT id, name, password_needs_setup, active, created_at, updated_at FROM directive_members';
    $conditions = ["name NOT LIKE 'Invitado voto %'"];
    if ($onlyActive) {
        $conditions[] = 'active = 1';
    }
    $sql .= ' WHERE ' . implode(' AND ', $conditions);
    $sql .= ' ORDER BY active DESC, name ASC';
    return db()->query($sql)->fetchAll();
}

function directive_member_by_name(string $name): ?array
{
    ensure_directivos_schema();
    $stmt = db()->prepare('SELECT * FROM directive_members WHERE name = :name LIMIT 1');
    $stmt->execute(['name' => trim($name)]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function directive_member_by_id(int $id): ?array
{
    ensure_directivos_schema();
    $stmt = db()->prepare('SELECT * FROM directive_members WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function directive_member_for_site_user(int $siteUserId, string $username, ?string $playerName = null): array
{
    ensure_directivos_schema();
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM directive_members WHERE site_user_id = :site_user_id LIMIT 1');
    $stmt->execute(['site_user_id' => $siteUserId]);
    $existing = $stmt->fetch();
    if ($existing) {
        if ((int) $existing['active'] !== 1) {
            $update = $pdo->prepare('UPDATE directive_members SET active = 1 WHERE id = :id');
            $update->execute(['id' => (int) $existing['id']]);
            $existing['active'] = 1;
        }
        return $existing;
    }

    $baseName = trim($playerName ?: $username);
    $name = substr('Usuario ' . ($baseName !== '' ? $baseName : (string) $siteUserId), 0, 120);
    $passwordHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $insert = $pdo->prepare(
        'INSERT INTO directive_members (site_user_id, name, password_hash, password_needs_setup, active)
         VALUES (:site_user_id, :name, :password_hash, 0, 1)'
    );
    for ($attempt = 0; $attempt < 5; $attempt++) {
        try {
            $insert->execute([
                'site_user_id' => $siteUserId,
                'name' => $attempt === 0 ? $name : substr($name . ' #' . ($attempt + 1), 0, 120),
                'password_hash' => $passwordHash,
            ]);
            return directive_member_by_id((int) $pdo->lastInsertId()) ?: [];
        } catch (PDOException $e) {
            if (!str_contains($e->getMessage(), 'uniq_directive_member_name')) {
                throw $e;
            }
        }
    }

    throw new RuntimeException('No se pudo crear el permiso de votacion directiva.');
}

function directive_voting_deadline(array $match): ?int
{
    if (!directive_match_ready_for_voting($match)) {
        return null;
    }
    $finalizedAt = trim((string) ($match['finalized_at'] ?? ''));
    $timestamp = strtotime($finalizedAt);
    return $timestamp === false ? null : $timestamp + (24 * 60 * 60);
}

function directive_match_ready_for_voting(array $match): bool
{
    if ((string) ($match['status'] ?? '') !== 'finalizado') {
        return false;
    }
    $finalizedAt = trim((string) ($match['finalized_at'] ?? ''));
    return $finalizedAt !== '' && strtotime($finalizedAt) !== false;
}

function directive_voting_is_open(array $match): bool
{
    $deadline = directive_voting_deadline($match);
    return $deadline !== null && time() < $deadline && !directive_match_is_published((int) $match['id']);
}

function directive_match_is_published(int $matchId): bool
{
    ensure_directivos_schema();
    $stmt = db()->prepare('SELECT COUNT(*) FROM match_director_publications WHERE match_id = :mid');
    $stmt->execute(['mid' => $matchId]);
    return (int) $stmt->fetchColumn() > 0;
}

function directive_member_completed_match(int $matchId, int $voterId, int $participantCount): bool
{
    if ($voterId <= 0 || $participantCount <= 0) {
        return false;
    }
    $stmt = db()->prepare(
        'SELECT COUNT(*) FROM match_director_rating_votes WHERE match_id = :mid AND voter_id = :voter_id'
    );
    $stmt->execute(['mid' => $matchId, 'voter_id' => $voterId]);
    return (int) $stmt->fetchColumn() >= $participantCount;
}

function directive_member_rating_votes(int $matchId, int $voterId): array
{
    ensure_directivos_schema();
    $stmt = db()->prepare(
        'SELECT player_id, rating
         FROM match_director_rating_votes
         WHERE match_id = :mid AND voter_id = :voter_id'
    );
    $stmt->execute(['mid' => $matchId, 'voter_id' => $voterId]);
    $votes = [];
    foreach ($stmt->fetchAll() as $row) {
        $votes[(int) $row['player_id']] = (string) $row['rating'];
    }
    return $votes;
}

function directive_member_award_votes(int $matchId, int $voterId): array
{
    ensure_directivos_schema();
    $stmt = db()->prepare(
        'SELECT av.award_code, av.player_id, p.name
         FROM match_director_award_votes av
         INNER JOIN players p ON p.id = av.player_id
         WHERE av.match_id = :mid AND av.voter_id = :voter_id'
    );
    $stmt->execute(['mid' => $matchId, 'voter_id' => $voterId]);
    $votes = [];
    foreach ($stmt->fetchAll() as $row) {
        $votes[(string) $row['award_code']] = $row;
    }
    return $votes;
}

function directive_publication(int $matchId): ?array
{
    ensure_directivos_schema();
    $stmt = db()->prepare('SELECT * FROM match_director_publications WHERE match_id = :mid LIMIT 1');
    $stmt->execute(['mid' => $matchId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function directive_vote_status(int $matchId, int $participantCount): array
{
    ensure_directivos_schema();
    $eligible = directive_members(true);
    $eligibleIds = array_map(static fn(array $row): int => (int) $row['id'], $eligible);
    if (!$eligibleIds || $participantCount <= 0) {
        return ['eligible' => count($eligibleIds), 'submitted' => 0, 'eligible_ids' => $eligibleIds];
    }
    $in = implode(',', array_fill(0, count($eligibleIds), '?'));
    $stmt = db()->prepare(
        "SELECT voter_id, COUNT(*) AS rating_count
         FROM match_director_rating_votes
         WHERE match_id = ? AND voter_id IN ($in)
         GROUP BY voter_id"
    );
    $stmt->execute(array_merge([$matchId], $eligibleIds));
    $submitted = 0;
    foreach ($stmt->fetchAll() as $row) {
        if ((int) $row['rating_count'] >= $participantCount) {
            $submitted++;
        }
    }
    return ['eligible' => count($eligibleIds), 'submitted' => $submitted, 'eligible_ids' => $eligibleIds];
}

function directive_complete_vote_count(int $matchId, int $participantCount): int
{
    ensure_directivos_schema();
    if ($participantCount <= 0) {
        return 0;
    }
    $stmt = db()->prepare(
        'SELECT voter_id, COUNT(*) AS rating_count
         FROM match_director_rating_votes
         WHERE match_id = :mid
         GROUP BY voter_id'
    );
    $stmt->execute(['mid' => $matchId]);
    $submitted = 0;
    foreach ($stmt->fetchAll() as $row) {
        if ((int) $row['rating_count'] >= $participantCount) {
            $submitted++;
        }
    }
    return $submitted;
}

function directive_save_vote(int $matchId, int $voterId, array $ratings, array $awards, array $allowedPlayerIds): void
{
    ensure_directivos_schema();
    $allowed = array_flip(array_map('intval', $allowedPlayerIds));
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $ratingStmt = $pdo->prepare(
            'INSERT INTO match_director_rating_votes (match_id, voter_id, player_id, rating)
             VALUES (:mid, :voter_id, :pid, :rating)
             ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP'
        );
        foreach ($allowedPlayerIds as $playerId) {
            $pid = (int) $playerId;
            if (!isset($ratings[$pid]) || trim((string) $ratings[$pid]) === '') {
                throw new RuntimeException('Completa todos los puntajes antes de enviar tu voto.');
            }
            $rating = max(1.0, min(10.0, round(((float) $ratings[$pid]) * 2) / 2));
            $ratingStmt->execute(['mid' => $matchId, 'voter_id' => $voterId, 'pid' => $pid, 'rating' => $rating]);
        }

        $definitions = award_definitions();
        $deleteAward = $pdo->prepare('DELETE FROM match_director_award_votes WHERE match_id = :mid AND voter_id = :voter_id AND award_code = :code');
        $awardStmt = $pdo->prepare(
            'INSERT INTO match_director_award_votes (match_id, voter_id, award_code, player_id)
             VALUES (:mid, :voter_id, :code, :pid)
             ON DUPLICATE KEY UPDATE player_id = VALUES(player_id), updated_at = CURRENT_TIMESTAMP'
        );
        foreach ($definitions as $code => $_definition) {
            $rawAward = trim((string) ($awards[$code] ?? ''));
            if ($rawAward === '') {
                $deleteAward->execute(['mid' => $matchId, 'voter_id' => $voterId, 'code' => $code]);
                continue;
            }
            if (preg_match('/#(\d+)/', $rawAward, $matchAward) !== 1) {
                throw new RuntimeException('Selecciona los premios desde la lista de jugadores de la fecha.');
            }
            $pid = (int) $matchAward[1];
            if (!isset($allowed[$pid])) {
                throw new RuntimeException('Premio invalido: el jugador no participo de la fecha.');
            }
            $awardStmt->execute(['mid' => $matchId, 'voter_id' => $voterId, 'code' => $code, 'pid' => $pid]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function directive_publish_if_ready(array $match, array $participants): bool
{
    ensure_directivos_schema();
    $matchId = (int) ($match['id'] ?? 0);
    if ($matchId <= 0 || directive_match_is_published($matchId)) {
        return false;
    }
    if (!directive_match_ready_for_voting($match)) {
        return false;
    }
    $participantIds = array_values(array_map(static fn(array $p): int => (int) $p['id'], array_filter($participants, static fn(array $p): bool => $p['team_number'] !== null)));
    $participantCount = count($participantIds);
    if ($participantCount === 0) {
        return false;
    }
    $status = directive_vote_status($matchId, $participantCount);
    $deadline = directive_voting_deadline($match);
    $allVoted = (int) $status['eligible'] > 0 && (int) $status['submitted'] >= (int) $status['eligible'];
    $deadlineExpired = $deadline !== null && time() >= $deadline && (int) $status['submitted'] > 0;
    if (!$allVoted && !$deadlineExpired) {
        return false;
    }

    return directive_publish_match_results($match, $participants, $allVoted ? 'all_voted' : 'deadline', false);
}

function directive_generate_vote_invite_token(): string
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM match_director_vote_invites WHERE token = :token');
    for ($attempt = 0; $attempt < 40; $attempt++) {
        $token = (string) random_int(10000, 99999);
        $stmt->execute(['token' => $token]);
        if ((int) $stmt->fetchColumn() === 0) {
            return $token;
        }
    }
    throw new RuntimeException('No se pudo generar un token disponible.');
}

function directive_create_vote_invite(int $matchId, int $playerId): array
{
    ensure_directivos_schema();
    $match = repo_match_by_id($matchId);
    if (!$match || !directive_match_ready_for_voting($match)) {
        throw new RuntimeException('Fecha invalida para invitar a votar.');
    }
    if (!directive_voting_is_open($match)) {
        throw new RuntimeException('La votacion de esta fecha no esta abierta.');
    }
    $player = repo_player_by_id($playerId);
    if (!$player || (int) ($player['active'] ?? 1) !== 1) {
        throw new RuntimeException('Jugador invalido para invitar.');
    }

    $pdo = db();
    $existing = directive_vote_invite_for_player($matchId, $playerId);
    $token = directive_generate_vote_invite_token();
    if ($existing) {
        $stmt = $pdo->prepare('UPDATE match_director_vote_invites SET token = :token WHERE id = :id');
        $stmt->execute(['id' => (int) $existing['id'], 'token' => $token]);
        return directive_vote_invite_by_id((int) $existing['id']) ?: array_merge($existing, ['token' => $token]);
    }

    $name = 'Invitado voto ' . $matchId . '-' . $playerId . ' ' . trim((string) ($player['name'] ?? ''));
    $memberStmt = $pdo->prepare(
        'INSERT INTO directive_members (name, password_hash, password_needs_setup, active)
         VALUES (:name, :password_hash, 0, 0)'
    );
    $memberStmt->execute([
        'name' => substr($name, 0, 120),
        'password_hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
    ]);
    $voterMemberId = (int) $pdo->lastInsertId();
    $inviteStmt = $pdo->prepare(
        'INSERT INTO match_director_vote_invites (match_id, player_id, voter_member_id, token)
         VALUES (:mid, :pid, :voter_member_id, :token)'
    );
    $inviteStmt->execute([
        'mid' => $matchId,
        'pid' => $playerId,
        'voter_member_id' => $voterMemberId,
        'token' => $token,
    ]);
    return directive_vote_invite_by_id((int) $pdo->lastInsertId()) ?: [];
}

function directive_vote_invite_by_id(int $id): ?array
{
    ensure_directivos_schema();
    $stmt = db()->prepare(
        'SELECT i.*, p.name AS player_name, m.title AS match_title, m.match_date, m.status AS match_status
         FROM match_director_vote_invites i
         INNER JOIN players p ON p.id = i.player_id
         INNER JOIN matches m ON m.id = i.match_id
         WHERE i.id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function directive_vote_invite_for_player(int $matchId, int $playerId): ?array
{
    ensure_directivos_schema();
    $stmt = db()->prepare('SELECT * FROM match_director_vote_invites WHERE match_id = :mid AND player_id = :pid LIMIT 1');
    $stmt->execute(['mid' => $matchId, 'pid' => $playerId]);
    $row = $stmt->fetch();
    return $row ? directive_vote_invite_by_id((int) $row['id']) : null;
}

function directive_vote_invite_by_token(string $token): ?array
{
    ensure_directivos_schema();
    if (!preg_match('/^\d{5}$/', $token)) {
        return null;
    }
    $stmt = db()->prepare(
        'SELECT i.id
         FROM match_director_vote_invites i
         INNER JOIN matches m ON m.id = i.match_id
         WHERE i.token = :token AND m.status = \'finalizado\'
         LIMIT 1'
    );
    $stmt->execute(['token' => $token]);
    $id = (int) ($stmt->fetchColumn() ?: 0);
    return $id > 0 ? directive_vote_invite_by_id($id) : null;
}

function directive_vote_invites_for_match(int $matchId, int $participantCount = 0): array
{
    ensure_directivos_schema();
    $stmt = db()->prepare(
        'SELECT i.*, p.name AS player_name
         FROM match_director_vote_invites i
         INNER JOIN players p ON p.id = i.player_id
         WHERE i.match_id = :mid
         ORDER BY p.name ASC'
    );
    $stmt->execute(['mid' => $matchId]);
    $rows = $stmt->fetchAll();
    foreach ($rows as &$row) {
        $row['vote_complete'] = $participantCount > 0
            ? directive_member_completed_match($matchId, (int) $row['voter_member_id'], $participantCount)
            : false;
    }
    unset($row);
    return $rows;
}

function directive_publish_match_results(array $match, array $participants, string $reason = 'admin', bool $requireSubmittedVote = true): bool
{
    ensure_directivos_schema();
    $matchId = (int) ($match['id'] ?? 0);
    if ($matchId <= 0 || directive_match_is_published($matchId)) {
        return false;
    }
    if (!directive_match_ready_for_voting($match)) {
        return false;
    }
    $participantIds = array_values(array_map(static fn(array $p): int => (int) $p['id'], array_filter($participants, static fn(array $p): bool => $p['team_number'] !== null)));
    $participantCount = count($participantIds);
    if ($participantCount === 0) {
        return false;
    }
    $status = directive_vote_status($matchId, $participantCount);
    if ($requireSubmittedVote && directive_complete_vote_count($matchId, $participantCount) <= 0) {
        throw new RuntimeException('Todavia no hay votos completos para publicar resultados.');
    }
    $reason = in_array($reason, ['all_voted', 'deadline', 'admin'], true) ? $reason : 'admin';

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $inPlayers = implode(',', array_fill(0, count($participantIds), '?'));
        $ratingRows = [];
        $stmt = $pdo->prepare(
            "SELECT player_id, ROUND(AVG(rating), 1) AS rating
             FROM match_director_rating_votes
             WHERE match_id = ? AND player_id IN ($inPlayers)
             GROUP BY player_id"
        );
        $stmt->execute(array_merge([$matchId], $participantIds));
        foreach ($stmt->fetchAll() as $row) {
            $ratingRows[(int) $row['player_id']] = (float) $row['rating'];
        }
        $updateRating = $pdo->prepare('UPDATE match_players SET rating = :rating WHERE match_id = :mid AND player_id = :pid');
        foreach ($ratingRows as $playerId => $rating) {
            $updateRating->execute(['mid' => $matchId, 'pid' => $playerId, 'rating' => $rating]);
        }

        $allowedAwardPlayerIds = $participantIds;
        $finalAwards = directive_resolve_awards($matchId, $allowedAwardPlayerIds);
        repo_save_match_awards($matchId, $finalAwards, $allowedAwardPlayerIds);

        $insertPublication = $pdo->prepare(
            'INSERT INTO match_director_publications (match_id, published_at, reason, eligible_voters, submitted_voters)
             VALUES (:mid, NOW(), :reason, :eligible, :submitted)'
        );
        $insertPublication->execute([
            'mid' => $matchId,
            'reason' => $reason,
            'eligible' => (int) $status['eligible'],
            'submitted' => (int) $status['submitted'],
        ]);
        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function directive_publish_due_results(): int
{
    ensure_directivos_schema();
    $published = 0;
    foreach (repo_matches("m.status = 'finalizado'") as $match) {
        if (directive_publish_if_ready($match, repo_match_participants((int) $match['id']))) {
            $published++;
        }
    }
    return $published;
}

function directive_resolve_awards(int $matchId, array $allowedPlayerIds): array
{
    $allowed = array_flip(array_map('intval', $allowedPlayerIds));
    $definitions = award_definitions();
    $finalAwards = [];
    $ratingAverages = [];
    $ratingStmt = db()->prepare(
        'SELECT player_id, AVG(rating) AS avg_rating
         FROM match_director_rating_votes
         WHERE match_id = :mid
         GROUP BY player_id'
    );
    $ratingStmt->execute(['mid' => $matchId]);
    foreach ($ratingStmt->fetchAll() as $row) {
        $ratingAverages[(int) $row['player_id']] = (float) $row['avg_rating'];
    }
    $goals = [];
    $goalStmt = db()->prepare('SELECT player_id, goals FROM match_players WHERE match_id = :mid');
    $goalStmt->execute(['mid' => $matchId]);
    foreach ($goalStmt->fetchAll() as $row) {
        $goals[(int) $row['player_id']] = (int) $row['goals'];
    }
    $names = [];
    if ($allowedPlayerIds) {
        $in = implode(',', array_fill(0, count($allowedPlayerIds), '?'));
        $nameStmt = db()->prepare("SELECT id, name FROM players WHERE id IN ($in)");
        $nameStmt->execute(array_values(array_map('intval', $allowedPlayerIds)));
        foreach ($nameStmt->fetchAll() as $row) {
            $names[(int) $row['id']] = (string) $row['name'];
        }
    }
    foreach ($definitions as $code => $_definition) {
        $stmt = db()->prepare(
            'SELECT player_id, COUNT(*) AS votes
             FROM match_director_award_votes
             WHERE match_id = :mid AND award_code = :code
             GROUP BY player_id'
        );
        $stmt->execute(['mid' => $matchId, 'code' => $code]);
        $rows = array_values(array_filter($stmt->fetchAll(), static fn(array $row): bool => isset($allowed[(int) $row['player_id']])));
        if (!$rows) {
            $finalAwards[$code] = 0;
            continue;
        }
        usort($rows, static function (array $a, array $b) use ($ratingAverages, $goals, $names): int {
            $aId = (int) $a['player_id'];
            $bId = (int) $b['player_id'];
            return ((int) $b['votes'] <=> (int) $a['votes'])
                ?: (($ratingAverages[$bId] ?? 0.0) <=> ($ratingAverages[$aId] ?? 0.0))
                ?: (($goals[$bId] ?? 0) <=> ($goals[$aId] ?? 0))
                ?: strcmp($names[$aId] ?? '', $names[$bId] ?? '');
        });
        $finalAwards[$code] = (int) $rows[0]['player_id'];
    }
    return $finalAwards;
}
