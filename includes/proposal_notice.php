<?php
$noticeMatch = director_proposal_latest_match();
if ($noticeMatch && !empty($noticeMatch['director_proposals_enabled'])):
    $noticeOpen = multiple_draw_is_open($noticeMatch);
    $noticeWinner = (int) ($noticeMatch['multi_draw_winner_option_id'] ?? 0);
    if ($noticeOpen || $noticeWinner):
?>
<section class="card" aria-label="Votación del próximo partido">
  <h2><?= $noticeWinner ? 'Formación oficial del próximo partido' : 'Votación de equipos habilitada' ?></h2>
  <p><?= h((string) $noticeMatch['title']) ?> · <?= h(date('d/m/Y H:i', strtotime((string) $noticeMatch['match_date']))) ?></p>
  <?php if ($noticeOpen): ?>
    <p>Ya podés consultar las propuestas<?= in_array(current_role(), ['usuario', 'jugador'], true) ? ' y votar tu preferida' : '' ?>. Tiempo restante: <strong data-proposal-countdown="<?= multiple_draw_deadline($noticeMatch) ?>">Calculando…</strong></p>
  <?php else:
    foreach (multiple_draw_options((int) $noticeMatch['id']) as $noticeOption):
        if ((int) $noticeOption['id'] !== $noticeWinner) continue;
  ?>
    <p>Votación finalizada. Propuesta <?= (int) $noticeOption['option_number'] ?> ganadora, con <?= (int) $noticeOption['vote_count'] ?> votos. Sus equipos son la formación oficial de esta fecha.</p>
  <?php endforeach; endif; ?>
  <a class="btn" href="propuestas_equipos.php?match_id=<?= (int) $noticeMatch['id'] ?>"><?= $noticeWinner ? 'Ver formación ganadora' : 'Ver propuestas y votación' ?></a>
</section>
<?php endif; endif; ?>
