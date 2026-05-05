<?php
declare(strict_types=1);

require_once __DIR__ . '/../config.php';

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    } catch (PDOException $e) {
        http_response_code(500);
        $safeMessage = 'No se pudo conectar a la base de datos MySQL. Verifica que MySQL/MariaDB este iniciado y que las credenciales de config.php sean correctas.';
        if (PHP_SAPI === 'cli') {
            fwrite(STDERR, $safeMessage . PHP_EOL . $e->getMessage() . PHP_EOL);
            exit(1);
        }
        echo '<!doctype html><meta charset="utf-8"><title>Error de base de datos</title>';
        echo '<div style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:24px;border:1px solid #dbe7e2;border-radius:12px">';
        echo '<h1 style="margin:0 0 12px;color:#082017">Error de base de datos</h1>';
        echo '<p>' . htmlspecialchars($safeMessage, ENT_QUOTES, 'UTF-8') . '</p>';
        echo '<pre style="white-space:pre-wrap;background:#f7faf9;padding:12px;border-radius:8px">' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . '</pre>';
        echo '</div>';
        exit;
    }
    return $pdo;
}
