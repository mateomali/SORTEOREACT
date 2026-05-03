<?php
declare(strict_types=1);

date_default_timezone_set('America/Argentina/Buenos_Aires');

const APP_NAME = 'Goodfellas Futbol';

$currentHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
$isProductionHost = str_contains($currentHost, 'sudokumerlo.com');

function env_value(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : (string) $value;
}

define('DB_HOST', env_value('GOODFELLAS_DB_HOST', 'localhost'));
define('DB_NAME', env_value('GOODFELLAS_DB_NAME', 'u552541920_futbol'));
define('DB_USER', env_value('GOODFELLAS_DB_USER', $isProductionHost ? '' : 'root'));
define('DB_PASS', env_value('GOODFELLAS_DB_PASS'));
define('DB_CHARSET', 'utf8mb4');
define('ADMIN_PASSWORD', env_value('GOODFELLAS_ADMIN_PASSWORD', 'Goodfellas2026'));
define('APP_PUBLIC_URL', $isProductionHost ? 'https://www.sudokumerlo.com/sorteo' : '');
