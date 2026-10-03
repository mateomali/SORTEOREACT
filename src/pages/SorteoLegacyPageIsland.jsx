import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toJpeg } from 'html-to-image';

const FORMATION_LINES = ['ARQ', 'DEF', 'LAT', 'MED', 'DEL'];
const PITCH_LINES = ['ARQ', 'DEF', 'MED', 'DEL'];
const FIELD_LINES = ['DEF', 'LAT', 'MED', 'DEL'];
const FORMATION_PRESETS = [
  { value: 'custom', label: 'Personalizada' },
  { value: 'balanced', label: 'Equilibrada' },
  { value: 'defensive', label: 'Defensiva' },
  { value: 'offensive', label: 'Ofensiva' },
];
const FORMATION_PRESET_VALUES = new Set(FORMATION_PRESETS.map((option) => option.value));
const REQUIRED_FIELD_LINES = ['DEF', 'MED', 'DEL'];
const POSITION_ORDER = { ARQ: 0, DEF: 1, LAT: 2, MED: 3, DEL: 4 };
const POSITION_LABELS = { ARQ: 'Arquero', DEF: 'Defensa', LAT: 'Lateral', MED: 'Medio', DEL: 'Delantero' };
const ANALYSIS_FIELDS = [
  ['ataque', 'Ataque'],
  ['solidez', 'Solidez'],
  ['ritmo', 'Velocidad'],
  ['resistencia', 'Ida y vuelta'],
  ['pase_vision', 'Pase/Vision'],
  ['tecnica', 'Tecnica'],
  ['compromiso', 'Equipo'],
  ['mentalidad', 'Mentalidad'],
  ['regularidad', 'Regularidad'],
  ['arquero', 'Arquero'],
];
const TEAM_RADAR_FIELDS = [
  ['ataque', 'ATA'],
  ['solidez', 'SOL'],
  ['ritmo', 'VEL'],
  ['resistencia', 'IDV'],
  ['pase_vision', 'PAS'],
  ['tecnica', 'TEC'],
  ['compromiso', 'EQU'],
  ['mentalidad', 'MEN'],
];
const MANUAL_COMPARISON_FIELDS = [
  ['total', 'Total'],
  ['ataque', 'Ataque'],
  ['pase_vision', 'Pase/Vision'],
  ['ritmo', 'Velocidad'],
  ['resistencia', 'Ida y vuelta'],
  ['lineas', 'Lineas'],
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
  { name: 'ROSA', label: 'Rosa', accent: 'bg-pink-400', accentHex: '#f472b6', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'AZUL', label: 'Azul', accent: 'bg-sky-500', accentHex: '#0ea5e9', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'NARANJA', label: 'Naranja', accent: 'bg-orange-500', accentHex: '#f97316', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'NEGRO', label: 'Negro', accent: 'bg-slate-950', accentHex: '#0f172a', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'VERDE', label: 'Verde', accent: 'bg-emerald-600', accentHex: '#16a34a', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'CAMISADO', label: 'Camisado', accent: 'bg-white ring-1 ring-slate-300', accentHex: '#ffffff', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
  { name: 'DESCAMISADO', label: 'Descamisado', accent: 'bg-stone-300', accentHex: '#cbd5e1', tag: 'bg-white text-[#07130f] border-[#d7e6df]' },
];

function hexToRgba(hex, alpha) {
  const value = String(hex || '#16a34a').replace('#', '');
  const full = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function ratingStats(player) {
  const fields = { goalkeeper_skill: 'habilidad_arquero', defense_physical: 'solidez', rhythm: 'ritmo_stat', stamina: 'resistencia', technique: 'tecnica', pass_vision: 'pase_vision', teamwork: 'compromiso', mentality: 'mentalidad', attack: 'ataque', regularity: 'regularidad' };
  return Object.fromEntries(Object.entries(fields).map(([field, legacy]) => [field, statValue(player, legacy)]));
}

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-200/60';
const inputClass = `min-h-10 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-bold text-[#07130f] outline-none transition focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60`;
const quietButtonClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-extrabold text-[#063d2b] transition-colors hover:border-[#9fc8b5] hover:bg-[#f4fbf7] ${focusRing}`;
const primaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#063d2b] bg-[#063d2b] px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#082f23] disabled:cursor-wait disabled:opacity-70 ${focusRing}`;
const secondaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9fc8b5] bg-[#eaf7f0] px-4 text-sm font-black text-[#063d2b] transition-colors hover:border-[#063d2b] hover:bg-[#dff1e8] ${focusRing}`;
const dangerButtonClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-extrabold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 ${focusRing}`;
const iconButtonClass = `grid h-9 w-9 place-items-center rounded-lg border border-[#d7e6df] bg-white text-[#526b62] transition-colors hover:border-[#9fc8b5] hover:bg-[#f5faf7] hover:text-[#063d2b] ${focusRing}`;

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

function normalizeAvailabilityPercent(value) {
  const number = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(number) ? Math.max(1, Math.min(100, number)) : 100;
}

function applyAvailabilityPercent(value, percent) {
  return normalizeSix(Number(value || 0) * (normalizeAvailabilityPercent(percent) / 100), 1);
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
  const availabilityPercent = normalizeAvailabilityPercent(raw.availability_percent ?? raw.availabilityPercent ?? 100);
  const baseRating = normalizeSix(raw.base_puntuacion ?? raw.puntuacion_base ?? raw.puntuacion_base_match ?? raw.puntuacion ?? raw.rating ?? raw.overall, 3);
  const baseRitmoStat = normalizeSix(raw.base_ritmo_stat ?? raw.ritmo_stat ?? raw.rhythm, normalizePace(raw.ritmo ?? raw.pace) === 'lento' ? 2 : 4);
  const baseResistencia = normalizeSix(raw.base_resistencia ?? raw.resistencia ?? raw.stamina, baseRitmoStat);
  const baseTecnica = normalizeSix(raw.base_tecnica ?? raw.tecnica ?? raw.technique, baseRating);
  const basePaseVision = normalizeSix(raw.base_pase_vision ?? raw.pase_vision ?? raw.pass_vision, baseTecnica);
  const baseSolidez = normalizeSix(raw.base_solidez ?? raw.solidez ?? raw.defense_physical, baseRating);
  const baseAtaque = normalizeSix(raw.base_ataque ?? raw.ataque ?? raw.attack, baseRating);
  const baseCompromiso = normalizeSix(raw.base_compromiso ?? raw.compromiso ?? raw.teamwork, baseRating);
  const baseMentalidad = normalizeSix(raw.base_mentalidad ?? raw.mentalidad ?? raw.mentality, 3);
  const baseRegularidad = normalizeSix(raw.base_regularidad ?? raw.regularidad ?? raw.regularity, 3.5);
  const baseHabilidadArquero = normalizeSix(raw.base_habilidad_arquero ?? raw.habilidad_arquero ?? raw.goalkeeper_skill, baseRating);
  const photoPath = String(raw.photo_path || '');
  const safePhoto = photoPath.startsWith('uploads/players/') && !photoPath.includes('..')
    ? photoPath
    : 'assets/players/default-player-silhouette.png';
  const player = {
    ...raw,
    id: raw.id ?? `local-${index + 1}-${String(raw.nombre || raw.name || 'jugador').replace(/\W+/g, '-').toLowerCase()}`,
    nombre: String(raw.nombre || raw.name || `Jugador ${index + 1}`).trim() || `Jugador ${index + 1}`,
    posicion: normalizePositionText(raw.posicion || raw.positions),
    ritmo: normalizePace(raw.ritmo || raw.pace),
    availability_percent: availabilityPercent,
    base_puntuacion: baseRating,
    base_tecnica: baseTecnica,
    base_pase_vision: basePaseVision,
    base_ritmo_stat: baseRitmoStat,
    base_resistencia: baseResistencia,
    base_solidez: baseSolidez,
    base_ataque: baseAtaque,
    base_compromiso: baseCompromiso,
    base_mentalidad: baseMentalidad,
    base_regularidad: baseRegularidad,
    base_habilidad_arquero: baseHabilidadArquero,
    puntuacion: applyAvailabilityPercent(baseRating, availabilityPercent),
    tecnica: applyAvailabilityPercent(baseTecnica, availabilityPercent),
    pase_vision: applyAvailabilityPercent(basePaseVision, availabilityPercent),
    ritmo_stat: applyAvailabilityPercent(baseRitmoStat, availabilityPercent),
    resistencia: applyAvailabilityPercent(baseResistencia, availabilityPercent),
    solidez: applyAvailabilityPercent(baseSolidez, availabilityPercent),
    ataque: applyAvailabilityPercent(baseAtaque, availabilityPercent),
    compromiso: applyAvailabilityPercent(baseCompromiso, availabilityPercent),
    mentalidad: applyAvailabilityPercent(baseMentalidad, availabilityPercent),
    regularidad: applyAvailabilityPercent(baseRegularidad, availabilityPercent),
    habilidad_arquero: applyAvailabilityPercent(baseHabilidadArquero, availabilityPercent),
    photo_path: safePhoto,
    has_custom_photo: raw.has_custom_photo === true || safePhoto.startsWith('uploads/players/'),
    photo_position_x: clampPhotoPosition(raw.photo_position_x ?? raw.photoPositionX, 50),
    photo_position_y: clampPhotoPosition(raw.photo_position_y ?? raw.photoPositionY, 50),
    photo_zoom: clampPhotoZoom(raw.photo_zoom ?? raw.photoZoom, 100),
    selected: raw.selected !== false,
  };
  player.puntuacion = adjustedPositionRating(player, getPrimaryPlayerPosition(player));
  return player;
}

function playerKey(player) {
  return String(player?.id ?? player?.nombre ?? '');
}

const playerPositionCache = new WeakMap();
function getOrderedPlayerPositions(player) {
  const cached = playerPositionCache.get(player);
  if (cached?.raw === player.posicion) return cached.positions;
  const positions = normalizePositionText(player?.posicion).split('/').filter(Boolean);
  playerPositionCache.set(player, { raw: player.posicion, positions });
  return positions;
}

function getPrimaryPlayerPosition(player) {
  return getOrderedPlayerPositions(player)[0] || 'MED';
}

function canPlayGoalkeeper(player) {
  return getOrderedPlayerPositions(player).includes('ARQ') || player?.emergencyGoalkeeper === true || player?.manualGoalkeeper === true;
}

function isFixedGoalkeeper(player) {
  return player?.reservedGoalkeeper !== undefined ? player.reservedGoalkeeper === true : player?.manualGoalkeeper === true;
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

function positionFitFactor(player, assignedPosition, ignorePositionFit = false) {
  return globalThis.GoodfellasRating.fit(getOrderedPlayerPositions(player), String(assignedPosition || '').toUpperCase(), ignorePositionFit);
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

function balanceStatValue(player, field) {
  if (field === 'ritmo') return statValue(player, 'ritmo_stat');
  if (field === 'arquero') return statValue(player, 'habilidad_arquero');
  return statValue(player, field);
}

function isLowRhythmPlayer(player) {
  return statValue(player, 'ritmo_stat') <= 3;
}

function isIrregularPlayer(player) {
  return playerCardRating(statValue(player, 'regularidad')) < 70;
}

function applyRegularityAdjustment(rating, player) {
  return globalThis.GoodfellasRating.regularity(rating, ratingStats(player));
}

function historicalResultAdjustment(player) {
  const adjustment = Number(player?.rendimiento_historico_ajuste || 0);
  return Number.isFinite(adjustment) ? Math.max(-0.25, Math.min(0.25, adjustment)) : 0;
}

function positionBaseRating(player, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  return globalThis.GoodfellasRating.base(ratingStats(player), position);
}

const playerRatingCache = new WeakMap();
function adjustedPositionRating(player, assignedPosition, options = {}) {
  const position = String(assignedPosition || getPrimaryPlayerPosition(player)).toUpperCase();
  const key = `${position}:${options.ignorePositionFit === true}`;
  const cache = playerRatingCache.get(player) || {};
  if (Object.hasOwn(cache, key)) return cache[key];
  const positionalRating = applyRegularityAdjustment(positionBaseRating(player, position), player) * positionFitFactor(player, position, options.ignorePositionFit === true);
  const rating = Math.round(Math.max(1, Math.min(6, positionalRating + historicalResultAdjustment(player))) * 10) / 10;
  cache[key] = rating;
  playerRatingCache.set(player, cache);
  return rating;
}

function adjustedPositionRatingForTeamSize(player, assignedPosition, teamSize) {
  return adjustedPositionRating(player, assignedPosition);
}

function positionPenaltyPercent(player, assignedPosition, teamSize = null) {
  const position = String(assignedPosition || '').toUpperCase();
  if (!position || position === getPrimaryPlayerPosition(player)) return 0;
  const natural = getOrderedPlayerPositions(player).includes(position);
  if (!natural) return Math.round((1 - positionFitFactor(player, position)) * 100);
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
  return globalThis.GoodfellasRating.card(value);
}

function playerCardTier(value) {
  const overall = playerCardRating(value);
  if (overall >= 88) return 'supreme';
  if (overall >= 84) return 'elite';
  if (overall >= 76) return 'gold';
  if (overall >= 66) return 'silver';
  return 'bronze';
}

function isPlatinumPlayer(player) {
  return playerCardTier(bestNaturalPlayerRating(player)) === 'supreme';
}

function playerCardStats(player, assignedPosition) {
  if (String(assignedPosition || '').toUpperCase() === 'ARQ') {
    return [
      { label: 'ARQ', value: playerCardRating(statValue(player, 'habilidad_arquero')) },
      { label: 'VEL', value: playerCardRating(statValue(player, 'ritmo_stat')) },
      { label: 'DEF', value: playerCardRating(statValue(player, 'solidez')) },
      { label: 'TEC', value: playerCardRating(statValue(player, 'tecnica')) },
      { label: 'EQU', value: playerCardRating(statValue(player, 'compromiso')) },
      { label: 'MEN', value: playerCardRating(statValue(player, 'mentalidad')) },
    ];
  }
  return [
    { label: 'TEC', value: playerCardRating(statValue(player, 'tecnica')) },
    { label: 'VEL', value: playerCardRating(statValue(player, 'ritmo_stat')) },
    { label: 'DEF', value: playerCardRating(statValue(player, 'solidez')) },
    { label: 'ATA', value: playerCardRating(statValue(player, 'ataque')) },
    { label: 'EQU', value: playerCardRating(statValue(player, 'compromiso')) },
    { label: 'MEN', value: playerCardRating(statValue(player, 'mentalidad')) },
  ];
}

function playerPositionRatings(player, assignedPosition = '', teamSize = null) {
  const natural = getOrderedPlayerPositions(player);
  const positions = Array.from(new Set([...natural, String(assignedPosition || '').toUpperCase()].filter((position) => FORMATION_LINES.includes(position))));
  return positions
    .map((position) => ({ position, value: playerCardRating(adjustedPositionRatingForTeamSize(player, position, teamSize)), natural: natural.includes(position) }))
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

function persistedLineupSnapshot(teams, benches, assignments, colors) {
  if (!teams) return '';
  return JSON.stringify(teams.map((team, index) => ({
    color: colors[index],
    players: [...team, ...(benches[index] || [])].map(player => ({
      id: playerKey(player),
      position: assignments[playerKey(player)] || getPrimaryPlayerPosition(player),
      bench: !team.some(starter => playerKey(starter) === playerKey(player)),
      availability: player.availability_percent,
    })),
  })));
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
  if (Number(teamSize) < 8) return fieldPlayers;
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
  const line = pitchLineForPosition(String(position || '').toUpperCase());
  if (line === 'ARQ') return 1;
  if (line === 'DEF') return 2;
  return ['MED', 'DEL'].includes(line) ? 1 : 0;
}

function logicalLineMinimum(position, teamSize) {
  return ['ARQ', 'MED', 'DEL'].includes(String(position || '').toUpperCase()) ? 1 : 0;
}

function logicalLineMinimumForCounts(position, teamSize, counts = {}) {
  return logicalLineMinimum(position, teamSize);
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
  return (!hasGoalkeeperCount || pitchCounts.ARQ === fieldLineMinimum('ARQ', teamSize))
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
  const goalkeeperCandidates = players.filter((player) => getOrderedPlayerPositions(player).includes('ARQ') || player.manualGoalkeeper === true);
  const missing = Math.max(0, numTeams - goalkeeperCandidates.length);
  if (!missing) return { players, emergencyGoalkeepers: [] };
  const field = players.filter((player) => !canPlayGoalkeeper(player));
  const isDefender = player => getOrderedPlayerPositions(player).some(position => pitchLineForPosition(position) === 'DEF');
  let defenders = field.filter(isDefender).length;
  const smallTeams = players.length / Math.max(1, numTeams) < 8;
  const emergencyIds = new Set();
  for (let index = 0; index < missing; index++) {
    const candidate = field.filter(player => !emergencyIds.has(playerKey(player)))
      .sort((a, b) => {
        const protectDefense = smallTeams && defenders <= numTeams * 2;
        return (protectDefense ? Number(isDefender(a)) - Number(isDefender(b)) : 0)
          || bestNaturalPlayerRating(a) - bestNaturalPlayerRating(b);
      })[0];
    if (!candidate) break;
    emergencyIds.add(playerKey(candidate));
    if (isDefender(candidate)) defenders--;
  }
  const prepared = players.map((player) => (emergencyIds.has(playerKey(player)) ? { ...player, emergencyGoalkeeper: true } : player));
  return { players: prepared, emergencyGoalkeepers: prepared.filter((player) => emergencyIds.has(playerKey(player))) };
}

function normalizeAssignments(assignments) {
  return { ...(assignments || {}) };
}

// Armado de formacion: es el calculo mas caro del sorteo y se repite decenas de veces
// por candidato (cada metrica de balance vuelve a pedirlo). Se guarda por equipo y se
// recalcula solo si el plantel cambia; la clave es el propio array del equipo.
const teamAssignmentCache = new WeakMap();

function buildTeamAssignment(team, assignmentOverrides = {}) {
  let hasOverrides = false;
  if (assignmentOverrides) {
    for (const key in assignmentOverrides) {
      if (Object.hasOwn(assignmentOverrides, key)) {
        hasOverrides = true;
        break;
      }
    }
  }
  if (hasOverrides) return buildTeamAssignmentImpl(team, assignmentOverrides);
  const cached = teamAssignmentCache.get(team);
  const rules = team.length ? rosterFormationRuleCache.get(team[0])?.rules : null;
  if (
    cached
    && cached.rules === rules
    && cached.players.length === team.length
    && cached.players.every((player, index) => player === team[index])
  ) {
    return { ...cached.assignments };
  }
  const assignments = buildTeamAssignmentImpl(team, assignmentOverrides);
  teamAssignmentCache.set(team, { players: team.slice(), assignments, rules });
  return assignments;
}

function buildTeamAssignmentImpl(team, assignmentOverrides = {}) {
  // Only permitted field positions participate in automatic formation assignment.
  // Dynamic programming avoids greedy repairs that invent a position or miss a
  // feasible secondary-position combination. States merge equivalent count vectors.
  const fixed = team.filter(isFixedGoalkeeper);
  const rules = team.length ? rosterFormationRuleCache.get(team[0])?.rules : null;
  const keeper = fixed[0] || team.filter(canPlayGoalkeeper).sort((a, b) => goalkeeperSortValue(a) - goalkeeperSortValue(b))[0];
  let states = new Map([['0,0,0', { counts: [0, 0, 0], changes: 0, adaptations: 0, rating: 0, adaptedLines: [0, 0, 0], assignment: keeper ? { [playerKey(keeper)]: 'ARQ' } : {} }]]);
  for (const player of team.slice().sort((a, b) => playerKey(a).localeCompare(playerKey(b)))) {
    if (player === keeper) continue;
    const key = playerKey(player);
    const override = String(assignmentOverrides[key] || '').toUpperCase();
    const allowed = getOrderedPlayerPositions(player).filter(position => position !== 'ARQ');
    // Explicit manual overrides remain supported; automatic generation never uses them.
    const fallback = REQUIRED_FIELD_LINES.filter(line => rules?.[line]?.canAdapt && !allowed.map(pitchLineForPosition).includes(line));
    const positions = FORMATION_LINES.includes(override) ? [override] : [...allowed, ...fallback];
    if (!positions.length) return { ...Object.fromEntries(team.map(p => [playerKey(p), getPrimaryPlayerPosition(p)])), ...(keeper ? { [playerKey(keeper)]: 'ARQ' } : {}) };
    const next = new Map();
    for (const state of states.values()) {
      for (const position of positions) {
        const counts = state.counts.slice();
        const index = REQUIRED_FIELD_LINES.indexOf(pitchLineForPosition(position));
        if (index >= 0) counts[index] += 1;
        const changes = state.changes + (position === getPrimaryPlayerPosition(player) ? 0 : 1);
        const isAdapted = !allowed.map(pitchLineForPosition).includes(pitchLineForPosition(position));
        const adaptations = state.adaptations + Number(isAdapted);
        const adaptedLines = state.adaptedLines.slice();
        if (isAdapted && index >= 0) adaptedLines[index]++;
        const rating = state.rating + adjustedPositionRatingForTeamSize(player, position, team.length);
        const signature = counts.join(',') + ':' + adaptedLines.join(',');
        const existing = next.get(signature);
        if (!existing || adaptations < existing.adaptations || (adaptations === existing.adaptations && (changes < existing.changes || (changes === existing.changes && rating > existing.rating)))) {
          next.set(signature, { counts, changes, adaptations, adaptedLines, rating, assignment: { ...state.assignment, [key]: position } });
        }
      }
    }
    states = next;
  }
  let best = null;
  for (const state of states.values()) {
    const violations = state.counts.reduce((sum, count, index) => sum
      + Math.max(0, (rules?.[REQUIRED_FIELD_LINES[index]]?.minimum ?? fieldLineMinimum(REQUIRED_FIELD_LINES[index], team.length)) - count)
      + Math.max(0, count - (rules?.[REQUIRED_FIELD_LINES[index]]?.maximum ?? maxFieldPlayersPerLine(team.length))), 0);
    const excessAdaptation = state.adaptedLines.reduce((sum, count, index) => sum + (count > 0 ? Math.max(0, state.counts[index] - (rules?.[REQUIRED_FIELD_LINES[index]]?.minimum || 1)) : 0), 0);
    const invalid = violations + excessAdaptation;
    if (!best || invalid < best.violations || (invalid === best.violations && (state.adaptations < best.adaptations || (state.adaptations === best.adaptations && (state.changes < best.changes || (state.changes === best.changes && state.rating > best.rating)))))) best = { ...state, violations: invalid };
  }
  const normalized = normalizeCompactDefenseAssignments(team, best?.assignment || {});
  for (const player of team) {
    const key = playerKey(player);
    const override = String(assignmentOverrides[key] || '').toUpperCase();
    if (FORMATION_LINES.includes(override)) normalized[key] = override;
  }
  return normalized;
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
  if (team.length < 8) return { ...assignments };
  const defensePlayers = team.filter((player) => {
    const assigned = String(assignments[playerKey(player)] || getPrimaryPlayerPosition(player)).toUpperCase();
    return pitchLineForPosition(assigned) === 'DEF';
  });
  if (!defensePlayers.length) return assignments;
  const next = { ...assignments };
  const orderedDefense = defenseLinePlayers(defensePlayers, assignments);
  orderedDefense.forEach((player, index) => {
    const key = playerKey(player);
    if (orderedDefense.length <= 2) {
      next[key] = 'DEF';
      return;
    }
    const isEdge = index === 0 || index === orderedDefense.length - 1;
    next[key] = isEdge ? 'LAT' : 'DEF';
  });
  return next;
}

function normalizeCompactDefenseAssignments(team, assignments = {}) {
  return normalizeDefenseLaneAssignments(team, assignments);
}

function teamScore(team, assignmentOverrides = {}) {
  const assignments = buildTeamAssignment(team, assignmentOverrides);
  return team.reduce((sum, player) => sum + adjustedPositionRatingForTeamSize(player, assignments[playerKey(player)], team.length), 0);
}

function teamTotalsSummary(team, assignmentOverrides = {}) {
  const assignments = buildTeamAssignment(team, assignmentOverrides);
  return {
    adjusted: teamScore(team, assignmentOverrides),
    ataque: average(team, 'ataque'),
    solidez: average(team, 'solidez'),
    ritmo: average(team, 'ritmo_stat'),
    resistencia: average(team, 'resistencia'),
    pase_vision: average(team, 'pase_vision'),
    tecnica: average(team, 'tecnica'),
    compromiso: average(team, 'compromiso'),
    mentalidad: average(team, 'mentalidad'),
    regularidad: average(team, 'regularidad'),
    arquero: team.reduce((max, player) => {
      const assigned = assignments[playerKey(player)];
      return assigned === 'ARQ' ? Math.max(max, adjustedPositionRatingForTeamSize(player, 'ARQ', team.length)) : max;
    }, 0),
  };
}

function manualComparisonMetrics(teams, assignmentOverrides = {}) {
  if (!Array.isArray(teams) || !teams.length) return null;
  const summaries = teams.map((team) => teamTotalsSummary(team, assignmentOverrides));
  const lineStrength = lineStrengthPenalty(teams, assignmentOverrides);
  return {
    total: countSpread(summaries.map((summary) => summary.adjusted)),
    ataque: countSpread(summaries.map((summary) => summary.ataque)),
    pase_vision: countSpread(summaries.map((summary) => summary.pase_vision)),
    ritmo: countSpread(summaries.map((summary) => summary.ritmo)),
    resistencia: countSpread(summaries.map((summary) => summary.resistencia)),
    lineas: lineStrength.spread,
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

function positionBalancePenalty(teams, assignmentOverrides = {}, cachedAssignments = null) {
  if (!teams.length) return 0;
  const teamSize = Math.max(...teams.map((team) => team.length), 0);
  const countsByLine = Object.fromEntries(FIELD_LINES.map((line) => [line, []]));
  let penalty = 0;
  teams.forEach((team, index) => {
    const counts = teamLineCounts(team, cachedAssignments?.[index] || buildTeamAssignment(team, assignmentOverrides));
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
    const tier = playerCardTier(adjustedPositionRatingForTeamSize(player, assigned, team.length));
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

function positionUsePenalty(teams, assignmentOverrides = {}) {
  return teams.reduce((total, team) => {
    const assignments = buildTeamAssignment(team, assignmentOverrides);
    const stats = assignmentPositionUseStats(team, assignments);
    return total + (stats.secondaryCount * 260) + (stats.outOfPositionCount * 1000000);
  }, 0);
}

function TeamRadar({ stats, title = 'Radar del equipo' }) {
  const size = 188;
  const center = 94;
  const radius = 58;
  const labelRadius = 78;
  const pointFor = (index, valueRadius) => {
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / TEAM_RADAR_FIELDS.length);
    return {
      x: center + (Math.cos(angle) * valueRadius),
      y: center + (Math.sin(angle) * valueRadius),
    };
  };
  const polygon = TEAM_RADAR_FIELDS.map(([field], index) => {
    const value = Math.max(1, Math.min(6, Number(stats?.[field] || 1)));
    const point = pointFor(index, radius * (value / 6));
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-2">
      <svg className="mx-auto block h-auto w-full max-w-[220px]" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title}>
        {[2, 4, 6].map((level) => {
          const points = TEAM_RADAR_FIELDS.map((_, index) => {
            const point = pointFor(index, radius * (level / 6));
            return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
          }).join(' ');
          return <polygon key={level} points={points} fill="none" stroke="#d7e6df" strokeWidth="1" />;
        })}
        {TEAM_RADAR_FIELDS.map(([field], index) => {
          const end = pointFor(index, radius);
          const label = pointFor(index, labelRadius);
          const anchor = Math.abs(label.x - center) < 7 ? 'middle' : label.x > center ? 'start' : 'end';
          return (
            <g key={field}>
              <line x1={center} y1={center} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} stroke="#d7e6df" strokeWidth="1" />
              <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor={anchor} dominantBaseline="middle" fill="#526b62" fontSize="9" fontWeight="800">
                {TEAM_RADAR_FIELDS[index][1]}
              </text>
            </g>
          );
        })}
        <polygon points={polygon} fill="rgba(6, 61, 43, 0.18)" stroke="#063d2b" strokeWidth="2" />
        {TEAM_RADAR_FIELDS.map(([field], index) => {
          const value = Math.max(1, Math.min(6, Number(stats?.[field] || 1)));
          const point = pointFor(index, radius * (value / 6));
          return (
            <circle key={field} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="2.8" fill="#063d2b">
              <title>{`${field}: ${value.toFixed(1)}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}

const LINE_STRENGTH_BALANCE_WEIGHTS = { ARQ: 240, DEF: 280, MED: 240, DEL: 260 };
const PROFILE_DISTRIBUTION_FIELDS = ['ataque', 'solidez', 'ritmo_stat', 'resistencia', 'pase_vision', 'tecnica', 'compromiso', 'mentalidad'];

function lineStrengthPenalty(teams, assignmentOverrides = {}) {
  const balance = lineStrengthBalance(teams, assignmentOverrides);
  return { penalty: balance.qualityCost, spread: balance.maxLineGap };
}

function profileDistributionPenalty(teams) {
  if (!teams.length) return { penalty: 0, spread: 0 };
  let penalty = 0;
  let maxSpread = 0;
  PROFILE_DISTRIBUTION_FIELDS.forEach((field) => {
    const strongCounts = teams.map((team) => team.filter((player) => statValue(player, field) >= 4.2).length);
    const weakCounts = teams.map((team) => team.filter((player) => statValue(player, field) <= 2.8).length);
    const strongSpread = countSpread(strongCounts);
    const weakSpread = countSpread(weakCounts);
    maxSpread = Math.max(maxSpread, strongSpread, weakSpread);
    penalty += (strongSpread * 85) + (weakSpread * 45);
  });
  return { penalty, spread: maxSpread };
}

function platinumSpread(teams, assignmentOverrides = {}) {
  if (!teams.length) return 0;
  return countSpread(teams.map((team) => tierCountsForTeam(team, assignmentOverrides).supreme || 0));
}

function lineStrengthBalance(teams, assignmentOverrides = {}, cachedAssignments = null) {
  const assigned = cachedAssignments || teams.map(team => buildTeamAssignment(team, assignmentOverrides));
  const details = {};
  let eliteExcess = 0;
  let strengthGap = 0;
  let positionalBalance = 0;
  let maxLineGap = 0;
  let qualityCost = 0;
  PITCH_LINES.forEach(line => {
    const pools = teams.map((team, index) => team.filter(player => pitchLineForPosition(assigned[index][playerKey(player)]) === line));
    const ratings = pools.map((pool, index) => pool.map(player => adjustedPositionRating(player, assigned[index][playerKey(player)])));
    const counts = pools.map(pool => pool.length);
    const sums = ratings.map(values => values.reduce((sum, value) => sum + value, 0));
    const averages = sums.map((sum, index) => counts[index] ? sum / counts[index] : 0);
    const floors = ratings.map(values => values.length ? Math.min(...values) : 0);
    const peaks = ratings.map(values => values.length ? Math.max(...values) : 0);
    // Compare means, not raw sums: 3/2/2 defenders is a legitimate odd roster.
    const gap = countSpread(averages);
    const floorGap = countSpread(floors);
    const peakGap = countSpread(peaks);
    const countGap = countSpread(counts);
    positionalBalance += countGap * countGap;
    maxLineGap = Math.max(maxLineGap, gap);
    strengthGap += gap / PITCH_LINES.length;
    qualityCost += (LINE_STRENGTH_BALANCE_WEIGHTS[line] / 260) * (gap * gap + 0.15 * (floorGap * floorGap + peakGap * peakGap));
    // Keep natural-line star diagnostics independent of displayed formation.
    const naturalPools = teams.map(team => team.filter(player => !isFixedGoalkeeper(player) && pitchLineForPosition(getPrimaryPlayerPosition(player)) === line));
    const ranked = naturalPools.flat().sort((a, b) => bestNaturalPlayerRating(b) - bestNaturalPlayerRating(a));
    const cutoff = ranked.length ? bestNaturalPlayerRating(ranked[Math.min(teams.length, ranked.length) - 1]) : Infinity;
    const eliteCounts = naturalPools.map(pool => pool.filter(player => bestNaturalPlayerRating(player) >= cutoff - 1e-6).length);
    eliteExcess += Math.max(0, countSpread(eliteCounts) - 1);
    details[line] = { counts, sums, averages, floors, peaks, gap, countGap, floorGap, peakGap, eliteCounts,
      naturalTotals: naturalPools.map(pool => pool.reduce((sum, p) => sum + adjustedPositionRating(p, getPrimaryPlayerPosition(p)), 0)),
      naturalAverages: naturalPools.map(pool => pool.length ? pool.reduce((sum, p) => sum + adjustedPositionRating(p, getPrimaryPlayerPosition(p)), 0) / pool.length : 0), assignedTotals: sums };
  });
  qualityCost += 2 * maxLineGap * maxLineGap;
  return { eliteExcess, strengthGap, positionalBalance, maxLineGap, qualityCost, details };
}

const rosterFormationRuleCache = new WeakMap();
function rosterFormationRules(players, numTeams, teamSize) {
  const cached = players.length ? rosterFormationRuleCache.get(players[0]) : null;
  if (cached && cached.numTeams === numTeams && cached.teamSize === teamSize && cached.players.size === players.length
    && players.every(player => cached.players.has(player))) return cached.rules;
  const field = players.filter(player => !isFixedGoalkeeper(player));
  const eligible = REQUIRED_FIELD_LINES.map(line => field.filter(player => getOrderedPlayerPositions(player).map(pitchLineForPosition).includes(line)).length);
  const preferred = REQUIRED_FIELD_LINES.map((line, index) => Math.min(fieldLineMinimum(line, teamSize), Math.floor(eligible[index] / Math.max(1, numTeams))));
  const unionCapacity = Array.from({ length: 8 }, (_, mask) => field.filter(player => getOrderedPlayerPositions(player)
    .some(position => (mask & (1 << REQUIRED_FIELD_LINES.indexOf(pitchLineForPosition(position)))) !== 0 && position !== 'ARQ')).length);
  // Hall's capacity conditions avoid counting MED/DEL players twice when setting
  // compulsory minima. Prefer coverage of each available line before extra slots.
  let minimum = [0, 0, 0];
  let bestRank = -1;
  for (let def = 0; def <= preferred[0]; def += 1) {
    for (let med = 0; med <= preferred[1]; med += 1) {
      for (let del = 0; del <= preferred[2]; del += 1) {
        const counts = [def, med, del];
        const feasible = unionCapacity.every((capacity, mask) => counts.reduce((sum, count, index) => sum + ((mask & (1 << index)) ? count : 0), 0) * numTeams <= capacity);
        const rank = counts.filter(Boolean).length * 100 + counts.reduce((sum, count) => sum + count, 0);
        if (feasible && rank > bestRank) { minimum = counts; bestRank = rank; }
      }
    }
  }
  const rules = Object.fromEntries(REQUIRED_FIELD_LINES.map((line, index) => [line, {
    minimum: fieldLineMinimum(line, teamSize),
    maximum: Math.max(maxFieldPlayersPerLine(teamSize), Math.ceil(field.filter(player => pitchLineForPosition(getPrimaryPlayerPosition(player)) === line).length / Math.max(1, numTeams))),
    shortage: Math.max(0, fieldLineMinimum(line, teamSize) - minimum[index]),
  }]));
  const required = REQUIRED_FIELD_LINES.map(line => rules[line].minimum * numTeams);
  const deficits = unionCapacity.map((capacity, mask) => Math.max(0,
    required.reduce((sum, count, index) => sum + ((mask & (1 << index)) ? count : 0), 0) - capacity));
  rules.adaptationBudget = Math.max(0, ...deficits);
  REQUIRED_FIELD_LINES.forEach((line, index) => {
    rules[line].canAdapt = deficits.some((deficit, mask) => deficit > 0 && (mask & (1 << index)) !== 0);
  });
  const entry = { numTeams, teamSize, players: new Set(players), rules };
  players.forEach(player => rosterFormationRuleCache.set(player, entry));
  return rules;
}

function generationConstraints(teams, assignments = null) {
  const players = teams.flat();
  const numTeams = teams.length;
  const teamSize = teams[0]?.length || 0;
  const ids = players.map(playerKey);
  const rules = rosterFormationRules(players, numTeams, teamSize);
  const assigned = assignments || teams.map(team => buildTeamAssignment(team));
  const goalkeeperRule = teamsRespectGoalkeepers(teams, assigned);
  const sizes = numTeams >= 2 && numTeams <= 4 && Number.isInteger(teamSize) && teamSize >= 1 && teams.every(team => team.length === teamSize);
  const unique = new Set(ids).size === ids.length;
  let adaptationCount = 0;
  let naturalPositions = teams.every((team, index) => team.every(player => {
    const position = assigned[index][playerKey(player)];
    if (position === 'ARQ') return canPlayGoalkeeper(player);
    const line = pitchLineForPosition(position);
    if (getOrderedPlayerPositions(player).map(pitchLineForPosition).includes(line)) return true;
    adaptationCount++;
    const lineCount = team.filter(p => pitchLineForPosition(assigned[index][playerKey(p)]) === line).length;
    return rules[line]?.canAdapt === true && lineCount <= rules[line].minimum;
  }));
  naturalPositions = naturalPositions && adaptationCount <= rules.adaptationBudget;
  const shortage = {};
  let coverageViolations = 0;
  REQUIRED_FIELD_LINES.forEach(line => {
    const required = rules[line].minimum;
    const maximum = rules[line].maximum;
    shortage[line] = rules[line].shortage;
    teams.forEach((team, index) => {
      const count = team.filter(player => pitchLineForPosition(assigned[index][playerKey(player)]) === line).length;
      coverageViolations += Math.max(0, required - count) + Math.max(0, count - maximum);
    });
  });
  // Preserve the existing platinum rule, using actual positional ratings.
  const platinum = platinumSpread(teams) <= 1;
  const violations = Number(!sizes) + Number(!unique) + Number(!goalkeeperRule) + Number(!naturalPositions) + Number(!platinum) + coverageViolations;
  return { valid: violations === 0, violations, sizes, unique, goalkeeperRule, naturalPositions, platinum, coverageViolations, shortage, adaptationCount, adaptationBudget: rules.adaptationBudget };
}

function scoreTeams(teams, pairHistory, assignmentOverrides = {}, weights = {}) {
  rosterFormationRules(teams.flat(), teams.length, teams[0]?.length || 0);
  const assignments = teams.map((team) => buildTeamAssignment(team, assignmentOverrides));
  const totals = teams.map((team, index) => team.reduce((sum, player) => sum + adjustedPositionRating(player, assignments[index][playerKey(player)]), 0));
  const diff = Math.max(...totals) - Math.min(...totals);
  const slowCounts = teams.map((team) => team.filter(isLowRhythmPlayer).length);
  const slowSpread = Math.max(...slowCounts) - Math.min(...slowCounts);
  const irregularCounts = teams.map((team) => team.filter(isIrregularPlayer).length);
  const irregularSpread = Math.max(...irregularCounts) - Math.min(...irregularCounts);
  const supremeSpread = countSpread(teams.map((team, index) => team.filter((player) => playerCardTier(adjustedPositionRating(player, assignments[index][playerKey(player)])) === 'supreme').length));
  const teamSize = Math.max(...teams.map((team) => team.length), 0);
  const linePenalty = teams.reduce((sum, team, index) => {
    const counts = teamLineCounts(team, assignments[index]);
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
      return team.reduce((total, player) => total + balanceStatValue(player, field), 0);
    });
    return sum + ((Math.max(...values) - Math.min(...values)) * Number(weight || 0));
  }, 0);
  const profileDistribution = profileDistributionPenalty(teams);
  const lineBalance = lineStrengthBalance(teams, assignmentOverrides, assignments);
  const hardConstraints = generationConstraints(teams, assignments);
  const positionalBalance = lineBalance.positionalBalance;
  const secondaryCost = slowSpread * 60 + irregularSpread * 95 + tierBalancePenalty(teams, assignmentOverrides)
    + positionUsePenalty(teams, assignmentOverrides) + profileDistribution.penalty + statPenalty + historicalRepeatPenalty(teams, pairHistory)
    + lineBalance.eliteExcess * 120;
  const totalBalance = countSpread(totals.map((total, index) => teams[index].length ? total / teams[index].length : 0));
  const totalCost = hardConstraints.violations * 1e9 + positionalBalance * 1e6 + lineBalance.qualityCost * 1000 + totalBalance * 100 + secondaryCost;
  return {
    valid: hardConstraints.valid, hardConstraints, hardViolations: hardConstraints.violations,
    value: totalCost, totalCost, secondaryCost, positionalBalance, lineQualityCost: lineBalance.qualityCost,
    maxLineGap: lineBalance.maxLineGap, totalBalance, paceBalance: slowSpread,
    linePenalty, eliteExcess: lineBalance.eliteExcess, balanceScore: lineBalance.qualityCost,
    lineBalance, diff, slowSpread, irregularSpread, platinumSpread: supremeSpread,
    lineStrengthSpread: lineBalance.maxLineGap, profileDistributionSpread: profileDistribution.spread, totals,
    teamMetrics: teams.map((team, index) => ({
      goalkeeperStrength: lineBalance.details.ARQ.averages[index], defenseStrength: lineBalance.details.DEF.averages[index],
      midfieldStrength: lineBalance.details.MED.averages[index], attackStrength: lineBalance.details.DEL.averages[index],
      totalStrength: team.length ? totals[index] / team.length : 0, slowCount: slowCounts[index],
    })),
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
      return adjustedPositionRatingForTeamSize(b, 'ARQ', teamSize) - adjustedPositionRatingForTeamSize(a, 'ARQ', teamSize);
    })
    .slice(0, numTeams - fixedGoalkeepers.length);
  if (fixedGoalkeepers.length + goalkeepers.length < numTeams) return null;
  goalkeepers.forEach((player, index) => teams[fixedGoalkeepers.length + index].push(player));
  const goalkeeperKeys = new Set([...fixedGoalkeepers, ...goalkeepers].map(playerKey));
  const remainingPool = players.filter((player) => !goalkeeperKeys.has(playerKey(player)));
  // Incomplete rosters have no meaningful formation or validity score. Use the
  // same structural/line/total priorities on incremental natural-line summaries,
  // and evaluate full fitness only after every player has been assigned.
  const remaining = shuffle(remainingPool).map(player => ({ player, order: bestNaturalPlayerRating(player) + Math.random() * 0.35 }))
    .sort((a, b) => Number(isPlatinumPlayer(b.player)) - Number(isPlatinumPlayer(a.player)) || b.order - a.order).map(item => item.player);
  const counts = teams.map(() => ({ DEF: 0, MED: 0, DEL: 0 }));
  const sums = teams.map(() => ({ DEF: 0, MED: 0, DEL: 0 }));
  const totals = teams.map(team => adjustedPositionRating(team[0], 'ARQ'));
  const tiers = teams.map(team => team.filter(isPlatinumPlayer).length);
  const slows = teams.map(team => team.filter(isLowRhythmPlayer).length);
  for (const player of remaining) {
    const position = getOrderedPlayerPositions(player).find(position => position !== 'ARQ');
    if (!position) return null;
    const line = pitchLineForPosition(position);
    const rating = adjustedPositionRating(player, position);
    const platinum = isPlatinumPlayer(player);
    const eligible = teams.map((team, index) => index).filter(index => teams[index].length < teamSize);
    const minTier = Math.min(...eligible.map(index => tiers[index]));
    let bestIndex = -1;
    let bestScore = null;
    for (const index of shuffle(eligible)) {
      if (platinum && tiers[index] > minTier) continue;
      counts[index][line] += 1; sums[index][line] += rating; totals[index] += rating;
      const positionalBalance = REQUIRED_FIELD_LINES.reduce((sum, field) => sum + countSpread(counts.map(c => c[field])) ** 2, 0);
      const gaps = REQUIRED_FIELD_LINES.map(field => countSpread(counts.map((c, i) => c[field] ? sums[i][field] / c[field] : 0)));
      const evaluation = { hardViolations: 0, positionalBalance,
        lineQualityCost: gaps.reduce((sum, gap) => sum + gap * gap, 0) + 2 * Math.max(...gaps) ** 2,
        totalBalance: countSpread(totals), secondaryCost: countSpread(slows.map((count, i) => count + Number(i === index && isLowRhythmPlayer(player)))) };
      counts[index][line] -= 1; sums[index][line] -= rating; totals[index] -= rating;
      if (isBetterDraw(evaluation, bestScore)) { bestIndex = index; bestScore = evaluation; }
    }
    if (bestIndex < 0) return null;
    teams[bestIndex].push(player); counts[bestIndex][line] += 1; sums[bestIndex][line] += rating; totals[bestIndex] += rating;
    tiers[bestIndex] += Number(platinum); slows[bestIndex] += Number(isLowRhythmPlayer(player));
  }

  return teams.every((team) => team.length === teamSize) ? teams : null;
}

function isBetterDraw(evaluation, best) {
  if (!best) return true;
  for (const field of ['hardViolations', 'positionalBalance', 'lineQualityCost', 'totalBalance', 'secondaryCost']) {
    const left = Number(evaluation[field] ?? (field === 'totalBalance' ? evaluation.diff : field === 'secondaryCost' ? evaluation.value : 0));
    const right = Number(best[field] ?? (field === 'totalBalance' ? best.diff : field === 'secondaryCost' ? best.value : 0));
    if (Math.abs(left - right) > 1e-6) return left < right;
  }
  return false;
}

// Diversity is allowed only inside this documented, small quality envelope.
function drawsAreNear(evaluation, best) {
  return evaluation.hardViolations === best.hardViolations && evaluation.positionalBalance === best.positionalBalance
    && evaluation.lineQualityCost <= best.lineQualityCost + 0.015
    && evaluation.maxLineGap <= best.maxLineGap + 0.05
    && evaluation.totalBalance <= best.totalBalance + 0.05
    && evaluation.slowSpread <= best.slowSpread && evaluation.irregularSpread <= best.irregularSpread
    && evaluation.secondaryCost <= best.secondaryCost + 30;
}

function selectTopDraw(pool, best, avoidSignatures) {
  const near = pool.filter(item => drawsAreNear(item.evaluation, best.evaluation));
  const fresh = near.filter(item => !avoidSignatures.has(drawSignature(item.teams)));
  const options = fresh.length ? fresh : near;
  return options[Math.floor(Math.random() * options.length)] || best;
}

function collectTopDraw(pool, item, best) {
  const filtered = pool.filter(candidate => drawsAreNear(candidate.evaluation, best.evaluation));
  if (drawsAreNear(item.evaluation, best.evaluation) && !filtered.some(candidate => drawSignature(candidate.teams) === drawSignature(item.teams))) filtered.push(item);
  // Keep diversity bounded without losing the best candidate.
  if (filtered.length > 64) filtered.splice(Math.floor(Math.random() * (filtered.length - 1)), 1);
  return filtered;
}

function* swapSearchSteps(teams, teamSize, pairHistory, weights) {
  let best = teams.map((team) => team.slice());
  let bestEval = scoreTeams(best, pairHistory, {}, weights);
  let changed = true;
  let guard = 0;
  while (changed && guard < 12) {
    changed = false;
    guard += 1;
    for (let a = 0; a < best.length; a += 1) {
      for (let b = a + 1; b < best.length; b += 1) {
        for (let i = 0; i < best[a].length; i += 1) {
          for (let j = 0; j < best[b].length; j += 1) {
            const candidate = best.slice();
            candidate[a] = best[a].slice();
            candidate[b] = best[b].slice();
            [candidate[a][i], candidate[b][j]] = [candidate[b][j], candidate[a][i]];
            if (!candidate.every((team) => team.length === teamSize)) continue;
            if (isFixedGoalkeeper(best[a][i]) !== isFixedGoalkeeper(best[b][j])) continue;
            if (!teamsRespectGoalkeepers(candidate)) continue;
            if (platinumSpread(candidate) > 1) continue;
            const evaluation = scoreTeams(candidate, pairHistory, {}, weights);
            if (isBetterDraw(evaluation, bestEval)) {
              best = candidate;
              bestEval = evaluation;
              changed = true;
            }
            yield;
          }
        }
      }
    }
  }
  return { teams: best, evaluation: bestEval };
}

function improveBySwaps(teams, teamSize, pairHistory, weights) {
  const steps = swapSearchSteps(teams, teamSize, pairHistory, weights);
  let result = steps.next();
  while (!result.done) result = steps.next();
  return result.value;
}

async function improveBySwapsAsync(teams, teamSize, pairHistory, weights, yieldToUi) {
  const steps = swapSearchSteps(teams, teamSize, pairHistory, weights);
  let result = steps.next();
  while (!result.done) {
    await yieldToUi();
    result = steps.next();
  }
  return result.value;
}

function teamsRespectGoalkeepers(teams, assignments = null) {
  const assigned = assignments || teams.map(team => buildTeamAssignment(team));
  const all = teams.flat();
  const fixedCount = all.filter(isFixedGoalkeeper).length;
  const realCount = all.filter(player => getOrderedPlayerPositions(player).includes('ARQ') || player.manualGoalkeeper === true).length;
  return teams.every((team, index) => {
    const fixed = team.filter(isFixedGoalkeeper);
    const keepers = team.filter(player => assigned[index][playerKey(player)] === 'ARQ');
    if (fixed.length > 1 || (fixedCount >= teams.length && fixed.length !== 1) || keepers.length !== 1) return false;
    if (fixed.some(player => assigned[index][playerKey(player)] !== 'ARQ')) return false;
    if (!canPlayGoalkeeper(keepers[0])) return false;
    if (realCount >= teams.length && !getOrderedPlayerPositions(keepers[0]).includes('ARQ') && keepers[0].manualGoalkeeper !== true) return false;
    if (realCount === teams.length && team.filter(player => getOrderedPlayerPositions(player).includes('ARQ') || player.manualGoalkeeper === true).length !== 1) return false;
    return true;
  });
}

function teamsFitFormationRules(teams, teamSize) {
  return teams.every(team => team.length === teamSize) && generationConstraints(teams).valid;
}

// La busqueda del sorteo es intensiva: si corre de un tiron, el navegador se queda
// congelado (y con el, la barra de progreso). Este reloj corta el trabajo en porciones
// y devuelve el control al navegador para que pueda pintar entre medio.
const GENERATION_TIME_SLICE_MS = 60;

function createGenerationClock() {
  let sliceStart = performance.now();
  return async (force = false) => {
    if (!force && performance.now() - sliceStart < GENERATION_TIME_SLICE_MS) return false;
    sliceStart = performance.now();
    await new Promise((resolve) => { window.setTimeout(resolve, 0); });
    return true;
  };
}

async function generateExactTwoTeamCandidate(players, teamSize, maxDiff, pairHistory, weights, avoidSignatures = new Set(), options = {}) {
  const yieldToUi = options.yieldToUi || (async () => false);
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  if (players.length !== teamSize * 2 || players.length > 20 || teamSize < 2) return null;
  let best = null;
  let bestEval = null;
  let evaluatedCandidates = 0;
  let topPool = [];
  const selected = [0];
  const pickedFlags = new Array(players.length).fill(false);
  pickedFlags[0] = true;
  // Los conteos de platinum se mantienen al vuelo (antes se recorria el arreglo entero en
  // cada nodo del arbol, que era la mayor perdida de tiempo del sorteo exacto).
  const platinumFlags = players.map(isPlatinumPlayer);
  const platinumSuffix = new Array(players.length + 1).fill(0);
  for (let index = players.length - 1; index >= 0; index -= 1) {
    platinumSuffix[index] = platinumSuffix[index + 1] + (platinumFlags[index] ? 1 : 0);
  }
  const totalPlatinum = platinumSuffix[0];
  const minPlatinumPerTeam = Math.floor(totalPlatinum / 2);
  const maxPlatinumPerTeam = Math.ceil(totalPlatinum / 2);
  let selectedPlatinum = platinumFlags[0] ? 1 : 0;
  const keeperFlags = players.map(isFixedGoalkeeper);
  const enforceKeeperPruning = keeperFlags.filter(Boolean).length === 2;
  const keeperSuffix = new Array(players.length + 1).fill(0);
  for (let index = players.length - 1; index >= 0; index -= 1) keeperSuffix[index] = keeperSuffix[index + 1] + Number(keeperFlags[index]);
  let selectedKeepers = Number(keeperFlags[0]);

  const visit = async (start) => {
    if (selectedPlatinum > maxPlatinumPerTeam) return;
    if (selectedPlatinum + platinumSuffix[start] < minPlatinumPerTeam) return;
    if (enforceKeeperPruning && (selectedKeepers > 1 || selectedKeepers + keeperSuffix[start] < 1)) return;
    if (selected.length === teamSize) {
      if (selectedPlatinum < minPlatinumPerTeam || selectedPlatinum > maxPlatinumPerTeam) return;
      const left = [];
      const right = [];
      for (let index = 0; index < players.length; index += 1) {
        (pickedFlags[index] ? left : right).push(players[index]);
      }
      const teams = [left, right];
      if (!teamsFitFormationRules(teams, teamSize)) return;
      const evaluationBase = scoreTeams(teams, pairHistory, {}, weights);
      evaluatedCandidates += 1;
      const signature = drawSignature(teams);
      const evaluation = { ...evaluationBase, signature };
      if (isBetterDraw(evaluation, bestEval)) {
        best = teams;
        bestEval = evaluation;
      }
      topPool = collectTopDraw(topPool, { teams, evaluation }, { teams: best, evaluation: bestEval });
      return;
    }

    const remaining = teamSize - selected.length;
    const topLevel = selected.length === 1;
    for (let index = start; index <= players.length - remaining; index += 1) {
      selected.push(index);
      pickedFlags[index] = true;
      if (platinumFlags[index]) selectedPlatinum += 1;
      if (keeperFlags[index]) selectedKeepers += 1;
      await visit(index + 1);
      if (platinumFlags[index]) selectedPlatinum -= 1;
      if (keeperFlags[index]) selectedKeepers -= 1;
      pickedFlags[index] = false;
      selected.pop();
      await yieldToUi();
      if (topLevel && onProgress) {
        onProgress((index - start + 1) / Math.max(1, players.length - remaining - start + 1));
      }
    }
  };

  await visit(1);
  if (!best) return null;
  const selectedDraw = selectTopDraw(topPool, { teams: best, evaluation: bestEval }, avoidSignatures);
  return { ...selectedDraw, bestEvaluation: bestEval, topSolutions: topPool.length, evaluatedCandidates, exhaustive: true, usedMaxDiff: Math.max(maxDiff, selectedDraw.evaluation.diff) };
}

async function generateBalancedTeams(players, numTeams, maxDiff, pairHistory, weights, avoidSignatures = new Set(), options = {}) {
  if (![2, 3, 4].includes(numTeams) || players.length % numTeams !== 0 || new Set(players.map(playerKey)).size !== players.length) return null;
  const pure = players.filter(player => getOrderedPlayerPositions(player).length === 1 && getPrimaryPlayerPosition(player) === 'ARQ');
  if (pure.length > numTeams) return null;
  const pureKeys = new Set(pure.map(playerKey));
  const reserve = [...pure, ...players.filter(player => canPlayGoalkeeper(player) && !pureKeys.has(playerKey(player)))
    .sort((a, b) => goalkeeperSortValue(a) - goalkeeperSortValue(b))].slice(0, numTeams);
  if (reserve.length !== numTeams) return null;
  const reserved = new Set(reserve.map(playerKey));
  players = players.map(player => ({ ...player, reservedGoalkeeper: reserved.has(playerKey(player)) }));
  const teamSize = players.length / numTeams;
  rosterFormationRules(players, numTeams, teamSize);
  const yieldToUi = options.yieldToUi || (async () => false);
  if (numTeams === 2 && players.length <= 20) {
    const exact = await generateExactTwoTeamCandidate(players, teamSize, maxDiff, pairHistory, weights, avoidSignatures, options);
    if (exact) return exact;
  }
  const attempts = Math.min(180, Math.max(120, players.length * 4));
  let best = null;
  let bestEval = null;
  let evaluatedCandidates = 0;
  let topPool = [];
  const finalists = [];
  const consider = (teams, evaluationBase) => {
    if (!teamsFitFormationRules(teams, teamSize)) return;
    evaluatedCandidates += 1;
    const signature = drawSignature(teams);
    const evaluation = { ...evaluationBase, signature };
    if (isBetterDraw(evaluation, bestEval)) {
      best = teams;
      bestEval = evaluation;
    }
    topPool = collectTopDraw(topPool, { teams, evaluation }, { teams: best, evaluation: bestEval });
  };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await yieldToUi();
    options.onProgress?.(attempt / (attempts + 8));
    const candidate = buildCandidateTeams(shuffle(players), numTeams, teamSize, pairHistory, weights);
    if (!candidate) continue;
    const evaluation = scoreTeams(candidate, pairHistory, {}, weights);
    consider(candidate, evaluation);
    const signature = drawSignature(candidate);
    if (!finalists.some(item => drawSignature(item.teams) === signature)) finalists.push({ teams: candidate, evaluation });
    finalists.sort((a, b) => isBetterDraw(a.evaluation, b.evaluation) ? -1 : isBetterDraw(b.evaluation, a.evaluation) ? 1 : 0);
    if (finalists.length > 8) finalists.pop();
  }
  for (let index = 0; index < finalists.length; index += 1) {
    await yieldToUi();
    options.onProgress?.((attempts + index) / (attempts + finalists.length));
    const improved = await improveBySwapsAsync(finalists[index].teams, teamSize, pairHistory, weights, yieldToUi);
    consider(improved.teams, improved.evaluation);
  }
  if (!best) return null;
  const selectedDraw = selectTopDraw(topPool, { teams: best, evaluation: bestEval }, avoidSignatures);
  return { ...selectedDraw, bestEvaluation: bestEval, topSolutions: topPool.length, evaluatedCandidates, exhaustive: false, usedMaxDiff: Math.max(maxDiff, selectedDraw.evaluation.diff) };
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

function assignmentPositionUseStats(team, assignments = {}) {
  return team.reduce((stats, player) => {
    const assigned = String(assignments[playerKey(player)] || getPrimaryPlayerPosition(player)).toUpperCase();
    const naturalPositions = getOrderedPlayerPositions(player);
    const primary = naturalPositions[0] || 'MED';
    if (assigned !== primary) {
      stats.primaryChangeCount += 1;
      if (naturalPositions.includes(assigned)) {
        stats.secondaryCount += 1;
      } else {
        stats.outOfPositionCount += 1;
      }
    }
    return stats;
  }, { primaryChangeCount: 0, secondaryCount: 0, outOfPositionCount: 0 });
}

function primaryPositionScore(player, line) {
  const position = String(line || '').toUpperCase();
  const naturalPositions = getOrderedPlayerPositions(player);
  if ((naturalPositions[0] || '') === position) return 100;
  if (naturalPositions.includes(position)) return 10;
  return 0;
}

function playerCanUseAssignedPosition(player, line) {
  const position = String(line || '').toUpperCase();
  if (position === 'ARQ') return canPlayGoalkeeper(player);
  return getOrderedPlayerPositions(player).includes(position);
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
        if (!lockedLine && line === 'ARQ' && !playerCanUseAssignedPosition(player, line)) return;
        const current = String(baseAssignments[key] || getPrimaryPlayerPosition(player)).toUpperCase();
        const stability = current === line ? 0.35 : 0;
        const score = primaryPositionScore(player, line) + adjustedPositionRatingForTeamSize(player, line, team.length) + stability;
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

// Search complete assignments so a secondary-position chain can free a slot.
// Only the requested pitch line changes by one; one other line supplies/receives it.
function planPitchLineAdjustment(team, baseAssignments, lockedPositions, requestedLine, delta, validate) {
  const line = pitchLineForPosition(requestedLine);
  if (!REQUIRED_FIELD_LINES.includes(line) || ![-1, 1].includes(delta)) return null;
  const current = teamLineCounts(team, baseAssignments);
  const pitchCounts = pitchLineCountsFromLogical(current);
  const targetCount = pitchCounts[line] + delta;
  if (targetCount < fieldLineMinimum(line, team.length) || targetCount > maxFieldPlayersPerLine(team.length)) return null;
  if (pitchCounts.ARQ !== 1) return null;
  let best = null;
  const better = (candidate, previous) => !previous
    || candidate.adapted < previous.adapted
    || (candidate.adapted === previous.adapted && (candidate.changed < previous.changed
      || (candidate.changed === previous.changed && candidate.rating > previous.rating)));
  for (const other of REQUIRED_FIELD_LINES.filter(item => item !== line)) {
    const target = { ...pitchCounts, [line]: targetCount, [other]: pitchCounts[other] - delta };
    if (target[other] < fieldLineMinimum(other, team.length) || target[other] > maxFieldPlayersPerLine(team.length)) continue;
    let states = new Map([['0,0,0', { counts:[0,0,0], adapted:0, changed:0, rating:0, assignment:{} }]]);
    for (const player of team) {
      const key = playerKey(player);
      const assigned = baseAssignments[key];
      const locked = lockedPositions[key];
      if (assigned === 'ARQ') {
        if (locked && locked !== 'ARQ') { states.clear(); break; }
        for (const state of states.values()) state.assignment[key] = 'ARQ';
        continue;
      }
      const roles = locked ? [locked] : FIELD_LINES;
      const next = new Map();
      for (const state of states.values()) for (const role of roles) {
        const index = REQUIRED_FIELD_LINES.indexOf(pitchLineForPosition(role));
        if (index < 0 || state.counts[index] >= target[REQUIRED_FIELD_LINES[index]]) continue;
        const counts = state.counts.slice(); counts[index]++;
        const candidate = {
          counts, assignment:{...state.assignment,[key]:role},
          adapted:state.adapted + Number(!getOrderedPlayerPositions(player).map(pitchLineForPosition).includes(pitchLineForPosition(role))),
          changed:state.changed + Number(role !== assigned),
          rating:state.rating + adjustedPositionRatingForTeamSize(player, role, team.length),
        };
        const signature = counts.join(',');
        if (better(candidate, next.get(signature))) next.set(signature, candidate);
      }
      states = next;
    }
    const candidate = states.get(REQUIRED_FIELD_LINES.map(item => target[item]).join(','));
    if (candidate && fieldLineCountsFitLimits(teamLineCounts(team, candidate.assignment), team.length)
      && validate(candidate.assignment) && better(candidate, best)) best = candidate;
  }
  return best?.assignment || null;
}

function generateTeamFormationVariants(team, baseAssignments = {}, lockedPlayerPositions = {}, targetCount = 3) {
  if (!team?.length) return [];
  const base = buildTeamAssignment(team, baseAssignments);
  const baseSignature = assignmentSignatureForTeam(team, base);
  const seen = new Set([baseSignature]);
  const variants = [];
  const countCandidates = getFormationCandidates(team.length).map((candidate) => {
    const counts = {
      ARQ: 1,
      DEF: candidate.DEF,
      LAT: candidate.LAT,
      MED: candidate.MED,
      DEL: candidate.DEL,
      label: `${candidate.DEF + candidate.LAT}-${candidate.MED}-${candidate.DEL}`,
      balance: candidate.balance,
    };
    return {
      ...counts,
      primaryFit: team.filter((player) => {
        const primary = getPrimaryPlayerPosition(player);
        return primary !== 'ARQ' && FIELD_LINES.includes(primary);
      }).reduce((total, player) => total + (counts[getPrimaryPlayerPosition(player)] > 0 ? 1 : 0), 0),
    };
  });
  countCandidates
    .sort((a, b) => b.primaryFit - a.primaryFit || a.balance - b.balance || b.MED - a.MED || (b.DEF + b.LAT) - (a.DEF + a.LAT))
    .forEach((counts) => {
    const assignmentMap = applyPositionCountsToTeam(team, counts, base, lockedPlayerPositions);
    if (!assignmentMap) return;
    const signature = assignmentSignatureForTeam(team, assignmentMap);
    if (seen.has(signature)) return;
    seen.add(signature);
    const lineCounts = teamLineCounts(team, assignmentMap);
    const positionUse = assignmentPositionUseStats(team, assignmentMap);
    variants.push({
      assignments: assignmentMap,
      signature,
      lineText: formatLineCounts(lineCounts),
      diffCount: assignmentDiffCount(team, base, assignmentMap),
      ...positionUse,
      total: teamTotalsSummary(team, assignmentMap).adjusted,
    });
  });
  const sorted = variants.sort((a, b) => (
    a.primaryChangeCount - b.primaryChangeCount
    || a.secondaryCount - b.secondaryCount
    || a.outOfPositionCount - b.outOfPositionCount
    || Number(b.total || 0) - Number(a.total || 0)
    || a.diffCount - b.diffCount
  ));
  return Number.isFinite(targetCount) ? sorted.slice(0, targetCount) : sorted;
}

function chooseBestFormationVariant(variants = []) {
  if (!variants.length) return null;
  const bestPrimaryChangeCount = Math.min(...variants.map((variant) => Number(variant.primaryChangeCount || 0)));
  const primaryMatches = variants.filter((variant) => Number(variant.primaryChangeCount || 0) === bestPrimaryChangeCount);
  const bestSecondaryCount = Math.min(...primaryMatches.map((variant) => Number(variant.secondaryCount || 0)));
  const secondaryMatches = primaryMatches.filter((variant) => Number(variant.secondaryCount || 0) === bestSecondaryCount);
  const bestOutOfPositionCount = Math.min(...secondaryMatches.map((variant) => Number(variant.outOfPositionCount || 0)));
  const positionMatches = secondaryMatches.filter((variant) => Number(variant.outOfPositionCount || 0) === bestOutOfPositionCount);
  const bestTotal = Math.max(...positionMatches.map((variant) => Number(variant.total || 0)));
  const tied = positionMatches.filter((variant) => Math.abs(Number(variant.total || 0) - bestTotal) < 0.0001);
  return tied[Math.floor(Math.random() * tied.length)] || variants[0];
}

function getFormationCandidates(teamSize) {
  const fieldPlayers = Math.max(0, teamSize - 1);
  const maxPerLine = maxFieldPlayersPerLine(teamSize);
  const minMed = fieldLineMinimum('MED', teamSize);
  const minDel = fieldLineMinimum('DEL', teamSize);
  const candidates = [];
  for (let defenseTotal = fieldLineMinimum('DEF', teamSize); defenseTotal <= Math.min(maxPerLine, fieldPlayers); defenseTotal += 1) {
    const defenseCounts = defenseTotal <= 2
      ? { DEF: defenseTotal, LAT: 0 }
      : { DEF: defenseTotal - 2, LAT: 2 };
    for (let med = minMed; med <= Math.min(maxPerLine, fieldPlayers - defenseTotal); med += 1) {
      const del = fieldPlayers - defenseTotal - med;
      if (del < minDel || del > maxPerLine) continue;
      const counts = { ARQ: 1, ...defenseCounts, MED: med, DEL: del };
      if (!fieldLineCountsFitLimits(counts, teamSize)) continue;
      const values = [defenseTotal, med, del];
      const balance = Math.max(...values) - Math.min(...values);
      candidates.push({ ...defenseCounts, MED: med, DEL: del, value: `${defenseCounts.DEF}-${defenseCounts.LAT}-${med}-${del}`, balance });
    }
  }
  return candidates;
}

function getFormationOptions(teamSize) {
  const candidates = getFormationCandidates(teamSize);
  const preferred = [];
  const addBest = (sorter) => {
    const option = candidates.slice().sort(sorter).find((item) => !preferred.some((selected) => selected.value === item.value));
    if (option) preferred.push(option);
  };

  addBest((a, b) => a.balance - b.balance || b.MED - a.MED || (b.DEF + b.LAT) - (a.DEF + a.LAT) || b.LAT - a.LAT);
  addBest((a, b) => (b.DEF + b.LAT) - (a.DEF + a.LAT) || a.balance - b.balance);
  addBest((a, b) => b.MED - a.MED || a.balance - b.balance);
  addBest((a, b) => b.DEL - a.DEL || a.balance - b.balance);

  const preferredValues = new Set(preferred.map((option) => option.value));
  const remaining = candidates
    .filter((option) => !preferredValues.has(option.value))
    .sort((a, b) => a.balance - b.balance || (b.DEF + b.LAT) - (a.DEF + a.LAT) || b.MED - a.MED || b.DEL - a.DEL);

  return [...preferred, ...remaining];
}

function formationCountsFromValue(team, value) {
  const parsedCounts = parseFormationValue(value);
  if (!parsedCounts) return null;
  const defenseCounts = parsedCounts.LAT === null
    ? splitDefenseFormationCount(team, parsedCounts.DEF)
    : { DEF: parsedCounts.DEF, LAT: parsedCounts.LAT };
  return { ARQ: 1, ...parsedCounts, ...defenseCounts };
}

function getScoredFormationOptions(team, currentAssignments = {}, lockedPlayerPositions = {}) {
  if (!team?.length) return [];
  const base = buildTeamAssignment(team, currentAssignments);
  const options = getFormationOptions(team.length)
    .map((option) => {
      const counts = formationCountsFromValue(team, option.value);
      if (!counts) return null;
      const assignments = applyPositionCountsToTeam(team, counts, base, lockedPlayerPositions);
      if (!assignments) return null;
      return {
        ...option,
        total: teamTotalsSummary(team, assignments).adjusted,
      };
    })
    .filter(Boolean);
  const bestTotal = options.length ? Math.max(...options.map((option) => Number(option.total || 0))) : null;
  return options.map((option) => ({
    ...option,
    recommended: bestTotal !== null && Math.abs(Number(option.total || 0) - bestTotal) < 0.0001,
  }));
}

function formationDisplayValue(option) {
  const defenseTotal = Number(option?.DEF || 0) + Number(option?.LAT || 0);
  return `${defenseTotal}-${Number(option?.MED || 0)}-${Number(option?.DEL || 0)}`;
}

function formationOptionLabel(option) {
  const total = Number(option?.total);
  const value = formationDisplayValue(option);
  const suffix = option?.recommended ? ' - Recomendada' : '';
  return Number.isFinite(total) ? `${value} - ${total.toFixed(1)} pts${suffix}` : value;
}

function getFormationPresetOptions(teamSize) {
  const candidates = getFormationCandidates(teamSize);
  if (!candidates.length) return [];
  const pickBest = (sorter, used = new Set()) => candidates
    .slice()
    .sort(sorter)
    .find((item) => !used.has(item.value)) || null;
  const used = new Set();
  const balanced = pickBest((a, b) => a.balance - b.balance || b.MED - a.MED || (b.DEF + b.LAT) - (a.DEF + a.LAT) || b.LAT - a.LAT, used);
  if (balanced) used.add(balanced.value);
  const defensive = pickBest((a, b) => (b.DEF + b.LAT) - (a.DEF + a.LAT) || a.balance - b.balance || b.MED - a.MED || a.DEL - b.DEL, used);
  if (defensive) used.add(defensive.value);
  const offensive = pickBest((a, b) => b.DEL - a.DEL || a.balance - b.balance || b.MED - a.MED || (a.DEF + a.LAT) - (b.DEF + b.LAT), used);
  return [
    { preset: 'balanced', formation: balanced },
    { preset: 'defensive', formation: defensive },
    { preset: 'offensive', formation: offensive },
  ].filter((option) => option.formation);
}

function formationValueForPreset(teamSize, preset) {
  return getFormationPresetOptions(teamSize).find((option) => option.preset === preset)?.formation?.value || '';
}

function formationValueFromCounts(counts = {}) {
  return `${Number(counts.DEF || 0)}-${Number(counts.LAT || 0)}-${Number(counts.MED || 0)}-${Number(counts.DEL || 0)}`;
}

function teamFormationSelectValue(team, currentAssignments, selectedValue, inferCurrent = false, usePresets = false) {
  if (selectedValue && FORMATION_PRESET_VALUES.has(selectedValue)) {
    return usePresets ? selectedValue : (formationValueForPreset(team.length, selectedValue) || 'auto');
  }
  if (selectedValue && parseFormationValue(selectedValue)) {
    if (!usePresets) return selectedValue;
    const matchedPreset = getFormationPresetOptions(team.length).find((option) => option.formation.value === selectedValue);
    return matchedPreset?.preset || 'custom';
  }
  if (!inferCurrent) return 'auto';
  const value = formationValueFromCounts(teamLineCounts(team, currentAssignments));
  if (!usePresets) return value;
  return getFormationPresetOptions(team.length).find((option) => option.formation.value === value)?.preset || 'custom';
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
  return { DEF: Math.max(0, safeDefenseCount - 2), LAT: 2 };
}

function applyFormationToTeam(team, value) {
  const parsedCounts = parseFormationValue(value);
  if (!parsedCounts) return {};
  const assignments = {};
  const goalkeeper = team.find(isFixedGoalkeeper) || team.slice().sort((a, b) => adjustedPositionRatingForTeamSize(b, 'ARQ', team.length) - adjustedPositionRatingForTeamSize(a, 'ARQ', team.length))[0];
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
        .filter(player => proposedFormationFits({[playerKey(player)]:line}))
        .sort((a, b) => adjustedPositionRatingForTeamSize(b, line, team.length) - adjustedPositionRatingForTeamSize(a, line, team.length))[0];
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

function formationVariantLabel(index) {
  if (index === 0) return 'Recomendada';
  return `Alternativa ${index + 1}`;
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

function PositionPenaltyBubble({ percent }) {
  if (!percent || percent <= 0) return null;
  const label = `-${percent}%`;
  return (
    <span
      className="sorteo-position-penalty"
      role="status"
      aria-label={`Descuento por posicion: ${label}`}
      title={`Descuento por posicion: baja ${percent}% del valor en su mejor posicion`}
    >
      {label}
    </span>
  );
}

function FullPlayerCard({ player, assignedPosition, teamSize = null }) {
  const adjusted = adjustedPositionRatingForTeamSize(player, assignedPosition, teamSize);
  const positionPenalty = positionPenaltyPercent(player, assignedPosition, teamSize);
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
      className="relative mx-auto block aspect-[409/710] w-[168px] overflow-visible border-0 bg-transparent p-0 drop-shadow-[0_7px_12px_rgba(2,14,9,0.22)]"
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
      <PositionPenaltyBubble percent={positionPenalty} />
    </article>
  );
}

export function restorePlayerExchanges(teams, assignments, exchanges, playerId) {
  const affected = new Set([playerId]);
  const undone = new Set();
  // Later exchanges involving either player depend on the earlier exchange.
  exchanges.forEach((exchange, index) => {
    if (affected.has(exchange.sourceKey) || affected.has(exchange.targetKey)) {
      undone.add(index);
      affected.add(exchange.sourceKey);
      affected.add(exchange.targetKey);
    }
  });
  let nextTeams = teams.map(team => team.slice());
  const nextAssignments = { ...assignments };
  [...undone].reverse().forEach(index => {
    const exchange = exchanges[index];
    const players = nextTeams.flat();
    const source = players.find(player => playerKey(player) === exchange.sourceKey);
    const target = players.find(player => playerKey(player) === exchange.targetKey);
    if (!source || !target) return;
    nextTeams = nextTeams.map(team => team.filter(player => ![exchange.sourceKey, exchange.targetKey].includes(playerKey(player))));
    nextTeams[exchange.sourceTeam].splice(exchange.sourceIndex, 0, source);
    nextTeams[exchange.targetTeam].splice(exchange.targetIndex, 0, target);
    nextAssignments[exchange.sourceKey] = exchange.sourcePosition;
    nextAssignments[exchange.targetKey] = exchange.targetPosition;
  });
  return { teams: nextTeams, assignments: nextAssignments, exchanges: exchanges.filter((_, index) => !undone.has(index)) };
}

function CompactPlayerCard({ player, assignedPosition, teamSize = null, laneRole = '', draggableProps = {}, onOpen }) {
  const { dragging = false, selected = false, locked = false, swapTarget = false, ...domDraggableProps } = draggableProps;
  const adjusted = adjustedPositionRatingForTeamSize(player, assignedPosition, teamSize);
  const positionPenalty = positionPenaltyPercent(player, assignedPosition, teamSize);
  const tier = playerCardTier(adjusted);
  const palette = cardPalettes[tier] || cardPalettes.bronze;
  const widthClass = 'gf-player-card';
  const outOfPosition = !getOrderedPlayerPositions(player).includes(assignedPosition);
  const secondary = !outOfPosition && assignedPosition !== getPrimaryPlayerPosition(player);
  const isLateral = String(assignedPosition || '').toUpperCase() === 'LAT' || laneRole === 'lateral';
  const lineGlow = {
    ARQ: { border: '#fbbf24', glow: 'rgba(251,191,36,.55)', glowStrong: 'rgba(251,191,36,.60)', glowMid: 'rgba(251,191,36,.35)' },
    DEF: { border: '#22d3ee', glow: 'rgba(34,211,238,.55)', glowStrong: 'rgba(34,211,238,.60)', glowMid: 'rgba(34,211,238,.35)' },
    MED: { border: '#a3e635', glow: 'rgba(163,230,53,.55)', glowStrong: 'rgba(163,230,53,.60)', glowMid: 'rgba(163,230,53,.35)' },
    LAT: { border: '#22d3ee', glow: 'rgba(34,211,238,.55)', glowStrong: 'rgba(34,211,238,.60)', glowMid: 'rgba(34,211,238,.35)' },
    DEL: { border: '#fb7185', glow: 'rgba(251,113,133,.55)', glowStrong: 'rgba(251,113,133,.60)', glowMid: 'rgba(251,113,133,.35)' },
  }[String(assignedPosition || '').toUpperCase()] || { border: '#a3e635', glow: 'rgba(163,230,53,.55)', glowStrong: 'rgba(163,230,53,.60)', glowMid: 'rgba(163,230,53,.35)' };
  const textShadow = `[text-shadow:0_2px_0_rgba(0,0,0,.78),0_1px_5px_rgba(0,0,0,.46)]`;
  return (
    <button
      type="button"
      className={`relative block ${widthClass} shrink-0 bg-transparent !min-h-0 !rounded-none p-0 text-left transition duration-150 ease-out cursor-grab active:cursor-grabbing ${dragging ? 'opacity-55' : ''} ${selected ? 'ring-2 ring-lime-200 ring-offset-2 ring-offset-emerald-900' : ''} ${locked ? 'ring-2 ring-amber-200 ring-offset-2 ring-offset-emerald-900' : ''} ${swapTarget ? 'z-20 ring-4 ring-lime-200 ring-offset-2 ring-offset-emerald-900' : ''}`}
      style={{
        '--sorteo-card-text': palette.color,
        '--sorteo-card-position': outOfPosition ? '#ffb4a8' : secondary ? '#ffe9a6' : palette.color,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        fontFamily: '"Barlow Condensed", sans-serif',
      }}
      onContextMenu={(event) => event.preventDefault()}
      onSelectStart={(event) => event.preventDefault()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
      aria-label={`Ver ficha de ${player.nombre}`}
      title={`${player.nombre} · ${assignedPosition} · Arrastrá para mover o intercambiar`}
      data-card-tier={tier}
      data-sorteo-player-tier={tier}
      data-lane-role={isLateral ? 'lateral' : undefined}
      {...domDraggableProps}
    >
      <span
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url("${compactCardBackgrounds[tier] || compactCardBackgrounds.bronze}")`,
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
          filter: `drop-shadow(0 0 4px ${lineGlow.glow}) drop-shadow(0 0 10px ${lineGlow.glow}) drop-shadow(0 2px 5px rgba(2,14,9,.45))`,
        }}
        aria-hidden="true"
      />
      {locked ? (
        <span className="absolute right-[5%] top-[4%] z-40 grid h-4 w-4 place-items-center rounded-full border border-[#07130f]/45 bg-amber-200 text-[9px] font-black text-[#07130f]" aria-hidden="true">L</span>
      ) : null}
      {swapTarget ? (
        <span className="absolute inset-0 z-50 grid place-items-center bg-[#063d2b]/80 text-lime-100 ring-4 ring-inset ring-lime-200" aria-hidden="true">
          <span className="grid place-items-center gap-1">
            <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-lime-100 bg-emerald-950 shadow-lg shadow-emerald-950/60 max-[760px]:h-8 max-[760px]:w-8">
              <Icon name="swap" className="h-5 w-5 max-[760px]:h-4 max-[760px]:w-4" />
            </span>
            <span className="rounded-md bg-emerald-950/95 px-2 py-1 text-[11px] font-black uppercase leading-tight text-lime-50 max-[760px]:text-[10px]">Intercambiar</span>
          </span>
        </span>
      ) : null}
      <span className="sorteo-compact-rating absolute left-[8%] top-[9%] z-20 grid justify-items-start gap-px rounded bg-black/45 p-[3%]">
        <strong
          className={`block font-black leading-none ${palette.text} ${textShadow}`}
          style={{ fontSize: 'clamp(5px, 25cqw, 26px)' }}
          data-sorteo-card-text="1"
        >
          {playerCardRating(adjusted)}
        </strong>
        <span className={`flex items-center gap-[2px] font-black uppercase leading-none ${textShadow}`}>
          <span style={{ fontSize: 'clamp(3px, 12cqw, 12px)', color: 'var(--sorteo-card-position)' }} data-sorteo-card-position="1">{assignedPosition}</span>
          <span className="block aspect-square" style={{ width: 'clamp(2px, 6cqw, 7px)', height: 'clamp(2px, 6cqw, 7px)' }}><Arrow form={playerRegularityForm(player)} /></span>
        </span>
      </span>
      <span
        className="sorteo-compact-photo absolute left-[40%] right-[6%] top-[12%] z-[25] flex h-[48%] items-center justify-center overflow-hidden rounded-[40%_40%_34%_34%]"
        data-player-photo-frame={player.has_custom_photo ? '1' : undefined}
      >
        <img className={`h-full w-full ${player.has_custom_photo ? 'object-cover object-center' : 'object-contain object-center opacity-55'}`} src={player.photo_path} alt="" style={playerPhotoPositionStyle(player)} data-player-photo-oval={player.has_custom_photo ? '1' : undefined} />
      </span>
      <PositionPenaltyBubble percent={positionPenalty} />
      <strong
        className={`gf-player-name absolute left-[9%] right-[9%] top-[62%] bottom-[12%] z-30 flex items-center justify-center text-center font-black uppercase leading-none ${palette.text} ${textShadow}`}
        style={{ fontSize: player.nombre.length > 18 ? 'clamp(5px, 9cqw, 12px)' : 'clamp(7px, 13cqw, 14px)' }}
        data-sorteo-card-text="1"
      >
        <span className="gf-player-name-text">{player.nombre}</span>
      </strong>
    </button>
  );
}

function PitchDropMarker({ line, style = null }) {
  const isLateral = String(line || '').toUpperCase() === 'LAT';
  return (
    <span
      className="pointer-events-none absolute top-1/2 z-40 grid aspect-[1000/940] w-[58px] -translate-y-1/2 place-items-center overflow-hidden rounded-lg border-2 border-dashed border-lime-200 bg-[#063d2b]/78 text-lime-100 shadow-[0_0_0_3px_rgba(217,249,157,.28),0_0_22px_rgba(217,249,157,.45)] min-[380px]:w-[64px] sm:w-[70px] xl:w-[82px] 2xl:w-[88px]"
      style={style || undefined}
      data-lane-role={isLateral ? 'lateral' : undefined}
      data-sorteo-drop-marker="1"
      aria-hidden="true"
    >
      <span className="sorteo-drop-pulse absolute inset-0 rounded-lg" aria-hidden="true" />
      {isLateral ? (
        <span className="sorteo-lane-indicator" aria-hidden="true"><span></span><span></span><span></span></span>
      ) : null}
      <span className="relative grid place-items-center gap-1">
        <span className="grid h-8 w-8 place-items-center rounded-full border border-lime-100/90 bg-emerald-950/95 shadow-lg shadow-emerald-950/50 max-[760px]:h-6 max-[760px]:w-6">
          <Icon name="place" className="h-4 w-4 max-[760px]:h-3.5 max-[760px]:w-3.5" />
        </span>
        <span className="rounded-md bg-emerald-950/85 px-1.5 py-0.5 text-[9px] font-black uppercase leading-tight max-[760px]:text-[8px]">Soltar</span>
      </span>
    </span>
  );
}

function defenseInsertRole(currentLineCount, insertIndex) {
  const nextCount = Number(currentLineCount || 0) + 1;
  const boundedIndex = Math.max(0, Math.min(Number(insertIndex || 0), nextCount - 1));
  return nextCount >= 3 && (boundedIndex === 0 || boundedIndex === nextCount - 1) ? 'LAT' : 'DEF';
}

function resolvePageAssetUrl(path, ownerDocument = document) {
  const normalizedPath = String(path || '').replace(/^\/+/, '');
  return new URL(normalizedPath, ownerDocument?.baseURI || window.location.href).href;
}

function cssString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const exportTailwindColorOverrides = `
  --color-red-50: #fef2f2; --color-red-100: #fee2e2; --color-red-200: #fecaca; --color-red-300: #fca5a5; --color-red-500: #ef4444; --color-red-600: #dc2626; --color-red-700: #b91c1c; --color-red-800: #991b1b; --color-red-900: #7f1d1d; --color-red-950: #450a0a;
  --color-orange-500: #f97316;
  --color-amber-50: #fffbeb; --color-amber-100: #fef3c7; --color-amber-200: #fde68a; --color-amber-300: #fcd34d; --color-amber-400: #fbbf24; --color-amber-500: #f59e0b; --color-amber-600: #d97706; --color-amber-700: #b45309; --color-amber-800: #92400e; --color-amber-900: #78350f; --color-amber-950: #451a03;
  --color-lime-50: #f7fee7; --color-lime-100: #ecfccb; --color-lime-200: #d9f99d; --color-lime-300: #bef264; --color-lime-600: #65a30d; --color-lime-950: #1a2e05;
  --color-green-50: #f0fdf4; --color-green-100: #dcfce7; --color-green-200: #bbf7d0; --color-green-500: #22c55e; --color-green-600: #16a34a; --color-green-800: #166534;
  --color-emerald-50: #ecfdf5; --color-emerald-100: #d1fae5; --color-emerald-200: #a7f3d0; --color-emerald-300: #6ee7b7; --color-emerald-400: #34d399; --color-emerald-500: #10b981; --color-emerald-600: #059669; --color-emerald-700: #047857; --color-emerald-800: #065f46; --color-emerald-900: #064e3b; --color-emerald-950: #022c22;
  --color-teal-50: #f0fdfa; --color-teal-200: #99f6e4; --color-teal-800: #115e59;
  --color-cyan-100: #cffafe; --color-cyan-200: #a5f3fc;
  --color-sky-50: #f0f9ff; --color-sky-200: #bae6fd; --color-sky-300: #7dd3fc; --color-sky-500: #0ea5e9; --color-sky-950: #082f49;
  --color-blue-50: #eff6ff; --color-blue-200: #bfdbfe;
  --color-rose-50: #fff1f2; --color-rose-100: #ffe4e6; --color-rose-200: #fecdd3; --color-rose-500: #f43f5e; --color-rose-800: #9f1239;
  --color-slate-50: #f8fafc; --color-slate-100: #f1f5f9; --color-slate-200: #e2e8f0; --color-slate-300: #cbd5e1; --color-slate-400: #94a3b8; --color-slate-500: #64748b; --color-slate-600: #475569; --color-slate-700: #334155; --color-slate-800: #1e293b; --color-slate-900: #0f172a; --color-slate-950: #020617;
  --color-stone-100: #f5f5f4; --color-stone-300: #d6d3d1; --color-stone-900: #1c1917;
`;

function deleteUnsupportedColorRules(ruleList) {
  if (!ruleList) return;
  for (let index = ruleList.length - 1; index >= 0; index -= 1) {
    const rule = ruleList[index];
    const text = rule?.cssText || '';
    if (/(oklch|oklab|color-mix\s*\()/i.test(text)) {
      try {
        ruleList.deleteRule(index);
      } catch {
        // Some grouped browser rules are read-only; leave them alone if deletion fails.
      }
      continue;
    }
    if (rule?.cssRules?.length) deleteUnsupportedColorRules(rule.cssRules);
  }
}

function sanitizeExportStylesheets(clonedDocument) {
  Array.from(clonedDocument.styleSheets || []).forEach((sheet) => {
    try {
      deleteUnsupportedColorRules(sheet.cssRules);
    } catch {
      // Cross-origin stylesheets cannot be inspected; same-origin app CSS is sanitized.
    }
  });
}

const unsupportedColorPattern = /(oklch|oklab|color-mix\s*\()/i;
const exportColorFallbacks = [
  [/white/, [255, 255, 255]],
  [/black/, [0, 0, 0]],
  [/rose-500/, [244, 63, 94]],
  [/rose-200/, [254, 205, 211]],
  [/rose-100/, [255, 228, 230]],
  [/red-200/, [254, 202, 202]],
  [/red-100/, [254, 226, 226]],
  [/red-900/, [127, 29, 29]],
  [/orange-500/, [249, 115, 22]],
  [/amber-300/, [252, 211, 77]],
  [/amber-200/, [253, 230, 138]],
  [/amber-100/, [254, 243, 199]],
  [/lime-300/, [190, 242, 100]],
  [/lime-200/, [217, 249, 157]],
  [/lime-100/, [236, 252, 203]],
  [/cyan-200/, [165, 243, 252]],
  [/cyan-100/, [207, 250, 254]],
  [/sky-500/, [14, 165, 233]],
  [/slate-950/, [2, 6, 23]],
  [/slate-600/, [71, 85, 105]],
  [/slate-500/, [100, 116, 139]],
  [/slate-300/, [203, 213, 225]],
  [/emerald-950/, [2, 44, 34]],
  [/emerald-900/, [6, 78, 59]],
  [/emerald-700/, [4, 120, 87]],
  [/emerald-600/, [5, 150, 105]],
  [/emerald-500/, [16, 185, 129]],
  [/emerald-300/, [110, 231, 183]],
  [/emerald-200/, [167, 243, 208]],
  [/emerald-100/, [209, 250, 229]],
];
const exportColorRgbByName = {
  white: [255, 255, 255],
  black: [0, 0, 0],
  currentcolor: [7, 19, 15],
  'red-50': [254, 242, 242],
  'red-100': [254, 226, 226],
  'red-200': [254, 202, 202],
  'red-300': [252, 165, 165],
  'red-500': [239, 68, 68],
  'red-600': [220, 38, 38],
  'red-700': [185, 28, 28],
  'red-800': [153, 27, 27],
  'red-900': [127, 29, 29],
  'red-950': [69, 10, 10],
  'orange-500': [249, 115, 22],
  'amber-50': [255, 251, 235],
  'amber-100': [254, 243, 199],
  'amber-200': [253, 230, 138],
  'amber-300': [252, 211, 77],
  'amber-400': [251, 191, 36],
  'amber-500': [245, 158, 11],
  'amber-600': [217, 119, 6],
  'amber-700': [180, 83, 9],
  'amber-800': [146, 64, 14],
  'amber-900': [120, 53, 15],
  'amber-950': [69, 26, 3],
  'lime-50': [247, 254, 231],
  'lime-100': [236, 252, 203],
  'lime-200': [217, 249, 157],
  'lime-300': [190, 242, 100],
  'lime-600': [101, 163, 13],
  'lime-950': [26, 46, 5],
  'green-50': [240, 253, 244],
  'green-100': [220, 252, 231],
  'green-200': [187, 247, 208],
  'green-500': [34, 197, 94],
  'green-600': [22, 163, 74],
  'green-800': [22, 101, 52],
  'emerald-50': [236, 253, 245],
  'emerald-100': [209, 250, 229],
  'emerald-200': [167, 243, 208],
  'emerald-300': [110, 231, 183],
  'emerald-400': [52, 211, 153],
  'emerald-500': [16, 185, 129],
  'emerald-600': [5, 150, 105],
  'emerald-700': [4, 120, 87],
  'emerald-800': [6, 95, 70],
  'emerald-900': [6, 78, 59],
  'emerald-950': [2, 44, 34],
  'teal-50': [240, 253, 250],
  'teal-200': [153, 246, 228],
  'teal-800': [17, 94, 89],
  'cyan-100': [207, 250, 254],
  'cyan-200': [165, 243, 252],
  'sky-50': [240, 249, 255],
  'sky-200': [186, 230, 253],
  'sky-300': [125, 211, 252],
  'sky-500': [14, 165, 233],
  'sky-950': [8, 47, 73],
  'blue-50': [239, 246, 255],
  'blue-200': [191, 219, 254],
  'rose-50': [255, 241, 242],
  'rose-100': [255, 228, 230],
  'rose-200': [254, 205, 211],
  'rose-500': [244, 63, 94],
  'rose-800': [159, 18, 57],
  'slate-50': [248, 250, 252],
  'slate-100': [241, 245, 249],
  'slate-200': [226, 232, 240],
  'slate-300': [203, 213, 225],
  'slate-400': [148, 163, 184],
  'slate-500': [100, 116, 139],
  'slate-600': [71, 85, 105],
  'slate-700': [51, 65, 85],
  'slate-800': [30, 41, 59],
  'slate-900': [15, 23, 42],
  'slate-950': [2, 6, 23],
  'stone-100': [245, 245, 244],
  'stone-300': [214, 211, 209],
  'stone-900': [28, 25, 23],
};
const exportStylesheetCache = new Map();

function opacityFromClass(classText, fallback = 1) {
  const match = String(classText || '').match(/\/(\d{1,3})(?![\w-])/);
  if (!match) return fallback;
  return Math.max(0, Math.min(1, Number(match[1]) / 100));
}

function fallbackColorFromClass(classText, fallback = '#07130f') {
  const classes = String(classText || '');
  const matched = exportColorFallbacks.find(([pattern]) => pattern.test(classes));
  if (!matched) return fallback;
  const alpha = opacityFromClass(classes, 1);
  const [red, green, blue] = matched[1];
  return alpha < 1 ? `rgba(${red}, ${green}, ${blue}, ${alpha})` : `rgb(${red}, ${green}, ${blue})`;
}

function rgbaFromRgb(rgb, alpha = 1) {
  const [red, green, blue] = rgb || exportColorRgbByName.currentcolor;
  const boundedAlpha = Math.max(0, Math.min(1, Number(alpha)));
  return boundedAlpha < 1 ? `rgba(${red}, ${green}, ${blue}, ${boundedAlpha})` : `rgb(${red}, ${green}, ${blue})`;
}

function replaceBalancedCssFunctions(cssText, functionName, replacementForInner) {
  let output = '';
  let cursor = 0;
  const needle = `${functionName}(`;
  while (cursor < cssText.length) {
    const start = cssText.indexOf(needle, cursor);
    if (start === -1) {
      output += cssText.slice(cursor);
      break;
    }
    output += cssText.slice(cursor, start);
    let depth = 0;
    let end = start;
    for (; end < cssText.length; end += 1) {
      const char = cssText[end];
      if (char === '(') depth += 1;
      if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    const inner = cssText.slice(start + needle.length, Math.max(start + needle.length, end - 1));
    output += replacementForInner(inner);
    cursor = end;
  }
  return output;
}

function sanitizeCssColorFunctions(cssText) {
  let sanitized = String(cssText || '');
  sanitized = sanitized
    .replace(/url\((['"]?)\.\/images\//g, 'url($1assets/images/')
    .replace(/url\((['"]?)\.\/card-backgrounds\//g, 'url($1assets/card-backgrounds/');
  sanitized = replaceBalancedCssFunctions(sanitized, 'color-mix', (inner) => {
    const variableMatch = inner.match(/var\(--color-([a-z0-9-]+)\)\s+([0-9.]+)%/i);
    if (variableMatch) {
      return rgbaFromRgb(exportColorRgbByName[variableMatch[1]] || exportColorRgbByName.currentcolor, Number(variableMatch[2]) / 100);
    }
    const currentColorMatch = inner.match(/currentcolor\s+([0-9.]+)%/i);
    if (currentColorMatch) return rgbaFromRgb(exportColorRgbByName.currentcolor, Number(currentColorMatch[1]) / 100);
    return 'rgba(7, 19, 15, 0.12)';
  });
  sanitized = replaceBalancedCssFunctions(sanitized, 'oklch', () => '#07130f');
  sanitized = replaceBalancedCssFunctions(sanitized, 'oklab', () => '#07130f');
  return sanitized;
}

async function loadSanitizedExportStylesheets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.href)
    .filter((href) => href && new URL(href, window.location.href).origin === window.location.origin);
  const sheets = await Promise.all(links.map(async (href) => {
    if (exportStylesheetCache.has(href)) return exportStylesheetCache.get(href);
    try {
      const response = await fetch(href, { cache: 'force-cache' });
      const text = response.ok ? await response.text() : '';
      const sanitized = sanitizeCssColorFunctions(text);
      exportStylesheetCache.set(href, sanitized);
      return sanitized;
    } catch {
      return '';
    }
  }));
  const serializedSheets = Array.from(document.styleSheets || []).map((sheet) => {
    try {
      return Array.from(sheet.cssRules || []).map((rule) => rule.cssText || '').join('\n');
    } catch {
      return '';
    }
  });
  return [...sheets, ...serializedSheets.map(sanitizeCssColorFunctions)].filter(Boolean).join('\n');
}

function removeUnsupportedExportStyles(clonedDocument, hasSanitizedStylesheet = false) {
  if (hasSanitizedStylesheet) {
    clonedDocument.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const href = link.getAttribute('href') || '';
      try {
        if (!href || new URL(href, clonedDocument.baseURI).origin === window.location.origin) link.remove();
      } catch {
        link.remove();
      }
    });
  }
  clonedDocument.querySelectorAll('style').forEach((styleNode) => {
    if (unsupportedColorPattern.test(styleNode.textContent || '')) styleNode.remove();
  });
  clonedDocument.querySelectorAll('[style]').forEach((node) => {
    const rawStyle = node.getAttribute('style') || '';
    if (!unsupportedColorPattern.test(rawStyle)) return;
    node.setAttribute('style', sanitizeCssColorFunctions(rawStyle));
  });
}

function scrubUnsupportedComputedColors(clonedDocument) {
  const win = clonedDocument.defaultView;
  const nodes = Array.from(clonedDocument.querySelectorAll('#equipos-generados, #equipos-generados *'));
  const colorProps = ['color', 'textDecorationColor', 'outlineColor', 'caretColor'];
  const borderProps = ['borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'];
  nodes.forEach((node) => {
    const computed = win.getComputedStyle(node);
    const classText = typeof node.className === 'string' ? node.className : String(node.getAttribute('class') || '');
    colorProps.forEach((prop) => {
      if (unsupportedColorPattern.test(computed[prop] || '')) {
        node.style[prop] = fallbackColorFromClass(classText, classText.includes('text-white') ? '#ffffff' : '#07130f');
      }
    });
    borderProps.forEach((prop) => {
      if (unsupportedColorPattern.test(computed[prop] || '')) {
        node.style[prop] = fallbackColorFromClass(classText, classText.includes('border-white') ? 'rgba(255, 255, 255, 0.25)' : '#d7e6df');
      }
    });
    if (unsupportedColorPattern.test(computed.backgroundColor || '')) {
      node.style.backgroundColor = fallbackColorFromClass(classText, 'transparent');
    }
    if (unsupportedColorPattern.test(computed.boxShadow || '')) node.style.boxShadow = 'none';
    if (unsupportedColorPattern.test(computed.textShadow || '')) node.style.textShadow = 'none';
    if (unsupportedColorPattern.test(computed.fill || '')) node.style.fill = 'currentColor';
    if (unsupportedColorPattern.test(computed.stroke || '')) node.style.stroke = 'currentColor';
  });
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function waitForImage(image) {
  if (!image || (image.complete && image.naturalWidth > 0)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      image.removeEventListener('load', finish);
      image.removeEventListener('error', finish);
      resolve();
    };
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
    setTimeout(finish, 2500);
  });
}

function preloadExportImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
    if (image.decode) image.decode().then(resolve).catch(resolve);
  });
}

async function waitForExportReadiness(root) {
  await document.fonts?.ready?.catch?.(() => {});
  const imageNodes = Array.from(root.querySelectorAll('img'));
  const backgroundUrls = [
    resolvePageAssetUrl('assets/images/captain-field-bg-vertical.jpg'),
    ...Object.values(cardBackgrounds).map((path) => resolvePageAssetUrl(path)),
    ...Object.values(compactCardBackgrounds).map((path) => resolvePageAssetUrl(path)),
  ];
  await Promise.all([
    ...imageNodes.map(waitForImage),
    ...backgroundUrls.map(preloadExportImage),
  ]);
  await waitForPaint();
}

function injectFormationExportStyles(clonedDocument, sanitizedStylesheet = '') {
  sanitizeExportStylesheets(clonedDocument);
  removeUnsupportedExportStyles(clonedDocument, Boolean(sanitizedStylesheet));
  if (sanitizedStylesheet) {
    const sanitizedStyle = clonedDocument.createElement('style');
    sanitizedStyle.textContent = sanitizedStylesheet;
    clonedDocument.head.appendChild(sanitizedStyle);
  }
  const style = clonedDocument.createElement('style');
  style.textContent = `
    :root, :host { ${exportTailwindColorOverrides} }
    body { ${exportTailwindColorOverrides} }
    #equipos-generados, #equipos-generados * { ${exportTailwindColorOverrides} }
    #equipos-generados, #equipos-generados * {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
    #equipos-generados [data-sorteo-drag-player],
    #equipos-generados [data-sorteo-line-player-item="1"] {
      transform: none !important;
      opacity: 1 !important;
    }
    #equipos-generados .formation-card-preview-overlay { display: none !important; }
    /* html2canvas dibuja las sombras exteriores como un marco gris alrededor de cada
       caja (bien visible sobre el titulo y las tarjetas), asi que en la captura se
       dibujan sin sombra. */
    #equipos-generados,
    #equipos-generados * { box-shadow: none !important; }
    /* html2canvas dibuja el texto un par de pixeles mas abajo que el navegador y los
       titulos con recorte (truncate) salian cortados por abajo en la captura. Los
       nombres de equipo son cortos, asi que alcanza con no recortarlos. */
    #equipos-generados .team-head h3 { overflow: visible !important; }
  `;
  clonedDocument.head.appendChild(style);
  scrubUnsupportedComputedColors(clonedDocument);
  replaceExportSelectsWithStaticText(clonedDocument);
}

/**
 * html2canvas pinta el valor de los <select> con su propia cuenta de linea y lo recorta
 * contra la caja, asi que en la captura el texto salia cortado por abajo. Para la imagen
 * se reemplazan por un bloque con el mismo aspecto y el texto completo.
 */
function replaceExportSelectsWithStaticText(clonedDocument) {
  const selectors = Array.from(clonedDocument.querySelectorAll('#equipos-generados select'));
  selectors.forEach((select) => {
    const styles = clonedDocument.defaultView.getComputedStyle(select);
    const rect = select.getBoundingClientRect();
    const value = select.options?.[select.selectedIndex]?.text || '';
    const replacement = clonedDocument.createElement('div');
    replacement.className = select.className;
    replacement.setAttribute('data-export-select-value', '1');
    replacement.textContent = value;
    replacement.style.setProperty('display', 'flex', 'important');
    replacement.style.setProperty('align-items', 'center', 'important');
    replacement.style.setProperty('justify-content', 'flex-start', 'important');
    replacement.style.setProperty('box-sizing', 'border-box', 'important');
    replacement.style.setProperty('width', '100%', 'important');
    replacement.style.setProperty('min-height', `${Math.round(rect.height)}px`, 'important');
    replacement.style.setProperty('padding', `${styles.paddingTop} ${styles.paddingRight} ${styles.paddingBottom} ${styles.paddingLeft}`, 'important');
    replacement.style.setProperty('font-family', styles.fontFamily, 'important');
    replacement.style.setProperty('font-size', styles.fontSize, 'important');
    replacement.style.setProperty('font-weight', styles.fontWeight, 'important');
    replacement.style.setProperty('line-height', '1.2', 'important');
    replacement.style.setProperty('color', styles.color, 'important');
    replacement.style.setProperty('background-color', styles.backgroundColor, 'important');
    replacement.style.setProperty('border-radius', styles.borderRadius, 'important');
    replacement.style.setProperty('border', `${styles.borderWidth} ${styles.borderStyle} ${styles.borderColor}`, 'important');
    select.replaceWith(replacement);
  });
}

/**
 * En pantallas chicas la cancha se muestra en un carrusel horizontal: capturar ese
 * carrusel tal cual queda producia una tira ancha con las dos canchas aplastadas.
 * Para exportar una imagen fiel se apilan los equipos uno debajo del otro con el
 * mismo ancho que tienen en pantalla, asi que hay que recalcular el alto del lienzo.
 */
function stackedMobileExportHeight(target, scroller) {
  if (!target || !scroller) return null;
  const cards = Array.from(scroller.querySelectorAll('[data-sorteo-team-card]'));
  if (cards.length < 2) return null;
  const targetGap = Number.parseFloat(window.getComputedStyle(target).rowGap) || 0;
  const scrollerGap = Number.parseFloat(window.getComputedStyle(scroller).rowGap) || 0;
  const stackedScrollerHeight = cards.reduce(
    (total, card) => total + card.getBoundingClientRect().height,
    0,
  ) + scrollerGap * (cards.length - 1);
  // html2canvas descarta los bloques marcados con data-html2canvas-ignore, por eso el
  // alto se calcula solo con los hijos que realmente se dibujan.
  const visibleChildren = Array.from(target.children).filter((child) => (
    child.getAttribute('data-html2canvas-ignore') !== 'true'
    && window.getComputedStyle(child).display !== 'none'
  ));
  return Math.ceil(visibleChildren.reduce((total, child, index) => (
    total
    + (child === scroller ? stackedScrollerHeight : child.getBoundingClientRect().height)
    + (index > 0 ? targetGap : 0)
  ), 0));
}

function applyStackedMobileExportLayout(clonedDocument, exportWidth) {
  const clonedTarget = clonedDocument.querySelector('#equipos-generados');
  const clonedScroller = clonedDocument.querySelector('[data-teams-scroller]');
  if (!clonedTarget || !clonedScroller) return;
  clonedTarget.style.setProperty('width', `${exportWidth}px`, 'important');
  clonedScroller.style.setProperty('grid-auto-flow', 'row', 'important');
  clonedScroller.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
  clonedScroller.style.setProperty('grid-auto-columns', 'minmax(0, 1fr)', 'important');
  clonedScroller.style.setProperty('grid-auto-rows', 'auto', 'important');
  clonedScroller.style.setProperty('width', '100%', 'important');
  clonedScroller.style.setProperty('overflow', 'visible', 'important');
  clonedScroller.style.setProperty('scroll-snap-type', 'none', 'important');
  clonedScroller.style.setProperty('padding-bottom', '0px', 'important');
  clonedScroller.scrollLeft = 0;
  Array.from(clonedScroller.querySelectorAll('[data-sorteo-team-card]')).forEach((card) => {
    card.style.setProperty('width', '100%', 'important');
    card.style.setProperty('min-width', '0', 'important');
    card.style.setProperty('scroll-snap-align', 'none', 'important');
  });
}

function hexToRgbChannels(hex) {
  const value = String(hex || '').replace('#', '');
  const normalized = value.length === 3 ? value.split('').map((char) => char + char).join('') : value;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16) || 0,
    g: Number.parseInt(normalized.slice(2, 4), 16) || 0,
    b: Number.parseInt(normalized.slice(4, 6), 16) || 0,
  };
}

// html2canvas deja una marca gris pegada a los bordes del lienzo (se ve como una barra
// sobre el borde derecho y otra sobre el izquierdo). Se dibuja con este margen extra y
// despues se recorta, asi la captura queda limpia.
const EXPORT_EDGE_PADDING = 40;

function cropExportCanvas(canvas, exportWidth, scale) {
  const offset = Math.max(0, Math.round(EXPORT_EDGE_PADDING * scale));
  const width = Math.min(Math.round(exportWidth * scale), canvas.width - offset * 2);
  const height = Math.max(1, canvas.height - offset);
  if (width <= 0 || (offset === 0 && width === canvas.width && height === canvas.height)) return canvas;
  const cropped = canvas.ownerDocument.createElement('canvas');
  cropped.width = width;
  cropped.height = height;
  const context = cropped.getContext('2d');
  if (!context) return canvas;
  context.drawImage(canvas, offset, offset, width, height, 0, 0, width, height);
  return cropped;
}

/**
 * El alto del lienzo se calcula con un margen para no cortar contenido; este recorte
 * quita la franja de fondo sobrante para que la captura quede ajustada al contenido.
 */
function trimExportCanvas(canvas, backgroundHex) {
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const background = hexToRgbChannels(backgroundHex);
  const { width, height } = canvas;
  let pixels;
  try {
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return canvas;
  }
  const rowHasContent = (row) => {
    const offset = row * width * 4;
    for (let x = 0; x < width; x += 1) {
      const index = offset + x * 4;
      if (
        Math.abs(pixels[index] - background.r) > 4
        || Math.abs(pixels[index + 1] - background.g) > 4
        || Math.abs(pixels[index + 2] - background.b) > 4
      ) return true;
    }
    return false;
  };
  let lastContentRow = height - 1;
  while (lastContentRow > 0 && !rowHasContent(lastContentRow)) lastContentRow -= 1;
  if (!rowHasContent(lastContentRow)) return canvas;
  const trimmedHeight = Math.min(height, lastContentRow + 1 + 16);
  if (trimmedHeight >= height) return canvas;
  const trimmed = canvas.ownerDocument.createElement('canvas');
  trimmed.width = width;
  trimmed.height = trimmedHeight;
  trimmed.getContext('2d').drawImage(canvas, 0, 0);
  return trimmed;
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
            Velocidad
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
  const [teams, setTeams] = useState(() => (initialTeams.length ? initialTeams.map(team => team.filter(player => !Number(player.is_substitute))) : null));
  const [benches, setBenches] = useState(() => Object.fromEntries(initialTeams.map((team, index) => [index, team.filter(player => Number(player.is_substitute))])));
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
  const [playerExchanges, setPlayerExchanges] = useState([]);
  const [error, setError] = useState(payload.loadError);
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [exchangeFilter, setExchangeFilter] = useState('same');
  const [dragState, setDragState] = useState(null);
  const [dragHoverTarget, setDragHoverTarget] = useState(null);
  const [persistedRedrawCount, setPersistedRedrawCount] = useState(payload.redrawCount);
  const [redrawsUsedThisSession, setRedrawsUsedThisSession] = useState(0);
  const [hasSavedDraw, setHasSavedDraw] = useState(payload.hasSavedDraw);
  const [generatedOnce, setGeneratedOnce] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [playersPanelOpen, setPlayersPanelOpen] = useState(() => !initialTeams.length && !payload.players.length);
  const [goalkeeperPanelOpen, setGoalkeeperPanelOpen] = useState(() => !initialTeams.length && Object.keys(initialManualGoalkeepers(payload.players.map(normalizePlayer))).length < payload.numTeams);
  const [saveState, setSaveState] = useState(() => (initialTeams.length ? 'saved' : 'idle'));
  const [savingDraw, setSavingDraw] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState(() => initialTeams.length ? persistedLineupSnapshot(teams, benches, initialAssignments, teamColors) : '');
  const savedRosterSignature = useRef(payload.savedDrawSignature || (initialTeams.length ? drawSignature(initialTeams) : ''));
  const lineupSnapshot = useMemo(() => persistedLineupSnapshot(teams, benches, assignments, teamColors), [teams, benches, assignments, teamColors]);
  const workflowSaveState = teams ? (lineupSnapshot === savedSnapshot ? 'saved' : 'dirty') : 'idle';
  const formationsUrl = payload.links?.finish ? `${payload.links.finish}&edit_formations=1#formaciones` : '';
  const formationsReady = hasSavedDraw && workflowSaveState === 'saved';
  const [manualActionCount, setManualActionCount] = useState(0);
  const [mobileMoveSource, setMobileMoveSource] = useState(null);
  const [manualComparisonBefore, setManualComparisonBefore] = useState(null);
  const [lockedPlayerPositions, setLockedPlayerPositions] = useState({});
  const [drawVariants, setDrawVariants] = useState({});
  const [activeFormationVariants, setActiveFormationVariants] = useState({});
  const seenDrawSignatures = useRef(new Set(payload.savedDrawSignature ? [payload.savedDrawSignature] : []));
  const teamsContainerRef = useRef(null);
  const teamsFocusRef = useRef(null);
  const teamsScrollerRef = useRef(null);
  const [visibleTeamIndex, setVisibleTeamIndex] = useState(0);
  const [showBothTeams, setShowBothTeams] = useState(true);
  const edgeScrollStepRef = useRef(null);
  const pointerDragRef = useRef({
    active: false,
    hoverTarget: null,
    source: null,
    startX: 0,
    startY: 0,
    suppressClick: false,
    timer: null,
  });

  const updateDragHoverTarget = useCallback((nextTarget) => {
    pointerDragRef.current.hoverTarget = nextTarget;
    setDragHoverTarget((current) => {
      // La posicion horizontal exacta del marcador no entra en la comparacion: se aplica
      // directo sobre el DOM para no re-renderizar la cancha en cada movimiento.
      const currentKey = current
        ? `${current.teamIndex}|${current.line || ''}|${current.targetLine || ''}|${current.playerKey || ''}|${current.insertIndex ?? ''}`
        : '';
      const nextKey = nextTarget
        ? `${nextTarget.teamIndex}|${nextTarget.line || ''}|${nextTarget.targetLine || ''}|${nextTarget.playerKey || ''}|${nextTarget.insertIndex ?? ''}`
        : '';
      return currentKey === nextKey ? current : nextTarget;
    });
  }, []);

  const dragPointRef = useRef(null);
  const dragGhostRef = useRef(null);
  const dragMarkerRef = useRef(null);
  const dragFrameRef = useRef({ frame: 0, x: 0, y: 0 });

  const positionDragGhost = useCallback((clientX, clientY) => {
    dragPointRef.current = { x: clientX, y: clientY };
    const ghost = dragGhostRef.current;
    if (ghost) {
      ghost.style.transform = `translate3d(${Math.round(clientX + 16)}px, ${Math.round(clientY - 8)}px, 0)`;
    }
  }, []);

  const applyDropMarkerPosition = useCallback(() => {
    const marker = dragMarkerRef.current;
    if (!marker) return;
    // La variable se escribe sobre el propio marcador (no sobre la linea) para que el
    // navegador no recalcule el estilo de todas las cartas de esa linea.
    const node = document.querySelector('[data-sorteo-drop-marker="1"]');
    if (node) node.style.setProperty('--sorteo-drop-x', `${Math.round(marker.x)}px`);
  }, []);

  const scheduleDragHoverUpdate = useCallback((clientX, clientY) => {
    positionDragGhost(clientX, clientY);
    const state = dragFrameRef.current;
    state.x = clientX;
    state.y = clientY;
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      updatePointerDragHoverRef.current?.(state.x, state.y);
      applyDropMarkerPosition();
    });
  }, [applyDropMarkerPosition, positionDragGhost]);

  const selectedPlayers = useMemo(() => (lockedMatch ? players.slice() : players.filter((player) => player.selected)), [lockedMatch, players]);
  const playersPerTeam = useMemo(() => {
    if (teams?.length) {
      const totalPlayers = teams.reduce((sum, team) => sum + team.length, 0);
      return Math.max(1, Math.ceil(totalPlayers / teams.length));
    }
    return Math.max(1, Math.ceil(selectedPlayers.length / Math.max(1, numTeams)));
  }, [numTeams, selectedPlayers.length, teams]);
  const selectedGoalkeepers = useMemo(
    () => selectedPlayers.filter((player) => manualGoalkeepers[playerKey(player)] === true),
    [manualGoalkeepers, selectedPlayers],
  );
  const preparationGoalkeepers = teams ? teams.flat().filter(player => (assignments[playerKey(player)] || player.assigned_position || getPrimaryPlayerPosition(player)) === 'ARQ') : selectedGoalkeepers;
  const preparationGoalkeepersReady = preparationGoalkeepers.length === numTeams;
  const goalkeeperLimitReached = selectedGoalkeepers.length >= numTeams;
  const availabilityAdjustedCount = useMemo(
    () => selectedPlayers.filter((player) => Number(player.availability_percent || 100) < 100).length,
    [selectedPlayers],
  );
  const goalkeeperSummary = preparationGoalkeepers.length
    ? preparationGoalkeepers.map((player) => player.nombre).join(' / ')
    : 'Sin definir';
  const selectedAverageRating = useMemo(() => {
    if (!selectedPlayers.length) return 0;
    const total = selectedPlayers.reduce((sum, player) => sum + Number(player.puntuacion || 0), 0);
    return total / selectedPlayers.length;
  }, [selectedPlayers]);
  const nextGenerationIsRedraw = lockedMatch && (hasSavedDraw || generatedOnce || Boolean(teams));
  const redrawsRemaining = Math.max(0, payload.redrawLimit - persistedRedrawCount - redrawsUsedThisSession);
  const drawReadiness = useMemo(() => {
    const issues = [];
    const warnings = [];
    const selectedCount = selectedPlayers.length;
    const teamSize = selectedCount > 0 && selectedCount % Math.max(1, numTeams) === 0
      ? selectedCount / Math.max(1, numTeams)
      : null;
    if (!selectedCount) {
      issues.push('Selecciona al menos un jugador.');
    } else if (selectedCount % Math.max(1, numTeams) !== 0) {
      issues.push(`${selectedCount} jugadores no se dividen parejo en ${numTeams} equipos.`);
    } else if (teamSize < 5) {
      issues.push(`${teamSize} por equipo no alcanza para una formacion valida.`);
    }
    if (selectedGoalkeepers.length > numTeams) {
      warnings.push(`Hay ${selectedGoalkeepers.length} arqueros para ${numTeams} equipos; se reservara uno por equipo y los polivalentes restantes jugaran en una posicion de campo permitida.`);
    } else if (selectedGoalkeepers.length < numTeams) {
      warnings.push(`Faltan ${numTeams - selectedGoalkeepers.length} arquero${numTeams - selectedGoalkeepers.length === 1 ? '' : 's'} manual${numTeams - selectedGoalkeepers.length === 1 ? '' : 'es'}.`);
    }
    const pureGoalkeepers = selectedPlayers.filter((player) => getOrderedPlayerPositions(player).length === 1 && getPrimaryPlayerPosition(player) === 'ARQ');
    if (pureGoalkeepers.length > numTeams) {
      issues.push(`Hay ${pureGoalkeepers.length} arqueros puros para ${numTeams} equipos.`);
    }
    if (nextGenerationIsRedraw && !payload.allowRedraw) {
      issues.push('Esta fecha no permite rehacer el sorteo.');
    } else if (nextGenerationIsRedraw && redrawsRemaining <= 0) {
      issues.push(`Ya se usaron los ${payload.redrawLimit} re-sorteos permitidos.`);
    }
    if (availabilityAdjustedCount > 0) {
      warnings.push(`${availabilityAdjustedCount} jugador${availabilityAdjustedCount === 1 ? '' : 'es'} con estado menor a 100%.`);
    }
    return {
      issues,
      warnings,
      ready: issues.length === 0,
      teamSizeLabel: teamSize ? `${teamSize} por equipo` : 'Sin dividir',
    };
  }, [availabilityAdjustedCount, nextGenerationIsRedraw, numTeams, payload.allowRedraw, payload.redrawLimit, redrawsRemaining, selectedGoalkeepers.length, selectedPlayers]);

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

  const generateButtonLabel = nextGenerationIsRedraw ? `Rehacer sorteo (${redrawsRemaining} restantes)` : 'Generar equipos';
  const generateDisabled = generating || !drawReadiness.ready || (nextGenerationIsRedraw && (!payload.allowRedraw || redrawsRemaining <= 0));
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

  const teamColorAccentHex = useCallback((teamIndex) => {
    return getTeamColor(teamIndex)?.accentHex || '#16a34a';
  }, [getTeamColor]);

  const getTeamDisplayName = useCallback((teamIndex) => {
    const color = getTeamColor(teamIndex);
    return `Equipo ${color.label}`;
  }, [getTeamColor]);

  const persistPlayerAvailability = useCallback(async (playerId, percent) => {
    if (!payload.matchId) return;
    try {
      const response = await fetch('guardar_estado_jugadores.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          match_id: payload.matchId,
          players: [{ id: playerId, availability_percent: normalizeAvailabilityPercent(percent) }],
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'No se pudo guardar el estado del jugador.');
      setError('');
    } catch (availabilityError) {
      setSuccess('');
      setError(availabilityError.message || 'No se pudo guardar el estado del jugador.');
    }
  }, [payload.matchId]);

  const markDrawDirty = useCallback((countManualAction = true) => {
    if (!teams) return;
    setSaveState('dirty');
    if (countManualAction) setManualActionCount((value) => value + 1);
  }, [teams]);

  const updatePlayerAvailability = useCallback((player, percent, persist = false) => {
    const key = playerKey(player);
    const nextPercent = normalizeAvailabilityPercent(percent);
    const updateOne = (item) => (playerKey(item) === key ? normalizePlayer({ ...item, availability_percent: nextPercent }, 0) : item);
    setPlayers((current) => current.map(updateOne));
    setTeams((current) => (current ? current.map((team) => team.map(updateOne)) : current));
    setBenches(current => Object.fromEntries(Object.entries(current).map(([index, reserve]) => [index, reserve.map(updateOne)])));
    if (persist && Number(player.id) > 0) {
      if (teams) markDrawDirty(true);
      persistPlayerAvailability(player.id, nextPercent);
    }
  }, [markDrawDirty, persistPlayerAvailability, teams]);

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
        [key]: [...stack, { teams: teams ? teams.map((team) => team.slice()) : null, assignments: { ...assignments }, teamFormations: { ...teamFormations }, playerExchanges, benches, lockedPlayerPositions, drawVariants, activeFormationVariants }].slice(-8),
      };
    });
  }, [assignments, teamFormations, teams, playerExchanges, benches, lockedPlayerPositions, drawVariants, activeFormationVariants]);

  const undoTeam = (teamIndex) => {
    const key = String(teamIndex);
    const stack = undoStacks[key] || [];
    const snapshot = stack[stack.length - 1];
    if (!snapshot) return;
    setTeams(snapshot.teams);
    setBenches(snapshot.benches || {});
    setDrawVariants(snapshot.drawVariants || {});
    setActiveFormationVariants(snapshot.activeFormationVariants || {});
    setLockedPlayerPositions(snapshot.lockedPlayerPositions || {});
    setAssignments(snapshot.assignments || {});
    setTeamFormations(snapshot.teamFormations || {});
    setPlayerExchanges(snapshot.playerExchanges || []);
    setMobileMoveSource(null);
    setSaveState('dirty');
    setManualActionCount((value) => Math.max(0, value - 1));
    setUndoStacks((current) => ({ ...current, [key]: stack.slice(0, -1) }));
  };

  const applyDefaultFormationVariants = useCallback((sourceTeams, baseAssignments = {}, lockedOverrides = lockedPlayerPositions, preserveGenerated = false) => {
    if (!sourceTeams?.length) {
      setDrawVariants({});
      setActiveFormationVariants({});
      setAssignments(baseAssignments);
      return 0;
    }
    const variantsByTeam = Object.fromEntries(sourceTeams.map((team, teamIndex) => [
      String(teamIndex),
      generateTeamFormationVariants(team, baseAssignments, lockedOverrides, Number.POSITIVE_INFINITY),
    ]));
    const defaultVariantsByTeam = Object.fromEntries(
      Object.entries(variantsByTeam)
        .map(([teamIndex, variants]) => {
          if (!preserveGenerated) return [teamIndex, chooseBestFormationVariant(variants)];
          const team = sourceTeams[Number(teamIndex)];
          const base = buildTeamAssignment(team, baseAssignments);
          const signature = assignmentSignatureForTeam(team, base);
          const initial = { assignments: base, signature, lineText: formatLineCounts(teamLineCounts(team, base)), diffCount: 0,
            ...assignmentPositionUseStats(team, base), total: teamTotalsSummary(team, base).adjusted };
          return [teamIndex, initial];
        })
        .filter(([, variant]) => Boolean(variant)),
    );
    setDrawVariants(Object.fromEntries(
      Object.entries(variantsByTeam).map(([teamIndex, variants]) => {
        const defaultVariant = defaultVariantsByTeam[teamIndex];
        const visible = defaultVariant
          ? [defaultVariant, ...variants.filter((variant) => variant.signature !== defaultVariant.signature)]
          : variants;
        return [teamIndex, visible.slice(0, 3)];
      }),
    ));
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

  const scrollTeamsIntoView = useCallback(() => {
    window.setTimeout(() => {
      const target = teamsFocusRef.current || teamsContainerRef.current;
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const generateTeams = useCallback(async () => {
    setError('');
    setSuccess('');
    const rawSelected = lockedMatch ? players.slice() : players.filter((player) => player.selected);
    const naturalGoalkeepers = rawSelected.filter((player) => getPrimaryPlayerPosition(player) === 'ARQ');
    const requiredNaturalKeys = new Set(naturalGoalkeepers.length === numTeams ? naturalGoalkeepers.map(playerKey) : []);
    const selectedGoalkeeperKeys = new Set(rawSelected.filter((player) => manualGoalkeepers[playerKey(player)] === true || requiredNaturalKeys.has(playerKey(player))).map(playerKey));
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
      setError(`Con ${teamSize} jugadores por equipo no se puede respetar la formacion minima: 1 arquero, 2 en defensa (DEF/LAT), 1 en medio y 1 en ataque.`);
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
    if (nextGenerationIsRedraw && !window.confirm('Vas a rehacer el sorteo actual. Se reemplazan los equipos generados en pantalla.')) {
      return null;
    }

    const advanceGenerationStage = async (stage) => {
      setGenerationStage(stage);
      await new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 20)));
    };

    setGenerating(true);
    setGenerationProgress(0);
    await advanceGenerationStage('Preparando arqueros');
    try {
      await advanceGenerationStage('Repartiendo platinum');
      const avoidSignatures = new Set(seenDrawSignatures.current);
      if (teams) avoidSignatures.add(drawSignature(teams));
      let result = null;
      const yieldToUi = createGenerationClock();
      let lastReportedProgress = 0;
      const reportProgress = (fraction) => {
        const bounded = Math.max(0, Math.min(0.99, Number(fraction) || 0));
        if (bounded - lastReportedProgress < 0.02 && bounded < 0.99) return;
        lastReportedProgress = bounded;
        setGenerationProgress(bounded);
      };
      const diffStart = Math.max(0.5, maxDiff);
      const diffSteps = Math.max(1, Math.round((FLEXIBLE_MAX_DIFF - diffStart) / 0.5) + 1);
      for (let diff = diffStart; diff <= FLEXIBLE_MAX_DIFF; diff += 0.5) {
        const diffIndex = Math.max(0, Math.round((diff - diffStart) / 0.5));
        await advanceGenerationStage(diff <= diffStart ? 'Balanceando posiciones' : `Ampliando diff a ${diff.toFixed(1)}`);
        result = await generateBalancedTeams(
          candidates,
          numTeams,
          Math.min(diff, STRICT_MAX_DIFF),
          payload.pairHistory,
          payload.drawBalanceWeights,
          nextGenerationIsRedraw ? avoidSignatures : new Set(),
          {
            yieldToUi,
            onProgress: (fraction) => reportProgress((diffIndex + fraction) / diffSteps),
          },
        );
        await advanceGenerationStage('Optimizando puntaje');
        reportProgress((diffIndex + 1) / diffSteps);
        // The search already chooses a fresh result from its near-best pool.
        // A larger maxDiff must not authorize a poorer redraw or repeat the same search.
        if (result) break;
      }
      if (!result) {
        setError('No se encontro una combinacion valida con los jugadores seleccionados.');
        return null;
      }
      await advanceGenerationStage('Validando sorteo');
      const signature = drawSignature(result.teams);
      if (signature) seenDrawSignatures.current.add(signature);
      setTeams(result.teams);
      setBenches({});
      setLockedPlayerPositions({});
      const generatedAssignments = Object.assign({}, ...result.teams.map(team => buildTeamAssignment(team)));
      applyDefaultFormationVariants(result.teams, generatedAssignments, {}, true);
      if (window.GOODFELLAS_DRAW_DEBUG === true) console.debug('GOODFELLAS draw', result.evaluation);
      setTeamFormations({});
      setUndoStacks({});
      setPlayerExchanges([]);
      setAnalysisVisible(false);
      setManualComparisonBefore(null);
      setMaxDiff(Number(result.usedMaxDiff || maxDiff).toFixed(1));
      if (nextGenerationIsRedraw) setRedrawsUsedThisSession((value) => value + 1);
      setGeneratedOnce(true);
      setSaveState('dirty');
      setManualActionCount(0);
      setMobileMoveSource(null);
      setPlayersPanelOpen(false);
      setGoalkeeperPanelOpen(false);
      scrollTeamsIntoView();
      const emergencyMessage = prepared.emergencyGoalkeepers.length
        ? ` Arqueros de emergencia: ${prepared.emergencyGoalkeepers.map((player) => player.nombre).join(', ')}.`
        : '';
      const balanceMessage = `${result.exhaustive ? 'Mejor combinacion valida' : 'Mejor resultado encontrado'} entre ${result.evaluatedCandidates} combinaciones validas, equilibrando defensa, medio y ataque. Diferencia de puntos: ${result.evaluation.diff.toFixed(2)}.`;
      setSuccess(`${balanceMessage}${emergencyMessage}`);
      return result.teams;
    } finally {
      setGenerating(false);
      setGenerationStage('');
      setGenerationProgress(0);
    }
  }, [applyDefaultFormationVariants, lockedMatch, manualGoalkeepers, maxDiff, nextGenerationIsRedraw, numTeams, payload.allowRedraw, payload.drawBalanceWeights, payload.pairHistory, payload.redrawLimit, players, redrawsRemaining, scrollTeamsIntoView, teams]);

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
      ['Nombre', 'Posicion', 'Velocidad', 'Puntuacion'].join(','),
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
          const rating = adjustedPositionRatingForTeamSize(player, assigned, team.length);
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
      if (teamSize < 8) return fieldLineCountsFitLimits(summary.counts, teamSize) ? [] : [`${summary.name}: DEF/LAT o ARQ`];
      return FORMATION_LINES
        .filter((line) => {
          const count = Number(summary.counts?.[line] || 0);
          return count < logicalLineMinimumForCounts(line, teamSize, summary.counts) || count > fieldLineLimit(line, teamSize);
        })
        .map((line) => `${summary.name}: ${line}`);
    });
    const ruleChecks = [
      { label: 'Un arquero por equipo', ok: summaries.every((summary) => Number(summary.counts.ARQ || 0) === 1) },
      { label: (teams[0]?.length || 0) < 8 ? 'Al menos 2 en defensa (DEF/LAT)' : 'Laterales y lineas cubiertas', ok: lineIssues.length === 0 },
      { label: 'Platinum repartidos', ok: evaluation.platinumSpread <= 1 },
      { label: 'Jugadores lentos equilibrados', ok: evaluation.slowSpread <= 1 },
      { label: 'Irregulares repartidos', ok: evaluation.irregularSpread <= 1 },
      { label: 'Fuerza por linea pareja', ok: evaluation.lineStrengthSpread <= 2 },
      { label: 'Perfiles fuertes y flojos repartidos', ok: evaluation.profileDistributionSpread <= 1 },
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
      lineStrengthSpread: evaluation.lineStrengthSpread,
      profileDistributionSpread: evaluation.profileDistributionSpread,
      tierSpread,
      historicalPenalty: historicalRepeatPenalty(teams, payload.pairHistory),
      ruleChecks,
      decisionText: `Se evaluaron equipos por puntaje ajustado a posicion, rendimiento historico real, cobertura de lineas, fuerza por linea, perfiles fuertes/flojos, reparto de platinum, velocidad, ida y vuelta, pase/vision, regularidad, tiers e historial de companeros.`,
      summaries,
      comparisons,
    };
  }, [assignments, getTeamDisplayName, payload.drawBalanceWeights, payload.pairHistory, teams]);

  const manualMoveComparison = useMemo(() => {
    if (!manualComparisonBefore?.teams || !teams) return null;
    const before = manualComparisonMetrics(manualComparisonBefore.teams, manualComparisonBefore.assignments || {});
    const after = manualComparisonMetrics(teams, assignments);
    if (!before || !after) return null;
    const rows = MANUAL_COMPARISON_FIELDS.map(([field, label]) => {
      const beforeValue = Number(before[field] || 0);
      const afterValue = Number(after[field] || 0);
      const delta = afterValue - beforeValue;
      const status = delta < -0.05 ? 'mejora' : delta > 0.05 ? 'empeora' : 'igual';
      return { field, label, before: beforeValue, after: afterValue, delta, status };
    });
    return {
      label: manualComparisonBefore.label || 'Cambio manual',
      rows,
      improved: rows.filter((row) => row.status === 'mejora').length,
      worsened: rows.filter((row) => row.status === 'empeora').length,
    };
  }, [assignments, manualComparisonBefore, teams]);

  const actionAnalysis = useMemo(() => {
    if (!drawAnalysis) return null;
    const riskCandidates = [
      drawAnalysis.slowSpread > 1 ? `velocidad despareja (${drawAnalysis.slowSpread})` : '',
      drawAnalysis.irregularSpread > 1 ? `regularidad despareja (${drawAnalysis.irregularSpread})` : '',
      drawAnalysis.platinumSpread > 1 ? `platinum desparejos (${drawAnalysis.platinumSpread})` : '',
      drawAnalysis.lineStrengthSpread > 2 ? `diferencia por linea (${drawAnalysis.lineStrengthSpread.toFixed(1)})` : '',
      drawAnalysis.profileDistributionSpread > 1 ? `perfiles fuertes/flojos desparejos (${drawAnalysis.profileDistributionSpread})` : '',
    ].filter(Boolean);
    const suggestion = drawAnalysis.diff > 2
      ? 'Probar una variante o mover un jugador fuerte al equipo menor.'
      : riskCandidates.length
        ? 'Revisar la alerta principal antes de guardar.'
        : 'Guardar el sorteo si la distribucion visual te cierra.';
    return {
      balance: drawAnalysis.diff <= 1 ? 'Muy parejo' : drawAnalysis.diff <= 2 ? 'Parejo con leve ventaja' : 'Ventaja clara',
      risk: riskCandidates[0] || 'Sin alerta fuerte',
      suggestion,
      teams: drawAnalysis.summaries.map((summary) => ({
        name: summary.name,
        keyPlayer: summary.topPlayers[0]?.name || '-',
        strength: summary.strengths[0]?.label || '-',
        weakness: summary.weaknesses[0]?.label || '-',
      })),
    };
  }, [drawAnalysis]);

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
        optimized: ['puntaje ajustado por posicion', 'rendimiento historico real', 'cobertura de lineas', 'fuerza por linea', 'perfiles fuertes/flojos', 'platinum', 'velocidad', 'ida y vuelta', 'pase/vision', 'regularidad', 'tiers', 'historial de companeros'],
      },
      metrics: {
        diff: Number(drawAnalysis.diff.toFixed(2)),
        slow_spread: drawAnalysis.slowSpread,
        irregular_spread: drawAnalysis.irregularSpread,
        platinum_spread: drawAnalysis.platinumSpread,
        line_strength_spread: drawAnalysis.lineStrengthSpread,
        profile_distribution_spread: drawAnalysis.profileDistributionSpread,
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
    markDrawDirty(true);
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

  const proposedFormationFits = changes => {
    if (!teams) return false;
    const proposed = teams.map(team => ({ ...buildTeamAssignment(team, assignments), ...changes }));
    const constraints = generationConstraints(teams, proposed);
    return constraints.goalkeeperRule && proposed.every((positions, index) => fieldLineCountsFitLimits(teamLineCounts(teams[index], positions), teams[index].length));
  };

  const applyFormation = (teamIndex, value) => {
    if (!teams?.[teamIndex]) return;
    const formationValue = FORMATION_PRESET_VALUES.has(value)
      ? formationValueForPreset(teams[teamIndex].length, value)
      : value;
    pushUndo(teamIndex);
    markDrawDirty(true);
    clearActiveFormationVariant(teamIndex);
    setTeamFormations((current) => ({ ...current, [teamIndex]: value }));
    if (value === 'auto') {
      const teamKeys = new Set(teams[teamIndex].map(playerKey));
      setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !teamKeys.has(key) || lockedPlayerPositions[key])));
      return;
    }
    if (value === 'custom') return;
    if (!formationValue) return;
    const counts = formationCountsFromValue(teams[teamIndex], formationValue);
    const nextAssignments = counts
      ? applyPositionCountsToTeam(teams[teamIndex], counts, buildTeamAssignment(teams[teamIndex], assignments), lockedPlayerPositions)
      : applyFormationToTeam(teams[teamIndex], formationValue);
    if (!nextAssignments) return;
    if (!proposedFormationFits(nextAssignments)) {
      setError('La formacion debe respetar los minimos de cada linea y conservar un arquero.');
      return;
    }
    setAssignments((current) => ({ ...current, ...nextAssignments, ...lockedPlayerPositions }));
  };

  const pitchLineDelta = (teamIndex, line, delta) => {
    const team = teams?.[teamIndex];
    if (!team) return;
    const currentAssignments = buildTeamAssignment(team, assignments);
    const nextAssignments = planPitchLineAdjustment(team, currentAssignments, lockedPlayerPositions, line, delta, proposedFormationFits);
    if (!nextAssignments) {
      const count = pitchLineCountsFromLogical(teamLineCounts(team, currentAssignments))[line];
      const minimum = fieldLineMinimum(line, team.length);
      const maximum = maxFieldPlayersPerLine(team.length);
      setError(delta < 0 && count <= minimum
        ? `La linea ${line === 'DEF' ? 'DEF/LAT' : line} debe conservar al menos ${minimum} jugador${minimum === 1 ? '' : 'es'}.`
        : delta > 0 && count >= maximum
          ? `La linea ${line === 'DEF' ? 'DEF/LAT' : line} admite como maximo ${maximum} jugadores.`
          : 'No hay una redistribucion disponible que respete los minimos y los jugadores bloqueados.');
      return;
    }
    pushUndo(teamIndex);
    markDrawDirty(true);
    markFormationAsManual(teamIndex);
    clearActiveFormationVariant(teamIndex);
    setAssignments(current => ({ ...current, ...nextAssignments }));
    setError('');
    setSuccess('');
  };

  const toggleLockedPosition = (player, assignedPosition) => {
    const key = playerKey(player);
    const position = String(assignedPosition || getPrimaryPlayerPosition(player)).toUpperCase();
    markDrawDirty(true);
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
          rating: adjustedPositionRatingForTeamSize(player, assigned, targetTeam.length),
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
    const resolvedTargetPlayerKey = targetPlayerKey || null;
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
        const normalizedTargetAssignments = proposedTargetAssignments;
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
          const normalizedSourceAssignments = proposedSourceAssignments;
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
        const normalizedAssignments = proposedAssignments;
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
    if (teams) {
      setManualComparisonBefore({
        teams: teams.map((team) => team.slice()),
        assignments: { ...assignments },
        label: sourcePlayer?.nombre || 'Cambio manual',
      });
    }
    pushUndo(normalizedTargetTeamIndex);
    if (sourceTeamIndex !== normalizedTargetTeamIndex) pushUndo(sourceTeamIndex);
    if (sourceTeamIndex !== normalizedTargetTeamIndex && resolvedTargetPlayerKey) {
      setPlayerExchanges(current => [...current, {
        sourceKey: key,
        targetKey: String(resolvedTargetPlayerKey),
        sourceTeam: sourceTeamIndex,
        targetTeam: normalizedTargetTeamIndex,
        sourceIndex: teams[sourceTeamIndex].findIndex(player => playerKey(player) === key),
        targetIndex: teams[normalizedTargetTeamIndex].findIndex(player => playerKey(player) === String(resolvedTargetPlayerKey)),
        sourcePosition: buildTeamAssignment(teams[sourceTeamIndex], assignments)[key],
        targetPosition: buildTeamAssignment(teams[normalizedTargetTeamIndex], assignments)[String(resolvedTargetPlayerKey)],
      }]);
    }
    markDrawDirty(true);
    setMobileMoveSource(null);
    setError('');
    markFormationAsManual(normalizedTargetTeamIndex, sourceTeamIndex);
    clearActiveFormationVariant(normalizedTargetTeamIndex, sourceTeamIndex);
    setTeams((current) => buildMovedTeams(current));
    setSuccess(resolvedTargetPlayerKey ? `${sourcePlayer.nombre} y ${validation.targetKeyForAssignment ? teams[normalizedTargetTeamIndex].find(item => playerKey(item) === validation.targetKeyForAssignment)?.nombre || 'el jugador destino' : 'el jugador destino'} intercambiados.` : `${sourcePlayer.nombre} movido de posición.`);
    // El panel de analisis es pesado: se monta como transicion para que la cancha se
    // actualice primero y el movimiento se sienta inmediato.
    if (isFormationEditor) startTransition(() => setAnalysisVisible(true));
    if ((targetLine && FORMATION_LINES.includes(targetLine)) || targetKeyForAssignment) {
      setAssignments((current) => {
        const next = { ...current };
        if (targetLine && FORMATION_LINES.includes(targetLine)) next[key] = sourcePlayer && isFixedGoalkeeper(sourcePlayer) ? 'ARQ' : targetLine;
        if (targetKeyForAssignment && FORMATION_LINES.includes(sourceLine)) next[targetKeyForAssignment] = sourceLine;
        return next;
      });
    }
  };

  const canDropSourceOnLine = (source, targetTeamIndex, targetLine) => {
    return validateDropTarget(source, targetTeamIndex, String(targetLine || '').toUpperCase(), null).ok;
  };
  const restorePlayerTeam = (key, teamIndex) => {
    const reserveKeys = new Set(Object.values(benches).flat().map(playerKey));
    const squads = teams.map((team, index) => [...team, ...(benches[index] || [])]);
    const restored = restorePlayerExchanges(squads, assignments, playerExchanges, key);
    setBenches(Object.fromEntries(restored.teams.map((team, index) => [index, team.filter(player => reserveKeys.has(playerKey(player)))])));
    restored.teams = restored.teams.map(team => team.filter(player => !reserveKeys.has(playerKey(player))));
    pushUndo(teamIndex);
    setTeams(restored.teams);
    setAssignments(restored.assignments);
    setPlayerExchanges(restored.exchanges);
    setLockedPlayerPositions(current => Object.fromEntries(Object.entries(current).map(([id, position]) => [id, restored.assignments[id] || position])));
    const affectedTeams = teams.map((_, index) => index).filter(index => (
      teams[index].some((player, slot) => playerKey(player) !== playerKey(restored.teams[index][slot]))
    ));
    markFormationAsManual(...affectedTeams);
    clearActiveFormationVariant(...affectedTeams);
    setMobileMoveSource(null);
    setError('');
    markDrawDirty(true);
  };

  const lineInsertPlacementFromElement = (element, clientX) => {
    const sourceKey = (dragState?.playerKey || pointerDragRef.current.source?.playerKey)
      ? String(dragState?.playerKey || pointerDragRef.current.source?.playerKey)
      : '';
    const items = Array.from(element.querySelectorAll('[data-sorteo-line-player-item="1"]'))
      .filter((item) => item.dataset.playerKey !== sourceKey);
    const pointerX = clientX;
    const containerRect = element.getBoundingClientRect();
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

  const lineInsertPlacementFromEvent = (event) => lineInsertPlacementFromElement(event.currentTarget, event.clientX);

  const nearbySwapTargetFromLineElement = (element, clientX, clientY) => {
    const sourceKey = (dragState?.playerKey || pointerDragRef.current.source?.playerKey)
      ? String(dragState?.playerKey || pointerDragRef.current.source?.playerKey)
      : '';
    const items = Array.from(element.querySelectorAll('[data-sorteo-line-player-item="1"]'))
      .filter((item) => item.dataset.playerKey !== sourceKey);
    const crossTeamDrop = Number(element.dataset.teamIndex) !== Number(dragState?.teamIndex ?? pointerDragRef.current.source?.teamIndex);
    let best = null;
    items.forEach((item) => {
      const card = item.querySelector('[data-sorteo-drag-player]');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const horizontalTolerance = crossTeamDrop ? 2 : 14;
      const verticalTolerance = crossTeamDrop ? 2 : 10;
      const expandedLeft = rect.left - horizontalTolerance;
      const expandedRight = rect.right + horizontalTolerance;
      const expandedTop = rect.top - verticalTolerance;
      const expandedBottom = rect.bottom + verticalTolerance;
      if (
        clientX < expandedLeft
        || clientX > expandedRight
        || clientY < expandedTop
        || clientY > expandedBottom
      ) return;
      const centerX = rect.left + (rect.width / 2);
      const centerY = rect.top + (rect.height / 2);
      const distance = Math.hypot(clientX - centerX, clientY - centerY);
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

  const nearbySwapTargetFromLineEvent = (event) => nearbySwapTargetFromLineElement(event.currentTarget, event.clientX, event.clientY);

  const dragScoreDelta = (source, targetLine) => {
    if (!source?.player || !FORMATION_LINES.includes(String(targetLine || '').toUpperCase())) return null;
    const sourceLine = String(source.assignedPosition || getPrimaryPlayerPosition(source.player)).toUpperCase();
    const destinationLine = String(targetLine || '').toUpperCase();
    const teamSize = teams?.[source.teamIndex]?.length || playersPerTeam;
    const from = playerCardRating(adjustedPositionRatingForTeamSize(source.player, sourceLine, teamSize));
    const to = playerCardRating(adjustedPositionRatingForTeamSize(source.player, destinationLine, teamSize));
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
    setDragState({ ...source, player, cardWidth: event.currentTarget.getBoundingClientRect().width });
    positionDragGhost(event.clientX, event.clientY);
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
    if (source && Number(source.teamIndex) !== resolvedTeamIndex && !targetCard && !targetPlayerKey) {
      setError('Para intercambiar entre equipos, soltá el jugador directamente sobre otro jugador.');
      return;
    }
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
    dragMarkerRef.current = null;
    setDragState(null);
    dragPointRef.current = null;
    setDragHoverTarget(null);
  };

  const clearPointerDrag = (suppressClick = false) => {
    if (pointerDragRef.current.timer) {
      window.clearTimeout(pointerDragRef.current.timer);
    }
    pointerDragRef.current = {
      active: false,
      hoverTarget: null,
      source: null,
      startX: 0,
      startY: 0,
      suppressClick,
      timer: null,
    };
    if (suppressClick) {
      window.setTimeout(() => {
        pointerDragRef.current.suppressClick = false;
      }, 250);
    }
    setDragState(null);
    dragPointRef.current = null;
    dragMarkerRef.current = null;
    setDragHoverTarget(null);
  };

  const updatePointerDragHoverRef = useRef(null);

  const updatePointerDragHover = (clientX, clientY) => {
    const source = pointerDragRef.current.source || dragState;
    if (!source) return null;
    const element = document.elementFromPoint(clientX, clientY);
    const targetCard = element?.closest?.('[data-sorteo-drag-player]');
    const targetLine = element?.closest?.('.line-players[data-sorteo-drop-line]') || element?.closest?.('[data-sorteo-drop-line]');
    if (targetCard?.dataset?.playerKey && targetCard.dataset.playerKey !== String(source.playerKey)) {
      const teamIndex = Number(targetCard.dataset.teamIndex);
      const line = pitchLineForPosition(targetCard.dataset.assignedPosition || '');
      const assigned = targetCard.dataset.assignedPosition || line;
      const rect = targetCard.getBoundingClientRect();
      const edgeWidth = Math.min(10, rect.width * 0.12);
      const onLeftEdge = clientX <= rect.left + edgeWidth;
      const onRightEdge = clientX >= rect.right - edgeWidth;
      if ((onLeftEdge || onRightEdge) && teamIndex === Number(source.teamIndex)) {
        const lineElement = targetCard.closest('.line-players[data-sorteo-drop-line]');
        const containerRect = lineElement?.getBoundingClientRect();
        const siblingCards = Array.from(lineElement?.querySelectorAll('[data-sorteo-line-player-item="1"]') || [])
          .filter((item) => item.dataset.playerKey !== String(source.playerKey));
        const cardIndex = siblingCards.indexOf(targetCard.parentElement);
        const insertIndex = Math.max(0, cardIndex + (onRightEdge ? 1 : 0));
        const insertX = containerRect
          ? ((onRightEdge ? rect.right : rect.left) - containerRect.left)
          : undefined;
        const targetLineForPlacement = line === 'DEF'
          ? defenseInsertRole(siblingCards.length, insertIndex)
          : assigned;
        const nextTarget = { teamIndex, line, targetLine: targetLineForPlacement, insertIndex };
        dragMarkerRef.current = { teamIndex, line, x: insertX };
        updateDragHoverTarget(nextTarget);
        return nextTarget;
      }
      const nextTarget = { teamIndex, line, targetLine: assigned, playerKey: targetCard.dataset.playerKey };
      updateDragHoverTarget(nextTarget);
      return nextTarget;
    }
    if (targetLine) {
      const teamIndex = Number(targetLine.dataset.teamIndex);
      const line = targetLine.dataset.sorteoDropLine;
      const lineElement = targetLine.classList?.contains('line-players')
        ? targetLine
        : targetLine.querySelector?.('.line-players[data-sorteo-drop-line]');
      if (!lineElement || !Number.isFinite(teamIndex) || !line) return null;
      const nearbySwapTarget = nearbySwapTargetFromLineElement(lineElement, clientX, clientY);
      if (nearbySwapTarget?.playerKey) {
        const nextTarget = {
          teamIndex,
          line,
          targetLine: nearbySwapTarget.assignedPosition || line,
          playerKey: nearbySwapTarget.playerKey,
        };
        updateDragHoverTarget(nextTarget);
        return nextTarget;
      }
      if (teamIndex !== Number(source.teamIndex)) {
        updateDragHoverTarget(null);
        return null;
      }
      const placement = lineInsertPlacementFromElement(lineElement, clientX);
      const sourceKey = String(source.playerKey || '');
      const visibleCount = Array.from(lineElement.querySelectorAll('[data-sorteo-line-player-item="1"]'))
        .filter((item) => item.dataset.playerKey !== sourceKey)
        .length;
      const targetLineForPlacement = line === 'DEF'
        ? defenseInsertRole(visibleCount, placement.insertIndex)
        : line;
      const nextTarget = { teamIndex, line, targetLine: targetLineForPlacement, insertIndex: placement.insertIndex };
      dragMarkerRef.current = { teamIndex, line, x: placement.insertX };
      updateDragHoverTarget(nextTarget);
      return nextTarget;
    }
    return null;
  };

  updatePointerDragHoverRef.current = updatePointerDragHover;

  const finishPointerDrag = (clientX, clientY) => {
    const source = pointerDragRef.current.source;
    const target = updatePointerDragHover(clientX, clientY);
    if (!source || !target) {
      const landedTeam = document.elementFromPoint(clientX, clientY)?.closest?.('[data-sorteo-team-card]')?.dataset?.teamIndex;
      if (source && landedTeam != null && Number(landedTeam) !== Number(source.teamIndex)) {
        setError('Para intercambiar entre equipos, soltá el jugador directamente sobre otro jugador.');
      }
      clearPointerDrag(true);
      return;
    }
    const resolvedTeamIndex = Number(target.teamIndex);
    const hoverIsInsert = Number.isFinite(Number(target.insertIndex)) && !target.playerKey;
    const resolvedTargetPlayerKey = hoverIsInsert ? null : (target.playerKey || null);
    const resolvedLine = resolvedTargetPlayerKey ? (target.targetLine || target.line || null) : (target.targetLine || target.line || null);
    const resolvedInsertIndex = !resolvedTargetPlayerKey && Number.isFinite(Number(target.insertIndex))
      ? Number(target.insertIndex)
      : null;
    if (Number.isFinite(resolvedTeamIndex) && resolvedLine) {
      movePlayer(source, resolvedTeamIndex, resolvedLine, resolvedTargetPlayerKey, resolvedInsertIndex);
    }
    clearPointerDrag(true);
  };

  const beginDragAtPoint = (source, clientX, clientY) => {
    pointerDragRef.current.active = true;
    pointerDragRef.current.source = source;
    const sourceCard = Array.from(document.querySelectorAll('[data-sorteo-drag-player]')).find(card => card.dataset.playerKey === String(source.playerKey));
    setDragState({ ...source, cardWidth: sourceCard?.getBoundingClientRect().width || 64 });
    positionDragGhost(clientX, clientY);
    updateDragHoverTarget({
      teamIndex: source.teamIndex,
      line: pitchLineForPosition(source.assignedPosition),
      targetLine: source.assignedPosition,
      playerKey: source.playerKey,
    });
  };

  const beginPointerDrag = (event, source) => {
    beginDragAtPoint(source, event.clientX, event.clientY);
  };

  const handlePlayerPointerDown = (event, teamIndex, player, assignedPosition) => {
    event.stopPropagation();
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (event.pointerType === 'mouse') event.currentTarget.setPointerCapture?.(event.pointerId);
    if (pointerDragRef.current.source) clearPointerDrag(true);
    const source = { teamIndex, playerKey: playerKey(player), assignedPosition, player };
    pointerDragRef.current = {
      active: false,
      hoverTarget: null,
      source,
      pointerType: event.pointerType,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      suppressClick: false,
      timer: event.pointerType === 'mouse' ? null : window.setTimeout(() => {
        if (pointerDragRef.current.source === source) beginDragAtPoint(source, pointerDragRef.current.startX, pointerDragRef.current.startY);
      }, 450),
    };
  };

  const handlePlayerPointerMove = (event) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag.source || pointerDrag.pointerId !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
    if (!pointerDrag.active && moved > 8) {
      if (pointerDrag.timer) window.clearTimeout(pointerDrag.timer);
      if (pointerDrag.pointerType !== 'mouse') {
        clearPointerDrag(true);
        return;
      }
      beginPointerDrag(event, pointerDrag.source);
    }
    if (pointerDragRef.current.active) {
      event.preventDefault();
      event.stopPropagation();
      scheduleDragHoverUpdate(event.clientX, event.clientY);
    }
  };

  const handlePlayerPointerUp = (event) => {
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag.source) return;
    if (pointerDrag.timer) window.clearTimeout(pointerDrag.timer);
    if (pointerDrag.active) {
      event.preventDefault();
      event.stopPropagation();
      finishPointerDrag(event.clientX, event.clientY);
      return;
    }
    clearPointerDrag(false);
  };

  const handlePlayerPointerCancel = () => {
    clearPointerDrag(true);
  };

  edgeScrollStepRef.current = (elapsed) => {
    const scroller = teamsScrollerRef.current;
    const dragPoint = dragPointRef.current;
    if (!isFormationEditor || !scroller || !dragPoint || !pointerDragRef.current.active || !window.matchMedia('(max-width: 760px)').matches) return;
    const rect = scroller.getBoundingClientRect();
    if (dragPoint.y < Math.max(0, rect.top) || dragPoint.y > Math.min(window.innerHeight - 88, rect.bottom)) return;
    const left = Math.max(0, rect.left);
    const right = Math.min(window.innerWidth, rect.right);
    const edge = 52;
    const velocity = dragPoint.x < left + edge
      ? -Math.min(1, (left + edge - dragPoint.x) / edge)
      : dragPoint.x > right - edge ? Math.min(1, (dragPoint.x - right + edge) / edge) : 0;
    if (!velocity) return;
    scroller.scrollLeft += velocity * elapsed * 0.8;
    const target = updatePointerDragHover(dragPoint.x, dragPoint.y);
    applyDropMarkerPosition();
    if (!target) updateDragHoverTarget(null);
  };

  useEffect(() => {
    if (!dragState) return;
    const point = dragPointRef.current;
    if (point) positionDragGhost(point.x, point.y);
  }, [dragState, positionDragGhost]);

  useEffect(() => {
    if (!dragState) return undefined;
    let frame;
    let previous = performance.now();
    const step = (now) => {
      edgeScrollStepRef.current?.(Math.min(32, now - previous));
      previous = now;
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [Boolean(dragState)]);

  const scrollToTeam = (index) => {
    const scroller = teamsScrollerRef.current;
    const card = scroller?.children[index];
    if (!card) return;
    if (window.matchMedia('(max-width: 760px)').matches) {
      if (!isFormationEditor) setShowBothTeams(false);
      requestAnimationFrame(() => {
        scroller.scrollTo({ left: card.offsetLeft - scroller.children[0].offsetLeft, behavior: 'smooth' });
      });
      return;
    }
    card.querySelector('.team-formation')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };

  const touchPointFromEvent = (event) => event.touches?.[0] || event.changedTouches?.[0] || null;

  const handlePlayerTouchStart = (event, teamIndex, player, assignedPosition) => {
    if (window.PointerEvent) return;
    const touch = touchPointFromEvent(event);
    if (!touch) return;
    event.stopPropagation();
    const source = { teamIndex, playerKey: playerKey(player), assignedPosition, player };
    pointerDragRef.current = {
      active: false,
      hoverTarget: null,
      source,
      startX: touch.clientX,
      startY: touch.clientY,
      suppressClick: false,
      timer: window.setTimeout(() => {
        if (pointerDragRef.current.source === source) beginDragAtPoint(source, touch.clientX, touch.clientY);
      }, 450),
    };
  };

  const handlePlayerTouchMove = (event) => {
    if (window.PointerEvent) return;
    const touch = touchPointFromEvent(event);
    const pointerDrag = pointerDragRef.current;
    if (!touch || !pointerDrag.source) return;
    const moved = Math.hypot(touch.clientX - pointerDrag.startX, touch.clientY - pointerDrag.startY);
    if (!pointerDrag.active && moved > 8) {
      if (pointerDrag.timer) window.clearTimeout(pointerDrag.timer);
      clearPointerDrag(true);
      return;
    }
    if (pointerDragRef.current.active) {
      event.preventDefault();
      event.stopPropagation();
      scheduleDragHoverUpdate(touch.clientX, touch.clientY);
      updatePointerDragHover(touch.clientX, touch.clientY);
    }
  };

  const handlePlayerTouchEnd = (event) => {
    if (window.PointerEvent) return;
    const touch = touchPointFromEvent(event);
    const pointerDrag = pointerDragRef.current;
    if (!pointerDrag.source) return;
    if (pointerDrag.timer) window.clearTimeout(pointerDrag.timer);
    if (pointerDrag.active && touch) {
      event.preventDefault();
      event.stopPropagation();
      finishPointerDrag(touch.clientX, touch.clientY);
      return;
    }
    clearPointerDrag(false);
  };

  const handlePlayerTouchCancel = () => {
    if (window.PointerEvent) return;
    clearPointerDrag(true);
  };

  useEffect(() => {
    const handleWindowPointerMove = (event) => {
      if (!pointerDragRef.current.source || event.pointerType === 'mouse') return;
      handlePlayerPointerMove(event);
    };
    const handleWindowPointerUp = (event) => {
      if (!pointerDragRef.current.source || event.pointerType === 'mouse') return;
      handlePlayerPointerUp(event);
    };
    const handleWindowPointerCancel = (event) => {
      if (!pointerDragRef.current.source || event.pointerType === 'mouse') return;
      handlePlayerPointerCancel();
    };
    // A non-passive touch listener prevents native scrolling only AFTER the
    // deliberate hold. Pointer preventDefault alone cannot stop a touch pan.
    const handleNativeTouchMove = (event) => {
      if (!window.PointerEvent || !pointerDragRef.current.active) return;
      if (event.cancelable) event.preventDefault();
    };
    const cancelPendingOnScroll = () => {
      if (pointerDragRef.current.source && !pointerDragRef.current.active) clearPointerDrag(true);
    };
    window.addEventListener('touchmove', handleNativeTouchMove, { passive: false, capture: true });
    window.addEventListener('scroll', cancelPendingOnScroll, { capture: true });
    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false, capture: true });
    window.addEventListener('pointerup', handleWindowPointerUp, { passive: false, capture: true });
    window.addEventListener('pointercancel', handleWindowPointerCancel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('touchmove', handleNativeTouchMove, { capture: true });
      window.removeEventListener('scroll', cancelPendingOnScroll, { capture: true });
      window.removeEventListener('pointermove', handleWindowPointerMove, { capture: true });
      window.removeEventListener('pointerup', handleWindowPointerUp, { capture: true });
      window.removeEventListener('pointercancel', handleWindowPointerCancel, { capture: true });
    };
  });

  const changeBenchStatus = (teamIndex, player, toBench) => {
    const team = teams?.[teamIndex] || [];
    const key = playerKey(player);
    const reserve = benches[teamIndex] || [];
    if (!(toBench ? team : reserve).some(item => playerKey(item) === key)) return;
    const remaining = toBench ? team.filter(item => playerKey(item) !== key) : [...team, player];
    if (!remaining.length) {
      setError('Debe quedar al menos un jugador en la cancha.');
      return;
    }
    const locks = { ...lockedPlayerPositions };
    if (toBench) delete locks[key];
    const variants = generateTeamFormationVariants(remaining, assignments, locks, 3);
    const preferred = chooseBestFormationVariant(variants);
    const reorganized = preferred?.assignments || buildTeamAssignment(remaining, assignments);
    if (!fieldLineCountsFitLimits(teamLineCounts(remaining, reorganized), remaining.length)
      || remaining.some(item => locks[playerKey(item)] && reorganized[playerKey(item)] !== locks[playerKey(item)])) {
      setError('No se puede reorganizar la cancha con estas posiciones bloqueadas. Desbloque\u00e1 una posici\u00f3n e intent? de nuevo.');
      return;
    }
    pushUndo(teamIndex);
    setTeams(current => current.map((items, index) => index === teamIndex ? remaining : items));
    setBenches(current => ({ ...current, [teamIndex]: toBench ? [...reserve, player] : reserve.filter(item => playerKey(item) !== key) }));
    setAssignments(current => {
      const next = { ...current, ...reorganized };
      if (toBench) delete next[key];
      return next;
    });
    setLockedPlayerPositions(locks);
    setTeamFormations(current => ({ ...current, [teamIndex]: 'auto' }));
    setDrawVariants(current => ({ ...current, [teamIndex]: variants }));
    setActiveFormationVariants(current => ({ ...current, [teamIndex]: preferred?.signature || '' }));
    setMobileMoveSource(null);
    setPreview(null);
    markDrawDirty(true);
    setError('');
    setSuccess(`${player.nombre} ${toBench ? 'pas\u00f3 al banco' : 'volvi\u00f3 a la cancha'}. Se reorganiz\u00f3 el equipo.`);
  };

  useEffect(() => { setExchangeFilter('same'); }, [preview?.player?.id, mobileMoveSource?.playerKey]);

  const renderExchangeTargets = (source) => {
    const sourceTeam = teams?.[Number(source.teamIndex)] || [];
    const sourcePlayer = sourceTeam.find(player => playerKey(player) === String(source.playerKey));
    if (!sourcePlayer) return null;
    const sourcePosition = source.assignedPosition;
    const sourceRating = playerCardRating(adjustedPositionRatingForTeamSize(sourcePlayer, sourcePosition, sourceTeam.length));
    return (
      <div className="grid min-w-0 gap-2 rounded-md bg-white p-2 text-[#07130f]" data-exchange-options="true">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="m-0 text-sm font-bold">Intercambiar con otro equipo</p>
          <div className="flex gap-1" role="group" aria-label="Filtrar intercambios">
            {[['same', 'Misma posicion'], ['all', 'Todos']].map(([value, label]) => (
              <button key={value} type="button" aria-pressed={exchangeFilter === value} onClick={() => setExchangeFilter(value)} className={`min-h-8 rounded border px-2 py-1 text-xs font-bold ${exchangeFilter === value ? 'border-emerald-900 bg-emerald-900 text-white' : 'border-[#c4d8ce] bg-white text-[#07130f]'}`}>{label}</button>
            ))}
          </div>
        </div>
        <p className="m-0 text-[11px] text-[#526b62]">Diferencia en tu posicion ({sourcePosition}), con el descuento aplicado.</p>
        <div className="grid max-h-[32dvh] gap-2 overflow-y-auto overscroll-contain" data-exchange-list="true">
          {teams.map((team, targetTeamIndex) => {
            if (targetTeamIndex === Number(source.teamIndex)) return null;
            const targetAssignments = buildTeamAssignment(team, assignments);
            const candidates = team.filter(player => exchangeFilter === 'all' || targetAssignments[playerKey(player)] === sourcePosition);
            return (
              <fieldset key={targetTeamIndex} className="min-w-0 border-0 p-0">
                <legend className="mb-1 text-xs font-bold">{getTeamDisplayName(targetTeamIndex)}</legend>
                {!candidates.length ? <p className="m-0 py-1 text-xs text-[#526b62]">Sin jugadores en {sourcePosition}. Usa Todos para ver otras posiciones.</p> : null}
                <div className="grid gap-1">
                  {candidates.map(player => {
                    const key = playerKey(player);
                    const position = targetAssignments[key];
                    const validation = validateDropTarget(source, targetTeamIndex, position, key);
                    const incomingRating = playerCardRating(adjustedPositionRatingForTeamSize(player, sourcePosition, sourceTeam.length));
                    const delta = incomingRating - sourceRating;
                    const difference = `${delta > 0 ? '+' : ''}${delta} pts`;
                    const reason = isFixedGoalkeeper(player) ? 'Arquero fijo' : lockedPlayerPositions[key] ? 'Bloqueado' : !validation.ok ? 'No disponible' : '';
                    return (
                      <button key={key} data-exchange-player={key} data-exchange-position={position} data-exchange-delta={delta} type="button" className="grid min-h-10 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded border border-[#c4d8ce] bg-white px-2 py-1 text-left text-xs hover:bg-[#e7f2eb] disabled:cursor-not-allowed disabled:opacity-55" disabled={!validation.ok} title={validation.message || `${player.nombre} en ${sourcePosition}: ${incomingRating} pts; ${sourcePlayer.nombre}: ${sourceRating} pts. Diferencia: ${difference}.`} onClick={() => { movePlayer(source, targetTeamIndex, position, key); setPreview(null); }}>
                        <span className="min-w-0 truncate font-bold">{player.nombre}</span>
                        <span className="whitespace-nowrap text-[11px] text-[#526b62]">{reason || position}</span>
                        <span className={`whitespace-nowrap font-black tabular-nums ${delta < 0 ? 'text-[#a23b24]' : delta > 0 ? 'text-[#12633c]' : 'text-[#526b62]'}`}>{difference}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      </div>
    );
  };

  const handleTouchCard = (teamIndex, player, assignedPosition) => {
    if (mobileMoveSource && Number(mobileMoveSource.teamIndex) !== teamIndex) {
      movePlayer(mobileMoveSource, teamIndex, assignedPosition, playerKey(player));
      return;
    }
    if (window.matchMedia?.('(max-width: 760px)').matches && !isFixedGoalkeeper(player) && !lockedPlayerPositions[playerKey(player)]) {
      setMobileMoveSource({
        teamIndex,
        playerKey: playerKey(player),
        playerName: player.nombre,
        assignedPosition,
      });
      setPreview(null);
      return;
    }
    setPreview({ player, assignedPosition, teamSize: teams?.[teamIndex]?.length || playersPerTeam });
  };

  const applyTeamFormationVariant = (teamIndex, variant) => {
    if (!teams?.[teamIndex] || !variant?.assignments) return;
    if (!proposedFormationFits(variant.assignments)) { setError('La variante debe respetar los minimos de cada linea y conservar un arquero.'); return; }
    pushUndo(teamIndex);
    markDrawDirty(true);
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
    if (isFormationEditor) startTransition(() => setAnalysisVisible(true));
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
        text += `${player.nombre.toUpperCase()} - ${assigned} - ${adjustedPositionRatingForTeamSize(player, assigned, team.length).toFixed(1)} pts\n`;
      });
      if ((benches[teamIndex] || []).length) text += `Banco de suplentes:\n${benches[teamIndex].map(player => player.nombre.toUpperCase()).join('\n')}\n`;
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
    const text = teams.map((team, teamIndex) => `${getTeamDisplayName(teamIndex)}:\n${team.map((player) => player.nombre.toUpperCase()).join('\n')}${(benches[teamIndex] || []).length ? '\nBanco de suplentes:\n' + benches[teamIndex].map(player => player.nombre.toUpperCase()).join('\n') : ''}`).join('\n\n');
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
      const target = teamsContainerRef.current;
      await waitForExportReadiness(target);
      const cards = Array.from(target.querySelectorAll('[data-sorteo-team-card]'));
      const exportWidth = Math.ceil(cards[0]?.getBoundingClientRect().width || target.getBoundingClientRect().width);
      // Freeze the browser's computed styles before moving the copy: ancestor
      // selectors, responsive typography and card/photo proportions stay intact.
      const copy = target.cloneNode(true);
      const originals = [target, ...target.querySelectorAll('*')];
      const copies = [copy, ...copy.querySelectorAll('*')];
      originals.forEach((original, index) => {
        const computed = window.getComputedStyle(original);
        const clone = copies[index];
        for (const property of computed) {
          clone.style.setProperty(property, computed.getPropertyValue(property));
        }
        clone.style.setProperty('animation', 'none');
        clone.style.setProperty('transition', 'none');
        if (original instanceof HTMLSelectElement) clone.value = original.value;
      });
      copy.querySelectorAll('[data-html2canvas-ignore="true"]').forEach((node) => node.remove());
      const host = document.createElement('div');
      host.setAttribute('aria-hidden', 'true');
      host.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;';
      copy.style.width = `${exportWidth}px`;
      copy.style.height = 'auto';
      copy.style.gridTemplateRows = 'none';
      copy.style.minHeight = '0';
      copy.style.margin = '0';
      // Keep the team score alongside its name in the shared image.
      // Stack all teams, on desktop as well as mobile, without changing the UI.
      const exportCards = Array.from(copy.querySelectorAll('[data-sorteo-team-card]'));
      exportCards.forEach((card, teamIndex) => {
        const title = card.querySelector('[data-team-title]');
        const heading = card.querySelector('.team-head');
        const pitch = card.querySelector('.team-formation');
        if (!title || !pitch) throw new Error('No se encontró la cancha del equipo.');
        title.replaceChildren(document.createTextNode(title.textContent.trim()));
        Object.assign(title.style, { display: 'block', width: 'auto', height: 'auto', margin: '0', lineHeight: '1.3', whiteSpace: 'normal', overflow: 'visible' });
        // Remove editing controls, retaining player cards and position labels.
        pitch.querySelectorAll('button:not([data-sorteo-drag-player]), .line-label small, [data-sorteo-drop-marker]').forEach(node => node.remove());
        // Ancestor selectors no longer match in the detached export host. Make
        // the pitch's pseudo-element a real layer so its SVG survives capture.
        const originalPitch = cards[teamIndex].querySelector('.team-formation');
        const fieldStyle = window.getComputedStyle(originalPitch, '::before');
        const field = document.createElement('div');
        field.setAttribute('data-export-pitch-background', '1');
        for (const property of fieldStyle) field.style.setProperty(property, fieldStyle.getPropertyValue(property));
        field.style.setProperty('content', 'normal');
        pitch.prepend(field);
        Object.assign(heading.style, { width: '100%', height: 'auto', gridTemplateColumns: 'minmax(0, 1fr) auto' });
        heading.lastElementChild.style.whiteSpace = 'nowrap';
        card.replaceChildren(heading, pitch);
        Object.assign(card.style, { width: '100%', minWidth: '0', height: 'auto', gridTemplateRows: 'none', gridTemplateColumns: 'minmax(0, 1fr)', gap: '12px' });
      });
      copy.replaceChildren(...exportCards);
      if (drawAnalysis) {
        const comparison = document.createElement('table');
        comparison.setAttribute('data-export-comparison', '1');
        comparison.style.cssText = `width:100%;border-collapse:collapse;color:#173c2e;background:#fff;font-size:${exportWidth < 300 ? 9 : 12}px;table-layout:fixed;`;
        const caption = comparison.createCaption();
        caption.textContent = 'Comparación rápida';
        caption.style.cssText = 'text-align:left;font-weight:800;padding:8px 0;';
        const addRow = (section, values) => {
          const row = section.insertRow();
          values.forEach((value, index) => {
            const cell = document.createElement(section.tagName === 'THEAD' || index === 0 ? 'th' : 'td');
            cell.textContent = value;
            cell.style.cssText = 'padding:6px 2px;border-bottom:1px solid #d7e6df;text-align:left;overflow-wrap:normal;word-break:normal;font-size:inherit;line-height:1.4;text-transform:none;';
            row.appendChild(cell);
          });
        };
        addRow(comparison.createTHead(), ['Métrica', ...drawAnalysis.summaries.map(item => item.name)]);
        const body = comparison.createTBody();
        addRow(body, ['General', ...drawAnalysis.summaries.map(item => `${item.total.toFixed(1)} pts`)]);
        [['ataque', 'Ataque'], ['tecnica', 'Técnica'], ['ritmo', 'Velocidad']].forEach(([field, label]) => {
          addRow(body, [label, ...drawAnalysis.summaries.map(item => item.statValues[field].toFixed(1))]);
        });
        const comparisonHeader = document.createElement('div');
        comparisonHeader.style.cssText = 'display:block;width:100%;padding-bottom:12px;';
        comparisonHeader.appendChild(comparison);
        copy.prepend(comparisonHeader);
      }
      copy.setAttribute('data-export-formations', '1');
      Object.assign(copy.style, { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'none', gridAutoRows: 'max-content', gap: '16px', overflow: 'visible' });
      host.appendChild(copy);
      document.body.appendChild(host);
      let jpg;
      try {
        await waitForPaint();
        const height = Math.ceil(copy.getBoundingClientRect().height);
        // Keep high resolution while bounding memory for long multi-team exports.
        const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1), 8192 / Math.max(exportWidth, height));
        jpg = await toJpeg(copy, {
          backgroundColor: '#f6faf8', quality: 0.95,
          width: exportWidth, height, pixelRatio,
        });
      } finally {
        host.remove();
      }
      const link = document.createElement('a');
      link.download = `formaciones_goodfellas_${new Date().toISOString().slice(0, 10)}.jpg`;
      link.href = jpg;
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
    if (savingDraw) return;
    if (!isFormationEditor && payload.links?.finish && hasSavedDraw && redrawsUsedThisSession === 0 && teams
      && drawSignature(teams.map((team, index) => [...team, ...(benches[index] || [])])) === savedRosterSignature.current) {
      return saveFormations();
    }
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
    const submittedSnapshot = lineupSnapshot;
    const submittedRosterSignature = drawSignature(teams.map((team, index) => [...team, ...(benches[index] || [])]));
    const teamsPayload = teams.map((team, teamIndex) => {
      const currentAssignments = teamAssignments(teamIndex);
      const color = getTeamColor(teamIndex);
      return {
        color_name: color.name,
        players: [...team, ...(benches[teamIndex] || [])].map((player) => ({
          is_substitute: !team.some(item => playerKey(item) === playerKey(player)),
          id: player.id,
          assigned_position: currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player),
          availability_percent: player.availability_percent,
        })),
      };
    });
    setSavingDraw(true);
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
      setPersistedRedrawCount((value) => value + (hasSavedDraw ? Math.max(1, redrawsUsedThisSession) : redrawsUsedThisSession));
      setSavedSnapshot(submittedSnapshot);
      savedRosterSignature.current = submittedRosterSignature;
      setRedrawsUsedThisSession(0);
      setHasSavedDraw(true);
      setGeneratedOnce(false);
      setSaveState('saved');
      setManualActionCount(0);
      setError('');
      const manualMessage = manualActionCount > 0 ? ` Se conservaron ${manualActionCount} cambio${manualActionCount === 1 ? '' : 's'} manual${manualActionCount === 1 ? '' : 'es'} de cancha.` : '';
      setSuccess(`${data.message || 'Sorteo guardado correctamente en la fecha.'}${manualMessage}`);
      navigate(payload.links?.back || 'editar_partidos.php');
    } catch (saveError) {
      setSuccess('');
      setError(saveError.message || 'No se pudo guardar el sorteo.');
    } finally {
      setSavingDraw(false);
    }
  };

  const saveFormations = async () => {
    if (savingDraw) return;
    const submittedSnapshot = lineupSnapshot;
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
      [...team, ...(benches[teamIndex] || [])].forEach((player) => {
        const key = playerKey(player);
        formData.set(`player_substitute[${player.id}]`, team.some(item => playerKey(item) === key) ? '0' : '1');
        formData.set(`player_team[${player.id}]`, String(teamNumber));
        formData.set(`player_position[${player.id}]`, currentAssignments[key] || getPrimaryPlayerPosition(player));
      });
    });
    setSavingDraw(true);
    try {
      const response = await fetch(`finalizar_partido.php?match_id=${encodeURIComponent(String(payload.matchId))}&edit_formations=1`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      });
      const saved = await response.json();
      if (!response.ok || !saved.ok) {
        throw new Error(saved.message || 'No se pudieron guardar las formaciones.');
      }
      setError('');
      setSaveState('saved');
      setManualActionCount(0);
      setSavedSnapshot(submittedSnapshot);
      setSuccess('Formaciones y camisetas guardadas.');
      if (isFormationEditor) window.setTimeout(() => navigate(payload.links?.back || 'editar_partidos.php'), 1200);
      else navigate(payload.links?.back || 'editar_partidos.php');
    } catch (saveError) {
      setSuccess('');
      setError(saveError.message || 'No se pudieron guardar las formaciones.');
    } finally {
      setSavingDraw(false);
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
  const mobileMovePlayer = mobileMoveSource && teams?.[Number(mobileMoveSource.teamIndex)]
    ? teams[Number(mobileMoveSource.teamIndex)].find((player) => playerKey(player) === String(mobileMoveSource.playerKey))
    : null;
  const playersPanelCollapsed = !playersPanelOpen && !isFormationEditor;
  const goalkeeperPanelCollapsed = !goalkeeperPanelOpen && !isFormationEditor;
  const mobileActionGridClass = lockedMatch ? 'grid-cols-3' : 'grid-cols-2';
  const displayedSaveState = isFormationEditor ? saveState : workflowSaveState;
  const saveStateLabel = savingDraw ? 'Guardando…' : displayedSaveState === 'dirty' ? 'Cambios sin guardar' : displayedSaveState === 'saved' ? 'Equipos guardados' : 'Sin guardar';
  const saveStateClass = displayedSaveState === 'dirty'
    ? 'border-amber-200 bg-amber-50 text-[#7a4b00]'
    : displayedSaveState === 'saved'
      ? 'border-[#9fc8b5] bg-[#f4fbf7] text-[#063d2b]'
      : 'border-[#d7e6df] bg-[#f8fbfa] text-[#526b62]';

  // Datos derivados por equipo: formaciones puntuadas, totales, conteos por linea y
  // jugadores por linea. Son los calculos mas caros del render y solo cambian cuando
  // cambian los equipos, las posiciones o los bloqueos; antes se recalculaban en cada
  // render (arrastre, hover, abrir paneles, etc.).
  const teamViews = useMemo(() => {
    if (!teams) return [];
    return teams.map((team, teamIndex) => {
      const teamAssignmentsForIndex = teamAssignments(teamIndex);
      const linePlayers = Object.fromEntries(PITCH_LINES.map((line) => [line, []]));
      team.forEach((player) => {
        const assigned = teamAssignmentsForIndex[playerKey(player)] || getPrimaryPlayerPosition(player);
        const pitchLine = pitchLineForPosition(assigned);
        (linePlayers[pitchLine] || linePlayers.MED).push(player);
      });
      return {
        color: getTeamColor(teamIndex),
        assignments: teamAssignmentsForIndex,
        linePlayers,
        lineCounts: teamLineCounts(team, teamAssignmentsForIndex),
        summary: teamTotalsSummary(team, assignments),
        formationOptions: getScoredFormationOptions(team, teamAssignmentsForIndex, lockedPlayerPositions),
        formationSelectValue: teamFormationSelectValue(team, teamAssignmentsForIndex, teamFormations[teamIndex], isFormationEditor, isFormationEditor),
      };
    });
  }, [assignments, getTeamColor, isFormationEditor, lockedPlayerPositions, teamAssignments, teamFormations, teams]);

  // Validacion de cada linea durante el arrastre: se calcula una vez por objetivo de
  // arrastre (antes se recalculaba para las lineas de los dos equipos en cada render).
  const dropValidationByLine = useMemo(() => {
    if (!dragState || !teams) return null;
    const map = new Map();
    teams.forEach((team, teamIndex) => {
      FORMATION_LINES.forEach((line) => {
        map.set(`${teamIndex}|${line}`, validateDropTarget(dragState, teamIndex, line, null));
      });
    });
    return map;
  }, [assignments, dragState, lockedPlayerPositions, teams, validateDropTarget]);

  // Abrir el analisis en el telefono movia el contenido sin avisar: al abrirlo desde la
  // barra inferior se desplaza hasta el panel para que se vea el resultado.
  const analysisScrollPendingRef = useRef(false);
  const toggleAnalysisPanel = useCallback(() => {
    const next = !analysisVisible;
    if (next && typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches) {
      analysisScrollPendingRef.current = true;
    }
    setAnalysisVisible(next);
  }, [analysisVisible]);

  useEffect(() => {
    if (!analysisVisible || !analysisScrollPendingRef.current) return;
    analysisScrollPendingRef.current = false;
    const panel = document.querySelector('[data-sorteo-analysis]');
    panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [analysisVisible]);

  return (
    <section
      className={`sorteo-page sorteo-react-page mx-auto grid w-full max-w-7xl gap-3 px-3 py-3 text-[#07130f] sm:px-5 lg:gap-4 lg:py-5 ${!isFormationEditor ? 'gf-draw-workflow' : mobileMoveSource ? 'max-[760px]:pb-56' : teams ? 'max-[760px]:pb-32' : ''}`}
      onDragOver={(event) => {
        if (!dragState) return;
        event.preventDefault();
        positionDragGhost(event.clientX, event.clientY);
      }}
      onDragEnd={() => {
        setDragState(null);
        dragPointRef.current = null;
        dragMarkerRef.current = null;
        setDragHoverTarget(null);
      }}
    >
      <div className={`grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm sm:p-4 ${!isFormationEditor ? 'gf-flow-intro' : ''}`}>
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

        {isFormationEditor ? (
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
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-3 xl:grid-cols-6">
            <span className={`rounded-md border px-3 py-2 ${drawReadiness.ready ? 'border-[#9fc8b5] bg-[#f4fbf7]' : 'border-amber-200 bg-amber-50'}`}>
              <b className={`block text-base font-black ${drawReadiness.ready ? 'text-[#063d2b]' : 'text-[#7a4b00]'}`}>{drawReadiness.ready ? 'Listo' : 'Revisar'}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Estado</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{selectedPlayers.length}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Jugadores</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{numTeams}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Equipos</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{drawReadiness.teamSizeLabel}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Reparto</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{selectedPlayers.length ? playerCardRating(selectedAverageRating) : '-'}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Media GEN</small>
            </span>
            <span className="rounded-md border border-[#d7e6df] bg-white px-3 py-2">
              <b className="block text-base font-black text-[#07130f]">{teams && drawAnalysis ? drawAnalysis.diff.toFixed(1) : maxDiff}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Dif.</small>
            </span>
          </div>
        </header>
        ) : (
        <header className="gf-workflow-header">
          <div className="gf-heading-row"><h1>Generador GOODFELLAS</h1><strong data-draw-status>{teams ? saveStateLabel : drawReadiness.ready ? 'Listo para generar' : 'Revisar preparación'}</strong></div>
          {payload.match ? <p>{payload.match.title} · {payload.match.matchDate}</p> : null}
          <p className="gf-match-summary">{selectedPlayers.length} jugadores · {numTeams} equipos · {drawReadiness.teamSizeLabel}{drawAnalysis ? ` · Diferencia ${drawAnalysis.diff.toFixed(1)}` : ''} <span>· Media GEN {selectedPlayers.length ? playerCardRating(selectedAverageRating) : '—'}</span></p>
          <ol className="gf-workflow-progress" aria-label="Progreso del sorteo">
            <li data-step="players" data-complete={selectedPlayers.length > 0}><span>{selectedPlayers.length ? '✓' : '○'}</span> Jugadores</li>
            <li data-step="goalkeepers" data-complete={selectedGoalkeepers.length === numTeams || Boolean(teams)}><span>{selectedGoalkeepers.length === numTeams || teams ? '✓' : '○'}</span> Arqueros</li>
            <li data-step="teams" aria-current={!formationsReady ? 'step' : undefined}><span>{formationsReady ? '✓' : '●'}</span> Equipos</li>
            <li data-step="formations" aria-current={formationsReady ? 'step' : undefined}><span>{formationsReady ? '●' : '🔒'}</span> Formaciones</li>
          </ol>
          <p className="gf-next-step">{formationsReady ? 'Equipos guardados. Continuá con las formaciones.' : hasSavedDraw ? 'Guardá los cambios para continuar a Formaciones.' : 'Guardá los equipos para continuar a Formaciones.'}</p>
          {formationsReady && formationsUrl ? <button type="button" className={secondaryButtonClass} onClick={() => navigate(formationsUrl)}>Configurar formaciones →</button> : null}
        </header>

        )}
      </div>

      <div className={`grid gap-4 ${isFormationEditor ? '' : 'gf-workflow-body'}`}>
        {!isFormationEditor ? (
        <aside className={`grid content-start gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm gf-player-preparation`}>
          <div className="flex items-center justify-between gap-3 border-b border-[#d7e6df] pb-3">
            <div>
              <h2 className="m-0 text-base font-black text-[#07130f]">{playersPanelCollapsed ? `✓ ${selectedPlayers.length} jugadores seleccionados` : 'Jugadores disponibles'}</h2>
              <p className="m-0 text-xs font-semibold text-slate-500">{lockedMatch ? 'Plantel de la fecha' : 'Lista editable local'}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {(!isFormationEditor || teams) ? (
                <button className={quietButtonClass} type="button" onClick={() => setPlayersPanelOpen((open) => !open)} aria-expanded={playersPanelOpen}>
                  {playersPanelOpen ? 'Cerrar' : 'Editar'}
                </button>
              ) : null}
              {!lockedMatch ? (
                <label className={quietButtonClass}>
                  CSV
                  <input className="sr-only" type="file" accept=".csv" onChange={importPlayersCsv} />
                </label>
              ) : null}
            </div>
          </div>

          {playersPanelCollapsed ? (
            <div className="grid gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-3 text-sm font-bold text-[#526b62]">
              <div className="flex items-center justify-between gap-3">
                <span>{availabilityAdjustedCount ? `${availabilityAdjustedCount} con estado ajustado` : 'Todos con estado al 100%'}</span>
              </div>
              {isFormationEditor ? <button className={secondaryButtonClass} type="button" onClick={() => setPlayersPanelOpen(true)}>Editar jugadores</button> : null}
            </div>
          ) : (
            <>
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
                    ['ritmo', 'Velocidad'],
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
                  <article key={playerKey(player)} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border p-2 ${player.selected ? 'border-[#9fc8b5] bg-white' : 'border-[#d7e6df] bg-white'}`}>
                    <input
                      className="h-4 w-4 accent-[#063d2b]"
                      id={`jugador-${playerKey(player)}`}
                      type="checkbox"
                      checked={lockedMatch || player.selected}
                      disabled={lockedMatch}
                      onChange={(event) => setPlayers((current) => current.map((item) => (playerKey(item) === playerKey(player) ? { ...item, selected: event.target.checked } : item)))}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border-2 text-[10px] font-black uppercase"
                          style={{ borderColor: (cardPalettes[playerCardTier(player.puntuacion)] || cardPalettes.bronze).color }}
                        >
                          {player.has_custom_photo ? (
                            <img className="h-full w-full object-cover" src={player.photo_path} alt="" />
                          ) : (
                            <span className="block h-full w-full bg-[#eef5f1]" style={{ color: (cardPalettes[playerCardTier(player.puntuacion)] || cardPalettes.bronze).color }}>{player.nombre.slice(0,1)}</span>
                          )}
                        </span>
                        <span className="min-w-0">
                          <strong className="block truncate text-sm font-black text-[#07130f]">{player.nombre}</strong>
                          <span className="flex flex-wrap items-center gap-1 text-[11px] font-extrabold text-slate-500">
                            <span>{player.posicion}</span>
                            <span>{playerCardRating(player.puntuacion)} GEN</span>
                            {player.availability_percent < 100 ? (
                              <span className={player.availability_percent >= 70 ? 'text-emerald-700' : player.availability_percent >= 40 ? 'text-amber-700' : 'text-red-700'}>{player.availability_percent}%</span>
                            ) : null}
                            {manualGoalkeepers[playerKey(player)] === true ? <span>Arquero</span> : null}
                            {isLowRhythmPlayer(player) ? <span>Lento</span> : null}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 grid grid-cols-[1fr_auto] items-center gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-2 py-1">
                        <span className="text-[10px] font-black uppercase text-[#526b62]">Estado</span>
                        <span className="shrink-0 text-[10px] font-black text-[#063d2b]">{player.availability_percent}%</span>
                        <input
                          className="player-availability-range col-span-2"
                          type="range"
                          min="1"
                          max="100"
                          step="1"
                          value={player.availability_percent}
                          onChange={(event) => updatePlayerAvailability(player, event.target.value, false)}
                          onPointerUp={(event) => updatePlayerAvailability(player, event.currentTarget.value, true)}
                          onKeyUp={(event) => updatePlayerAvailability(player, event.currentTarget.value, true)}
                          onBlur={(event) => updatePlayerAvailability(player, event.currentTarget.value, true)}
                          style={{ '--availability-fill': `${player.availability_percent}%` }}
                          aria-label={`Porcentaje de estado de ${player.nombre}`}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button className={iconButtonClass} type="button" onClick={() => setFormModal({ mode: 'edit', player })} aria-label={`Editar ${player.nombre}`}><Icon name="pencil" /></button>
                      {!lockedMatch ? (
                        <button className={dangerButtonClass} type="button" onClick={() => removePlayer(player)} aria-label={`Eliminar ${player.nombre}`}><Icon name="trash" /></button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </aside>
        ) : null}

        <main className={`grid content-start gap-4 ${isFormationEditor ? '' : 'gf-workflow-main'}`}>
          {!isFormationEditor ? (
          <div className="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm gf-generation-panel">
            <div className="gf-goalkeeper-preparation grid gap-2 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="m-0 text-sm font-black text-[#07130f]">{goalkeeperPanelCollapsed && preparationGoalkeepersReady ? `✓ ${numTeams} arqueros definidos` : 'Definir arqueros'}</h3>
                  <p className="m-0 text-[11px] font-semibold text-[#526b62]">Se eligen antes de realizar el sorteo.</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {(!isFormationEditor || teams) ? (
                    <button className={quietButtonClass} type="button" onClick={() => setGoalkeeperPanelOpen((open) => !open)} aria-expanded={goalkeeperPanelOpen}>
                      {goalkeeperPanelOpen ? 'Cerrar' : 'Editar'}
                    </button>
                  ) : null}
                  <span className={`rounded-md border px-2 py-1 text-xs font-black ${(goalkeeperPanelCollapsed ? preparationGoalkeepersReady : selectedGoalkeepers.length === numTeams) ? 'border-[#9fc8b5] bg-white text-[#063d2b]' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    {goalkeeperPanelCollapsed ? preparationGoalkeepers.length : selectedGoalkeepers.length}/{numTeams}
                  </span>
                </div>
              </div>
              {goalkeeperPanelCollapsed ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#d7e6df] bg-white px-3 py-2 text-xs font-bold text-[#526b62]">
                  <span>Arqueros</span>
                  <strong className="text-[#07130f]">{goalkeeperSummary}</strong>
                </div>
              ) : (
                <>
                  {selectedGoalkeepers.length > numTeams ? (
                    <p className="m-0 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-extrabold text-red-700">
                      Hay mas arqueros elegidos que equipos. Se reservara uno por equipo; los polivalentes restantes conservaran una posicion de campo permitida.
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
                            ARQ {playerCardRating(adjustedPositionRatingForTeamSize(player, 'ARQ', playersPerTeam))}
                          </span>
                        </label>
                      );
                    }) : (
                      <p className="m-0 rounded-md border border-[#d7e6df] bg-white px-2 py-2 text-xs font-bold text-[#526b62]">
                        Selecciona jugadores para definir arqueros.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {drawReadiness.issues.length || drawReadiness.warnings.length ? (
                <div className="grid w-full gap-1.5">
                  {drawReadiness.issues.map((item) => (
                    <p key={`issue-${item}`} className="m-0 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-extrabold text-[#7a4b00]">
                      {item}
                    </p>
                  ))}
                  {!drawReadiness.issues.length ? drawReadiness.warnings.filter(item => !teams || goalkeeperPanelOpen || !item.includes('manual')).map((item) => (
                    <p key={`warning-${item}`} className="m-0 rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-3 py-2 text-xs font-bold text-[#526b62]">
                      {item}
                    </p>
                  )) : null}
                </div>
              ) : null}
              <button className={`${secondaryButtonClass} w-full justify-center text-base sm:w-auto ${generateDisabled ? 'opacity-80' : ''}`} id="generateTeamsButton" type="button" onClick={generateTeams} disabled={generateDisabled || savingDraw}>
                <Icon name="dice" className="h-5 w-5" />
                {generating ? 'Generando...' : generateButtonLabel}
              </button>
              <label className="flex min-h-11 items-center gap-2 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] px-3 text-xs font-extrabold text-[#526b62]">
                Equilibrio objetivo
                <input className="h-8 w-16 rounded-md border border-[#adc8bb] bg-white px-2 text-center text-sm font-black text-[#07130f]" type="number" min="0.5" max="6" step="0.1" value={maxDiff} onChange={(event) => setMaxDiff(event.target.value)} />
              </label>
            </div>
            <p className="gf-attempts" data-draw-attempts>{payload.allowRedraw ? `${redrawsRemaining} intentos disponibles para rehacer` : 'Esta fecha no permite rehacer el sorteo'}</p>
            <div id="generateTeamsLoading" className={`${generating ? 'grid' : 'hidden'} gap-2 rounded-lg border border-[#9fc8b5] bg-[#f4fbf7] px-4 py-3 text-sm font-bold text-[#063d2b]`} role="status" aria-live="polite" aria-busy={generating}>
              <div className="flex items-center justify-between gap-3">
                <strong className="block">Generando equipos...</strong>
                <span className="text-xs font-black text-[#526b62]">
                  {generationStage || 'Balanceando'}
                  {generationProgress > 0 ? <span className="ml-1 text-[#063d2b]">{Math.round(generationProgress * 100)}%</span> : null}
                </span>
              </div>
              <div
                className="sorteo-generate-progress"
                role="progressbar"
                aria-label="Progreso de generacion de equipos"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={generationProgress > 0 ? Math.round(generationProgress * 100) : undefined}
                aria-valuetext={generationProgress > 0 ? `${Math.round(generationProgress * 100)} por ciento` : 'Buscando la combinacion mas equilibrada'}
                data-progress={generationProgress > 0 ? 'determinate' : 'indeterminate'}
              >
                <span style={generationProgress > 0 ? { width: `${Math.max(4, Math.round(generationProgress * 100))}%` } : undefined} />
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
                <div ref={teamsFocusRef} className="w-full scroll-mt-4 rounded-lg border border-[#d7e6df] bg-white px-4 py-2 text-center text-lg font-black text-[#07130f] shadow-sm sm:scroll-mt-6" data-sorteo-matchup-title="1">
                  {currentMatchupName}
                </div>
                {isFormationEditor ? (
                <div className="grid gap-2" data-html2canvas-ignore="true">
                  <div className="flex flex-wrap gap-2 min-[761px]:hidden" role="group" aria-label="Elegir cancha">
                    {teams.map((_, index) => (
                      <button key={index} type="button" className={visibleTeamIndex === index ? secondaryButtonClass : quietButtonClass} aria-pressed={visibleTeamIndex === index} onClick={() => scrollToTeam(index)}>{getTeamDisplayName(index)}</button>
                    ))}
                  </div>
                  <p className="m-0 text-sm text-[#063d2b] min-[761px]:hidden"><strong>← Deslizá entre canchas →</strong><br />Para intercambiar: llevá el jugador al borde, esperá que avance la cancha y soltalo sobre otro jugador. También podés tocar su tarjeta.</p>
                  <p className="m-0 hidden text-sm text-[#063d2b] min-[761px]:block"><strong>Intercambiar jugadores ↔</strong> Arrastrá una tarjeta hasta un jugador del otro equipo y soltala. Ambos cambian de equipo.</p>
                </div>
                ) : (
                  <>
                  {mobileMoveSource ? <p className="gf-selection-status" role="status">{mobileMoveSource.playerName} seleccionado — elegí un jugador del otro equipo. <button type="button" className={quietButtonClass} onClick={() => setMobileMoveSource(null)}>Cancelar</button> <a href="#gf-tap-tools">Más acciones</a></p> : null}
                  <p className="gf-exchange-help" data-html2canvas-ignore="true">Arrastrá a un jugador del otro equipo para intercambiar. En móvil, mantené pulsado para arrastrar o tocá un jugador y después su destino.</p>
                  </>
                )}
                <div ref={teamsScrollerRef} data-teams-scroller="1" data-show-both={!isFormationEditor && showBothTeams ? 'true' : 'false'} data-dragging={dragState ? 'true' : 'false'} className="sorteo-teams-scroller grid gap-4 xl:grid-cols-2" onScroll={event => {
                  const scroller = event.currentTarget;
                  const step = scroller.children[1] ? scroller.children[1].offsetLeft - scroller.children[0].offsetLeft : scroller.clientWidth;
                  setVisibleTeamIndex(Math.max(0, Math.min(teams.length - 1, Math.round(scroller.scrollLeft / Math.max(1, step)))));
                }}>
                  {teams.map((team, teamIndex) => {
                    const view = teamViews[teamIndex] || {};
                    const color = view.color || getTeamColor(teamIndex);
                    const currentAssignments = view.assignments || teamAssignments(teamIndex);
                    const linePlayers = view.linePlayers || Object.fromEntries(PITCH_LINES.map((line) => [line, []]));
                    const summary = view.summary || teamTotalsSummary(team, assignments);
                    const formationOptions = view.formationOptions || [];
                    const formationSelectValue = view.formationSelectValue
                      || teamFormationSelectValue(team, currentAssignments, teamFormations[teamIndex], isFormationEditor, isFormationEditor);
                    return (
                      <article key={teamIndex} className={`${isFormationEditor ? 'team-card team' : 'gf-team-column'} sorteo-team-card grid gap-3 rounded-lg border p-3 shadow-sm max-[760px]:gap-2 max-[760px]:p-2`} data-team-index={teamIndex} data-sorteo-team-card="1">
                        <div className="team-head grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <h3 className="m-0 flex items-center gap-2 truncate text-lg font-black text-[#07130f]" data-team-title>
                              <span className={`h-3 w-3 shrink-0 rounded-full ${color.accent}`} style={{ backgroundColor: color.accentHex }} aria-hidden="true" />
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
                              {isFormationEditor ? (
                                FORMATION_PRESETS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)
                              ) : (
                                <>
                                  <option value="auto">Automática</option>
                                  {formationOptions.map((option) => <option key={option.value} value={option.value}>{formationOptionLabel(option)}</option>)}
                                  <option value="custom">Personalizada</option>
                                </>
                              )}
                            </select>
                          </label>
                        </div>

                        {isFormationEditor ? (
                        <div className="sorteo-formation-toolbar grid gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-2">
                          <div className="sorteo-formation-variants flex flex-wrap gap-1.5">
                            {drawVariants[String(teamIndex)]?.length ? (
                              drawVariants[String(teamIndex)].map((variant, index) => {
                                const isActiveVariant = activeFormationVariants[String(teamIndex)] === variant.signature;
                                const label = formationVariantLabel(index);
                                return (
                                  <button
                                    key={variant.signature || index}
                                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-black transition-colors max-[760px]:min-h-8 max-[760px]:px-2 max-[760px]:text-[11px] ${
                                      isActiveVariant
                                        ? 'border-[#063d2b] bg-[#063d2b] text-white'
                                        : 'border-[#adc8bb] bg-white text-[#063d2b] hover:border-[#063d2b] hover:bg-[#eef8f2]'
                                    }`}
                                    type="button"
                                    onClick={() => applyTeamFormationVariant(teamIndex, variant)}
                                    aria-label={`${label}: ${variant.lineText}, ${variant.total.toFixed(1)} puntos`}
                                    aria-pressed={isActiveVariant}
                                    title={`${variant.lineText} | ${variant.total.toFixed(1)} pts | ${variant.diffCount} cambios`}
                                  >
                                    <Icon name={index === 0 ? 'dice' : 'swap'} className="h-3.5 w-3.5" />
                                    <span>{label}</span>
                                    <span className={isActiveVariant ? 'text-white/80' : 'text-[#526b62]'}>{variant.lineText}</span>
                                    <strong>{variant.total.toFixed(1)}</strong>
                                  </button>
                                );
                              })
                            ) : (
                              <span className="inline-flex min-h-9 items-center rounded-md border border-[#d7e6df] bg-white px-2.5 text-xs font-black text-[#526b62]">
                                Sin variantes disponibles
                              </span>
                            )}
                          </div>
                        </div>

                        ) : (
                          <details className="gf-team-tactics" data-html2canvas-ignore="true">
                            <summary>Opciones tácticas</summary>
                            <label>Variante
                              <select className={inputClass} aria-label={`Variante de ${getTeamDisplayName(teamIndex)}`} value={activeFormationVariants[String(teamIndex)] || ''} onChange={event => {
                                const variant = (drawVariants[String(teamIndex)] || []).find(item => item.signature === event.target.value);
                                if (variant) applyTeamFormationVariant(teamIndex, variant);
                              }}>
                                <option value="" disabled>Personalizada</option>
                                {(drawVariants[String(teamIndex)] || []).map((variant, index) => <option key={variant.signature} value={variant.signature}>{formationVariantLabel(index)} · {variant.lineText} · {variant.total.toFixed(1)} pts</option>)}
                              </select>
                            </label>
                          </details>
                        )}
                        {isFormationEditor ? (
                        <div className="grid gap-1" data-html2canvas-ignore="true" data-team-navigation="1">
                          <div className="flex items-center justify-between gap-2">
                            {teamIndex > 0 ? <button type="button" className={`${quietButtonClass} !min-h-10 text-xs`} onClick={() => scrollToTeam(teamIndex - 1)} aria-label={`Ver cancha de ${getTeamDisplayName(teamIndex - 1)}`}><span aria-hidden="true" className="text-lg">←</span> {getTeamDisplayName(teamIndex - 1)}</button> : <span />}
                            {teamIndex < teams.length - 1 ? <button type="button" className={`${quietButtonClass} !min-h-10 text-xs`} onClick={() => scrollToTeam(teamIndex + 1)} aria-label={`Ver cancha de ${getTeamDisplayName(teamIndex + 1)}`}>{getTeamDisplayName(teamIndex + 1)} <span aria-hidden="true" className="text-lg">→</span></button> : <span />}
                          </div>
                          <span className="text-center text-xs font-semibold text-[#526b62]">Cancha {teamIndex + 1} de {teams.length} · Arrastrá al otro equipo para intercambiar</span>
                        </div>
                        ) : null}
                        <div
                          className="team-formation gf-formation text-white"
                          style={{ borderColor: hexToRgba(teamColorAccentHex(teamIndex), 0.55), '--gf-line-capacity': Math.max(4, ...PITCH_LINES.map((role) => (linePlayers[role] || []).length)) }}
                          data-sorteo-drop-team={teamIndex}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => handleDrop(event, teamIndex, null)}
                        >
                          {dragState && Number(dragState.teamIndex) !== teamIndex ? <span className="pointer-events-none absolute left-2 right-12 top-2 z-30 rounded border border-white/70 bg-[#063d2b] px-2 py-1 text-center text-xs font-bold text-white" data-html2canvas-ignore="true">Soltá sobre un jugador para intercambiar ↔</span> : null}
                          {!isFormationEditor ? <button
                            type="button"
                            className="gf-pitch-size-toggle"
                            data-html2canvas-ignore="true"
                            aria-label={showBothTeams ? `Ampliar cancha de ${getTeamDisplayName(teamIndex)}` : 'Compactar cancha'}
                            title={showBothTeams ? 'Ampliar cancha' : 'Compactar cancha'}
                            aria-expanded={!showBothTeams}
                            onClick={() => {
                              if (showBothTeams) scrollToTeam(teamIndex);
                              else {
                                setShowBothTeams(true);
                                requestAnimationFrame(() => teamsScrollerRef.current?.scrollTo({ left: 0, behavior: 'instant' }));
                              }
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d={showBothTeams ? 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5' : 'M3 8h5V3 M21 8h-5V3 M8 21v-5H3 M16 21v-5h5'} />
                            </svg>
                          </button> : null}
                          <button className="formation-undo-button absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-md border border-white/35 bg-[#063d2b]/90 text-white shadow-sm transition-colors hover:bg-[#05291d] disabled:cursor-not-allowed disabled:opacity-40 max-[760px]:right-1.5 max-[760px]:top-1.5 max-[760px]:h-8 max-[760px]:w-8" type="button" disabled={!(undoStacks[String(teamIndex)] || []).length} onClick={() => undoTeam(teamIndex)} aria-label="Deshacer ultimo cambio" title="Deshacer ultimo cambio">
                            <Icon name="undo" />
                          </button>
                          {PITCH_LINES.map((line) => {
                            const lineList = line === 'DEF'
                              ? defenseLinePlayers(linePlayers.DEF || [], currentAssignments)
                              : (linePlayers[line] || []);
                            const hasProjectedLaterals = line === 'DEF'
                              && lineList.some((player) => (currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player)) === 'LAT');
                            const label = line === 'DEF' ? 'DEF/LAT' : line;
                            const lineCounts = view.lineCounts || teamLineCounts(team, currentAssignments);
                            const count = line === 'DEF' ? lineCounts.DEF + lineCounts.LAT : lineCounts[line];
                            const max = line === 'ARQ' ? 1 : maxFieldPlayersPerLine(team.length);
                            const canTuneLine = line !== 'ARQ';
                            const isDraggingPlayer = Boolean(dragState);
                            const isLineHoverTarget = Boolean(
                              dragHoverTarget?.teamIndex === teamIndex
                              && dragHoverTarget?.line === line
                              && !dragHoverTarget?.playerKey,
                            );
                            // La posicion fina del marcador la actualiza el arrastre directo
                            // sobre el DOM (--sorteo-drop-x) para no re-renderizar la cancha.
                            const markerLeft = 'clamp(22px, var(--sorteo-drop-x, 50%), calc(100% - 22px))';
                            const visibleLineCount = lineList.filter((player) => playerKey(player) !== String(dragState?.playerKey || '')).length;
                            const visualInsertIndex = isLineHoverTarget && Number.isFinite(Number(dragHoverTarget?.insertIndex))
                              ? Math.max(0, Math.min(Number(dragHoverTarget.insertIndex), visibleLineCount))
                              : null;
                            const markerLine = line === 'DEF' && visualInsertIndex !== null
                              ? defenseInsertRole(visibleLineCount, visualInsertIndex)
                              : (dragHoverTarget?.targetLine || line);
                            const lineValidationTarget = line === 'DEF' && visualInsertIndex !== null ? markerLine : line;
                            const lineDropValidation = isDraggingPlayer
                              ? (dropValidationByLine?.get(`${teamIndex}|${lineValidationTarget}`)
                                || validateDropTarget(dragState, teamIndex, lineValidationTarget, null))
                              : null;
                            const lineCanAcceptDrop = Boolean(lineDropValidation?.ok);
                            const lineBlockMessage = lineDropValidation && !lineDropValidation.ok ? lineDropValidation.message : '';
                            const isLineDropTarget = Boolean(lineCanAcceptDrop && isLineHoverTarget);
                            const lineDropClass = !isDraggingPlayer
                              ? ''
                              : (lineCanAcceptDrop
                                ? 'border-lime-200/70 bg-lime-200/15 ring-2 ring-lime-200/70'
                                : 'opacity-45');
                            const lineGridClass = '';
                            const lineModeClass = 'gf-formation-row';
                            const linePlayersClass = 'line-players gf-line-players';
                            const lineStyle = { '--gf-player-count': Math.max(1, lineList.length) };
                            return (
                              <div
                                key={line}
                                className={`formation-line ${hasProjectedLaterals ? 'is-projected-defense' : ''} ${isFormationEditor ? '' : (pitchLineToneClasses[line] || '')} ${lineModeClass} grid min-h-0 items-center border-b border-white/15 transition-colors duration-150 last:border-b-0 ${lineDropClass} ${lineGridClass}`}
                                style={lineStyle}
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
                                      <button className="inline-flex !h-7 !min-h-0 w-7 items-center justify-center rounded-md border border-emerald-200 bg-emerald-950 !p-0 text-sm font-black leading-none text-white shadow-sm transition hover:bg-emerald-900 max-[760px]:!h-5 max-[760px]:w-5 max-[760px]:text-xs" type="button" onClick={() => pitchLineDelta(teamIndex, line, -1)} aria-label={`Quitar jugador de ${label}`} title={`Quitar jugador de ${label}`}>−</button>
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className={linePlayersClass}
                                  data-sorteo-drop-line={line}
                                  data-team-index={teamIndex}
                                  data-player-count={lineList.length}
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
                                    const gapClass = opensGapBefore ? 'gf-insert-before' : '';
                                    const isSwapTarget = Boolean(
                                      dragState
                                      && dragHoverTarget?.playerKey === key
                                      && dragHoverTarget?.teamIndex === teamIndex
                                      && dragState.playerKey !== key,
                                    );
                                    return (
                                      <span
                                        key={key}
                                        className={`gf-player-slot relative ${gapClass}`}
                                        data-sorteo-line-player-item="1"
                                        data-player-key={key}
                                      >
                                        <CompactPlayerCard
                                          player={player}
                                          assignedPosition={assigned}
                                          teamSize={team.length}
                                          laneRole={assigned === 'LAT' ? 'lateral' : ''}
                                          onOpen={() => !dragState && !pointerDragRef.current.suppressClick && handleTouchCard(teamIndex, player, assigned)}
                                          draggableProps={{
                                            draggable: false,
                                            dragging: dragState?.playerKey === key,
                                            selected: mobileMoveSource?.playerKey === key,
                                            locked: Boolean(lockedPlayerPositions[key]),
                                            swapTarget: isSwapTarget,
                                            onPointerDown: (event) => handlePlayerPointerDown(event, teamIndex, player, assigned),
                                            onPointerMove: handlePlayerPointerMove,
                                            onPointerUp: handlePlayerPointerUp,
                                            onPointerCancel: handlePlayerPointerCancel,
                                            onTouchStart: (event) => handlePlayerTouchStart(event, teamIndex, player, assigned),
                                            onTouchMove: handlePlayerTouchMove,
                                            onTouchEnd: handlePlayerTouchEnd,
                                            onTouchCancel: handlePlayerTouchCancel,
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
                                                  dragMarkerRef.current = { teamIndex, line, x: insertX };
                                                  updateDragHoverTarget({ teamIndex, line, targetLine: targetLineForPlacement, insertIndex });
                                                  applyDropMarkerPosition();
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
                                        {playerExchanges.some(exchange => exchange.sourceKey === key || exchange.targetKey === key) ? (
                                          <button
                                            type="button"
                                            className="sorteo-exchange-indicator"
                                            aria-label={`Volver ${player.nombre} a su equipo y posicion inicial`}
                                            title="Deshacer intercambio y volver al equipo y posicion inicial"
                                            data-undo-player-exchange={key}
                                            onPointerDown={event => event.stopPropagation()}
                                            onTouchStart={event => event.stopPropagation()}
                                            onClick={event => { event.stopPropagation(); restorePlayerTeam(key, teamIndex); }}
                                          >
                                            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 5h11m-3-3 3 3-3 3M14 11H3m3-3-3 3 3 3" /></svg>
                                          </button>
                                        ) : null}
                                      </span>
                                    );
                                  })}
                                </div>
                                {canTuneLine ? (
                                  <div className="gf-line-add grid justify-items-center gap-1 max-[760px]:gap-0.5">
                                    <button className="inline-flex !h-7 !min-h-0 w-7 items-center justify-center rounded-md border border-lime-200 bg-lime-200 !p-0 text-sm font-black leading-none text-[#07130f] shadow-sm transition hover:bg-lime-300 max-[760px]:!h-5 max-[760px]:w-5 max-[760px]:text-xs" type="button" onClick={() => pitchLineDelta(teamIndex, line, 1)} aria-label={`Agregar jugador a ${label}`} title={`Agregar jugador a ${label}`}>+</button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        {isFormationEditor ? (
                        <div className="team-head grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:items-center sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <div className="min-w-0">
                            <h3 className="m-0 flex items-center gap-2 truncate text-lg font-black text-[#07130f]">
                              <span className={`h-3 w-3 shrink-0 rounded-full ${color.accent}`} style={{ backgroundColor: color.accentHex }} aria-hidden="true" />
                              {getTeamDisplayName(teamIndex)}
                            </h3>
                            <p className="m-0 text-xs font-semibold text-slate-500">{team.length} jugadores | {team.filter(isLowRhythmPlayer).length} lentos</p>
                          </div>
                          <span className={`inline-grid min-h-9 place-items-center rounded-md border px-3 text-sm font-black ${color.tag}`}>{summary.adjusted.toFixed(1)} pts</span>
                        </div>

                        ) : null}
                        <section className="grid gap-2 rounded-md border border-[#d7e6df] bg-white p-3" aria-label={`Banco de suplentes de ${getTeamDisplayName(teamIndex)}`} data-team-bench={teamIndex} data-empty={!(benches[teamIndex] || []).length}>
                          <h4 className="m-0 text-sm font-bold">Banco de suplentes ({(benches[teamIndex] || []).length})</h4>
                          {(benches[teamIndex] || []).length ? (benches[teamIndex] || []).map(player => (
                            <div key={playerKey(player)} className="flex items-center justify-between gap-2" data-bench-player={playerKey(player)}>
                              <span className="min-w-0 break-words text-sm font-semibold">{player.nombre}</span>
                              <button type="button" className={`${quietButtonClass} min-h-11 shrink-0`} onClick={() => changeBenchStatus(teamIndex, player, false)} data-html2canvas-ignore="true">Ingresar</button>
                            </div>
                          )) : <p className="m-0 text-xs text-[#526b62]">Sin suplentes</p>}
                        </section>

                        {isFormationEditor ? (
                        <div className="sorteo-team-stats grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 text-xs font-extrabold text-[#07130f] max-[760px]:gap-1 max-[760px]:p-1.5">
                          <div className="flex flex-wrap gap-1.5 max-[760px]:gap-1">
                            {(summary.arquero > 0 ? [['Arquero', summary.arquero]] : [['Ataque', summary.ataque]])
                              .concat([
                                ['Solidez', summary.solidez],
                                ['Velocidad', summary.ritmo],
                                ['Ida y vuelta', summary.resistencia],
                                ['Pase/Vision', summary.pase_vision],
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
                        ) : <details className="gf-team-metrics"><summary>Estadísticas del equipo</summary>
                        <div className="sorteo-team-stats grid gap-2 rounded-md border border-[#d7e6df] bg-white p-2 text-xs font-extrabold text-[#07130f] max-[760px]:gap-1 max-[760px]:p-1.5">
                          <div className="flex flex-wrap gap-1.5 max-[760px]:gap-1">
                            {(summary.arquero > 0 ? [['Arquero', summary.arquero]] : [['Ataque', summary.ataque]])
                              .concat([
                                ['Solidez', summary.solidez],
                                ['Velocidad', summary.ritmo],
                                ['Ida y vuelta', summary.resistencia],
                                ['Pase/Vision', summary.pase_vision],
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
                        </details>}
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

          {!isFormationEditor && teams && drawAnalysis ? (
            <section className="gf-quick-analysis" aria-label="Análisis rápido">
              <div className="gf-heading-row"><h2>Análisis del sorteo</h2><strong>Diferencia {drawAnalysis.diff.toFixed(1)}</strong></div>
              <p>{actionAnalysis?.balance} · {actionAnalysis?.risk}</p>
              <ul>{drawAnalysis.comparisons.slice(0, 3).map(item => <li key={item.field}>{item.label}: {item.highTeam} +{item.diff.toFixed(1)}</li>)}</ul>
              {drawAnalysis.ruleChecks.some(rule => !rule.ok) ? <p>{drawAnalysis.ruleChecks.filter(rule => !rule.ok).length} aspectos para revisar: {drawAnalysis.ruleChecks.filter(rule => !rule.ok).map(rule => rule.label).join(' · ')}</p> : <p>✓ Sin alertas en las reglas del sorteo.</p>}
              <table className="gf-quick-comparison"><caption>Comparación rápida</caption><thead><tr><th>Métrica</th>{drawAnalysis.summaries.map(item => <th key={item.name}>{item.name}</th>)}</tr></thead><tbody>{[['ataque', 'Ataque'], ['tecnica', 'Técnica'], ['ritmo', 'Velocidad']].map(([field, label]) => <tr key={field}><th>{label}</th>{drawAnalysis.summaries.map(item => <td key={item.name}>{item.statValues[field].toFixed(1)}</td>)}</tr>)}</tbody></table>
              <button className={quietButtonClass} type="button" onClick={toggleAnalysisPanel} aria-expanded={analysisVisible}>{analysisVisible ? 'Ocultar análisis completo' : 'Ver análisis completo / comparación completa'}</button>
            </section>
          ) : null}

          <div id="download-controls" data-save-state={displayedSaveState} className={`${teams ? 'grid' : 'hidden'} gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm lg:col-span-2 lg:row-start-3`}>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-black">
              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 ${saveStateClass}`}>
                <span className={`h-2 w-2 rounded-full ${displayedSaveState === 'saved' ? 'bg-emerald-500' : displayedSaveState === 'dirty' ? 'bg-amber-500' : 'bg-slate-400'}`} aria-hidden="true" />
                {saveStateLabel}
              </span>
              {manualActionCount > 0 ? (
                <span className="rounded-md border border-[#d7e6df] bg-[#f8fbfa] px-2.5 py-1.5 text-[#526b62]">
                  {manualActionCount} cambio{manualActionCount === 1 ? '' : 's'} manual{manualActionCount === 1 ? '' : 'es'}
                </span>
              ) : null}
            </div>
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
              {isFormationEditor ? <button className={secondaryButtonClass} type="button" onClick={toggleAnalysisPanel} aria-expanded={analysisVisible}>{analysisVisible ? 'Ocultar analisis' : 'Analizar equipos'}</button> : null}
              {lockedMatch ? (
                formationsReady && !isFormationEditor && formationsUrl ? <button className={primaryButtonClass} type="button" onClick={() => navigate(formationsUrl)}>Configurar formaciones →</button> :
                <button className={primaryButtonClass} type="button" onClick={isFormationEditor ? saveFormations : saveDraw} disabled={savingDraw}>
                  <Icon name="save" />{savingDraw ? 'Guardando…' : isFormationEditor ? 'Guardar formaciones' : 'Guardar equipos y continuar'}
                </button>
              ) : null}
            </div>
            {!isFormationEditor ? <p className="gf-save-help">{formationsReady ? 'Equipos guardados. El siguiente paso es configurar formaciones.' : 'Al guardar se habilitará la edición de formaciones.'}</p> : null}
            {manualActionCount > 0 || lockedPositionCount > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-[#7a4b00]">
                {manualActionCount > 0
                  ? `Hay ${manualActionCount} cambio${manualActionCount === 1 ? '' : 's'} manual${manualActionCount === 1 ? '' : 'es'} en cancha${lockedPositionCount > 0 ? `, con ${lockedPositionCount} posicion${lockedPositionCount === 1 ? '' : 'es'} bloqueada${lockedPositionCount === 1 ? '' : 's'}` : ''}.`
                  : `Hay ${lockedPositionCount} posicion${lockedPositionCount === 1 ? '' : 'es'} bloqueada${lockedPositionCount === 1 ? '' : 's'}.`} Al guardar se conservaran las posiciones actuales.
              </div>
            ) : null}
          </div>

          {teams && isFormationEditor ? (
            <div data-sorteo-mobile-actions="1" className={`fixed inset-x-0 bottom-0 z-50 grid ${mobileActionGridClass} gap-1 border-t border-[#d7e6df] bg-white px-2 py-2 shadow-[0_-2px_8px_rgba(7,19,15,.10)] min-[761px]:hidden`}>
              <span className={`col-span-full justify-self-end rounded-md border px-2 py-1 text-[11px] font-black ${saveStateClass}`}>
                {saveStateLabel}{manualActionCount > 0 ? ` | ${manualActionCount}` : ''}
              </span>
              <button className={`${quietButtonClass} sorteo-mobile-action-button disabled:cursor-wait disabled:opacity-70`} type="button" onClick={downloadTeamsJpg} disabled={exporting}>
                <Icon name="download" />
                {exporting ? 'JPG...' : 'JPG'}
              </button>
              <button className={`${secondaryButtonClass} sorteo-mobile-action-button`} type="button" onClick={toggleAnalysisPanel} aria-expanded={analysisVisible}>
                <Icon name="clipboard" />
                {analysisVisible ? 'Ocultar' : 'Analizar'}
              </button>
              {lockedMatch ? (
                <button className={`${primaryButtonClass} sorteo-mobile-action-button`} type="button" onClick={isFormationEditor ? saveFormations : saveDraw}>
                  <Icon name="save" />
                  Guardar
                </button>
              ) : null}
            </div>
          ) : null}

          {teams && analysisVisible && drawAnalysis ? (
            <section className="sorteo-analysis-panel grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm lg:col-span-2 lg:row-start-4" data-sorteo-analysis="1" aria-label="Analisis de equipos">
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

              {actionAnalysis ? (
                <div className="grid gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-3">
                  <div className="grid gap-2 text-xs font-bold text-[#526b62] sm:grid-cols-3">
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Equilibrio: <strong className="text-[#07130f]">{actionAnalysis.balance}</strong>
                    </p>
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Riesgo: <strong className="text-[#07130f]">{actionAnalysis.risk}</strong>
                    </p>
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Sugerencia: <strong className="text-[#07130f]">{actionAnalysis.suggestion}</strong>
                    </p>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {actionAnalysis.teams.map((item) => (
                      <div key={item.name} className="grid gap-1 rounded border border-[#d7e6df] bg-white px-2 py-2 text-xs font-bold text-[#526b62]">
                        <strong className="text-sm text-[#07130f]">{item.name}</strong>
                        <span>Jugador clave: <strong className="text-[#063d2b]">{item.keyPlayer}</strong></span>
                        <span>Ventaja: {item.strength}</span>
                        <span>A cuidar: {item.weakness}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {manualMoveComparison ? (
                <div className="grid gap-2 rounded-md border border-[#d7e6df] bg-[#f8fbfa] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm font-black text-[#07130f]">Antes / despues del cambio</strong>
                    <span className={`rounded-md border px-2 py-1 text-xs font-black ${manualMoveComparison.worsened > manualMoveComparison.improved ? 'border-amber-200 bg-amber-50 text-[#7a4b00]' : 'border-[#9fc8b5] bg-[#f4fbf7] text-[#063d2b]'}`}>
                      {manualMoveComparison.label}
                    </span>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {manualMoveComparison.rows.map((row) => (
                      <div key={row.field} className="grid gap-1 rounded border border-[#d7e6df] bg-white px-2 py-2 text-xs font-bold text-[#526b62]">
                        <div className="flex items-center justify-between gap-2">
                          <strong className="text-[#07130f]">{row.label}</strong>
                          <span className={row.status === 'mejora' ? 'text-[#063d2b]' : row.status === 'empeora' ? 'text-[#7a4b00]' : 'text-[#526b62]'}>
                            {row.status === 'mejora' ? 'Mejora' : row.status === 'empeora' ? 'Empeora' : 'Igual'}
                          </span>
                        </div>
                        <span>Antes {row.before.toFixed(1)} / Despues {row.after.toFixed(1)} / {row.delta > 0 ? '+' : ''}{row.delta.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Lineas: {drawAnalysis.lineStrengthSpread <= 2 ? 'fuerza similar por sector' : `diferencia de ${drawAnalysis.lineStrengthSpread.toFixed(1)} en una linea`}.
                    </p>
                    <p className="m-0 rounded border border-[#d7e6df] bg-white px-2 py-2">
                      Perfiles: {drawAnalysis.profileDistributionSpread <= 1 ? 'fuertes y flojos bien repartidos' : `desbalance de ${drawAnalysis.profileDistributionSpread}`}.
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
                    <TeamRadar stats={summary.statValues} title={`Radar ${summary.name}`} />
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
          {teams && !isFormationEditor && lockedMatch ? (
            <div className="gf-sticky-save" data-sorteo-mobile-actions="1" aria-label="Guardar y continuar">
              <span role="status">{saveStateLabel}</span>
              {formationsReady && formationsUrl ? <button className={primaryButtonClass} type="button" onClick={() => navigate(formationsUrl)}>Formaciones →</button> : <button className={primaryButtonClass} type="button" disabled={savingDraw} onClick={saveDraw}>{savingDraw ? 'Guardando…' : 'Guardar'}</button>}
            </div>
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

      {mobileMoveSource && mobileMovePlayer ? (
        <div id="gf-tap-tools" role="region" aria-label="Mover o intercambiar jugador" className={isFormationEditor ? "sorteo-mobile-tray fixed inset-x-0 bottom-[88px] z-[60] grid max-h-[60dvh] gap-2 overflow-y-auto border-t border-[#d7e6df] bg-white px-3 py-3 shadow-[0_-2px_8px_rgba(7,19,15,.10)] min-[761px]:hidden" : "gf-tap-tools sorteo-mobile-tray grid gap-2 border-t border-[#d7e6df] bg-white p-3 min-[761px]:hidden"}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <strong className="block truncate text-sm font-black text-[#07130f]">{mobileMoveSource.playerName}</strong>
              <span className="text-xs font-bold text-[#526b62]">{getTeamDisplayName(Number(mobileMoveSource.teamIndex))} · Mover desde {mobileMoveSource.assignedPosition}</span>
            </div>
            <div className="flex shrink-0 gap-1">
              <button className={quietButtonClass} type="button" onClick={() => { setPreview({ player: mobileMovePlayer, assignedPosition: mobileMoveSource.assignedPosition, teamSize: teams?.[Number(mobileMoveSource.teamIndex)]?.length || playersPerTeam }); setMobileMoveSource(null); }}>
                Ficha
              </button>
              <button className={quietButtonClass} type="button" onClick={() => setMobileMoveSource(null)} aria-label="Cerrar destinos">
                Cancelar
              </button>
            </div>
          </div>
          <button type="button" className={quietButtonClass} onClick={() => changeBenchStatus(Number(mobileMoveSource.teamIndex), mobileMovePlayer, true)}>Enviar al banco</button>
          <div className="grid grid-cols-5 gap-1">
            {FORMATION_LINES.map((line) => {
              const validation = validateDropTarget(mobileMoveSource, Number(mobileMoveSource.teamIndex), line, null);
              const isCurrent = line === mobileMoveSource.assignedPosition;
              return (
                <button
                  key={`mobile-target-${line}`}
                  className={`min-h-10 rounded-md border px-1 text-xs font-black ${validation.ok && !isCurrent ? 'border-[#063d2b] bg-[#063d2b] text-white' : 'border-[#d7e6df] bg-[#f8fbfa] text-[#526b62] disabled:opacity-55'}`}
                  type="button"
                  disabled={!validation.ok || isCurrent}
                  onClick={() => movePlayer(mobileMoveSource, Number(mobileMoveSource.teamIndex), line, null)}
                  title={validation.message || `Mover a ${line}`}
                >
                  {line}
                </button>
              );
            })}
          </div>
          {!isFormationEditor ? <p className="gf-tap-hint" role="status">{mobileMoveSource.playerName} seleccionado — tocá un jugador del otro equipo para intercambiar.</p> : null}
          {renderExchangeTargets(mobileMoveSource)}
        </div>
      ) : null}

      {preview ? (
        <>
          <button className="fixed inset-0 z-[80] bg-black/70" type="button" aria-label="Cerrar ficha" onClick={() => setPreview(null)} />
          <section className="fixed inset-0 z-[90] grid place-items-center overflow-auto p-4" role="dialog" aria-modal="true" aria-label={`Ficha de ${preview.player.nombre}`}>
            <div className="grid w-full max-w-4xl items-start gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="relative grid aspect-[409/710] w-[168px] place-items-center overflow-visible justify-self-center md:w-[220px]">
                <div className="origin-center scale-100 md:scale-[1.3]">
                  <FullPlayerCard player={preview.player} assignedPosition={preview.assignedPosition} teamSize={preview.teamSize || playersPerTeam} />
                </div>
              </div>
              <aside className="grid gap-3 rounded-lg border border-white/15 bg-black/72 p-3 text-white shadow-sm">
                <div>
                  <h3 className="m-0 text-base font-black">{preview.player.nombre}</h3>
                  <p className="m-0 text-xs font-semibold text-white/70">Puntaje por posicion</p>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {playerPositionRatings(preview.player, preview.assignedPosition, preview.teamSize || playersPerTeam).map((rating) => (
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
                {(() => {
                  const teamIndex = teams?.findIndex(team => team.some(player => playerKey(player) === playerKey(preview.player))) ?? -1;
                  if (teamIndex < 0) return null;
                  return renderExchangeTargets({ teamIndex, playerKey: playerKey(preview.player), playerName: preview.player.nombre, assignedPosition: preview.assignedPosition });
                })()}
                {teams?.some(team => team.some(player => playerKey(player) === playerKey(preview.player))) ? (
                  <button type="button" className={quietButtonClass} onClick={() => changeBenchStatus(teams.findIndex(team => team.some(player => playerKey(player) === playerKey(preview.player))), preview.player, true)}>Enviar al banco</button>
                ) : null}
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

      {dragState && teams ? <div className="pointer-events-none fixed inset-x-0 top-1/2 z-[110] flex justify-between min-[761px]:hidden" aria-hidden="true">
        {visibleTeamIndex > 0 ? <span className="rounded-r border border-white bg-[#075bb5] px-2 py-3 text-xs font-bold text-white">←<br />Otra cancha</span> : <span />}
        {visibleTeamIndex < teams.length - 1 ? <span className="rounded-l border border-white bg-[#075bb5] px-2 py-3 text-right text-xs font-bold text-white">→<br />Otra cancha</span> : <span />}
      </div> : null}
      {dragState && teams ? (
        <div
          ref={dragGhostRef}
          className="pointer-events-none fixed left-0 top-0 z-[100] [will-change:transform]"
          data-sorteo-drag-ghost="1"
          style={{ width: dragState.cardWidth || 64 }}
        >
          <div className="absolute -left-7 -top-3 h-9 w-9 rounded-full bg-lime-200/30 blur-md" />
          <div className="absolute -left-10 -top-6 h-16 w-16 rounded-full border border-lime-200/50" />
          <div className="relative transition-transform duration-100" style={{ width: '100%' }}>
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
            <div className="overflow-hidden rounded-lg ring-2 ring-lime-200 shadow-[0_18px_34px_rgba(2,14,9,.6),0_0_0_2px_rgba(217,249,157,.5)]">
              <CompactPlayerCard player={dragState.player} assignedPosition={dragState.assignedPosition} teamSize={teams?.[dragState.teamIndex]?.length || playersPerTeam} />
            </div>
            <span className="block w-full text-center text-[11px] font-black uppercase leading-tight text-lime-100 [text-shadow:0_1px_2px_rgba(0,0,0,.8)]">Soltar para mover</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
