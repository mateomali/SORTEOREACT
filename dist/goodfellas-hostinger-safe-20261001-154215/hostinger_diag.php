<?php
declare(strict_types=1);

header('Content-Type: text/plain; charset=utf-8');

if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool
    {
        return $needle === '' || strpos($haystack, $needle) !== false;
    }
}

if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
    }
}

if (!function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool
    {
        if ($needle === '') {
            return true;
        }
        return substr($haystack, -strlen($needle)) === $needle;
    }
}

echo "GOODFELLAS HOSTINGER DIAGNOSTICO\n";
echo "================================\n\n";
echo "PHP_VERSION: " . PHP_VERSION . "\n";
echo "SAPI: " . PHP_SAPI . "\n";
echo "DOCUMENT_ROOT: " . (string) ($_SERVER['DOCUMENT_ROOT'] ?? '') . "\n";
echo "SCRIPT: " . __FILE__ . "\n\n";

echo "Extensiones:\n";
echo "- PDO: " . (extension_loaded('pdo') ? 'OK' : 'FALTA') . "\n";
echo "- pdo_mysql: " . (extension_loaded('pdo_mysql') ? 'OK' : 'FALTA') . "\n";
echo "- mbstring: " . (extension_loaded('mbstring') ? 'OK' : 'FALTA') . "\n\n";

try {
    require_once __DIR__ . '/config.php';

    echo "Config:\n";
    echo "- DB_HOST: " . DB_HOST . "\n";
    echo "- DB_NAME: " . DB_NAME . "\n";
    echo "- DB_USER: " . (DB_USER !== '' ? DB_USER : '[VACIO]') . "\n";
    echo "- DB_PASS: " . (DB_PASS !== '' ? '[CONFIGURADO]' : '[VACIO]') . "\n";
    echo "- APP_PUBLIC_URL: " . APP_PUBLIC_URL . "\n\n";

    if (version_compare(PHP_VERSION, '8.0.0', '<')) {
        echo "ERROR: El sitio requiere PHP 8.0 o superior. Cambia la version PHP en Hostinger.\n";
    }

    if (DB_USER === '' || DB_PASS === '') {
        echo "ERROR: DB_USER o DB_PASS estan vacios. Configura credenciales MySQL reales de Hostinger.\n";
    }

    echo "Probando conexion PDO...\n";
    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    echo "Conexion DB: OK\n\n";

    $tables = ['players', 'matches', 'match_players', 'match_teams', 'match_awards', 'captain_drafts', 'captain_picks'];
    echo "Tablas:\n";
    foreach ($tables as $table) {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*)
             FROM information_schema.TABLES
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name'
        );
        $stmt->execute(['table_name' => $table]);
        echo "- {$table}: " . ((int) $stmt->fetchColumn() > 0 ? 'OK' : 'FALTA') . "\n";
    }

    echo "\nColumnas criticas:\n";
    $columns = [
        ['matches', 'players_per_team'],
        ['matches', 'draw_mode'],
        ['matches', 'formation_edit_deadline'],
        ['match_players', 'availability_status'],
        ['match_teams', 'captain_player_id'],
        ['match_awards', 'notes'],
        ['captain_drafts', 'turn_version'],
    ];
    foreach ($columns as [$table, $column]) {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*)
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = :table_name
               AND COLUMN_NAME = :column_name'
        );
        $stmt->execute(['table_name' => $table, 'column_name' => $column]);
        echo "- {$table}.{$column}: " . ((int) $stmt->fetchColumn() > 0 ? 'OK' : 'FALTA') . "\n";
    }

    echo "\nDIAGNOSTICO COMPLETO.\n";
} catch (Throwable $e) {
    echo "\nERROR DETECTADO:\n";
    echo get_class($e) . ': ' . $e->getMessage() . "\n";
    echo "\nArchivo: " . $e->getFile() . ':' . $e->getLine() . "\n";
}
