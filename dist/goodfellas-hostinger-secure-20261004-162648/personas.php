<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/helpers.php';
require_admin();
$accounts = (static function (): array {
    $personasDataOnly = true;
    return require __DIR__ . '/usuarios.php';
})();
$board = (static function (): array {
    $personasDataOnly = true;
    return require __DIR__ . '/directivos.php';
})();
$payload = [
    'accounts' => $accounts,
    'board' => $board,
    'tab' => ($_GET['tab'] ?? '') === 'directivos' ? 'directivos' : 'jugadores',
];
$title = 'Personas | ' . APP_NAME;
$activePage = 'personas.php';
$bodyClass = 'page-personas';
require __DIR__ . '/includes/header.php';
?>
<div data-react-root data-react-island="personas_page" data-payload="<?= h(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}') ?>"></div>
<?php require __DIR__ . '/includes/footer.php'; ?>
