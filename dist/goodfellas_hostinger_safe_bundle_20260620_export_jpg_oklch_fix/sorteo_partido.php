<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_admin();

$query = $_SERVER['QUERY_STRING'] ?? '';
$target = 'sorteo_legacy_csv.php' . ($query !== '' ? '?' . $query : '');
header('Location: ' . $target);
exit;
