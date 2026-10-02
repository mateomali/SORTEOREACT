import React from 'react';

function readPayload(root) {
  try {
    return JSON.parse(root.dataset.payload || '{}');
  } catch {
    return {};
  }
}

const mutedButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900 sm:w-auto';

const tierClasses = {
  bronze: {
    card: 'border-[#8e643f] bg-[linear-gradient(180deg,#f0e0c9_0%,#cfad82_57%,#a4774e_100%)]',
    line: 'border-[#704723]/30',
    name: 'bg-[#f8ead6]/85',
  },
  silver: {
    card: 'border-[#8f9f98] bg-[linear-gradient(180deg,#f6f8f7_0%,#d8e0dd_54%,#aab8b1_100%)]',
    line: 'border-emerald-950/20',
    name: 'bg-[#f5f8f4]/80',
  },
  gold: {
    card: 'border-[#9a6b18] bg-[linear-gradient(180deg,#fff1b9_0%,#dfbd55_55%,#a87820_100%)]',
    line: 'border-[#774c09]/30',
    name: 'bg-[#fff4c7]/85',
  },
  elite: {
    card: 'border-[#765ea5] bg-[linear-gradient(180deg,#fbfdff_0%,#e4edf5_30%,#c5bce4_63%,#70598f_100%)]',
    line: 'border-[#533782]/40',
    name: 'bg-[#f6f1ff]/90',
  },
  supreme: {
    card: 'border-[#dffdf3] bg-[linear-gradient(180deg,#eefdf8_0%,#9fffe6_18%,#122322_54%,#07130f_100%)] text-[#dffdf3]',
    line: 'border-[#9fffe6]/45',
    name: 'bg-[#dffdf3]/85 text-[#07130f]',
  },
};

function PlayerCard({ player }) {
  const tier = tierClasses[player.tier] || tierClasses.bronze;
  const stats = Array.isArray(player.stats) ? player.stats : [];
  const defaultPhoto = String(player.photo || '').includes('default-player-silhouette');

  return (
    <article
      className={`relative grid min-h-[268px] grid-rows-[auto_94px_auto] overflow-hidden border px-[22px] pb-[22px] pt-5 text-[#07130f] shadow-sm [clip-path:polygon(14%_5%,37%_5%,50%_0,63%_5%,86%_5%,94%_14%,94%_78%,86%_92%,50%_100%,14%_92%,6%_78%,6%_14%)] max-[820px]:min-h-[244px] max-[820px]:grid-rows-[auto_82px_auto] max-[820px]:px-4 max-[820px]:pb-5 max-[820px]:pt-[18px] ${tier.card}`}
      aria-label={`Carta de ${player.name}`}
    >
      <span className={`pointer-events-none absolute inset-[9px] border-2 ${tier.line} [clip-path:inherit]`} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-4 border border-white/80 [clip-path:inherit]" aria-hidden="true" />

      <div className="relative z-10 grid grid-cols-[auto_1fr_auto] items-start gap-2 px-3 max-[820px]:px-2">
        <div>
          <strong className="grid min-h-8 w-[38px] place-items-center text-[1.42rem] font-black leading-none max-[820px]:min-h-[27px] max-[820px]:w-[34px] max-[820px]:text-[1.24rem]">
            {player.overall}
          </strong>
          <span className="mt-0.5 block text-[0.64rem] font-black text-[#20382f] max-[820px]:text-[0.56rem]">GEN</span>
          <span className="mt-0.5 block text-[0.64rem] font-black text-[#20382f] max-[820px]:text-[0.56rem]">{player.primary}</span>
          {player.secondary ? (
            <span className="mt-px block text-[0.6rem] font-black text-[#20382f] max-[820px]:text-[0.54rem]">{player.secondary}</span>
          ) : null}
        </div>
        <span />
        <div className={`grid min-h-[22px] min-w-[38px] place-items-center border px-1 text-[0.64rem] font-black max-[820px]:min-h-5 max-[820px]:min-w-8 max-[820px]:text-[0.56rem] ${player.active ? 'border-emerald-950/20 bg-emerald-950/10 text-[#063d2b]' : 'border-red-900/35 bg-red-900/10 text-red-900'}`}>
          {player.active ? 'ACT' : 'INA'}
        </div>
      </div>

      <div className="relative z-10 mt-[-10px] grid min-h-24 place-items-end-center overflow-visible">
        <div className="grid h-[106px] w-[124px] place-items-center overflow-hidden text-[2.15rem] font-black text-[#07130f] max-[820px]:h-[90px] max-[820px]:w-[104px] max-[820px]:text-[1.7rem]">
          {player.photo ? (
            <img
              className={`block h-full w-full object-contain object-center ${defaultPhoto ? 'opacity-90 brightness-0 drop-shadow-md' : ''}`}
              src={player.photo}
              alt=""
            />
          ) : (
            <span>GF</span>
          )}
        </div>
      </div>

      <div className="relative z-10">
        <h2 className={`mx-1 mb-2 mt-px overflow-hidden text-ellipsis whitespace-nowrap border-y-2 border-emerald-950/20 px-2 py-1 text-center text-[0.7rem] font-black max-[820px]:mx-0.5 max-[820px]:mb-1.5 max-[820px]:px-1.5 max-[820px]:py-0.5 max-[820px]:text-[0.58rem] ${tier.name}`}>
          {player.name}
        </h2>
        <div className="relative grid grid-cols-2 gap-x-3.5 gap-y-1 px-5 text-[0.62rem] font-black max-[820px]:gap-x-2.5 max-[820px]:gap-y-0.5 max-[820px]:px-3.5 max-[820px]:text-[0.52rem]">
          <span className="absolute bottom-0 left-1/2 top-0 w-px bg-[#07130f]/40" aria-hidden="true" />
          {stats.map((stat) => (
            <span key={stat.label} className="grid grid-cols-[21px_minmax(0,1fr)] items-baseline gap-1 whitespace-nowrap max-[820px]:grid-cols-[18px_minmax(0,1fr)]">
              <b className="text-right">{stat.value}</b>
              {stat.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function JugadoresCardPreviewPageIsland({ root }) {
  const payload = readPayload(root);
  const players = Array.isArray(payload.players) ? payload.players : [];

  return (
    <div className="grid gap-[18px]">
      <section className="flex flex-col gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-lime-50">Preview tarjetas</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            Cartas visuales usando los valores actuales de jugadores.
          </p>
        </div>
        <a className={mutedButton} href="jugadores2.php">Volver a jugadores</a>
      </section>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-[18px] max-[820px]:grid-cols-2 max-[820px]:gap-3" aria-label="Preview de tarjetas de jugadores">
        {players.map((player) => (
          <PlayerCard key={player.id} player={player} />
        ))}
        {!players.length ? (
          <div className="rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-sm font-semibold text-emerald-100">
            No hay jugadores disponibles para previsualizar.
          </div>
        ) : null}
      </section>
    </div>
  );
}
