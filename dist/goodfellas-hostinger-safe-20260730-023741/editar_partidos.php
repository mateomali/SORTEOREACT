<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/diagnostics.php';
gf_install_diagnostics('editar_partidos');
$enableClientDiagnostics = true;

define('MATCH_ADMIN_VIEW', 'edit');
require __DIR__ . '/encuentros.php';
