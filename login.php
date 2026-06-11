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

    if ($action === 'cancel_site_user_change_password') {
        clear_pending_site_password_reset();
        flash('info', 'Podes ingresar con otro usuario.');
        redirect('login.php');
    } elseif ($action === 'admin_bootstrap') {
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
        } elseif (strlen($newPassword) < 4) {
            flash('error', 'La clave nueva debe tener al menos 4 caracteres.');
        } elseif (in_array($newPassword, ['1234', '123456'], true)) {
            flash('error', 'La clave nueva no puede ser la clave provisoria.');
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
                     VALUES (:username, :password_hash, "jugador", :player_id, 1)'
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
                    'role' => 'jugador',
                    'player_id' => $playerId,
                    'player_name' => (string) ($player['name'] ?? ''),
                ]);
                flash('success', 'Cuenta creada. Ingresaste como jugador.');
                redirect(site_user_redirect(['role' => 'jugador'], $next));
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
$bodyClass = 'login-tailwind';
$loginPanelClass = 'mx-auto w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/15 bg-white text-[#07130f] shadow-sm shadow-emerald-950/10';
$loginPanelHeadClass = 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 border-b border-emerald-900/20 bg-emerald-950 px-3 py-2.5 text-lime-50';
$loginRatingClass = 'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-lime-100 text-sm font-black leading-none text-[#07130f]';
$loginTitleClass = 'mb-0 text-base font-black leading-tight text-[#07130f]';
$loginHelpClass = 'text-[13px] font-semibold leading-snug text-slate-500';
$loginLabelClass = 'mb-1 block text-xs font-black leading-tight text-[#07130f]';
$loginInputClass = 'h-10 w-full rounded-lg border border-emerald-900/25 bg-white px-3 text-sm font-bold text-[#07130f] outline-none placeholder:text-slate-500/70 placeholder:font-semibold focus:border-emerald-800 focus:ring-4 focus:ring-emerald-900/10 max-[760px]:h-9 max-[760px]:text-[13px]';
$passwordInputClass = $loginInputClass;
$passwordFieldClass = 'grid grid-cols-[minmax(0,1fr)_40px] items-stretch gap-1.5';
$passwordToggleClass = 'inline-flex h-10 items-center justify-center rounded-lg border border-emerald-900/15 bg-emerald-50 text-[#07130f] hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-900/15 max-[760px]:h-9';
$passwordToggleIcon = '<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>';
$loginSubmitClass = 'inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-950 px-3 text-sm font-black text-white transition hover:bg-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-900/15 max-[760px]:h-9';
$loginDetailsClass = 'group mt-3 rounded-lg border border-emerald-900/15 bg-emerald-50/55 px-2.5 py-1.5';
$loginSummaryClass = 'flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-[13px] font-black text-[#07130f] [&::-webkit-details-marker]:hidden';
$loginSummaryIconClass = 'h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-950 text-sm font-black leading-none text-white';
ensure_auth_schema();
$pendingUsername = (string) ($_SESSION['pending_username'] ?? '');
$claimedPlayerIds = [];
foreach (db()->query('SELECT player_id FROM site_users WHERE player_id IS NOT NULL')->fetchAll() as $claimedRow) {
    $claimedPlayerIds[(int) $claimedRow['player_id']] = true;
}
$registerPlayers = array_values(array_filter(repo_all_players(true), static fn(array $player): bool => !isset($claimedPlayerIds[(int) $player['id']])));
$loginIslandPayload = [
    'next' => $next,
    'pendingUsername' => $pendingUsername,
    'registerPlayers' => array_map(
        static fn(array $player): array => [
            'id' => (int) $player['id'],
            'name' => (string) $player['name'],
        ],
        $registerPlayers
    ),
];
require __DIR__ . '/includes/header.php';
?>

<div data-react-root data-react-island="login_page">
  <script type="application/json">
    <?= json_encode($loginIslandPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?: '{}' ?>
  </script>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
