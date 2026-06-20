<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/admin_config.php';

require_admin();
ensure_control_schema();
ensure_admin_config_schema();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    try {
        if ($action === 'save_settings' && isset($_POST['reset_position_weights'])) {
            admin_config_reset_position_weights();
            flash('success', 'Pesos por posicion restaurados.');
        } elseif ($action === 'save_settings') {
            admin_config_save_settings($_POST);
            flash('success', 'Configuracion de sorteos guardada.');
        } elseif ($action === 'save_court') {
            rental_court_save($_POST);
            flash('success', 'Cancha guardada.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('configuracion.php');
}

$settings = admin_config_settings();
$positionWeights = admin_config_position_weights($settings);
$positionWeightLabels = admin_config_position_weight_labels();
$courts = rental_courts(false);
$configIslandPayload = [
    'settings' => [
        'allow_redraw_default' => (string) $settings['allow_redraw_default'],
        'redraw_limit_default' => (string) $settings['redraw_limit_default'],
        'multi_draw_count_default' => (string) $settings['multi_draw_count_default'],
        'multi_draw_lock_minutes_default' => (string) $settings['multi_draw_lock_minutes_default'],
    ],
    'positionWeights' => $positionWeights,
    'positionWeightLabels' => $positionWeightLabels,
    'weekdays' => array_map(
        static fn(int $day): array => [
            'value' => $day,
            'label' => rental_weekday_label($day),
        ],
        range(1, 7)
    ),
    'courts' => array_map(
        static fn(array $court): array => [
            'id' => (int) $court['id'],
            'court_key' => (string) $court['court_key'],
            'place' => (string) $court['place'],
            'weekday' => (int) $court['weekday'],
            'time_value' => substr((string) $court['time_value'], 0, 5),
            'total_players' => (int) $court['total_players'],
            'active' => (int) $court['active'] === 1,
            'next_datetime' => rental_court_next_datetime($court)->format('d/m/Y H:i'),
        ],
        $courts
    ),
];

$title = 'Configuracion | ' . APP_NAME;
$activePage = 'configuracion.php';
$bodyClass = 'page-configuracion';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="config_page">
  <script type="application/json">
    <?= json_encode($configIslandPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
