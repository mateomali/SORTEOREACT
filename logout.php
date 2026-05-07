<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';

unset($_SESSION['is_admin'], $_SESSION['directivo_id'], $_SESSION['directivo_name']);
flash('success', 'Sesion cerrada.');
redirect('index.php');
