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
    $name = trim((string) ($_POST['name'] ?? ''));
    $password = (string) ($_POST['password'] ?? '');
    if ($name === '' && hash_equals(ADMIN_PASSWORD, $password)) {
        $_SESSION['is_admin'] = true;
        unset($_SESSION['directivo_id'], $_SESSION['directivo_name']);
        flash('success', 'Ingreso admin correcto.');
        redirect($next);
    }
    if ($name !== '') {
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
    flash('error', $name === '' ? 'Clave admin incorrecta.' : 'Nombre o clave directivo incorrectos.');
}

$title = 'Ingreso | ' . APP_NAME;
$activePage = 'login.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Ingreso</h1>
    <p class="small-muted">Administra el torneo o entra como directivo para votar fechas finalizadas.</p>
  </div>
  <a class="btn btn-muted" href="index.php">Volver al inicio</a>
</section>

<section class="card">
  <form method="post" class="form-grid">
    <input type="hidden" name="next" value="<?= h($next) ?>">
    <div class="form-row">
      <label>Nombre directivo</label>
      <input type="text" name="name" autocomplete="username" placeholder="Solo para directivos">
      <small class="small-muted">Dejalo vacio para ingresar como admin.</small>
    </div>
    <div class="form-row">
      <label>Clave</label>
      <input type="password" name="password" required autofocus>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" type="submit">Ingresar</button>
    </div>
  </form>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
