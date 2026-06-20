<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/db.php';

require_admin();
ensure_control_schema();

function import_csv_rating_value(mixed $value, float $default = 1.0): float
{
    $normalized = str_replace(',', '.', trim((string) $value));
    if ($normalized === '' || !is_numeric($normalized)) {
        return $default;
    }

    return (float) $normalized;
}

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
    $paceIdx = array_search('velocidad', $map, true);
    if ($paceIdx === false) {
        $paceIdx = array_search('ritmo', $map, true);
    }
    $scoreIdx = array_search('puntuacion', $map, true);
    $activeIdx = array_search('activo', $map, true);
    $statIndexes = [
        'technique' => array_search('tecnica', $map, true),
        'pass_vision' => array_search('pase_vision', $map, true),
        'rhythm' => array_search('velocidad_numero', $map, true),
        'stamina' => array_search('ida_y_vuelta', $map, true),
        'defense_physical' => array_search('defensa_fisico', $map, true),
        'attack' => array_search('ataque', $map, true),
        'teamwork' => array_search('juego_en_equipo', $map, true),
        'mentality' => array_search('mentalidad', $map, true),
        'regularity' => array_search('regularidad', $map, true),
        'goalkeeper_skill' => array_search('arquero', $map, true),
    ];
    if ($statIndexes['rhythm'] === false) {
        $statIndexes['rhythm'] = array_search('ritmo_numero', $map, true);
    }

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
            $skill = import_csv_rating_value($cols[$scoreIdx] ?? 1);
            $skill = max(1.0, min(6.0, round($skill * 2) / 2));
            $active = $activeIdx !== false ? ((int) ($cols[$activeIdx] ?? 1) === 1 ? 1 : 0) : 1;

            if ($name === '' || $positions === '') {
                $skipped++;
                continue;
            }

            $stats = [
                'technique' => null,
                'pass_vision' => null,
                'rhythm' => null,
                'stamina' => null,
                'defense_physical' => null,
                'attack' => null,
                'teamwork' => 3.0,
                'mentality' => 3.0,
                'regularity' => null,
                'goalkeeper_skill' => null,
            ];
            foreach ($statIndexes as $field => $index) {
                if ($index === false || !array_key_exists((int) $index, $cols) || trim((string) $cols[(int) $index]) === '') {
                    continue;
                }
                $stats[$field] = normalize_player_stat(str_replace(',', '.', (string) $cols[(int) $index]), $field === 'regularity' ? 3.5 : 3.0);
            }
            if (!in_array('ARQ', parse_positions_csv($positions), true)) {
                $stats['goalkeeper_skill'] = null;
            }

            $ratingPlayer = [
                'positions' => $positions,
                'technique' => $stats['technique'] ?? $skill,
                'pass_vision' => $stats['pass_vision'] ?? ($stats['technique'] ?? $skill),
                'rhythm' => $stats['rhythm'] ?? $skill,
                'stamina' => $stats['stamina'] ?? ($stats['rhythm'] ?? $skill),
                'defense_physical' => $stats['defense_physical'] ?? $skill,
                'attack' => $stats['attack'] ?? $skill,
                'teamwork' => $stats['teamwork'] ?? 3.0,
                'mentality' => $stats['mentality'] ?? 3.0,
                'regularity' => $stats['regularity'] ?? 3.5,
                'goalkeeper_skill' => $stats['goalkeeper_skill'],
            ];
            $hasFullStats = count(array_filter($statIndexes, static fn($index): bool => $index !== false)) > 0;
            if ($hasFullStats) {
                $skill = player_overall_rating($ratingPlayer);
            }

            $find = $pdo->prepare('SELECT id FROM players WHERE name = :name LIMIT 1');
            $find->execute(['name' => $name]);
            $existingId = $find->fetchColumn();
            if ($existingId) {
                if ($hasFullStats) {
                    $update = $pdo->prepare(
                        'UPDATE players
                         SET positions = :positions, pace = :pace, skill = :skill,
                             technique = :technique, pass_vision = :pass_vision, rhythm = :rhythm, stamina = :stamina, defense_physical = :defense_physical,
                             attack = :attack, teamwork = :teamwork, mentality = :mentality,
                             regularity = :regularity, goalkeeper_skill = :goalkeeper_skill,
                             active = :active
                         WHERE id = :id'
                    );
                    $update->execute([
                        'id' => (int) $existingId,
                        'positions' => $positions,
                        'pace' => $pace,
                        'skill' => $skill,
                        'technique' => $ratingPlayer['technique'],
                        'pass_vision' => $ratingPlayer['pass_vision'],
                        'rhythm' => $ratingPlayer['rhythm'],
                        'stamina' => $ratingPlayer['stamina'],
                        'defense_physical' => $ratingPlayer['defense_physical'],
                        'attack' => $ratingPlayer['attack'],
                        'teamwork' => $ratingPlayer['teamwork'],
                        'mentality' => $ratingPlayer['mentality'],
                        'regularity' => $ratingPlayer['regularity'],
                        'goalkeeper_skill' => $stats['goalkeeper_skill'],
                        'active' => $active,
                    ]);
                } else {
                    $update = $pdo->prepare(
                        'UPDATE players
                         SET positions = :positions, pace = :pace, skill = :skill, active = :active
                         WHERE id = :id'
                    );
                    $update->execute([
                        'id' => (int) $existingId,
                        'positions' => $positions,
                        'pace' => $pace,
                        'skill' => $skill,
                        'active' => $active,
                    ]);
                }
                $updated++;
            } else {
                $insert = $pdo->prepare(
                    'INSERT INTO players
                       (name, positions, pace, skill, technique, pass_vision, rhythm, stamina, defense_physical, attack, teamwork, mentality, regularity, goalkeeper_skill, active)
                     VALUES
                       (:name, :positions, :pace, :skill, :technique, :pass_vision, :rhythm, :stamina, :defense_physical, :attack, :teamwork, :mentality, :regularity, :goalkeeper_skill, :active)'
                );
                $insert->execute([
                    'name' => $name,
                    'positions' => $positions,
                    'pace' => $pace,
                    'skill' => $skill,
                    'technique' => $ratingPlayer['technique'],
                    'pass_vision' => $ratingPlayer['pass_vision'],
                    'rhythm' => $ratingPlayer['rhythm'],
                    'stamina' => $ratingPlayer['stamina'],
                    'defense_physical' => $ratingPlayer['defense_physical'],
                    'attack' => $ratingPlayer['attack'],
                    'teamwork' => $ratingPlayer['teamwork'],
                    'mentality' => $ratingPlayer['mentality'],
                    'regularity' => $ratingPlayer['regularity'],
                    'goalkeeper_skill' => $stats['goalkeeper_skill'],
                    'active' => $active,
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

function csv_rating(float $value): string
{
    return number_format($value, 1, '.', '');
}

function export_players_csv(): void
{
    $players = db()->query(
        'SELECT id, name, positions, pace, skill, technique, pass_vision, rhythm, stamina, defense_physical,
                attack, teamwork, mentality, regularity, goalkeeper_skill, active,
                created_at, updated_at
         FROM players
         ORDER BY active DESC, name ASC'
    )->fetchAll();

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    $filename = 'jugadores_actuales_' . date('Ymd_His') . '.csv';
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    $stream = fopen('php://output', 'w');
    if ($stream === false) {
        throw new RuntimeException('No se pudo generar el CSV.');
    }

    fwrite($stream, "\xEF\xBB\xBF");
    fputcsv($stream, [
        'id',
        'nombre',
        'posicion',
        'velocidad',
        'promedio_general',
        'puntuacion',
        'tecnica',
        'pase_vision',
        'velocidad_numero',
        'ida_y_vuelta',
        'defensa_fisico',
        'ataque',
        'juego_en_equipo',
        'mentalidad',
        'regularidad',
        'arquero',
        'activo',
        'estado',
        'creado',
        'actualizado',
    ]);

    foreach ($players as $player) {
        $positions = join_positions(parse_positions_csv((string) ($player['positions'] ?? '')));
        fputcsv($stream, [
            (int) $player['id'],
            (string) $player['name'],
            $positions,
            pace_label((string) $player['pace']),
            csv_rating(player_overall_rating($player)),
            csv_rating((float) $player['skill']),
            csv_rating(player_effective_stat($player, 'technique')),
            csv_rating(player_effective_stat($player, 'pass_vision')),
            csv_rating(player_effective_stat($player, 'rhythm')),
            csv_rating(player_effective_stat($player, 'stamina')),
            csv_rating(player_effective_stat($player, 'defense_physical')),
            csv_rating(player_effective_stat($player, 'attack')),
            csv_rating(player_effective_stat($player, 'teamwork')),
            csv_rating(player_effective_stat($player, 'mentality')),
            csv_rating(player_effective_stat($player, 'regularity')),
            in_array('ARQ', parse_positions_csv($positions), true)
                ? csv_rating(player_effective_stat($player, 'goalkeeper_skill'))
                : '',
            (int) $player['active'],
            (int) $player['active'] === 1 ? 'Activo' : 'Inactivo',
            (string) ($player['created_at'] ?? ''),
            (string) ($player['updated_at'] ?? ''),
        ]);
    }

    fclose($stream);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (($_POST['action'] ?? '') === 'export_players') {
            export_players_csv();
        }

        if (($_POST['action'] ?? '') === 'import_default') {
            $path = __DIR__ . '/jugadores.csv';
            [$inserted, $updated, $skipped] = import_players_from_csv($path);
            flash('success', "Importacion finalizada. Nuevos: {$inserted}, actualizados desde backup: {$updated}, omitidos: {$skipped}.");
            redirect('jugadores2.php');
        }

        if (($_POST['action'] ?? '') === 'import_upload' && isset($_FILES['csv_file'])) {
            $tmp = (string) ($_FILES['csv_file']['tmp_name'] ?? '');
            if ($tmp === '' || !is_uploaded_file($tmp)) {
                flash('error', 'No se pudo leer el archivo subido.');
                redirect('migrar_csv.php');
            }
            [$inserted, $updated, $skipped] = import_players_from_csv($tmp);
            flash('success', "Importacion finalizada. Nuevos: {$inserted}, actualizados desde backup: {$updated}, omitidos: {$skipped}.");
            redirect('jugadores2.php');
        }
    } catch (Throwable $e) {
        flash('error', 'Error importando CSV: ' . $e->getMessage());
        redirect('migrar_csv.php');
    }
}

$title = 'Migrar CSV | ' . APP_NAME;
$activePage = 'jugadores2.php';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="migrar_csv_page"></div>

<?php require __DIR__ . '/includes/footer.php'; ?>
