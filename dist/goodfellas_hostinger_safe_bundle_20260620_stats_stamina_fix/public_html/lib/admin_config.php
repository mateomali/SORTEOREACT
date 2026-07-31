<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function ensure_admin_config_schema(): void
{
    $pdo = db();
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(80) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $settingValueType = schema_column_type($pdo, 'app_settings', 'setting_value');
    if ($settingValueType !== '' && str_starts_with(strtolower($settingValueType), 'varchar')) {
        $pdo->exec('ALTER TABLE app_settings MODIFY setting_value TEXT NOT NULL');
    }
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS rental_courts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            court_key VARCHAR(40) NOT NULL,
            place VARCHAR(120) NOT NULL,
            weekday TINYINT UNSIGNED NOT NULL,
            time_value TIME NOT NULL,
            total_players TINYINT UNSIGNED NOT NULL,
            active TINYINT(1) NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_rental_court_key (court_key),
            INDEX idx_rental_court_active (active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    if (!schema_column_exists($pdo, 'matches', 'rental_court_id')) {
        $pdo->exec('ALTER TABLE matches ADD COLUMN rental_court_id INT UNSIGNED NULL AFTER title');
    }
    admin_config_seed_defaults();
}

function admin_config_default_position_weights_json(): string
{
    return json_encode(player_position_stat_weight_defaults(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
}

function admin_config_seed_defaults(): void
{
    $defaults = [
        'allow_redraw_default' => '1',
        'redraw_limit_default' => '3',
        'multi_draw_count_default' => '3',
        'multi_draw_lock_minutes_default' => '60',
        'position_stat_weights' => admin_config_default_position_weights_json(),
    ];
    foreach ($defaults as $key => $value) {
        admin_config_insert_missing($key, $value);
    }

    $pdo = db();
    $stmt = $pdo->query('SELECT COUNT(*) FROM rental_courts');
    if ((int) $stmt->fetchColumn() > 0) {
        return;
    }
    $insert = $pdo->prepare(
        'INSERT INTO rental_courts (court_key, place, weekday, time_value, total_players)
         VALUES (:court_key, :place, :weekday, :time_value, :total_players)'
    );
    $insert->execute(['court_key' => 'cancha1', 'place' => 'kicker', 'weekday' => 1, 'time_value' => '21:00:00', 'total_players' => 18]);
    $insert->execute(['court_key' => 'cancha2', 'place' => 'kicker', 'weekday' => 5, 'time_value' => '22:00:00', 'total_players' => 12]);
}

function admin_config_insert_missing(string $key, string $value): void
{
    $stmt = db()->prepare(
        'INSERT IGNORE INTO app_settings (setting_key, setting_value)
         VALUES (:setting_key, :setting_value)'
    );
    $stmt->execute(['setting_key' => $key, 'setting_value' => $value]);
}

function admin_config_set_default(string $key, string $value): void
{
    $stmt = db()->prepare(
        'INSERT INTO app_settings (setting_key, setting_value)
         VALUES (:setting_key, :setting_value)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
    );
    $stmt->execute(['setting_key' => $key, 'setting_value' => $value]);
}

function admin_config_settings(): array
{
    ensure_admin_config_schema();
    $settings = [
        'allow_redraw_default' => '1',
        'redraw_limit_default' => '3',
        'multi_draw_count_default' => '3',
        'multi_draw_lock_minutes_default' => '60',
        'position_stat_weights' => admin_config_default_position_weights_json(),
    ];
    $stmt = db()->query('SELECT setting_key, setting_value FROM app_settings');
    foreach ($stmt->fetchAll() as $row) {
        $settings[(string) $row['setting_key']] = (string) $row['setting_value'];
    }
    return $settings;
}

function admin_config_position_weight_labels(): array
{
    return [
        'goalkeeper_skill' => 'Arquero',
        'defense_physical' => 'Solidez',
        'rhythm' => 'Velocidad',
        'stamina' => 'Resistencia',
        'technique' => 'Tecnica',
        'teamwork' => 'Equipo',
        'mentality' => 'Mentalidad',
        'attack' => 'Ataque',
    ];
}

function admin_config_position_weights(array $settings): array
{
    $decoded = json_decode((string) ($settings['position_stat_weights'] ?? ''), true);
    return player_normalize_position_stat_weights(is_array($decoded) ? $decoded : player_position_stat_weight_defaults());
}

function admin_config_save_settings(array $input): void
{
    ensure_admin_config_schema();
    admin_config_set_default('allow_redraw_default', isset($input['allow_redraw_default']) ? '1' : '0');
    admin_config_set_default('redraw_limit_default', (string) max(0, min(20, (int) ($input['redraw_limit_default'] ?? 3))));
    admin_config_set_default('multi_draw_count_default', (string) max(1, min(10, (int) ($input['multi_draw_count_default'] ?? 3))));
    admin_config_set_default('multi_draw_lock_minutes_default', (string) max(0, min(1440, (int) ($input['multi_draw_lock_minutes_default'] ?? 60))));
    $weightsInput = is_array($input['position_weights'] ?? null) ? $input['position_weights'] : [];
    $normalizedWeights = player_normalize_position_stat_weights($weightsInput);
    admin_config_set_default('position_stat_weights', json_encode($normalizedWeights, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}');
}

function admin_config_reset_position_weights(): void
{
    ensure_admin_config_schema();
    admin_config_set_default('position_stat_weights', admin_config_default_position_weights_json());
}

function rental_courts(bool $activeOnly = false): array
{
    ensure_admin_config_schema();
    $sql = 'SELECT * FROM rental_courts' . ($activeOnly ? ' WHERE active = 1' : '') . ' ORDER BY active DESC, court_key ASC';
    return db()->query($sql)->fetchAll();
}

function rental_court_by_id(int $id): ?array
{
    ensure_admin_config_schema();
    $stmt = db()->prepare('SELECT * FROM rental_courts WHERE id = :id LIMIT 1');
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function rental_court_save(array $input): void
{
    ensure_admin_config_schema();
    $id = max(0, (int) ($input['id'] ?? 0));
    $key = strtolower(trim((string) ($input['court_key'] ?? '')));
    $place = trim((string) ($input['place'] ?? ''));
    $weekday = max(1, min(7, (int) ($input['weekday'] ?? 1)));
    $time = trim((string) ($input['time_value'] ?? '21:00'));
    $totalPlayers = max(2, min(40, (int) ($input['total_players'] ?? 18)));
    $active = isset($input['active']) ? 1 : 0;

    if ($key === '' || $place === '') {
        throw new RuntimeException('Completa id y lugar de la cancha.');
    }
    if (preg_match('/^[a-z0-9_-]{3,40}$/', $key) !== 1) {
        throw new RuntimeException('El id de cancha solo puede usar letras, numeros, guion y guion bajo.');
    }
    if (preg_match('/^\d{2}:\d{2}$/', $time) !== 1) {
        throw new RuntimeException('El horario debe tener formato HH:MM.');
    }

    if ($id > 0) {
        $stmt = db()->prepare(
            'UPDATE rental_courts
             SET court_key = :court_key, place = :place, weekday = :weekday, time_value = :time_value, total_players = :total_players, active = :active
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $id,
            'court_key' => $key,
            'place' => $place,
            'weekday' => $weekday,
            'time_value' => $time . ':00',
            'total_players' => $totalPlayers,
            'active' => $active,
        ]);
        return;
    }

    $stmt = db()->prepare(
        'INSERT INTO rental_courts (court_key, place, weekday, time_value, total_players, active)
         VALUES (:court_key, :place, :weekday, :time_value, :total_players, :active)'
    );
    $stmt->execute([
        'court_key' => $key,
        'place' => $place,
        'weekday' => $weekday,
        'time_value' => $time . ':00',
        'total_players' => $totalPlayers,
        'active' => $active,
    ]);
}

function rental_court_next_datetime(array $court, ?DateTimeImmutable $from = null): DateTimeImmutable
{
    $from ??= new DateTimeImmutable('now');
    $targetWeekday = max(1, min(7, (int) ($court['weekday'] ?? 1)));
    $time = substr((string) ($court['time_value'] ?? '21:00:00'), 0, 5);
    $candidate = DateTimeImmutable::createFromFormat('Y-m-d H:i', $from->format('Y-m-d') . ' ' . $time) ?: $from;
    $currentWeekday = (int) $candidate->format('N');
    $days = ($targetWeekday - $currentWeekday + 7) % 7;
    if ($days === 0 && $candidate <= $from) {
        $days = 7;
    }
    return $candidate->modify('+' . $days . ' days');
}

function rental_weekday_label(int $weekday): string
{
    return [1 => 'lunes', 2 => 'martes', 3 => 'miercoles', 4 => 'jueves', 5 => 'viernes', 6 => 'sabado', 7 => 'domingo'][$weekday] ?? 'lunes';
}
