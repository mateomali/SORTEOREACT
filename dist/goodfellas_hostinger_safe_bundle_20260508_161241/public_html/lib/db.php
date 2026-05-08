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
        echo '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Error de base de datos</title>';
        echo '<link rel="stylesheet" href="assets/tailwind.css">';
        echo '<main class="min-h-screen bg-emerald-950 p-6 text-lime-50">';
        echo '<section class="mx-auto mt-12 max-w-2xl rounded-2xl border border-lime-200/45 bg-emerald-950/95 p-6 shadow-xl shadow-emerald-950/30">';
        echo '<h1 class="mb-3 text-2xl font-extrabold text-lime-50">Error de base de datos</h1>';
        echo '<p class="text-sm font-semibold text-emerald-100/80">' . htmlspecialchars($safeMessage, ENT_QUOTES, 'UTF-8') . '</p>';
        echo '<pre class="mt-4 whitespace-pre-wrap rounded-xl border border-lime-200/30 bg-emerald-900/60 p-3 text-sm text-lime-50">' . htmlspecialchars($e->getMessage(), ENT_QUOTES, 'UTF-8') . '</pre>';
        echo '</section></main>';
        exit;
    }
    return $pdo;
}
