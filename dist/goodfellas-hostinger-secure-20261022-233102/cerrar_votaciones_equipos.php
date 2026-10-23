<?php
declare(strict_types=1);
// CLI only: included in runtime bundles for the hosting scheduler.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/lib/director_proposals.php';
director_proposals_finalize_due();
echo "Votaciones vencidas procesadas.\n";
