<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';
require_once __DIR__ . '/lib/schema.php';
require_once __DIR__ . '/lib/player_profile_visual.php';

ensure_control_schema();

$players = array_slice(repo_all_players(true), 0, 12);
$statLabels = shared_profile_stat_labels();

function card_preview_initials(string $name): string
{
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    $letters = '';
    foreach (array_slice(array_filter($parts), 0, 2) as $part) {
        $letters .= strtoupper(substr($part, 0, 1));
    }
    return $letters !== '' ? $letters : 'GF';
}

function card_preview_stat(array $player, string $field): int
{
    return shared_profile_player_fifa_overall(player_effective_stat($player, $field));
}

function card_preview_demo_photo(int $index): string
{
    return 'assets/players/default-player-silhouette.png';
}

function card_preview_tier(int $overall): string
{
    if ($overall >= 90) {
        return 'elite';
    }
    if ($overall >= 80) {
        return 'gold';
    }
    if ($overall >= 65) {
        return 'silver';
    }
    return 'bronze';
}

$title = 'Preview tarjetas | ' . APP_NAME;
$activePage = 'jugadores2.php';
$bodyClass = 'page-card-preview';
require __DIR__ . '/includes/header.php';
?>

<style>
  body.page-card-preview .content {
    display: grid;
    gap: 18px;
  }

  .card-preview-head {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 16px;
  }

  .card-preview-head h1 {
    margin: 0;
    font-size: 1.8rem;
    line-height: 1;
  }

  .card-preview-head p {
    margin: 4px 0 0;
    color: #5b7067;
    font-weight: 700;
  }

  .player-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(184px, 1fr));
    gap: 18px;
  }

  .fut-card {
    position: relative;
    --tier-line: #9db0a7;
    --tier-ink: #07130f;
    --tier-muted: #20382f;
    --tier-name-bg: rgba(245, 248, 244, .76);
    --tier-accent-soft: rgba(6, 61, 43, .1);
    --tier-accent-line: rgba(6, 61, 43, .2);
    min-height: 268px;
    display: grid;
    grid-template-rows: auto 94px auto;
    padding: 20px 22px 22px;
    color: var(--tier-ink);
    clip-path: polygon(14% 5%, 37% 5%, 50% 0, 63% 5%, 86% 5%, 94% 14%, 94% 78%, 86% 92%, 50% 100%, 14% 92%, 6% 78%, 6% 14%);
    background:
      linear-gradient(135deg, var(--tier-accent-soft) 0 18%, transparent 18% 35%, rgba(255,255,255,.18) 35% 55%, transparent 55%),
      var(--tier-bg);
    border: 1px solid var(--tier-line);
    box-shadow:
      inset 0 0 0 1px rgba(255,255,255,.88),
      inset 0 -14px 26px rgba(7, 19, 15, .08),
      0 12px 22px rgba(6, 61, 43, .14);
    overflow: hidden;
  }

  .fut-card::before {
    content: "";
    position: absolute;
    inset: 8px 9px 10px;
    clip-path: inherit;
    border: 2px solid var(--tier-accent-line);
    pointer-events: none;
  }

  .fut-card::after {
    content: "";
    position: absolute;
    inset: 15px 16px 17px;
    clip-path: inherit;
    border: 1px solid rgba(255, 255, 255, .82);
    pointer-events: none;
  }

  .fut-card.tier-bronze {
    --tier-bg: linear-gradient(180deg, #f0e0c9 0%, #cfad82 57%, #a4774e 100%);
    --tier-line: #8e643f;
    --tier-accent-soft: rgba(112, 71, 35, .18);
    --tier-accent-line: rgba(112, 71, 35, .28);
    --tier-name-bg: rgba(248, 234, 214, .82);
  }

  .fut-card.tier-silver {
    --tier-bg: linear-gradient(180deg, #f6f8f7 0%, #d8e0dd 54%, #aab8b1 100%);
    --tier-line: #8f9f98;
    --tier-accent-soft: rgba(6, 61, 43, .08);
    --tier-accent-line: rgba(6, 61, 43, .18);
    --tier-name-bg: rgba(245, 248, 244, .78);
  }

  .fut-card.tier-gold {
    --tier-bg: linear-gradient(180deg, #fff1b9 0%, #dfbd55 55%, #a87820 100%);
    --tier-line: #9a6b18;
    --tier-accent-soft: rgba(119, 76, 9, .16);
    --tier-accent-line: rgba(119, 76, 9, .26);
    --tier-name-bg: rgba(255, 244, 199, .84);
  }

  .fut-card.tier-elite {
    --tier-bg:
      linear-gradient(135deg, rgba(116, 71, 170, .18) 0 17%, transparent 17% 36%, rgba(80, 145, 178, .16) 36% 55%, transparent 55%),
      linear-gradient(180deg, #fbfdff 0%, #e4edf5 30%, #c5bce4 63%, #70598f 100%);
    --tier-line: #765ea5;
    --tier-accent-soft: rgba(116, 71, 170, .16);
    --tier-accent-line: rgba(83, 55, 130, .38);
    --tier-name-bg: rgba(246, 241, 255, .9);
  }

  .fut-card-top {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 8px;
    align-items: start;
    padding: 0 12px;
  }

  .fut-overall strong {
    display: block;
    width: 38px;
    min-height: 32px;
    display: grid;
    place-items: center;
    border: 0;
    background: transparent;
    color: var(--tier-ink);
    font-size: 1.42rem;
    line-height: .9;
  }

  .fut-overall span,
  .fut-position {
    display: block;
    margin-top: 2px;
    color: var(--tier-muted);
    font-size: .64rem;
    font-weight: 900;
  }

  .fut-position-secondary {
    margin-top: 1px;
    color: var(--tier-muted);
    font-size: .6rem;
  }

  .fut-badge {
    justify-self: end;
    min-width: 38px;
    min-height: 22px;
    margin-top: 1px;
    display: grid;
    place-items: center;
    border: 1px solid var(--tier-accent-line);
    background: var(--tier-accent-soft);
    color: #063d2b;
    font-size: .64rem;
    font-weight: 950;
  }

  .fut-badge.is-inactive {
    color: #7f1d1d;
    border-color: rgba(127, 29, 29, .35);
    background: rgba(127, 29, 29, .08);
  }

  .fut-player-mark {
    position: relative;
    z-index: 1;
    display: grid;
    place-items: end center;
    align-self: center;
    min-height: 96px;
    margin-top: -10px;
    overflow: visible;
  }

  .fut-avatar {
    width: 124px;
    height: 106px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: rgba(7, 19, 15, .92);
    font-size: 2.15rem;
    font-weight: 950;
    text-shadow: 0 2px 8px rgba(0,0,0,.28);
    box-shadow: none;
    overflow: hidden;
  }

  .fut-avatar img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;
    object-position: center;
  }

  .fut-avatar.is-default img {
    opacity: .92;
    filter: brightness(0) saturate(100%) drop-shadow(0 4px 7px rgba(0,0,0,.18));
  }

  .fut-name {
    position: relative;
    z-index: 1;
    margin: 1px 4px 7px;
    padding: 5px 8px;
    border-top: 2px solid rgba(6, 61, 43, .18);
    border-bottom: 2px solid rgba(6, 61, 43, .18);
    background: var(--tier-name-bg);
    color: var(--tier-ink);
    text-align: center;
    font-size: .7rem;
    font-weight: 950;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fut-stats {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px 14px;
    padding: 0 19px;
  }

  .fut-stats::before {
    content: "";
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(7, 19, 15, .42);
  }

  .fut-stats span {
    display: grid;
    grid-template-columns: 21px minmax(0, 1fr);
    gap: 3px;
    align-items: baseline;
    color: var(--tier-ink);
    font-size: .62rem;
    font-weight: 900;
    white-space: nowrap;
  }

  .fut-stats b {
    color: var(--tier-ink);
    text-align: right;
  }

  @media (max-width: 820px) {
    body.page-card-preview .content {
      padding: 12px;
    }

    .card-preview-head {
      display: block;
    }

    .player-card-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .fut-card {
      min-height: 244px;
      grid-template-rows: auto 82px auto;
      padding: 18px 16px 20px;
    }

    .fut-card-top {
      padding: 0 9px;
    }

    .fut-overall strong {
      width: 34px;
      min-height: 27px;
      font-size: 1.24rem;
    }

    .fut-overall span,
    .fut-position {
      font-size: .56rem;
    }

    .fut-position-secondary {
      font-size: .54rem;
    }

    .fut-badge {
      min-width: 32px;
      min-height: 20px;
      font-size: .56rem;
    }

    .fut-avatar {
      width: 104px;
      height: 90px;
      margin-top: -9px;
      font-size: 1.7rem;
    }

    .fut-name {
      margin: 0 2px 6px;
      padding: 3px 6px;
      font-size: .58rem;
    }

    .fut-stats {
      gap: 2px 10px;
      padding: 0 14px;
    }

    .fut-stats span {
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 3px;
      font-size: .52rem;
      letter-spacing: 0;
    }
  }
</style>

<section class="card-preview-head">
  <div>
    <h1>Preview tarjetas</h1>
    <p>Cartas visuales usando los valores actuales de jugadores.</p>
  </div>
  <a class="btn btn-muted" href="jugadores2.php">Volver a jugadores</a>
</section>

<section class="player-card-grid" aria-label="Preview de tarjetas de jugadores">
  <?php foreach ($players as $index => $player): ?>
    <?php
      $name = (string) $player['name'];
      $positions = parse_positions_csv((string) $player['positions']);
      $primary = $positions[0] ?? 'MED';
      $secondary = $positions[1] ?? '';
      $isActive = (int) ($player['active'] ?? 0) === 1;
      $overall = shared_profile_player_fifa_overall(player_overall_rating($player));
      $stats = [
          'RIT' => card_preview_stat($player, 'rhythm'),
          'TEC' => card_preview_stat($player, 'technique'),
          'SOL' => card_preview_stat($player, 'defense_physical'),
          'ATA' => card_preview_stat($player, 'attack'),
          'EQU' => card_preview_stat($player, 'teamwork'),
          'MEN' => card_preview_stat($player, 'mentality'),
      ];
      $tier = card_preview_tier($overall);
      $demoPhoto = card_preview_demo_photo((int) $index);
    ?>
    <article class="fut-card tier-<?= h($tier) ?>" aria-label="Carta de <?= h($name) ?>">
      <div class="fut-card-top">
        <div class="fut-overall">
          <strong><?= h((string) $overall) ?></strong>
          <span>GEN</span>
          <span class="fut-position"><?= h($primary) ?></span>
          <?php if ($secondary !== ''): ?>
            <span class="fut-position-secondary"><?= h($secondary) ?></span>
          <?php endif; ?>
        </div>
        <span></span>
        <div class="fut-badge<?= $isActive ? '' : ' is-inactive' ?>"><?= $isActive ? 'ACT' : 'INA' ?></div>
      </div>
      <div class="fut-player-mark">
        <div class="fut-avatar<?= str_contains($demoPhoto, 'default-player-silhouette') ? ' is-default' : '' ?>">
          <?php if ($demoPhoto !== ''): ?>
            <img src="<?= h($demoPhoto) ?>" alt="">
          <?php else: ?>
            <?= h(card_preview_initials($name)) ?>
          <?php endif; ?>
        </div>
      </div>
      <div>
        <h2 class="fut-name"><?= h($name) ?></h2>
        <div class="fut-stats">
          <?php foreach ($stats as $label => $value): ?>
            <span><b><?= h((string) $value) ?></b><?= h($label) ?></span>
          <?php endforeach; ?>
        </div>
      </div>
    </article>
  <?php endforeach; ?>
</section>

<?php require __DIR__ . '/includes/footer.php'; ?>
