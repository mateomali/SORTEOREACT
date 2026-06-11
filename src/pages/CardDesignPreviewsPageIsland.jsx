import { useMemo, useState } from 'react';

function readPayload(root) {
  try {
    return JSON.parse(root.dataset.payload || '{}');
  } catch {
    return {};
  }
}

const previewDescriptions = [
  ['variant-a', '1. Oval limpia', 'Foto dentro de ovalo, centrada en rostro y separada del texto.'],
  ['variant-b', '2. Escudo central', 'Recorte geometrico tipo escudo, con margen claro dentro de la card.'],
  ['variant-c', '3. Hex rostro', 'Marco hexagonal compacto para que ninguna foto invada texto o borde.'],
  ['variant-d', '4. Ventana curva', 'Recorte superior amplio, sin superposicion y con stats despejadas.'],
];

const variantFrame = {
  'variant-a': 'left-[30%] top-[16%] h-[25%] w-[36%] rounded-[48%_48%_42%_42%]',
  'variant-b': 'left-[26%] top-[14%] h-[29%] w-[43%] [clip-path:polygon(50%_0,92%_18%,86%_76%,50%_100%,14%_76%,8%_18%)]',
  'variant-c': 'left-[26%] top-[14%] h-[27%] w-[43%] [clip-path:polygon(50%_0,90%_25%,90%_75%,50%_100%,10%_75%,10%_25%)]',
  'variant-d': 'left-[24%] top-[13%] h-[30%] w-[46%] rounded-[42%_42%_30%_30%] [clip-path:ellipse(48%_50%_at_50%_50%)]',
};

const variantRating = {
  'variant-a': 'left-[13%] top-[11%] text-[3.55rem]',
  'variant-b': 'left-[10%] top-[10%] text-[3.55rem]',
  'variant-c': 'left-[11%] top-[10.5%] text-[3.85rem]',
  'variant-d': 'left-[9%] top-[12%] text-[3.7rem]',
};

const variantPosition = {
  'variant-a': 'left-[14%] top-[18%] text-[1.25rem]',
  'variant-b': 'left-[12%] top-[18.5%] text-[1.25rem]',
  'variant-c': 'left-[12%] top-[18.5%] text-[1.8rem]',
  'variant-d': 'left-[10%] top-[19.5%] text-[1.8rem]',
};

function CardPreview({ player, variant }) {
  const stats = Array.isArray(player?.stats) ? player.stats : [];
  const positions = Array.isArray(player?.positions) ? player.positions.slice(0, 2) : [];

  return (
    <div className="relative aspect-[409/710] w-full max-w-80 overflow-hidden text-lime-50 drop-shadow-md" data-preview-card>
      <img className="absolute inset-0 h-full w-full object-contain" src="assets/card-backgrounds/reference-gold.png" alt="" />
      <strong className={`absolute z-10 font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.72),0_1px_6px_rgba(0,0,0,.44)] ${variantRating[variant]}`}>
        {player?.rating || 0}
      </strong>
      <strong className={`absolute z-10 font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.72),0_1px_6px_rgba(0,0,0,.44)] ${variantPosition[variant]}`}>
        {player?.position || ''}
      </strong>
      <span className="absolute left-[13%] top-[23%] z-10 grid min-w-9 gap-px text-center text-xs font-black leading-none opacity-90 [text-shadow:0_2px_0_rgba(0,0,0,.72),0_1px_6px_rgba(0,0,0,.44)]">
        {positions.map((position) => <span key={position}>{position}</span>)}
      </span>
      <span className={`absolute z-[5] overflow-hidden border border-amber-100/35 bg-emerald-950/30 shadow-inner ${variantFrame[variant]}`}>
        <img className="absolute inset-0 h-full w-full object-contain object-center saturate-100" src={player?.photo || 'assets/players/default-player-silhouette.png'} alt="" />
      </span>
      <strong className="absolute bottom-[21%] left-[12%] right-[12%] z-10 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[2.35rem] font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.76),0_1px_7px_rgba(0,0,0,.48)]">
        {player?.name || ''}
      </strong>
      <span className="absolute bottom-[19%] left-[20%] right-[20%] z-10 h-px bg-white/35" aria-hidden="true" />
      <div className="absolute bottom-[7%] left-[14%] right-[14%] z-10 grid grid-cols-2 gap-x-6 gap-y-1 text-[1.2rem] font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.76),0_1px_7px_rgba(0,0,0,.48)]">
        {stats.map((stat) => (
          <span key={stat.label} className="grid grid-cols-[30px_minmax(0,1fr)] gap-1 whitespace-nowrap">
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CompactCard({ player }) {
  const stats = Array.isArray(player?.stats) ? player.stats.slice(0, 4) : [];

  return (
    <article className="relative aspect-[409/620] w-[92px] overflow-hidden text-lime-50 drop-shadow-md" aria-label={`Compacta de ${player?.name || ''}`}>
      <img className="absolute inset-0 h-full w-full object-contain" src="assets/card-backgrounds/reference-compact-gold.png" alt="" />
      <strong className="absolute left-[15.5%] top-[16.5%] z-10 text-xl font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.46)]">{player?.rating || 0}</strong>
      <strong className="absolute left-[16.5%] top-[27.5%] z-10 text-[0.54rem] font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.46)]">{player?.position || ''}</strong>
      <span className="absolute left-[41%] top-[18%] z-[5] h-[31%] w-[38%] overflow-hidden rounded-[48%_48%_42%_42%] border border-amber-100/35 bg-emerald-950/30">
        <img className="absolute inset-0 h-full w-full object-contain object-center" src={player?.photo || 'assets/players/default-player-silhouette.png'} alt="" />
      </span>
      <strong className="absolute bottom-[25%] left-[12%] right-[11%] z-10 overflow-hidden text-ellipsis whitespace-nowrap text-center text-[0.72rem] font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.46)]">{player?.name || ''}</strong>
      <span className="absolute bottom-[15%] left-[18%] right-[16%] z-10 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[0.44rem] font-black leading-none [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.46)]">
        {stats.map((stat) => (
          <span key={stat.label} className="grid grid-cols-[12px_minmax(0,1fr)] gap-0.5 whitespace-nowrap">
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </span>
        ))}
      </span>
    </article>
  );
}

export function CardDesignPreviewsPageIsland({ root }) {
  const payload = readPayload(root);
  const players = Array.isArray(payload.players) ? payload.players : [];
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selectedPlayer = players[selectedIndex] || players[0] || null;
  const compactPlayers = useMemo(() => {
    if (!selectedPlayer) return [];
    return [selectedPlayer, ...players.filter((player) => player.id !== selectedPlayer.id)].slice(0, 8);
  }, [players, selectedPlayer]);

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15 sm:grid-cols-[minmax(0,1fr)_260px] sm:items-end">
        <div className="min-w-0">
          <h1 className="m-0 text-lime-50">Previews de card</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            Comparacion aislada. No modifica el diseno real hasta elegir una variante.
          </p>
        </div>
        <label className="grid gap-1 text-xs font-black uppercase text-lime-100/85">
          Jugador
          <select
            className="min-h-10 rounded-lg border border-lime-200/40 bg-emerald-950 px-3 text-sm font-bold text-lime-50 outline-none focus:border-lime-200 focus:ring-4 focus:ring-lime-200/20"
            value={selectedIndex}
            onChange={(event) => setSelectedIndex(Number(event.target.value || 0))}
          >
            {players.map((player, index) => (
              <option key={player.id} value={index}>{player.name} ({player.position} {player.rating})</option>
            ))}
          </select>
        </label>
      </section>

      <section className="grid gap-4 xl:grid-cols-4 md:grid-cols-2" aria-label="Variantes de card">
        {previewDescriptions.map(([variant, title, description]) => (
          <article key={variant} className="grid justify-items-center gap-2 rounded-xl border border-lime-200/55 bg-emerald-950 p-3 text-lime-50">
            <h2 className="m-0 w-full text-base font-black text-lime-50">{title}</h2>
            <p className="m-0 min-h-9 w-full text-xs font-semibold leading-snug text-emerald-100/75">{description}</p>
            {selectedPlayer ? <CardPreview player={selectedPlayer} variant={variant} /> : null}
          </article>
        ))}
      </section>

      <section className="rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50">
        <h2 className="m-0 text-base font-black text-lime-50">Compacta con recorte oval</h2>
        <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/75">
          Misma disposicion de imagen, adaptada a carta chica de cancha. Usa datos reales de la base.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {compactPlayers.map((player) => <CompactCard key={player.id} player={player} />)}
        </div>
      </section>
    </div>
  );
}
