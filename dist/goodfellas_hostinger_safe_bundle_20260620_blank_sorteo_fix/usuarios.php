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
        if ($action === 'create_user') {
            $username = trim((string) ($_POST['username'] ?? ''));
            $role = (string) ($_POST['user_role'] ?? 'usuario');
            $playerId = (int) ($_POST['player_id'] ?? 0);
            $active = isset($_POST['active']) ? 1 : 0;
            $canVote = isset($_POST['can_vote']) ? 1 : 0;
            $temporaryPassword = trim((string) ($_POST['temporary_password'] ?? ''));
            if (!preg_match('/^[a-zA-Z0-9_.-]{3,80}$/', $username)) {
                throw new RuntimeException('El usuario debe tener 3 a 80 caracteres: letras, numeros, punto, guion o guion bajo.');
            }
            if (!in_array($role, ['usuario', 'jugador', 'directivo', 'admin'], true)) {
                throw new RuntimeException('Rol invalido.');
            }
            if ($temporaryPassword === '') {
                $temporaryPassword = '123456';
            }
            if (strlen($temporaryPassword) < 6) {
                throw new RuntimeException('La clave provisoria debe tener al menos 6 caracteres.');
            }
            $playerValue = $playerId > 0 ? $playerId : null;
            if ($playerValue !== null && !repo_player_by_id($playerValue)) {
                throw new RuntimeException('Jugador invalido.');
            }
            if ($role === 'jugador' && $playerValue === null) {
                throw new RuntimeException('Para crear un usuario jugador, vincula su jugador correspondiente.');
            }

            $stmt = db()->prepare(
                'INSERT INTO site_users (username, password_hash, password_needs_reset, role, player_id, can_vote, active)
                 VALUES (:username, :password_hash, 1, :role, :player_id, :can_vote, :active)'
            );
            $stmt->execute([
                'username' => $username,
                'password_hash' => password_hash($temporaryPassword, PASSWORD_DEFAULT),
                'role' => $role,
                'player_id' => $playerValue,
                'can_vote' => $canVote,
                'active' => $active,
            ]);
            $userId = (int) db()->lastInsertId();
            $created = site_user_by_id($userId) ?: [];
            if ($role === 'directivo' && $active === 1) {
                directive_member_for_site_user($userId, $username, (string) ($created['player_name'] ?? ''));
            }
            flash('success', 'Usuario creado. Clave provisoria: ' . $temporaryPassword . '.');
        } elseif ($action === 'update_user') {
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
            if ($role === 'jugador' && $playerValue === null) {
                throw new RuntimeException('Para usar rol jugador, vincula su jugador correspondiente.');
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

$userPayloadPlayers = array_map(
    static fn(array $player): array => [
        'id' => (int) $player['id'],
        'name' => (string) $player['name'],
        'claimedBy' => $claimedByPlayer[(int) $player['id']] ?? null,
    ],
    $players
);
$usuariosIslandPayload = [
    'summary' => [
        'total' => count($users),
        'active' => $activeCount,
        'players' => $playerRoleCount,
        'canVote' => $voteCount,
    ],
    'roleLabels' => $roleLabels,
    'players' => $userPayloadPlayers,
    'currentUserId' => current_user_id(),
    'users' => array_map(
        static fn(array $user): array => [
            'id' => (int) $user['id'],
            'username' => (string) $user['username'],
            'role' => (string) $user['role'],
            'roleLabel' => $roleLabels[(string) $user['role']] ?? (string) $user['role'],
            'player_id' => !empty($user['player_id']) ? (int) $user['player_id'] : 0,
            'player_name' => (string) ($user['player_name'] ?? ''),
            'active' => (int) $user['active'] === 1,
            'can_vote' => (int) ($user['can_vote'] ?? 0) === 1,
            'password_needs_reset' => (int) ($user['password_needs_reset'] ?? 0) === 1,
            'created_at' => date('d/m/Y', strtotime((string) $user['created_at'])),
            'initial' => strtoupper(substr((string) $user['username'], 0, 1)),
        ],
        $users
    ),
];

$title = 'Usuarios | ' . APP_NAME;
$activePage = 'usuarios.php';
$bodyClass = 'page-usuarios';
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="usuarios_page">
  <script type="application/json">
    <?= json_encode($usuariosIslandPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
