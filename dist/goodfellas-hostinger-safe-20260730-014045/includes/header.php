<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';

$title = $title ?? APP_NAME;
$activePage = $activePage ?? '';
$bodyClass = trim((string) ($bodyClass ?? ''));
$headExtraHtml = (string) ($headExtraHtml ?? '');
if ($bodyClass === '') {
    $classSource = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    if ($classSource === '') {
        $classSource = (string) ($_SERVER['SCRIPT_NAME'] ?? '');
    }
    if ($classSource === '' && $activePage !== '') {
        $classSource = (string) $activePage;
    }
    $pageClass = preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo(basename($classSource), PATHINFO_FILENAME))) ?: '';
    if ($pageClass !== '') {
        $bodyClass = 'page-' . trim($pageClass, '-');
    }
}
$flashMessages = consume_flash();
$tailwindVersion = (string) (@filemtime(__DIR__ . '/../assets/tailwind.css') ?: time());
$contrastVersion = (string) (@filemtime(__DIR__ . '/../assets/contrast-overrides.css') ?: time());
$disableContrastOverrides = (bool) ($disableContrastOverrides ?? true);
$brandLogoPath = __DIR__ . '/../assets/goodfellas-logo.png';
$publicMenu = [
    'index.php' => 'Inicio',
    'jugadores2.php' => 'Jugadores',
    'estadisticas.php' => 'Estadísticas',
    'historial.php' => 'Historial',
];
$publicMenuGroups = [];
$roleMenu = [];
$roleMenuGroups = [];
$roleLabel = '';
if (is_admin()) {
    $roleLabel = 'Admin';
    $roleMenu = [
        'crear_partido.php' => 'Crear fecha',
        'editar_partidos.php' => 'Editar fechas',
        'configuracion.php' => 'Configuración',
        'usuarios.php' => 'Usuarios',
        'directivos.php' => 'Directivos',
        'mis_valoraciones.php' => 'Valoraciones',
        'backup.php' => 'Backup',
        'logout.php' => 'Salir',
    ];
} elseif (is_directivo()) {
    $roleLabel = 'Directivo';
    $roleMenu = [
        'junta_votaciones.php' => 'Votaciones',
        'mis_valoraciones.php' => 'Mis valoraciones',
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
if (is_admin()) {
    $roleMenuGroups = [
        'Fechas' => [
            'crear_partido.php' => $roleMenu['crear_partido.php'] ?? 'Crear fecha',
            'editar_partidos.php' => $roleMenu['editar_partidos.php'] ?? 'Editar fechas',
            'historial.php' => $publicMenu['historial.php'] ?? 'Historial',
        ],
        'Jugadores' => [
            'jugadores2.php' => $publicMenu['jugadores2.php'] ?? 'Jugadores',
            'jugadores2.php?create=1#crear-jugador' => 'Crear jugador',
            'estadisticas.php' => $publicMenu['estadisticas.php'] ?? 'Estadisticas',
        ],
        'Personas' => [
            'usuarios.php' => $roleMenu['usuarios.php'] ?? 'Usuarios',
            'directivos.php' => $roleMenu['directivos.php'] ?? 'Directivos',
        ],
        'Gestion' => [
            'configuracion.php' => $roleMenu['configuracion.php'] ?? 'ConfiguraciÃ³n',
            'mis_valoraciones.php' => $roleMenu['mis_valoraciones.php'] ?? 'Valoraciones',
            'backup.php' => $roleMenu['backup.php'] ?? 'Backup',
        ],
        'Sesion' => [
            'logout.php' => $roleMenu['logout.php'] ?? 'Salir',
        ],
    ];
    $roleMenuGroups = [
        'Jugadores' => $roleMenuGroups['Jugadores'],
        'Fechas' => $roleMenuGroups['Fechas'],
        'Gestion' => $roleMenuGroups['Gestion'],
        'Personas' => $roleMenuGroups['Personas'],
        'Salir' => $roleMenuGroups['Sesion'],
    ];
    $publicMenu = [
        'index.php' => $publicMenu['index.php'] ?? 'Inicio',
    ];
} else {
    $publicMenuGroups = [
        'Jugadores' => [
            'jugadores2.php' => $publicMenu['jugadores2.php'] ?? 'Jugadores',
            'estadisticas.php' => $publicMenu['estadisticas.php'] ?? 'Estadisticas',
        ],
        'Fechas' => [
            'historial.php' => $publicMenu['historial.php'] ?? 'Historial',
        ],
    ];
    $publicMenu = [
        'index.php' => $publicMenu['index.php'] ?? 'Inicio',
    ];
    if ($roleMenu) {
        $roleMenuGroups = [
            $roleLabel !== '' ? $roleLabel : 'Cuenta' => $roleMenu,
        ];
    }
}
$showRoleShortcut = false;
$roleShortcutHref = is_player_user() ? 'perfil.php' : ((is_directivo() || !empty($_SESSION['guest_vote_invite_id'])) ? 'junta_votaciones.php' : (current_user_id() > 0 ? 'logout.php' : 'login.php'));
$roleShortcutLabel = is_player_user() ? 'Mi perfil' : (is_directivo() ? 'Junta' : (!empty($_SESSION['guest_vote_invite_id']) ? 'Votacion' : (current_user_id() > 0 ? 'Salir' : 'Ingresar')));
$navLinkLayout = 'inline-flex min-h-8 items-center justify-center rounded-xl border px-3 py-2 text-sm font-extrabold leading-tight no-underline transition max-[760px]:min-h-10 max-[760px]:w-full max-[760px]:justify-start max-[760px]:rounded-md max-[760px]:px-3 max-[760px]:py-2 max-[760px]:text-sm';
$navLinkBase = $navLinkLayout . ' border-transparent text-white hover:border-white/30 hover:bg-white/10 hover:text-white max-[760px]:border-[#1b5a47] max-[760px]:bg-[#063d2b] max-[760px]:text-lime-50 hover:max-[760px]:border-lime-200/35 hover:max-[760px]:bg-[#0a4a35]';
$navLinkActive = $navLinkLayout . ' border-white/45 bg-[#e7eee9] text-[#07130f] hover:bg-[#f4f8f6] hover:text-[#07130f] max-[760px]:border-lime-200/70 max-[760px]:bg-[#0f513c] max-[760px]:text-lime-50 max-[760px]:shadow-[inset_4px_0_0_rgba(217,249,157,0.92)] hover:max-[760px]:bg-[#145f47] hover:max-[760px]:text-lime-50';
$navLogout = 'text-red-100 hover:border-red-200/45 hover:bg-red-500/15 hover:text-red-50 max-[760px]:border-red-200/30 max-[760px]:bg-[#3f1717] max-[760px]:text-red-50 hover:max-[760px]:bg-[#541d1d]';
$navDropdownClass = 'group relative max-[760px]:w-full max-[760px]:rounded-lg max-[760px]:border max-[760px]:border-[#1b5a47] max-[760px]:bg-[#063726] max-[760px]:p-1';
$navDropdownSummaryBase = $navLinkLayout . ' cursor-pointer list-none select-none gap-1 border-transparent text-white [&::-webkit-details-marker]:hidden hover:border-white/30 hover:bg-white/10 hover:text-white group-open:border-white/25 group-open:bg-white/10 max-[760px]:justify-between max-[760px]:border-transparent max-[760px]:bg-transparent max-[760px]:text-lime-50';
$navDropdownSummaryActive = $navLinkLayout . ' cursor-pointer list-none select-none gap-1 border-white/45 bg-[#e7eee9] text-[#07130f] [&::-webkit-details-marker]:hidden hover:bg-[#f4f8f6] hover:text-[#07130f] group-open:border-white/45 group-open:bg-[#e7eee9] max-[760px]:justify-between max-[760px]:border-lime-200/70 max-[760px]:bg-[#0f513c] max-[760px]:text-lime-50 max-[760px]:shadow-[inset_4px_0_0_rgba(217,249,157,0.92)] hover:max-[760px]:bg-[#145f47] hover:max-[760px]:text-lime-50';
$navDropdownMenuClass = 'absolute right-0 z-30 mt-1 hidden min-w-44 flex-col gap-1 rounded-lg border border-white/15 bg-emerald-950 p-1.5 shadow-lg shadow-emerald-950/25 group-open:flex max-[760px]:static max-[760px]:mt-1 max-[760px]:w-full max-[760px]:min-w-0 max-[760px]:border-0 max-[760px]:bg-transparent max-[760px]:p-0 max-[760px]:shadow-none';
$navDropdownItemClass = 'flex min-h-8 items-center rounded-md border border-transparent px-3 py-2 text-sm font-extrabold leading-tight text-white no-underline transition hover:border-white/25 hover:bg-white/10 hover:text-white max-[760px]:min-h-10 max-[760px]:border-[#1b5a47] max-[760px]:bg-[#082f23] max-[760px]:text-lime-50 hover:max-[760px]:border-lime-200/35 hover:max-[760px]:bg-[#0a4a35]';
$navDropdownItemActive = 'flex min-h-8 items-center rounded-md border border-white/45 bg-[#e7eee9] px-3 py-2 text-sm font-extrabold leading-tight text-[#07130f] no-underline transition hover:bg-[#f4f8f6] hover:text-[#07130f] max-[760px]:min-h-10 max-[760px]:border-lime-200/70 max-[760px]:bg-[#0f513c] max-[760px]:text-lime-50 max-[760px]:shadow-[inset_4px_0_0_rgba(217,249,157,0.92)] hover:max-[760px]:bg-[#145f47] hover:max-[760px]:text-lime-50';
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= h($title) ?></title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800;900&family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <?= $headExtraHtml ?>
  <link rel="stylesheet" href="assets/tailwind.css?v=<?= h($tailwindVersion) ?>">
  <?php if (!$disableContrastOverrides): ?>
    <link rel="stylesheet" href="assets/contrast-overrides.css?v=<?= h($contrastVersion) ?>">
  <?php endif; ?>
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
      <button
        class="hidden max-[760px]:fixed max-[760px]:inset-0 max-[760px]:z-[55] max-[760px]:bg-[#03100b]/45"
        id="mainNavBackdrop"
        type="button"
        aria-label="Cerrar menu"
      ></button>
      <nav
        class="col-span-full row-start-2 hidden w-full min-w-0 flex-wrap items-center justify-end gap-1.5 border-t border-lime-200/15 pt-2 max-[760px]:fixed max-[760px]:inset-x-0 max-[760px]:bottom-0 max-[760px]:z-[60] max-[760px]:max-h-[min(78dvh,34rem)] max-[760px]:overflow-y-auto max-[760px]:rounded-t-xl max-[760px]:border-x-0 max-[760px]:border-b-0 max-[760px]:border-t max-[760px]:border-lime-200/20 max-[760px]:bg-[#05291d] max-[760px]:p-3 max-[760px]:shadow-[0_-8px_22px_rgba(3,16,11,0.22)] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:justify-start max-[760px]:gap-2 min-[761px]:col-start-2 min-[761px]:row-start-1 min-[761px]:flex min-[761px]:gap-2 min-[761px]:border-t-0 min-[761px]:pt-0"
        id="mainNav"
        aria-label="Navegacion principal"
      >
        <?php foreach ($publicMenu as $file => $label): ?>
          <a class="<?= h($activePage === $file ? $navLinkActive : $navLinkBase) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
        <?php endforeach; ?>
        <?php foreach ($publicMenuGroups as $groupLabel => $groupLinks): ?>
          <?php $groupIsActive = array_key_exists($activePage, $groupLinks); ?>
          <?php if (count($groupLinks) === 1): ?>
            <?php foreach ($groupLinks as $file => $label): ?>
              <a class="<?= h($activePage === $file ? $navLinkActive : $navLinkBase) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
            <?php endforeach; ?>
          <?php else: ?>
            <details class="<?= h($navDropdownClass) ?>">
              <summary class="<?= h($groupIsActive ? $navDropdownSummaryActive : $navDropdownSummaryBase) ?>" style="list-style: none;">
                <span><?= h($groupLabel) ?></span>
                <span aria-hidden="true">&#9662;</span>
              </summary>
              <div class="<?= h($navDropdownMenuClass) ?>" aria-label="<?= h($groupLabel) ?>">
              <?php foreach ($groupLinks as $file => $label): ?>
                <a class="<?= h($activePage === $file ? $navDropdownItemActive : $navDropdownItemClass) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
              <?php endforeach; ?>
              </div>
            </details>
          <?php endif; ?>
        <?php endforeach; ?>
        <?php if ($roleMenuGroups): ?>
          <?php foreach ($roleMenuGroups as $groupLabel => $groupLinks): ?>
            <?php $groupIsActive = array_key_exists($activePage, $groupLinks); ?>
            <?php if (count($groupLinks) === 1): ?>
              <?php foreach ($groupLinks as $file => $label): ?>
                <a class="<?= h(($activePage === $file ? $navLinkActive : $navLinkBase) . ' ' . ($file === 'logout.php' ? $navLogout : '')) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
              <?php endforeach; ?>
            <?php else: ?>
              <details class="<?= h($navDropdownClass) ?>">
                <summary class="<?= h($groupIsActive ? $navDropdownSummaryActive : $navDropdownSummaryBase) ?>" style="list-style: none;">
                  <span><?= h($groupLabel) ?></span>
                  <span aria-hidden="true">&#9662;</span>
                </summary>
                <div class="<?= h($navDropdownMenuClass) ?>" aria-label="<?= h($roleLabel . ': ' . $groupLabel) ?>">
                <?php foreach ($groupLinks as $file => $label): ?>
                  <a class="<?= h(($activePage === $file ? $navDropdownItemActive : $navDropdownItemClass) . ' ' . ($file === 'logout.php' ? $navLogout : '')) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
                <?php endforeach; ?>
                </div>
              </details>
            <?php endif; ?>
          <?php endforeach; ?>
        <?php else: ?>
          <?php foreach ($roleMenu as $file => $label): ?>
            <a class="<?= h(($activePage === $file ? $navLinkActive : $navLinkBase) . ' ' . ($file === 'logout.php' ? $navLogout : '')) ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
          <?php endforeach; ?>
        <?php endif; ?>
      </nav>
      <div class="col-start-3 row-start-1 flex shrink-0 items-center justify-end gap-2 min-[761px]:col-start-3 min-[761px]:row-start-1">
        <?php if ($showRoleShortcut): ?>
          <a class="inline-flex min-h-8 items-center justify-center rounded-xl border border-white/25 bg-emerald-950/55 px-2.5 py-1.5 text-[11px] font-extrabold leading-tight text-white no-underline shadow-md shadow-emerald-950/15 transition hover:border-white/50 hover:bg-white/10 hover:text-white min-[761px]:hidden" href="<?= h($roleShortcutHref) ?>"><?= h($roleShortcutLabel) ?></a>
        <?php endif; ?>
        <button class="inline-flex min-h-8 items-center justify-center rounded-xl border border-white/25 bg-emerald-950/55 px-2.5 py-1.5 text-[11px] font-extrabold leading-tight text-white shadow-md shadow-emerald-950/15 transition hover:border-white/50 hover:bg-white/10 hover:text-white min-[761px]:hidden" id="menuToggle" type="button" aria-label="Abrir menu" aria-expanded="false" aria-controls="mainNav">Menu</button>
      </div>
    </header>

    <main class="content">
      <?php foreach ($flashMessages as $msg): ?>
        <div class="flash flash-<?= h($msg['type']) ?>"><?= h($msg['message']) ?></div>
      <?php endforeach; ?>
