<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/directivos.php';

require_admin();
ensure_directivos_schema();

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = (string) ($_POST['action'] ?? '');
    try {
        if ($action === 'create_directivo') {
            $name = trim((string) ($_POST['name'] ?? ''));
            $password = (string) ($_POST['password'] ?? '');
            $active = isset($_POST['active']) ? 1 : 0;
            if ($name === '' || $password === '') {
                throw new RuntimeException('Completa nombre y clave del directivo.');
            }
            $stmt = db()->prepare(
                'INSERT INTO directive_members (name, password_hash, active)
                 VALUES (:name, :password_hash, :active)'
            );
            $stmt->execute([
                'name' => $name,
                'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                'active' => $active,
            ]);
            flash('success', 'Directivo creado.');
        } elseif ($action === 'update_directivo') {
            $id = (int) ($_POST['id'] ?? 0);
            $name = trim((string) ($_POST['name'] ?? ''));
            $password = (string) ($_POST['password'] ?? '');
            $active = isset($_POST['active']) ? 1 : 0;
            if ($id <= 0 || $name === '') {
                throw new RuntimeException('Directivo invalido.');
            }
            if ($password !== '') {
                $stmt = db()->prepare(
                    'UPDATE directive_members
                     SET name = :name, password_hash = :password_hash, active = :active
                     WHERE id = :id'
                );
                $stmt->execute([
                    'id' => $id,
                    'name' => $name,
                    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
                    'active' => $active,
                ]);
            } else {
                $stmt = db()->prepare(
                    'UPDATE directive_members
                     SET name = :name, active = :active
                     WHERE id = :id'
                );
                $stmt->execute(['id' => $id, 'name' => $name, 'active' => $active]);
            }
            flash('success', 'Directivo actualizado.');
        }
    } catch (Throwable $e) {
        flash('error', $e->getMessage());
    }
    redirect('directivos.php');
}

$members = directive_members(false);

$title = 'Directivos | ' . APP_NAME;
$activePage = 'directivos.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1>Directivos</h1>
    <p class="small-muted">Habilita quienes pueden votar puntajes y premios despues de cada fecha finalizada.</p>
  </div>
  <a class="btn btn-muted" href="editar_partidos.php">Volver</a>
</section>

<section class="card mb-3">
  <h3>Nuevo directivo</h3>
  <form method="post" class="form-grid">
    <input type="hidden" name="action" value="create_directivo">
    <div class="form-row">
      <label>Nombre</label>
      <input type="text" name="name" required autocomplete="off">
    </div>
    <div class="form-row">
      <label>Clave</label>
      <input type="password" name="password" required autocomplete="new-password">
    </div>
    <label class="chip inline-flex items-center gap-2">
      <input type="checkbox" name="active" value="1" checked>
      <span>Habilitado para votar</span>
    </label>
    <div class="btn-row">
      <button class="btn btn-primary" type="submit">Crear directivo</button>
    </div>
  </form>
</section>

<section class="card">
  <h3>Junta habilitada</h3>
  <?php if (!$members): ?>
    <p class="small-muted">Todavia no hay directivos cargados.</p>
  <?php else: ?>
    <div class="grid cols-2">
      <?php foreach ($members as $member): ?>
        <form method="post" class="card match-detail">
          <input type="hidden" name="action" value="update_directivo">
          <input type="hidden" name="id" value="<?= (int) $member['id'] ?>">
          <div class="form-grid">
            <div class="form-row">
              <label>Nombre</label>
              <input type="text" name="name" value="<?= h((string) $member['name']) ?>" required>
            </div>
            <div class="form-row">
              <label>Nueva clave</label>
              <input type="password" name="password" autocomplete="new-password" placeholder="Sin cambios">
            </div>
            <label class="chip inline-flex items-center gap-2">
              <input type="checkbox" name="active" value="1" <?= (int) $member['active'] === 1 ? 'checked' : '' ?>>
              <span><?= (int) $member['active'] === 1 ? 'Habilitado' : 'Deshabilitado' ?></span>
            </label>
            <div class="btn-row">
              <button class="btn btn-primary" type="submit">Guardar</button>
            </div>
          </div>
        </form>
      <?php endforeach; ?>
    </div>
  <?php endif; ?>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
