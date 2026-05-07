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
    if ($role === 'admin' && hash_equals(ADMIN_PASSWORD, $password)) {
        $_SESSION['is_admin'] = true;
        unset($_SESSION['directivo_id'], $_SESSION['directivo_name']);
        flash('success', 'Ingreso admin correcto.');
        redirect($next);
    }
    if ($role === 'directivo' && $name !== '') {
        $member = directive_member_by_name($name);
        if ($member && (int) $member['active'] === 1 && password_verify($password, (string) $member['password_hash'])) {
            unset($_SESSION['is_admin']);
            $_SESSION['directivo_id'] = (int) $member['id'];
            $_SESSION['directivo_name'] = (string) $member['name'];
            flash('success', 'Ingreso directivo correcto.');
            $directivoNext = str_contains($next, 'junta_votaciones.php') ? $next : 'junta_votaciones.php';
            redirect($directivoNext);
        }
    }
    flash('error', $role === 'directivo' ? 'Nombre o clave directivo incorrectos.' : 'Clave admin incorrecta.');
}

$title = 'Ingreso | ' . APP_NAME;
$activePage = 'login.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Ingreso</h1>
    <p class="small-muted">Elegí el acceso correcto. Admin gestiona todo; directivo solo vota puntajes y premios.</p>
  </div>
  <a class="btn btn-muted" href="index.php">Volver al inicio</a>
</section>

<section class="grid gap-3 md:grid-cols-2">
  <article class="card border-lime-200/55 bg-emerald-950">
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
        <input type="password" name="password" required autofocus autocomplete="current-password" placeholder="Clave del administrador">
      </div>
      <button class="btn btn-primary w-full" type="submit">Entrar como admin</button>
    </form>
  </article>

  <article class="card bg-emerald-900/35">
    <div class="mb-3">
      <span class="chip mb-2 inline-flex w-fit">Directivo</span>
      <h3 class="mb-1">Junta de votacion</h3>
      <p class="small-muted">Usá este acceso solo si el admin te creó como directivo. Sirve para votar partidos finalizados.</p>
    </div>
    <form method="post" class="grid gap-3">
    <input type="hidden" name="next" value="<?= h($next) ?>">
      <input type="hidden" name="role" value="directivo">
    <div class="form-row">
      <label>Nombre directivo</label>
        <input type="text" name="name" autocomplete="username" placeholder="Nombre asignado por admin">
    </div>
    <div class="form-row">
        <label>Clave directivo</label>
        <input type="password" name="password" autocomplete="current-password" placeholder="Clave del directivo">
    </div>
      <button class="btn btn-muted w-full" type="submit">Entrar como directivo</button>
  </form>
  </article>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
