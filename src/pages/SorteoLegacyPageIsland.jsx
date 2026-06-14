import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';

const FORMATION_LINES = ['ARQ', 'DEF', 'LAT', 'MED', 'DEL'];
const PITCH_LINES = ['ARQ', 'DEF', 'MED', 'DEL'];
const FIELD_LINES = ['DEF', 'LAT', 'MED', 'DEL'];
const REQUIRED_FIELD_LINES = ['DEF', 'MED', 'DEL'];
const POSITION_ORDER = { ARQ: 0, DEF: 1, LAT: 2, MED: 3, DEL: 4 };
const POSITION_LABELS = { ARQ: 'Arquero', DEF: 'Defensa', LAT: 'Lateral', MED: 'Medio', DEL: 'Delantero' };
const ANALYSIS_FIELDS = [
  ['ataque', 'Ataque'],
  ['solidez', 'Solidez'],
  ['ritmo', 'Ritmo'],
  ['tecnica', 'Tecnica'],
  ['compromiso', 'Equipo'],
  ['mentalidad', 'Mentalidad'],
  ['regularidad', 'Regularidad'],
  ['arquero', 'Arquero'],
];
const TIER_BALANCE_WEIGHTS = { bronze: 35, silver: 45, gold: 70, elite: 110, supreme: 150 };
const TIER_LABELS = { bronze: 'Bronze', silver: 'Plata', gold: 'Oro', elite: 'Elite', supreme: 'Platinum' };
const GENERATION_STEPS = [
  'Preparando arqueros',
  'Repartiendo platinum',
  'Balanceando posiciones',
  'Optimizando puntaje',
  'Validando sorteo',
];
const STRICT_MAX_DIFF = 2.5;
const FLEXIBLE_MAX_DIFF = 6;

const cardBackgrounds = {
  bronze: 'assets/card-backgrounds/reference-bronze.png',
  silver: 'assets/card-backgrounds/reference-silver.png',
  gold: 'assets/card-backgrounds/reference-gold.png',
  elite: 'assets/card-backgrounds/reference-elite.png',
  supreme: 'assets/card-backgrounds/reference-supreme.png',
};

const compactCardBackgrounds = {
  bronze: 'assets/card-backgrounds/ai-compact-bronze.png',
  silver: 'assets/card-backgrounds/ai-compact-silver.png',
  gold: 'assets/card-backgrounds/ai-compact-gold.png',
  elite: 'assets/card-backgrounds/ai-compact-elite.png',
  supreme: 'assets/card-backgrounds/ai-compact-platinum.png',
};

const cardPalettes = {
  bronze: {
    color: '#f0b170',
    text: 'text-[#f0b170] [text-shadow:0_2px_0_rgba(0,0,0,.74),0_1px_5px_rgba(0,0,0,.38)]',
    separator: 'bg-[#f0b170]/34',
  },
  silver: {
    color: '#e8eeea',
    text: 'text-[#e8eeea] [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.42)]',
    separator: 'bg-[#e8eeea]/32',
  },
  gold: {
    color: '#f5d867',
    text: 'text-[#f5d867] [text-shadow:0_2px_0_rgba(0,0,0,.72),0_1px_5px_rgba(0,0,0,.36)]',
    separator: 'bg-[#f5d867]/34',
  },
  elite: {
    color: '#a5fff0',
    text: 'text-[#a5fff0] [text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.42)]',
    separator: 'bg-[#a5fff0]/34',
  },
  supreme: {
    color: '#dffdf3',
    text: 'text-[#dffdf3] [text-shadow:0_2px_0_rgba(0,0,0,.82),0_1px_6px_rgba(0,255,220,.34)]',
    separator: 'bg-[#9fffe6]/38',
  },
};

const teamColorOptions = [
  { name: 'ROSA', label: 'Rosa', accent: 'bg-rose-500', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'AZUL', label: 'Azul', accent: 'bg-sky-500', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'NARANJA', label: 'Naranja', accent: 'bg-orange-500', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'NEGRO', label: 'Negro', accent: 'bg-slate-950', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'VERDE', label: 'Verde', accent: 'bg-emerald-600', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'CAMISADO', label: 'Camisado', accent: 'bg-white ring-1 ring-slate-300', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'DESCAMISADO', label: 'Descamisado', accent: 'bg-stone-300', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
];

const positionWeights = {
  ARQ: { habilidad_arquero: 0.42, solidez: 0.14, ritmo_stat: 0.1, tecnica: 0.1, compromiso: 0.14, mentalidad: 0.1 },
  DEF: { solidez: 0.28, ritmo_stat: 0.2, tecnica: 0.18, compromiso: 0.13, mentalidad: 0.13, ataque: 0.08 },
  LAT: { ritmo_stat: 0.24, solidez: 0.22, tecnica: 0.17, compromiso: 0.15, ataque: 0.12, mentalidad: 0.1 },
  DEL: { ataque: 0.31, ritmo_stat: 0.2, tecnica: 0.17, compromiso: 0.14, mentalidad: 0.1, solidez: 0.08 },
  MED: { tecnica: 0.24, ritmo_stat: 0.23, compromiso: 0.19, mentalidad: 0.13, solidez: 0.12, ataque: 0.09 },
};

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60';
const inputClass = `min-h-10 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-bold text-[#07130f] outline-none transition focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60`;
const quietButtonClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-extrabold text-[#063d2b] transition-colors hover:border-[#9fc8b5] hover:bg-[#f4fbf7] ${focusRing}`;
const primaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#063d2b] bg-[#063d2b] px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#082f23] disabled:cursor-wait disabled:opacity-70 ${focusRing}`;
const secondaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9fc8b5] bg-[#eaf7f0] px-4 text-sm font-black text-[#063d2b] transition-colors hover:border-[#063d2b] hover:bg-[#dff1e8] ${focusRing}`;
const dangerButtonClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-extrabold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 ${focusRing}`;
const iconButtonClass = `grid h-9 w-9 place-items-center rounded-lg border border-[#d7e6df] bg-white text-[#526b62] transition-colors hover:border-[#9fc8b5] hover:bg-[#f5faf7] hover:text-[#063d2b] ${focusRing}`;
const pitchBackgroundClass = 'bg-[linear-gradient(rgba(5,37,27,.10),rgba(5,37,27,.24)),url(/assets/images/captain-field-bg-vertical.jpg),linear-gradient(160deg,#0e7a43,#07563d)] [background-position:center,center,center] [background-repeat:no-repeat,no-repeat,no-repeat] [background-size:auto,100%_100%,auto]';
const pitchLineToneClasses = {
  ARQ: 'border-l-4 border-l-amber-300/80 bg-amber-200/7',
  DEF: 'border-l-4 border-l-cyan-200/80 bg-cyan-200/7',
  MED: 'border-l-4 border-l-lime-200/80 bg-lime-200/7',
  DEL: 'border-l-4 border-l-rose-200/80 bg-rose-200/7',
};
const pitchLineLabelClasses = {
  ARQ: 'bg-amber-200 text-[#07130f]',
  DEF: 'bg-cyan-100 text-[#07130f]',
  MED: 'bg-lime-200 text-[#07130f]',
  DEL: 'bg-rose-100 text-[#07130f]',
};

function parsePayload(root) {
  try {
    const parsed = JSON.parse(root.dataset.payload || '{}');
    return {
      mode: String(parsed.mode || 'sorteo'),
      matchId: Number(parsed.matchId || 0),
      match: parsed.match || null,
      players: Array.isArray(parsed.players) ? parsed.players : [],
      initialTeams: Array.isArray(parsed.initialTeams) ? parsed.initialTeams : [],
      teamColors: Array.isArray(parsed.teamColors) ? parsed.teamColors : [],
      pairHistory: parsed.pairHistory || {},
      drawBalanceWeights: parsed.drawBalanceWeights || {},
      allowRedraw: parsed.allowRedraw !== false,
      redrawLimit: Math.max(0, Number(parsed.redrawLimit ?? 3)),
      redrawCount: Math.max(0, Number(parsed.redrawCount || 0)),
      hasSavedDraw: parsed.hasSavedDraw === true,
      savedDrawSignature: typeof parsed.savedDrawSignature === 'string' ? parsed.savedDrawSignature : '',
      maxFieldPlayersPerLine: Number(parsed.maxFieldPlayersPerLine || 5),
      numTeams: Math.max(2, Math.min(4, Number(parsed.numTeams || parsed.match?.numTeams || 2))),
      loadError: String(parsed.loadError || ''),
      links: parsed.links || {},
    };
  } catch {
    return {
      mode: 'sorteo',
      matchId: 0,
      match: null,
      players: [],
      initialTeams: [],
      teamColors: [],
      pairHistory: {},
      drawBalanceWeights: {},
      allowRedraw: true,
      redrawLimit: 3,
      redrawCount: 0,
      hasSavedDraw: false,
      savedDrawSignature: '',
      maxFieldPlayersPerLine: 5,
      numTeams: 2,
      loadError: '',
      links: {},
    };
  }
}

function normalizeSix(value, fallback = 3) {
  const number = Number.parseFloat(String(value ?? ''));
  const base = Number.isFinite(number) ? number : fallback;
  return Math.max(1, Math.min(6, Math.round(base * 10) / 10));
}

function normalizePositionText(raw) {
  const clean = String(raw || '')
    .split('/')
    .map((position) => position.trim().toUpperCase())
    .filter((position) => FORMATION_LINES.includes(position));
  return Array.from(new Set(clean)).slice(0, 2).join('/') || 'MED';
}

function normalizePace(raw) {
  const value = String(raw || '').toLocaleLowerCase('es-AR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return value === 'lento' ? 'lento' : 'rapido';
}

function clampPhotoPosition(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : fallback;
}

function clampPhotoZoom(value, fallback = 100) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.max(50, Math.min(180, number)) : fallback;
}

function playerPhotoPositionStyle(player) {
  if (!player?.has_custom_photo) return undefined;
  const x = clampPhotoPosition(player.photo_position_x, 50);
  const y = clampPhotoPosition(player.photo_position_y, 50);
  const scale = clampPhotoZoom(player.photo_zoom, 100) / 100;
  const offsetX = (50 - x) * 0.45;
  const offsetY = (50 - y) * 0.45;
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

function normalizePlayer(raw, index) {
  const baseRating = normalizeSix(raw.puntuacion ?? raw.rating ?? raw.overall, 3);
  const ritmoStat = normalizeSix(raw.ritmo_stat ?? raw.rhythm, normalizePace(raw.ritmo ?? raw.pace) === 'lento' ? 2 : 4);
  const photoPath = String(raw.photo_path || '');
  const safePhoto = photoPath.startsWith('uploads/players/') && !photoPath.includes('..')
    ? photoPath
    : 'assets/players/default-player-silhouette.png';
  return {
    ...raw,
    id: raw.id ?? `local-${index + 1}-${String(raw.nombre || raw.name || 'jugador').replace(/\W+/g, '-').toLowerCase()}`,
    nombre: String(raw.nombre || raw.name || `Jugador ${index + 1}`).trim() || `Jugador ${index + 1}`,
    posicion: normalizePositionText(raw.posicion || raw.positions),
    ritmo: normalizePace(raw.ritmo || raw.pace),
    puntuacion: baseRating,
    tecnica: normalizeSix(raw.tecnica ?? raw.technique, baseRating),
    ritmo_stat: ritmoStat,
    solidez: normalizeSix(raw.solidez ?? raw.defense_physical, baseRating),
    ataque: normalizeSix(raw.ataque ?? raw.attack, baseRating),
    compromiso: normalizeSix(raw.compromiso ?? raw.teamwork, baseRating),
    mentalidad: normalizeSix(raw.mentalidad ?? raw.mentality, 3),
    regularidad: normalizeSix(raw.regularidad ?? raw.regularity, 3.5),
    habilidad_arquero: normalizeSix(raw.habilidad_arquero ?? raw.goalkeeper_skill, baseRating),
    photo_path: safePhoto,
    has_custom_photo: raw.has_custom_photo === true || safePhoto.startsWith('uploads/players/'),
    photo_position_x: clampPhotoPosition(raw.photo_position_x ?? raw.photoPositionX, 50),
    photo_position_y: clampPhotoPosition(raw.photo_position_y ?? raw.photoPositionY, 50),
    photo_zoom: clampPhotoZoom(raw.photo_zoom ?? raw.photoZoom, 100),
    selected: raw.selected !== false,
  };
}

function playerKey(player) {
  return String(player?.id ?? player?.nombre ?? '');
}

function getOrderedPlayerPositions(player) {
  return normalizePositionText(player?.posicion).split('/').filter(Boolean);
}

function getPrimaryPlayerPosition(player) {
  return getOrderedPlayerPositions(player)[0] || 'MED';
}

function canPlayGoalkeeper(player) {
  return getOrderedPlayerPositions(player).includes('ARQ') || player?.emergencyGoalkeeper === true || player?.manualGoalkeeper === true;
}

function isFixedGoalkeeper(player) {
  return player?.manualGoalkeeper === true;
}

function goalkeeperSortValue(player) {
  if (player?.manualGoalkeeper === true) return 0;
  if (getPrimaryPlayerPosition(player) === 'ARQ') return 1;
  if (getOrderedPlayerPositions(player).includes('ARQ')) return 2;
  if (player?.emergencyGoalkeeper === true) return 3;
  return 4;
}

function initialManualGoalkeepers(players) {
  return Object.fromEntries(
    players
      .filter((player) => getPrimaryPlayerPosition(player) === 'ARQ')
      .map((player) => [playerKey(player), true]),
  );
}

function pitchLineForPosition(position) {
  return String(position || '').toUpperCase() === 'LAT' ? 'DEF' : String(position || '').toUpperCase();
}

function positionFitFactor(player, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (!position) return 1;
  const naturalPositions = getOrderedPlayerPositions(player);
  const naturalIndex = naturalPositions.indexOf(position);
  if (naturalIndex === 0) return 1;
  if (naturalIndex === 1) return 0.95;
  const naturalLines = naturalPositions.map(pitchLineForPosition);
  return naturalLines.includes(pitchLineForPosition(position)) ? 0.90 : 0.90;
}

function defenseLinePlayers(players, assignments) {
  const laterals = [];
  const defenders = [];
  players.forEach((player) => {
    const assigned = String(assignments[playerKey(player)] || getPrimaryPlayerPosition(player)).toUpperCase();
    if (assigned === 'LAT') {
      laterals.push(player);
    } else {
      defenders.push(player);
    }
  });
  if (!laterals.length) return defenders;
  const leftCount = Math.ceil(laterals.length / 2);
  return [
    ...laterals.slice(0, leftCount),
    ...defenders,
    ...laterals.slice(leftCount),
  ];
}

function closestDefenderForLateralReplacement(team, assignments, lateralKey, lockedPlayerPositions = {}) {
  const defensePlayers = team.filter((player) => {
    const assigned = String(assignments[playerKey(player)] || getPrimaryPlayerPosition(player)).toUpperCase();
    return assigned === 'DEF' || assigned === 'LAT';
  });
  const orderedDefense = defenseLinePlayers(defensePlayers, assignments);
  const lateralIndex = orderedDefense.findIndex((player) => playerKey(player) === String(lateralKey));
  const candidates = orderedDefense
    .map((player, index) => ({ player, index }))
    .filter(({ player }) => {
      const key = playerKey(player);
      const assigned = String(assignments[key] || getPrimaryPlayerPosition(player)).toUpperCase();
      return key !== String(lateralKey)
        && assigned === 'DEF'
        && !lockedPlayerPositions[key]
        && !isFixedGoalkeeper(player);
    });
  if (!candidates.length) return null;
  if (lateralIndex < 0) return playerKey(candidates[0].player);
  return playerKey(candidates
    .sort((left, right) => Math.abs(left.index - lateralIndex) - Math.abs(right.index - lateralIndex))[0].player);
}

function statValue(player, field) {
  const fallback = field === 'regularidad' ? 3.5 : (field === 'mentalidad' ? 3 : Number(player?.puntuacion || 3));
  return normalizeSix(player?.[field], fallback);
}

function isLowRhythmPlayer(player) {
  return statValue(player, 'ritmo_stat') <= 3;
}

function isIrregularPlayer(player) {
  return playerCardRating(statValue(player, 'regularidad')) < 70;
}

function applyRegularityAdjustment(rating, player) {
  const factor = 1 + ((statValue(player, 'regularidad') - 3.5) / 50);
  return Math.max(1, Math.min(6, rating * factor));
}

function positionBaseRating(player, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (position === 'ARQ' && !canPlayGoalkeeper(player)) {
    return 2;
  }
  const weights = positionWeights[position] || positionWeights.MED;
  return Object.entries(weights).reduce((total, [field, weight]) => total + (statValue(player, field) * weight), 0);
}

function adjustedPositionRating(player, assignedPosition) {
  const position = String(assignedPosition || getPrimaryPlayerPosition(player)).toUpperCase();
  return Math.max(1, Math.min(6, applyRegularityAdjustment(positionBaseRating(player, position), player) * positionFitFactor(player, position)));
}

function positionPenaltyPercent(player, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (!position || getOrderedPlayerPositions(player).includes(position)) return 0;
  const general = bestNaturalPlayerRating(player);
  const adjusted = adjustedPositionRating(player, position);
  if (!general || adjusted >= general) return 0;
  return Math.max(1, Math.min(99, Math.round((1 - (adjusted / general)) * 100)));
}

function bestNaturalPlayerPosition(player) {
  return getOrderedPlayerPositions(player)
    .slice()
    .sort((a, b) => {
      const ratingDiff = adjustedPositionRating(player, b) - adjustedPositionRating(player, a);
      if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
      return (POSITION_ORDER[a] ?? 99) - (POSITION_ORDER[b] ?? 99);
    })[0] || 'MED';
}

function bestNaturalPlayerRating(player) {
  return adjustedPositionRating(player, bestNaturalPlayerPosition(player));
}

function playerCardRating(value) {
  const rating = Math.max(1, Math.min(6, Number(value || 0)));
  const anchors = [
    [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
    [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
    [5.2, 93], [5.3, 94], [6.0, 99],
  ];
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = anchors[index];
    const [toRating, toOverall] = anchors[index + 1];
    if (rating <= toRating) {
      const ratio = (rating - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 99;
}

function playerCardTier(value) {
  const overall = playerCardRating(value);
  if (overall >= 88) return 'supreme';
  if (overall >= 84) return 'elite';
  if (overall >= 76) return 'gold';
  if (overall >= 66) return 'silver';
  return 'bronze';
}

function compactCardNameLines(name) {
  const text = String(name || '').trim() || 'Jugador';
  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || text.length <= 8) return [text];
  const total = parts.join('').length;
  let bestIndex = 1;
  let bestScore = Infinity;
  for (let index = 1; index < parts.length; index += 1) {
    const left = parts.slice(0, index).join('');
    const right = parts.slice(index).join('');
    const score = Math.abs((total / 2) - left.length) + (Math.max(left.length, right.length) * 0.08);
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return [parts.slice(0, bestIndex).join(' '), parts.slice(bestIndex).join(' ')];
}

function isPlatinumPlayer(player) {
  return playerCardTier(bestNaturalPlayerRating(player)) === 'supreme';
}

function playerCardStats(player, assignedPosition) {
  if (String(assignedPosition || '').toUpperCase() === 'ARQ') {
    return [
      { label: 'ARQ', value: playerCardRating(statValue(player, 'habilidad_arquero')) },
      { label: 'RIT', value: playerCardRating(statValue(player, 'ritmo_stat')) },
      { label: 'DEF', value: playerCardRating(statValue(player, 'solidez')) },
      { label: 'TEC', value: playerCardRating(statValue(player, 'tecnica')) },
      { label: 'EQU', value: playerCardRating(statValue(player, 'compromiso')) },
      { label: 'MEN', value: playerCardRating(statValue(player, 'mentalidad')) },
    ];
  }
  return [
    { label: 'TEC', value: playerCardRating(statValue(player, 'tecnica')) },
    { label: 'RIT', value: playerCardRating(statValue(player, 'ritmo_stat')) },
    { label: 'DEF', value: playerCardRating(statValue(player, 'solidez')) },
    { label: 'ATA', value: playerCardRating(statValue(player, 'ataque')) },
    { label: 'EQU', value: playerCardRating(statValue(player, 'compromiso')) },
    { label: 'MEN', value: playerCardRating(statValue(player, 'mentalidad')) },
  ];
}

function playerPositionRatings(player, assignedPosition = '') {
  const natural = getOrderedPlayerPositions(player);
  const positions = Array.from(new Set([...natural, String(assignedPosition || '').toUpperCase()].filter((position) => FORMATION_LINES.includes(position))));
  return positions
    .map((position) => ({ position, value: playerCardRating(adjustedPositionRating(player, position)), natural: natural.includes(position) }))
    .sort((left, right) => right.value - left.value || POSITION_ORDER[left.position] - POSITION_ORDER[right.position]);
}

function playerRegularityForm(player) {
  const rating = statValue(player, 'regularidad');
  if (rating >= 4.5) return 'up';
  if (rating < 3) return 'down';
  return 'right';
}

function drawSignature(teams) {
  if (!Array.isArray(teams) || !teams.length) return '';
  return teams
    .map((team) => team.map(playerKey).sort().join(','))
    .sort()
    .join('|');
}

function shuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const next = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[next]] = [copy[next], copy[index]];
  }
  return copy;
}

function maxFieldPlayersPerLine(teamSize) {
  const fieldPlayers = Math.max(0, Number(teamSize || 0) - 1);
  return fieldPlayers > 0 ? Math.max(1, Math.floor(fieldPlayers / 2)) : 0;
}

function maxDefLatPlayersPerPosition(teamSize) {
  return maxFieldPlayersPerLine(teamSize);
}

function fieldLineLimit(position, teamSize) {
  const line = String(position || '').toUpperCase();
  if (line === 'ARQ') return 1;
  return maxFieldPlayersPerLine(teamSize);
}

function fieldLineMinimum(position, teamSize) {
  const line = String(position || '').toUpperCase();
  const fieldPlayers = Math.max(0, Number(teamSize || 0) - 1);
  if (line === 'ARQ') return 1;
  if (fieldPlayers === 4) return REQUIRED_FIELD_LINES.includes(line) ? 1 : 0;
  if (fieldPlayers < 5) return 0;
  if (line === 'DEF' || line === 'MED') return 2;
  if (line === 'DEL') return 1;
  return 0;
}

function logicalLineMinimum(position, teamSize) {
  const line = String(position || '').toUpperCase();
  if (line === 'ARQ') return 1;
  if (!FIELD_LINES.includes(line)) return 0;
  const fieldPlayers = Math.max(0, Number(teamSize || 0) - 1);
  if (line === 'LAT') return fieldPlayers >= 8 ? 2 : (fieldPlayers >= FIELD_LINES.length ? 1 : 0);
  return fieldPlayers >= FIELD_LINES.length ? 1 : 0;
}

function logicalLineMinimumForCounts(position, teamSize, counts = {}) {
  const line = String(position || '').toUpperCase();
  const defenseTotal = Number(counts?.DEF || 0) + Number(counts?.LAT || 0);
  if (line === 'DEF' && defenseTotal <= 2) return fieldLineMinimum('DEF', teamSize);
  if (line === 'LAT' && defenseTotal <= 2) return 0;
  return logicalLineMinimum(line, teamSize);
}

function pitchLineCountsFromLogical(logicalCounts = {}) {
  return {
    ARQ: Number(logicalCounts.ARQ || 0),
    DEF: Number(logicalCounts.DEF || 0) + Number(logicalCounts.LAT || 0),
    MED: Number(logicalCounts.MED || 0),
    DEL: Number(logicalCounts.DEL || 0),
  };
}

function fieldLineCountsFitLimits(counts, teamSize) {
  const pitchCounts = pitchLineCountsFromLogical(counts);
  const max = maxFieldPlayersPerLine(teamSize);
  const hasGoalkeeperCount = Object.prototype.hasOwnProperty.call(counts || {}, 'ARQ');
  const defenseTotal = Number(counts?.DEF || 0) + Number(counts?.LAT || 0);
  const defenseRolesFit = defenseTotal <= 2
    ? Number(counts?.LAT || 0) === 0
    : Number(counts?.LAT || 0) === 0 || Number(counts?.DEF || 0) >= 1;
  return (!hasGoalkeeperCount || pitchCounts.ARQ === fieldLineMinimum('ARQ', teamSize))
    && defenseRolesFit
    && REQUIRED_FIELD_LINES.every((line) => (
      pitchCounts[line] >= fieldLineMinimum(line, teamSize)
      && pitchCounts[line] <= max
    ))
    && FIELD_LINES.every((line) => (
      Number(counts?.[line] || 0) >= logicalLineMinimumForCounts(line, teamSize, counts)
      && Number(counts?.[line] || 0) <= fieldLineLimit(line, teamSize)
    ));
}

function pitchLineCountsFitLimits(counts, teamSize) {
  const pitchCounts = pitchLineCountsFromLogical(counts);
  const max = maxFieldPlayersPerLine(teamSize);
  const hasGoalkeeperCount = Object.prototype.hasOwnProperty.call(counts || {}, 'ARQ');
  return (!hasGoalkeeperCount || pitchCounts.ARQ === fieldLineMinimum('ARQ', teamSize))
    && REQUIRED_FIELD_LINES.every((line) => (
      pitchCounts[line] >= fieldLineMinimum(line, teamSize)
      && pitchCounts[line] <= max
    ));
}

function lineCountLabel(line, pitchCount = false) {
  const normalized = String(line || '').toUpperCase();
  if (pitchCount && normalized === 'DEF') return 'DEF/LAT';
  return normalized;
}

function lineCountViolationMessage(counts, teamSize, { includeLogical = true } = {}) {
  const pitchCounts = pitchLineCountsFromLogical(counts);
  const max = maxFieldPlayersPerLine(teamSize);
  const defenseTotal = Number(counts?.DEF || 0) + Number(counts?.LAT || 0);
  if (defenseTotal <= 2 && Number(counts?.LAT || 0) > 0) {
    return 'No se puede mover: con 2 jugadores en DEF/LAT, ambos deben quedar como DEF.';
  }
  if (defenseTotal > 2 && Number(counts?.LAT || 0) > 0 && Number(counts?.DEF || 0) < 1) {
    return 'No se puede mover: para usar LAT tiene que quedar al menos un DEF central.';
  }
  const hasGoalkeeperCount = Object.prototype.hasOwnProperty.call(counts || {}, 'ARQ');
  if (hasGoalkeeperCount) {
    const requiredGoalkeepers = fieldLineMinimum('ARQ', teamSize);
    if (pitchCounts.ARQ !== requiredGoalkeepers) {
      return `No se puede mover: ARQ quedaria con ${pitchCounts.ARQ}/${requiredGoalkeepers}.`;
    }
  }
  for (const line of REQUIRED_FIELD_LINES) {
    const min = fieldLineMinimum(line, teamSize);
    const count = pitchCounts[line];
    if (count < min) return `No se puede mover: ${lineCountLabel(line, true)} quedaria con ${count}. Minimo ${min}.`;
    if (count > max) return `No se puede mover: ${lineCountLabel(line, true)} quedaria con ${count}. Maximo ${max}.`;
  }
  if (!includeLogical) return '';
  for (const line of FIELD_LINES) {
    const min = logicalLineMinimumForCounts(line, teamSize, counts);
    const limit = fieldLineLimit(line, teamSize);
    const count = Number(counts?.[line] || 0);
    if (count < min) return `No se puede mover: ${lineCountLabel(line)} quedaria con ${count}. Minimo ${min}.`;
    if (count > limit) return `No se puede mover: ${lineCountLabel(line)} quedaria con ${count}. Maximo ${limit}.`;
  }
  return '';
}

function teammatePairKey(a, b) {
  const idA = Number.parseInt(String(a?.id || '0'), 10);
  const idB = Number.parseInt(String(b?.id || '0'), 10);
  if (!idA || !idB) return '';
  return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
}

function historicalRepeatPenalty(teams, pairHistory) {
  let penalty = 0;
  teams.forEach((team) => {
    for (let a = 0; a < team.length; a += 1) {
      for (let b = a + 1; b < team.length; b += 1) {
        const key = teammatePairKey(team[a], team[b]);
        if (!key) continue;
        const repeats = Number(pairHistory[key] || 0);
        penalty += repeats * repeats * 35;
      }
    }
  });
  return penalty;
}

function teamRepeatedPairs(team, pairHistory = {}) {
  const pairs = [];
  for (let a = 0; a < team.length; a += 1) {
    for (let b = a + 1; b < team.length; b += 1) {
      const key = teammatePairKey(team[a], team[b]);
      if (!key) continue;
      const repeats = Number(pairHistory[key] || 0);
      if (repeats > 0) pairs.push({ names: `${team[a].nombre} + ${team[b].nombre}`, count: repeats });
    }
  }
  return pairs.sort((left, right) => right.count - left.count || left.names.localeCompare(right.names, 'es')).slice(0, 3);
}

function prepareEmergencyGoalkeepers(players, numTeams) {
  const goalkeeperCandidates = players.filter(canPlayGoalkeeper);
  const missing = Math.max(0, numTeams - goalkeeperCandidates.length);
  if (!missing) return { players, emergencyGoalkeepers: [] };
  const emergencyIds = new Set(players
    .filter((player) => !canPlayGoalkeeper(player))
    .sort((a, b) => bestNaturalPlayerRating(a) - bestNaturalPlayerRating(b))
    .slice(0, missing)
    .map(playerKey));
  const prepared = players.map((player) => (emergencyIds.has(playerKey(player)) ? { ...player, emergencyGoalkeeper: true } : player));
  return { players: prepared, emergencyGoalkeepers: prepared.filter((player) => emergencyIds.has(playerKey(player))) };
}

function normalizeAssignments(assignments) {
  return { ...(assignments || {}) };
}

function buildTeamAssignment(team, assignmentOverrides = {}) {
  const assignment = {};
  team.forEach((player) => {
    const key = playerKey(player);
    const override = String(assignmentOverrides[key] || '').toUpperCase();
    assignment[key] = isFixedGoalkeeper(player) ? 'ARQ' : (FORMATION_LINES.includes(override) ? override : getPrimaryPlayerPosition(player));
  });

  const fixedGoalkeepers = team.filter(isFixedGoalkeeper);
  const goalkeeperCandidates = fixedGoalkeepers.length ? fixedGoalkeepers : team
    .slice()
    .sort((a, b) => {
      const aCan = canPlayGoalkeeper(a);
      const bCan = canPlayGoalkeeper(b);
      if (aCan !== bCan) return aCan ? -1 : 1;
      const priorityDiff = goalkeeperSortValue(a) - goalkeeperSortValue(b);
      if (priorityDiff) return priorityDiff;
      return adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ');
    })
    .slice(0, 1);
  goalkeeperCandidates.forEach((goalkeeper) => {
    assignment[playerKey(goalkeeper)] = 'ARQ';
  });
  team.forEach((player) => {
    if (!goalkeeperCandidates.includes(player) && assignment[playerKey(player)] === 'ARQ') {
      assignment[playerKey(player)] = bestNaturalPlayerPosition(player) === 'ARQ' ? 'MED' : bestNaturalPlayerPosition(player);
    }
  });

  if (team.length >= 4) {
    REQUIRED_FIELD_LINES.forEach((line) => {
      let guard = 0;
      while (guard < team.length) {
        guard += 1;
        const counts = pitchLineCountsFromLogical(teamLineCounts(team, assignment));
        if ((counts[line] || 0) >= fieldLineMinimum(line, team.length)) break;
        const candidate = team
          .filter((player) => assignment[playerKey(player)] !== 'ARQ')
          .filter((player) => {
            const currentLine = pitchLineForPosition(assignment[playerKey(player)]);
            return currentLine !== line && (counts[currentLine] || 0) > fieldLineMinimum(currentLine, team.length);
          })
          .sort((a, b) => adjustedPositionRating(b, line) - adjustedPositionRating(a, line))[0];
        if (!candidate) break;
        assignment[playerKey(candidate)] = line;
      }
    });
  }

  FIELD_LINES.forEach((line) => {
    let guard = 0;
    while (guard < team.length) {
      guard += 1;
      const counts = teamLineCounts(team, assignment);
      if ((counts[line] || 0) >= logicalLineMinimumForCounts(line, team.length, counts)) break;
      const pitchCounts = pitchLineCountsFromLogical(counts);
      const candidate = team
        .filter((player) => assignment[playerKey(player)] !== 'ARQ')
        .filter((player) => {
            const currentLine = assignment[playerKey(player)] || getPrimaryPlayerPosition(player);
            return currentLine !== line
            && (counts[currentLine] || 0) > logicalLineMinimumForCounts(currentLine, team.length, counts)
            && (pitchCounts[pitchLineForPosition(currentLine)] || 0) > fieldLineMinimum(pitchLineForPosition(currentLine), team.length);
        })
        .sort((a, b) => {
          const currentA = assignment[playerKey(a)] || getPrimaryPlayerPosition(a);
          const currentB = assignment[playerKey(b)] || getPrimaryPlayerPosition(b);
          const lossA = adjustedPositionRating(a, currentA) - adjustedPositionRating(a, line);
          const lossB = adjustedPositionRating(b, currentB) - adjustedPositionRating(b, line);
          if (Math.abs(lossA - lossB) > 0.0001) return lossA - lossB;
          return adjustedPositionRating(b, line) - adjustedPositionRating(a, line);
        })[0];
      if (!candidate) break;
      assignment[playerKey(candidate)] = line;
    }
  });

  let changed = true;
  let guard = 0;
  while (changed && guard < team.length * FIELD_LINES.length) {
    changed = false;
    guard += 1;
    const counts = teamLineCounts(team, assignment);
    const pitchCounts = pitchLineCountsFromLogical(counts);
    const max = maxFieldPlayersPerLine(team.length);
    const exceededLine = REQUIRED_FIELD_LINES.find((line) => pitchCounts[line] > max);
    if (!exceededLine) break;
    const originLines = exceededLine === 'DEF' ? ['DEF', 'LAT'] : [exceededLine];
    const targetLine = REQUIRED_FIELD_LINES
      .filter((line) => line !== exceededLine && pitchCounts[line] < max)
      .sort((a, b) => pitchCounts[a] - pitchCounts[b])[0];
    if (!targetLine) break;
    const candidate = team
      .filter((player) => originLines.includes(assignment[playerKey(player)]))
      .filter((player) => {
        const assigned = assignment[playerKey(player)];
        return (counts[assigned] || 0) > logicalLineMinimumForCounts(assigned, team.length, counts);
      })
      .sort((a, b) => {
        const assignedA = assignment[playerKey(a)];
        const assignedB = assignment[playerKey(b)];
        const lossA = adjustedPositionRating(a, assignedA) - adjustedPositionRating(a, targetLine);
        const lossB = adjustedPositionRating(b, assignedB) - adjustedPositionRating(b, targetLine);
        return lossA - lossB;
      })[0];
    if (!candidate) break;
    assignment[playerKey(candidate)] = targetLine;
    changed = true;
  }

  return normalizeCompactDefenseAssignments(team, assignment);
}

function teamLineCounts(team, assignments) {
  const counts = Object.fromEntries(FORMATION_LINES.map((line) => [line, 0]));
  team.forEach((player) => {
    const position = assignments[playerKey(player)] || getPrimaryPlayerPosition(player);
    if (counts[position] !== undefined) counts[position] += 1;
  });
  return counts;
}

function normalizeDefenseLaneAssignments(team, assignments = {}) {
  const defensePlayers = team.filter((player) => {
    const assigned = String(assignments[playerKey(player)] || getPrimaryPlayerPosition(player)).toUpperCase();
    return pitchLineForPosition(assigned) === 'DEF';
  });
  if (!defensePlayers.length) return assignments;
  const next = { ...assignments };
  const orderedDefense = defenseLinePlayers(defensePlayers, assignments);
  orderedDefense.forEach((player, index) => {
    const key = playerKey(player);
    next[key] = orderedDefense.length >= 3 && (index === 0 || index === orderedDefense.length - 1) ? 'LAT' : 'DEF';
  });
  return next;
}

function normalizeCompactDefenseAssignments(team, assignments = {}) {
  return normalizeDefenseLaneAssignments(team, assignments);
}

function teamScore(team, assignmentOverrides = {}) {
  const assignments = buildTeamAssignment(team, assignmentOverrides);
  return team.reduce((sum, player) => sum + adjustedPositionRating(player, assignments[playerKey(player)]), 0);
}

function teamTotalsSummary(team, assignmentOverrides = {}) {
  const assignments = buildTeamAssignment(team, assignmentOverrides);
  return {
    adjusted: teamScore(team, assignmentOverrides),
    ataque: average(team, 'ataque'),
    solidez: average(team, 'solidez'),
    ritmo: average(team, 'ritmo_stat'),
    tecnica: average(team, 'tecnica'),
    compromiso: average(team, 'compromiso'),
    mentalidad: average(team, 'mentalidad'),
    regularidad: average(team, 'regularidad'),
    arquero: team.reduce((max, player) => {
      const assigned = assignments[playerKey(player)];
      return assigned === 'ARQ' ? Math.max(max, adjustedPositionRating(player, 'ARQ')) : max;
    }, 0),
  };
}

function sortedAnalysisStats(summary) {
  return ANALYSIS_FIELDS
    .map(([field, label]) => ({ field, label, value: Number(summary[field] || 0) }))
    .filter((stat) => stat.field !== 'arquero' || stat.value > 0)
    .sort((left, right) => right.value - left.value);
}

function formatLineCounts(counts) {
  return FORMATION_LINES
    .filter((line) => Number(counts[line] || 0) > 0)
    .map((line) => `${line} ${counts[line]}`)
    .join(' / ');
}

function formatTierCounts(counts) {
  return Object.keys(TIER_BALANCE_WEIGHTS)
    .filter((tier) => Number(counts[tier] || 0) > 0)
    .map((tier) => `${TIER_LABELS[tier] || tier} ${counts[tier]}`)
    .join(' / ');
}

function average(team, field) {
  if (!team.length) return 0;
  return team.reduce((sum, player) => sum + statValue(player, field), 0) / team.length;
}

function countSpread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function positionBalancePenalty(teams, assignmentOverrides = {}) {
  if (!teams.length) return 0;
  const teamSize = Math.max(...teams.map((team) => team.length), 0);
  const countsByLine = Object.fromEntries(FIELD_LINES.map((line) => [line, []]));
  let penalty = 0;
  teams.forEach((team) => {
    const counts = teamLineCounts(team, buildTeamAssignment(team, assignmentOverrides));
    FIELD_LINES.forEach((line) => {
      const count = Number(counts[line] || 0);
      countsByLine[line].push(count);
      const min = logicalLineMinimumForCounts(line, teamSize, counts);
      if (count < min) penalty += (min - count) * 500;
    });
  });
  FIELD_LINES.forEach((line) => {
    penalty += countSpread(countsByLine[line]) * 140;
  });
  return penalty;
}

function tierCountsForTeam(team, assignmentOverrides = {}) {
  const assignments = buildTeamAssignment(team, assignmentOverrides);
  const counts = Object.fromEntries(Object.keys(TIER_BALANCE_WEIGHTS).map((tier) => [tier, 0]));
  team.forEach((player) => {
    const assigned = assignments[playerKey(player)] || getPrimaryPlayerPosition(player);
    const tier = playerCardTier(adjustedPositionRating(player, assigned));
    counts[tier] = (counts[tier] || 0) + 1;
  });
  return counts;
}

function tierBalancePenalty(teams, assignmentOverrides = {}) {
  if (!teams.length) return 0;
  const countsByTier = Object.fromEntries(Object.keys(TIER_BALANCE_WEIGHTS).map((tier) => [tier, []]));
  teams.forEach((team) => {
    const counts = tierCountsForTeam(team, assignmentOverrides);
    Object.keys(TIER_BALANCE_WEIGHTS).forEach((tier) => {
      countsByTier[tier].push(counts[tier] || 0);
    });
  });
  return Object.entries(TIER_BALANCE_WEIGHTS).reduce((sum, [tier, weight]) => (
    sum + (countSpread(countsByTier[tier] || []) * weight)
  ), 0);
}

function platinumSpread(teams, assignmentOverrides = {}) {
  if (!teams.length) return 0;
  return countSpread(teams.map((team) => tierCountsForTeam(team, assignmentOverrides).supreme || 0));
}

function scoreTeams(teams, pairHistory, assignmentOverrides = {}, weights = {}) {
  const totals = teams.map((team) => teamScore(team, assignmentOverrides));
  const diff = Math.max(...totals) - Math.min(...totals);
  const slowCounts = teams.map((team) => team.filter(isLowRhythmPlayer).length);
  const slowSpread = Math.max(...slowCounts) - Math.min(...slowCounts);
  const irregularCounts = teams.map((team) => team.filter(isIrregularPlayer).length);
  const irregularSpread = Math.max(...irregularCounts) - Math.min(...irregularCounts);
  const supremeSpread = platinumSpread(teams, assignmentOverrides);
  const teamSize = Math.max(...teams.map((team) => team.length), 0);
  const linePenalty = teams.reduce((sum, team) => {
    const counts = teamLineCounts(team, buildTeamAssignment(team, assignmentOverrides));
    const pitchCounts = {
      ARQ: counts.ARQ,
      DEF: counts.DEF + counts.LAT,
      MED: counts.MED,
      DEL: counts.DEL,
    };
    let penalty = counts.ARQ === 1 ? 0 : Math.abs(counts.ARQ - 1) * 200;
    REQUIRED_FIELD_LINES.forEach((line) => {
      const min = fieldLineMinimum(line, teamSize);
      if (pitchCounts[line] < min) penalty += (min - pitchCounts[line]) * 220;
      if (pitchCounts[line] > maxFieldPlayersPerLine(teamSize)) penalty += (pitchCounts[line] - maxFieldPlayersPerLine(teamSize)) * 30;
    });
    FIELD_LINES.forEach((line) => {
      const min = logicalLineMinimumForCounts(line, teamSize, counts);
      if (counts[line] < min) penalty += (min - counts[line]) * 500;
      if (counts[line] > fieldLineLimit(line, teamSize)) penalty += (counts[line] - fieldLineLimit(line, teamSize)) * 35;
    });
    return sum + penalty;
  }, 0);
  const statPenalty = Object.entries(weights || {}).reduce((sum, [field, weight]) => {
    const values = teams.map((team) => {
      if (field === 'general') return teamScore(team, assignmentOverrides);
      return team.reduce((total, player) => total + statValue(player, field), 0);
    });
    return sum + ((Math.max(...values) - Math.min(...values)) * Number(weight || 0));
  }, 0);
  const hardTierPenalty = supremeSpread > 1 ? 100000000 : 0;
  return {
    value: hardTierPenalty + (diff * 1000) + (slowSpread * 60) + (irregularSpread * 95) + linePenalty + positionBalancePenalty(teams, assignmentOverrides) + tierBalancePenalty(teams, assignmentOverrides) + statPenalty + historicalRepeatPenalty(teams, pairHistory),
    diff,
    slowSpread,
    irregularSpread,
    platinumSpread: supremeSpread,
    totals,
  };
}

function buildCandidateTeams(players, numTeams, teamSize, pairHistory, weights) {
  const teams = Array.from({ length: numTeams }, () => []);
  const fixedGoalkeeperPool = players.filter(isFixedGoalkeeper);
  if (fixedGoalkeeperPool.length > numTeams) return null;
  const fixedGoalkeepers = shuffle(fixedGoalkeeperPool);
  if (fixedGoalkeepers.length > numTeams) return null;
  fixedGoalkeepers.forEach((player, index) => teams[index].push(player));
  const fixedKeys = new Set(fixedGoalkeepers.map(playerKey));
  const goalkeepers = shuffle(players.filter((player) => canPlayGoalkeeper(player) && !fixedKeys.has(playerKey(player))))
    .sort((a, b) => {
      const priorityDiff = goalkeeperSortValue(a) - goalkeeperSortValue(b);
      if (priorityDiff) return priorityDiff;
      return adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ');
    })
    .slice(0, numTeams - fixedGoalkeepers.length);
  if (fixedGoalkeepers.length + goalkeepers.length < numTeams) return null;
  goalkeepers.forEach((player, index) => teams[fixedGoalkeepers.length + index].push(player));
  const goalkeeperKeys = new Set([...fixedGoalkeepers, ...goalkeepers].map(playerKey));
  const remainingPool = players.filter((player) => !goalkeeperKeys.has(playerKey(player)));
  const platinumPlayers = shuffle(remainingPool.filter(isPlatinumPlayer))
    .sort((a, b) => bestNaturalPlayerRating(b) - bestNaturalPlayerRating(a));
  const platinumKeys = new Set(platinumPlayers.map(playerKey));
  const remaining = shuffle(remainingPool.filter((player) => !platinumKeys.has(playerKey(player))))
    .sort((a, b) => bestNaturalPlayerRating(b) - bestNaturalPlayerRating(a));

  platinumPlayers.forEach((player) => {
    let bestIndex = -1;
    let bestScore = Infinity;
    const platinumCounts = teams.map((team) => team.filter(isPlatinumPlayer).length);
    const minPlatinumCount = Math.min(...platinumCounts);
    teams.forEach((team, index) => {
      if (team.length >= teamSize || platinumCounts[index] > minPlatinumCount) return;
      const candidate = teams.map((item, candidateIndex) => (candidateIndex === index ? [...item, player] : item.slice()));
      const currentScore = scoreTeams(candidate, pairHistory, {}, weights).value;
      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) teams[bestIndex].push(player);
  });

  remaining.forEach((player) => {
    let bestIndex = -1;
    let bestScore = Infinity;
    teams.forEach((team, index) => {
      if (team.length >= teamSize) return;
      const candidate = teams.map((item, candidateIndex) => (candidateIndex === index ? [...item, player] : item.slice()));
      const currentScore = scoreTeams(candidate, pairHistory, {}, weights).value;
      if (currentScore < bestScore) {
        bestScore = currentScore;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0) teams[bestIndex].push(player);
  });

  return teams.every((team) => team.length === teamSize) ? teams : null;
}

function improveBySwaps(teams, teamSize, pairHistory, weights) {
  let best = teams.map((team) => team.slice());
  let bestEval = scoreTeams(best, pairHistory, {}, weights);
  let changed = true;
  let guard = 0;
  while (changed && guard < 3) {
    changed = false;
    guard += 1;
    for (let a = 0; a < best.length; a += 1) {
      for (let b = a + 1; b < best.length; b += 1) {
        for (let i = 0; i < best[a].length; i += 1) {
          for (let j = 0; j < best[b].length; j += 1) {
            const candidate = best.map((team) => team.slice());
            [candidate[a][i], candidate[b][j]] = [candidate[b][j], candidate[a][i]];
            if (!candidate.every((team) => team.length === teamSize)) continue;
            const evaluation = scoreTeams(candidate, pairHistory, {}, weights);
            if (evaluation.value + 0.001 < bestEval.value) {
              best = candidate;
              bestEval = evaluation;
              changed = true;
            }
          }
        }
      }
    }
  }
  return { teams: best, evaluation: bestEval };
}

function teamsFitFormationRules(teams, teamSize) {
  return platinumSpread(teams) <= 1 && teams.every((team) => {
    if (team.length !== teamSize) return false;
    const counts = teamLineCounts(team, buildTeamAssignment(team));
    return fieldLineCountsFitLimits(counts, teamSize);
  });
}

function generateExactTwoTeamCandidate(players, teamSize, maxDiff, pairHistory, weights, avoidSignatures = new Set()) {
  if (players.length !== teamSize * 2 || players.length > 20 || teamSize < 2) return null;
  let best = null;
  let bestEval = null;
  const selected = [0];
  const totalPlatinum = players.filter(isPlatinumPlayer).length;
  const minPlatinumPerTeam = Math.floor(totalPlatinum / 2);
  const maxPlatinumPerTeam = Math.ceil(totalPlatinum / 2);

  const visit = (start) => {
    const selectedPlatinum = selected.filter((index) => isPlatinumPlayer(players[index])).length;
    if (selectedPlatinum > maxPlatinumPerTeam) return;
    const remainingPlatinum = players.slice(start).filter(isPlatinumPlayer).length;
    if (selectedPlatinum + remainingPlatinum < minPlatinumPerTeam) return;
    if (selected.length === teamSize) {
      if (selectedPlatinum < minPlatinumPerTeam || selectedPlatinum > maxPlatinumPerTeam) return;
      const picked = new Set(selected);
      const left = [];
      const right = [];
      players.forEach((player, index) => {
        (picked.has(index) ? left : right).push(player);
      });
      const teams = [left, right];
      if (!teamsFitFormationRules(teams, teamSize)) return;
      const evaluationBase = scoreTeams(teams, pairHistory, {}, weights);
      const signature = drawSignature(teams);
      const signaturePenalty = avoidSignatures.has(signature) ? 100000000 : 0;
      const evaluation = { ...evaluationBase, value: evaluationBase.value + signaturePenalty, signature };
      if (!bestEval || evaluation.value < bestEval.value) {
        best = teams;
        bestEval = evaluation;
      }
      return;
    }

    const remaining = teamSize - selected.length;
    for (let index = start; index <= players.length - remaining; index += 1) {
      selected.push(index);
      visit(index + 1);
      selected.pop();
      if (bestEval && bestEval.diff <= maxDiff && bestEval.slowSpread <= 1 && bestEval.irregularSpread <= 1 && bestEval.platinumSpread <= 1 && !avoidSignatures.has(bestEval.signature)) {
        return;
      }
    }
  };

  visit(1);
  return best ? { teams: best, evaluation: bestEval, usedMaxDiff: Math.max(maxDiff, bestEval.diff) } : null;
}

function generateBalancedTeams(players, numTeams, maxDiff, pairHistory, weights, avoidSignatures = new Set()) {
  const teamSize = players.length / numTeams;
  if (numTeams === 2 && players.length <= 20) {
    const exact = generateExactTwoTeamCandidate(players, teamSize, maxDiff, pairHistory, weights, avoidSignatures);
    if (exact) return exact;
  }
  const attempts = Math.min(180, Math.max(60, players.length * 4));
  let best = null;
  let bestEval = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = buildCandidateTeams(shuffle(players), numTeams, teamSize, pairHistory, weights);
    if (!candidate) continue;
    const improved = improveBySwaps(candidate, teamSize, pairHistory, weights);
    if (platinumSpread(improved.teams) > 1) continue;
    const signature = drawSignature(improved.teams);
    const signaturePenalty = avoidSignatures.has(signature) ? 100000000 : 0;
    const evaluation = { ...improved.evaluation, value: improved.evaluation.value + signaturePenalty, signature };
    if (!bestEval || evaluation.value < bestEval.value) {
      best = improved.teams;
      bestEval = evaluation;
      if (!signaturePenalty && bestEval.diff <= maxDiff && bestEval.slowSpread <= 1 && bestEval.irregularSpread <= 1 && bestEval.platinumSpread <= 1) break;
    }
  }
  return best ? { teams: best, evaluation: bestEval, usedMaxDiff: Math.max(maxDiff, bestEval.diff) } : null;
}

function assignmentSignatureForTeam(team, assignments = {}) {
  return team
    .map((player) => `${playerKey(player)}:${String(assignments[playerKey(player)] || getPrimaryPlayerPosition(player)).toUpperCase()}`)
    .sort()
    .join('|');
}

function assignmentDiffCount(team, left = {}, right = {}) {
  return team.reduce((total, player) => {
    const key = playerKey(player);
    return total + (String(left[key] || getPrimaryPlayerPosition(player)).toUpperCase() === String(right[key] || getPrimaryPlayerPosition(player)).toUpperCase() ? 0 : 1);
  }, 0);
}

function applyPositionCountsToTeam(team, counts, baseAssignments = {}, lockedPlayerPositions = {}) {
  const desiredCounts = {
    ARQ: Number(counts?.ARQ || 0),
    DEF: Number(counts?.DEF || 0),
    LAT: Number(counts?.LAT || 0),
    MED: Number(counts?.MED || 0),
    DEL: Number(counts?.DEL || 0),
  };
  const next = {};
  const available = team.slice();
  const pickForLine = (line, count) => {
    const picked = [];
    while (picked.length < count && available.length) {
      let bestIndex = -1;
      let bestScore = -Infinity;
      available.forEach((player, index) => {
        const key = playerKey(player);
        const lockedLine = lockedPlayerPositions[key];
        if (lockedLine && lockedLine !== line) return;
        const current = String(baseAssignments[key] || getPrimaryPlayerPosition(player)).toUpperCase();
        const stability = current === line ? 0.35 : 0;
        const score = adjustedPositionRating(player, line) + stability;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = index;
        }
      });
      if (bestIndex < 0) break;
      const [player] = available.splice(bestIndex, 1);
      next[playerKey(player)] = line;
      picked.push(player);
    }
    return picked.length === count;
  };
  const fixedGoalkeepers = team.filter((player) => isFixedGoalkeeper(player) || lockedPlayerPositions[playerKey(player)] === 'ARQ');
  fixedGoalkeepers.forEach((player) => {
    const index = available.findIndex((candidate) => playerKey(candidate) === playerKey(player));
    if (index >= 0) available.splice(index, 1);
    next[playerKey(player)] = 'ARQ';
  });
  if (fixedGoalkeepers.length > desiredCounts.ARQ) return null;
  if (!pickForLine('ARQ', desiredCounts.ARQ - fixedGoalkeepers.length)) return null;
  if (!pickForLine('DEF', desiredCounts.DEF)) return null;
  if (!pickForLine('LAT', desiredCounts.LAT)) return null;
  if (!pickForLine('MED', desiredCounts.MED)) return null;
  if (!pickForLine('DEL', desiredCounts.DEL)) return null;
  if (available.length) return null;
  const normalized = normalizeCompactDefenseAssignments(team, { ...baseAssignments, ...next });
  const compact = Object.fromEntries(team.map((player) => [playerKey(player), normalized[playerKey(player)] || getPrimaryPlayerPosition(player)]));
  return fieldLineCountsFitLimits(teamLineCounts(team, compact), team.length) ? compact : null;
}

function generateTeamFormationVariants(team, baseAssignments = {}, lockedPlayerPositions = {}, targetCount = 3) {
  if (!team?.length) return [];
  const base = buildTeamAssignment(team, baseAssignments);
  const baseSignature = assignmentSignatureForTeam(team, base);
  const seen = new Set([baseSignature]);
  const variants = [];
  const formationOptions = getFormationOptions(team.length);
  const countCandidates = formationOptions.flatMap((option) => {
    const parsed = parseFormationValue(option.value);
    if (!parsed) return [];
    if (parsed.LAT !== null) {
      return [{
        ARQ: 1,
        DEF: parsed.DEF,
        LAT: parsed.LAT,
        MED: parsed.MED,
        DEL: parsed.DEL,
        label: `${parsed.DEF + parsed.LAT}-${parsed.MED}-${parsed.DEL}`,
      }];
    }
    const defenseSplits = parsed.DEF >= 3
      ? [{ DEF: Math.max(1, parsed.DEF - 2), LAT: 2 }, { DEF: parsed.DEF, LAT: 0 }]
      : [{ DEF: parsed.DEF, LAT: 0 }];
    return defenseSplits.map((split) => ({
      ARQ: 1,
      DEF: split.DEF,
      LAT: split.LAT,
      MED: parsed.MED,
      DEL: parsed.DEL,
      label: `${split.DEF + split.LAT}-${parsed.MED}-${parsed.DEL}`,
    }));
  });
  countCandidates.forEach((counts) => {
    if (variants.length >= targetCount) return;
    const assignmentMap = applyPositionCountsToTeam(team, counts, base, lockedPlayerPositions);
    if (!assignmentMap) return;
    const signature = assignmentSignatureForTeam(team, assignmentMap);
    if (seen.has(signature)) return;
    seen.add(signature);
    const lineCounts = teamLineCounts(team, assignmentMap);
    variants.push({
      assignments: assignmentMap,
      signature,
      lineText: formatLineCounts(lineCounts),
      diffCount: assignmentDiffCount(team, base, assignmentMap),
      total: teamTotalsSummary(team, assignmentMap).adjusted,
    });
  });
  return variants;
}

function chooseBestFormationVariant(variants = []) {
  if (!variants.length) return null;
  const bestTotal = Math.max(...variants.map((variant) => Number(variant.total || 0)));
  const tied = variants.filter((variant) => Math.abs(Number(variant.total || 0) - bestTotal) < 0.0001);
  return tied[Math.floor(Math.random() * tied.length)] || variants[0];
}

function getFormationOptions(teamSize) {
  const fieldPlayers = Math.max(0, teamSize - 1);
  const maxPerLine = maxFieldPlayersPerLine(teamSize);
  const maxDefLat = maxDefLatPlayersPerPosition(teamSize);
  const minDef = logicalLineMinimum('DEF', teamSize);
  const minLat = logicalLineMinimum('LAT', teamSize);
  const minMed = fieldLineMinimum('MED', teamSize);
  const minDel = fieldLineMinimum('DEL', teamSize);
  const candidates = [];
  for (let def = 0; def <= Math.min(maxDefLat, fieldPlayers); def += 1) {
    for (let lat = 0; lat <= Math.min(maxDefLat, fieldPlayers - def); lat += 1) {
      if (def + lat > maxPerLine) continue;
      for (let med = 0; med <= Math.min(maxPerLine, fieldPlayers - def - lat); med += 1) {
        const del = fieldPlayers - def - lat - med;
        if (del < 0 || del > maxPerLine) continue;
        if (def < minDef || lat < minLat || med < minMed || del < minDel) continue;
        if (def + lat < fieldLineMinimum('DEF', teamSize)) continue;
        const values = [def + lat, med, del];
        const balance = Math.max(...values) - Math.min(...values);
        candidates.push({ DEF: def, LAT: lat, MED: med, DEL: del, value: `${def}-${lat}-${med}-${del}`, balance });
      }
    }
  }

  const preferred = [];
  const addBest = (sorter) => {
    const option = candidates.slice().sort(sorter).find((item) => !preferred.some((selected) => selected.value === item.value));
    if (option) preferred.push(option);
  };

  addBest((a, b) => a.balance - b.balance || b.MED - a.MED || (b.DEF + b.LAT) - (a.DEF + a.LAT) || b.LAT - a.LAT);
  addBest((a, b) => (b.DEF + b.LAT) - (a.DEF + a.LAT) || a.balance - b.balance);
  addBest((a, b) => b.MED - a.MED || a.balance - b.balance);
  addBest((a, b) => b.DEL - a.DEL || a.balance - b.balance);

  return preferred.slice(0, 4);
}

function formationValueFromCounts(counts = {}) {
  return `${Number(counts.DEF || 0)}-${Number(counts.LAT || 0)}-${Number(counts.MED || 0)}-${Number(counts.DEL || 0)}`;
}

function teamFormationSelectValue(team, currentAssignments, selectedValue, inferCurrent = false) {
  if (selectedValue) return selectedValue;
  if (!inferCurrent) return 'auto';
  const value = formationValueFromCounts(teamLineCounts(team, currentAssignments));
  return getFormationOptions(team.length).some((option) => option.value === value) ? value : 'custom';
}

function parseFormationValue(value) {
  const parts = String(value || '').split('-').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return null;
  if (parts.length === 3) return { DEF: parts[0], LAT: null, MED: parts[1], DEL: parts[2] };
  if (parts.length === 4) return { DEF: parts[0], LAT: parts[1], MED: parts[2], DEL: parts[3] };
  return null;
}

function splitDefenseFormationCount(team, defenseCount) {
  const safeDefenseCount = Math.max(0, Number(defenseCount || 0));
  if (safeDefenseCount <= 2) return { DEF: safeDefenseCount, LAT: 0 };
  const minDef = logicalLineMinimum('DEF', team.length);
  const minLat = logicalLineMinimum('LAT', team.length);
  const maxDefLat = maxDefLatPlayersPerPosition(team.length);
  let lat = Math.max(minLat, Math.min(maxDefLat, Math.floor(safeDefenseCount / 2)));
  let def = safeDefenseCount - lat;
  if (def < minDef) {
    def = minDef;
    lat = safeDefenseCount - def;
  }
  if (lat < minLat) {
    lat = minLat;
    def = safeDefenseCount - lat;
  }
  if (def > maxDefLat) {
    def = maxDefLat;
    lat = safeDefenseCount - def;
  }
  return { DEF: Math.max(0, def), LAT: Math.max(0, lat) };
}

function applyFormationToTeam(team, value) {
  const parsedCounts = parseFormationValue(value);
  if (!parsedCounts) return {};
  const assignments = {};
  const goalkeeper = team.find(isFixedGoalkeeper) || team.slice().sort((a, b) => adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ'))[0];
  if (goalkeeper) assignments[playerKey(goalkeeper)] = 'ARQ';
  const remaining = team.filter((player) => playerKey(player) !== playerKey(goalkeeper));
  const defenseCounts = parsedCounts.LAT === null
    ? splitDefenseFormationCount(team, parsedCounts.DEF)
    : { DEF: parsedCounts.DEF, LAT: parsedCounts.LAT };
  const counts = { ...parsedCounts, ...defenseCounts };
  FIELD_LINES.forEach((line) => {
    for (let index = 0; index < counts[line]; index += 1) {
      const candidate = remaining
        .filter((player) => !assignments[playerKey(player)])
        .sort((a, b) => adjustedPositionRating(b, line) - adjustedPositionRating(a, line))[0];
      if (candidate) assignments[playerKey(candidate)] = line;
    }
  });
  remaining.forEach((player) => {
    if (!assignments[playerKey(player)]) assignments[playerKey(player)] = bestNaturalPlayerPosition(player);
  });
  return assignments;
}

function navigate(url) {
  if (!url) return;
  if (window.goodfellasPartialNavigate) {
    window.goodfellasPartialNavigate(url);
    return;
  }
  window.location.href = url;
}

function iconPath(name) {
  const paths = {
    arrowLeft: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
    calendar: <><path d="M8 2v4" /><path d="M16 2v4" /><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18" /></>,
    dice: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 8h.01" /><path d="M16 8h.01" /><path d="M12 12h.01" /><path d="M8 16h.01" /><path d="M16 16h.01" /></>,
    plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
    pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 16h10l1-16" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8" /><path d="M7 3v5h8" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    clipboard: <><rect x="8" y="3" width="8" height="4" rx="1" /><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" /></>,
    shirt: <><path d="M8 4 5 6 3 11l4 2 1-2v9h8v-9l1 2 4-2-2-5-3-2a4 4 0 0 1-8 0Z" /></>,
    undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-1" /></>,
    place: <><path d="M12 3v11" /><path d="m7 9 5 5 5-5" /><path d="M4 21h16" /></>,
    swap: <><path d="M16 3h5v5" /><path d="M21 3 14 10" /><path d="M8 21H3v-5" /><path d="m3 21 7-7" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  };
  return paths[name] || paths.dice;
}

function Icon({ name, className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {iconPath(name)}
    </svg>
  );
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

function FullPlayerCard({ player, assignedPosition }) {
  const adjusted = adjustedPositionRating(player, assignedPosition);
  const tier = playerCardTier(adjusted);
  const palette = cardPalettes[tier] || cardPalettes.bronze;
  const positions = getOrderedPlayerPositions(player);
  const isLongName = player.nombre.length > 12;
  const isLateral = String(assignedPosition || '').toUpperCase() === 'LAT';
  const fullCardText = palette.text;
  const fullCardStyle = {
    '--sorteo-card-text': palette.color,
    background: `url("${cardBackgrounds[tier] || cardBackgrounds.bronze}") center / contain no-repeat`,
    fontFamily: '"Barlow Condensed", sans-serif',
  };
  return (
    <article
      className="relative mx-auto block aspect-[409/710] w-[168px] overflow-hidden border-0 bg-transparent p-0 drop-shadow-[0_7px_12px_rgba(2,14,9,0.22)]"
      style={fullCardStyle}
      aria-label={`Ficha de ${player.nombre}`}
      data-sorteo-full-card="1"
      data-sorteo-player-tier={tier}
      data-lane-role={isLateral ? 'lateral' : undefined}
    >
      <span className="absolute left-[9%] right-[8%] top-[8.8%] z-20 h-[49%] bg-gradient-to-b from-transparent via-[#07130f]/6 to-[#07130f]/34" aria-hidden="true" />
      {isLateral ? (
        <span className="sorteo-lane-indicator sorteo-lane-indicator-full" aria-hidden="true"><span></span><span></span><span></span></span>
      ) : null}
      <span className={`absolute left-[14.2%] top-[13.8%] z-30 grid h-[26%] w-[23.2%] content-start justify-items-center px-0.5 pt-0.5 ${fullCardText}`} data-sorteo-full-card-text="1">
        <strong className="block text-[2.03rem] font-black leading-[.8]">{playerCardRating(adjusted)}</strong>
        <span className="mt-[5px] grid justify-items-center gap-[1px] text-center leading-none">
          {positions.slice(0, 2).map((position, index) => (
            <span key={position} className={`block font-black uppercase leading-none ${index === 0 ? 'text-[.86rem]' : 'text-[.65rem] opacity-85'}`}>{position}</span>
          ))}
          <span className="mt-[3px] block aspect-square w-[15px]"><Arrow form={playerRegularityForm(player)} /></span>
        </span>
      </span>
      <span
        className="absolute left-[36.4%] right-[13.3%] top-[12.9%] z-10 flex h-[36.8%] items-start justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_14%,rgba(255,255,255,.10),transparent_50%)]"
        style={{ WebkitMaskImage: 'linear-gradient(180deg,#000 0 74%,transparent 100%)', maskImage: 'linear-gradient(180deg,#000 0 74%,transparent 100%)' }}
        data-player-photo-frame={player.has_custom_photo ? '1' : undefined}
      >
        <img className={`h-full w-full ${player.has_custom_photo ? 'object-cover object-top' : 'object-contain object-top opacity-56'}`} src={player.photo_path} alt="" style={playerPhotoPositionStyle(player)} data-player-photo-oval={player.has_custom_photo ? '1' : undefined} />
      </span>
      <strong className={`absolute left-[12.1%] right-[10.9%] top-[53.3%] z-30 grid h-[7.8%] place-items-center overflow-hidden text-ellipsis whitespace-nowrap px-1 text-center font-black uppercase leading-none ${isLongName ? 'text-[.95rem]' : 'text-[1.28rem]'} ${fullCardText}`} data-sorteo-full-card-text="1">
        {player.nombre}
      </strong>
      <span className="absolute left-[20.3%] right-[20.3%] top-[62.8%] z-30 block h-px bg-white/35" aria-hidden="true" />
      <span className="absolute left-[17.3%] right-[16.1%] top-[66.7%] z-30 grid h-[17%] grid-cols-2 grid-rows-3 gap-x-[7%] gap-y-0 overflow-visible px-[1.8%] py-[.9%]">
        <span className="absolute left-1/2 top-[8%] h-[84%] w-px -translate-x-1/2 bg-white/25" aria-hidden="true" />
        {playerCardStats(player, assignedPosition).map((stat) => (
          <span key={stat.label} className={`grid grid-cols-[1.18rem_minmax(0,1fr)] items-center gap-[3px] overflow-visible ${fullCardText}`} data-sorteo-full-card-text="1">
            <strong className="text-right text-[1.03rem] font-black leading-none">{stat.value}</strong>
            <span className="text-[.85rem] font-black uppercase leading-none">{stat.label}</span>
          </span>
        ))}
      </span>
      {positionPenaltyPercent(player, assignedPosition) > 0 ? (
        <span className="absolute left-[15.5%] top-[44.8%] z-40 grid h-[5.8%] min-w-[18%] place-items-center text-[.42rem] font-black leading-none text-[#ffb4a8] [text-shadow:0_2px_0_rgba(0,0,0,.74),0_1px_5px_rgba(0,0,0,.38)]">
          -{positionPenaltyPercent(player, assignedPosition)}%
        </span>
      ) : null}
    </article>
  );
}

function CompactPlayerCard({ player, assignedPosition, laneRole = '', draggableProps = {}, onOpen }) {
  const { dragging = false, selected = false, locked = false, swapTarget = false, ...domDraggableProps } = draggableProps;
  const adjusted = adjustedPositionRating(player, assignedPosition);
  const tier = playerCardTier(adjusted);
  const palette = cardPalettes[tier] || cardPalettes.bronze;
  const widthClass = 'w-[58px] min-[380px]:w-[64px] sm:w-[70px] xl:w-[82px] 2xl:w-[88px]';
  const outOfPosition = !getOrderedPlayerPositions(player).includes(assignedPosition);
  const secondary = !outOfPosition && assignedPosition !== getPrimaryPlayerPosition(player);
  const nameLines = compactCardNameLines(player.nombre);
  const multiLineName = nameLines.length > 1;
  const longName = String(player.nombre || '').trim().length > 9 || String(player.nombre || '').includes(' ');
  const veryLongName = String(player.nombre || '').trim().length > 12 || String(player.nombre || '').trim().split(/\s+/).some((part) => part.length > 8);
  const nameFontSize = multiLineName
    ? (veryLongName ? 'clamp(6.1px, 0.62vw, 8.1px)' : 'clamp(6.5px, 0.66vw, 8.7px)')
    : longName ? 'clamp(7.4px, 0.8vw, 10.4px)' : 'clamp(8.8px, 0.98vw, 12.8px)';
  const cardTextStyle = {
    '--sorteo-card-text': palette.color,
  };
  const positionTextStyle = {
    '--sorteo-card-position': outOfPosition ? '#ffb4a8' : secondary ? '#ffe9a6' : palette.color,
  };
  const isLateral = String(assignedPosition || '').toUpperCase() === 'LAT' || laneRole === 'lateral';
  return (
    <button
      type="button"
      className={`relative block aspect-[1000/940] ${widthClass} shrink-0 overflow-hidden border-0 bg-transparent p-0 text-left drop-shadow-[0_4px_7px_rgba(2,14,9,0.24)] transition ${dragging ? 'scale-95 opacity-55' : 'hover:scale-[1.03]'} ${selected ? 'ring-2 ring-lime-200 ring-offset-2 ring-offset-emerald-900' : ''} ${locked ? 'ring-2 ring-amber-200 ring-offset-2 ring-offset-emerald-900' : ''} ${swapTarget ? 'z-20 scale-[1.06] ring-4 ring-lime-200 ring-offset-2 ring-offset-emerald-900' : ''}`}
      style={{
        ...cardTextStyle,
        backgroundImage: `url("${compactCardBackgrounds[tier] || compactCardBackgrounds.bronze}")`,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        fontFamily: '"Barlow Condensed", sans-serif',
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      aria-label={`Ver ficha de ${player.nombre}`}
      data-card-tier={tier}
      data-sorteo-player-tier={tier}
      data-lane-role={isLateral ? 'lateral' : undefined}
      {...domDraggableProps}
    >
      <span className="absolute left-[7.5%] right-[7%] top-[11.5%] z-20 h-[64%] bg-gradient-to-b from-transparent via-[#07130f]/8 to-[#07130f]/30" aria-hidden="true" />
      {isLateral ? (
        <span className="sorteo-lane-indicator" aria-hidden="true"><span></span><span></span><span></span></span>
      ) : null}
      {locked ? (
        <span className="absolute right-[8%] top-[8%] z-40 grid h-4 w-4 place-items-center rounded-full border border-[#07130f]/45 bg-amber-200 text-[9px] font-black text-[#07130f]" aria-hidden="true">L</span>
      ) : null}
      {swapTarget ? (
        <span className="absolute inset-0 z-50 grid place-items-center bg-[#07130f]/58 text-lime-100" aria-hidden="true">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-lime-100/80 bg-emerald-950/88 shadow-lg shadow-emerald-950/40 max-[760px]:h-6 max-[760px]:w-6">
            <Icon name="swap" className="h-4 w-4 max-[760px]:h-3.5 max-[760px]:w-3.5" />
          </span>
        </span>
      ) : null}
      <span className={`absolute left-[13.2%] top-[16.5%] z-30 grid h-[41%] w-[24%] content-start justify-items-center ${palette.text}`} style={cardTextStyle} data-sorteo-card-text="1">
        <strong className="text-[.7rem] font-black leading-[.78] min-[380px]:text-[.8rem] sm:text-[.95rem] xl:text-[1.12rem]" style={cardTextStyle} data-sorteo-card-text="1">{playerCardRating(adjusted)}</strong>
        <span className="mt-[2px] grid justify-items-center gap-px leading-none">
          <span className="text-[.34rem] font-black uppercase leading-none min-[380px]:text-[.39rem] sm:text-[.48rem] xl:text-[.56rem]" style={positionTextStyle} data-sorteo-card-position="1">{assignedPosition}</span>
          <span className="block aspect-square w-[8px] min-[380px]:w-[9px] sm:w-[10px] xl:w-[11px]"><Arrow form={playerRegularityForm(player)} /></span>
        </span>
      </span>
      <span
        className="absolute left-[38.5%] right-[8.8%] top-[13.3%] z-[25] flex h-[56.1%] items-center justify-center overflow-hidden rounded-[50%] border border-white/18 bg-[#07130f]/8 shadow-[inset_0_-5px_8px_rgba(7,19,15,0.16)]"
        data-player-photo-frame={player.has_custom_photo ? '1' : undefined}
      >
        <img className={`h-full w-full ${player.has_custom_photo ? 'object-cover object-center' : 'object-contain object-center opacity-50'}`} src={player.photo_path} alt="" style={playerPhotoPositionStyle(player)} data-player-photo-oval={player.has_custom_photo ? '1' : undefined} />
      </span>
      <strong
        className={`absolute left-[12.5%] right-[11.5%] top-[64.8%] z-30 flex h-[23%] items-center justify-center overflow-hidden px-0.5 text-center font-black uppercase ${palette.text}`}
        style={{ ...cardTextStyle, fontSize: nameFontSize }}
        data-sorteo-card-text="1"
      >
        <span
          className="flex max-h-full max-w-full flex-col items-center justify-center overflow-hidden break-words text-center"
          style={{
            lineHeight: multiLineName ? 0.88 : 0.92,
            overflowWrap: 'anywhere',
          }}
        >
          {nameLines.map((line, index) => (
            <span key={`${line}-${index}`} className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap">
              {line}{index < nameLines.length - 1 ? ' ' : ''}
            </span>
          ))}
        </span>
      </strong>
    </button>
  );
}

function PitchDropMarker({ line, style = null }) {
  const isLateral = String(line || '').toUpperCase() === 'LAT';
  return (
    <span
      className="pointer-events-none absolute top-1/2 z-40 grid aspect-[1000/940] w-[58px] -translate-y-1/2 place-items-center overflow-hidden rounded-md border-2 border-dashed border-lime-100/80 bg-[#07130f]/50 text-lime-100 min-[380px]:w-[64px] sm:w-[70px] xl:w-[82px] 2xl:w-[88px]"
      style={style || undefined}
      data-lane-role={isLateral ? 'lateral' : undefined}
      aria-hidden="true"
    >
      {isLateral ? (
        <span className="sorteo-lane-indicator" aria-hidden="true"><span></span><span></span><span></span></span>
      ) : null}
      <span className="grid h-8 w-8 place-items-center rounded-full border border-lime-100/75 bg-emerald-950/85 max-[760px]:h-6 max-[760px]:w-6">
        <Icon name="place" className="h-4 w-4 max-[760px]:h-3.5 max-[760px]:w-3.5" />
      </span>
    </span>
  );
}

function defenseInsertRole(currentLineCount, insertIndex) {
  const nextCount = Number(currentLineCount || 0) + 1;
  const boundedIndex = Math.max(0, Math.min(Number(insertIndex || 0), nextCount - 1));
  return nextCount >= 3 && (boundedIndex === 0 || boundedIndex === nextCount - 1) ? 'LAT' : 'DEF';
}

function injectFormationExportStyles(clonedDocument) {
  clonedDocument.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => node.remove());
  const style = clonedDocument.createElement('style');
  style.textContent = `
    * { box-sizing: border-box; }
    html, body { margin: 0; background: #f6faf8; color: #07130f; font-family: Arial, sans-serif; }
    #equipos-generados { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; width: 1400px; max-width: 1400px; padding: 14px; background: #f6faf8; }
    #equipos-generados > div:first-child { grid-column: 1 / -1; border: 1px solid #b9d4c8; border-radius: 10px; background: #ffffff; padding: 12px; text-align: center; font-size: 22px; font-weight: 900; }
    #equipos-generados article { display: grid !important; gap: 10px; border: 1px solid #b9d4c8; border-radius: 10px; background: #eef6f1; padding: 10px; color: #07130f; }
    .sorteo-team-head, #equipos-generados article > div:first-child { display: flex !important; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid #d2e3da; border-radius: 9px; background: #ffffff; padding: 9px 11px; color: #07130f; }
    #equipos-generados h3 { margin: 0; color: #07130f; font-size: 17px; font-weight: 900; }
    #equipos-generados select, .sorteo-team-stats, .formation-undo-button, .sorteo-line-with-tools > div:first-child button, .sorteo-line-with-tools > div:last-child { display: none !important; }
    .team-formation { display: grid !important; grid-template-rows: repeat(4, minmax(172px, 1fr)); gap: 10px; height: auto !important; min-height: 760px; overflow: visible !important; border: 1px solid #7fb89c; border-radius: 10px; background: linear-gradient(180deg, rgba(9,74,41,.96), rgba(13,70,42,.98)); padding: 14px; color: #f2fff7; }
    .formation-line { display: grid !important; grid-template-columns: 58px minmax(0, 1fr) !important; align-items: center; gap: 8px; min-height: 172px; border: 0 !important; background: transparent !important; opacity: 1 !important; color: #f4fff8; }
    .line-label { display: grid !important; justify-items: center; gap: 2px; color: #f4fff8; text-align: center; font-size: 10px; font-weight: 900; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
    .line-label span, .line-label small { display: block !important; color: #f4fff8 !important; background: transparent !important; border: 0 !important; padding: 0 !important; }
    .line-players { display: flex !important; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; min-height: 172px; overflow: visible !important; border: 0 !important; background: transparent !important; padding: 0 !important; }
    [data-sorteo-line-player-item="1"] { display: inline-block !important; flex: 0 0 auto; margin: 0 !important; transform: none !important; opacity: 1 !important; }
    [data-sorteo-drag-player] { position: relative !important; display: block !important; flex: 0 0 96px !important; width: 96px !important; min-width: 96px !important; max-width: 96px !important; aspect-ratio: 409 / 620; border: 0 !important; border-radius: 0 !important; background: #f8d99b !important; color: #07130f !important; padding: 8px 6px !important; overflow: hidden !important; box-shadow: 0 3px 8px rgba(2,14,9,.24); font-family: Arial, sans-serif !important; }
    [data-sorteo-drag-player] span, [data-sorteo-drag-player] strong { color: #07130f !important; text-shadow: none !important; }
    [data-sorteo-drag-player] img { display: block !important; object-fit: contain !important; max-width: 100% !important; max-height: 48px !important; margin: 4px auto !important; opacity: .9 !important; }
    [data-sorteo-drag-player] strong { display: block !important; overflow: hidden !important; text-align: center !important; text-overflow: ellipsis !important; text-transform: uppercase !important; white-space: nowrap !important; font-size: 9px !important; font-weight: 900 !important; line-height: 1.1 !important; }
    [data-sorteo-card-text="1"] { position: static !important; display: block !important; width: auto !important; height: auto !important; transform: none !important; }
    [data-sorteo-drag-player] [data-sorteo-card-text="1"]:first-child { text-align: center !important; font-size: 18px !important; font-weight: 950 !important; line-height: 1 !important; }
    [data-sorteo-drag-player] [data-sorteo-card-text="1"] span { display: block !important; text-align: center !important; font-size: 9px !important; font-weight: 900 !important; }
    .sorteo-lane-indicator, .formation-card-preview-overlay { display: none !important; }
  `;
  clonedDocument.head.appendChild(style);
  const clonedContainer = clonedDocument.getElementById('equipos-generados');
  if (clonedContainer) {
    clonedContainer.style.width = '1400px';
    clonedContainer.style.maxWidth = '1400px';
  }
}

function PlayerFormModal({ mode, player, onClose, onSave }) {
  const [name, setName] = useState(player?.nombre || '');
  const [positions, setPositions] = useState(getOrderedPlayerPositions(player || { posicion: 'MED' }));
  const [pace, setPace] = useState(player?.ritmo || 'rapido');
  const [rating, setRating] = useState(normalizeSix(player?.puntuacion, 3));
  const title = mode === 'edit' ? 'Editar jugador' : 'Agregar jugador';

  const togglePosition = (position) => {
    setPositions((current) => {
      if (current.includes(position)) return current.filter((item) => item !== position);
      return [...current, position].slice(0, 2);
    });
  };

  const save = () => {
    if (!name.trim() || !positions.length) return;
    onSave({
      ...(player || {}),
      id: player?.id || `local-${Date.now()}`,
      nombre: name.trim(),
      posicion: positions.join('/'),
      ritmo: pace,
      ritmo_stat: pace === 'lento' ? 2 : 4,
      puntuacion: normalizeSix(rating, 3),
      selected: player?.selected !== false,
    });
  };

  return (
    <>
      <button className="fixed inset-0 z-40 bg-black/55" type="button" aria-label="Cerrar" onClick={onClose} />
      <section className="fixed inset-x-3 top-8 z-50 mx-auto grid max-w-md gap-4 rounded-lg border border-[#adc8bb] bg-white p-4 shadow-[0_18px_42px_rgba(7,19,15,.24)]" role="dialog" aria-modal="true" aria-label={title}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-[#d7e6df] pb-3">
          <h2 className="m-0 text-lg font-black text-[#07130f]">{title}</h2>
          <button className={iconButtonClass} type="button" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </header>
        <label className="grid gap-1 text-xs font-extrabold text-slate-600">
          Nombre
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <fieldset className="grid gap-2">
          <legend className="text-xs font-extrabold text-slate-600">Posiciones</legend>
          <div className="grid grid-cols-2 gap-2">
            {FORMATION_LINES.map((position) => (
              <label key={position} className="flex min-h-10 items-center gap-2 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] px-3 text-sm font-extrabold text-[#07130f]">
                <input type="checkbox" checked={positions.includes(position)} onChange={() => togglePosition(position)} />
                {position}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-extrabold text-slate-600">
            Ritmo
            <select className={inputClass} value={pace} onChange={(event) => setPace(event.target.value)}>
              <option value="rapido">Rapido</option>
              <option value="lento">Lento</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-extrabold text-slate-600">
            Puntuacion
            <input className={inputClass} type="number" min="1" max="6" step="0.1" value={rating} onChange={(event) => setRating(event.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button className={quietButtonClass} type="button" onClick={onClose}>Cancelar</button>
          <button className={primaryButtonClass} type="button" onClick={save}><Icon name="save" />Guardar</button>
        </div>
      </section>
    </>
  );
}

function Message({ id, tone, children }) {
  const visible = Boolean(children);
  const toneClass = tone === 'error'
    ? 'border-red-200 bg-red-50 text-red-800'
    : 'border-lime-200 bg-lime-50 text-[#07130f]';
  return (
    <div id={id} className={`${visible ? 'block' : 'hidden'} rounded-lg border px-4 py-3 text-sm font-extrabold ${toneClass}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function SorteoLegacyPageIsland({ root }) {
  const payload = useMemo(() => parsePayload(root), [root]);
  const lockedMatch = payload.matchId > 0;
  const isFormationEditor = payload.mode === 'formation_editor';
  const initialTeams = useMemo(() => (
    payload.initialTeams.map((team) => (Array.isArray(team) ? team.map(normalizePlayer) : []))
  ), [payload.initialTeams]);
  const initialAssignments = useMemo(() => {
    const next = {};
    initialTeams.forEach((team) => {
      team.forEach((player) => {
        const assigned = String(player.assigned_position || player.assignedPosition || '').toUpperCase();
        if (FORMATION_LINES.includes(assigned)) next[playerKey(player)] = assigned;
      });
    });
    return next;
  }, [initialTeams]);
  const [players, setPlayers] = useState(() => payload.players.map(normalizePlayer));
  const [manualGoalkeepers, setManualGoalkeepers] = useState(() => initialManualGoalkeepers(payload.players.map(normalizePlayer)));
  const [numTeams] = useState(payload.numTeams);
  const [maxDiff, setMaxDiff] = useState(0.7);
  const [sortKey, setSortKey] = useState('nombre');
  const [sortDirection, setSortDirection] = useState(1);
  const [teams, setTeams] = useState(() => (initialTeams.length ? initialTeams : null));
  const [assignments, setAssignments] = useState(() => initialAssignments);
  const [teamColors, setTeamColors] = useState(() => Array.from(
    { length: payload.numTeams },
    (_, index) => {
      const color = String(payload.teamColors[index] || '').toUpperCase();
      return teamColorOptions.some((option) => option.name === color)
        ? color
        : teamColorOptions[index % teamColorOptions.length].name;
    },
  ));
  const [teamFormations, setTeamFormations] = useState({});
  const [undoStacks, setUndoStacks] = useState({});
  const [error, setError] = useState(payload.loadError);
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [exporting, setExporting] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dragPoint, setDragPoint] = useState(null);
  const [dragHoverTarget, setDragHoverTarget] = useState(null);
  const [persistedRedrawCount, setPersistedRedrawCount] = useState(payload.redrawCount);
  const [redrawsUsedThisSession, setRedrawsUsedThisSession] = useState(0);
  const [hasSavedDraw, setHasSavedDraw] = useState(payload.hasSavedDraw);
  const [generatedOnce, setGeneratedOnce] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [lockedPlayerPositions, setLockedPlayerPositions] = useState({});
  const [drawVariants, setDrawVariants] = useState({});
  const [activeFormationVariants, setActiveFormationVariants] = useState({});
  const seenDrawSignatures = useRef(new Set(payload.savedDrawSignature ? [payload.savedDrawSignature] : []));
  const teamsContainerRef = useRef(null);

  const updateDragHoverTarget = useCallback((nextTarget) => {
    setDragHoverTarget((current) => {
      const currentKey = current
        ? `${current.teamIndex}|${current.line || ''}|${current.targetLine || ''}|${current.playerKey || ''}|${current.insertIndex ?? ''}|${Math.round(Number(current.insertX ?? -1))}`
        : '';
      const nextKey = nextTarget
        ? `${nextTarget.teamIndex}|${nextTarget.line || ''}|${nextTarget.targetLine || ''}|${nextTarget.playerKey || ''}|${nextTarget.insertIndex ?? ''}|${Math.round(Number(nextTarget.insertX ?? -1))}`
        : '';
      return currentKey === nextKey ? current : nextTarget;
    });
  }, []);

  const selectedPlayers = useMemo(() => (lockedMatch ? players.slice() : players.filter((player) => player.selected)), [lockedMatch, players]);
  const selectedGoalkeepers = useMemo(
    () => selectedPlayers.filter((player) => manualGoalkeepers[playerKey(player)] === true),
    [manualGoalkeepers, selectedPlayers],
  );
  const goalkeeperLimitReached = selectedGoalkeepers.length >= numTeams;

  const sortedPlayers = useMemo(() => {
    const sorted = players.slice();
    sorted.sort((a, b) => {
      if (sortKey === 'puntuacion') return (Number(a.puntuacion) - Number(b.puntuacion)) * sortDirection;
      if (sortKey === 'ritmo') {
        const left = isLowRhythmPlayer(a) ? 1 : 0;
        const right = isLowRhythmPlayer(b) ? 1 : 0;
        return (left - right) * sortDirection || a.nombre.localeCompare(b.nombre);
      }
      return a.nombre.localeCompare(b.nombre, 'es') * sortDirection;
    });
    return sorted;
  }, [players, sortDirection, sortKey]);
  const goalkeeperOptions = useMemo(() => {
    const selectedKeys = new Set(selectedPlayers.map(playerKey));
    return sortedPlayers.filter((player) => selectedKeys.has(playerKey(player)));
  }, [selectedPlayers, sortedPlayers]);

  const nextGenerationIsRedraw = lockedMatch && (hasSavedDraw || generatedOnce || Boolean(teams));
  const redrawsRemaining = Math.max(0, payload.redrawLimit - persistedRedrawCount - redrawsUsedThisSession);
  const generateButtonLabel = nextGenerationIsRedraw ? `Rehacer sorteo (${redrawsRemaining} restantes)` : 'Generar equipos';
  const generateDisabled = generating || (nextGenerationIsRedraw && (!payload.allowRedraw || redrawsRemaining <= 0));
  const manualChangeCount = useMemo(() => {
    const assignmentCount = isFormationEditor
      ? Object.entries(assignments || {}).filter(([key, value]) => initialAssignments[key] !== value).length
      : Object.keys(assignments || {}).length;
    const formationCount = Object.values(teamFormations || {}).filter((value) => value && value !== 'auto').length;
    return assignmentCount + formationCount;
  }, [assignments, initialAssignments, isFormationEditor, teamFormations]);
  const lockedPositionCount = useMemo(() => Object.keys(lockedPlayerPositions || {}).length, [lockedPlayerPositions]);

  const teamColorTaken = useCallback((colorName, ownIndex) => teamColors.some((item, index) => index !== ownIndex && item === colorName), [teamColors]);

  const getTeamColor = useCallback((teamIndex) => {
    const colorName = teamColors[teamIndex] || teamColorOptions[teamIndex % teamColorOptions.length].name;
    return teamColorOptions.find((item) => item.name === colorName) || teamColorOptions[teamIndex % teamColorOptions.length];
  }, [teamColors]);

  const getTeamDisplayName = useCallback((teamIndex) => {
    const color = getTeamColor(teamIndex);
    return `Equipo ${color.label}`;
  }, [getTeamColor]);

  const toggleManualGoalkeeper = useCallback((player) => {
    const key = playerKey(player);
    setManualGoalkeepers((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const currentMatchupName = useMemo(() => Array.from({ length: numTeams }, (_, index) => getTeamDisplayName(index)).join(' vs '), [getTeamDisplayName, numTeams]);

  const pushUndo = useCallback((teamIndex) => {
    setUndoStacks((current) => {
      const key = String(teamIndex);
      const stack = current[key] || [];
      return {
        ...current,
        [key]: [...stack, { teams: teams ? teams.map((team) => team.slice()) : null, assignments: { ...assignments }, teamFormations: { ...teamFormations } }].slice(-8),
      };
    });
  }, [assignments, teamFormations, teams]);

  const undoTeam = (teamIndex) => {
    const key = String(teamIndex);
    const stack = undoStacks[key] || [];
    const snapshot = stack[stack.length - 1];
    if (!snapshot) return;
    setTeams(snapshot.teams);
    setAssignments(snapshot.assignments || {});
    setTeamFormations(snapshot.teamFormations || {});
    setUndoStacks((current) => ({ ...current, [key]: stack.slice(0, -1) }));
  };

  const applyDefaultFormationVariants = useCallback((sourceTeams, baseAssignments = {}, lockedOverrides = lockedPlayerPositions) => {
    if (!sourceTeams?.length) {
      setDrawVariants({});
      setActiveFormationVariants({});
      setAssignments(baseAssignments);
      return 0;
    }
    const variantsByTeam = Object.fromEntries(sourceTeams.map((team, teamIndex) => [
      String(teamIndex),
      generateTeamFormationVariants(team, baseAssignments, lockedOverrides, 3),
    ]));
    const defaultVariantsByTeam = Object.fromEntries(
      Object.entries(variantsByTeam)
        .map(([teamIndex, variants]) => [teamIndex, chooseBestFormationVariant(variants)])
        .filter(([, variant]) => Boolean(variant)),
    );
    setDrawVariants(variantsByTeam);
    setActiveFormationVariants(Object.fromEntries(
      Object.entries(defaultVariantsByTeam).map(([teamIndex, variant]) => [teamIndex, variant.signature]),
    ));
    setAssignments(() => {
      const next = { ...baseAssignments };
      Object.entries(defaultVariantsByTeam).forEach(([teamIndex, variant]) => {
        const team = sourceTeams[Number(teamIndex)] || [];
        team.forEach((player) => {
          const key = playerKey(player);
          if (!lockedOverrides[key]) delete next[key];
        });
        Object.entries(variant.assignments).forEach(([key, value]) => {
          next[key] = lockedOverrides[key] || value;
        });
      });
      return next;
    });
    return Object.values(variantsByTeam).reduce((sum, list) => sum + list.length, 0);
  }, [lockedPlayerPositions]);

  const generateTeams = useCallback(async () => {
    setError('');
    setSuccess('');
    const rawSelected = lockedMatch ? players.slice() : players.filter((player) => player.selected);
    const selectedGoalkeeperKeys = new Set(rawSelected.filter((player) => manualGoalkeepers[playerKey(player)] === true).map(playerKey));
    if (selectedGoalkeeperKeys.size > numTeams) {
      setError(`Elegiste ${selectedGoalkeeperKeys.size} arqueros para ${numTeams} equipos. Deja como maximo 1 arquero por equipo.`);
      return null;
    }
    const selectedWithGoalkeepers = rawSelected.map((player) => (
      selectedGoalkeeperKeys.has(playerKey(player)) ? { ...player, manualGoalkeeper: true } : player
    ));
    const prepared = prepareEmergencyGoalkeepers(selectedWithGoalkeepers, numTeams);
    const candidates = prepared.players;
    if (!candidates.length) {
      setError('Selecciona al menos un jugador.');
      return null;
    }
    if (candidates.length % numTeams !== 0) {
      setError(`Jugadores seleccionados (${candidates.length}) no es divisible por ${numTeams}.`);
      return null;
    }
    const teamSize = candidates.length / numTeams;
    if (teamSize < 1) {
      setError('No hay jugadores suficientes para sortear.');
      return null;
    }
    if (teamSize < 5) {
      setError(`Con ${teamSize} jugadores por equipo no se puede respetar la formacion minima: 1 arquero, laterales segun tamano de equipo, y cobertura en DEF, MED y DEL.`);
      return null;
    }
    const pureGoalkeepers = candidates.filter((player) => getOrderedPlayerPositions(player).length === 1 && getPrimaryPlayerPosition(player) === 'ARQ');
    if (pureGoalkeepers.length > numTeams) {
      setError(`Hay ${pureGoalkeepers.length} arqueros puros para ${numTeams} equipos. Debe haber como maximo 1 por equipo.`);
      return null;
    }
    if (nextGenerationIsRedraw && !payload.allowRedraw) {
      setError('Esta fecha no permite rehacer el sorteo.');
      return null;
    }
    if (nextGenerationIsRedraw && redrawsRemaining <= 0) {
      setError(`Ya se usaron los ${payload.redrawLimit} re-sorteos permitidos para esta fecha.`);
      return null;
    }

    const advanceGenerationStage = async (stage) => {
      setGenerationStage(stage);
      await new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 20)));
    };

    setGenerating(true);
    await advanceGenerationStage('Preparando arqueros');
    try {
      await advanceGenerationStage('Repartiendo platinum');
      const avoidSignatures = new Set(seenDrawSignatures.current);
      if (teams) avoidSignatures.add(drawSignature(teams));
      let result = null;
      for (let diff = Math.max(0.5, maxDiff); diff <= FLEXIBLE_MAX_DIFF; diff += 0.5) {
        await advanceGenerationStage(diff <= Math.max(0.5, maxDiff) ? 'Balanceando posiciones' : `Ampliando diff a ${diff.toFixed(1)}`);
        result = generateBalancedTeams(candidates, numTeams, Math.min(diff, STRICT_MAX_DIFF), payload.pairHistory, payload.drawBalanceWeights, nextGenerationIsRedraw ? avoidSignatures : new Set());
        await advanceGenerationStage('Optimizando puntaje');
        if (result && (!nextGenerationIsRedraw || !avoidSignatures.has(drawSignature(result.teams)))) break;
      }
      if (!result) {
        setError('No se encontro una combinacion valida con los jugadores seleccionados.');
        return null;
      }
      await advanceGenerationStage('Validando sorteo');
      const signature = drawSignature(result.teams);
      if (signature) seenDrawSignatures.current.add(signature);
      setTeams(result.teams);
      setLockedPlayerPositions({});
      applyDefaultFormationVariants(result.teams, {}, {});
      setTeamFormations({});
      setUndoStacks({});
      setAnalysisVisible(false);
      setMaxDiff(Number(result.usedMaxDiff || maxDiff).toFixed(1));
      if (nextGenerationIsRedraw) setRedrawsUsedThisSession((value) => value + 1);
      setGeneratedOnce(true);
      const emergencyMessage = prepared.emergencyGoalkeepers.length
        ? ` Arqueros de emergencia: ${prepared.emergencyGoalkeepers.map((player) => player.nombre).join(', ')}.`
        : '';
      const balanceMessage = result.evaluation.diff <= maxDiff
        ? `Equipos generados con diferencia maxima ${Number(result.usedMaxDiff || maxDiff).toFixed(1)}.`
        : `Se genero el mejor equilibrio encontrado. Diferencia de puntos: ${result.evaluation.diff.toFixed(1)}.`;
      setSuccess(`${balanceMessage}${emergencyMessage}`);
      return result.teams;
    } finally {
      setGenerating(false);
      setGenerationStage('');
    }
  }, [applyDefaultFormationVariants, lockedMatch, manualGoalkeepers, maxDiff, nextGenerationIsRedraw, numTeams, payload.allowRedraw, payload.drawBalanceWeights, payload.pairHistory, payload.redrawLimit, players, redrawsRemaining, teams]);

  useEffect(() => {
    const previous = window.generarEquipos;
    window.generarEquipos = () => generateTeams();
    return () => {
      if (window.generarEquipos === generateTeams) {
        window.generarEquipos = previous;
      }
    };
  }, [generateTeams]);

  const toggleSort = (nextKey) => {
    setSortDirection((current) => (sortKey === nextKey ? current * -1 : 1));
    setSortKey(nextKey);
  };

  const updatePlayer = (updated) => {
    setPlayers((current) => current.map((player) => (playerKey(player) === playerKey(updated) ? normalizePlayer(updated, 0) : player)));
    setFormModal(null);
  };

  const addPlayer = (player) => {
    if (lockedMatch) return;
    setPlayers((current) => [...current, normalizePlayer(player, current.length)]);
    setFormModal(null);
  };

  const removePlayer = (player) => {
    if (lockedMatch) return;
    setPlayers((current) => current.filter((item) => playerKey(item) !== playerKey(player)));
    setManualGoalkeepers((current) => {
      const next = { ...current };
      delete next[playerKey(player)];
      return next;
    });
  };

  const setAllSelected = (checked) => {
    if (lockedMatch) return;
    setPlayers((current) => current.map((player) => ({ ...player, selected: checked })));
  };

  const exportPlayersCsv = () => {
    if (lockedMatch) return;
    const csv = [
      ['Nombre', 'Posicion', 'Ritmo', 'Puntuacion'].join(','),
      ...players.map((player) => [
        `"${player.nombre.replace(/"/g, '""')}"`,
        player.posicion,
        player.ritmo,
        player.puntuacion.toFixed(1),
      ].join(',')),
    ].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = 'jugadores_goodfellas.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importPlayersCsv = (event) => {
    if (lockedMatch) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = String(reader.result || '').split(/\r?\n/).slice(1);
      const imported = rows.map((row, index) => {
        const parts = row.match(/("([^"]|"")*"|[^,]+)/g) || [];
        const [nombre, posicion, ritmo, puntuacion] = parts.map((part) => part.trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"'));
        return normalizePlayer({ nombre, posicion, ritmo, puntuacion, selected: true }, index);
      }).filter((player) => player.nombre && player.posicion);
      setPlayers(imported);
      setManualGoalkeepers(initialManualGoalkeepers(imported));
      setSuccess(`${imported.length} jugadores importados correctamente.`);
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const teamAssignments = useCallback((teamIndex) => {
    const team = teams?.[teamIndex] || [];
    return buildTeamAssignment(team, assignments);
  }, [assignments, teams]);

  const drawAnalysis = useMemo(() => {
    if (!teams) return null;
    const evaluation = scoreTeams(teams, payload.pairHistory, assignments, payload.drawBalanceWeights);
    const summaries = teams.map((team, teamIndex) => {
      const currentAssignments = buildTeamAssignment(team, assignments);
      const summary = teamTotalsSummary(team, assignments);
      const counts = teamLineCounts(team, currentAssignments);
      const tierCounts = tierCountsForTeam(team, assignments);
      const stats = sortedAnalysisStats(summary);
      const secondaryPlayers = [];
      const adaptedPlayers = [];
      team.forEach((player) => {
        const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
        const naturalPositions = getOrderedPlayerPositions(player);
        if (assigned !== naturalPositions[0] && naturalPositions.includes(assigned)) secondaryPlayers.push(player.nombre);
        if (!naturalPositions.includes(assigned)) adaptedPlayers.push(player.nombre);
      });
      const topPlayers = team
        .map((player) => {
          const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
          const rating = adjustedPositionRating(player, assigned);
          return {
            key: playerKey(player),
            name: player.nombre,
            position: assigned,
            rating,
            tier: playerCardTier(rating),
            lowRhythm: isLowRhythmPlayer(player),
            irregular: isIrregularPlayer(player),
          };
        })
        .sort((left, right) => right.rating - left.rating)
        .slice(0, 3);
      return {
        name: getTeamDisplayName(teamIndex),
        total: summary.adjusted,
        counts,
        tierCounts,
        lineText: formatLineCounts(counts),
        tierText: formatTierCounts(tierCounts),
        lowRhythm: team.filter(isLowRhythmPlayer).length,
        irregular: team.filter(isIrregularPlayer).length,
        repeatedPairs: teamRepeatedPairs(team, payload.pairHistory),
        secondaryPlayers,
        adaptedPlayers,
        topPlayers,
        strengths: stats.slice(0, 3),
        weaknesses: stats.slice(-2).reverse(),
        statValues: Object.fromEntries(ANALYSIS_FIELDS.map(([field]) => [field, Number(summary[field] || 0)])),
      };
    });
    const tierSpread = Object.keys(TIER_BALANCE_WEIGHTS).reduce((maxSpread, tier) => {
      const values = summaries.map((summary) => Number(summary.tierCounts?.[tier] || 0));
      return Math.max(maxSpread, countSpread(values));
    }, 0);
    const lineIssues = summaries.flatMap((summary) => {
      const teamSize = teams[0]?.length || 0;
      return FORMATION_LINES
        .filter((line) => {
          const count = Number(summary.counts?.[line] || 0);
          return count < logicalLineMinimumForCounts(line, teamSize, summary.counts) || count > fieldLineLimit(line, teamSize);
        })
        .map((line) => `${summary.name}: ${line}`);
    });
    const ruleChecks = [
      { label: 'Un arquero por equipo', ok: summaries.every((summary) => Number(summary.counts.ARQ || 0) === 1) },
      { label: 'Laterales y lineas cubiertas', ok: lineIssues.length === 0 },
      { label: 'Platinum repartidos', ok: evaluation.platinumSpread <= 1 },
      { label: 'Ritmo lento equilibrado', ok: evaluation.slowSpread <= 1 },
      { label: 'Irregulares repartidos', ok: evaluation.irregularSpread <= 1 },
    ];
    const comparisons = ANALYSIS_FIELDS
      .map(([field, label]) => {
        const values = summaries.map((summary) => summary.statValues[field]);
        const high = Math.max(...values);
        const low = Math.min(...values);
        const highIndex = values.indexOf(high);
        const lowIndex = values.indexOf(low);
        return { field, label, diff: high - low, high, low, highTeam: summaries[highIndex]?.name || '', lowTeam: summaries[lowIndex]?.name || '' };
      })
      .filter((item) => item.diff >= 0.15 && (item.field !== 'arquero' || item.high > 0))
      .sort((left, right) => right.diff - left.diff)
      .slice(0, 4);
    return {
      diff: evaluation.diff,
      slowSpread: evaluation.slowSpread,
      irregularSpread: evaluation.irregularSpread,
      platinumSpread: evaluation.platinumSpread,
      tierSpread,
      historicalPenalty: historicalRepeatPenalty(teams, payload.pairHistory),
      ruleChecks,
      decisionText: `Se evaluaron equipos por puntaje ajustado a posicion, cobertura de lineas, reparto de platinum, ritmo, regularidad, tiers e historial de companeros.`,
      summaries,
      comparisons,
    };
  }, [assignments, getTeamDisplayName, payload.drawBalanceWeights, payload.pairHistory, teams]);

  const drawAuditSnapshot = useMemo(() => {
    if (!teams || !drawAnalysis) return null;
    return {
      algorithm_version: 'react-sorteo-v2',
      created_at: new Date().toISOString(),
      criteria: {
        max_diff_requested: Number(maxDiff || 0),
        strict_max_diff: STRICT_MAX_DIFF,
        flexible_max_diff: FLEXIBLE_MAX_DIFF,
        rules: drawAnalysis.ruleChecks,
        optimized: ['puntaje ajustado por posicion', 'cobertura de lineas', 'platinum', 'ritmo', 'regularidad', 'tiers', 'historial de companeros'],
      },
      metrics: {
        diff: Number(drawAnalysis.diff.toFixed(2)),
        slow_spread: drawAnalysis.slowSpread,
        irregular_spread: drawAnalysis.irregularSpread,
        platinum_spread: drawAnalysis.platinumSpread,
        tier_spread: drawAnalysis.tierSpread,
        historical_penalty: drawAnalysis.historicalPenalty,
      },
      manual: {
        assignment_count: Object.keys(assignments || {}).length,
        locked_positions: lockedPlayerPositions,
        team_formations: teamFormations,
      },
      teams: drawAnalysis.summaries.map((summary) => ({
        name: summary.name,
        total: Number(summary.total.toFixed(2)),
        lines: summary.counts,
        tiers: summary.tierCounts,
        top_players: summary.topPlayers,
        strengths: summary.strengths.map((stat) => stat.label),
        weaknesses: summary.weaknesses.map((stat) => stat.label),
        repeated_pairs: summary.repeatedPairs,
        secondary_players: summary.secondaryPlayers,
        adapted_players: summary.adaptedPlayers,
      })),
    };
  }, [assignments, drawAnalysis, lockedPlayerPositions, maxDiff, teamFormations, teams]);

  const setTeamColor = (teamIndex, colorName) => {
    if (teamColorTaken(colorName, teamIndex)) {
      setError('Cada equipo necesita un color de camiseta distinto.');
      return;
    }
    setError('');
    setTeamColors((current) => current.map((item, index) => (index === teamIndex ? colorName : item)));
  };

  const markFormationAsManual = useCallback((...teamIndexes) => {
    const normalizedIndexes = Array.from(new Set(
      teamIndexes
        .map((teamIndex) => Number(teamIndex))
        .filter((teamIndex) => Number.isFinite(teamIndex) && teamIndex >= 0),
    ));
    if (!normalizedIndexes.length) return;
    setTeamFormations((current) => {
      let changed = false;
      const next = { ...current };
      normalizedIndexes.forEach((teamIndex) => {
        const key = String(teamIndex);
        if (next[key] !== 'custom') {
          next[key] = 'custom';
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const clearActiveFormationVariant = useCallback((...teamIndexes) => {
    const normalizedIndexes = Array.from(new Set(
      teamIndexes
        .map((teamIndex) => Number(teamIndex))
        .filter((teamIndex) => Number.isFinite(teamIndex) && teamIndex >= 0),
    ));
    if (!normalizedIndexes.length) return;
    setActiveFormationVariants((current) => {
      let changed = false;
      const next = { ...current };
      normalizedIndexes.forEach((teamIndex) => {
        const key = String(teamIndex);
        if (next[key]) {
          delete next[key];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, []);

  const applyFormation = (teamIndex, value) => {
    if (!teams?.[teamIndex]) return;
    pushUndo(teamIndex);
    clearActiveFormationVariant(teamIndex);
    setTeamFormations((current) => ({ ...current, [teamIndex]: value }));
    if (value === 'auto') {
      const teamKeys = new Set(teams[teamIndex].map(playerKey));
      setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !teamKeys.has(key) || lockedPlayerPositions[key])));
      return;
    }
    if (value === 'custom') return;
    const nextAssignments = applyFormationToTeam(teams[teamIndex], value);
    setAssignments((current) => ({ ...current, ...nextAssignments, ...lockedPlayerPositions }));
  };

  const lineDelta = (teamIndex, line, delta) => {
    if (!teams?.[teamIndex]) return;
    const team = teams[teamIndex];
    const currentAssignments = buildTeamAssignment(team, assignments);
    if (delta > 0) {
      const counts = teamLineCounts(team, currentAssignments);
      if ((counts[line] || 0) >= fieldLineLimit(line, team.length)) return;
      const candidate = team
        .filter((player) => currentAssignments[playerKey(player)] !== line && currentAssignments[playerKey(player)] !== 'ARQ')
        .filter((player) => !lockedPlayerPositions[playerKey(player)])
        .sort((a, b) => adjustedPositionRating(b, line) - adjustedPositionRating(a, line))[0];
      if (candidate) {
        pushUndo(teamIndex);
        markFormationAsManual(teamIndex);
        clearActiveFormationVariant(teamIndex);
        setAssignments((current) => ({ ...current, [playerKey(candidate)]: line }));
      }
      return;
    }
    const candidate = team
      .filter((player) => currentAssignments[playerKey(player)] === line)
      .filter((player) => !lockedPlayerPositions[playerKey(player)])
      .filter(() => (teamLineCounts(team, currentAssignments)[line] || 0) > fieldLineMinimum(line, team.length))
      .sort((a, b) => adjustedPositionRating(a, line) - adjustedPositionRating(b, line))[0];
    if (candidate) {
      const fallback = bestNaturalPlayerPosition(candidate) === line ? 'MED' : bestNaturalPlayerPosition(candidate);
      pushUndo(teamIndex);
      markFormationAsManual(teamIndex);
      clearActiveFormationVariant(teamIndex);
      setAssignments((current) => ({ ...current, [playerKey(candidate)]: fallback === 'ARQ' ? 'MED' : fallback }));
    }
  };

  const pitchLineDelta = (teamIndex, line, delta) => {
    if (line !== 'DEF') {
      lineDelta(teamIndex, line, delta);
      return;
    }
    if (!teams?.[teamIndex]) return;
    const team = teams[teamIndex];
    const currentAssignments = buildTeamAssignment(team, assignments);
    const counts = teamLineCounts(team, currentAssignments);

    if (delta > 0) {
      const perPositionLimit = maxDefLatPlayersPerPosition(team.length);
      if ((counts.DEF || 0) + (counts.LAT || 0) >= maxFieldPlayersPerLine(team.length)) return;
      const candidate = team
        .filter((player) => {
          const currentLine = currentAssignments[playerKey(player)];
          return currentLine !== 'ARQ' && currentLine !== 'DEF' && currentLine !== 'LAT';
        })
        .filter((player) => !lockedPlayerPositions[playerKey(player)])
        .flatMap((player) => ['DEF', 'LAT']
          .filter((targetLine) => (counts[targetLine] || 0) < perPositionLimit)
          .map((targetLine) => ({ player, targetLine, rating: adjustedPositionRating(player, targetLine) })))
        .sort((a, b) => b.rating - a.rating)[0];
    if (candidate) {
      pushUndo(teamIndex);
      markFormationAsManual(teamIndex);
      clearActiveFormationVariant(teamIndex);
      setAssignments((current) => ({ ...current, [playerKey(candidate.player)]: candidate.targetLine }));
    }
      return;
    }

    const candidate = team
      .filter((player) => ['DEF', 'LAT'].includes(currentAssignments[playerKey(player)]))
      .filter((player) => !lockedPlayerPositions[playerKey(player)])
      .filter(() => (counts.DEF || 0) + (counts.LAT || 0) > fieldLineMinimum('DEF', team.length))
      .sort((a, b) => {
        const assignedA = currentAssignments[playerKey(a)];
        const assignedB = currentAssignments[playerKey(b)];
        return adjustedPositionRating(a, assignedA) - adjustedPositionRating(b, assignedB);
      })[0];
    if (candidate) {
      const fallback = bestNaturalPlayerPosition(candidate);
      pushUndo(teamIndex);
      markFormationAsManual(teamIndex);
      clearActiveFormationVariant(teamIndex);
      setAssignments((current) => ({ ...current, [playerKey(candidate)]: fallback === 'ARQ' || fallback === 'DEF' || fallback === 'LAT' ? 'MED' : fallback }));
    }
  };

  const toggleLockedPosition = (player, assignedPosition) => {
    const key = playerKey(player);
    const position = String(assignedPosition || getPrimaryPlayerPosition(player)).toUpperCase();
    setLockedPlayerPositions((current) => {
      const next = { ...current };
      if (next[key]) {
        delete next[key];
      } else if (FORMATION_LINES.includes(position)) {
        next[key] = position;
      }
      return next;
    });
    setAssignments((current) => {
      if (lockedPlayerPositions[key]) return current;
      return FORMATION_LINES.includes(position) ? { ...current, [key]: position } : current;
    });
  };

  const findCrossTeamSwapTargetKey = useCallback((source, targetTeamIndex, targetLine = null) => {
    if (!teams || source == null) return null;
    const sourceTeamIndex = Number(source.teamIndex);
    const normalizedTargetTeamIndex = Number(targetTeamIndex);
    if (!Number.isFinite(sourceTeamIndex) || !Number.isFinite(normalizedTargetTeamIndex) || sourceTeamIndex === normalizedTargetTeamIndex) return null;
    const sourcePlayerKey = String(source.playerKey || '');
    const targetTeam = teams[normalizedTargetTeamIndex];
    if (!targetTeam?.length) return null;
    const normalizedTargetLine = String(targetLine || '').toUpperCase();
    const targetAssignments = buildTeamAssignment(targetTeam, assignments);
    const targetPitchLine = FORMATION_LINES.includes(normalizedTargetLine) ? pitchLineForPosition(normalizedTargetLine) : '';
    const candidates = targetTeam
      .filter((player) => {
        const key = playerKey(player);
        return key !== sourcePlayerKey && !lockedPlayerPositions[key] && !isFixedGoalkeeper(player);
      })
      .map((player) => {
        const key = playerKey(player);
        const assigned = targetAssignments[key] || getPrimaryPlayerPosition(player);
        const sameExactLine = normalizedTargetLine && assigned === normalizedTargetLine ? 1 : 0;
        const samePitchLine = targetPitchLine && pitchLineForPosition(assigned) === targetPitchLine ? 1 : 0;
        return {
          player,
          assigned,
          sameExactLine,
          samePitchLine,
          rating: adjustedPositionRating(player, assigned),
        };
      })
      .sort((left, right) => (
        right.sameExactLine - left.sameExactLine
        || right.samePitchLine - left.samePitchLine
        || left.rating - right.rating
        || String(left.player.nombre).localeCompare(String(right.player.nombre))
      ));
    return candidates[0] ? playerKey(candidates[0].player) : null;
  }, [assignments, lockedPlayerPositions, teams]);

  const validateDropTarget = useCallback((source, targetTeamIndex, targetLine = null, targetPlayerKey = null) => {
    if (!teams || source == null) return { ok: false, message: 'Primero genera los equipos.' };
    const sourceTeamIndex = Number(source.teamIndex);
    const normalizedTargetTeamIndex = Number(targetTeamIndex);
    const key = String(source.playerKey);
    if (!Number.isFinite(sourceTeamIndex) || !teams[sourceTeamIndex]) return { ok: false, message: 'No se encontro el equipo de origen.' };
    if (!Number.isFinite(normalizedTargetTeamIndex) || !teams[normalizedTargetTeamIndex]) return { ok: false, message: 'No se encontro el equipo destino.' };
    const resolvedTargetPlayerKey = targetPlayerKey
      || (sourceTeamIndex !== normalizedTargetTeamIndex ? findCrossTeamSwapTargetKey(source, normalizedTargetTeamIndex, targetLine) : null);
    if (sourceTeamIndex !== normalizedTargetTeamIndex && !resolvedTargetPlayerKey) {
      return { ok: false, message: 'Para cambiar de equipo, solta sobre un jugador disponible para intercambiar.' };
    }
    const sourcePlayer = teams[sourceTeamIndex]?.find((player) => playerKey(player) === key);
    if (!sourcePlayer) return { ok: false, message: 'No se encontro el jugador que estas moviendo.' };
    if (lockedPlayerPositions[key]) {
      return { ok: false, message: `${sourcePlayer?.nombre || 'El jugador'} tiene la posicion bloqueada.` };
    }
    if (sourcePlayer && isFixedGoalkeeper(sourcePlayer) && targetLine && targetLine !== 'ARQ') {
      return { ok: false, message: `${sourcePlayer.nombre} esta fijado como arquero y no puede cambiar de posicion.` };
    }
    const targetPlayer = resolvedTargetPlayerKey ? teams[normalizedTargetTeamIndex]?.find((player) => playerKey(player) === String(resolvedTargetPlayerKey)) : null;
    if (resolvedTargetPlayerKey && lockedPlayerPositions[String(resolvedTargetPlayerKey)]) {
      return { ok: false, message: `${targetPlayer?.nombre || 'El jugador destino'} tiene la posicion bloqueada.` };
    }
    if (targetPlayer && isFixedGoalkeeper(targetPlayer)) {
      return { ok: false, message: `${targetPlayer.nombre} esta fijado como arquero y no puede moverse por intercambio.` };
    }
    if (resolvedTargetPlayerKey && String(resolvedTargetPlayerKey) === key) {
      return { ok: false, message: 'Es el mismo jugador. Soltalo entre cartas o sobre otro jugador.' };
    }
    const targetKeyForAssignment = resolvedTargetPlayerKey && teams[normalizedTargetTeamIndex]?.some((player) => playerKey(player) === String(resolvedTargetPlayerKey))
      ? String(resolvedTargetPlayerKey)
      : null;
    const sourceLine = String(source.assignedPosition || '').toUpperCase();
    if (targetLine && !FORMATION_LINES.includes(targetLine)) {
      return { ok: false, message: 'Esa zona no es una posicion valida de la cancha.' };
    }
    if (targetLine && FORMATION_LINES.includes(targetLine) && teams[normalizedTargetTeamIndex]) {
      if (targetPlayer && sourcePlayer) {
        const proposedTargetTeam = sourceTeamIndex === normalizedTargetTeamIndex
          ? teams[normalizedTargetTeamIndex]
          : teams[normalizedTargetTeamIndex].map((player) => (playerKey(player) === String(resolvedTargetPlayerKey) ? sourcePlayer : player));
        const proposedTargetAssignments = buildTeamAssignment(proposedTargetTeam, assignments);
        proposedTargetAssignments[key] = targetLine;
        if (targetKeyForAssignment && FORMATION_LINES.includes(sourceLine)) {
          proposedTargetAssignments[targetKeyForAssignment] = sourceLine;
        }
        const normalizedTargetAssignments = normalizeCompactDefenseAssignments(proposedTargetTeam, proposedTargetAssignments);
        const proposedTargetCounts = teamLineCounts(proposedTargetTeam, normalizedTargetAssignments);
        const targetFits = fieldLineCountsFitLimits(proposedTargetCounts, proposedTargetTeam.length);

        let sourceFits = true;
        let proposedSourceCounts = null;
        let proposedSourceTeamSize = 0;
        if (sourceTeamIndex !== normalizedTargetTeamIndex) {
          const proposedSourceTeam = teams[sourceTeamIndex].map((player) => (playerKey(player) === key ? targetPlayer : player));
          const proposedSourceAssignments = buildTeamAssignment(proposedSourceTeam, assignments);
          if (FORMATION_LINES.includes(sourceLine)) {
            proposedSourceAssignments[targetKeyForAssignment] = sourceLine;
          }
          const normalizedSourceAssignments = normalizeCompactDefenseAssignments(proposedSourceTeam, proposedSourceAssignments);
          proposedSourceCounts = teamLineCounts(proposedSourceTeam, normalizedSourceAssignments);
          proposedSourceTeamSize = proposedSourceTeam.length;
          sourceFits = fieldLineCountsFitLimits(proposedSourceCounts, proposedSourceTeamSize);
        }

        if (!targetFits || !sourceFits) {
          const message = !targetFits
            ? lineCountViolationMessage(proposedTargetCounts, proposedTargetTeam.length)
            : lineCountViolationMessage(proposedSourceCounts, proposedSourceTeamSize);
          return { ok: false, message: message || `Limite de formacion: maximo ${maxFieldPlayersPerLine(proposedTargetTeam.length)} por linea.` };
        }
      } else {
        const proposedTeam = sourceTeamIndex === normalizedTargetTeamIndex || !sourcePlayer
          ? teams[normalizedTargetTeamIndex]
          : [...teams[normalizedTargetTeamIndex], sourcePlayer];
        const proposedAssignments = buildTeamAssignment(proposedTeam, assignments);
        proposedAssignments[key] = targetLine;
        const normalizedAssignments = normalizeCompactDefenseAssignments(proposedTeam, proposedAssignments);
        const proposedCounts = teamLineCounts(proposedTeam, normalizedAssignments);
        if (!fieldLineCountsFitLimits(proposedCounts, proposedTeam.length)) {
          return {
            ok: false,
            message: lineCountViolationMessage(proposedCounts, proposedTeam.length)
              || `Limite de formacion: maximo ${maxFieldPlayersPerLine(proposedTeam.length)} por linea.`,
          };
        }
      }
    }
    return { ok: true, message: '', targetKeyForAssignment, sourceLine, sourcePlayer, resolvedTargetPlayerKey };
  }, [assignments, findCrossTeamSwapTargetKey, lockedPlayerPositions, teams]);

  const movePlayer = (source, targetTeamIndex, targetLine = null, targetPlayerKey = null, targetInsertIndex = null) => {
    const validation = validateDropTarget(source, targetTeamIndex, targetLine, targetPlayerKey);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    const sourceTeamIndex = Number(source.teamIndex);
    const normalizedTargetTeamIndex = Number(targetTeamIndex);
    const key = String(source.playerKey);
    const sourcePlayer = validation.sourcePlayer;
    const sourceLine = validation.sourceLine;
    const targetKeyForAssignment = validation.targetKeyForAssignment;
    const resolvedTargetPlayerKey = validation.resolvedTargetPlayerKey || targetPlayerKey;
    const buildMovedTeams = (currentTeams) => {
      if (!currentTeams) return currentTeams;
      const next = currentTeams.map((team) => team.slice());
      const sourceIndex = next[sourceTeamIndex]?.findIndex((player) => playerKey(player) === key);
      if (!Number.isFinite(sourceIndex) || sourceIndex < 0) return currentTeams;
      const [moving] = next[sourceTeamIndex].splice(sourceIndex, 1);
      if (resolvedTargetPlayerKey) {
        const targetIndex = next[normalizedTargetTeamIndex]?.findIndex((player) => playerKey(player) === String(resolvedTargetPlayerKey));
        if (targetIndex >= 0) {
          const [target] = next[normalizedTargetTeamIndex].splice(targetIndex, 1, moving);
          next[sourceTeamIndex].splice(sourceIndex, 0, target);
          return next;
        }
      }
      if (targetLine && FORMATION_LINES.includes(targetLine) && Number.isFinite(targetInsertIndex)) {
        const nextAssignments = { ...assignments, [key]: sourcePlayer && isFixedGoalkeeper(sourcePlayer) ? 'ARQ' : targetLine };
        const targetPitchLine = pitchLineForPosition(targetLine);
        const orderedLinePlayers = targetPitchLine === 'DEF'
          ? defenseLinePlayers(
            next[normalizedTargetTeamIndex].filter((player) => pitchLineForPosition(nextAssignments[playerKey(player)] || getPrimaryPlayerPosition(player)) === targetPitchLine),
            nextAssignments,
          )
          : next[normalizedTargetTeamIndex].filter((player) => pitchLineForPosition(nextAssignments[playerKey(player)] || getPrimaryPlayerPosition(player)) === targetPitchLine);
        const boundedInsertIndex = Math.max(0, Math.min(Number(targetInsertIndex), orderedLinePlayers.length));
        const beforeKey = orderedLinePlayers[boundedInsertIndex] ? playerKey(orderedLinePlayers[boundedInsertIndex]) : null;
        if (beforeKey) {
          const beforeIndex = next[normalizedTargetTeamIndex].findIndex((player) => playerKey(player) === beforeKey);
          next[normalizedTargetTeamIndex].splice(beforeIndex >= 0 ? beforeIndex : next[normalizedTargetTeamIndex].length, 0, moving);
          return next;
        }
        const lastLinePlayer = orderedLinePlayers[orderedLinePlayers.length - 1] || null;
        if (lastLinePlayer) {
          const afterIndex = next[normalizedTargetTeamIndex].findIndex((player) => playerKey(player) === playerKey(lastLinePlayer));
          next[normalizedTargetTeamIndex].splice(afterIndex >= 0 ? afterIndex + 1 : next[normalizedTargetTeamIndex].length, 0, moving);
          return next;
        }
      }
      next[normalizedTargetTeamIndex].push(moving);
      return next;
    };
    const movedTeamsSnapshot = buildMovedTeams(teams);
    pushUndo(normalizedTargetTeamIndex);
    if (sourceTeamIndex !== normalizedTargetTeamIndex) pushUndo(sourceTeamIndex);
    markFormationAsManual(normalizedTargetTeamIndex, sourceTeamIndex);
    clearActiveFormationVariant(normalizedTargetTeamIndex, sourceTeamIndex);
    setTeams((current) => buildMovedTeams(current));
    if ((targetLine && FORMATION_LINES.includes(targetLine)) || targetKeyForAssignment) {
      setAssignments((current) => {
        const next = { ...current };
        if (targetLine && FORMATION_LINES.includes(targetLine)) next[key] = sourcePlayer && isFixedGoalkeeper(sourcePlayer) ? 'ARQ' : targetLine;
        if (targetKeyForAssignment && FORMATION_LINES.includes(sourceLine)) next[targetKeyForAssignment] = sourceLine;
        const teamsForNormalization = movedTeamsSnapshot || teams;
        let normalized = normalizeCompactDefenseAssignments(teamsForNormalization?.[normalizedTargetTeamIndex] || [], next);
        if (sourceTeamIndex !== normalizedTargetTeamIndex) {
          normalized = normalizeCompactDefenseAssignments(teamsForNormalization?.[sourceTeamIndex] || [], normalized);
        }
        return normalized;
      });
    }
  };

  const canDropSourceOnLine = (source, targetTeamIndex, targetLine) => {
    return validateDropTarget(source, targetTeamIndex, String(targetLine || '').toUpperCase(), null).ok;
  };

  const lineInsertPlacementFromEvent = (event) => {
    const sourceKey = dragState?.playerKey ? String(dragState.playerKey) : '';
    const items = Array.from(event.currentTarget.querySelectorAll('[data-sorteo-line-player-item="1"]'))
      .filter((item) => item.dataset.playerKey !== sourceKey);
    const pointerX = event.clientX;
    const containerRect = event.currentTarget.getBoundingClientRect();
    const index = items.findIndex((item) => {
      const rect = item.getBoundingClientRect();
      return pointerX < rect.left + (rect.width / 2);
    });
    const insertIndex = index >= 0 ? index : items.length;
    const pointerLocalX = pointerX - containerRect.left;
    let insertX = pointerLocalX;
    if (items.length) {
      if (insertIndex <= 0) {
        const firstLeft = items[0].getBoundingClientRect().left - containerRect.left;
        insertX = Math.min(pointerLocalX, firstLeft);
      } else if (insertIndex >= items.length) {
        const lastRight = items[items.length - 1].getBoundingClientRect().right - containerRect.left;
        insertX = Math.max(pointerLocalX, lastRight);
      } else {
        const previousRect = items[insertIndex - 1].getBoundingClientRect();
        const nextRect = items[insertIndex].getBoundingClientRect();
        insertX = ((previousRect.right + nextRect.left) / 2) - containerRect.left;
      }
    }
    return { insertIndex, insertX };
  };

  const nearbySwapTargetFromLineEvent = (event) => {
    const sourceKey = dragState?.playerKey ? String(dragState.playerKey) : '';
    const items = Array.from(event.currentTarget.querySelectorAll('[data-sorteo-line-player-item="1"]'))
      .filter((item) => item.dataset.playerKey !== sourceKey);
    let best = null;
    items.forEach((item) => {
      const card = item.querySelector('[data-sorteo-drag-player]');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const expandedLeft = rect.left - 14;
      const expandedRight = rect.right + 14;
      const expandedTop = rect.top - 10;
      const expandedBottom = rect.bottom + 10;
      if (
        event.clientX < expandedLeft
        || event.clientX > expandedRight
        || event.clientY < expandedTop
        || event.clientY > expandedBottom
      ) return;
      const centerX = rect.left + (rect.width / 2);
      const centerY = rect.top + (rect.height / 2);
      const distance = Math.hypot(event.clientX - centerX, event.clientY - centerY);
      if (!best || distance < best.distance) {
        best = {
          distance,
          playerKey: item.dataset.playerKey || card.dataset.playerKey || '',
          assignedPosition: card.dataset.assignedPosition || '',
        };
      }
    });
    return best;
  };

  const dragScoreDelta = (source, targetLine) => {
    if (!source?.player || !FORMATION_LINES.includes(String(targetLine || '').toUpperCase())) return null;
    const sourceLine = String(source.assignedPosition || getPrimaryPlayerPosition(source.player)).toUpperCase();
    const destinationLine = String(targetLine || '').toUpperCase();
    const from = playerCardRating(adjustedPositionRating(source.player, sourceLine));
    const to = playerCardRating(adjustedPositionRating(source.player, destinationLine));
    if (!from || !to) return null;
    const percent = Math.round(((to - from) / from) * 100);
    return { percent, from, to, line: destinationLine };
  };

  const handleDragStart = (event, teamIndex, player, assignedPosition) => {
    if (isFixedGoalkeeper(player)) {
      event.preventDefault();
      setError(`${player.nombre} esta fijado como arquero y no puede cambiar de posicion.`);
      return;
    }
    const source = { teamIndex, playerKey: playerKey(player), assignedPosition };
    const payload = JSON.stringify(source);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', payload);
    event.dataTransfer.setData('text/plain', payload);
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    event.dataTransfer.setDragImage(img, 0, 0);
    setDragState({ ...source, player });
    setDragPoint({ x: event.clientX, y: event.clientY });
    updateDragHoverTarget({ teamIndex, line: pitchLineForPosition(assignedPosition), targetLine: assignedPosition, playerKey: playerKey(player) });
  };

  const sourceFromDragEvent = (event) => {
    try {
      const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain') || '';
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.teamIndex != null && parsed?.playerKey != null ? parsed : dragState;
    } catch {
      return dragState;
    }
  };

  const handleDrop = (event, teamIndex, line, targetPlayerKey = null) => {
    event.preventDefault();
    event.stopPropagation();
    const source = sourceFromDragEvent(event);
    const targetCard = event.target.closest?.('[data-sorteo-drag-player]');
    const targetLine = event.target.closest?.('[data-sorteo-drop-line]');
    const resolvedTeamIndex = targetCard?.dataset?.teamIndex != null
      ? Number(targetCard.dataset.teamIndex)
      : (targetLine?.dataset?.teamIndex != null ? Number(targetLine.dataset.teamIndex) : teamIndex);
    const hoverPlayerKey = dragHoverTarget?.teamIndex === resolvedTeamIndex
      && dragHoverTarget?.playerKey
      ? String(dragHoverTarget.playerKey)
      : null;
    const tentativeLine = (Number.isFinite(Number(dragHoverTarget?.insertIndex)) ? dragHoverTarget?.targetLine : null)
      || targetCard?.dataset?.assignedPosition
      || targetLine?.dataset?.sorteoDropLine
      || line
      || null;
    const hoverIsInsert = dragHoverTarget?.teamIndex === resolvedTeamIndex
      && (dragHoverTarget?.targetLine || dragHoverTarget?.line) === tentativeLine
      && Number.isFinite(Number(dragHoverTarget?.insertIndex))
      && !dragHoverTarget?.playerKey;
    const resolvedTargetPlayerKey = hoverIsInsert ? null : (targetPlayerKey || targetCard?.dataset?.playerKey || hoverPlayerKey || null);
    const resolvedLine = resolvedTargetPlayerKey
      ? (targetCard?.dataset?.assignedPosition || dragHoverTarget?.targetLine || line || null)
      : tentativeLine;
    const resolvedInsertIndex = !resolvedTargetPlayerKey
      && dragHoverTarget?.teamIndex === resolvedTeamIndex
      && (dragHoverTarget?.targetLine || dragHoverTarget?.line) === resolvedLine
      && Number.isFinite(Number(dragHoverTarget?.insertIndex))
      ? Number(dragHoverTarget.insertIndex)
      : null;
    movePlayer(source, Number.isFinite(resolvedTeamIndex) ? resolvedTeamIndex : teamIndex, resolvedLine, resolvedTargetPlayerKey, resolvedInsertIndex);
    setDragState(null);
    setDragPoint(null);
    setDragHoverTarget(null);
  };

  const handleTouchCard = (teamIndex, player, assignedPosition) => {
    setPreview({ player, assignedPosition });
  };

  const applyTeamFormationVariant = (teamIndex, variant) => {
    if (!teams?.[teamIndex] || !variant?.assignments) return;
    pushUndo(teamIndex);
    markFormationAsManual(teamIndex);
    const teamKeys = new Set(teams[teamIndex].map(playerKey));
    setAssignments((current) => {
      const next = { ...current };
      teamKeys.forEach((key) => {
        if (!lockedPlayerPositions[key]) delete next[key];
      });
      Object.entries(variant.assignments).forEach(([key, value]) => {
        next[key] = lockedPlayerPositions[key] || value;
      });
      return next;
    });
    setActiveFormationVariants((current) => ({ ...current, [String(teamIndex)]: variant.signature }));
    setAnalysisVisible(true);
    setSuccess(`Variante aplicada en ${getTeamDisplayName(teamIndex)}.`);
  };

  const downloadTeamsText = () => {
    if (!teams) {
      setError('Primero genera los equipos.');
      return;
    }
    let text = `EQUIPOS GOODFELLAS\n\n${currentMatchupName}\n\n`;
    teams.forEach((team, teamIndex) => {
      const currentAssignments = teamAssignments(teamIndex);
      text += `${getTeamDisplayName(teamIndex)}\n`;
      team.forEach((player) => {
        const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
        text += `${player.nombre.toUpperCase()} - ${assigned} - ${adjustedPositionRating(player, assigned).toFixed(1)} pts\n`;
      });
      text += `Total: ${teamScore(team, assignments).toFixed(1)} pts | Lentos: ${team.filter(isLowRhythmPlayer).length}\n\n`;
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8;' }));
    link.download = 'equipos_goodfellas.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const copyTeams = async () => {
    if (!teams) {
      setError('Primero genera los equipos.');
      return;
    }
    const text = teams.map((team, teamIndex) => `${getTeamDisplayName(teamIndex)}:\n${team.map((player) => player.nombre.toUpperCase()).join('\n')}`).join('\n\n');
    try {
      await navigator.clipboard.writeText(`${currentMatchupName}\n\n${text}`);
      setSuccess('Equipos copiados al portapapeles.');
    } catch {
      setError('No se pudo copiar al portapapeles.');
    }
  };

  const downloadTeamsJpg = async () => {
    if (!teams || !teamsContainerRef.current) {
      setError('Primero genera los equipos.');
      return;
    }
    setExporting(true);
    try {
      const capture = typeof window.html2canvas === 'function' ? window.html2canvas : html2canvas;
      const canvas = await capture(teamsContainerRef.current, {
        backgroundColor: '#f6faf8',
        scale: 2,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 15000,
        onclone: injectFormationExportStyles,
      });
      const link = document.createElement('a');
      link.download = `formaciones_goodfellas_${new Date().toISOString().slice(0, 10)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setError('');
    } catch (exportError) {
      console.error('Error al generar JPG:', exportError);
      setError(exportError?.message ? `No se pudo generar la imagen: ${exportError.message}` : 'Hubo un error al generar la imagen.');
    } finally {
      setExporting(false);
    }
  };

  const saveDraw = async () => {
    if (!payload.matchId) {
      setError('Esta pantalla no esta vinculada a una fecha.');
      return;
    }
    if (!teams) {
      setError('Primero genera los equipos.');
      return;
    }
    const uniqueColors = new Set(teamColors.slice(0, teams.length));
    if (uniqueColors.size !== teams.length) {
      setError('Cada equipo necesita un color de camiseta distinto.');
      return;
    }
    const teamsPayload = teams.map((team, teamIndex) => {
      const currentAssignments = teamAssignments(teamIndex);
      const color = getTeamColor(teamIndex);
      return {
        color_name: color.name,
        players: team.map((player) => ({
          id: player.id,
          assigned_position: currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player),
        })),
      };
    });
    try {
      const response = await fetch('guardar_sorteo.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: payload.matchId,
          num_teams: numTeams,
          redraw_increment: redrawsUsedThisSession,
          teams: teamsPayload,
          draw_audit_snapshot: drawAuditSnapshot,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'No se pudo guardar el sorteo.');
      setPersistedRedrawCount((value) => value + redrawsUsedThisSession);
      setRedrawsUsedThisSession(0);
      setHasSavedDraw(true);
      setGeneratedOnce(false);
      setError('');
      const manualMessage = manualChangeCount > 0 ? ` Se conservaron ${manualChangeCount} ajuste${manualChangeCount === 1 ? '' : 's'} manual${manualChangeCount === 1 ? '' : 'es'} de cancha.` : '';
      setSuccess(`${data.message || 'Sorteo guardado correctamente en la fecha.'}${manualMessage}`);
      window.setTimeout(() => navigate(payload.links?.back || 'editar_partidos.php'), 700);
    } catch (saveError) {
      setSuccess('');
      setError(saveError.message || 'No se pudo guardar el sorteo.');
    }
  };

  const saveFormations = async () => {
    if (!payload.matchId) {
      setError('Esta pantalla no esta vinculada a una fecha.');
      return;
    }
    if (!teams) {
      setError('No hay equipos cargados para guardar.');
      return;
    }
    const uniqueColors = new Set(teamColors.slice(0, teams.length));
    if (uniqueColors.size !== teams.length) {
      setError('Cada equipo necesita un color de camiseta distinto.');
      return;
    }
    const formData = new FormData();
    formData.set('action', 'save_formations');
    formData.set('match_id', String(payload.matchId));
    teams.forEach((team, teamIndex) => {
      const teamNumber = teamIndex + 1;
      const currentAssignments = teamAssignments(teamIndex);
      formData.set(`team_color[${teamNumber}]`, getTeamColor(teamIndex).name);
      team.forEach((player) => {
        const key = playerKey(player);
        formData.set(`player_team[${player.id}]`, String(teamNumber));
        formData.set(`player_position[${player.id}]`, currentAssignments[key] || getPrimaryPlayerPosition(player));
      });
    });
    try {
      const response = await fetch(`finalizar_partido.php?match_id=${encodeURIComponent(String(payload.matchId))}&edit_formations=1`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error('No se pudieron guardar las formaciones.');
      }
      setError('');
      setSuccess('Formaciones y camisetas guardadas.');
      window.setTimeout(() => navigate(payload.links?.back || 'editar_partidos.php'), 500);
    } catch (saveError) {
      setSuccess('');
      setError(saveError.message || 'No se pudieron guardar las formaciones.');
    }
  };

  const currentDragValidation = dragState && dragHoverTarget
    ? validateDropTarget(
      dragState,
      Number(dragHoverTarget.teamIndex),
      dragHoverTarget.targetLine || dragHoverTarget.line || null,
      dragHoverTarget.playerKey || null,
    )
    : null;
  const currentDragBlockMessage = currentDragValidation && !currentDragValidation.ok ? currentDragValidation.message : '';
  const currentDragDelta = !currentDragBlockMessage && dragState && (dragHoverTarget?.targetLine || dragHoverTarget?.line)
    ? dragScoreDelta(dragState, dragHoverTarget.targetLine || dragHoverTarget.line)
    : null;
  const currentDragDeltaClass = currentDragDelta?.percent > 0
    ? 'border-lime-200 bg-lime-200 text-[#07130f]'
    : (currentDragDelta?.percent < 0
      ? 'border-red-200 bg-red-100 text-red-900'
      : 'border-white/30 bg-white text-[#07130f]');
  const currentDragDeltaText = currentDragDelta
    ? `${currentDragDelta.to - currentDragDelta.from > 0 ? '+' : ''}${currentDragDelta.to - currentDragDelta.from} pts`
    : '';

  return (
    <section
      className="sorteo-page sorteo-react-page mx-auto grid w-full max-w-7xl gap-3 px-3 py-3 text-[#07130f] sm:px-5 lg:gap-4 lg:py-5"
      onDragOver={(event) => {
        if (!dragState) return;
        event.preventDefault();
        setDragPoint({ x: event.clientX, y: event.clientY });
      }}
      onDragEnd={() => {
        setDragState(null);
        setDragPoint(null);
        setDragHoverTarget(null);
      }}
    >
      <div className="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className={quietButtonClass} type="button" onClick={() => navigate(payload.links?.back || 'editar_partidos.php')}>
            <Icon name="arrowLeft" />
            Volver a fechas
          </button>
          {payload.match && payload.links?.finish ? (
            <button className={secondaryButtonClass} type="button" onClick={() => navigate(payload.links?.finish)}>
              <Icon name="calendar" />
              Finalizar fecha
            </button>
          ) : !payload.match ? (
            <button className={secondaryButtonClass} type="button" onClick={() => setFormModal({ mode: 'add' })}>
              <Icon name="plus" />
              Agregar jugador
            </button>
          ) : null}
        </div>

        <header className="grid gap-3 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="m-0 text-xs font-extrabold uppercase tracking-[.12em] text-[#526b62]">{isFormationEditor ? 'Formaciones' : 'Sorteo de equipos'}</p>
            <h1 className="m-0 text-xl font-black leading-tight text-[#07130f] sm:text-2xl">{isFormationEditor ? 'Cancha GOODFELLAS' : 'Generador GOODFELLAS'}</h1>
            {payload.match ? (
              <p className="m-0 mt-1 text-sm font-semibold text-[#526b62]">
                {payload.match.title} | {payload.match.matchDate}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{selectedPlayers.length}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Jugadores</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{numTeams}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Equipos</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{teams && drawAnalysis ? drawAnalysis.diff.toFixed(1) : maxDiff}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Dif.</small>
            </span>
          </div>
        </header>
      </div>

      <div className={`grid gap-4 ${isFormationEditor ? '' : 'lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]'}`}>
        {!isFormationEditor ? (
        <aside className={`grid content-start gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm ${lockedMatch ? 'max-lg:order-2' : ''}`}>
          <div className="flex items-center justify-between gap-3 border-b border-[#d7e6df] pb-3">
            <div>
              <h2 className="m-0 text-base font-black text-[#07130f]">Jugadores disponibles</h2>
              <p className="m-0 text-xs font-semibold text-slate-500">{lockedMatch ? 'Plantel de la fecha' : 'Lista editable local'}</p>
            </div>
            {!lockedMatch ? (
              <label className={quietButtonClass}>
                CSV
                <input className="sr-only" type="file" accept=".csv" onChange={importPlayersCsv} />
              </label>
            ) : null}
          </div>

          {!lockedMatch ? (
            <div className="flex flex-wrap gap-2">
              <button className={quietButtonClass} type="button" onClick={exportPlayersCsv}><Icon name="download" />Guardar CSV</button>
              <button className={secondaryButtonClass} type="button" onClick={() => setAllSelected(!players.every((player) => player.selected))}>
                {players.every((player) => player.selected) ? 'Deseleccionar' : 'Seleccionar'} todos
              </button>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-1">
              {[
                ['nombre', 'Nombre'],
                ['puntuacion', 'Media'],
                ['ritmo', 'Ritmo'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={`min-h-8 rounded-md px-2 text-xs font-black transition-colors ${sortKey === key ? 'bg-[#063d2b] text-white' : 'text-[#526b62] hover:bg-white hover:text-[#063d2b]'} ${focusRing}`}
                  onClick={() => toggleSort(key)}
                >
                  {label}{sortKey === key ? (sortDirection > 0 ? ' +' : ' -') : ''}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="teamDisplay">Equipos</label>
            <span id="teamDisplay" className="hidden">{numTeams}</span>
            <span id="diffDisplay" className="hidden">{maxDiff}</span>
          </div>

          <div className="grid max-h-[62vh] gap-2 overflow-auto rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2" id="jugadores-container">
            {sortedPlayers.map((player) => (
              <article key={playerKey(player)} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-[#d7e6df] bg-white p-2">
                <input
                  className="h-4 w-4 accent-[#063d2b]"
                  id={`jugador-${playerKey(player)}`}
                  type="checkbox"
                  checked={lockedMatch || player.selected}
                  disabled={lockedMatch}
                  onChange={(event) => setPlayers((current) => current.map((item) => (playerKey(item) === playerKey(player) ? { ...item, selected: event.target.checked } : item)))}
                />
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-black text-[#07130f]">{player.nombre}</strong>
                  <span className="flex flex-wrap items-center gap-1 text-[11px] font-extrabold text-slate-500">
                    <span>{player.posicion}</span>
                    <span>{playerCardRating(player.puntuacion)} GEN</span>
                    {manualGoalkeepers[playerKey(player)] === true ? <span>Arquero</span> : null}
                    {isLowRhythmPlayer(player) ? <span>Lento</span> : null}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button className={iconButtonClass} type="button" onClick={() => setFormModal({ mode: 'edit', player })} aria-label={`Editar ${player.nombre}`}><Icon name="pencil" /></button>
                  {!lockedMatch ? (
                    <button className={dangerButtonClass} type="button" onClick={() => removePlayer(player)} aria-label={`Eliminar ${player.nombre}`}><Icon name="trash" /></button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </aside>
        ) : null}

        <main className={`grid content-start gap-4 ${isFormationEditor ? '' : 'lg:contents'} ${lockedMatch ? 'max-lg:order-1' : ''}`}>
          {!isFormationEditor ? (
          <div className="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm lg:col-start-2 lg:row-start-1">
            <div className="grid gap-2 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-sm font-black text-[#07130f]">Definir arqueros</h3>
                  <p className="m-0 text-[11px] font-semibold text-[#526b62]">Se eligen antes de realizar el sorteo.</p>
                </div>
                <span className={`rounded-md border px-2 py-1 text-xs font-black ${selectedGoalkeepers.length === numTeams ? 'border-[#9fc8b5] bg-white text-[#063d2b]' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {selectedGoalkeepers.length}/{numTeams}
                </span>
              </div>
              {selectedGoalkeepers.length > numTeams ? (
                <p className="m-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-extrabold text-red-700">
                  Hay mas arqueros elegidos que equipos.
                </p>
              ) : null}
              <div className="grid max-h-44 gap-1.5 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
                {goalkeeperOptions.length ? goalkeeperOptions.map((player) => {
                  const key = playerKey(player);
                  const checked = manualGoalkeepers[key] === true;
                  const disabled = !checked && goalkeeperLimitReached;
                  return (
                    <label
                      key={`arquero-${key}`}
                      className={`grid min-h-10 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border bg-white px-2 py-1.5 ${checked ? 'border-[#063d2b]' : 'border-[#d7e6df]'} ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
                    >
                      <input
                        className="h-4 w-4 accent-[#063d2b]"
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleManualGoalkeeper(player)}
                      />
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-black text-[#07130f]">{player.nombre}</strong>
                        <small className="block truncate text-[11px] font-extrabold text-[#526b62]">{player.posicion}</small>
                      </span>
                      <span className="rounded border border-[#d7e6df] bg-[#f8fbfa] px-2 py-1 text-[11px] font-black text-[#063d2b]">
                        ARQ {playerCardRating(adjustedPositionRating(player, 'ARQ'))}
                      </span>
                    </label>
                  );
                }) : (
                  <p className="m-0 rounded-md border border-[#d7e6df] bg-white px-2 py-2 text-xs font-bold text-[#526b62]">
                    Selecciona jugadores para definir arqueros.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button className={primaryButtonClass} id="generateTeamsButton" type="button" onClick={generateTeams} disabled={generateDisabled}>
                <Icon name="dice" />
                {generating ? 'Generando...' : generateButtonLabel}
              </button>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] px-3 text-xs font-extrabold text-[#526b62]">
                Max diff
                <input className="h-8 w-16 rounded-md border border-[#adc8bb] bg-white px-2 text-center text-sm font-black text-[#07130f]" type="number" min="0.5" max="6" step="0.1" value={maxDiff} onChange={(event) => setMaxDiff(event.target.value)} />
              </label>
            </div>
            <div id="generateTeamsLoading" className={`${generating ? 'grid' : 'hidden'} gap-2 rounded-lg border border-[#9fc8b5] bg-[#f4fbf7] px-4 py-3 text-sm font-bold text-[#063d2b]`} role="status" aria-live="polite" aria-busy={generating}>
              <div className="flex items-center justify-between gap-3">
                <strong className="block">Generando equipos...</strong>
                <span className="text-xs font-black text-[#526b62]">{generationStage || 'Balanceando'}</span>
              </div>
              <div className="sorteo-generate-progress" role="progressbar" aria-label="Progreso de generacion de equipos" aria-valuetext="Buscando la combinacion mas equilibrada">
                <span />
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-black text-[#526b62]" aria-hidden="true">
                {GENERATION_STEPS.map((step) => (
                  <span key={step} className={`rounded border px-1.5 py-0.5 ${generationStage === step ? 'border-[#063d2b] bg-white text-[#063d2b]' : 'border-[#cfe4da] bg-white/60'}`}>{step}</span>
                ))}
              </div>
              <span className="text-xs font-semibold text-[#526b62]">Buscando la combinacion mas equilibrada sin romper arqueros, posiciones ni cartas platinum.</span>
            </div>
            <Message id="error" tone="error">{error}</Message>
            <Message id="success" tone="success">{success}</Message>
          </div>
          ) : (
            <div className="grid gap-2 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm">
              <Message id="error" tone="error">{error}</Message>
              <Message id="success" tone="success">{success}</Message>
            </div>
          )}

          <div id="equipos-generados" ref={teamsContainerRef} className="grid gap-4 lg:col-span-2 lg:row-start-2">
            {teams ? (
              <>
                <div className="w-full rounded-lg border border-[#d7e6df] bg-white px-4 py-2 text-center text-lg font-black text-[#07130f] shadow-sm" data-sorteo-matchup-title="1">
                  {currentMatchupName}
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  {teams.map((team, teamIndex) => {
                    const color = getTeamColor(teamIndex);
                    const currentAssignments = teamAssignments(teamIndex);
                    const linePlayers = Object.fromEntries(PITCH_LINES.map((line) => [line, []]));
                    team.forEach((player) => {
                        const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
                        const pitchLine = pitchLineForPosition(assigned);
                        (linePlayers[pitchLine] || linePlayers.MED).push(player);
                      });
                    const summary = teamTotalsSummary(team, assignments);
                    const formationOptions = getFormationOptions(team.length);
                    const formationSelectValue = teamFormationSelectValue(
                      team,
                      currentAssignments,
                      teamFormations[teamIndex],
                      isFormationEditor,
                    );
                    return (
                      <article key={teamIndex} className="team-card sorteo-team-card team grid gap-3 rounded-lg border p-3 shadow-sm max-[760px]:gap-2 max-[760px]:p-2" data-team-index={teamIndex} data-sorteo-team-card="1">
                        <div className="team-head grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <h3 className="m-0 flex items-center gap-2 truncate text-lg font-black text-[#07130f]" data-team-title>
                              <span className={`h-3 w-3 rounded-full ${color.accent}`} aria-hidden="true" />
                              {getTeamDisplayName(teamIndex)}
                            </h3>
                            <p className="m-0 text-xs font-semibold text-slate-500">{team.length} jugadores | {team.filter(isLowRhythmPlayer).length} lentos</p>
                          </div>
                          <span className={`inline-grid min-h-9 place-items-center rounded-md border px-3 text-sm font-black ${color.tag}`}>{summary.adjusted.toFixed(1)} pts</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 rounded-md border border-[#d7e6df] bg-white p-2 max-[760px]:gap-1.5 max-[760px]:p-1.5 md:grid-cols-2">
                          <label className="grid gap-1 text-xs font-extrabold text-slate-600">
                            Camiseta
                            <select className={inputClass} value={color.name} onChange={(event) => setTeamColor(teamIndex, event.target.value)}>
                              {teamColorOptions.map((option) => (
                                <option key={option.name} value={option.name} disabled={teamColorTaken(option.name, teamIndex)}>{option.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="grid gap-1 text-xs font-extrabold text-slate-600">
                            Formación
                            <select className={inputClass} value={formationSelectValue} onChange={(event) => applyFormation(teamIndex, event.target.value)}>
                              <option value="auto">Automática</option>
                              {formationOptions.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
                              <option value="custom">Personalizada</option>
                            </select>
                          </label>
                        </div>

                        <div
                          className={`team-formation relative grid h-[680px] grid-rows-[minmax(0,.8fr)_repeat(3,minmax(0,1fr))] gap-2 overflow-hidden rounded-lg border border-emerald-200 p-3 text-white max-[760px]:h-[430px] max-[760px]:gap-1 max-[760px]:p-1.5 ${pitchBackgroundClass}`}
                          data-sorteo-drop-team={teamIndex}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleDrop(event, teamIndex, null)}
                        >
                          <button className="absolute right-2 top-2 z-20 grid h-8 w-8 place-items-center rounded-lg border border-white/25 bg-emerald-950/65 text-white transition hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:h-7 max-[760px]:w-7" type="button" disabled={!(undoStacks[String(teamIndex)] || []).length} onClick={() => undoTeam(teamIndex)} aria-label="Deshacer ultimo cambio">
                            <Icon name="undo" />
                          </button>
                          {drawVariants[String(teamIndex)]?.length ? (
                            <div className="absolute left-2 right-12 top-2 z-30 flex flex-wrap gap-1 max-[760px]:left-1.5 max-[760px]:right-10 max-[760px]:top-1.5 max-[760px]:gap-0.5">
                              {drawVariants[String(teamIndex)].map((variant, index) => {
                                const isActiveVariant = activeFormationVariants[String(teamIndex)] === variant.signature;
                                return (
                                  <button
                                    key={variant.signature || index}
                                    className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2 text-[11px] font-black shadow-sm transition-colors max-[760px]:min-h-6 max-[760px]:px-1.5 max-[760px]:text-[9px] ${
                                      isActiveVariant
                                        ? 'border-[#063d2b] bg-[#dff1e8] text-[#063d2b] ring-2 ring-lime-200/70'
                                        : [
                                          'border-[#d7e6df] bg-white/92 text-[#07130f] hover:border-[#9fc8b5] hover:bg-white',
                                          'border-amber-200 bg-amber-50/95 text-[#7a4b00] hover:bg-amber-100',
                                          'border-rose-200 bg-rose-50/95 text-rose-800 hover:bg-rose-100',
                                        ][index % 3]
                                    }`}
                                    type="button"
                                    onClick={() => applyTeamFormationVariant(teamIndex, variant)}
                                    aria-label={`Opcion ${index + 1}: ${variant.lineText}, ${variant.total.toFixed(1)} puntos`}
                                    aria-pressed={isActiveVariant}
                                    title={`${variant.lineText} | ${variant.total.toFixed(1)} pts | ${variant.diffCount} cambios`}
                                  >
                                    <span>O{index + 1}</span>
                                    <span className="font-extrabold opacity-80">{variant.total.toFixed(1)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : null}
                          {PITCH_LINES.map((line) => {
                            const lineList = line === 'DEF'
                              ? defenseLinePlayers(linePlayers.DEF || [], currentAssignments)
                              : (linePlayers[line] || []);
                            const hasProjectedLaterals = line === 'DEF'
                              && lineList.some((player) => (currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player)) === 'LAT');
                            const label = line === 'DEF' ? 'DEF/LAT' : line;
                            const lineCounts = teamLineCounts(team, currentAssignments);
                            const count = line === 'DEF' ? lineCounts.DEF + lineCounts.LAT : lineCounts[line];
                            const max = line === 'ARQ' ? 1 : maxFieldPlayersPerLine(team.length);
                            const canTuneLine = line !== 'ARQ';
                            const isDraggingPlayer = Boolean(dragState);
                            const isLineHoverTarget = Boolean(
                              dragHoverTarget?.teamIndex === teamIndex
                              && dragHoverTarget?.line === line
                              && !dragHoverTarget?.playerKey,
                            );
                            const markerLeft = isLineHoverTarget && Number.isFinite(Number(dragHoverTarget?.insertX))
                              ? `clamp(22px, ${Number(dragHoverTarget.insertX)}px, calc(100% - 22px))`
                              : '50%';
                            const visibleLineCount = lineList.filter((player) => playerKey(player) !== String(dragState?.playerKey || '')).length;
                            const visualInsertIndex = isLineHoverTarget && Number.isFinite(Number(dragHoverTarget?.insertIndex))
                              ? Math.max(0, Math.min(Number(dragHoverTarget.insertIndex), visibleLineCount))
                              : null;
                            const markerLine = line === 'DEF' && visualInsertIndex !== null
                              ? defenseInsertRole(visibleLineCount, visualInsertIndex)
                              : (dragHoverTarget?.targetLine || line);
                            const lineValidationTarget = line === 'DEF' && visualInsertIndex !== null ? markerLine : line;
                            const lineDropValidation = isDraggingPlayer
                              ? validateDropTarget(dragState, teamIndex, lineValidationTarget, null)
                              : null;
                            const lineCanAcceptDrop = Boolean(lineDropValidation?.ok);
                            const lineBlockMessage = lineDropValidation && !lineDropValidation.ok ? lineDropValidation.message : '';
                            const isLineDropTarget = Boolean(lineCanAcceptDrop && isLineHoverTarget);
                            const lineDropClass = !isDraggingPlayer
                              ? ''
                              : (lineCanAcceptDrop
                                ? 'border-lime-200/70 bg-lime-200/15 ring-2 ring-lime-200/70'
                                : 'opacity-45');
                            return (
                              <div
                                key={line}
                                className={`formation-line ${hasProjectedLaterals ? 'is-projected-defense' : ''} ${pitchLineToneClasses[line] || ''} ${canTuneLine ? 'sorteo-line-with-tools' : 'sorteo-line-basic'} grid min-h-0 items-center gap-2 border-b border-white/15 transition-colors duration-150 last:border-b-0 max-[760px]:gap-1 ${lineDropClass} ${
                                  canTuneLine
                                    ? 'grid-cols-[54px_minmax(0,1fr)_34px] max-[760px]:grid-cols-[32px_minmax(0,1fr)_22px] max-[760px]:gap-0.5'
                                    : 'grid-cols-[54px_minmax(0,1fr)] max-[760px]:grid-cols-[38px_minmax(0,1fr)]'
                                }`}
                                data-sorteo-drop-line={line}
                                data-team-index={teamIndex}
                                onDragOver={(event) => {
                                  event.preventDefault();
                                  if (event.target.closest?.('.line-players')) return;
                                  if (dragState) updateDragHoverTarget({ teamIndex, line, targetLine: line });
                                }}
                                onDrop={(event) => handleDrop(event, teamIndex, line)}
                              >
                                <div className="line-label grid justify-items-center gap-1 text-center text-[10px] font-black uppercase text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.48)] max-[760px]:gap-0.5 max-[760px]:text-[9px]">
                                  <span className={`leading-none px-1 py-0.5 [text-shadow:none] ${pitchLineLabelClasses[line] || ''}`}>{label}</span>
                                  <small className="rounded bg-emerald-950/45 px-1 text-[9px] font-extrabold leading-tight text-white/75 max-[760px]:text-[8px]">{count}/{max}</small>
                                  {canTuneLine ? (
                                    <span className="grid gap-1 max-[760px]:gap-0.5">
                                      <button className="grid !h-7 !min-h-0 w-7 place-items-center rounded border border-white/30 bg-emerald-950/55 !p-0 text-xs font-black text-white hover:bg-emerald-950/80 max-[760px]:!h-5 max-[760px]:w-5 max-[760px]:text-[10px]" type="button" onClick={() => pitchLineDelta(teamIndex, line, -1)} aria-label={`Quitar jugador de ${label}`}>-</button>
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className="line-players relative flex h-full min-h-0 flex-nowrap items-center justify-center gap-2 overflow-hidden rounded-lg border !border-white/10 !bg-emerald-950/10 p-1 max-[760px]:gap-1 max-[760px]:p-0.5"
                                  data-sorteo-drop-line={line}
                                  data-team-index={teamIndex}
                                  onDragOver={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (dragState) {
                                      const nearbySwapTarget = nearbySwapTargetFromLineEvent(event);
                                      if (nearbySwapTarget?.playerKey) {
                                        updateDragHoverTarget({
                                          teamIndex,
                                          line,
                                          targetLine: nearbySwapTarget.assignedPosition || line,
                                          playerKey: nearbySwapTarget.playerKey,
                                        });
                                        return;
                                      }
                                      const placement = lineInsertPlacementFromEvent(event);
                                      const targetLineForPlacement = line === 'DEF'
                                        ? defenseInsertRole(
                                          lineList.filter((player) => playerKey(player) !== String(dragState.playerKey || '')).length,
                                          placement.insertIndex,
                                        )
                                        : line;
                                      updateDragHoverTarget({ teamIndex, line, targetLine: targetLineForPlacement, ...placement });
                                    }
                                  }}
                                  onDrop={(event) => handleDrop(event, teamIndex, line)}
                                >
                                  {isDraggingPlayer && !lineCanAcceptDrop ? (
                                    <span className="pointer-events-none absolute inset-x-2 top-1 z-40 rounded-md border border-red-200 bg-red-100 px-2 py-1 text-center text-[10px] font-black leading-tight text-red-900 shadow-sm max-[760px]:text-[9px]" aria-hidden="true">
                                      {lineBlockMessage}
                                    </span>
                                  ) : null}
                                  {isLineDropTarget ? (
                                    <PitchDropMarker line={markerLine} style={{ left: markerLeft }} />
                                  ) : null}
                                  {lineList.map((player) => {
                                    const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
                                    const key = playerKey(player);
                                    const visibleIndex = lineList
                                      .filter((candidate) => playerKey(candidate) !== String(dragState?.playerKey || ''))
                                      .findIndex((candidate) => playerKey(candidate) === key);
                                    const opensGapBefore = visualInsertIndex !== null
                                      && key !== String(dragState?.playerKey || '')
                                      && visibleIndex === visualInsertIndex;
                                    const gapClass = opensGapBefore ? 'ml-[54px] min-[380px]:ml-[64px] sm:ml-[70px] xl:ml-[82px] 2xl:ml-[88px]' : '';
                                    const isSwapTarget = Boolean(
                                      dragState
                                      && dragHoverTarget?.playerKey === key
                                      && dragHoverTarget?.teamIndex === teamIndex
                                      && dragState.playerKey !== key,
                                    );
                                    return (
                                      <span
                                        key={key}
                                        className={`relative shrink-0 transition-[margin,transform,opacity] duration-150 ease-out ${gapClass}`}
                                        data-sorteo-line-player-item="1"
                                        data-player-key={key}
                                      >
                                        <CompactPlayerCard
                                          player={player}
                                          assignedPosition={assigned}
                                          laneRole={assigned === 'LAT' ? 'lateral' : ''}
                                          onOpen={() => !dragState && handleTouchCard(teamIndex, player, assigned)}
                                          draggableProps={{
                                            draggable: !isFixedGoalkeeper(player) && !lockedPlayerPositions[key],
                                            dragging: dragState?.playerKey === key,
                                            locked: Boolean(lockedPlayerPositions[key]),
                                            swapTarget: isSwapTarget,
                                            onDragStart: (event) => handleDragStart(event, teamIndex, player, assigned),
                                            onDragOver: (event) => {
                                              event.preventDefault();
                                              event.stopPropagation();
                                              if (dragState) {
                                                const rect = event.currentTarget.getBoundingClientRect();
                                                const edgeWidth = Math.min(10, rect.width * 0.12);
                                                const onLeftEdge = event.clientX <= rect.left + edgeWidth;
                                                const onRightEdge = event.clientX >= rect.right - edgeWidth;
                                                if (onLeftEdge || onRightEdge) {
                                                  const containerRect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
                                                  const siblingCards = Array.from(event.currentTarget.parentElement?.parentElement?.querySelectorAll('[data-sorteo-line-player-item="1"]') || [])
                                                    .filter((item) => item.dataset.playerKey !== String(dragState.playerKey));
                                                  const cardIndex = siblingCards.indexOf(event.currentTarget.parentElement);
                                                  const insertIndex = Math.max(0, cardIndex + (onRightEdge ? 1 : 0));
                                                  const insertX = containerRect
                                                    ? ((onRightEdge ? rect.right : rect.left) - containerRect.left)
                                                    : undefined;
                                                  const targetLineForPlacement = line === 'DEF'
                                                    ? defenseInsertRole(siblingCards.length, insertIndex)
                                                    : assigned;
                                                  updateDragHoverTarget({ teamIndex, line, targetLine: targetLineForPlacement, insertIndex, insertX });
                                                } else {
                                                  updateDragHoverTarget({ teamIndex, line, targetLine: assigned, playerKey: key });
                                                }
                                              }
                                            },
                                            onDrop: (event) => handleDrop(event, teamIndex, assigned, key),
                                            'data-sorteo-drag-player': '1',
                                            'data-sorteo-swap-target': isSwapTarget ? '1' : undefined,
                                            'data-player-key': key,
                                            'data-team-index': teamIndex,
                                            'data-assigned-position': assigned,
                                          }}
                                        />
                                      </span>
                                    );
                                  })}
                                </div>
                                {canTuneLine ? (
                                  <div className="grid justify-items-center gap-1 max-[760px]:gap-0.5">
                                    <button className="grid !h-7 !min-h-0 w-7 place-items-center rounded border border-lime-200/45 bg-lime-100 !p-0 text-xs font-black text-[#07130f] hover:bg-lime-200 max-[760px]:!h-5 max-[760px]:w-5 max-[760px]:text-[10px]" type="button" onClick={() => pitchLineDelta(teamIndex, line, 1)} aria-label={`Agregar jugador a ${label}`}>+</button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="team-head grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <h3 className="m-0 flex items-center gap-2 truncate text-lg font-black text-[#07130f]">
                              <span className={`h-3 w-3 rounded-full ${color.accent}`} aria-hidden="true" />
                              {getTeamDisplayName(teamIndex)}
                            </h3>
                            <p className="m-0 text-xs font-semibold text-slate-500">{team.length} jugadores | {team.filter(isLowRhythmPlayer).length} lentos</p>
                          </div>
                          <span className={`inline-grid min-h-9 place-items-center rounded-md border px-3 text-sm font-black ${color.tag}`}>{summary.adjusted.toFixed(1)} pts</span>
                        </div>

                        <div className="sorteo-team-stats grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 text-xs font-extrabold text-[#07130f] max-[760px]:gap-1 max-[760px]:p-1.5">
                          <div className="flex flex-wrap gap-1.5 max-[760px]:gap-1">
                            {(summary.arquero > 0 ? [['Arquero', summary.arquero]] : [['Ataque', summary.ataque]])
                              .concat([
                                ['Solidez', summary.solidez],
                                ['Ritmo', summary.ritmo],
                                ['Tecnica', summary.tecnica],
                                ['Equipo', summary.compromiso],
                                ['Mentalidad', summary.mentalidad],
                                ['Regularidad', summary.regularidad],
                              ])
                              .map(([label, value]) => (
                                <span key={label} className="rounded-md border border-[#d7e6df] bg-white px-2 py-1 max-[760px]:px-1.5 max-[760px]:py-0.5 max-[760px]:text-[10px]">{label} {Number(value).toFixed(1)}</span>
                              ))}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#adc8bb] bg-white p-8 text-center text-sm font-semibold text-slate-500">
                Genera los equipos para ver la cancha y las cartas compactas.
              </div>
            )}
          </div>

          <div id="download-controls" className={`${teams ? 'grid' : 'hidden'} gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm lg:col-span-2 lg:row-start-3`}>
            <div className="flex flex-wrap justify-center gap-2">
              <details className="relative">
                <summary className={`${quietButtonClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                  <Icon name="download" />
                  Exportar
                </summary>
                <div className="absolute bottom-[calc(100%+6px)] left-0 z-40 grid min-w-56 gap-1 rounded-lg border border-[#adc8bb] bg-white p-1.5 shadow-sm max-[760px]:left-1/2 max-[760px]:w-[min(92vw,320px)] max-[760px]:-translate-x-1/2">
                  <button className={`${quietButtonClass} w-full justify-start border-transparent px-3 shadow-none`} type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); downloadTeamsJpg(); }} disabled={exporting}><Icon name="download" />{exporting ? 'Generando JPG...' : 'Exportar JPG'}</button>
                  <button className={`${quietButtonClass} w-full justify-start border-transparent px-3 shadow-none`} type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); copyTeams(); }}><Icon name="clipboard" />Copiar</button>
                  <button className={`${quietButtonClass} w-full justify-start border-transparent px-3 shadow-none`} type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); downloadTeamsText(); }}><Icon name="download" />Descargar texto</button>
                </div>
              </details>
              <button className={secondaryButtonClass} type="button" onClick={() => setAnalysisVisible((visible) => !visible)} aria-expanded={analysisVisible}>
                <Icon name="clipboard" />
                {analysisVisible ? 'Ocultar analisis' : 'Analizar equipos'}
              </button>
              {lockedMatch ? (
                <button className={primaryButtonClass} type="button" onClick={isFormationEditor ? saveFormations : saveDraw}>
                  <Icon name="save" />
                  {isFormationEditor ? 'Guardar formaciones' : 'Guardar sorteo'}
                </button>
              ) : null}
            </div>
            {manualChangeCount > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-[#7a4b00]">
                Hay {manualChangeCount} ajuste{manualChangeCount === 1 ? '' : 's'} manual{manualChangeCount === 1 ? '' : 'es'} en cancha{lockedPositionCount > 0 ? `, con ${lockedPositionCount} posicion${lockedPositionCount === 1 ? '' : 'es'} bloqueada${lockedPositionCount === 1 ? '' : 's'}` : ''}. Al guardar se conservaran las posiciones actuales.
              </div>
            ) : null}
          </div>

          {teams && analysisVisible && drawAnalysis ? (
            <section className="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm lg:col-span-2 lg:row-start-4" data-sorteo-analysis="1" aria-label="Analisis de equipos">
              <div className="grid gap-2 border-b border-[#d7e6df] pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h3 className="m-0 text-base font-black text-[#07130f]">Analisis de equipos</h3>
                  <p className="m-0 text-xs font-semibold text-[#526b62]">
                    Resumen claro del equilibrio, los puntos fuertes, los puntos a cuidar y los jugadores mas determinantes.
                  </p>
                </div>
                <span className="inline-flex min-h-9 items-center justify-center rounded-md border border-[#9fc8b5] bg-[#eaf7f0] px-3 text-sm font-black text-[#063d2b]">
                  Dif. {drawAnalysis.diff.toFixed(1)}
                </span>
              </div>

              <div className="grid gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)]">
                <div className="grid gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-3">
                  <strong className="text-sm font-black text-[#07130f]">Lectura rapida</strong>
                  <div className="grid gap-2 text-xs font-bold text-[#526b62] sm:grid-cols-2">
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Puntaje: diferencia de <strong className="text-[#07130f]">{drawAnalysis.diff.toFixed(1)}</strong>. {drawAnalysis.diff <= 1 ? 'Partido muy parejo.' : drawAnalysis.diff <= 2 ? 'Ventaja moderada.' : 'Hay una ventaja clara a revisar.'}
                    </p>
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Jugadores lentos: {drawAnalysis.slowSpread <= 1 ? 'repartidos parejo' : `desbalance de ${drawAnalysis.slowSpread}`}.
                    </p>
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Regularidad baja: {drawAnalysis.irregularSpread <= 1 ? 'sin concentracion importante' : `desbalance de ${drawAnalysis.irregularSpread}`}.
                    </p>
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Jugadores top: {drawAnalysis.platinumSpread <= 1 ? 'bien repartidos' : `hay ${drawAnalysis.platinumSpread} de diferencia en platinum`}.
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 rounded-md border border-[#d7e6df] bg-white p-3">
                  <strong className="text-sm font-black text-[#07130f]">Alertas</strong>
                  <div className="grid gap-1.5">
                    {drawAnalysis.ruleChecks.map((rule) => (
                      <span key={rule.label} className={`rounded-md border px-2 py-1.5 text-xs font-black ${rule.ok ? 'border-[#9fc8b5] bg-[#f4fbf7] text-[#063d2b]' : 'border-amber-200 bg-amber-50 text-[#7a4b00]'}`}>
                        {rule.ok ? 'Bien' : 'Revisar'}: {rule.label}
                      </span>
                    ))}
                    <span className={`rounded-md border px-2 py-1.5 text-xs font-black ${drawAnalysis.historicalPenalty ? 'border-amber-200 bg-amber-50 text-[#7a4b00]' : 'border-[#9fc8b5] bg-[#f4fbf7] text-[#063d2b]'}`}>
                      Historial: {drawAnalysis.historicalPenalty ? 'hay companeros repetidos con peso en el sorteo' : 'sin alerta fuerte de companeros repetidos'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                {drawAnalysis.summaries.map((summary) => (
                  <article key={summary.name} className="grid gap-3 rounded-md border border-[#d7e6df] bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <strong className="text-sm font-black text-[#07130f]">{summary.name}</strong>
                      <span className="rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-2 py-1 text-xs font-black text-[#063d2b]">{summary.total.toFixed(1)} pts</span>
                    </div>
                    <div className="grid gap-2 text-xs font-bold text-[#526b62] sm:grid-cols-2">
                      <p className="m-0 rounded border border-[#d7e6df] bg-[#f8fbfa] px-2 py-2">Posiciones: <strong className="text-[#07130f]">{summary.lineText}</strong></p>
                      <p className="m-0 rounded border border-[#d7e6df] bg-[#f8fbfa] px-2 py-2">Cartas: <strong className="text-[#07130f]">{summary.tierText}</strong></p>
                      <p className="m-0 rounded border border-[#d7e6df] bg-[#f8fbfa] px-2 py-2 sm:col-span-2">Lentos {summary.lowRhythm} / Irregulares {summary.irregular}</p>
                    </div>
                    <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(210px,.8fr)]">
                      <div className="grid gap-2">
                        <div>
                          <span className="block text-[11px] font-black uppercase text-[#063d2b]">Puntos altos</span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {summary.strengths.map((stat) => (
                              <span key={stat.field} className="rounded-md border border-[#d7e6df] bg-[#eaf7f0] px-2 py-1 text-xs font-black text-[#063d2b]">{stat.label} {stat.value.toFixed(1)}</span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="block text-[11px] font-black uppercase text-[#7a4b00]">Puntos bajos</span>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {summary.weaknesses.map((stat) => (
                              <span key={stat.field} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-black text-[#7a4b00]">{stat.label} {stat.value.toFixed(1)}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-1.5 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-2">
                        <span className="text-[11px] font-black uppercase text-[#07130f]">Mejores jugadores</span>
                        {summary.topPlayers.map((player, index) => (
                          <div key={player.key} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 rounded border border-[#d7e6df] bg-white px-2 py-1.5 text-xs font-bold text-[#526b62]">
                            <strong className="text-center text-[#063d2b]">{index + 1}</strong>
            <span className="min-w-0">
                              <strong className="block truncate text-[#07130f]">{player.name}</strong>
                              <span>{player.position} | {TIER_LABELS[player.tier] || player.tier}{player.lowRhythm ? ' | lento' : ''}{player.irregular ? ' | irregular' : ''}</span>
                            </span>
                            <strong className="text-[#063d2b]">{player.rating.toFixed(1)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-2 text-xs font-bold text-[#526b62] sm:grid-cols-2">
                      <p className="m-0 rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-2 py-2">
                        Lectura: fuerte en <strong className="text-[#063d2b]">{summary.strengths.map((stat) => stat.label).join(', ')}</strong>.
                      </p>
                      <p className="m-0 rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-2 py-2">
                        A cuidar: <strong className="text-[#7a4b00]">{summary.weaknesses.map((stat) => stat.label).join(', ')}</strong>.
                      </p>
                    </div>
                    {(summary.secondaryPlayers.length || summary.adaptedPlayers.length) ? (
                      <p className="m-0 rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-2 py-2 text-xs font-bold text-[#526b62]">
                        {summary.secondaryPlayers.length ? `Usa posicion secundaria: ${summary.secondaryPlayers.join(', ')}. ` : ''}
                        {summary.adaptedPlayers.length ? `Adaptados fuera de posicion natural: ${summary.adaptedPlayers.join(', ')}.` : ''}
                      </p>
                    ) : null}
                    {summary.repeatedPairs.length ? (
                      <p className="m-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-bold text-[#7a4b00]">
                        Historial repetido: {summary.repeatedPairs.map((pair) => `${pair.names} (${pair.count})`).join(', ')}.
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>

              {drawAnalysis.comparisons.length ? (
                <div className="grid gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-3">
                  <strong className="text-sm font-black text-[#07130f]">Diferencias principales</strong>
                  <div className="grid gap-2 md:grid-cols-2">
                    {drawAnalysis.comparisons.map((item) => (
                      <p key={item.field} className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2 text-xs font-bold text-[#526b62]">
                        En {item.label}, <strong className="text-[#07130f]">{item.highTeam}</strong> esta por encima de <strong className="text-[#07130f]">{item.lowTeam}</strong> por {item.diff.toFixed(1)} puntos.
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}
        </main>
      </div>

      {formModal ? (
        <PlayerFormModal
          mode={formModal.mode}
          player={formModal.player}
          onClose={() => setFormModal(null)}
          onSave={formModal.mode === 'add' ? addPlayer : updatePlayer}
        />
      ) : null}

      {preview ? (
        <>
          <button className="fixed inset-0 z-[80] bg-black/70" type="button" aria-label="Cerrar ficha" onClick={() => setPreview(null)} />
          <section className="fixed inset-0 z-[90] grid place-items-center overflow-auto p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${preview.player.nombre}`}>
            <div className="grid w-full max-w-3xl items-center gap-4 md:grid-cols-[minmax(260px,1fr)_260px]">
              <div className="relative grid aspect-[409/710] w-[min(78vw,320px)] max-h-[82vh] place-items-center overflow-visible justify-self-center">
                <div className="origin-center scale-[1.72] sm:scale-[1.9]">
                  <FullPlayerCard player={preview.player} assignedPosition={preview.assignedPosition} />
                </div>
              </div>
              <aside className="grid gap-3 rounded-lg border border-white/15 bg-black/72 p-3 text-white shadow-sm">
                <div>
                  <h3 className="m-0 text-base font-black">{preview.player.nombre}</h3>
                  <p className="m-0 text-xs font-semibold text-white/70">Puntaje por posicion</p>
                </div>
                <div className="grid gap-1.5">
                  {playerPositionRatings(preview.player, preview.assignedPosition).map((rating) => (
                    <div key={rating.position} className={`grid grid-cols-[42px_minmax(0,1fr)_44px] items-center gap-2 rounded-md border px-2 py-1.5 text-xs font-black ${rating.position === preview.assignedPosition ? 'border-lime-200 bg-lime-200/15' : 'border-white/15 bg-white/8'}`}>
                      <span>{rating.position}</span>
                      <span className="h-2 overflow-hidden rounded bg-white/15">
                        <i className="block h-full rounded bg-lime-200" style={{ width: `${Math.max(12, Math.min(100, rating.value))}%` }} />
                      </span>
                      <span className="text-right">{rating.value}</span>
                    </div>
                  ))}
                </div>
                <p className="m-0 text-xs font-semibold leading-relaxed text-white/70">
                  El puntaje usa las habilidades relevantes para cada posicion y ajuste por regularidad.
                </p>
                <button
                  className="min-h-10 rounded-md border border-white/20 bg-white/10 px-3 text-sm font-black text-white transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  type="button"
                  onClick={() => toggleLockedPosition(preview.player, preview.assignedPosition)}
                >
                  {lockedPlayerPositions[playerKey(preview.player)] ? 'Desbloquear posicion' : `Bloquear en ${preview.assignedPosition}`}
                </button>
              </aside>
            </div>
            <button className="absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-black/70 text-white transition-colors hover:bg-black/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40" type="button" onClick={() => setPreview(null)} aria-label="Cerrar ficha">
              <Icon name="x" />
            </button>
          </section>
        </>
      ) : null}

      {dragState && dragPoint ? (
        <div className="pointer-events-none fixed z-[100]" style={{ left: dragPoint.x + 14, top: dragPoint.y + 14 }}>
          <div className="absolute -left-3 -top-3 h-8 w-8 rounded-full bg-lime-200/20 blur-sm" />
          <div className="absolute -left-6 -top-6 h-12 w-12 rounded-full border border-lime-200/35" />
          <div className="relative">
            {currentDragBlockMessage ? (
              <div className="absolute -right-2 -top-2 z-20 w-44 border border-red-200 bg-red-100 px-2 py-1 text-[11px] font-black leading-tight text-red-900 shadow-sm">
                {currentDragBlockMessage}
              </div>
            ) : currentDragDelta ? (
              <div className={`absolute -right-2 -top-2 z-20 grid min-w-14 justify-items-center border px-2 py-1 text-[11px] font-black leading-tight shadow-sm ${currentDragDeltaClass}`}>
                <span>{currentDragDeltaText}</span>
                <span className="text-[9px] font-extrabold opacity-75">{`${currentDragDelta.from} -> ${currentDragDelta.to} ${currentDragDelta.line}`}</span>
              </div>
            ) : null}
            <CompactPlayerCard player={dragState.player} assignedPosition={dragState.assignedPosition} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
