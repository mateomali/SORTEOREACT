<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/schema.php';

if (PHP_SAPI !== 'cli') {
    require_admin();
}

$changes = ensure_control_schema();

if (PHP_SAPI === 'cli') {
    echo $changes
        ? "Migracion aplicada:\n- " . implode("\n- ", $changes) . "\n"
        : "La base ya estaba actualizada.\n";
    exit;
}

flash('success', $changes ? 'Migracion aplicada: ' . count($changes) . ' cambios.' : 'La base ya estaba actualizada.');
redirect('index.php');
