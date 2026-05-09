<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/directivos.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/config.php';

function safe_login_next(string $value): string
{
    if (
        $value === ''
        || str_contains($value, "\n")
        || str_contains($value, "\r")
        || str_starts_with($value, '//')
        || parse_url($value, PHP_URL_SCHEME) !== null
        || parse_url($value, PHP_URL_HOST) !== null
    ) {
        return 'index.php';
    }
    return $value;
}

function site_user_redirect(array $user, string $next): string
{
    $role = (string) ($user['role'] ?? 'usuario');
    if ($next !== 'editar_partidos.php' && $next !== 'index.php') {
        return $next;
    }
    return match ($role) {
        'admin' => 'editar_partidos.php',
        'directivo' => 'junta_votaciones.php',
        'jugador' => 'perfil.php',
        default => 'index.php',
    };
}

function set_site_user_session(array $user): void
{
    unset(
        $_SESSION['is_admin'],
        $_SESSION['directivo_id'],
        $_SESSION['directivo_name'],
        $_SESSION['pending_directivo_id'],
        $_SESSION['pending_directivo_name'],
        $_SESSION['guest_vote_invite_id'],
        $_SESSION['guest_vote_match_id'],
        $_SESSION['guest_vote_voter_id'],
        $_SESSION['guest_vote_name']
    );

    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['username'] = (string) $user['username'];
    $_SESSION['user_role'] = (string) $user['role'];
    $_SESSION['player_id'] = (int) ($user['player_id'] ?? 0);
    $_SESSION['player_name'] = (string) ($user['player_name'] ?? '');

    if ((string) $user['role'] === 'admin') {
        $_SESSION['is_admin'] = true;
    }

    if ((string) $user['role'] === 'directivo') {
        $member = directive_member_for_site_user(
            (int) $user['id'],
            (string) $user['username'],
            (string) ($user['player_name'] ?? '')
        );
        $_SESSION['directivo_id'] = (int) ($member['id'] ?? 0);
        $_SESSION['directivo_name'] = (string) ($member['name'] ?? $user['username']);
    }
}

function clear_pending_site_password_reset(): void
{
    unset($_SESSION['pending_user_id'], $_SESSION['pending_username'], $_SESSION['pending_user_next']);
}

$next = safe_login_next((string) ($_GET['next'] ?? $_POST['next'] ?? 'index.php'));

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    ensure_auth_schema();
    ensure_directivos_schema();
    $action = (string) ($_POST['role'] ?? 'user_login');
    $password = (string) ($_POST['password'] ?? '');

    if ($action === 'admin_bootstrap') {
        if (hash_equals(ADMIN_PASSWORD, $password)) {
            unset($_SESSION['directivo_id'], $_SESSION['directivo_name'], $_SESSION['pending_directivo_id'], $_SESSION['pending_directivo_name'], $_SESSION['user_id'], $_SESSION['username'], $_SESSION['user_role'], $_SESSION['player_id'], $_SESSION['player_name'], $_SESSION['guest_vote_invite_id']);
            $_SESSION['is_admin'] = true;
            flash('success', 'Ingreso admin correcto.');
            redirect($next === 'index.php' ? 'editar_partidos.php' : $next);
        }
        flash('error', 'Clave admin incorrecta.');
    } elseif ($action === 'site_user_change_password') {
        $pendingId = (int) ($_SESSION['pending_user_id'] ?? 0);
        $newPassword = (string) ($_POST['new_password'] ?? '');
        $confirmPassword = (string) ($_POST['confirm_password'] ?? '');
        $stmt = db()->prepare(
            'SELECT u.*, p.name AS player_name
             FROM site_users u
             LEFT JOIN players p ON p.id = u.player_id
             WHERE u.id = :id
             LIMIT 1'
        );
        $stmt->execute(['id' => $pendingId]);
        $user = $stmt->fetch();
        if (!$user || (int) $user['active'] !== 1 || (int) ($user['password_needs_reset'] ?? 0) !== 1) {
            clear_pending_site_password_reset();
            flash('error', 'Primero ingresa con tu usuario y la clave provisoria.');
        } elseif (strlen($newPassword) < 6) {
            flash('error', 'La clave nueva debe tener al menos 6 caracteres.');
        } elseif (hash_equals('123456', $newPassword)) {
            flash('error', 'La clave nueva no puede ser 123456.');
        } elseif (!hash_equals($newPassword, $confirmPassword)) {
            flash('error', 'Las claves nuevas no coinciden.');
        } else {
            $update = db()->prepare(
                'UPDATE site_users
                 SET password_hash = :password_hash,
                     password_needs_reset = 0
                 WHERE id = :id'
            );
            $update->execute([
                'id' => (int) $user['id'],
                'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            ]);
            $nextAfterChange = safe_login_next((string) ($_SESSION['pending_user_next'] ?? $next));
            clear_pending_site_password_reset();
            $user['password_needs_reset'] = 0;
            set_site_user_session($user);
            flash('success', 'Clave actualizada. Ingreso correcto.');
            redirect(site_user_redirect($user, $nextAfterChange));
        }
    } elseif ($action === 'player_register') {
        $username = trim((string) ($_POST['username'] ?? ''));
        $playerId = (int) ($_POST['player_id'] ?? 0);
        $confirmPassword = (string) ($_POST['confirm_password'] ?? '');
        if (!preg_match('/^[a-zA-Z0-9_.-]{3,80}$/', $username)) {
            flash('error', 'El usuario debe tener 3 a 80 caracteres: letras, numeros, punto, guion o guion bajo.');
        } elseif (strlen($password) < 6) {
            flash('error', 'La clave debe tener al menos 6 caracteres.');
        } elseif (!hash_equals($password, $confirmPassword)) {
            flash('error', 'Las claves no coinciden.');
        } elseif ($playerId <= 0 || !repo_player_by_id($playerId)) {
            flash('error', 'Elige tu jugador de la lista.');
        } else {
            try {
                $stmt = db()->prepare(
                    'INSERT INTO site_users (username, password_hash, role, player_id, can_vote)
                     VALUES (:username, :password_hash, "usuario", :player_id, 0)'
                );
                $stmt->execute([
                    'username' => $username,
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                    'player_id' => $playerId,
                ]);
                $userId = (int) db()->lastInsertId();
                $player = repo_player_by_id($playerId) ?: [];
                set_site_user_session([
                    'id' => $userId,
                    'username' => $username,
                    'role' => 'usuario',
                    'player_id' => $playerId,
                    'player_name' => (string) ($player['name'] ?? ''),
                ]);
                flash('success', 'Cuenta creada. El admin ahora puede asignarte rol de jugador, directivo o admin.');
                redirect('index.php');
            } catch (PDOException $e) {
                $message = str_contains($e->getMessage(), 'uniq_site_users_player')
                    ? 'Ese jugador ya tiene una cuenta vinculada.'
                    : 'Ese usuario ya existe.';
                flash('error', $message);
            }
        }
    } else {
        $username = trim((string) ($_POST['username'] ?? ''));
        if ($username === '' || $password === '') {
            flash('error', 'Completa usuario y clave.');
        } else {
            $stmt = db()->prepare(
                'SELECT u.*, p.name AS player_name
                 FROM site_users u
                 LEFT JOIN players p ON p.id = u.player_id
                 WHERE u.username = :username
                 LIMIT 1'
            );
            $stmt->execute(['username' => $username]);
            $user = $stmt->fetch();
            if ($user && (int) $user['active'] === 1 && password_verify($password, (string) $user['password_hash'])) {
                if ((int) ($user['password_needs_reset'] ?? 0) === 1) {
                    unset($_SESSION['is_admin'], $_SESSION['directivo_id'], $_SESSION['directivo_name'], $_SESSION['user_id'], $_SESSION['username'], $_SESSION['user_role'], $_SESSION['player_id'], $_SESSION['player_name']);
                    $_SESSION['pending_user_id'] = (int) $user['id'];
                    $_SESSION['pending_username'] = (string) $user['username'];
                    $_SESSION['pending_user_next'] = $next;
                    flash('info', 'Crea una clave nueva para continuar.');
                    redirect('login.php?change_password=1');
                }
                clear_pending_site_password_reset();
                set_site_user_session($user);
                flash('success', 'Ingreso correcto. Rol activo: ' . (string) $user['role'] . '.');
                redirect(site_user_redirect($user, $next));
            }
            flash('error', 'Usuario o clave incorrectos.');
        }
    }
}

$title = 'Ingreso | ' . APP_NAME;
$activePage = 'login.php';
ensure_auth_schema();
$pendingUsername = (string) ($_SESSION['pending_username'] ?? '');
$claimedPlayerIds = [];
foreach (db()->query('SELECT player_id FROM site_users WHERE player_id IS NOT NULL')->fetchAll() as $claimedRow) {
    $claimedPlayerIds[(int) $claimedRow['player_id']] = true;
}
$registerPlayers = array_values(array_filter(repo_all_players(true), static fn(array $player): bool => !isset($claimedPlayerIds[(int) $player['id']])));
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Ingreso</h1>
    <p class="small-muted">Una cuenta, permisos segun el rol que asigne el admin.</p>
  </div>
  <a class="btn btn-muted" href="index.php">Volver al inicio</a>
</section>

<section class="login-access-grid mx-auto grid max-w-2xl gap-3">
  <article id="login-jugador" class="card border-lime-200/55 bg-emerald-950 scroll-mt-20">
    <div class="mb-3">
      <span class="chip mb-2 inline-flex w-fit bg-lime-100 text-emerald-950">Cuenta</span>
      <h3 class="mb-1">Entrar al sitio</h3>
      <p class="small-muted">Usa tu usuario. Si sos jugador, directivo o admin, el sistema habilita tus funciones automaticamente.</p>
    </div>
    <form method="post" class="grid gap-3">
      <input type="hidden" name="next" value="<?= h($next) ?>">
      <input type="hidden" name="role" value="user_login">
      <div class="form-row">
        <label>Usuario</label>
        <input class="login-input" type="text" name="username" autocomplete="username" placeholder="tu_usuario" required autofocus>
      </div>
      <div class="form-row">
        <label>Clave</label>
        <div class="password-field">
          <input id="userPassword" class="login-input" type="password" name="password" autocomplete="current-password" placeholder="Tu clave" required>
          <button class="password-toggle" type="button" data-password-toggle="userPassword" aria-pressed="false">Ver</button>
        </div>
      </div>
      <button class="btn btn-primary w-full" type="submit">Entrar como jugador</button>
    </form>

    <details id="registro-jugador" class="mt-3 rounded-xl border border-lime-200/30 bg-emerald-900/45 p-3">
      <summary class="btn btn-muted w-full cursor-pointer list-none text-center [&::-webkit-details-marker]:hidden">Crear cuenta</summary>
      <div class="mt-3">
        <div class="mb-3">
          <h3 class="mb-1">Vincularme a un jugador</h3>
          <p class="small-muted">La cuenta queda creada como usuario. El admin despues activa tu rol y permisos.</p>
        </div>
        <form method="post" class="grid gap-3">
          <input type="hidden" name="role" value="player_register">
          <div class="form-row">
            <label>Mi jugador</label>
            <select class="login-input" name="player_id" required>
              <option value="">Elegir jugador...</option>
              <?php foreach ($registerPlayers as $player): ?>
                <option value="<?= (int) $player['id'] ?>"><?= h((string) $player['name']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="form-row">
            <label>Usuario</label>
            <input class="login-input" type="text" name="username" autocomplete="username" placeholder="tu_usuario" required>
          </div>
          <div class="form-grid">
            <div class="form-row">
              <label>Clave</label>
              <div class="password-field">
                <input id="registerPassword" class="login-input" type="password" name="password" autocomplete="new-password" minlength="6" placeholder="Minimo 6 caracteres" required>
                <button class="password-toggle" type="button" data-password-toggle="registerPassword" aria-pressed="false">Ver</button>
              </div>
            </div>
            <div class="form-row">
              <label>Repetir clave</label>
              <div class="password-field">
                <input id="registerConfirmPassword" class="login-input" type="password" name="confirm_password" autocomplete="new-password" minlength="6" placeholder="Repetir clave" required>
                <button class="password-toggle" type="button" data-password-toggle="registerConfirmPassword" aria-pressed="false">Ver</button>
              </div>
            </div>
          </div>
          <button class="btn btn-primary w-full" type="submit" <?= !$registerPlayers ? 'disabled' : '' ?>>Vincular jugador</button>
          <?php if (!$registerPlayers): ?>
            <p class="small-muted">No quedan jugadores activos disponibles para registrar.</p>
          <?php endif; ?>
        </form>
      </div>
    </details>
  </article>

  <details id="login-admin" class="card scroll-mt-20">
    <summary class="cursor-pointer list-none text-sm font-extrabold text-lime-50 [&::-webkit-details-marker]:hidden">Acceso admin inicial</summary>
    <form method="post" class="mt-3 grid gap-3">
      <input type="hidden" name="next" value="<?= h($next) ?>">
      <input type="hidden" name="role" value="admin_bootstrap">
      <div class="form-row">
        <label>Clave admin global</label>
        <div class="password-field">
          <input id="adminPassword" class="login-input" type="password" name="password" autocomplete="current-password" placeholder="Clave del administrador">
          <button class="password-toggle" type="button" data-password-toggle="adminPassword" aria-pressed="false">Ver</button>
        </div>
      </div>
      <button class="btn btn-muted w-full" type="submit">Entrar como admin</button>
    </form>
  </details>
</section>

<?php if ($pendingUsername !== ''): ?>
  <section class="login-access-grid mx-auto mt-3 grid max-w-2xl gap-3">
    <article class="card border-lime-200/55 bg-emerald-950 scroll-mt-20">
      <div class="mb-3">
        <span class="chip mb-2 inline-flex w-fit bg-lime-100 text-emerald-950">Clave nueva</span>
        <h3 class="mb-1">Actualizar clave</h3>
        <p class="small-muted"><?= h($pendingUsername) ?> ingreso con clave provisoria. Guarda una clave nueva para continuar.</p>
      </div>
      <form method="post" class="grid gap-3">
        <input type="hidden" name="role" value="site_user_change_password">
        <div class="form-grid">
          <div class="form-row">
            <label>Nueva clave</label>
            <div class="password-field">
              <input id="newSiteUserPassword" class="login-input" type="password" name="new_password" autocomplete="new-password" minlength="6" placeholder="Minimo 6 caracteres" required>
              <button class="password-toggle" type="button" data-password-toggle="newSiteUserPassword" aria-pressed="false">Ver</button>
            </div>
          </div>
          <div class="form-row">
            <label>Repetir clave</label>
            <div class="password-field">
              <input id="confirmSiteUserPassword" class="login-input" type="password" name="confirm_password" autocomplete="new-password" minlength="6" placeholder="Repetir clave" required>
              <button class="password-toggle" type="button" data-password-toggle="confirmSiteUserPassword" aria-pressed="false">Ver</button>
            </div>
          </div>
        </div>
        <button class="btn btn-primary w-full" type="submit">Guardar clave nueva</button>
      </form>
    </article>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
