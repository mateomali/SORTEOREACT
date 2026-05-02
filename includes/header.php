<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/helpers.php';

$title = $title ?? APP_NAME;
$activePage = $activePage ?? '';
$flashMessages = consume_flash();
$tailwindVersion = (string) (@filemtime(__DIR__ . '/../assets/tailwind.css') ?: time());
$menu = is_admin()
    ? [
        'index.php' => 'Inicio',
        'jugadores.php' => 'Jugadores',
        'encuentros.php' => 'Encuentros',
        'estadisticas.php' => 'Estadisticas',
        'logout.php' => 'Salir',
    ]
    : [
        'index.php' => 'Inicio',
        'estadisticas.php' => 'Estadisticas',
        'login.php' => 'Admin',
    ];
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
</head>
<body>
  <div class="app-shell">
    <header class="topbar">
      <div class="brand">
        <div class="ball"></div>
        <div>
          <strong>GOODFELLAS</strong>
          <span>Gestor de Futbol</span>
        </div>
      </div>
      <button class="menu-toggle" id="menuToggle" type="button" aria-label="Abrir menu">Menu</button>
    </header>

    <nav class="main-nav" id="mainNav">
      <?php foreach ($menu as $file => $label): ?>
        <a class="<?= $activePage === $file ? 'active' : '' ?>" href="<?= h($file) ?>"><?= h($label) ?></a>
      <?php endforeach; ?>
    </nav>

    <main class="content">
      <?php foreach ($flashMessages as $msg): ?>
        <div class="flash flash-<?= h($msg['type']) ?>"><?= h($msg['message']) ?></div>
      <?php endforeach; ?>
