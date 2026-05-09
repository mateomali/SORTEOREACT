<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/directivos.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();
ensure_auth_schema();
ensure_directivos_schema();

function site_user_by_id(int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT u.*, p.name AS player_name
         FROM site_users u
         LEFT JOIN players p ON p.id = u.player_id
         WHERE u.id = :id
         LIMIT 1'
    );
    $stmt->execute(['id' => $id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    try {
        if ($action === 'update_user') {
            $id = (int) ($_POST['id'] ?? 0);
            $username = trim((string) ($_POST['username'] ?? ''));
            $role = (string) ($_POST['user_role'] ?? 'usuario');
            $playerId = (int) ($_POST['player_id'] ?? 0);
            $active = isset($_POST['active']) ? 1 : 0;
            $canVote = isset($_POST['can_vote']) ? 1 : 0;
            if ($id <= 0 || !preg_match('/^[a-zA-Z0-9_.-]{3,80}$/', $username)) {
                throw new RuntimeException('Usuario invalido.');
            }
            if (!in_array($role, ['usuario', 'jugador', 'directivo', 'admin'], true)) {
                throw new RuntimeException('Rol invalido.');
            }
            $playerValue = $playerId > 0 ? $playerId : null;
            if ($playerValue !== null && !repo_player_by_id($playerValue)) {
                throw new RuntimeException('Jugador invalido.');
            }

            $stmt = db()->prepare(
                'UPDATE site_users
                 SET username = :username,
                     role = :role,
                     player_id = :player_id,
                     can_vote = :can_vote,
                     active = :active
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'username' => $username,
                'role' => $role,
                'player_id' => $playerValue,
                'can_vote' => $canVote,
                'active' => $active,
            ]);

            $updated = site_user_by_id($id) ?: [];
            if ($role === 'directivo' && $active === 1) {
                directive_member_for_site_user($id, $username, (string) ($updated['player_name'] ?? ''));
            } else {
                $disable = db()->prepare('UPDATE directive_members SET active = 0 WHERE site_user_id = :site_user_id');
                $disable->execute(['site_user_id' => $id]);
            }

            flash('success', 'Usuario actualizado.');
        } elseif ($action === 'reset_user_password') {
            $id = (int) ($_POST['id'] ?? 0);
            $user = $id > 0 ? site_user_by_id($id) : null;
            if (!$user) {
                throw new RuntimeException('Usuario invalido.');
            }
            $stmt = db()->prepare(
                'UPDATE site_users
                 SET password_hash = :password_hash,
                     password_needs_reset = 1
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => $id,
                'password_hash' => password_hash('123456', PASSWORD_DEFAULT),
            ]);
            flash('success', 'Clave reiniciada para ' . (string) $user['username'] . '. Clave provisoria: 123456.');
        } elseif ($action === 'unlink_user_player') {
            $id = (int) ($_POST['id'] ?? 0);
            $user = $id > 0 ? site_user_by_id($id) : null;
            if (!$user) {
                throw new RuntimeException('Usuario invalido.');
            }
            if (empty($user['player_id'])) {
                throw new RuntimeException('Esta cuenta no tiene jugador vinculado.');
            }
            $stmt = db()->prepare(
                'UPDATE site_users
                 SET player_id = NULL,
                     role = CASE WHEN role = "jugador" THEN "usuario" ELSE role END,
                     can_vote = 0
                 WHERE id = :id'
            );
            $stmt->execute(['id' => $id]);
            flash('success', 'Jugador desvinculado de la cuenta ' . (string) $user['username'] . '.');
        } elseif ($action === 'delete_user') {
            $id = (int) ($_POST['id'] ?? 0);
            $user = $id > 0 ? site_user_by_id($id) : null;
            if (!$user) {
                throw new RuntimeException('Usuario invalido.');
            }
            if ($id === current_user_id()) {
                throw new RuntimeException('No podes eliminar la cuenta con la que estas logueado.');
            }
            $pdo = db();
            $pdo->beginTransaction();
            try {
                $detachDirectivo = $pdo->prepare(
                    'UPDATE directive_members
                     SET site_user_id = NULL,
                         active = 0
                     WHERE site_user_id = :site_user_id'
                );
                $detachDirectivo->execute(['site_user_id' => $id]);
                $delete = $pdo->prepare('DELETE FROM site_users WHERE id = :id');
                $delete->execute(['id' => $id]);
                $pdo->commit();
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                throw $e;
            }
            flash('success', 'Cuenta eliminada: ' . (string) $user['username'] . '.');
        }
    } catch (PDOException $e) {
        $message = str_contains($e->getMessage(), 'uniq_site_users_player')
            ? 'Ese jugador ya esta vinculado a otro usuario.'
            : 'Ese nombre de usuario ya existe.';
        flash('error', $message);
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('usuarios.php');
}

$users = db()->query(
    'SELECT u.*, p.name AS player_name
     FROM site_users u
     LEFT JOIN players p ON p.id = u.player_id
     ORDER BY u.active DESC, FIELD(u.role, "admin", "directivo", "jugador", "usuario"), u.username ASC'
)->fetchAll();
$players = repo_all_players(false);
$claimedByPlayer = [];
foreach ($users as $user) {
    if (!empty($user['player_id'])) {
        $claimedByPlayer[(int) $user['player_id']] = (int) $user['id'];
    }
}
$roleLabels = [
    'usuario' => 'Usuario',
    'jugador' => 'Jugador',
    'directivo' => 'Directivo',
    'admin' => 'Admin',
];
$activeCount = count(array_filter($users, static fn(array $user): bool => (int) $user['active'] === 1));
$playerRoleCount = count(array_filter($users, static fn(array $user): bool => (string) $user['role'] === 'jugador'));
$voteCount = count(array_filter($users, static fn(array $user): bool => (int) ($user['can_vote'] ?? 0) === 1));

$title = 'Usuarios | ' . APP_NAME;
$activePage = 'usuarios.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head directivos-page-head">
  <div>
    <h1>Usuarios</h1>
    <p class="small-muted">Asigna roles y permisos a las cuentas registradas.</p>
  </div>
  <a class="btn btn-muted" href="editar_partidos.php">Volver</a>
</section>

<section class="directivos-summary mb-3">
  <div class="directivos-stat">
    <span>Total</span>
    <strong><?= h((string) count($users)) ?></strong>
  </div>
  <div class="directivos-stat">
    <span>Activos</span>
    <strong><?= h((string) $activeCount) ?></strong>
  </div>
  <div class="directivos-stat">
    <span>Jugadores</span>
    <strong><?= h((string) $playerRoleCount) ?></strong>
  </div>
  <div class="directivos-stat">
    <span>Habilitados voto</span>
    <strong><?= h((string) $voteCount) ?></strong>
  </div>
</section>

<section class="card directivos-list-card">
  <div class="directivos-list-head">
    <div>
      <h3>Cuentas del sitio</h3>
      <p class="small-muted">Una cuenta puede estar vinculada a un jugador y tener rol usuario, jugador, directivo o admin.</p>
    </div>
  </div>
  <?php if (!$users): ?>
    <p class="small-muted">Todavia no hay cuentas creadas.</p>
  <?php else: ?>
    <div class="directivos-grid">
      <?php foreach ($users as $user): ?>
        <?php
          $userId = (int) $user['id'];
          $role = (string) $user['role'];
          $isActive = (int) $user['active'] === 1;
          $linkedPlayerId = (int) ($user['player_id'] ?? 0);
        ?>
        <form method="post" class="directivo-card">
          <input type="hidden" name="id" value="<?= $userId ?>">
          <div class="directivo-card-head">
            <div class="directivo-avatar" aria-hidden="true"><?= h(strtoupper(substr((string) $user['username'], 0, 1))) ?></div>
            <div>
              <strong><?= h((string) $user['username']) ?></strong>
              <small><?= $linkedPlayerId > 0 ? h((string) $user['player_name']) : 'Sin jugador vinculado' ?></small>
            </div>
            <span class="directivo-status <?= $isActive ? 'is-active' : 'is-inactive' ?>"><?= h($roleLabels[$role] ?? $role) ?></span>
          </div>
          <div class="directivo-fields">
            <div class="form-row">
              <label>Usuario</label>
              <input type="text" name="username" value="<?= h((string) $user['username']) ?>" required>
            </div>
            <div class="form-row">
              <label>Rol</label>
              <select name="user_role" required>
                <?php foreach ($roleLabels as $value => $label): ?>
                  <option value="<?= h($value) ?>" <?= selected_attr($role === $value) ?>><?= h($label) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <div class="form-row">
              <label>Jugador vinculado</label>
              <select name="player_id">
                <option value="">Sin jugador</option>
                <?php foreach ($players as $player): ?>
                  <?php
                    $playerId = (int) $player['id'];
                    $claimedByOther = isset($claimedByPlayer[$playerId]) && $claimedByPlayer[$playerId] !== $userId;
                  ?>
                  <option value="<?= $playerId ?>" <?= selected_attr($linkedPlayerId === $playerId) ?> <?= $claimedByOther ? 'disabled' : '' ?>>
                    <?= h((string) $player['name']) ?><?= $claimedByOther ? ' (ocupado)' : '' ?>
                  </option>
                <?php endforeach; ?>
              </select>
            </div>
            <label class="directivo-switch">
              <input type="checkbox" name="active" value="1" <?= checked_attr($isActive) ?>>
              <span>Cuenta activa</span>
            </label>
            <label class="directivo-switch">
              <input type="checkbox" name="can_vote" value="1" <?= checked_attr((int) ($user['can_vote'] ?? 0) === 1) ?>>
              <span>Puede votar premios y puntajes</span>
            </label>
          </div>
          <div class="directivo-meta">
            <span class="badge <?= $isActive ? 'done' : 'warn' ?>"><?= $isActive ? 'Activo' : 'Bloqueado' ?></span>
            <?php if ((int) ($user['password_needs_reset'] ?? 0) === 1): ?>
              <span class="badge warn">Debe cambiar clave</span>
            <?php endif; ?>
            <span class="small-muted">Creado <?= h(date('d/m/Y', strtotime((string) $user['created_at']))) ?></span>
          </div>
          <div class="directivo-actions">
            <button class="btn btn-primary" type="submit" name="action" value="update_user">Guardar</button>
            <button class="btn btn-muted" type="submit" name="action" value="reset_user_password" data-confirm="Reiniciar la clave de <?= h((string) $user['username']) ?> a 123456? En el proximo ingreso debera cambiarla.">Reset clave</button>
            <button class="btn btn-warning" type="submit" name="action" value="unlink_user_player" <?= $linkedPlayerId <= 0 ? 'disabled' : '' ?> data-confirm="Desvincular a <?= h((string) ($user['player_name'] ?? '')) ?> de la cuenta <?= h((string) $user['username']) ?>?">Desvincular jugador</button>
            <button class="btn btn-danger" type="submit" name="action" value="delete_user" <?= $userId === current_user_id() ? 'disabled' : '' ?> data-confirm="Eliminar definitivamente la cuenta <?= h((string) $user['username']) ?>?">Eliminar cuenta</button>
          </div>
        </form>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
