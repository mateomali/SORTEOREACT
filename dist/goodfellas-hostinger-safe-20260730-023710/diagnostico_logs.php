<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/diagnostics.php';

require_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'clear') {
    gf_diagnostics_clear();
    flash('success', 'Log limpiado.');
    redirect('diagnostico_logs.php');
}

$title = 'Diagnostico logs | ' . APP_NAME;
$bodyClass = 'page-diagnostico-logs';
require __DIR__ . '/includes/header.php';
$logText = gf_diagnostics_tail(300);
?>

<section class="mx-auto grid w-full max-w-5xl gap-3 px-3 py-4 text-[#07130f]">
  <header class="grid gap-1">
    <h1 class="m-0 text-2xl font-black">Diagnostico logs</h1>
    <p class="m-0 text-sm font-semibold text-[#526b62]">Errores PHP y JS capturados en el hosting.</p>
  </header>

  <form method="post">
    <input type="hidden" name="action" value="clear">
    <button class="inline-flex min-h-9 items-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700" type="submit">Limpiar log</button>
  </form>

  <pre class="max-h-[70vh] overflow-auto rounded-lg border border-[#d7ded9] bg-[#07130f] p-3 text-xs leading-relaxed text-lime-50"><?= h($logText !== '' ? $logText : 'Sin logs todavia.') ?></pre>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
