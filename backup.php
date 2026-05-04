<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/awards.php';

require_admin();

$pdo = db();
ensure_control_schema();
ensure_match_awards_schema();

const BACKUP_NULL = '__GOODFELLAS_NULL__';

function backup_tables(): array
{
    return [
        'players',
        'matches',
        'match_players',
        'match_teams',
        'match_awards',
        'captain_drafts',
        'captain_picks',
    ];
}

function backup_import_sections(): array
{
    return [
        'players' => [
            'label' => 'Jugadores',
            'description' => 'Plantilla de jugadores y sus datos actuales.',
            'tables' => ['players'],
        ],
        'matches' => [
            'label' => 'Partidos completos',
            'description' => 'Partidos, convocados, equipos, resultados, premios y capitanes.',
            'tables' => [
                'matches',
                'match_players',
                'match_teams',
                'match_awards',
                'captain_drafts',
                'captain_picks',
            ],
        ],
    ];
}

function backup_tables_for_sections(array $sectionKeys): array
{
    $sections = backup_import_sections();
    $selected = [];
    foreach ($sectionKeys as $key) {
        if (!isset($sections[$key])) {
            continue;
        }
        foreach ($sections[$key]['tables'] as $table) {
            $selected[$table] = true;
        }
    }

    return array_values(array_filter(
        backup_tables(),
        static fn(string $table): bool => isset($selected[$table])
    ));
}

function table_exists(PDO $pdo, string $table): bool
{
    $stmt = $pdo->prepare(
        'SELECT COUNT(*)
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name'
    );
    $stmt->execute(['table_name' => $table]);
    return (int) $stmt->fetchColumn() > 0;
}

function table_columns(PDO $pdo, string $table): array
{
    $stmt = $pdo->prepare(
        'SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :table_name
         ORDER BY ORDINAL_POSITION ASC'
    );
    $stmt->execute(['table_name' => $table]);
    return array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

function csv_from_table(PDO $pdo, string $table, array $columns): string
{
    $stream = fopen('php://temp', 'r+');
    if ($stream === false) {
        throw new RuntimeException('No se pudo preparar el CSV.');
    }

    fputcsv($stream, $columns);
    $columnSql = implode(', ', array_map(static fn(string $column): string => '`' . str_replace('`', '``', $column) . '`', $columns));
    $stmt = $pdo->query('SELECT ' . $columnSql . ' FROM `' . str_replace('`', '``', $table) . '`');
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $values = [];
        foreach ($columns as $column) {
            $values[] = $row[$column] === null ? BACKUP_NULL : (string) $row[$column];
        }
        fputcsv($stream, $values);
    }

    rewind($stream);
    $csv = stream_get_contents($stream);
    fclose($stream);
    if ($csv === false) {
        throw new RuntimeException('No se pudo leer el CSV generado.');
    }
    return $csv;
}

function send_backup_zip(PDO $pdo): void
{
    $zip = new ZipArchive();
    $tmpPath = tempnam(sys_get_temp_dir(), 'goodfellas-backup-');
    if ($tmpPath === false) {
        throw new RuntimeException('No se pudo crear el archivo temporal.');
    }

    if ($zip->open($tmpPath, ZipArchive::OVERWRITE) !== true) {
        @unlink($tmpPath);
        throw new RuntimeException('No se pudo abrir el ZIP.');
    }

    $manifest = [
        'app' => APP_NAME,
        'version' => 1,
        'exported_at' => date('c'),
        'tables' => [],
    ];

    foreach (backup_tables() as $table) {
        if (!table_exists($pdo, $table)) {
            continue;
        }
        $columns = table_columns($pdo, $table);
        $manifest['tables'][$table] = $columns;
        $zip->addFromString('csv/' . $table . '.csv', csv_from_table($pdo, $table, $columns));
    }

    $zip->addFromString('manifest.json', json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    $zip->close();

    $filename = 'goodfellas-backup-' . date('Ymd-His') . '.zip';
    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . (string) filesize($tmpPath));
    header('Cache-Control: no-store');
    readfile($tmpPath);
    @unlink($tmpPath);
    exit;
}

function read_csv_from_zip(ZipArchive $zip, string $table): ?array
{
    $content = $zip->getFromName('csv/' . $table . '.csv');
    if ($content === false) {
        return null;
    }

    $stream = fopen('php://temp', 'r+');
    if ($stream === false) {
        throw new RuntimeException('No se pudo abrir el CSV de ' . $table . '.');
    }
    fwrite($stream, $content);
    rewind($stream);

    $headers = fgetcsv($stream);
    if (!is_array($headers) || !$headers) {
        fclose($stream);
        return ['columns' => [], 'rows' => []];
    }

    $rows = [];
    while (($row = fgetcsv($stream)) !== false) {
        $normalized = [];
        foreach ($headers as $index => $column) {
            $value = $row[$index] ?? null;
            $normalized[(string) $column] = $value === BACKUP_NULL ? null : $value;
        }
        $rows[] = $normalized;
    }
    fclose($stream);

    return ['columns' => array_map('strval', $headers), 'rows' => $rows];
}

function import_backup_zip(PDO $pdo, string $path, array $selectedTables): array
{
    $selectedTables = array_values(array_filter(
        backup_tables(),
        static fn(string $table): bool => in_array($table, $selectedTables, true)
    ));
    if (!$selectedTables) {
        throw new RuntimeException('Selecciona al menos una seccion para importar.');
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('No se pudo abrir el archivo ZIP.');
    }

    $importData = [];
    foreach ($selectedTables as $table) {
        $csv = read_csv_from_zip($zip, $table);
        if ($csv !== null) {
            $importData[$table] = $csv;
        }
    }
    $zip->close();

    if (!$importData) {
        throw new RuntimeException('El backup no contiene CSV validos.');
    }

    $pdo->beginTransaction();
    try {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
        foreach (array_reverse(backup_tables()) as $table) {
            if (!in_array($table, $selectedTables, true)) {
                continue;
            }
            if (table_exists($pdo, $table)) {
                $pdo->exec('DELETE FROM `' . str_replace('`', '``', $table) . '`');
            }
        }

        $counts = [];
        foreach (backup_tables() as $table) {
            if (!in_array($table, $selectedTables, true) || !isset($importData[$table])) {
                continue;
            }
            $availableColumns = table_columns($pdo, $table);
            $columns = array_values(array_intersect($importData[$table]['columns'], $availableColumns));
            if (!$columns) {
                $counts[$table] = 0;
                continue;
            }
            $columnSql = implode(', ', array_map(static fn(string $column): string => '`' . str_replace('`', '``', $column) . '`', $columns));
            $placeholders = implode(', ', array_map(static fn(string $column): string => ':' . $column, $columns));
            $stmt = $pdo->prepare('INSERT INTO `' . str_replace('`', '``', $table) . '` (' . $columnSql . ') VALUES (' . $placeholders . ')');
            $count = 0;
            foreach ($importData[$table]['rows'] as $row) {
                $params = [];
                foreach ($columns as $column) {
                    $params[$column] = $row[$column] ?? null;
                }
                $stmt->execute($params);
                $count++;
            }
            $counts[$table] = $count;
        }

        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        $pdo->commit();
        return $counts;
    } catch (Throwable $e) {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'export_backup') {
    send_backup_zip($pdo);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'import_backup') {
    try {
        if (empty($_FILES['backup_file']['tmp_name']) || !is_uploaded_file((string) $_FILES['backup_file']['tmp_name'])) {
            throw new RuntimeException('Selecciona un archivo de backup.');
        }
        if (empty($_POST['confirm_restore'])) {
            throw new RuntimeException('Confirma que quieres reemplazar la base actual.');
        }
        $sectionKeys = $_POST['import_sections'] ?? [];
        if (!is_array($sectionKeys)) {
            $sectionKeys = [];
        }
        $selectedTables = backup_tables_for_sections(array_map('strval', $sectionKeys));
        $counts = import_backup_zip($pdo, (string) $_FILES['backup_file']['tmp_name'], $selectedTables);
        $summary = [];
        foreach ($counts as $table => $count) {
            $summary[] = $table . ': ' . $count;
        }
        flash('success', 'Backup importado parcialmente. ' . implode(' | ', $summary));
    } catch (Throwable $e) {
        flash('error', 'No se pudo importar el backup: ' . $e->getMessage());
    }
    redirect('backup.php');
}

$tableCounts = [];
foreach (backup_tables() as $table) {
    if (!table_exists($pdo, $table)) {
        continue;
    }
    $tableCounts[$table] = (int) $pdo->query('SELECT COUNT(*) FROM `' . str_replace('`', '``', $table) . '`')->fetchColumn();
}

$title = 'Backup | ' . APP_NAME;
$activePage = 'backup.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Backup</h1>
    <p class="small-muted">Exporta una copia completa o importa solo las secciones que necesites recuperar.</p>
  </div>
</section>

<section class="grid cols-2 backup-grid">
  <article class="card">
    <h3>Exportar backup</h3>
    <p class="small-muted">Descarga un ZIP con archivos CSV de jugadores, partidos, equipos, premios y capitanes.</p>
    <form method="post" class="btn-row">
      <input type="hidden" name="action" value="export_backup">
      <button class="btn btn-primary" type="submit">Descargar backup CSV</button>
    </form>
  </article>

  <article class="card">
    <h3>Importar backup</h3>
    <p class="small-muted">Reemplaza solamente las secciones marcadas. Usa archivos generados por esta pantalla.</p>
    <form method="post" enctype="multipart/form-data" class="form-grid">
      <input type="hidden" name="action" value="import_backup">
      <div class="form-row">
        <label for="backupFile">Archivo backup .zip</label>
        <input id="backupFile" type="file" name="backup_file" accept=".zip,application/zip" required>
      </div>
      <div class="form-row">
        <label>Que importar</label>
        <div class="backup-section-list">
          <?php foreach (backup_import_sections() as $sectionKey => $section): ?>
            <label class="inline-check">
              <input type="checkbox" name="import_sections[]" value="<?= h($sectionKey) ?>" checked>
              <span>
                <strong><?= h($section['label']) ?></strong>
                <span class="small-muted"><?= h($section['description']) ?></span>
              </span>
            </label>
          <?php endforeach; ?>
        </div>
      </div>
      <label class="inline-check">
        <input type="checkbox" name="confirm_restore" value="1" required>
        Reemplazar las secciones seleccionadas con este backup
      </label>
      <div class="btn-row">
        <button class="btn btn-danger" type="submit" data-confirm="Esta accion reemplaza las secciones seleccionadas. Continuar?">Importar seleccion</button>
      </div>
    </form>
  </article>
</section>

<section class="card">
  <h3>Contenido incluido</h3>
  <div class="table-wrap">
    <table class="stats-table">
      <thead>
        <tr>
          <th>Tabla</th>
          <th>Registros</th>
        </tr>
      </thead>
      <tbody>
        <?php foreach ($tableCounts as $table => $count): ?>
          <tr>
            <td data-label="Tabla"><strong><?= h($table) ?></strong></td>
            <td data-label="Registros"><?= h((string) $count) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
