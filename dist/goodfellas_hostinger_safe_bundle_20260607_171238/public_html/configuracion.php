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
$title = 'Configuracion | ' . APP_NAME;
$activePage = 'configuracion.php';
$bodyClass = 'page-configuracion';
require __DIR__ . '/includes/header.php';
?>

<section class="mb-4 flex flex-wrap items-start justify-between gap-3">
  <div>
    <h1>Configuracion</h1>
    <p class="small-muted">Defaults del sorteo y canchas alquiladas para crear fechas mas rapido.</p>
  </div>
  <a class="btn btn-muted" href="crear_partido.php">Crear fecha</a>
</section>

<section class="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
  <article class="settings-panel rounded-2xl border border-lime-200/35 bg-emerald-950/90 p-4 text-lime-50 shadow-xl shadow-emerald-950/20">
    <div class="mb-4">
      <h2 class="mb-1 text-xl font-black text-lime-50">Opciones de sorteo</h2>
      <p class="text-sm font-semibold text-emerald-100/75">Estos valores se aplican automaticamente al crear una fecha nueva.</p>
    </div>
    <form class="grid gap-3" method="post">
      <input type="hidden" name="action" value="save_settings">
      <label class="grid gap-2 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3 text-sm font-bold text-lime-50">
        <span class="text-xs font-black uppercase text-lime-100/85">Rehacer sorteo</span>
        <span class="flex min-h-11 items-center gap-3 rounded-xl border border-lime-200/35 bg-emerald-950/92 px-3 py-2">
          <input class="h-4 w-4 accent-lime-200" type="checkbox" name="allow_redraw_default" value="1" <?= checked_attr((string) $settings['allow_redraw_default'] === '1') ?>>
          <span>Permitir rehacer sorteo</span>
        </span>
      </label>
      <label class="grid gap-1.5 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
        <span class="text-xs font-black uppercase text-lime-100/85">Veces permitidas</span>
        <input class="w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="number" name="redraw_limit_default" min="0" max="20" value="<?= h((string) $settings['redraw_limit_default']) ?>">
      </label>
      <label class="grid gap-1.5 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
        <span class="text-xs font-black uppercase text-lime-100/85">Sorteo multiple</span>
        <input class="w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="number" name="multi_draw_count_default" min="1" max="10" value="<?= h((string) $settings['multi_draw_count_default']) ?>">
        <small class="text-xs font-semibold text-lime-50/72">Cantidad de variantes a generar. Default recomendado: 3.</small>
      </label>
      <label class="grid gap-1.5 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
        <span class="text-xs font-black uppercase text-lime-100/85">Cierre de votacion</span>
        <input class="w-full rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="number" name="multi_draw_lock_minutes_default" min="0" max="1440" value="<?= h((string) $settings['multi_draw_lock_minutes_default']) ?>">
        <small class="text-xs font-semibold text-lime-50/72">Minutos antes del partido.</small>
      </label>
      <div class="grid gap-3 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
        <div>
          <span class="text-xs font-black uppercase text-lime-100/85">Pesos por posicion</span>
          <p class="m-0 mt-1 text-xs font-semibold text-lime-50/72">Valores relativos. Al guardar se normalizan para que cada posicion sume 100%.</p>
        </div>
        <div class="grid gap-3">
          <?php foreach ($positionWeights as $position => $weights): ?>
            <fieldset class="grid gap-2 rounded-xl border border-lime-200/20 bg-emerald-950/65 p-3">
              <legend class="px-1 text-sm font-black text-lime-50"><?= h($position) ?> · <?= h(number_format(array_sum($weights) * 100, 0, ',', '.')) ?>%</legend>
              <div class="grid gap-2 sm:grid-cols-2">
                <?php foreach ($weights as $field => $weight): ?>
                  <label class="grid gap-1">
                    <span class="text-[11px] font-black uppercase text-lime-100/80"><?= h($positionWeightLabels[$field] ?? $field) ?></span>
                    <input class="rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50" type="number" name="position_weights[<?= h($position) ?>][<?= h($field) ?>]" min="0" max="1" step="0.01" value="<?= h(number_format((float) $weight, 2, '.', '')) ?>">
                  </label>
                <?php endforeach; ?>
              </div>
            </fieldset>
          <?php endforeach; ?>
        </div>
        <button class="btn btn-muted w-full" type="submit" name="reset_position_weights" value="1">Restaurar pesos por defecto</button>
      </div>
      <button class="btn btn-primary w-full" type="submit">Guardar configuracion</button>
    </form>
  </article>

  <article class="settings-panel rounded-2xl border border-lime-200/35 bg-emerald-950/90 p-4 text-lime-50 shadow-xl shadow-emerald-950/20">
    <div class="mb-4">
      <h2 class="mb-1 text-xl font-black text-lime-50">Canchas alquiladas</h2>
      <p class="text-sm font-semibold text-emerald-100/75">Cada cancha define dia, hora y cupos. Crear fecha calcula el proximo dia del calendario.</p>
    </div>

    <form class="mb-4 grid gap-3 rounded-2xl border border-lime-200/25 bg-emerald-900/45 p-3" method="post">
      <input type="hidden" name="action" value="save_court">
      <div class="grid gap-3 md:grid-cols-2">
        <label class="grid gap-1.5">
          <span class="text-xs font-black uppercase text-lime-100/85">Id</span>
          <input class="rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="text" name="court_key" placeholder="cancha1" required>
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs font-black uppercase text-lime-100/85">Lugar</span>
          <input class="rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="text" name="place" placeholder="kicker" required>
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs font-black uppercase text-lime-100/85">Dia</span>
          <select class="rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" name="weekday">
            <?php for ($day = 1; $day <= 7; $day++): ?>
              <option value="<?= $day ?>"><?= h(rental_weekday_label($day)) ?></option>
            <?php endfor; ?>
          </select>
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs font-black uppercase text-lime-100/85">Horario</span>
          <input class="rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="time" name="time_value" value="21:00" required>
        </label>
        <label class="grid gap-1.5">
          <span class="text-xs font-black uppercase text-lime-100/85">Jugadores totales</span>
          <input class="rounded-xl border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25" type="number" name="total_players" min="2" max="40" value="18" required>
        </label>
        <label class="flex min-h-11 items-center gap-3 self-end rounded-xl border border-lime-200/35 bg-emerald-950/92 px-3 py-2 text-sm font-bold text-lime-50">
          <input class="h-4 w-4 accent-lime-200" type="checkbox" name="active" value="1" checked>
          <span>Activa</span>
        </label>
      </div>
      <button class="btn btn-primary w-full" type="submit">Agregar cancha</button>
    </form>

    <div class="grid gap-2">
      <?php foreach ($courts as $court): ?>
        <form class="grid gap-2 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3" method="post">
          <input type="hidden" name="action" value="save_court">
          <input type="hidden" name="id" value="<?= (int) $court['id'] ?>">
          <div class="grid gap-2 md:grid-cols-[0.8fr_1fr_0.9fr_0.8fr_0.8fr_auto]">
            <input class="rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50" type="text" name="court_key" value="<?= h((string) $court['court_key']) ?>" required>
            <input class="rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50" type="text" name="place" value="<?= h((string) $court['place']) ?>" required>
            <select class="rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50" name="weekday">
              <?php for ($day = 1; $day <= 7; $day++): ?>
                <option value="<?= $day ?>" <?= selected_attr((int) $court['weekday'] === $day) ?>><?= h(rental_weekday_label($day)) ?></option>
              <?php endfor; ?>
            </select>
            <input class="rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50" type="time" name="time_value" value="<?= h(substr((string) $court['time_value'], 0, 5)) ?>" required>
            <input class="rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-xs font-bold text-lime-50" type="number" name="total_players" min="2" max="40" value="<?= h((string) $court['total_players']) ?>" required>
            <label class="inline-flex items-center justify-center gap-2 rounded-lg border border-lime-200/25 bg-emerald-950/80 px-2 py-1 text-xs font-black text-lime-100">
              <input class="h-4 w-4 accent-lime-200" type="checkbox" name="active" value="1" <?= checked_attr((int) $court['active'] === 1) ?>>
              Activa
            </label>
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <small class="font-semibold text-emerald-100/75">Proxima: <?= h(rental_court_next_datetime($court)->format('d/m/Y H:i')) ?></small>
            <button class="btn btn-muted min-h-9 px-3 py-1.5 text-xs" type="submit">Guardar cancha</button>
          </div>
        </form>
      <?php endforeach; ?>
    </div>
  </article>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
