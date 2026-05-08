<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/directivos.php';
require_once __DIR__ . '/config.php';

$next = (string) ($_GET['next'] ?? $_POST['next'] ?? 'editar_partidos.php');
if (
    $next === ''
    || str_contains($next, "\n")
    || str_contains($next, "\r")
    || str_starts_with($next, '//')
    || parse_url($next, PHP_URL_SCHEME) !== null
    || parse_url($next, PHP_URL_HOST) !== null
) {
    $next = 'editar_partidos.php';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    ensure_directivos_schema();
    $role = (string) ($_POST['role'] ?? 'admin');
    $name = trim((string) ($_POST['name'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    $showGenericError = true;
    if ($role === 'admin' && hash_equals(ADMIN_PASSWORD, $password)) {
        $_SESSION['is_admin'] = true;
        unset($_SESSION['directivo_id'], $_SESSION['directivo_name'], $_SESSION['pending_directivo_id'], $_SESSION['pending_directivo_name']);
        flash('success', 'Ingreso admin correcto.');
        redirect($next);
    }
    if ($role === 'directivo' && $name !== '') {
        $member = directive_member_by_name($name);
        if ($member && (int) $member['active'] === 1 && password_verify($password, (string) $member['password_hash'])) {
            if ((int) ($member['password_needs_setup'] ?? 0) === 1) {
                unset($_SESSION['is_admin'], $_SESSION['directivo_id'], $_SESSION['directivo_name']);
                $_SESSION['pending_directivo_id'] = (int) $member['id'];
                $_SESSION['pending_directivo_name'] = (string) $member['name'];
                flash('info', 'Cambia tu clave para terminar el ingreso.');
                redirect('login.php?change_directivo_password=1');
            }
            unset($_SESSION['is_admin']);
            unset($_SESSION['pending_directivo_id'], $_SESSION['pending_directivo_name']);
            $_SESSION['directivo_id'] = (int) $member['id'];
            $_SESSION['directivo_name'] = (string) $member['name'];
            flash('success', 'Ingreso directivo correcto.');
            $directivoNext = str_contains($next, 'junta_votaciones.php') ? $next : 'junta_votaciones.php';
            redirect($directivoNext);
        }
    }
    if ($role === 'directivo_change_password') {
        $showGenericError = false;
        $newPassword = (string) ($_POST['new_password'] ?? '');
        $confirmPassword = (string) ($_POST['confirm_password'] ?? '');
        $pendingId = (int) ($_SESSION['pending_directivo_id'] ?? 0);
        $member = $pendingId > 0 ? directive_member_by_id($pendingId) : null;
        if (!$member || (int) $member['active'] !== 1 || (int) ($member['password_needs_setup'] ?? 0) !== 1) {
            unset($_SESSION['pending_directivo_id'], $_SESSION['pending_directivo_name']);
            flash('error', 'Primero ingresa con tu usuario y la clave 1234.');
        } elseif (strlen($newPassword) < 6) {
            flash('error', 'La clave debe tener al menos 6 caracteres.');
        } elseif (hash_equals('1234', $newPassword)) {
            flash('error', 'La clave nueva no puede ser 1234.');
        } elseif (!hash_equals($newPassword, $confirmPassword)) {
            flash('error', 'Las claves nuevas no coinciden.');
        } else {
            $stmt = db()->prepare(
                'UPDATE directive_members
                 SET password_hash = :password_hash,
                     password_needs_setup = 0
                 WHERE id = :id'
            );
            $stmt->execute([
                'id' => (int) $member['id'],
                'password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
            ]);
            unset($_SESSION['is_admin']);
            unset($_SESSION['pending_directivo_id'], $_SESSION['pending_directivo_name']);
            $_SESSION['directivo_id'] = (int) $member['id'];
            $_SESSION['directivo_name'] = (string) $member['name'];
            flash('success', 'Clave actualizada. Ingreso directivo correcto.');
            redirect('junta_votaciones.php');
        }
    }
    if ($role === 'guest_vote_token') {
        $showGenericError = false;
        $token = trim((string) ($_POST['vote_token'] ?? ''));
        $invite = directive_vote_invite_by_token($token);
        $match = $invite ? repo_match_by_id((int) $invite['match_id']) : null;
        if (!$invite || !$match || !directive_voting_is_open($match)) {
            flash('error', 'Token de votacion invalido o vencido.');
        } else {
            unset($_SESSION['is_admin'], $_SESSION['directivo_id'], $_SESSION['directivo_name']);
            $_SESSION['guest_vote_invite_id'] = (int) $invite['id'];
            $_SESSION['guest_vote_match_id'] = (int) $invite['match_id'];
            $_SESSION['guest_vote_voter_id'] = (int) $invite['voter_member_id'];
            $_SESSION['guest_vote_name'] = (string) $invite['player_name'];
            flash('success', 'Ingreso a votacion correcto.');
            redirect('junta_votaciones.php?match_id=' . (int) $invite['match_id']);
        }
    }
    if ($showGenericError) {
        flash('error', $role === 'directivo' ? 'Nombre o clave directivo incorrectos.' : 'Clave admin incorrecta.');
    }
}

$title = 'Ingreso | ' . APP_NAME;
$activePage = 'login.php';
$pendingDirectivoName = (string) ($_SESSION['pending_directivo_name'] ?? '');
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Ingreso</h1>
    <p class="small-muted">Elegí el acceso correcto. Admin gestiona todo; directivo solo vota puntajes y premios.</p>
  </div>
  <a class="btn btn-muted" href="index.php">Volver al inicio</a>
</section>

<nav class="login-choice-strip" aria-label="Accesos rapidos">
  <a href="#login-admin">Admin</a>
  <a href="#login-directivo">Directivo</a>
  <a href="#login-invitado">Invitado</a>
</nav>

<section class="login-access-grid grid gap-3 md:grid-cols-2">
  <article id="login-admin" class="card border-lime-200/55 bg-emerald-950 scroll-mt-20">
    <div class="mb-3">
      <span class="chip mb-2 inline-flex w-fit bg-lime-100 text-emerald-950">Admin</span>
      <h3 class="mb-1">Panel administrador</h3>
      <p class="small-muted">Entrá por acá para crear fechas, editar jugadores, administrar directivos, backups y resultados.</p>
    </div>
    <form method="post" class="grid gap-3">
      <input type="hidden" name="next" value="<?= h($next) ?>">
      <input type="hidden" name="role" value="admin">
      <div class="form-row">
        <label>Clave admin</label>
        <div class="password-field">
          <input id="adminPassword" class="login-input" type="password" name="password" required autofocus autocomplete="current-password" placeholder="Clave del administrador">
          <button class="password-toggle" type="button" data-password-toggle="adminPassword" aria-pressed="false">Ver</button>
        </div>
      </div>
      <button class="btn btn-primary w-full" type="submit">Entrar como admin</button>
    </form>
  </article>

  <article id="login-directivo" class="card bg-emerald-900/35 scroll-mt-20">
    <div class="mb-3">
      <span class="chip mb-2 inline-flex w-fit">Directivo</span>
      <h3 class="mb-1">Junta de votación</h3>
      <p class="small-muted">Usá este acceso solo si el admin te creó como directivo. Sirve para votar partidos finalizados.</p>
    </div>
    <form method="post" class="grid gap-3">
    <input type="hidden" name="next" value="<?= h($next) ?>">
      <input type="hidden" name="role" value="directivo">
    <div class="form-row">
      <label>Nombre directivo</label>
        <input class="login-input" type="text" name="name" autocomplete="username" placeholder="Nombre asignado por admin" required>
    </div>
    <div class="form-row">
        <label>Clave directivo</label>
        <div class="password-field">
          <input id="directivoPassword" class="login-input" type="password" name="password" autocomplete="current-password" placeholder="Clave del directivo" required>
          <button class="password-toggle" type="button" data-password-toggle="directivoPassword" aria-pressed="false">Ver</button>
        </div>
    </div>
      <button class="btn btn-muted w-full" type="submit">Entrar como directivo</button>
  </form>
  </article>
</section>

<section id="login-invitado" class="card mt-3 scroll-mt-20">
  <div class="mb-3">
    <span class="chip mb-2 inline-flex w-fit">Quiero votar</span>
    <h3 class="mb-1">Ingreso por invitación</h3>
    <p class="small-muted">Si recibiste un token de 5 cifras para una fecha, ingresalo aca para votar puntajes y premios.</p>
  </div>
  <form method="post" class="form-grid">
    <input type="hidden" name="role" value="guest_vote_token">
    <div class="form-row">
      <label>Token de votación</label>
      <input class="login-input" type="text" name="vote_token" inputmode="numeric" maxlength="5" pattern="\d{5}" autocomplete="one-time-code" placeholder="12345" required>
    </div>
    <button class="btn btn-primary w-full" type="submit">Quiero votar</button>
  </form>
</section>

<?php if ($pendingDirectivoName !== ''): ?>
  <section class="card mt-3">
    <div class="mb-3">
      <span class="chip mb-2 inline-flex w-fit">Cambio obligatorio</span>
      <h3 class="mb-1">Crear clave privada</h3>
      <p class="small-muted"><?= h($pendingDirectivoName) ?> ingreso con la clave inicial 1234. Para continuar debe guardar una clave nueva.</p>
    </div>
    <form method="post" class="form-grid">
      <input type="hidden" name="role" value="directivo_change_password">
      <div class="form-row">
        <label>Nueva clave privada</label>
        <div class="password-field">
          <input id="newDirectivoPassword" class="login-input" type="password" name="new_password" autocomplete="new-password" minlength="6" placeholder="Minimo 6 caracteres" required>
          <button class="password-toggle" type="button" data-password-toggle="newDirectivoPassword" aria-pressed="false">Ver</button>
        </div>
      </div>
      <div class="form-row">
        <label>Repetir clave privada</label>
        <div class="password-field">
          <input id="confirmDirectivoPassword" class="login-input" type="password" name="confirm_password" autocomplete="new-password" minlength="6" placeholder="Repetir clave" required>
          <button class="password-toggle" type="button" data-password-toggle="confirmDirectivoPassword" aria-pressed="false">Ver</button>
        </div>
      </div>
      <button class="btn btn-primary w-full" type="submit">Guardar clave</button>
    </form>
  </section>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
