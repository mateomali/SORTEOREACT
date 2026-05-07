<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';

require_admin();

function import_players_from_csv(string $csvPath): array
{
    $pdo = db();
    $inserted = 0;
    $updated = 0;
    $skipped = 0;

    if (!is_readable($csvPath)) {
        return [0, 0, 0];
    }

    $rows = file($csvPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$rows) {
        return [0, 0, 0];
    }

    $header = str_getcsv(array_shift($rows));
    $map = array_map(static fn($v) => strtolower(trim((string) $v)), $header);
    $nameIdx = array_search('nombre', $map, true);
    $posIdx = array_search('posicion', $map, true);
    $paceIdx = array_search('ritmo', $map, true);
    $scoreIdx = array_search('puntuacion', $map, true);

    if ($nameIdx === false || $posIdx === false || $paceIdx === false || $scoreIdx === false) {
        return [0, 0, count($rows)];
    }

    $pdo->beginTransaction();
    try {
        foreach ($rows as $line) {
            $cols = str_getcsv($line);
            $name = trim((string) ($cols[$nameIdx] ?? ''));
            $positions = join_positions(parse_positions_csv((string) ($cols[$posIdx] ?? '')));
            $pace = normalize_pace((string) ($cols[$paceIdx] ?? ''));
            $skill = (float) ($cols[$scoreIdx] ?? 1);
            $skill = max(1.0, min(6.0, round($skill * 2) / 2));

            if ($name === '' || $positions === '') {
                $skipped++;
                continue;
            }

            $find = $pdo->prepare('SELECT id FROM players WHERE name = :name LIMIT 1');
            $find->execute(['name' => $name]);
            $existing = $find->fetchColumn();
            if ($existing) {
                $update = $pdo->prepare(
                    'UPDATE players
                     SET positions = :positions, pace = :pace, skill = :skill, active = 1
                     WHERE id = :id'
                );
                $update->execute([
                    'id' => (int) $existing,
                    'positions' => $positions,
                    'pace' => $pace,
                    'skill' => $skill,
                ]);
                $updated++;
            } else {
                $insert = $pdo->prepare(
                    'INSERT INTO players (name, positions, pace, skill, active)
                     VALUES (:name, :positions, :pace, :skill, 1)'
                );
                $insert->execute([
                    'name' => $name,
                    'positions' => $positions,
                    'pace' => $pace,
                    'skill' => $skill,
                ]);
                $inserted++;
            }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    return [$inserted, $updated, $skipped];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (($_POST['action'] ?? '') === 'import_default') {
            $path = __DIR__ . '/jugadores.csv';
            [$inserted, $updated, $skipped] = import_players_from_csv($path);
            flash('success', "Importacion finalizada. Nuevos: {$inserted}, actualizados: {$updated}, omitidos: {$skipped}.");
            redirect('jugadores.php');
        }

        if (($_POST['action'] ?? '') === 'import_upload' && isset($_FILES['csv_file'])) {
            $tmp = (string) ($_FILES['csv_file']['tmp_name'] ?? '');
            if ($tmp === '' || !is_uploaded_file($tmp)) {
                flash('error', 'No se pudo leer el archivo subido.');
                redirect('migrar_csv.php');
            }
            [$inserted, $updated, $skipped] = import_players_from_csv($tmp);
            flash('success', "Importacion finalizada. Nuevos: {$inserted}, actualizados: {$updated}, omitidos: {$skipped}.");
            redirect('jugadores.php');
        }
    } catch (Throwable $e) {
        flash('error', 'Error importando CSV: ' . $e->getMessage());
        redirect('migrar_csv.php');
    }
}

$title = 'Migrar CSV | ' . APP_NAME;
$activePage = 'jugadores.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Migracion desde CSV</h1>
    <p class="small-muted">Importa jugadores desde el archivo historico al nuevo modelo en base de datos.</p>
  </div>
  <a class="btn btn-muted" href="jugadores.php">Volver a jugadores</a>
</section>

<section class="grid cols-2">
  <article class="card">
    <h3>Importar jugadores.csv local</h3>
    <p class="small-muted">Usa el archivo <code>jugadores.csv</code> de esta carpeta.</p>
    <form method="post" data-no-partial>
      <input type="hidden" name="action" value="import_default">
      <button class="btn btn-primary" type="submit">Importar archivo local</button>
    </form>
  </article>

  <article class="card">
    <h3>Subir otro CSV</h3>
    <p class="small-muted">Columnas esperadas: Nombre, Posicion, Ritmo, Puntuacion.</p>
    <form method="post" enctype="multipart/form-data" data-no-partial>
      <input type="hidden" name="action" value="import_upload">
      <div class="form-row">
        <input type="file" name="csv_file" accept=".csv,text/csv" required>
      </div>
      <button class="btn btn-primary" type="submit">Subir e importar</button>
    </form>
  </article>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
