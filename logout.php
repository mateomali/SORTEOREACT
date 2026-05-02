<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';

unset($_SESSION['is_admin']);
flash('success', 'Sesion admin cerrada.');
redirect('index.php');
