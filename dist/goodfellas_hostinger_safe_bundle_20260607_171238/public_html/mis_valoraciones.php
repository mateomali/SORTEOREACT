<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/directivos.php';

require_directivo_or_admin();
ensure_directivos_schema();

$voterId = current_directivo_id();
if (is_admin() && isset($_GET['directivo_id'])) {
    $voterId = max(0, (int) $_GET['directivo_id']);
}
$currentMember = $voterId > 0 ? directive_member_by_id($voterId) : null;
if (!$currentMember && is_directivo()) {
    flash('error', 'No se pudo identificar tu usuario directivo.');
    redirect('junta_votaciones.php');
}

$players = repo_all_players(true);
$fields = director_player_stat_fields();
$labels = director_player_stat_labels();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (!$currentMember) {
            throw new RuntimeException('Directivo invalido.');
        }
        $saved = director_save_player_stat_votes(
            (int) $currentMember['id'],
            is_array($_POST['stats'] ?? null) ? $_POST['stats'] : []
        );
        flash('success', 'Valoraciones guardadas. Jugadores actualizados: ' . (string) $saved . '.');
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    $redirect = 'mis_valoraciones.php';
    if (is_admin() && $voterId > 0) {
        $redirect .= '?directivo_id=' . $voterId;
    }
    redirect($redirect);
}

$votes = $currentMember ? director_member_stat_votes((int) $currentMember['id']) : [];
$members = is_admin() ? directive_members(true) : [];
$progress = director_player_stat_vote_progress(count($players));
$progressById = [];
foreach ($progress as $row) {
    $progressById[(int) $row['id']] = $row;
}

function valuation_input_value(array $player, array $vote, string $field): string
{
    if (array_key_exists($field, $vote) && $vote[$field] !== null && $vote[$field] !== '') {
        return (string) (int) $vote[$field];
    }
    return (string) director_stat_0_99_from_internal(player_effective_stat($player, $field));
}

$positionWeightsJson = json_encode(
    player_position_stat_weights_config(),
    JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT
) ?: '{}';

$title = 'Mis valoraciones | ' . APP_NAME;
$activePage = 'mis_valoraciones.php';
$bodyClass = 'page-mis-valoraciones';
require __DIR__ . '/includes/header.php';
?>

<section class="mx-auto grid w-full max-w-7xl gap-3 px-3 py-3 text-[#07130f] sm:px-5 lg:py-5">
  <div class="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <div>
      <h1 class="m-0 text-xl font-black leading-tight text-[#07130f]">Mis valoraciones</h1>
      <p class="m-0 mt-1 text-sm font-semibold text-[#526b62]">
        Carga de stats globales en escala 0-99. El promedio se calcula solo con directivos que hayan cargado valores.
      </p>
      <?php if ($currentMember): ?>
        <p class="m-0 mt-1 text-xs font-bold text-[#526b62]">Directivo: <strong class="text-[#07130f]"><?= h((string) $currentMember['name']) ?></strong></p>
      <?php endif; ?>
    </div>
    <?php if (is_admin() && $members): ?>
      <form method="get" class="grid gap-1 text-xs font-extrabold text-[#526b62]">
        <label for="directivo_id">Editar como</label>
        <select id="directivo_id" class="min-h-10 rounded-lg border border-[#c9d8d1] bg-white px-3 text-sm font-bold text-[#07130f]" name="directivo_id" onchange="this.form.submit()">
          <option value="">Elegir directivo</option>
          <?php foreach ($members as $member): ?>
            <option value="<?= (int) $member['id'] ?>" <?= (int) $member['id'] === $voterId ? 'selected' : '' ?>><?= h((string) $member['name']) ?></option>
          <?php endforeach; ?>
        </select>
      </form>
    <?php endif; ?>
  </div>

  <?php if (is_admin() && $progress): ?>
    <section class="valuation-progress grid gap-2 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm">
      <h2 class="m-0 text-base font-black text-[#07130f]">Estado de carga</h2>
      <div class="valuation-progress-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <?php foreach ($progress as $row): ?>
          <div class="valuation-progress-card rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2">
            <strong class="block text-sm font-black text-[#07130f]"><?= h((string) $row['name']) ?></strong>
            <span class="text-xs font-bold text-[#526b62]"><?= (int) $row['voted_players'] ?>/<?= count($players) ?> jugadores</span>
          </div>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>

  <?php if (!$currentMember): ?>
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-[#7a4b00]">
      Selecciona un directivo para cargar valoraciones.
    </section>
  <?php else: ?>
    <form method="post" class="valuation-form grid gap-3">
      <section class="valuation-table-shell overflow-hidden rounded-lg border border-[#d7e6df] bg-white shadow-sm">
        <div class="valuation-table-wrap overflow-auto">
          <table class="valuation-table min-w-[1120px] w-full border-collapse text-sm">
            <thead class="bg-emerald-950 text-white">
              <tr>
                <th class="sticky left-0 z-20 bg-emerald-950 px-3 py-2 text-left">Jugador</th>
                <th class="px-3 py-2 text-left">Posiciones</th>
                <?php foreach ($fields as $field): ?>
                  <th class="px-2 py-2 text-center"><?= h($labels[$field] ?? $field) ?></th>
                <?php endforeach; ?>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($players as $player): ?>
                <?php
                  $playerId = (int) $player['id'];
                  $vote = $votes[$playerId] ?? [];
                  $currentGeneral = director_stat_0_99_from_internal(player_overall_rating($player));
                ?>
                <tr class="border-t border-[#d7e6df]" data-valuation-player-row data-primary-position="<?= h(player_primary_position($player)) ?>">
                  <td class="valuation-player-cell sticky left-0 z-10 bg-white px-3 py-2" data-label="Jugador">
                    <strong class="block text-[#07130f]"><?= h((string) $player['name']) ?></strong>
                    <small class="valuation-general-badge">
                      <span>GEN</span>
                      <strong class="valuation-general-value" data-general-initial="<?= (int) $currentGeneral ?>"><?= h((string) $currentGeneral) ?></strong>
                    </small>
                  </td>
                  <td class="valuation-position-cell px-3 py-2 font-bold text-[#526b62]" data-label="Posiciones"><?= h((string) $player['positions']) ?></td>
                  <?php foreach ($fields as $field): ?>
                    <?php $inputValue = valuation_input_value($player, $vote, $field); ?>
                    <td class="valuation-stat-cell px-1.5 py-2 text-center" data-label="<?= h($labels[$field] ?? $field) ?>">
                      <div class="valuation-stepper">
                        <button class="valuation-step-button" type="button" data-valuation-step="-1" aria-label="Bajar <?= h($labels[$field] ?? $field) ?>">-</button>
                        <input
                          class="valuation-stat-input h-9 w-16 rounded-md border border-[#c9d8d1] bg-white px-2 text-center text-sm font-black text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60"
                          type="number"
                          min="0"
                          max="99"
                          step="1"
                          name="stats[<?= $playerId ?>][<?= h($field) ?>]"
                          value="<?= h($inputValue) ?>"
                          inputmode="numeric"
                          data-stat-field="<?= h($field) ?>"
                          data-initial-value="<?= h($inputValue) ?>"
                        >
                        <button class="valuation-step-button" type="button" data-valuation-step="1" aria-label="Subir <?= h($labels[$field] ?? $field) ?>">+</button>
                      </div>
                    </td>
                  <?php endforeach; ?>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </section>

      <div class="valuation-actions flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm">
        <p class="m-0 text-xs font-bold text-[#526b62]">Guardar recalcula los promedios generales usando solo valoraciones cargadas.</p>
        <button class="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#063d2b] bg-[#063d2b] px-4 text-sm font-black text-white hover:bg-[#082f23]" type="submit">Guardar valoraciones</button>
      </div>
    </form>
  <?php endif; ?>
</section>

<script>
const valuationPositionWeights = <?= $positionWeightsJson ?>;
const valuationAnchors = [
  [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
  [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
  [5.2, 93], [5.3, 94], [6.0, 99],
];

function valuationNormalizeInternal(value, fallback = 3.0) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return Math.max(1.0, Math.min(6.0, Math.round(numeric * 10) / 10));
}

function valuationInternalFromOverall(value) {
  const overall = Math.max(0, Math.min(99, Number(value) || 0));
  if (overall <= 35) {
    return 1.0;
  }
  for (let index = 0; index < valuationAnchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = valuationAnchors[index];
    const [toRating, toOverall] = valuationAnchors[index + 1];
    if (overall <= toOverall) {
      const ratio = (overall - fromOverall) / (toOverall - fromOverall);
      return valuationNormalizeInternal(fromRating + ((toRating - fromRating) * ratio));
    }
  }
  return 6.0;
}

function valuationOverallFromInternal(value) {
  const rating = valuationNormalizeInternal(value);
  for (let index = 0; index < valuationAnchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = valuationAnchors[index];
    const [toRating, toOverall] = valuationAnchors[index + 1];
    if (rating <= toRating) {
      const ratio = (rating - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 99;
}

function valuationRecalculateRow(row) {
  const output = row.querySelector('.valuation-general-value');
  if (!output) {
    return;
  }
  const position = String(row.getAttribute('data-primary-position') || 'MED').toUpperCase();
  const weights = valuationPositionWeights[position] || valuationPositionWeights.MED || {};
  let total = 0;
  let usedWeight = 0;
  row.querySelectorAll('.valuation-stat-input[data-stat-field]').forEach((input) => {
    const field = input.getAttribute('data-stat-field');
    const weight = Number(weights[field] || 0);
    if (weight <= 0) {
      return;
    }
    total += valuationInternalFromOverall(input.value) * weight;
    usedWeight += weight;
  });
  if (usedWeight <= 0) {
    return;
  }
  const regularityInput = row.querySelector('.valuation-stat-input[data-stat-field="regularity"]');
  const regularity = regularityInput ? valuationInternalFromOverall(regularityInput.value) : 3.5;
  const adjusted = Math.max(1.0, Math.min(6.0, (total / usedWeight) * (1 + ((regularity - 3.5) / 50))));
  const nextGeneral = valuationOverallFromInternal(Math.round(adjusted * 10) / 10);
  output.textContent = String(nextGeneral);
  output.classList.toggle('is-live-changed', nextGeneral !== Number(output.getAttribute('data-general-initial') || nextGeneral));
}

function valuationUpdateInputState(input) {
  if (!input) {
    return;
  }
  const initial = String(input.getAttribute('data-initial-value') ?? '');
  const current = String(input.value ?? '');
  const isChanged = current !== initial;
  const cell = input.closest('.valuation-stat-cell');
  const row = input.closest('[data-valuation-player-row]');
  input.classList.toggle('is-stat-changed', isChanged);
  if (cell) {
    cell.classList.toggle('is-stat-changed', isChanged);
  }
  if (row) {
    row.classList.toggle('has-stat-changes', row.querySelector('.valuation-stat-input.is-stat-changed') !== null);
  }
}

function valuationUpdateAllInputStates() {
  document.querySelectorAll('.valuation-stat-input').forEach(valuationUpdateInputState);
}

function valuationRecalculateAll() {
  document.querySelectorAll('[data-valuation-player-row]').forEach(valuationRecalculateRow);
}

document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-valuation-step]');
  if (!button) {
    return;
  }
  const stepper = button.closest('.valuation-stepper');
  const input = stepper ? stepper.querySelector('.valuation-stat-input') : null;
  if (!input) {
    return;
  }
  const step = Number(button.getAttribute('data-valuation-step')) || 0;
  const min = Number(input.getAttribute('min') || 0);
  const max = Number(input.getAttribute('max') || 99);
  const current = input.value === '' ? min : Number(input.value);
  const next = Math.max(min, Math.min(max, Math.round(current + step)));
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

document.addEventListener('input', function (event) {
  const input = event.target.closest('.valuation-stat-input');
  const row = input ? input.closest('[data-valuation-player-row]') : null;
  if (row) {
    valuationUpdateInputState(input);
    valuationRecalculateRow(row);
  }
});

document.addEventListener('DOMContentLoaded', function () {
  valuationUpdateAllInputStates();
  valuationRecalculateAll();
});
</script>

<?php require __DIR__ . '/includes/footer.php'; ?>
