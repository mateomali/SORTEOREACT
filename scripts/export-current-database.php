<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../lib/goal_corrections.php';
ensure_goal_corrections();
$output = $argv[1] ?? (__DIR__ . '/../dist/goodfellas-base-actualizada-20261022.sql');
$dump = 'C:/xampp/mysql/bin/mysqldump.exe';
$args = [$dump, '--host=' . DB_HOST, '--user=' . DB_USER,
    '--single-transaction', '--skip-lock-tables', '--routines', '--triggers', '--events',
    '--hex-blob', '--default-character-set=utf8mb4', '--no-tablespaces',
    '--result-file=' . $output, DB_NAME];
$environment = getenv();
$environment['MYSQL_PWD'] = DB_PASS;
$process = proc_open($args, [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $environment);
if (!is_resource($process)) throw new RuntimeException('No se pudo iniciar mysqldump.');
fclose($pipes[0]);
$stdout = stream_get_contents($pipes[1]); fclose($pipes[1]);
$stderr = stream_get_contents($pipes[2]); fclose($pipes[2]);
$exit = proc_close($process);
if ($exit !== 0) throw new RuntimeException('Falló la exportación: ' . $stderr);
$sql = file_get_contents($output);
if (!str_contains($sql, 'Dump completed') || !str_contains($sql, 'CREATE TABLE `player_goal_corrections`')) {
    throw new RuntimeException('Exportación incompleta.');
}
$tables = db()->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll();
preg_match_all('/CREATE TABLE `/i', $sql, $matches);
if (count($matches[0]) !== count($tables)) throw new RuntimeException('La cantidad de tablas exportadas no coincide.');
$count = (int) db()->query("SELECT COUNT(*) FROM player_goal_corrections WHERE source='user-verified-20261022'")->fetchColumn();
if ($count !== 32) throw new RuntimeException('Faltan correcciones de goleadores.');
echo json_encode(['file' => realpath($output), 'tables' => count($tables), 'goal_corrections' => $count,
    'bytes' => filesize($output), 'sha256' => hash_file('sha256', $output)], JSON_PRETTY_PRINT) . PHP_EOL;
