<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
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
    $password = (string) ($_POST['password'] ?? '');
    if (hash_equals(ADMIN_PASSWORD, $password)) {
        $_SESSION['is_admin'] = true;
        flash('success', 'Ingreso admin correcto.');
        redirect($next);
    }
    flash('error', 'Clave admin incorrecta.');
}

$title = 'Admin | ' . APP_NAME;
$activePage = 'login.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Ingreso admin</h1>
    <p class="small-muted">Acceso para administrar jugadores, partidos, capitanes y resultados.</p>
  </div>
  <a class="btn btn-muted" href="index.php">Volver al inicio</a>
</section>

<section class="card">
  <form method="post" class="form-grid">
    <input type="hidden" name="next" value="<?= h($next) ?>">
    <div class="form-row">
      <label>Clave admin</label>
      <input type="password" name="password" required autofocus>
    </div>
    <div class="btn-row">
      <button class="btn btn-primary" type="submit">Ingresar</button>
    </div>
  </form>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
