import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const statFields = ['technique', 'pass_vision', 'rhythm', 'stamina', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity'];


const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60';
const toolbarLinkClass = `inline-flex min-h-10 items-center justify-center rounded-lg border border-[#adc8bb] bg-white px-3 text-xs font-extrabold text-[#063d2b] no-underline transition-colors hover:border-[#9fc8b5] hover:bg-[#f4fbf7] ${focusRing}`;
const primaryIconButtonClass = `grid min-h-11 w-11 place-items-center rounded-lg border border-[#063d2b] bg-[#063d2b] text-white transition-colors hover:bg-[#082f23] ${focusRing}`;
const rowCredentialButtonClass = `grid h-9 w-9 place-items-center rounded-lg border border-[#d7e6df] bg-white text-[#526b62] transition-colors hover:border-[#9fc8b5] hover:bg-[#f5faf7] hover:text-[#063d2b] sm:h-10 sm:w-10 ${focusRing}`;
const rowEditButtonClass = `grid h-9 w-9 place-items-center rounded-lg border border-[#9fc8b5] bg-[#eaf7f0] text-[#063d2b] transition-colors hover:border-[#063d2b] hover:bg-[#dff1e8] sm:h-10 sm:w-10 ${focusRing}`;
const rowEditWideButtonClass = `grid h-9 w-full place-items-center rounded-lg border border-[#9fc8b5] bg-[#eaf7f0] text-[#063d2b] transition-colors hover:border-[#063d2b] hover:bg-[#dff1e8] sm:h-10 ${focusRing}`;
const modalCloseButtonClass = `grid h-10 w-10 place-items-center rounded-lg border border-[#d7e6df] bg-white text-xl font-black text-[#526b62] transition-colors hover:border-[#9fc8b5] hover:bg-[#f4fbf7] hover:text-[#063d2b] ${focusRing}`;
const modalSecondaryButtonClass = `inline-flex min-h-10 items-center justify-center rounded-lg border border-[#adc8bb] bg-white px-4 text-sm font-extrabold text-[#063d2b] transition-colors hover:border-[#9fc8b5] hover:bg-[#f4fbf7] ${focusRing}`;
const fileButtonClass = `grid cursor-pointer gap-1 rounded-lg border border-[#9fc8b5] bg-[#eaf7f0] px-3 py-2 text-center text-xs font-black text-[#063d2b] transition-colors hover:border-[#063d2b] hover:bg-[#dff1e8] ${focusRing}`;
const textActionButtonClass = `!border-0 !bg-transparent !p-0 !text-left !shadow-none text-sm font-black text-[#063d2b] underline-offset-4 transition-colors hover:!bg-transparent hover:text-[#07130f] hover:underline ${focusRing}`;
const playerNameButtonClass = `!grid !w-full min-w-0 !justify-start !justify-self-stretch !justify-items-start !border-0 !bg-transparent !p-0 !text-left !shadow-none ${focusRing}`;
const fieldControlClass = 'min-h-10 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-bold text-[#07130f] outline-none transition focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60';
const numberControlClass = 'h-10 rounded-lg border border-[#adc8bb] bg-white px-2 text-center text-base font-black text-[#07130f] outline-none transition focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60';
const sortableHeaderButtonClass = `inline-flex min-h-8 items-center gap-1 rounded-md border border-transparent px-1.5 text-xs font-black text-[#526b62] transition-colors hover:border-[#adc8bb] hover:bg-white hover:text-[#063d2b] ${focusRing}`;

function parsePayload(root) {
  try {
    const parsed = JSON.parse(root.dataset.payload || '{}');
    return {
      awardYear: parsed.awardYear,
      awardLeaderboards: Array.isArray(parsed.awardLeaderboards) ? parsed.awardLeaderboards : [],
      scorers: Array.isArray(parsed.scorers) ? parsed.scorers : [],
      players: Array.isArray(parsed.players) ? parsed.players : [],
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      summary: parsed.summary || { active: 0, average: 0, top: 0 },
      links: parsed.links || {},
      statLabels: parsed.statLabels || {},
      statHelp: parsed.statHelp || {},
      createOpen: parsed.createOpen === true,
      isAdmin: parsed.isAdmin === true,
      deleteToken: parsed.deleteToken || '',
      showInactive: parsed.showInactive === true,
    };
  } catch {
    return { players: [], positions: [], summary: { active: 0, average: 0, top: 0 }, links: {}, statLabels: {}, statHelp: {}, createOpen: false, isAdmin: false, showInactive: false };
  }
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function clampPhotoPosition(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}

function clampPhotoZoom(value, fallback = 100) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(50, Math.min(180, number)) : fallback;
}

function playerPhotoPosition(player) {
  return {
    x: clampPhotoPosition(player?.photoPositionX, 50),
    y: clampPhotoPosition(player?.photoPositionY, 50),
    zoom: clampPhotoZoom(player?.photoZoom, 100),
  };
}

function photoTransformStyle({ x, y, zoom }) {
  const scale = clampPhotoZoom(zoom, 100) / 100;
  const offsetX = (50 - clampPhotoPosition(x, 50)) * 0.45;
  const offsetY = (50 - clampPhotoPosition(y, 50)) * 0.45;
  const objectPosition = `${x}% ${y}%`;
  const transform = `translate(${offsetX.toFixed(2)}%, ${offsetY.toFixed(2)}%) scale(${scale.toFixed(2)})`;
  return {
    position: 'absolute',
    inset: 0,
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition,
    transform,
    transformOrigin: 'center',
    '--player-photo-object-position': objectPosition,
    '--player-photo-transform': transform,
    '--player-photo-transform-origin': 'center',
  };
}

function applyPhotoTransform(element, position) {
  if (!element) return;
  const style = photoTransformStyle(position);
  element.style.objectPosition = style.objectPosition;
  element.style.transform = style.transform;
  element.style.transformOrigin = style.transformOrigin;
  element.style.setProperty('--player-photo-object-position', style.objectPosition);
  element.style.setProperty('--player-photo-transform', style.transform);
  element.style.setProperty('--player-photo-transform-origin', style.transformOrigin);
}

function playerPhotoPositionStyle(player) {
  return player?.hasCustomPhoto ? photoTransformStyle(playerPhotoPosition(player)) : undefined;
}

function compareText(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'es-AR', { sensitivity: 'base', numeric: true });
}

function comparePlayersBySort(a, b, sortConfig) {
  const direction = sortConfig.direction === 'asc' ? 1 : -1;
  let result = 0;

  if (sortConfig.field === 'name') {
    result = compareText(a.name, b.name);
  } else if (sortConfig.field === 'position') {
    result = compareText(a.positionsText || a.primaryPosition, b.positionsText || b.primaryPosition);
  } else if (sortConfig.field === 'overall') {
    result = Number(a.overall || 0) - Number(b.overall || 0);
  }

  if (result === 0) {
    result = compareText(a.name, b.name);
  }

  return result * direction;
}

function normalizeSix(value, fallback = 3) {
  const number = Number.parseFloat(String(value ?? ''));
  const base = Number.isFinite(number) ? number : fallback;
  return Math.max(1, Math.min(6, Math.round(base * 10) / 10));
}

function sixFromOverall(value) {
  const anchors = globalThis.GoodfellasRating.policy().anchors;
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
  return globalThis.GoodfellasRating.card(value);
}

function toneClass(overall) {
  if (overall >= 88) return 'bg-emerald-600';
  if (overall >= 76) return 'bg-lime-600';
  if (overall >= 65) return 'bg-amber-600';
  return 'bg-red-600';
}

function statTone(overall) {
  const value = Number(overall) || 64;
  if (value > 95) return { color: '#1ec7f2', border: 'border-sky-300', bg: 'bg-sky-50' };
  if (value >= 88) return { color: '#008c5f', border: 'border-emerald-300', bg: 'bg-emerald-50' };
  if (value >= 76) return { color: '#65a30d', border: 'border-lime-300', bg: 'bg-lime-50' };
  if (value >= 65) return { color: '#d97706', border: 'border-amber-300', bg: 'bg-amber-50' };
  return { color: '#dc2626', border: 'border-red-300', bg: 'bg-red-50' };
}

function tierFromOverall(overall) {
  const value = Number(overall) || 64;
  if (value >= 88) return 'supreme';
  if (value >= 84) return 'elite';
  if (value >= 76) return 'gold';
  if (value >= 66) return 'silver';
  return 'bronze';
}

function cardStatsForPosition(player, position) {
  const values = Object.fromEntries((player.allStats || []).map((stat) => [stat.field, Number(stat.overall) || 64]));
  const statValue = (field) => values[field] || 64;
  return position === 'ARQ'
    ? [
        { label: 'ARQ', value: statValue('goalkeeper_skill') },
        { label: 'VEL', value: statValue('rhythm') },
        { label: 'DEF', value: statValue('defense_physical') },
        { label: 'TEC', value: statValue('technique') },
        { label: 'EQU', value: statValue('teamwork') },
        { label: 'MEN', value: statValue('mentality') },
      ]
    : [
        { label: 'TEC', value: statValue('technique') },
        { label: 'VEL', value: statValue('rhythm') },
        { label: 'DEF', value: statValue('defense_physical') },
        { label: 'ATA', value: statValue('attack') },
        { label: 'EQU', value: statValue('teamwork') },
        { label: 'MEN', value: statValue('mentality') },
      ];
}

function playerForCardPosition(player, position) {
  const rating = (player.positionRatings || []).find((item) => item.position === position);
  const overall = Number(rating?.overall || player.overall || 64);
  return {
    ...player,
    overall,
    tier: tierFromOverall(overall),
    primaryPosition: position,
    cardStats: cardStatsForPosition(player, position),
    positionRatings: [{ position, overall }],
  };
}

function calculateOverallForPosition(overallValues, position, positions = [position]) {
  const stats = Object.fromEntries(Object.entries(overallValues).map(([field, value]) => [field, sixFromOverall(value)]));
  return globalThis.GoodfellasRating.card(globalThis.GoodfellasRating.position(stats, position, positions));
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

const credentialTiers = {
  bronze: { label: 'Bronce', accent: '#dba678' },
  silver: { label: 'Plata', accent: '#d4dfdc' },
  gold: { label: 'Oro', accent: '#ecd27d' },
  elite: { label: 'Elite', accent: '#8ce1bf' },
  supreme: { label: 'Supreme', accent: '#b4ecd8' },
};

function PlayerCard({ player, onOpen }) {
  const tier = credentialTiers[player.tier] || credentialTiers.bronze;
  const positions = player.positionRatings?.length ? player.positionRatings : [{ position: player.primaryPosition, overall: player.overall }];
  const Shell = onOpen ? 'button' : 'div';
  return (
    <Shell className="gf-credential" style={{ '--credential-accent': tier.accent }} data-j2-card-tier={player.tier}
      {...(onOpen ? { type: 'button', onClick: () => onOpen(player.id), 'aria-label': `Ver ficha de ${player.name}` } : { role: 'img', 'aria-label': `Credencial de ${player.name}` })}>
      <div className="gf-credential-brand"><img src="assets/goodfellas-logo.png" alt="" /><span>Goodfellas<strong>Fútbol y amigos</strong></span><span className="gf-credential-tier">{tier.label}</span></div>
      <div className="gf-credential-portrait">
        <div className="gf-credential-overall" data-j2-card-rating-panel><span>Media</span><strong>{player.overall}</strong><b>{player.primaryPosition}</b>
          <span className="gf-credential-form" title={player.regularityLabel}><span data-j2-regularity-arrow><Arrow form={player.regularityForm} /></span>{player.regularityLabel}</span>
        </div>
        <div className="gf-credential-photo"><img src={player.photo} alt="" style={playerPhotoPositionStyle(player)} data-player-photo-oval={player.hasCustomPhoto ? '1' : undefined} /></div>
      </div>
      <div className="gf-credential-identity"><h2>{player.name}</h2><div className="gf-credential-positions">{positions.map((rating, index) => <span key={rating.position}><em>{index === 0 ? '1\u00b0' : '2\u00b0'}</em> {rating.position}<b>{rating.overall}</b></span>)}</div></div>
      <div className="gf-credential-stats">{player.cardStats.map(stat => <div key={stat.label}><span>{stat.label}</span><strong>{stat.value}</strong></div>)}</div>
      <footer className="gf-credential-footer"><span>{player.isActive ? 'Jugador activo' : 'Jugador inactivo'}</span><span>Goodfellas F.C.</span></footer>
    </Shell>
  );
}

function CredentialIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M8 9h3" />
      <path d="M14 9h2" />
      <path d="M14 13h2" />
      <circle cx="9.5" cy="13" r="1.8" />
      <path d="M7 17c.6-1 1.4-1.5 2.5-1.5S11.4 16 12 17" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v6" />
      <path d="M12 7h.01" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}

function SortHeaderButton({ field, label, sortConfig, onSort }) {
  const active = sortConfig.field === field;
  const directionLabel = active && sortConfig.direction === 'asc' ? 'menor a mayor' : 'mayor a menor';
  const indicator = active ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕';

  return (
    <button className={sortableHeaderButtonClass} type="button" onClick={() => onSort(field)} aria-sort={active ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'} title={`Ordenar ${label.toLowerCase()} de ${directionLabel}`}>
      <span>{label}</span>
      <span className="text-[11px] leading-none text-[#063d2b]" aria-hidden="true">{indicator}</span>
    </button>
  );
}

function PositionChips({ positions }) {
  const visible = positions?.length ? positions : ['Sin posicion'];
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((position) => (
        <span key={position} className="inline-flex min-h-6 items-center rounded-md border border-[#adc8bb] bg-[#eef7f2] px-2 text-[11px] font-extrabold text-[#063d2b]">
          {position}
        </span>
      ))}
    </div>
  );
}

function PositionRatingChips({ ratings, compact = false }) {
  const visible = Array.isArray(ratings) ? ratings : [];
  if (!visible.length) return null;
  return (
    <span className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
      {visible.map((rating, index) => (
        <span
          key={rating.position}
          className={`inline-flex items-center gap-1 rounded-md border font-extrabold ${index === 0 ? 'border-[#80b49b] bg-[#e4f5ec] text-[#063d2b]' : 'border-[#d7bd72] bg-[#fff5d6] text-[#684700]'} ${compact ? 'min-h-5 px-1.5 text-[10px]' : 'min-h-6 px-2 text-[11px]'}`}
          title={index === 0 ? 'Posicion primaria' : 'Posicion secundaria'}
        >
          <span className="text-[9px] font-black text-[#526b62]">{index === 0 ? '1°' : '2°'}</span>
          <span>{rating.position}</span>
          <b className="font-black text-[#07130f]">{rating.overall}</b>
        </span>
      ))}
    </span>
  );
}

function PositionRatingSummary({ ratings }) {
  const visible = Array.isArray(ratings) ? ratings : [];
  if (!visible.length) return null;
  return (
    <span className="grid min-w-[66px] gap-1 rounded-lg border border-[#adc8bb] bg-white p-1.5 text-center text-[#07130f]">
      {visible.map((rating, index) => (
        <span
          key={rating.position}
          className={`grid grid-cols-[auto_1fr_auto] items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-black leading-none ${index === 0 ? 'bg-[#e4f5ec] text-[#063d2b]' : 'bg-[#fff5d6] text-[#684700]'}`}
          title={index === 0 ? 'Posicion primaria' : 'Posicion secundaria'}
        >
          <span className="text-[9px] text-[#526b62]">{index === 0 ? '1°' : '2°'}</span>
          <span>{rating.position}</span>
          <b className="text-xs text-[#07130f]">{rating.overall}</b>
        </span>
      ))}
    </span>
  );
}

function OverallBadge({ value }) {
  return (
    <span className="inline-grid min-h-9 min-w-10 place-items-center rounded-md border border-[#adc8bb] bg-white px-2 text-center text-[#07130f] sm:min-h-10 sm:min-w-11">
      <b className="text-sm font-black leading-none sm:text-base">{value}</b>
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

function statLabelLines(label) {
  const words = String(label || '').split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  if (words.length === 2) return words;
  return [words.slice(0, -1).join(' '), words[words.length - 1]];
}

function RadarSvg({ stats }) {
  const visible = (stats || []).filter((stat) => Number(stat.value) > 0);
  if (visible.length < 3) {
    return <div className="grid min-h-48 place-items-center text-sm font-extrabold text-slate-500">Radar no disponible</div>;
  }
  const size = 320;
  const center = 160;
  const maxRadius = 88;
  const total = visible.length;
  const shape = visible.map((stat, index) => {
    const point = radarPoint(center, maxRadius * (Number(stat.value) / 6), index, total);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');

  return (
    <svg className="mx-auto block aspect-square w-full max-w-[320px]" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Radar de stats">
      {[0.25, 0.5, 0.75, 1].map((step) => {
        const points = visible.map((_, index) => {
          const point = radarPoint(center, maxRadius * step, index, total);
          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
        }).join(' ');
        return <polygon key={step} points={points} fill="none" stroke="rgba(6,61,43,.16)" strokeWidth="1" />;
      })}
      {visible.map((stat, index) => {
        const axis = radarPoint(center, maxRadius, index, total);
        const label = radarPoint(center, maxRadius + 30, index, total);
        const lines = statLabelLines(stat.label);
        const textAnchor = 'middle';
        return (
          <g key={stat.field}>
            <line x1={center} y1={center} x2={axis.x.toFixed(1)} y2={axis.y.toFixed(1)} stroke="rgba(6,61,43,.18)" strokeWidth="1" />
            <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor={textAnchor} dominantBaseline="middle" fill="#07130f" fontSize="10" fontWeight="600">
              {lines.map((line, lineIndex) => (
                <tspan key={line} x={label.x.toFixed(1)} dy={lineIndex === 0 ? `${(1 - lines.length) * 5}px` : '11px'}>{line}</tspan>
              ))}
            </text>
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
    <div className="grid gap-2 text-sm font-extrabold text-[#07130f]">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 leading-tight">{stat.label}</span>
        <b className="shrink-0 text-right">{overall}</b>
      </div>
      <span className="h-2 overflow-hidden bg-emerald-50">
        <i className={`block h-full ${toneClass(overall)}`} style={{ width: `${Math.max(10, Math.min(100, (overall / 99) * 100))}%` }} />
      </span>
    </div>
  );
}

function PlayerStory({ player }) {
  const roles = { ARQ: 'Arquero', DEF: 'Defensor', LAT: 'Lateral', MED: 'Mediocampista', DEL: 'Delantero' };
  const resources = {
    technique: 'el control de pelota', pass_vision: 'el pase y la lectura del juego',
    rhythm: 'la velocidad', stamina: 'el despliegue', defense_physical: 'la marca y el juego f\u00edsico',
    attack: 'la llegada al arco', teamwork: 'el juego colectivo', mentality: 'la concentraci\u00f3n',
    goalkeeper_skill: 'la atajada',
  };
  const virtues = {
    technique: {
      high: ['Tiene un control fino: puede sacarse la marca de encima sin perder la pelota.', 'Su calidad con la pelota le permite resolver donde hay poco espacio y mucha marca.'],
      good: ['Maneja bien la pelota y tiene recursos para salir de la presi\u00f3n.', 'El buen primer control le facilita dar continuidad a la jugada.'],
    },
    pass_vision: {
      high: ['Ve pases que abren defensas y tiene la precisi\u00f3n para hacerlos llegar.', 'Lee la jugada con claridad y puede dejar a un compa\u00f1ero en ventaja con un solo pase.'],
      good: ['Distribuye con criterio y encuentra opciones para hacer avanzar al equipo.', 'Levanta la cabeza y elige bien a qui\u00e9n darle continuidad al ataque.'],
    },
    rhythm: {
      high: ['Su aceleraci\u00f3n puede romper un partido: gana metros tanto para atacar como para recuperar.', 'Tiene una marcha m\u00e1s para despegarse de la marca y llegar al cruce.'],
      good: ['La velocidad le permite atacar espacios y responder en las transiciones.', 'Tiene piernas para sacar ventaja en el desmarque y corregir a tiempo.'],
    },
    stamina: {
      high: ['Sostiene un despliegue intenso: puede repetir subidas, presiones y regresos sin perder presencia.', 'El ida y vuelta es una de sus grandes armas: tiene resto para seguir participando cuando el partido se alarga.'],
      good: ['Tiene buen recorrido para acompa\u00f1ar el ataque y volver a dar una mano.', 'Puede encadenar esfuerzos y mantener su participaci\u00f3n en ambas \u00e1reas.'],
    },
    defense_physical: {
      high: ['Se hace fuerte en los duelos y cuesta superarlo cuando protege su zona.', 'Combina firmeza en la marca y presencia f\u00edsica para cerrar el camino al rival.'],
      good: ['Responde bien al roce y ofrece respaldo en la marca.', 'Es firme en la disputa y ayuda a sostener el orden defensivo.'],
    },
    attack: {
      high: ['Cerca del arco hace da\u00f1o: encuentra espacios y tiene recursos para terminar las jugadas.', 'Tiene peso en el \u00e1rea: su llegada y su capacidad para definir obligan a seguirlo de cerca.'],
      good: ['Se mueve bien en ataque y aporta peligro cuando pisa el \u00e1rea.', 'Tiene buenos recursos para sumarse a la jugada y buscar el arco.'],
    },
    teamwork: {
      high: ['Hace jugar a los dem\u00e1s: ofrece apoyos, se asocia y ayuda a que el equipo funcione como conjunto.', 'Su juego colectivo potencia a quienes lo rodean: entiende la descarga, el apoyo y la cobertura.'],
      good: ['Se asocia bien y suele ofrecer una salida al compa\u00f1ero.', 'Participa del circuito de pases y acompa\u00f1a las necesidades del equipo.'],
    },
    mentality: {
      high: ['Mantiene la cabeza en el partido incluso cuando aumenta la presi\u00f3n.', 'Tiene temple para competir en situaciones exigentes sin perder el foco.'],
      good: ['Compite con buena concentraci\u00f3n y suele responder ante la dificultad.', 'La fortaleza mental le ayuda a seguir en partido cuando una jugada sale mal.'],
    },
    goalkeeper_skill: {
      high: ['Bajo los tres palos puede sostener al equipo con atajadas de mucho valor.', 'Tiene reflejos y recursos para responder incluso cuando el remate llega en ventaja.'],
      good: ['Ofrece buenas respuestas en el arco y recursos para resolver situaciones de riesgo.', 'Responde con solvencia bajo los tres palos y puede aportar atajadas importantes.'],
    },
  };
  // Stable wording: revisiting a profile should not change its assessment.
  const pickVirtue = stat => {
    const pool = virtues[stat.field][Number(stat.overall) >= 90 ? 'high' : 'good'];
    const seed = `${player.id}|${stat.field}`;
    const index = Array.from(seed).reduce((sum, character) => sum + character.charCodeAt(0), 0) % pool.length;
    return pool[index];
  };
  const advice = {
    technique: 'Le conviene priorizar controles y pases simples bajo presi\u00f3n.',
    pass_vision: 'Necesita opciones de pase cercanas para facilitar sus decisiones.',
    rhythm: 'Conviene evitar que quede expuesto en carreras largas.',
    stamina: 'Le conviene administrar los esfuerzos y contar con apoyo en los relevos.',
    defense_physical: 'Necesita respaldo en la marca y en los duelos f\u00edsicos.',
    attack: 'Tiene margen para mejorar la definici\u00f3n y la decisi\u00f3n cerca del arco.',
    teamwork: 'Puede mejorar su participaci\u00f3n en las asociaciones y los apoyos.',
    mentality: 'Necesita sostener la concentraci\u00f3n cuando el partido se complica.',
    goalkeeper_skill: 'Necesita protecci\u00f3n defensiva para reducir las situaciones de riesgo.',
  };
  const stats = player.allStats.filter(stat => resources[stat.field] && (player.primaryPosition === 'ARQ' ? stat.field !== 'attack' : stat.field !== 'goalkeeper_skill'));
  const ranked = [...stats].sort((a, b) => Number(b.overall) - Number(a.overall));
  const best = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const role = roles[player.primaryPosition] || 'Jugador';
  const secondary = player.secondaryPosition ? `, con alternativa como ${(roles[player.secondaryPosition] || player.secondaryPosition).toLowerCase()}` : '';
  const sentences = [`${role}${secondary}.`];
  if (best) {
    const standouts = ranked.filter(stat => Number(stat.overall) >= 85).slice(0, 2);
    if (standouts.length) {
      standouts.forEach(stat => sentences.push(pickVirtue(stat)));
    } else {
      const top = ranked.filter(stat => Number(best.overall) - Number(stat.overall) <= 8).slice(0, 2);
      const strengths = top.map(stat => resources[stat.field]).join(', junto con ');
      sentences.push(Number(best.overall) >= 80 ? `Cuenta con buenos recursos en ${strengths.replace(/^(el |la )/, '')}.` : `Dentro de su perfil, aporta m\u00e1s desde ${strengths}.`);
    }
    if (weakest && Number(weakest.overall) < 75 && Number(best.overall) - Number(weakest.overall) >= 10) sentences.push(advice[weakest.field]);
  }
  const regularity = player.allStats.find(stat => stat.field === 'regularity');
  if (regularity) sentences.push(Number(regularity.overall) >= 90 ? 'A esa calidad le suma constancia: rara vez se aleja de su mejor versi\u00f3n.' : Number(regularity.overall) >= 85 ? 'Es confiable a lo largo de los partidos, con pocas ca\u00eddas de nivel.' : Number(regularity.overall) >= 75 ? 'Suele mantener una l\u00ednea de rendimiento pareja.' : Number(regularity.overall) < 65 ? 'Su nivel puede variar de un partido a otro.' : 'Su regularidad tiene margen de mejora.');
  return <section className="player-story" aria-label="Lectura del jugador"><h3>Perfil de juego</h3><p>{sentences.join(' ')}</p><span className="player-story-source">Lectura basada en los atributos de la ficha.</span></section>;
}

function AwardRanking({ award }) {
  if (!award.ranking) return null;
  const names = (award.ranking.sharedWith || []).map(player => player.name);
  const sharedNames = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
  return <div className="player-award-ranking-block"><p className="player-award-ranking"><b>{award.ranking.position}.º en el ranking de {award.label}</b></p>{names.length ? <p className="player-award-ranking-shared">Puesto compartido con {sharedNames}.</p> : null}</div>;
}

function AwardHistoryDialog({ award, onClose }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const trigger = document.activeElement;
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => { dialog.close(); trigger?.focus(); };
  }, []);
  return <dialog ref={dialogRef} className="player-award-history" aria-label={`Fechas de ${award.label}`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    }}>
    <header><div><h3>{award.icon} {award.label}</h3><p>{award.count} {award.count === 1 ? 'reconocimiento' : 'reconocimientos'}{award.position > 0 && award.code !== 'monthly' ? ` · Premio recibido: ${award.position}.º puesto en la fecha` : ''}</p></div>
      <button className={modalCloseButtonClass} type="button" onClick={onClose} aria-label="Cerrar fechas del premio">×</button>
    </header>
    <p>{award.description}</p>
    {award.playerName ? <p><b>{award.playerName}</b> · {award.totalPoints} {award.usesPoints ? 'puntos' : 'premios'} acumulados</p> : null}
    <AwardRanking award={award} />
    {award.ranking ? <><p>{award.ranking.count} de {award.ranking.totalAwards} premios entregados en esta categoría{award.ranking.usesPoints ? ` · ${award.ranking.points} puntos acumulados` : ''}.</p><p>Ranking anual entre quienes recibieron este premio. Los premios con podio suman 3 puntos por primer puesto, 2 por segundo y 1 por tercero; un único ganador suma 3. Los demás se ordenan por cantidad recibida. Igual puntaje o cantidad comparte posición. Jugador del mes suma todas las canchas.</p></> : null}
    {award.matches?.length ? <table>
      <thead><tr><th scope="col">{award.code === 'monthly' ? 'Período' : 'Fecha'}</th><th scope="col">{award.code === 'monthly' ? 'Reconocimiento' : 'Nombre de la fecha'}</th>{award.playerName ? <th scope="col">{award.usesPoints ? 'Puesto y puntos' : 'Premios'}</th> : null}</tr></thead>
      <tbody>{award.matches.map((match, index) => <tr key={`${match.id || match.date}-${index}`}>
        <td><time dateTime={match.date}>{match.dateLabel}</time></td><td>{match.title}</td>
        {award.playerName ? <td>{award.usesPoints ? <>{match.awardedPosition || 1}.º puesto<br /><b>{match.points} {match.points === 1 ? 'punto' : 'puntos'}</b></> : 1}</td> : null}
      </tr>)}</tbody>
    </table> : <p>No hay fechas disponibles para este premio.</p>}
  </dialog>;
}

function PlayerAwards({ player }) {
  const [selectedAward, setSelectedAward] = useState(null);
  const awards = player.annualAwards || [];
  const count = awards.reduce((sum, award) => sum + award.count, 0);
  const results = player.annualResults || { played: 0, won: 0, drawn: 0, lost: 0, goals: 0, ranks: {}, totalPlayers: 0 };
  return <section className="player-annual-awards" aria-label={`Premios de ${player.awardYear}`}>
    <div className="player-awards-heading"><h3>Premios {player.awardYear}</h3><span>{count} reconocimientos</span></div>
    <p className="player-awards-period">Desde el 1 de enero · Partidos finalizados</p>
    <div className="player-annual-results" aria-label={`Partidos y rankings de ${player.awardYear}`}>
      {[['played', 'Jugados', 'Más partidos'], ['won', 'Ganados', 'Más victorias'], ['drawn', 'Empatados', 'Más empates'], ['lost', 'Perdidos', 'Menos derrotas'], ['goals', 'Goles del año', 'Ranking de goleadores']].map(([metric, label, ranking]) => (
        <article key={metric}>
          <span>{label}</span><strong>{results[metric] ?? 0}</strong>
          <p>{results.ranks[metric] ? <><b>{results.ranks[metric]}&#176;</b> de {results.totalPlayers}</> : 'Sin ranking'}</p>
          <span className="annual-ranking-label">{ranking}</span>
        </article>
      ))}
    </div>
    <p className="annual-ranking-context">Rankings del año entre jugadores con partidos finalizados, en todas las canchas. Desempates según partidos jugados, promedio y nombre.</p>
    {results.played > results.won + results.drawn + results.lost ? <p className="annual-ranking-context">{results.played - results.won - results.drawn - results.lost} partidos sin marcador completo: cuentan como jugados, sin resultado asignado.</p> : null}
    {awards.length ? <div className="player-awards-grid">{awards.map((award, index) => <button type="button" key={`${award.code}-${index}`} className={`player-award ${award.type === 'bad' ? 'is-special' : ''}`} onClick={() => setSelectedAward(award)} aria-haspopup="dialog" aria-label={`Ver fechas de ${award.label}${award.position > 0 && award.code !== 'monthly' ? `, ${award.position}.º puesto` : ''}`}>
      <span className="player-award-icon" aria-hidden="true">{award.icon}</span><div><h4>{award.label}</h4><AwardRanking award={award} /><p>{award.description}</p>{award.detail ? <p>{award.detail}</p> : award.position > 0 ? <span className="player-award-date-position">Premio recibido: {award.position}.º puesto en la fecha</span> : null}</div><strong aria-label={`${award.count} veces`}>×{award.count}</strong>
    </button>)}</div> : <p className="player-awards-empty">Todavía no tiene premios registrados en {player.awardYear}.</p>}
    {selectedAward ? <AwardHistoryDialog award={selectedAward} onClose={() => setSelectedAward(null)} /> : null}
  </section>;
}

function ReadonlyProfile({ player, onRadarOpen }) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <button type="button" className={`rounded-lg border border-[#adc8bb] bg-white p-4 text-left transition-colors hover:border-[#9fc8b5] hover:bg-[#f8fbfa] ${focusRing}`} onClick={() => onRadarOpen(player)} aria-label={`Ver radar completo de ${player.name}`}>
          <RadarSvg stats={player.allStats} />
        </button>
          <div className="grid content-start gap-3">
            <div className="grid gap-2 sm:grid-cols-3">
            <article className="rounded-lg border border-[#d7e6df] bg-white p-3"><span className="text-xs font-extrabold text-[#526b62]">Promedio</span><strong className="block text-lg font-black text-[#07130f]">{player.overall}</strong></article>
            <article className="rounded-lg border border-[#d7e6df] bg-white p-3"><span className="text-xs font-extrabold text-[#526b62]">Fuerte</span><strong className="block text-sm font-black text-[#07130f]">{player.bestStat?.label || '-'}</strong></article>
            <article className="rounded-lg border border-[#d7e6df] bg-white p-3"><span className="text-xs font-extrabold text-[#526b62]">A cuidar</span><strong className="block text-sm font-black text-[#07130f]">{player.weakStat?.label || '-'}</strong></article>
          </div>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {player.allStats.map((stat) => (
          <article key={stat.field} className="rounded-lg border border-[#d7e6df] bg-white p-3">
            <StatLine stat={stat} />
            <p className="m-0 mt-2 text-xs font-semibold leading-relaxed text-slate-500">{stat.help || 'Sin descripcion disponible.'}</p>
          </article>
        ))}
      </div>
    </>
  );
}

function AdminEditForm({ player, positions, onOverallPreviewChange }) {
  const isCreate = String(player.id) === '0';
  const initialOveralls = useMemo(() => Object.fromEntries(player.allStats.map((stat) => [stat.field, Number(stat.overall) || 64])), [player]);
  const initialPhotoPosition = useMemo(() => playerPhotoPosition(player), [player]);
  const mainPhotoPreviewRef = useRef(null);
  const editorPhotoPreviewRef = useRef(null);
  const [name, setName] = useState(player.name);
  const [primary, setPrimary] = useState(player.primaryPosition || '');
  const [secondary, setSecondary] = useState(player.secondaryPosition || '');
  const [active, setActive] = useState(player.isActive);
  const [overallValues, setOverallValues] = useState(initialOveralls);
  const [photoUrl, setPhotoUrl] = useState(player.photoEdit || player.photo);
  const [photoName, setPhotoName] = useState(player.hasCustomPhoto ? 'Foto actual cargada. Elegi otra para reemplazarla.' : 'JPG, PNG o WEBP hasta 3 MB');
  const [photoPosition, setPhotoPosition] = useState(initialPhotoPosition);
  const [photoDirty, setPhotoDirty] = useState(false);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [openHelp, setOpenHelp] = useState(null);
  const hasPreviewPhoto = photoDirty || player.hasCustomPhoto;
  const photoEditorPreviewStyle = photoTransformStyle(photoPosition);
  const photoPositionDirty = photoPosition.x !== initialPhotoPosition.x
    || photoPosition.y !== initialPhotoPosition.y
    || photoPosition.zoom !== initialPhotoPosition.zoom;

  const previewPositionRatings = useMemo(() => {
    const positionsToRate = [primary, secondary].filter(Boolean);
    return positionsToRate.map((position) => ({
      position,
      overall: calculateOverallForPosition(overallValues, position, positionsToRate),
    }));
  }, [overallValues, primary, secondary]);
  const displayedOverall = previewPositionRatings[0]?.overall || calculateOverallForPosition(overallValues, primary || 'MED');

  useEffect(() => {
    if (isCreate) return;
    onOverallPreviewChange?.(player.id, {
      value: displayedOverall,
      positionRatings: previewPositionRatings,
    });
  }, [displayedOverall, isCreate, onOverallPreviewChange, player.id, previewPositionRatings]);

  useEffect(() => {
    if (!hasPreviewPhoto) return;
    applyPhotoTransform(mainPhotoPreviewRef.current, photoPosition);
    applyPhotoTransform(editorPhotoPreviewRef.current, photoPosition);
  }, [hasPreviewPhoto, photoPosition]);

  const setOverall = (field, value) => {
    const next = Math.max(35, Math.min(99, Math.round(Number(value) || 64)));
    setOverallValues((current) => ({ ...current, [field]: next }));
  };

  const previewPhotoPosition = (axis, value) => {
    setPhotoPosition((current) => {
      const next = {
        ...current,
        [axis]: axis === 'zoom' ? clampPhotoZoom(value, current.zoom) : clampPhotoPosition(value, current[axis]),
      };
      applyPhotoTransform(mainPhotoPreviewRef.current, next);
      applyPhotoTransform(editorPhotoPreviewRef.current, next);
      return next;
    });
  };

  const selected = [primary, secondary].filter(Boolean);
  const visibleFields = selected.includes('ARQ') ? [...statFields, 'goalkeeper_skill'] : statFields;
  const hasChanges = isCreate
    || name !== player.name
    || primary !== (player.primaryPosition || '')
    || secondary !== (player.secondaryPosition || '')
    || active !== player.isActive
    || photoDirty
    || photoPositionDirty
    || Object.keys(initialOveralls).some((field) => (overallValues[field] || 64) !== initialOveralls[field]);

  return (
    <form className="grid gap-4 rounded-lg border border-[#adc8bb] bg-white p-4" method="post" encType="multipart/form-data">
      <input type="hidden" name="action" value="save" />
      <input type="hidden" name="id" value={player.id} />
      <input type="hidden" name="photo_position_x" value={photoPosition.x} />
      <input type="hidden" name="photo_position_y" value={photoPosition.y} />
      <input type="hidden" name="photo_zoom" value={photoPosition.zoom} />

      <div className="flex items-center justify-between gap-3 border-b border-emerald-100 pb-3">
        <strong className="text-base font-black text-[#07130f]">{isCreate ? 'Crear jugador' : 'Editar jugador'}</strong>
        <OverallBadge value={displayedOverall} />
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto]">
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Nombre
          <input className={fieldControlClass} type="text" name="name" required value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Primaria
          <select className={fieldControlClass} name="positions[]" required value={primary} onChange={(event) => setPrimary(event.target.value)}>
            <option value="" disabled>Elegir</option>
            {positions.map((position) => (
              <option key={position.value} value={position.value} disabled={position.value !== primary && selected.includes(position.value)}>{position.label}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Secundaria
          <select className={fieldControlClass} name="positions[]" value={secondary} onChange={(event) => setSecondary(event.target.value)}>
            <option value="">Sin posicion</option>
            {positions.map((position) => (
              <option key={position.value} value={position.value} disabled={position.value !== secondary && selected.includes(position.value)}>{position.label}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-10 items-center gap-2 self-end rounded-lg border border-[#adc8bb] bg-[#eef7f2] px-3 text-sm font-extrabold text-[#063d2b]">
          <input type="checkbox" name="active" value="1" checked={active} onChange={(event) => setActive(event.target.checked)} />
          Activo
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="grid gap-2 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-3 text-center">
          <span className="relative mx-auto grid h-40 w-36 place-items-center overflow-hidden rounded-lg border border-[#d7e6df] bg-white">
            <img ref={mainPhotoPreviewRef} className={`h-full w-full ${hasPreviewPhoto ? 'object-cover object-top' : 'object-contain opacity-60'}`} src={photoUrl} alt="" style={hasPreviewPhoto ? photoEditorPreviewStyle : undefined} data-player-photo-oval={hasPreviewPhoto ? '1' : undefined} />
          </span>
          <label className={fileButtonClass}>
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
                setPhotoPosition({ x: 50, y: 50, zoom: 100 });
                setPhotoEditorOpen(true);
                setPhotoDirty(true);
              }}
            />
          </label>
          <button
            className={`min-h-9 rounded-lg border px-3 text-xs font-black transition-colors ${focusRing} ${hasPreviewPhoto ? 'border-[#adc8bb] bg-white text-[#063d2b] hover:border-[#9fc8b5] hover:bg-[#f4fbf7]' : 'cursor-not-allowed border-[#d7e6df] bg-white text-slate-400'}`}
            type="button"
            disabled={!hasPreviewPhoto}
            onClick={() => setPhotoEditorOpen((open) => !open)}
            aria-expanded={photoEditorOpen && hasPreviewPhoto}
          >
            Editar foto
          </button>
          {!isCreate && player.hasCustomPhoto ? <button className="player-remove-photo" type="submit" form={`remove-photo-${player.id}`}>Quitar foto</button> : null}
          {photoEditorOpen && hasPreviewPhoto ? (
            <div className="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 text-left">
              <span className="relative mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full border border-[#d7e6df] bg-[#f8fbfa]">
                <img ref={editorPhotoPreviewRef} className="h-full w-full object-cover" src={photoUrl} alt="" style={photoEditorPreviewStyle} />
              </span>
              <label className="grid gap-1 text-xs font-extrabold text-slate-600">
                <span className="flex items-center justify-between gap-2">
                  Horizontal
                  <b className="text-[#063d2b]">{photoPosition.x}%</b>
                </span>
                <input
                  className="h-8 w-full cursor-pointer accent-[#063d2b]"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={photoPosition.x}
                  onInput={(event) => previewPhotoPosition('x', event.currentTarget.value)}
                  onChange={(event) => previewPhotoPosition('x', event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-extrabold text-slate-600">
                <span className="flex items-center justify-between gap-2">
                  Vertical
                  <b className="text-[#063d2b]">{photoPosition.y}%</b>
                </span>
                <input
                  className="h-8 w-full cursor-pointer accent-[#063d2b]"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={photoPosition.y}
                  onInput={(event) => previewPhotoPosition('y', event.currentTarget.value)}
                  onChange={(event) => previewPhotoPosition('y', event.currentTarget.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-extrabold text-slate-600">
                <span className="flex items-center justify-between gap-2">
                  Zoom
                  <b className="text-[#063d2b]">{photoPosition.zoom}%</b>
                </span>
                <input
                  className="h-8 w-full cursor-pointer accent-[#063d2b]"
                  type="range"
                  min="50"
                  max="180"
                  step="1"
                  value={photoPosition.zoom}
                  onInput={(event) => previewPhotoPosition('zoom', event.currentTarget.value)}
                  onChange={(event) => previewPhotoPosition('zoom', event.currentTarget.value)}
                />
              </label>
              <button
                className={`min-h-9 rounded-lg border border-[#adc8bb] bg-[#f8fbfa] px-3 text-xs font-black text-[#063d2b] transition-colors hover:border-[#9fc8b5] hover:bg-[#eef7f2] ${focusRing}`}
                type="button"
                onClick={() => setPhotoPosition(photoDirty ? { x: 50, y: 50, zoom: 100 } : initialPhotoPosition)}
              >
                Restablecer
              </button>
            </div>
          ) : null}
          <small className="text-xs font-semibold text-slate-500">{photoName}</small>
        </aside>

        <div className="grid gap-2 sm:grid-cols-2">
          {visibleFields.map((field) => {
            const stat = player.allStats.find((item) => item.field === field);
            if (!stat) return null;
            const overall = overallValues[field] || Number(stat.overall) || 64;
            const dirty = overall !== initialOveralls[field];
            const tone = statTone(overall);
            const percent = Math.max(0, Math.min(100, ((overall - 35) / 64) * 100));
            return (
              <label key={field} className={`grid gap-2 rounded-lg border p-3 ${dirty ? `${tone.border} ${tone.bg}` : 'border-[#d7e6df] bg-white'}`}>
                <span className="grid gap-1">
                  <button type="button" className={textActionButtonClass} onClick={() => setOpenHelp(openHelp === field ? null : field)} aria-expanded={openHelp === field}>{stat.label}</button>
                  {openHelp === field ? <em className="not-italic text-xs font-semibold leading-relaxed text-slate-500">{stat.help}</em> : null}
                </span>
                <input type="hidden" name={field} value={sixFromOverall(overall).toFixed(1)} />
                <div className="grid grid-cols-[70px_minmax(0,1fr)_32px] items-center gap-3">
                  <input className={numberControlClass} type="number" name={`${field}_overall`} min="35" max="99" step="1" inputMode="numeric" value={overall} onChange={(event) => setOverall(field, event.target.value)} aria-label={`${stat.label} en escala 1 a 99`} />
                  <span className="relative grid h-10 items-center">
                    <span className="pointer-events-none absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-slate-200">
                      <span className="block h-full" style={{ width: `${percent}%`, backgroundColor: tone.color }} />
                    </span>
                    <input
                      className="relative z-10 h-10 w-full cursor-pointer appearance-none border-0 bg-transparent p-0 [accent-color:var(--stat-color)] [&::-moz-range-progress]:h-2 [&::-moz-range-progress]:bg-[var(--stat-color)] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--stat-color)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-thumb]:-mt-1.5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--stat-color)] [&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgba(7,19,15,.22)]"
                      style={{ '--stat-color': tone.color }}
                      type="range"
                      min="35"
                      max="99"
                      step="1"
                      value={overall}
                      onChange={(event) => setOverall(field, event.target.value)}
                      aria-label={`Ajustar ${stat.label} en escala 1 a 99`}
                    />
                  </span>
                  {dirty ? (
                    <button
                      className={`grid h-8 w-8 place-items-center rounded-md border border-[#063d2b] bg-[#063d2b] text-white transition-colors hover:bg-[#082f23] ${focusRing}`}
                      type="submit"
                      aria-label={`Guardar cambios de ${stat.label}`}
                      title="Guardar"
                    >
                      <SaveIcon />
                    </button>
                  ) : (
                    <span className="block h-8 w-8" aria-hidden="true" />
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end">
        <button className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-5 text-sm font-black transition-colors ${focusRing} ${hasChanges ? 'border-[#063d2b] bg-[#063d2b] text-white hover:bg-[#082f23]' : 'border-[#adc8bb] bg-white text-[#526b62] hover:border-[#9fc8b5] hover:bg-[#f4fbf7] hover:text-[#063d2b]'}`} type="submit">
          {hasChanges ? <SaveIcon /> : null}
          {isCreate ? 'Crear jugador' : 'Guardar todo'}
        </button>
      </div>
    </form>
  );
}

function createBlankPlayer(statLabels, statHelp) {
  const defaultOveralls = {
    technique: 64,
    pass_vision: 64,
    rhythm: 64,
    stamina: 74,
    defense_physical: 64,
    attack: 64,
    teamwork: 64,
    mentality: 64,
    regularity: 74,
    goalkeeper_skill: 64,
  };
  return {
    id: '0',
    name: '',
    primaryPosition: '',
    secondaryPosition: '',
    isActive: true,
    photo: 'assets/players/default-player-silhouette.png',
    photoEdit: 'assets/players/default-player-silhouette.png',
    hasCustomPhoto: false,
    photoPositionX: 50,
    photoPositionY: 50,
    photoZoom: 100,
    allStats: [...statFields, 'goalkeeper_skill'].map((field) => ({
      field,
      label: statLabels[field] || field,
      help: statHelp[field] || 'Sin descripcion disponible.',
      overall: defaultOveralls[field] || 64,
    })),
  };
}

function CreatePlayerPanel({ positions, statLabels, statHelp, defaultOpen }) {
  const player = useMemo(() => createBlankPlayer(statLabels, statHelp), [statHelp, statLabels]);
  return (
    <details id="crear-jugador" className="rounded-lg border border-[#adc8bb] bg-white" open={defaultOpen}>
      <summary className="cursor-pointer list-none border-b border-[#d7e6df] bg-[#f8fbfa] px-4 py-3 text-base font-black text-[#07130f]">
        Crear jugador
      </summary>
      <div className="p-3">
        <AdminEditForm player={player} positions={positions} />
      </div>
    </details>
  );
}

function PlayerModal({ player, isAdmin, deleteToken, showInactive, positions, onClose, onRadarOpen, positionRatingsPreview, onOverallPreviewChange }) {
  const [activeTab, setActiveTab] = useState('description');
  const contentRef = useRef(null);
  useEffect(() => { setActiveTab('description'); }, [player?.id]);
  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [activeTab, player?.id]);
  if (!player) return null;
  const tabs = [['description', 'Descripción y estadísticas'], ['awards', 'Premios']];
  const tabId = key => `player-${player.id}-tab-${key}`;
  const panelId = key => `player-${player.id}-panel-${key}`;
  const headerRatings = positionRatingsPreview?.length ? positionRatingsPreview : player.positionRatings;
  return (
    <>
      <button className="fixed inset-0 z-40 block bg-black/55" type="button" aria-label="Cerrar ficha" onClick={onClose} />
      <section className="player-info-modal fixed inset-x-3 top-4 bottom-4 z-50 mx-auto grid max-w-5xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-[#adc8bb] bg-white shadow-[0_12px_28px_rgba(7,19,15,.18)] md:inset-x-8" role="dialog" aria-modal="true" aria-label={`Ficha de ${player.name}`}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-[#d7e6df] bg-[#f8fbfa] p-4">
          <div className="player-info-identity min-w-0">
            <DirectoryAvatar player={player} /><div>
            <h2 className="m-0 truncate text-xl font-black text-[#07130f]">{player.name}</h2>
            <p className="m-0 mt-1 text-sm font-semibold text-slate-500">{player.isActive ? 'Activo' : 'Inactivo'}</p>
          </div></div>
          <PositionRatingSummary ratings={headerRatings} />
          <button className={modalCloseButtonClass} type="button" onClick={onClose} aria-label="Cerrar ficha">x</button>
        </header>
        <nav className="player-profile-tabs" role="tablist" aria-label="Secciones de la ficha">
          {tabs.map(([key, label], index) => <button key={key} id={tabId(key)} type="button" role="tab" aria-selected={activeTab === key} aria-controls={panelId(key)} tabIndex={activeTab === key ? 0 : -1} onClick={() => setActiveTab(key)} onKeyDown={event => {
            let next;
            if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
            if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
            if (event.key === 'Home') next = 0;
            if (event.key === 'End') next = tabs.length - 1;
            if (next !== undefined) { event.preventDefault(); setActiveTab(tabs[next][0]); document.getElementById(tabId(tabs[next][0]))?.focus(); }
          }}>{label}</button>)}
        </nav>
        <div ref={contentRef} className="player-profile-content grid gap-4 overflow-auto p-4">
          <div className="player-profile-panel" role="tabpanel" id={panelId('description')} aria-labelledby={tabId('description')} hidden={activeTab !== 'description'} tabIndex={0}>
            <PlayerStory player={player} />
          {isAdmin ? (
            <AdminEditForm key={player.id} player={player} positions={positions} onOverallPreviewChange={onOverallPreviewChange} />
          ) : (
            <ReadonlyProfile player={player} onRadarOpen={onRadarOpen} />
          )}
          {isAdmin && player.hasCustomPhoto ? <form id={`remove-photo-${player.id}`} method="post" action="jugadores2.php" hidden onSubmit={event => {
            if (!window.confirm(`Quitar la foto de ${player.name}? Volvera a la imagen predeterminada. Los cambios de la ficha que no hayas guardado se descartaran.`)) event.preventDefault();
          }}>
            <input type="hidden" name="action" value="remove_photo" />
            <input type="hidden" name="id" value={player.id} />
            <input type="hidden" name="delete_token" value={deleteToken} />
            <input type="hidden" name="show_inactive" value={showInactive ? '1' : '0'} />
          </form> : null}
          <details className="rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-3">
            <summary className="cursor-pointer text-sm font-black text-[#07130f]">Ver ayuda de stats</summary>
            <p className="m-0 mt-2 text-sm font-semibold text-slate-600">La ficha muestra el radar, la lectura general y la explicacion de cada stat.</p>
          </details>
          {isAdmin ? <form method="post" action="jugadores2.php" className="player-delete-action" onSubmit={event => {
            if (!window.confirm(`Eliminar a ${player.name}? Si tiene historial o registros vinculados, se desactivara para conservarlos.`)) event.preventDefault();
          }}>
            <input type="hidden" name="action" value="delete" />
            <input type="hidden" name="id" value={player.id} />
            <input type="hidden" name="delete_token" value={deleteToken} />
            <input type="hidden" name="show_inactive" value={showInactive ? '1' : '0'} />
            <p>Si tiene historial, se conserva como inactivo.</p>
            <button type="submit">Eliminar jugador</button>
          </form> : null}
          </div>
          <div role="tabpanel" id={panelId('awards')} aria-labelledby={tabId('awards')} hidden={activeTab !== 'awards'} tabIndex={0}>
            <PlayerAwards player={player} />
          </div>
          <button className={modalSecondaryButtonClass} type="button" onClick={onClose}>Cerrar</button>
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
      <section className="fixed inset-x-4 top-10 z-[70] mx-auto max-w-md rounded-lg border border-[#adc8bb] bg-white p-4 shadow-[0_12px_28px_rgba(7,19,15,.18)]" role="dialog" aria-modal="true" aria-label={`Radar completo de ${player.name}`}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <strong className="text-base font-black text-[#07130f]">{player.name}</strong>
          <button className={modalCloseButtonClass} type="button" onClick={onClose} aria-label="Cerrar radar">x</button>
        </div>
        <RadarSvg stats={player.allStats} />
      </section>
    </>
  );
}

function CardPreviewModal({ player, onClose }) {
  const options = player?.positionRatings?.length
    ? player.positionRatings
    : [{ position: player?.primaryPosition || 'MED', overall: player?.overall || 64 }];
  const [selectedPosition, setSelectedPosition] = useState('MED');
  useEffect(() => {
    setSelectedPosition(options[0]?.position || player?.primaryPosition || 'MED');
  }, [player?.id]);

  if (!player) return null;
  const activePosition = options.some((option) => option.position === selectedPosition)
    ? selectedPosition
    : options[0]?.position || player.primaryPosition || 'MED';
  const previewPlayer = playerForCardPosition(player, activePosition);

  return (
    <>
      <button className="fixed inset-0 z-[80] bg-black/70" type="button" aria-label="Cerrar credencial" onClick={onClose} />
      <section className="credential-viewer fixed inset-0 z-[90] grid place-items-center overflow-auto p-4" role="dialog" aria-modal="true" aria-label={`Credencial de ${player.name}`}>
        <div className="credential-viewer-content grid place-items-center gap-3">
          {options.length > 1 ? (
            <div className="grid w-[min(82vw,320px)] grid-cols-2 gap-2" aria-label="Elegir posicion de credencial">
              {options.map((rating, index) => {
                const active = activePosition === rating.position;
                return (
                  <button
                    key={rating.position}
                    className={`min-h-10 rounded-lg border px-2 text-xs font-black transition-colors ${focusRing} ${active ? 'border-[#8ce1bf] bg-[#d7f4e7] text-[#07130f]' : 'border-white/20 bg-black/65 text-white hover:bg-black/80'}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedPosition(rating.position)}
                  >
                    {index === 0 ? '1°' : '2°'} {rating.position} {rating.overall}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="credential-viewer-card">
            <div className="credential-viewer-card-inner">
              <PlayerCard player={previewPlayer} size="preview" />
            </div>
          </div>
        </div>
        <button className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-black/70 text-xl font-black text-white transition-colors hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40" type="button" onClick={onClose} aria-label="Cerrar credencial">x</button>
      </section>
    </>
  );
}

function DirectoryAvatar({ player }) {
  return <span className="directory-avatar" aria-hidden="true">{player.hasCustomPhoto
    ? <img src={player.photoEdit || player.photo} alt="" loading="lazy" style={playerPhotoPositionStyle(player)} />
    : <span>{player.initials || player.name.slice(0, 2)}</span>}</span>;
}

function DirectoryRatings({ player }) {
  return <div className="directory-ratings">{player.positionRatings.map((rating, index) => (
    <div key={rating.position} className={`directory-rating ${index ? 'is-secondary' : ''}`} title={index ? 'Posici?n secundaria' : 'Posici?n primaria'}>
      <span>{index ? '2\u00b0' : '1\u00b0'} {rating.position}</span><strong>{rating.overall}</strong>
    </div>
  ))}</div>;
}

function AwardsOverview({ payload }) {
  const [selectedAward, setSelectedAward] = useState(null);
  const rankingTable = (entries, valueKey, valueLabel, label, category = null) => <table aria-label={label}>
    <thead><tr><th scope="col">Puesto</th><th scope="col">Jugador</th><th scope="col">{valueLabel}</th></tr></thead>
    {[...new Set(entries.map(entry => entry.position))].map(position => <tbody key={position} className={`directory-ranking-place directory-ranking-place-${position}`} aria-label={`${position}.º puesto`}>
      {entries.filter(entry => entry.position === position).map((entry, index) => <tr key={entry.id}><td>{entry.position}.º{index === 0 && position <= 3 ? <span className="directory-ranking-place-label">{['', 'Primer puesto', 'Segundo puesto', 'Tercer puesto'][position]}</span> : null}</td><td>{category ? <button type="button" className="directory-award-player-link" aria-haspopup="dialog" aria-label={`Ver premios de ${entry.name} en ${category.label}`} onClick={() => setSelectedAward({ ...category, count: entry.count, matches: entry.matches, playerName: entry.name, totalPoints: entry.points })}>{entry.position === 1 ? <strong>{entry.name}</strong> : entry.name}</button> : entry.position === 1 ? <strong>{entry.name}</strong> : entry.name}{entries.some(other => other.id !== entry.id && other.position === entry.position) ? <span className="directory-ranking-tie">Puesto compartido</span> : null}</td><td>{entry.position === 1 ? <strong>{entry[valueKey]}</strong> : entry[valueKey]}</td></tr>)}
    </tbody>)}
  </table>;
  return <div className="directory-awards-overview">
    <header><h2>Premios {payload.awardYear}</h2><p>Podios anuales por categoría. Los empates comparten puesto, incluidos los jugadores inactivos.</p></header>
    <div className="directory-awards-podiums">{(payload.awardLeaderboards || []).map(category => <section key={category.code} className="directory-category-ranking" aria-label={`Podio de ${category.label}`}>
      <h3><span aria-hidden="true">{category.icon}</span> {category.label}</h3>
      {category.description ? <p className="directory-award-description">{category.description}</p> : null}
      {category.usesPoints ? <div className="directory-points-explanation"><p>Por cada premio recibido en una fecha:</p><ul><li><b>1.º puesto:</b> 3 puntos</li><li><b>2.º puesto:</b> 2 puntos</li><li><b>3.º puesto:</b> 1 punto</li></ul><p>El ranking suma esos puntos durante el año.</p></div> : <p>Ordenado por cantidad de premios recibidos.</p>}
      {rankingTable(category.entries.filter(entry => entry.position <= 3), category.usesPoints ? 'points' : 'count', category.usesPoints ? 'Puntos' : 'Premios', `Podio de ${category.label}`, category)}
      <details><summary>Ver ranking completo ({category.entries.length})</summary>{rankingTable(category.entries, category.usesPoints ? 'points' : 'count', category.usesPoints ? 'Puntos' : 'Premios', `Ranking completo de ${category.label}`, category)}</details>
    </section>)}</div>
    {!payload.awardLeaderboards?.length ? <p>Todavía no hay premios registrados este año.</p> : null}
    <section className="directory-category-ranking" aria-label="Tabla de goleadores">
      <h2>Goleadores {payload.awardYear}</h2><p>Goles acumulados del año, en todas las canchas.</p>
      {payload.scorers?.length ? rankingTable(payload.scorers, 'goals', 'Goles', 'Tabla de goleadores') : <p>Todavía no hay goles registrados este año.</p>}
    </section>
    {selectedAward ? <AwardHistoryDialog award={selectedAward} onClose={() => setSelectedAward(null)} /> : null}
  </div>;
}

export function Jugadores2PageIsland({ root }) {
  const payload = useMemo(() => parsePayload(root), [root]);
  const [directoryTab, setDirectoryTab] = useState(() => new URLSearchParams(window.location.search).get('tab') === 'awards' ? 'awards' : 'players');
  const [query, setQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ field: 'name', direction: 'asc' });
  const [activeId, setActiveId] = useState(null);
  const [cardId, setCardId] = useState(null);
  const [radarId, setRadarId] = useState(null);
  const [modalOverall, setModalOverall] = useState(null);

  const openPlayerModal = useCallback((playerId) => {
    setModalOverall(null);
    setActiveId(playerId);
  }, []);

  const closePlayerModal = useCallback(() => {
    setActiveId(null);
    setModalOverall(null);
  }, []);

  const handleOverallPreviewChange = useCallback((playerId, preview) => {
    const id = String(playerId);
    const value = typeof preview === 'object' && preview !== null ? preview.value : preview;
    const positionRatings = typeof preview === 'object' && preview !== null && Array.isArray(preview.positionRatings)
      ? preview.positionRatings
      : [];
    setModalOverall((current) => (
      current?.id === id
        && current.value === value
        && JSON.stringify(current.positionRatings || []) === JSON.stringify(positionRatings)
        ? current
        : { id, value, positionRatings }
    ));
  }, []);

  const handleHeaderSort = useCallback((field) => {
    setSortConfig((current) => ({
      field,
      direction: current.field === field && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }, []);

  const visiblePlayers = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered = payload.players.filter((player) => (
      (!positionFilter || player.positions.includes(positionFilter)) && (normalizedQuery === '' || normalize(`${player.search} ${player.overall} ${player.rating}`).includes(normalizedQuery))
    ));
    return filtered.slice().sort((a, b) => comparePlayersBySort(a, b, sortConfig));
  }, [payload.players, query, sortConfig, positionFilter]);

  const activePlayer = payload.players.find((player) => String(player.id) === String(activeId)) || null;
  const cardPlayer = payload.players.find((player) => String(player.id) === String(cardId)) || null;
  const radarPlayer = payload.players.find((player) => String(player.id) === String(radarId)) || null;
  const activePositionRatings = activePlayer && modalOverall?.id === String(activePlayer.id) ? modalOverall.positionRatings : null;

  return (
    <div className="players-directory grid gap-4">
      <section className="players-directory-header grid items-end gap-4 rounded-lg border border-[#adc8bb] bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="m-0 text-2xl font-black text-[#07130f]">Jugadores</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-slate-500">Plantilla, posiciones y rendimiento actual.</p>
        </div>
        <div className="players-directory-summary grid grid-cols-3 gap-2" aria-label="Resumen de jugadores">
          <article className="min-w-20 rounded-lg border border-[#d7e6df] bg-[#f4fbf7] p-2"><span className="block text-[11px] font-extrabold text-[#526b62]">Activos</span><strong className="block text-lg font-black text-[#07130f]">{payload.summary.active}</strong></article>
          <article className="min-w-20 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2"><span className="block text-[11px] font-extrabold text-[#526b62]">Promedio</span><strong className="block text-lg font-black text-[#07130f]">{payload.summary.average}</strong></article>
          <article className="min-w-20 rounded-lg border border-[#d7e6df] bg-white p-2"><span className="block text-[11px] font-extrabold text-[#526b62]">Top</span><strong className="block text-lg font-black text-[#063d2b]">{payload.summary.top}</strong></article>
        </div>
      </section>

      <nav className="player-profile-tabs" role="tablist" aria-label="Secciones de jugadores">
        {[['players', 'Jugadores'], ['awards', 'Premios']].map(([key, label], index) => <button key={key} type="button" role="tab" id={`directory-tab-${key}`} aria-controls={`directory-panel-${key}`} aria-selected={directoryTab === key} tabIndex={directoryTab === key ? 0 : -1} onClick={() => setDirectoryTab(key)} onKeyDown={event => {
          if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'players' : event.key === 'End' ? 'awards' : index === 0 ? 'awards' : 'players';
            setDirectoryTab(next); document.getElementById(`directory-tab-${next}`)?.focus();
          }
        }}>{label}</button>)}
      </nav>
      <div className="directory-main-panel" role="tabpanel" id="directory-panel-players" aria-labelledby="directory-tab-players" hidden={directoryTab !== 'players'}>
      <section className="players-directory-toolbar grid gap-2 rounded-lg border border-[#adc8bb] bg-[#f8fbfa] p-3 sm:gap-3 lg:grid-cols-[minmax(0,1fr)_auto]" aria-label="Controles de jugadores">
        <div className="players-directory-search grid grid-cols-[minmax(0,1fr)_44px] gap-2">
          <input className="min-h-10 w-full rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-bold text-[#07130f] outline-none placeholder:text-[#6f837a] focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60 sm:min-h-11" type="search" placeholder="Buscar jugador, posicion o stat" aria-label="Buscar jugador" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className={primaryIconButtonClass} type="button" onClick={() => setQuery(query.trim())} aria-label="Buscar">
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 sm:pt-0">
          {payload.isAdmin ? <a className={`players-directory-create ${toolbarLinkClass}`} href="jugadores2.php?create=1#crear-jugador">Crear jugador</a> : null}
          {payload.isAdmin && payload.links.toggleInactive ? <a className={toolbarLinkClass} href={payload.links.toggleInactive}>{payload.showInactive ? 'Ver solo activos' : 'Ver inactivos'}</a> : null}
        </div>
      </section>

      <div className="directory-filters">
        <div className="directory-position-tabs" role="group" aria-label="Filtrar por posici?n">
          {[{ value: '', label: 'Todos' }, ...payload.positions].map(position => <button key={position.value} type="button" aria-pressed={positionFilter === position.value} onClick={() => setPositionFilter(position.value)}>{position.value || position.label}</button>)}
        </div>
        <label className="directory-sort">Ordenar por
          <select value={`${sortConfig.field}:${sortConfig.direction}`} onChange={event => { const [field, direction] = event.target.value.split(':'); setSortConfig({ field, direction }); }}>
            <option value="name:asc">Nombre A-Z</option><option value="name:desc">Nombre Z-A</option>
            <option value="overall:desc">Mayor media</option><option value="overall:asc">Menor media</option>
            <option value="position:asc">Posici?n A?Z</option><option value="position:desc">Posici?n Z?A</option>
          </select>
        </label>
      </div>

      {payload.isAdmin ? (
        <CreatePlayerPanel
          positions={payload.positions}
          statLabels={payload.statLabels}
          statHelp={payload.statHelp}
          defaultOpen={payload.createOpen}
        />
      ) : null}

      <div className="players-directory-list-heading">
        <h2>Plantilla</h2>
        <span role="status" aria-live="polite">{visiblePlayers.length} de {payload.players.length} jugadores</span>
      </div>

      {visiblePlayers.length === 0 ? (
        <p className="m-0 border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">No hay jugadores que coincidan con la busqueda.</p>
      ) : null}

      <section className="players-directory-mobile grid gap-2 md:hidden" aria-label="Lista de jugadores">
        {visiblePlayers.map((player) => (
          <article key={player.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-[#d7e6df] bg-white p-3">
            <button className={`directory-player-name ${focusRing}`} type="button" onClick={() => openPlayerModal(player.id)}>
              <DirectoryAvatar player={player} />
              <span className="directory-player-copy min-w-0 w-full">
                <strong className="block truncate text-[15px] font-black leading-tight text-[#07130f]">{player.name}</strong>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-slate-500">
                  <span>{player.isActive ? 'Activo' : 'Inactivo'}</span>
                </span>
              </span>
            </button>
            <div className="grid shrink-0 grid-cols-[minmax(56px,auto)_36px] grid-rows-2 items-stretch gap-1.5">
              <span className="row-span-2 grid">
                <DirectoryRatings player={player} />
              </span>
              <button className={`directory-credential ${rowCredentialButtonClass}`} type="button" onClick={() => setCardId(player.id)} aria-label={`Ver credencial de ${player.name}`}>
                <CredentialIcon /><span className="directory-action-label">Credencial</span>
              </button>
              <button className={`directory-open ${rowEditButtonClass}`} type="button" onClick={() => openPlayerModal(player.id)} aria-label={`${payload.isAdmin ? 'Editar ficha' : 'Ver datos'} de ${player.name}`}>
                {payload.isAdmin ? <PencilIcon /> : <InfoIcon />}<span className="directory-action-label">{payload.isAdmin ? 'Editar' : 'Ver ficha'}</span>
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="players-directory-table hidden overflow-x-auto rounded-lg border border-[#adc8bb] bg-white md:block" aria-label="Tabla de jugadores">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-[#f2f6f4]">
            <tr>
              <th className="border-b border-[#adc8bb] px-2 py-1.5 text-left text-xs font-black text-[#526b62]">
                <SortHeaderButton field="name" label="Jugador" sortConfig={sortConfig} onSort={handleHeaderSort} />
              </th>
              <th className="border-b border-[#adc8bb] px-2 py-1.5 text-left text-xs font-black text-[#526b62]">
                <SortHeaderButton field="position" label="Posicion" sortConfig={sortConfig} onSort={handleHeaderSort} />
              </th>
              <th className="border-b border-[#adc8bb] px-2 py-1.5 text-left text-xs font-black text-[#526b62]">
                <SortHeaderButton field="overall" label="Media" sortConfig={sortConfig} onSort={handleHeaderSort} />
              </th>
              <th className="border-b border-[#adc8bb] px-3 py-2 text-right text-xs font-black text-[#526b62]">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => (
              <tr key={player.id} className="border-b border-[#dfece6] transition-colors last:border-b-0 hover:bg-[#f8fbfa]">
                <td className="px-3 py-2">
                  <button className={`directory-player-name ${focusRing}`} type="button" onClick={() => openPlayerModal(player.id)}>
                    <DirectoryAvatar player={player} />
              <span className="directory-player-copy min-w-0 w-full">
                      <strong className="block truncate text-sm font-black text-[#07130f]">{player.name}</strong>
                      <small className="text-xs font-bold text-slate-500">{player.isActive ? 'Activo' : 'Inactivo'}</small>
                      <span className="mt-1 block">
                        <PositionRatingChips ratings={player.positionRatings} compact />
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-3 py-2"><PositionChips positions={player.positions} /></td>
                <td className="px-3 py-2">
                  <DirectoryRatings player={player} />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    <button className={`directory-credential ${rowCredentialButtonClass}`} type="button" onClick={() => setCardId(player.id)} aria-label={`Ver credencial de ${player.name}`}>
                      <CredentialIcon /><span className="directory-action-label">Credencial</span>
                    </button>
                    <button className={`directory-open ${rowEditButtonClass}`} type="button" onClick={() => openPlayerModal(player.id)} aria-label={`${payload.isAdmin ? 'Editar ficha' : 'Ver datos'} de ${player.name}`}>
                      {payload.isAdmin ? <PencilIcon /> : <InfoIcon />}<span className="directory-action-label">{payload.isAdmin ? 'Editar' : 'Ver ficha'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      </div>
      <div role="tabpanel" id="directory-panel-awards" aria-labelledby="directory-tab-awards" hidden={directoryTab !== 'awards'}>
        <AwardsOverview payload={payload} />
      </div>
      <CardPreviewModal player={cardPlayer} onClose={() => setCardId(null)} />
      <PlayerModal player={activePlayer} isAdmin={payload.isAdmin} deleteToken={payload.deleteToken} showInactive={payload.showInactive} positions={payload.positions} onClose={closePlayerModal} onRadarOpen={(player) => setRadarId(player.id)} positionRatingsPreview={activePositionRatings} onOverallPreviewChange={handleOverallPreviewChange} />
      <RadarOverlay player={radarPlayer} onClose={() => setRadarId(null)} />
    </div>
  );
}
