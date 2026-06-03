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
                <th class="px-3 py-2 text-left">Comentarios</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($players as $player): ?>
                <?php
                  $playerId = (int) $player['id'];
                  $vote = $votes[$playerId] ?? [];
                ?>
                <tr class="border-t border-[#d7e6df]">
                  <td class="valuation-player-cell sticky left-0 z-10 bg-white px-3 py-2" data-label="Jugador">
                    <strong class="block text-[#07130f]"><?= h((string) $player['name']) ?></strong>
                    <small class="font-bold text-[#526b62]">Actual GEN <?= h((string) director_stat_0_99_from_internal(player_overall_rating($player))) ?></small>
                  </td>
                  <td class="valuation-position-cell px-3 py-2 font-bold text-[#526b62]" data-label="Posiciones"><?= h((string) $player['positions']) ?></td>
                  <?php foreach ($fields as $field): ?>
                    <td class="valuation-stat-cell px-1.5 py-2 text-center" data-label="<?= h($labels[$field] ?? $field) ?>">
                      <input
                        class="valuation-stat-input h-9 w-16 rounded-md border border-[#c9d8d1] bg-white px-2 text-center text-sm font-black text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60"
                        type="number"
                        min="0"
                        max="99"
                        step="1"
                        name="stats[<?= $playerId ?>][<?= h($field) ?>]"
                        value="<?= h(valuation_input_value($player, $vote, $field)) ?>"
                        inputmode="numeric"
                      >
                    </td>
                  <?php endforeach; ?>
                  <td class="valuation-comment-cell px-3 py-2" data-label="Comentarios">
                    <input
                      class="valuation-comment-input h-9 w-64 rounded-md border border-[#c9d8d1] bg-white px-2 text-sm font-semibold text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60"
                      type="text"
                      name="stats[<?= $playerId ?>][comments]"
                      value="<?= h((string) ($vote['comments'] ?? '')) ?>"
                      placeholder="Opcional"
                    >
                  </td>
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

<?php require __DIR__ . '/includes/footer.php'; ?>
