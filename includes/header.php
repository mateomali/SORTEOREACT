<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';

$title = $title ?? APP_NAME;
$activePage = $activePage ?? '';
$bodyClass = trim((string) ($bodyClass ?? ''));
$flashMessages = consume_flash();
$tailwindVersion = (string) (@filemtime(__DIR__ . '/../assets/tailwind.css') ?: time());
$contrastVersion = (string) (@filemtime(__DIR__ . '/../assets/contrast-overrides.css') ?: time());
$brandLogoPath = __DIR__ . '/../assets/goodfellas-logo.png';
$publicMenu = [
    'index.php' => 'Inicio',
    'historial.php' => 'Historial',
    'estadisticas.php' => 'Estadisticas',
    'jugadores.php' => 'Jugadores',
];
$roleMenu = [];
$roleLabel = '';
if (is_admin()) {
    $roleLabel = 'Admin';
    $roleMenu = [
        'crear_partido.php' => 'Crear fecha',
        'editar_partidos.php' => 'Editar fechas',
        'configuracion.php' => 'Configuracion',
        'usuarios.php' => 'Usuarios',
        'directivos.php' => 'Directivos',
        'backup.php' => 'Backup',
        'logout.php' => 'Salir',
    ];
} elseif (is_directivo()) {
    $roleLabel = 'Directivo';
    $roleMenu = [
        'junta_votaciones.php' => 'Votaciones',
        'logout.php' => 'Salir',
    ];
} elseif (is_player_user()) {
    $roleLabel = 'Jugador';
    $roleMenu = [
        'perfil.php' => 'Mi perfil',
        'estadisticas.php' => 'Mis stats',
        'logout.php' => 'Salir',
    ];
} elseif (current_user_id() > 0) {
    $roleLabel = 'Usuario';
    $roleMenu = [
        'logout.php' => 'Salir',
    ];
} elseif (!empty($_SESSION['guest_vote_invite_id'])) {
    $roleLabel = 'Invitado';
    $roleMenu = [
        'junta_votaciones.php' => 'Votacion',
        'logout.php' => 'Salir',
    ];
} else {
    $roleMenu = [
        'login.php' => 'Ingresar',
    ];
}
$showRoleShortcut = !is_admin();
$roleShortcutHref = is_player_user() ? 'perfil.php' : ((is_directivo() || !empty($_SESSION['guest_vote_invite_id'])) ? 'junta_votaciones.php' : (current_user_id() > 0 ? 'logout.php' : 'login.php'));
$roleShortcutLabel = is_player_user() ? 'Mi perfil' : (is_directivo() ? 'Junta' : (!empty($_SESSION['guest_vote_invite_id']) ? 'Votacion' : (current_user_id() > 0 ? 'Salir' : 'Ingresar')));
$navLinkBase = 'block rounded-xl border border-transparent px-3 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:border-lime-200/35 hover:bg-lime-100/10 hover:text-lime-100 max-[760px]:w-full max-[760px]:border-lime-200/25 max-[760px]:bg-emerald-900/45 max-[760px]:px-2.5 max-[760px]:py-2 max-[760px]:text-xs max-[760px]:leading-tight max-[760px]:shadow-sm max-[760px]:shadow-emerald-950/15';
$navLinkActive = 'border-lime-200/60 bg-lime-200 text-emerald-950 hover:bg-lime-100 hover:text-emerald-950';
$navLogout = 'text-red-100 hover:border-red-200/45 hover:bg-red-500/15 hover:text-red-50';
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= h($title) ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/tailwind.css?v=<?= h($tailwindVersion) ?>">
  <link rel="stylesheet" href="assets/contrast-overrides.css?v=<?= h($contrastVersion) ?>">
</head>
<body<?= $bodyClass !== '' ? ' class="' . h($bodyClass) . '"' : '' ?>>
  <div class="app-shell">
    <header class="grid min-h-16 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 bg-emerald-950 px-2.5 py-2 text-white sm:min-h-24 sm:px-5 sm:py-3 min-[761px]:pl-0 min-[761px]:pr-5">
      <div class="flex min-w-0 items-center min-[761px]:col-start-1 min-[761px]:row-start-1">
        <?php if (is_file($brandLogoPath)): ?>
          <a class="inline-flex shrink-0 items-center no-underline" href="index.php" aria-label="Ir al inicio">
            <img
              class="h-10 w-auto max-w-[96px] shrink-0 object-contain sm:h-24 sm:max-w-[270px] min-[761px]:-ml-1.5"
              src="assets/goodfellas-logo.png"
              alt="Goodfellas"
              width="900"
              height="730"
            >
          </a>
        <?php endif; ?>
      </div>
      <nav
        class="col-span-full row-start-2 hidden w-full min-w-0 flex-col gap-2 border-t border-lime-200/15 pt-2 min-[761px]:col-start-2 min-[761px]:row-start-1 min-[761px]:flex min-[761px]:flex-row min-[761px]:flex-wrap min-[761px]:items-center min-[761px]:justify-end min-[761px]:gap-2 min-[761px]:border-t-0 min-[761px]:pt-0"
        id="mainNav"
        aria-label="Navegacion principal"
      >
        <div class="mobile-nav-group grid grid-cols-2 gap-1.5 min-[761px]:flex min-[761px]:flex-wrap min-[761px]:items-center min-[761px]:gap-1" aria-label="Opciones publicas">
          <span class="mobile-nav-label">Publico</span>
          <?php foreach ($publicMenu as $file => $label): ?>
            <a class="<?= h($navLinkBase . ' ' . ($activePage === $file ? $navLinkActive : '')) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
          <?php endforeach; ?>
        </div>
        <div class="mobile-nav-group grid grid-cols-2 gap-1.5 border-t border-lime-200/20 pt-2 min-[761px]:flex min-[761px]:flex-wrap min-[761px]:items-center min-[761px]:gap-1 min-[761px]:border-l min-[761px]:border-t-0 min-[761px]:pl-2 min-[761px]:pt-0" aria-label="<?= $roleLabel !== '' ? 'Opciones ' . h($roleLabel) : 'Acceso admin' ?>">
          <span class="mobile-nav-label"><?= $roleLabel !== '' ? h($roleLabel) : 'Acceso' ?></span>
          <?php if ($roleLabel !== ''): ?>
            <span class="col-span-full w-fit rounded-full bg-lime-100/10 px-2 py-0.5 text-[9px] font-black uppercase leading-tight text-lime-50 min-[761px]:px-2.5 min-[761px]:py-1 min-[761px]:text-[10px]"><?= h($roleLabel) ?></span>
          <?php endif; ?>
          <?php foreach ($roleMenu as $file => $label): ?>
            <a class="<?= h($navLinkBase . ' ' . ($activePage === $file ? $navLinkActive : '') . ' ' . ($file === 'logout.php' ? $navLogout : '')) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
          <?php endforeach; ?>
        </div>
      </nav>
      <div class="col-start-3 row-start-1 flex shrink-0 items-center justify-end gap-2 min-[761px]:col-start-3 min-[761px]:row-start-1">
        <?php if ($showRoleShortcut): ?>
          <a class="inline-flex min-h-8 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950/55 px-2.5 py-1.5 text-[11px] font-extrabold leading-tight text-lime-50 no-underline shadow-md shadow-emerald-950/15 transition hover:border-lime-200/75 hover:bg-lime-100/15 hover:text-lime-100 min-[761px]:hidden" href="<?= h($roleShortcutHref) ?>"><?= h($roleShortcutLabel) ?></a>
        <?php endif; ?>
        <button class="inline-flex min-h-8 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950/55 px-2.5 py-1.5 text-[11px] font-extrabold leading-tight text-lime-50 shadow-md shadow-emerald-950/15 transition hover:border-lime-200/75 hover:bg-lime-100/15 hover:text-lime-100 min-[761px]:hidden" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mainNav">Menu</button>
      </div>
    </header>

    <main class="content">
      <?php foreach ($flashMessages as $msg): ?>
        <div class="flash flash-<?= h($msg['type']) ?>"><?= h($msg['message']) ?></div>
      <?php endforeach; ?>
