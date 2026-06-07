<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();

function preview_card_overall(float $value): int
{
    $clamped = max(1.0, min(6.0, $value));
    $anchors = [
        [1.0, 35.0], [2.5, 54.0], [3.0, 64.0], [3.2, 69.0], [3.5, 74.0],
        [3.8, 79.0], [4.0, 81.0], [4.4, 86.0], [4.5, 87.0], [5.0, 92.0],
        [5.2, 93.0], [5.3, 94.0], [6.0, 99.0],
    ];
    for ($i = 0, $count = count($anchors) - 1; $i < $count; $i++) {
        [$fromRating, $fromOverall] = $anchors[$i];
        [$toRating, $toOverall] = $anchors[$i + 1];
        if ($clamped <= $toRating) {
            $ratio = ($clamped - $fromRating) / ($toRating - $fromRating);
            return (int) round($fromOverall + (($toOverall - $fromOverall) * $ratio));
        }
    }
    return 99;
}

function preview_stat_overall(array $player, string $field): int
{
    return preview_card_overall(player_effective_stat($player, $field));
}

function preview_player_photo_path(array $player): string
{
    $playerId = (int) ($player['id'] ?? 0);
    if ($playerId > 0) {
        $matches = glob(__DIR__ . '/uploads/players/transparent/player-' . $playerId . '-*.png') ?: [];
        if ($matches) {
            usort($matches, static fn(string $a, string $b): int => filemtime($b) <=> filemtime($a));
            return 'uploads/players/transparent/' . basename($matches[0]);
        }
    }
    return player_photo_path($player);
}

$players = array_values(array_filter(repo_all_players(true), static fn(array $player): bool => player_has_custom_photo($player)));
if (!$players) {
    $players = repo_all_players(true);
}

$previewPlayers = array_map(static function (array $player): array {
    $position = player_best_natural_position($player);
    $isGoalkeeper = $position === 'ARQ';
    return [
        'id' => (int) ($player['id'] ?? 0),
        'name' => (string) ($player['name'] ?? ''),
        'position' => $position,
        'positions' => parse_positions_csv((string) ($player['positions'] ?? '')),
        'photo' => preview_player_photo_path($player),
        'rating' => preview_card_overall(player_position_rating($player, $position)),
        'stats' => [
            $isGoalkeeper ? 'ARQ' : 'TEC' => preview_stat_overall($player, $isGoalkeeper ? 'goalkeeper_skill' : 'technique'),
            'RIT' => preview_stat_overall($player, 'rhythm'),
            'DEF' => preview_stat_overall($player, 'defense_physical'),
            $isGoalkeeper ? 'TEC' : 'ATA' => preview_stat_overall($player, $isGoalkeeper ? 'technique' : 'attack'),
            'EQU' => preview_stat_overall($player, 'teamwork'),
            'MEN' => preview_stat_overall($player, 'mentality'),
        ],
    ];
}, $players);
?>
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Previews de card | Goodfellas</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Poppins:wght@500;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --ink: #07130f;
      --muted: #586b62;
      --line: #d7e6df;
      --surface: #f3f7f5;
      --gold: #8c781e;
      --gold-2: #d7bd54;
      --cream: #fbfaf1;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #edf4f0;
      color: var(--ink);
      font-family: Poppins, system-ui, sans-serif;
    }
    .page {
      width: min(1440px, 100%);
      margin: 0 auto;
      padding: 18px;
    }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: end;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
    }
    h1 {
      margin: 0 0 5px;
      font-size: 1.2rem;
      line-height: 1.2;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: .84rem;
      font-weight: 700;
    }
    label {
      display: grid;
      gap: 5px;
      color: var(--muted);
      font-size: .78rem;
      font-weight: 900;
    }
    select {
      min-width: 220px;
      min-height: 38px;
      border: 1px solid #b9d0c7;
      border-radius: 8px;
      background: #fff;
      padding: 0 10px;
      color: var(--ink);
      font: inherit;
      font-size: .9rem;
      font-weight: 800;
    }
    .preview-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(250px, 1fr));
      gap: 16px;
      align-items: start;
      margin-top: 16px;
    }
    .compact-section {
      margin-top: 16px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
    }
    .compact-section h2 {
      margin: 0 0 4px;
      color: #19382c;
      font-size: 1rem;
      line-height: 1.15;
    }
    .compact-row {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: end;
      margin-top: 12px;
    }
    .preview-item {
      display: grid;
      gap: 10px;
      justify-items: center;
      padding: 14px 10px 16px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fff;
    }
    .preview-item h2 {
      width: min(100%, 330px);
      margin: 0;
      color: #19382c;
      font-size: .95rem;
      line-height: 1.15;
    }
    .preview-item p {
      width: min(100%, 330px);
      min-height: 36px;
      font-size: .75rem;
      line-height: 1.2;
    }
    .player-card {
      position: relative;
      width: min(100%, 320px);
      aspect-ratio: 409 / 710;
      overflow: hidden;
      color: #f7fff9;
      font-family: "Barlow Condensed", Impact, sans-serif;
      background: url("assets/card-backgrounds/reference-gold.png") center / contain no-repeat;
      filter: drop-shadow(0 9px 12px rgba(7, 19, 15, .20));
    }
    .rating {
      position: absolute;
      top: 75px;
      left: 52px;
      z-index: 3;
      font-size: 3.55rem;
      font-weight: 900;
      line-height: .78;
      letter-spacing: 0;
      text-shadow: 0 2px 0 rgba(0,0,0,.72), 0 1px 6px rgba(0,0,0,.44);
    }
    .position {
      position: absolute;
      top: 130px;
      left: 56px;
      z-index: 3;
      font-size: 1.25rem;
      font-weight: 900;
      line-height: .9;
      text-shadow: 0 2px 0 rgba(0,0,0,.72), 0 1px 6px rgba(0,0,0,.44);
    }
    .positions-list {
      position: absolute;
      z-index: 4;
      top: 154px;
      left: 56px;
      display: grid;
      gap: 1px;
      min-width: 38px;
      text-align: center;
      font-size: .76rem;
      font-weight: 900;
      line-height: .95;
      opacity: .9;
      text-shadow: 0 2px 0 rgba(0,0,0,.72), 0 1px 6px rgba(0,0,0,.44);
    }
    .photo-frame {
      position: absolute;
      z-index: 2;
      overflow: hidden;
      border: 1px solid rgba(248, 229, 137, .34);
      background:
        radial-gradient(circle at 50% 26%, rgba(255,255,255,.18), transparent 42%),
        linear-gradient(180deg, rgba(6, 28, 19, .18), rgba(6, 28, 19, .42));
      box-shadow: inset 0 0 0 1px rgba(7, 19, 15, .32), 0 7px 10px rgba(2, 14, 9, .20);
    }
    .photo-frame::after {
      position: absolute;
      inset: 0;
      content: "";
      border: 1px solid rgba(255,255,255,.12);
      pointer-events: none;
    }
    .player-photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center center;
      transform-origin: center center;
      filter: saturate(.98) contrast(1.02);
    }
    .player-name {
      position: absolute;
      z-index: 4;
      left: 48px;
      right: 48px;
      bottom: 151px;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 2.55rem;
      font-weight: 900;
      line-height: .95;
      text-shadow: 0 2px 0 rgba(0,0,0,.76), 0 1px 7px rgba(0,0,0,.48);
    }
    .divider {
      position: absolute;
      z-index: 4;
      left: 82px;
      right: 82px;
      bottom: 136px;
      height: 1px;
      background: rgba(255,255,255,.34);
    }
    .stats {
      position: absolute;
      z-index: 4;
      left: 58px;
      right: 58px;
      bottom: 52px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 28px;
      row-gap: 5px;
      font-size: 1.56rem;
      font-weight: 900;
      line-height: .95;
      text-shadow: 0 2px 0 rgba(0,0,0,.76), 0 1px 7px rgba(0,0,0,.48);
    }
    .stat {
      display: grid;
      grid-template-columns: 32px 1fr;
      gap: 6px;
      white-space: nowrap;
    }
    .variant-a .photo-frame {
      top: 112px;
      left: 123px;
      width: 148px;
      height: 178px;
      border-radius: 48% 48% 42% 42%;
    }
    .variant-a .player-photo {
      transform: scale(1.12) translateY(4px);
    }
    .variant-b .rating { left: 42px; top: 70px; }
    .variant-b .position { left: 47px; top: 132px; }
    .variant-b .positions-list { left: 46px; top: 158px; }
    .variant-b .photo-frame {
      top: 101px;
      left: 106px;
      width: 174px;
      height: 202px;
      clip-path: polygon(50% 0, 92% 18%, 86% 76%, 50% 100%, 14% 76%, 8% 18%);
    }
    .variant-b .photo-frame::after { clip-path: inherit; }
    .variant-b .player-photo {
      transform: scale(1.07) translateY(7px);
    }
    .variant-b .player-name { bottom: 149px; }
    .variant-b .divider { bottom: 135px; }
    .variant-b .stats { bottom: 50px; }
    .variant-c .rating {
      top: 74px;
      left: 45px;
      font-size: 3.85rem;
    }
    .variant-c .position {
      top: 131px;
      left: 48px;
      font-size: 1.8rem;
    }
    .variant-c .positions-list { left: 49px; top: 164px; }
    .variant-c .photo-frame {
      top: 101px;
      left: 107px;
      width: 174px;
      height: 194px;
      clip-path: polygon(50% 0, 90% 25%, 90% 75%, 50% 100%, 10% 75%, 10% 25%);
    }
    .variant-c .photo-frame::after { clip-path: inherit; }
    .variant-c .player-photo {
      transform: scale(1.06) translateY(7px);
    }
    .variant-c .player-name {
      bottom: 154px;
      font-size: 2.46rem;
    }
    .variant-c .divider { bottom: 139px; }
    .variant-c .stats {
      left: 46px;
      right: 46px;
      bottom: 52px;
      column-gap: 20px;
    }
    .variant-d .rating {
      top: 83px;
      left: 38px;
      font-size: 3.7rem;
    }
    .variant-d .position {
      top: 138px;
      left: 42px;
      font-size: 1.8rem;
    }
    .variant-d .positions-list { left: 43px; top: 170px; }
    .variant-d .photo-frame {
      top: 94px;
      left: 99px;
      width: 188px;
      height: 206px;
      border-radius: 42% 42% 30% 30%;
      clip-path: ellipse(48% 50% at 50% 50%);
    }
    .variant-d .player-photo {
      transform: scale(1.08) translateY(8px);
    }
    .variant-d .player-name {
      left: 34px;
      right: 34px;
      bottom: 150px;
      font-size: 2.36rem;
      padding-top: 12px;
      background: linear-gradient(180deg, transparent, rgba(7,19,15,.24) 24%);
    }
    .variant-d .divider { bottom: 136px; }
    .variant-d .stats {
      bottom: 50px;
      left: 47px;
      right: 47px;
      column-gap: 18px;
      font-size: 1.7rem;
    }
    .compact-card {
      position: relative;
      width: 92px;
      aspect-ratio: 409 / 620;
      overflow: hidden;
      color: #f7fff9;
      font-family: "Barlow Condensed", Impact, sans-serif;
      background: url("assets/card-backgrounds/reference-compact-gold.png") center / contain no-repeat;
      filter: drop-shadow(0 5px 7px rgba(2, 14, 9, .22));
    }
    .compact-rating {
      position: absolute;
      z-index: 4;
      top: 16.5%;
      left: 15.5%;
      font-size: 1.28rem;
      font-weight: 900;
      line-height: .82;
      text-shadow: 0 2px 0 rgba(0,0,0,.78), 0 1px 5px rgba(0,0,0,.46);
    }
    .compact-position {
      position: absolute;
      z-index: 4;
      top: 27.5%;
      left: 16.5%;
      font-size: .54rem;
      font-weight: 900;
      line-height: 1;
      text-shadow: 0 2px 0 rgba(0,0,0,.78), 0 1px 5px rgba(0,0,0,.46);
    }
    .compact-photo-frame {
      position: absolute;
      z-index: 2;
      top: 18%;
      left: 41%;
      width: 38%;
      height: 31%;
      overflow: hidden;
      border: 1px solid rgba(248, 229, 137, .32);
      border-radius: 48% 48% 42% 42%;
      background:
        radial-gradient(circle at 50% 25%, rgba(255,255,255,.14), transparent 44%),
        linear-gradient(180deg, rgba(6, 28, 19, .16), rgba(6, 28, 19, .46));
      box-shadow: inset 0 0 0 1px rgba(7, 19, 15, .28);
    }
    .compact-photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      object-position: center center;
      transform: scale(1.1) translateY(2px);
    }
    .compact-name {
      position: absolute;
      z-index: 4;
      left: 12%;
      right: 11%;
      bottom: 25%;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: .72rem;
      font-weight: 900;
      line-height: .92;
      text-shadow: 0 2px 0 rgba(0,0,0,.78), 0 1px 5px rgba(0,0,0,.46);
    }
    .compact-statline {
      position: absolute;
      z-index: 4;
      left: 18%;
      right: 16%;
      bottom: 15%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px 8px;
      font-size: .44rem;
      font-weight: 900;
      line-height: .95;
      text-shadow: 0 2px 0 rgba(0,0,0,.78), 0 1px 5px rgba(0,0,0,.46);
    }
    .compact-stat {
      display: grid;
      grid-template-columns: 12px 1fr;
      gap: 2px;
      white-space: nowrap;
    }
    @media (max-width: 1180px) {
      .preview-grid { grid-template-columns: repeat(2, minmax(250px, 1fr)); }
    }
    @media (max-width: 650px) {
      .page { padding: 10px; }
      .toolbar { grid-template-columns: 1fr; }
      .preview-grid { grid-template-columns: 1fr; }
      select { min-width: 0; width: 100%; }
      .player-card { width: min(100%, 300px); }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="toolbar">
      <div>
        <h1>Previews de card</h1>
        <p>Comparacion aislada. No modifica el diseno real hasta elegir una variante.</p>
      </div>
      <label>
        Jugador
        <select id="playerSelect"></select>
      </label>
    </section>

    <section class="preview-grid" aria-label="Variantes de card">
      <article class="preview-item">
        <h2>1. Oval limpia</h2>
        <p>Foto dentro de ovalo, centrada en rostro y separada del texto.</p>
        <div class="player-card variant-a" data-preview-card></div>
      </article>
      <article class="preview-item">
        <h2>2. Escudo central</h2>
        <p>Recorte geometrico tipo escudo, con margen claro dentro de la card.</p>
        <div class="player-card variant-b" data-preview-card></div>
      </article>
      <article class="preview-item">
        <h2>3. Hex rostro</h2>
        <p>Marco hexagonal compacto para que ninguna foto invada texto o borde.</p>
        <div class="player-card variant-c" data-preview-card></div>
      </article>
      <article class="preview-item">
        <h2>4. Ventana curva</h2>
        <p>Recorte superior amplio, sin superposicion y con stats despejadas.</p>
        <div class="player-card variant-d" data-preview-card></div>
      </article>
    </section>

    <section class="compact-section" aria-label="Preview compacto">
      <h2>Compacta con recorte oval</h2>
      <p>Misma disposicion de imagen, adaptada a carta chica de cancha. Usa datos reales de la base.</p>
      <div class="compact-row" data-compact-row></div>
    </section>
  </main>

  <script>
    const players = <?php echo json_encode($previewPlayers, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>;
    const escapeHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const cardHtml = (player, variantClass) => {
      const stats = Object.entries(player.stats || {}).map(([label, value]) => `
        <span class="stat"><b>${Number(value || 0)}</b><span>${escapeHtml(label)}</span></span>
      `).join('');
      const positions = (player.positions || []).slice(0, 2).map((position) => `<span>${escapeHtml(position)}</span>`).join('');
      return `
        <strong class="rating">${Number(player.rating || 0)}</strong>
        <strong class="position">${escapeHtml(player.position || '')}</strong>
        <span class="positions-list">${positions}</span>
        <span class="photo-frame"><img class="player-photo" src="${escapeHtml(player.photo)}" alt=""></span>
        <strong class="player-name">${escapeHtml(player.name || '')}</strong>
        <span class="divider" aria-hidden="true"></span>
        <div class="stats">${stats}</div>
      `;
    };

    const compactCardHtml = (player) => {
      const statEntries = Object.entries(player.stats || {}).slice(0, 4);
      return `
        <article class="compact-card" aria-label="Compacta de ${escapeHtml(player.name || '')}">
          <strong class="compact-rating">${Number(player.rating || 0)}</strong>
          <strong class="compact-position">${escapeHtml(player.position || '')}</strong>
          <span class="compact-photo-frame"><img class="compact-photo" src="${escapeHtml(player.photo)}" alt=""></span>
          <strong class="compact-name">${escapeHtml(player.name || '')}</strong>
          <span class="compact-statline">
            ${statEntries.map(([label, value]) => `<span class="compact-stat"><b>${Number(value || 0)}</b><span>${escapeHtml(label)}</span></span>`).join('')}
          </span>
        </article>
      `;
    };

    const select = document.getElementById('playerSelect');
    players.forEach((player, index) => {
      const option = document.createElement('option');
      option.value = String(index);
      option.textContent = `${player.name} (${player.position} ${player.rating})`;
      select.appendChild(option);
    });

    function render() {
      const player = players[Number(select.value || 0)] || players[0];
      document.querySelectorAll('[data-preview-card]').forEach((card) => {
        const variantClass = Array.from(card.classList).find((className) => className.startsWith('variant-')) || 'variant-a';
        card.innerHTML = cardHtml(player, variantClass);
      });
      const compactPlayers = [player, ...players.filter((candidate) => candidate.id !== player.id)].slice(0, 8);
      document.querySelector('[data-compact-row]').innerHTML = compactPlayers.map(compactCardHtml).join('');
    }

    select.addEventListener('change', render);
    render();
  </script>
</body>
</html>
