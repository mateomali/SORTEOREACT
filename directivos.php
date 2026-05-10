<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/directivos.php';

require_admin();
ensure_directivos_schema();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    $redirectTo = 'directivos.php';
    try {
        if ($action === 'create_directivo') {
            $name = trim((string) ($_POST['name'] ?? ''));
            $active = isset($_POST['active']) ? 1 : 0;
            if ($name === '') {
                throw new RuntimeException('Completa el nombre del directivo.');
            }
            $stmt = db()->prepare(
                'INSERT INTO directive_members (name, password_hash, password_needs_setup, active)
                 VALUES (:name, :password_hash, 1, :active)'
            );
            $stmt->execute([
                'name' => $name,
                'password_hash' => password_hash('1234', PASSWORD_DEFAULT),
                'active' => $active,
            ]);
            flash('success', 'Directivo creado. Clave inicial: 1234. En el primer ingreso debera cambiarla.');
        } elseif ($action === 'update_directivo') {
            $id = (int) ($_POST['id'] ?? 0);
            $name = trim((string) ($_POST['name'] ?? ''));
            $active = isset($_POST['active']) ? 1 : 0;
            if ($id <= 0 || $name === '') {
                throw new RuntimeException('Directivo invalido.');
            }
            $stmt = db()->prepare(
                'UPDATE directive_members
                 SET name = :name, active = :active
                 WHERE id = :id'
            );
            $stmt->execute(['id' => $id, 'name' => $name, 'active' => $active]);
            flash('success', 'Directivo actualizado.');
        } elseif ($action === 'reset_directivo_password') {
            $id = (int) ($_POST['id'] ?? 0);
            $member = $id > 0 ? directive_member_by_id($id) : null;
            if (!$member) {
                throw new RuntimeException('Directivo invalido.');
            }
            $stmt = db()->prepare(
                'UPDATE directive_members
                 SET password_hash = :password_hash,
                     password_needs_setup = 1
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'password_hash' => password_hash('1234', PASSWORD_DEFAULT),
            ]);
            flash('success', 'Clave reiniciada para ' . (string) $member['name'] . '. Clave inicial: 1234. En el proximo ingreso debera cambiarla.');
        } elseif ($action === 'delete_directivo') {
            $id = (int) ($_POST['id'] ?? 0);
            $member = $id > 0 ? directive_member_by_id($id) : null;
            if (!$member) {
                throw new RuntimeException('Directivo invalido.');
            }
            $stmt = db()->prepare('DELETE FROM directive_members WHERE id = :id');
            $stmt->execute(['id' => $id]);
            flash('success', 'Directivo eliminado: ' . (string) $member['name'] . '.');
        } elseif ($action === 'create_vote_invite') {
            $matchId = (int) ($_POST['match_id'] ?? 0);
            $playerId = (int) ($_POST['player_id'] ?? 0);
            $invite = directive_create_vote_invite($matchId, $playerId);
            flash('success', 'Token para ' . (string) $invite['player_name'] . ': ' . (string) $invite['token']);
            $redirectTo = 'directivos.php#invitar-votantes';
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect($redirectTo);
}

$members = directive_members(false);
$activeCount = count(array_filter($members, static fn(array $member): bool => (int) $member['active'] === 1));
$pendingPasswordCount = count(array_filter($members, static fn(array $member): bool => (int) ($member['password_needs_setup'] ?? 0) === 1));
$finalizedMatches = repo_matches("m.status = 'finalizado'");
$latestFinalizedMatch = $finalizedMatches[0] ?? null;
$voteInviteMatches = ($latestFinalizedMatch && directive_voting_is_open($latestFinalizedMatch))
    ? [$latestFinalizedMatch]
    : [];
$voteInvitePlayers = repo_all_players(true);
$voteInviteRowsByMatch = [];
foreach ($voteInviteMatches as $match) {
    $matchId = (int) $match['id'];
    $participantCount = count(junta_participant_ids_for_directivos(repo_match_participants($matchId)));
    $voteInviteRowsByMatch[$matchId] = directive_vote_invites_for_match($matchId, $participantCount);
}

function junta_participant_ids_for_directivos(array $participants): array
{
    return array_values(array_map(
        static fn(array $p): int => (int) $p['id'],
        array_filter($participants, static fn(array $p): bool => $p['team_number'] !== null)
    ));
}

function directivos_match_label(array $match): string
{
    $title = trim((string) ($match['title'] ?? ''));
    return $title !== '' ? $title : ('Fecha #' . (int) $match['id']);
}

$title = 'Directivos | ' . APP_NAME;
$activePage = 'directivos.php';
$bodyClass = 'page-directivos';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head directivos-page-head">
  <div>
    <h1>Directivos</h1>
    <p class="small-muted">Habilita quienes pueden votar puntajes y premios despues de cada fecha finalizada.</p>
  </div>
  <a class="btn btn-muted" href="editar_partidos.php">Volver</a>
</section>

<section class="directivos-summary mb-3">
  <div class="directivos-stat">
    <span>Total</span>
    <strong><?= h((string) count($members)) ?></strong>
  </div>
  <div class="directivos-stat">
    <span>Habilitados</span>
    <strong><?= h((string) $activeCount) ?></strong>
  </div>
  <div class="directivos-stat <?= $pendingPasswordCount > 0 ? 'is-warning' : '' ?>">
    <span>Claves pendientes</span>
    <strong><?= h((string) $pendingPasswordCount) ?></strong>
  </div>
</section>

<section class="card directivos-create-card mb-3">
  <div>
    <h3>Nuevo directivo</h3>
    <p class="small-muted">Se crea con clave inicial 1234. Al primer ingreso queda obligado a elegir su clave privada.</p>
  </div>
  <form method="post" class="directivos-create-form">
    <input type="hidden" name="action" value="create_directivo">
    <div class="form-row">
      <label>Nombre</label>
      <input type="text" name="name" required autocomplete="off" placeholder="Nombre del directivo">
    </div>
    <label class="directivo-switch">
      <input type="checkbox" name="active" value="1" checked>
      <span>Habilitado para votar</span>
    </label>
    <button class="btn btn-primary" type="submit" data-confirm="Crear este directivo con clave inicial 1234?">Crear directivo</button>
  </form>
</section>

<section id="invitar-votantes" class="card directivos-list-card mb-3">
  <div class="directivos-list-head">
    <div>
      <h3>Invitar jugadores a votar</h3>
      <p class="small-muted">Genera tokens numericos de 5 cifras solo para la ultima fecha finalizada con votacion abierta.</p>
    </div>
  </div>
  <?php if (!$voteInviteMatches): ?>
    <p class="small-muted">No hay votaciones abiertas para generar tokens.</p>
  <?php else: ?>
    <div class="directivos-grid">
      <?php foreach ($voteInviteMatches as $match): ?>
        <?php
          $matchId = (int) $match['id'];
          $inviteRows = $voteInviteRowsByMatch[$matchId] ?? [];
          $invitedPlayerIds = array_flip(array_map(static fn(array $invite): int => (int) $invite['player_id'], $inviteRows));
          $availableInvitePlayers = array_values(array_filter(
              $voteInvitePlayers,
              static fn(array $player): bool => !isset($invitedPlayerIds[(int) $player['id']])
          ));
        ?>
        <article class="directivo-card">
          <div class="directivo-card-head">
            <div class="directivo-avatar" aria-hidden="true">#</div>
            <div>
              <strong><?= h(directivos_match_label($match)) ?></strong>
              <small><?= h(date('d/m/Y H:i', strtotime((string) $match['match_date']))) ?></small>
            </div>
            <span class="directivo-status is-active"><?= h((string) count($inviteRows)) ?> tokens</span>
          </div>
          <?php if ($availableInvitePlayers): ?>
            <form method="post" class="directivos-create-form mb-3">
              <input type="hidden" name="action" value="create_vote_invite">
              <input type="hidden" name="match_id" value="<?= $matchId ?>">
              <div class="form-row">
                <label>Jugador invitado</label>
                <select name="player_id" required>
                  <option value="">Seleccionar jugador</option>
                  <?php foreach ($availableInvitePlayers as $player): ?>
                    <option value="<?= (int) $player['id'] ?>"><?= h((string) $player['name']) ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
              <button class="btn btn-primary" type="submit" data-confirm="Generar token para este jugador y esta votacion?">Generar token</button>
            </form>
          <?php else: ?>
            <p class="small-muted">Todos los jugadores activos ya tienen token para esta votacion.</p>
          <?php endif; ?>
          <?php if (!$inviteRows): ?>
            <p class="small-muted">Todavia no hay invitados para esta votacion.</p>
          <?php else: ?>
            <div class="match-list">
              <?php foreach ($inviteRows as $invite): ?>
                <div class="match-list-item">
                  <span>
                    <strong><?= h((string) $invite['player_name']) ?></strong>
                    <small><span class="badge <?= ((bool) $invite['vote_complete']) ? 'done' : 'warn' ?>"><?= ((bool) $invite['vote_complete']) ? 'Usado' : 'Pendiente' ?></span></small>
                </span>
                <span class="match-list-side">
                  <span class="badge"><?= h((string) $invite['token']) ?></span>
                  <button class="btn btn-muted token-copy-btn" type="button" data-copy-token="<?= h((string) $invite['token']) ?>">Copiar</button>
                </span>
              </div>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </article>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<section class="card directivos-list-card">
  <div class="directivos-list-head">
    <div>
      <h3>Junta habilitada</h3>
      <p class="small-muted">Administra usuarios, estado de voto y reinicio de clave.</p>
    </div>
  </div>
  <?php if (!$members): ?>
    <p class="small-muted">Todavia no hay directivos cargados.</p>
  <?php else: ?>
    <div class="directivos-grid">
      <?php foreach ($members as $member): ?>
        <?php
          $isActive = (int) $member['active'] === 1;
          $needsPassword = (int) ($member['password_needs_setup'] ?? 0) === 1;
        ?>
        <form method="post" class="directivo-card">
          <input type="hidden" name="id" value="<?= (int) $member['id'] ?>">
          <div class="directivo-card-head">
            <div class="directivo-avatar" aria-hidden="true"><?= h(strtoupper(substr((string) $member['name'], 0, 1))) ?></div>
            <div>
              <strong><?= h((string) $member['name']) ?></strong>
              <small><?= $needsPassword ? 'Debe crear su clave privada' : 'Clave privada activa' ?></small>
            </div>
            <span class="directivo-status <?= $isActive ? 'is-active' : 'is-inactive' ?>"><?= $isActive ? 'Habilitado' : 'Deshabilitado' ?></span>
          </div>
          <div class="directivo-fields">
            <div class="form-row">
              <label>Usuario</label>
              <input type="text" name="name" value="<?= h((string) $member['name']) ?>" required>
            </div>
            <label class="directivo-switch">
              <input type="checkbox" name="active" value="1" <?= $isActive ? 'checked' : '' ?>>
              <span>Puede votar</span>
            </label>
          </div>
          <div class="directivo-meta">
            <?php if ($needsPassword): ?>
              <span class="badge warn">Clave pendiente</span>
            <?php else: ?>
              <span class="badge done">Clave creada</span>
            <?php endif; ?>
            <span class="small-muted">Reset: vuelve a 1234</span>
          </div>
          <div class="directivo-actions">
            <button class="btn btn-primary" type="submit" name="action" value="update_directivo">Guardar</button>
            <button class="btn btn-muted" type="submit" name="action" value="reset_directivo_password" data-confirm="Reiniciar clave de <?= h((string) $member['name']) ?>? Volvera a ingresar con 1234 y debera cambiarla.">Reiniciar clave</button>
            <button class="btn btn-danger" type="submit" name="action" value="delete_directivo" data-confirm="Eliminar directivo <?= h((string) $member['name']) ?>? Tambien se eliminaran sus votos cargados.">Eliminar</button>
          </div>
        </form>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
