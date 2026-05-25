import { useMemo, useState } from 'react';

const cardBackgrounds = {
  bronze: 'assets/card-backgrounds/reference-bronze.png',
  silver: 'assets/card-backgrounds/reference-silver.png',
  gold: 'assets/card-backgrounds/reference-gold.png',
  elite: 'assets/card-backgrounds/reference-elite.png',
};

const cardPalettes = {
  bronze: {
    text: 'text-[#f0b170] [text-shadow:0_2px_0_rgba(0,0,0,.74),0_1px_5px_rgba(0,0,0,.38)]',
    separator: 'bg-[#f0b170]/34',
  },
  silver: {
    text: 'text-[#e8eeea] [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.42)]',
    separator: 'bg-[#e8eeea]/32',
  },
  gold: {
    text: 'text-[#f5d867] [text-shadow:0_2px_0_rgba(0,0,0,.72),0_1px_5px_rgba(0,0,0,.36)]',
    separator: 'bg-[#f5d867]/34',
  },
  elite: {
    text: 'text-[#a5fff0] [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.42)]',
    separator: 'bg-[#a5fff0]/34',
  },
};

const statFields = ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity'];
const anchors = [[1, 35], [2.5, 54], [3, 64], [3.2, 69], [3.5, 74], [3.8, 79], [4, 81], [4.4, 86], [4.5, 87], [5, 92], [5.2, 93], [5.3, 94], [6, 99]];
const positionWeights = {
  ARQ: { goalkeeper_skill: 0.42, defense_physical: 0.14, rhythm: 0.1, technique: 0.1, teamwork: 0.14, mentality: 0.1 },
  DEF: { defense_physical: 0.28, rhythm: 0.2, technique: 0.18, teamwork: 0.13, mentality: 0.13, attack: 0.08 },
  LAT: { rhythm: 0.24, defense_physical: 0.22, technique: 0.17, teamwork: 0.15, attack: 0.12, mentality: 0.1 },
  DEL: { attack: 0.31, rhythm: 0.2, technique: 0.17, teamwork: 0.14, mentality: 0.1, defense_physical: 0.08 },
  MED: { technique: 0.24, rhythm: 0.23, teamwork: 0.19, mentality: 0.13, defense_physical: 0.12, attack: 0.09 },
};

function parsePayload(root) {
  try {
    const parsed = JSON.parse(root.dataset.payload || '{}');
    return {
      players: Array.isArray(parsed.players) ? parsed.players : [],
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      summary: parsed.summary || { active: 0, average: 0, top: 0 },
      links: parsed.links || {},
      isAdmin: parsed.isAdmin === true,
      showInactive: parsed.showInactive === true,
    };
  } catch {
    return { players: [], positions: [], summary: { active: 0, average: 0, top: 0 }, links: {}, isAdmin: false, showInactive: false };
  }
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function normalizeSix(value, fallback = 3) {
  const number = Number.parseFloat(String(value ?? ''));
  const base = Number.isFinite(number) ? number : fallback;
  return Math.max(1, Math.min(6, Math.round(base * 10) / 10));
}

function sixFromOverall(value) {
  const overall = Math.max(35, Math.min(99, Math.round(Number(value) || 64)));
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = anchors[index];
    const [toRating, toOverall] = anchors[index + 1];
    if (overall <= toOverall) {
      const ratio = (overall - fromOverall) / (toOverall - fromOverall);
      return normalizeSix(fromRating + ((toRating - fromRating) * ratio));
    }
  }
  return 6;
}

function overallFromSix(value) {
  const clamped = Math.max(1, Math.min(6, Number(value) || 1));
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = anchors[index];
    const [toRating, toOverall] = anchors[index + 1];
    if (clamped <= toRating) {
      const ratio = (clamped - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 99;
}

function formatSix(value) {
  const rating = normalizeSix(value);
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

function toneClass(overall) {
  if (overall >= 88) return 'bg-emerald-600';
  if (overall >= 76) return 'bg-lime-600';
  if (overall >= 65) return 'bg-amber-600';
  return 'bg-red-600';
}

function Arrow({ form }) {
  const color = form === 'up' ? '#1ec7f2' : form === 'down' ? '#ef2b2b' : '#a7ec35';
  const rotate = form === 'down' ? 'rotate(180deg)' : form === 'right' ? 'rotate(90deg)' : 'none';
  return (
    <span className="relative block h-full w-full" style={{ transform: rotate }} aria-hidden="true">
      <span className="absolute inset-0 [clip-path:polygon(50%_0,100%_48%,70%_48%,70%_100%,30%_100%,30%_48%,0_48%)] bg-[#07130f]" />
      <span className="absolute inset-[4px] [clip-path:polygon(50%_0,100%_48%,70%_48%,70%_100%,30%_100%,30%_48%,0_48%)]" style={{ backgroundColor: color }} />
    </span>
  );
}

function PlayerCard({ player, onOpen }) {
  const cardImage = cardBackgrounds[player.tier] || cardBackgrounds.bronze;
  const palette = cardPalettes[player.tier] || cardPalettes.bronze;
  const cardTextClass = palette.text;
  const separatorClass = palette.separator;
  const integratedTintClass = 'from-transparent via-[#07130f]/6 to-[#07130f]/34';
  const isLongName = player.name.length > 12;

  return (
    <button
      type="button"
      className="relative mx-auto block aspect-[409/710] w-[clamp(126px,calc((100vw-36px)/2),156px)] overflow-visible border-0 bg-transparent p-0 text-[#07130f] drop-shadow-[0_7px_12px_rgba(2,14,9,0.22)] sm:w-[168px]"
      style={{ background: `url("${cardImage}") center / contain no-repeat`, fontFamily: '"Barlow Condensed", sans-serif' }}
      data-j2-card-tier={player.tier}
      onClick={() => onOpen(player.id)}
      aria-label={`Ver ficha de ${player.name}`}
    >
      <span className={`absolute left-[9%] right-[8%] top-[8.8%] z-20 h-[49%] bg-gradient-to-b ${integratedTintClass}`} aria-hidden="true" />

      <span
        className={`absolute left-[14.2%] top-[13.8%] z-30 grid h-[26%] w-[23.2%] grid-rows-[auto_auto] content-start justify-items-center overflow-visible px-0.5 pt-0.5 ${cardTextClass}`}
        data-j2-card-rating-panel
      >
        <span className="block text-[1.87rem] font-black leading-[.8] sm:text-[2.03rem]">{player.overall}</span>
        <span className="mt-[5px] grid justify-items-center gap-[1px] text-center leading-none">
          <span className="block text-[.81rem] font-black uppercase leading-none sm:text-[.86rem]">{player.primaryPosition}</span>
          {player.secondaryPosition ? (
            <span className="block text-[.59rem] font-black uppercase leading-none opacity-85 sm:text-[.65rem]">{player.secondaryPosition}</span>
          ) : null}
          <span className="mt-[3px] block aspect-square w-[14px] sm:w-[15px]" data-j2-regularity-arrow>
            <Arrow form={player.regularityForm} />
          </span>
        </span>
      </span>

      <span
        className="absolute left-[33.6%] right-[10.5%] top-[10.9%] z-10 flex h-[40.9%] items-start justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,.10),transparent_50%)]"
        style={{ WebkitMaskImage: 'linear-gradient(180deg,#000 0 74%,transparent 100%)', maskImage: 'linear-gradient(180deg,#000 0 74%,transparent 100%)' }}
      >
        {player.photo ? (
          <img className={`h-full w-full ${player.hasCustomPhoto ? 'object-cover object-top' : 'object-contain object-top opacity-56'}`} src={player.photo} alt="" />
        ) : null}
      </span>

      <span className={`absolute left-[12.1%] right-[10.9%] top-[53.3%] z-30 grid h-[7.8%] place-items-center overflow-hidden px-1 text-center ${isLongName ? 'text-[.86rem] sm:text-[.95rem]' : 'text-[1.17rem] sm:text-[1.28rem]'} font-black uppercase leading-none text-ellipsis whitespace-nowrap ${cardTextClass}`}>
        {player.name}
      </span>

      <span className={`absolute left-[20.3%] right-[20.3%] top-[62.8%] z-30 block h-px ${separatorClass}`} aria-hidden="true" />

      <span className="absolute left-[17.3%] right-[16.1%] top-[66.7%] z-30 grid h-[17%] grid-cols-2 grid-rows-3 gap-x-[7%] gap-y-0 overflow-visible px-[1.8%] py-[.9%]">
        <span className={`absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 ${separatorClass}`} aria-hidden="true" />
        {player.cardStats.map((stat) => (
          <span key={`${player.id}-${stat.label}`} className={`grid grid-cols-[1.18rem_minmax(0,1fr)] items-center gap-[3px] overflow-visible ${cardTextClass}`}>
            <span className="text-right text-[.94rem] font-black leading-none sm:text-[1.03rem]">{stat.value}</span>
            <span className="text-[.77rem] font-black uppercase leading-none sm:text-[.85rem]">{stat.label}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

function PositionChips({ positions }) {
  const visible = positions?.length ? positions : ['Sin posicion'];
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((position) => (
        <span key={position} className="inline-flex min-h-6 items-center border border-emerald-100 bg-emerald-50 px-2 text-[11px] font-extrabold text-[#07130f]">
          {position}
        </span>
      ))}
    </div>
  );
}

function OverallBadge({ value }) {
  return (
    <span className="inline-grid min-h-10 min-w-11 place-items-center border border-emerald-100 bg-white px-2 text-center text-[#07130f]">
      <b className="text-base font-black leading-none">{value}</b>
      <em className="not-italic text-[10px] font-extrabold leading-none text-slate-500">GEN</em>
    </span>
  );
}

function radarPoint(center, radius, index, total) {
  const angle = (-90 + (360 / total) * index) * Math.PI / 180;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function RadarSvg({ stats }) {
  const visible = (stats || []).filter((stat) => Number(stat.value) > 0);
  if (visible.length < 3) {
    return <div className="grid min-h-48 place-items-center text-sm font-extrabold text-slate-500">Radar no disponible</div>;
  }
  const size = 260;
  const center = 130;
  const maxRadius = 86;
  const total = visible.length;
  const shape = visible.map((stat, index) => {
    const point = radarPoint(center, maxRadius * (Number(stat.value) / 6), index, total);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="mx-auto block aspect-square w-full max-w-[260px]" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de stats">
      {[0.25, 0.5, 0.75, 1].map((step) => {
        const points = visible.map((_, index) => {
          const point = radarPoint(center, maxRadius * step, index, total);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        }).join(' ');
        return <polygon key={step} points={points} fill="none" stroke="rgba(6,61,43,.16)" strokeWidth="1" />;
      })}
      {visible.map((stat, index) => {
        const axis = radarPoint(center, maxRadius, index, total);
        const label = radarPoint(center, maxRadius + 22, index, total);
        return (
          <g key={stat.field}>
            <line x1={center} y1={center} x2={axis.x.toFixed(1)} y2={axis.y.toFixed(1)} stroke="rgba(6,61,43,.18)" strokeWidth="1" />
            <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor="middle" fill="#07130f" fontSize="11" fontWeight="900">{stat.short}</text>
          </g>
        );
      })}
      <polygon points={shape} fill="rgba(6,61,43,.18)" stroke="#063d2b" strokeWidth="3" />
      {visible.map((stat, index) => {
        const point = radarPoint(center, maxRadius * (Number(stat.value) / 6), index, total);
        return <circle key={`${stat.field}-dot`} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="3.8" fill="#063d2b" />;
      })}
    </svg>
  );
}

function StatLine({ stat }) {
  const overall = Number(stat.overall) || 0;
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-2 text-sm font-extrabold text-[#07130f]">
      <span>{stat.short}</span>
      <span className="h-2 overflow-hidden bg-emerald-50">
        <i className={`block h-full ${toneClass(overall)}`} style={{ width: `${Math.max(10, Math.min(100, (overall / 99) * 100))}%` }} />
      </span>
      <b className="text-right">{overall}</b>
    </div>
  );
}

function ReadonlyProfile({ player, onRadarOpen }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <button type="button" className="border border-emerald-100 bg-white p-4 text-left" onClick={() => onRadarOpen(player)} aria-label={`Ver radar completo de ${player.name}`}>
          <RadarSvg stats={player.allStats} />
        </button>
        <div className="grid content-start gap-3">
          <PositionChips positions={player.positions} />
          <p className="m-0 border border-emerald-100 bg-emerald-50/50 p-3 text-sm font-semibold leading-relaxed text-slate-700">{player.description}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <article className="border border-emerald-100 bg-white p-3"><span className="text-xs font-extrabold text-slate-500">Promedio</span><strong className="block text-lg font-black text-[#07130f]">{player.overall}</strong></article>
            <article className="border border-emerald-100 bg-white p-3"><span className="text-xs font-extrabold text-slate-500">Fuerte</span><strong className="block text-sm font-black text-[#07130f]">{player.bestStat?.label || '-'}</strong></article>
            <article className="border border-emerald-100 bg-white p-3"><span className="text-xs font-extrabold text-slate-500">A cuidar</span><strong className="block text-sm font-black text-[#07130f]">{player.weakStat?.label || '-'}</strong></article>
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {player.allStats.map((stat) => (
          <article key={stat.field} className="border border-emerald-100 bg-white p-3">
            <StatLine stat={stat} />
            <p className="m-0 mt-2 text-xs font-semibold leading-relaxed text-slate-500">{stat.help || 'Sin descripcion disponible.'}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function AdminEditForm({ player, positions }) {
  const initialOveralls = useMemo(() => Object.fromEntries(player.allStats.map((stat) => [stat.field, Number(stat.overall) || 64])), [player]);
  const [name, setName] = useState(player.name);
  const [primary, setPrimary] = useState(player.primaryPosition || '');
  const [secondary, setSecondary] = useState(player.secondaryPosition || '');
  const [active, setActive] = useState(player.isActive);
  const [overallValues, setOverallValues] = useState(initialOveralls);
  const [photoUrl, setPhotoUrl] = useState(player.photo);
  const [photoName, setPhotoName] = useState(player.hasCustomPhoto ? 'Foto actual cargada. Elegi otra para reemplazarla.' : 'JPG, PNG o WEBP hasta 3 MB');
  const [openHelp, setOpenHelp] = useState(null);

  const displayedOverall = useMemo(() => {
    const weights = positionWeights[primary] || positionWeights.MED;
    let rating = Object.entries(weights).reduce((total, [field, weight]) => total + (sixFromOverall(overallValues[field] || 64) * weight), 0);
    const regularity = sixFromOverall(overallValues.regularity || 74);
    rating = Math.max(1, Math.min(6, rating * (1 + ((regularity - 3.5) / 50))));
    return overallFromSix(Math.round(rating * 10) / 10);
  }, [overallValues, primary]);

  const setOverall = (field, value) => {
    const next = Math.max(35, Math.min(99, Math.round(Number(value) || 64)));
    setOverallValues((current) => ({ ...current, [field]: next }));
  };

  const selected = [primary, secondary].filter(Boolean);
  const visibleFields = primary === 'ARQ' ? [...statFields, 'goalkeeper_skill'] : statFields;

  return (
    <form className="grid gap-4 border border-emerald-100 bg-white p-4" method="post" encType="multipart/form-data">
      <input type="hidden" name="action" value="save" />
      <input type="hidden" name="id" value={player.id} />

      <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3">
        <strong className="text-base font-black text-[#07130f]">Editar jugador</strong>
        <OverallBadge value={displayedOverall} />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto]">
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Nombre
          <input className="min-h-10 border border-emerald-100 bg-white px-3 text-sm font-bold text-[#07130f] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" type="text" name="name" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Primaria
          <select className="min-h-10 border border-emerald-100 bg-white px-3 text-sm font-bold text-[#07130f] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" name="positions[]" required value={primary} onChange={(event) => setPrimary(event.target.value)}>
            <option value="" disabled>Elegir</option>
            {positions.map((position) => (
              <option key={position.value} value={position.value} disabled={position.value !== primary && selected.includes(position.value)}>{position.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Secundaria
          <select className="min-h-10 border border-emerald-100 bg-white px-3 text-sm font-bold text-[#07130f] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" name="positions[]" value={secondary} onChange={(event) => setSecondary(event.target.value)}>
            <option value="">Sin posicion</option>
            {positions.map((position) => (
              <option key={position.value} value={position.value} disabled={position.value !== secondary && selected.includes(position.value)}>{position.label}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 self-end border border-emerald-100 bg-emerald-50 px-3 text-sm font-extrabold text-[#07130f]">
          <input type="checkbox" name="active" value="1" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Activo
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="grid gap-2 border border-emerald-100 bg-emerald-50/50 p-3 text-center">
          <span className="mx-auto grid h-40 w-36 place-items-center overflow-hidden border border-emerald-100 bg-white">
            <img className={`h-full w-full object-contain ${player.hasCustomPhoto ? '' : 'opacity-60'}`} src={photoUrl} alt="" />
          </span>
          <label className="grid cursor-pointer gap-1 border border-emerald-900 bg-emerald-950 px-3 py-2 text-center text-xs font-black text-white">
            <span>{player.hasCustomPhoto ? 'Cambiar foto' : 'Elegir foto'}</span>
            <input
              className="sr-only"
              type="file"
              name="player_photo"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !file.type.startsWith('image/')) return;
                setPhotoUrl(URL.createObjectURL(file));
                setPhotoName(file.name);
              }}
            />
          </label>
          <small className="text-xs font-semibold text-slate-500">{photoName}</small>
        </aside>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleFields.map((field) => {
            const stat = player.allStats.find((item) => item.field === field);
            if (!stat) return null;
            const overall = overallValues[field] || Number(stat.overall) || 64;
            const dirty = overall !== initialOveralls[field];
            return (
              <label key={field} className={`grid gap-2 border p-3 ${dirty ? 'border-amber-300 bg-amber-50' : 'border-emerald-100 bg-white'}`}>
                <span className="grid gap-1">
                  <button type="button" className="text-left text-sm font-black text-[#07130f]" onClick={() => setOpenHelp(openHelp === field ? null : field)} aria-expanded={openHelp === field}>{stat.label}</button>
                  {openHelp === field ? <em className="not-italic text-xs font-semibold leading-relaxed text-slate-500">{stat.help}</em> : null}
                </span>
                <input type="hidden" name={field} value={sixFromOverall(overall).toFixed(1)} />
                <div className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-3">
                  <input className="h-10 border border-emerald-100 bg-white px-2 text-center text-base font-black text-[#07130f] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" type="number" name={`${field}_overall`} min="35" max="99" step="1" inputMode="numeric" value={overall} onChange={(event) => setOverall(field, event.target.value)} aria-label={`${stat.label} en escala 1 a 99`} />
                  <input className="w-full accent-emerald-800" type="range" min="35" max="99" step="1" value={overall} onChange={(event) => setOverall(field, event.target.value)} aria-label={`Ajustar ${stat.label} en escala 1 a 99`} />
                </div>
                <small className="text-xs font-extrabold text-slate-500">{formatSix(sixFromOverall(overall))}/6</small>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="min-h-11 border border-emerald-950 bg-emerald-950 px-5 text-sm font-black text-white hover:bg-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-100" type="submit">
          Guardar todo
        </button>
      </div>
    </form>
  );
}

function PlayerModal({ player, isAdmin, positions, onClose, onRadarOpen }) {
  if (!player) return null;
  return (
    <>
      <button className="fixed inset-0 z-40 block bg-black/55" type="button" aria-label="Cerrar ficha" onClick={onClose} />
      <section className="fixed inset-x-3 top-4 bottom-4 z-50 mx-auto grid max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-emerald-100 bg-white shadow-[0_18px_55px_rgba(7,19,15,.22)] md:inset-x-8" role="dialog" aria-modal="true" aria-label={`Ficha de ${player.name}`}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-emerald-100 bg-emerald-50/70 p-4">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-xl font-black text-[#07130f]">{player.name}</h2>
            <p className="m-0 text-sm font-semibold text-slate-500">{player.positionsText || 'Sin posicion'} | {player.isActive ? 'Activo' : 'Inactivo'}</p>
          </div>
          <OverallBadge value={player.overall} />
          <button className="grid h-10 w-10 place-items-center border border-emerald-100 bg-white text-xl font-black text-[#07130f]" type="button" onClick={onClose} aria-label="Cerrar ficha">x</button>
        </header>
        <div className="grid gap-4 overflow-auto p-4">
          {isAdmin ? (
            <AdminEditForm key={player.id} player={player} positions={positions} />
          ) : (
            <ReadonlyProfile player={player} onRadarOpen={onRadarOpen} />
          )}
          <details className="border border-emerald-100 bg-emerald-50/50 p-3">
            <summary className="cursor-pointer text-sm font-black text-[#07130f]">Ver ayuda de stats</summary>
            <p className="m-0 mt-2 text-sm font-semibold text-slate-600">La ficha muestra el radar, la lectura general y la explicacion de cada stat. Esta pagina usa React y Tailwind para la interfaz.</p>
          </details>
          <button className="min-h-10 border border-emerald-100 bg-white px-4 text-sm font-black text-[#07130f]" type="button" onClick={onClose}>Cerrar</button>
        </div>
      </section>
    </>
  );
}

function RadarOverlay({ player, onClose }) {
  if (!player) return null;
  return (
    <>
      <button className="fixed inset-0 z-[60] bg-black/60" type="button" aria-label="Cerrar radar" onClick={onClose} />
      <section className="fixed inset-x-4 top-10 z-[70] mx-auto max-w-md border border-emerald-100 bg-white p-4 shadow-[0_18px_55px_rgba(7,19,15,.24)]" role="dialog" aria-modal="true" aria-label={`Radar completo de ${player.name}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <strong className="text-base font-black text-[#07130f]">{player.name}</strong>
          <button className="grid h-9 w-9 place-items-center border border-emerald-100 bg-white text-lg font-black text-[#07130f]" type="button" onClick={onClose} aria-label="Cerrar radar">x</button>
        </div>
        <RadarSvg stats={player.allStats} />
      </section>
    </>
  );
}

export function Jugadores2PageIsland({ root }) {
  const payload = useMemo(() => parsePayload(root), [root]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [topSort, setTopSort] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [radarId, setRadarId] = useState(null);

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered = payload.players.filter((player) => {
      const matchesFilter = filter === 'all' || player.group === filter;
      const matchesQuery = normalizedQuery === '' || normalize(`${player.search} ${player.overall} ${player.rating}`).includes(normalizedQuery);
      return matchesFilter && matchesQuery;
    });
    if (!topSort) return filtered;
    return filtered.slice().sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0));
  }, [filter, payload.players, query, topSort]);

  const activePlayer = payload.players.find((player) => String(player.id) === String(activeId)) || null;
  const radarPlayer = payload.players.find((player) => String(player.id) === String(radarId)) || null;

  return (
    <div className="grid gap-4">
      <section className="grid items-end gap-4 border border-emerald-100 bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="m-0 text-2xl font-black text-[#07130f]">Jugadores</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-slate-500">Plantilla, posiciones y rendimiento actual.</p>
        </div>
        <div className="grid grid-cols-3 gap-2" aria-label="Resumen de jugadores">
          <article className="min-w-20 border border-emerald-100 bg-emerald-50 p-2"><span className="block text-[11px] font-extrabold text-slate-500">Activos</span><strong className="block text-lg font-black text-[#07130f]">{payload.summary.active}</strong></article>
          <article className="min-w-20 border border-emerald-100 bg-emerald-50 p-2"><span className="block text-[11px] font-extrabold text-slate-500">Promedio</span><strong className="block text-lg font-black text-[#07130f]">{payload.summary.average}</strong></article>
          <article className="min-w-20 border border-emerald-100 bg-emerald-50 p-2"><span className="block text-[11px] font-extrabold text-slate-500">Top</span><strong className="block text-lg font-black text-[#07130f]">{payload.summary.top}</strong></article>
        </div>
      </section>

      <section className="grid gap-3 border border-emerald-100 bg-emerald-50/70 p-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]" aria-label="Controles de jugadores">
        <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
          <input className="min-h-11 w-full border border-emerald-100 bg-white px-3 text-sm font-bold text-[#07130f] outline-none placeholder:text-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" type="search" placeholder="Buscar jugador, posicion o stat" aria-label="Buscar jugador" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="grid min-h-11 place-items-center border border-emerald-950 bg-emerald-950 text-sm font-black text-white" type="button" onClick={() => setQuery(query.trim())} aria-label="Buscar">
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-6" aria-label="Filtrar jugadores">
          {[
            ['all', 'Todos'],
            ['arq', 'Arq'],
            ['def', 'Def'],
            ['med', 'Med'],
            ['del', 'Del'],
          ].map(([key, label]) => (
            <button key={key} className={`min-h-9 border px-2 text-xs font-black ${filter === key ? 'border-emerald-950 bg-emerald-950 text-white' : 'border-emerald-100 bg-white text-[#07130f]'}`} type="button" onClick={() => setFilter(key)}>{label}</button>
          ))}
          <button className={`min-h-9 border px-2 text-xs font-black ${topSort ? 'border-emerald-950 bg-emerald-950 text-white' : 'border-emerald-100 bg-white text-[#07130f]'}`} type="button" onClick={() => setTopSort((current) => !current)}>Top</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {payload.isAdmin && payload.links.toggleInactive ? <a className="inline-flex min-h-9 items-center border border-emerald-100 bg-white px-3 text-xs font-black text-[#07130f] no-underline" href={payload.links.toggleInactive}>{payload.showInactive ? 'Ver solo activos' : 'Ver inactivos'}</a> : null}
          <a className="inline-flex min-h-9 items-center border border-emerald-100 bg-white px-3 text-xs font-black text-[#07130f] no-underline" href={payload.links.backup || 'jugadores.php'}>Backup jugadores</a>
        </div>
      </section>

      {visiblePlayers.length === 0 ? (
        <p className="m-0 border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">No hay jugadores que coincidan con la busqueda.</p>
      ) : null}

      <section className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" aria-label="Tarjetas de jugadores">
        {visiblePlayers.map((player) => (
          <article key={player.id} data-j2-player-id={player.id}>
            <PlayerCard player={player} onOpen={setActiveId} />
          </article>
        ))}
      </section>

      <section className="overflow-hidden border border-emerald-100 bg-white" aria-label="Tabla de jugadores">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-emerald-50">
            <tr>
              <th className="border-b border-emerald-100 px-3 py-2 text-left text-xs font-black text-slate-500">Jugador</th>
              <th className="border-b border-emerald-100 px-3 py-2 text-left text-xs font-black text-slate-500">Posicion</th>
              <th className="border-b border-emerald-100 px-3 py-2 text-left text-xs font-black text-slate-500">Media</th>
              <th className="border-b border-emerald-100 px-3 py-2 text-right text-xs font-black text-slate-500">Ficha</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => (
              <tr key={player.id} className="border-b border-emerald-50 last:border-b-0">
                <td className="px-3 py-2">
                  <button className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2 border-0 bg-transparent p-0 text-left" type="button" onClick={() => setActiveId(player.id)}>
                    <span className="grid h-8 w-8 place-items-center bg-emerald-50 text-xs font-black text-emerald-950">{player.initials}</span>
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-black text-[#07130f]">{player.name}</strong>
                      <small className="text-xs font-bold text-slate-500">{player.isActive ? 'Activo' : 'Inactivo'} | GEN {player.overall}</small>
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2"><PositionChips positions={player.positions} /></td>
                <td className="px-3 py-2"><OverallBadge value={player.overall} /></td>
                <td className="px-3 py-2 text-right"><button className="min-h-9 border border-emerald-100 bg-white px-3 text-xs font-black text-[#07130f]" type="button" onClick={() => setActiveId(player.id)}>Ver ficha</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <PlayerModal player={activePlayer} isAdmin={payload.isAdmin} positions={payload.positions} onClose={() => setActiveId(null)} onRadarOpen={(player) => setRadarId(player.id)} />
      <RadarOverlay player={radarPlayer} onClose={() => setRadarId(null)} />
    </div>
  );
}
