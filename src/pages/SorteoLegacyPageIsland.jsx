import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const FORMATION_LINES = ['ARQ', 'DEF', 'LAT', 'MED', 'DEL'];
const PITCH_LINES = ['ARQ', 'DEF', 'MED', 'DEL'];
const FIELD_LINES = ['DEF', 'LAT', 'MED', 'DEL'];
const REQUIRED_FIELD_LINES = ['DEF', 'MED', 'DEL'];
const POSITION_ORDER = { ARQ: 0, DEF: 1, LAT: 2, MED: 3, DEL: 4 };
const POSITION_LABELS = { ARQ: 'Arquero', DEF: 'Defensa', LAT: 'Lateral', MED: 'Medio', DEL: 'Delantero' };
const STRICT_MAX_DIFF = 2.5;
const FLEXIBLE_MAX_DIFF = 6;

const cardBackgrounds = {
  bronze: 'assets/card-backgrounds/reference-bronze.png',
  silver: 'assets/card-backgrounds/reference-silver.png',
  gold: 'assets/card-backgrounds/reference-gold.png',
  elite: 'assets/card-backgrounds/reference-elite.png',
};

const compactCardBackgrounds = {
  bronze: 'assets/card-backgrounds/reference-compact-bronze.png',
  silver: 'assets/card-backgrounds/reference-compact-silver.png',
  gold: 'assets/card-backgrounds/reference-compact-gold.png',
  elite: 'assets/card-backgrounds/reference-compact-elite.png',
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
const inputClass = `min-h-10 rounded-lg border border-[#c9d8d1] bg-white px-3 text-sm font-bold text-[#07130f] outline-none transition focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60`;
const quietButtonClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#c9d8d1] bg-white px-3 text-sm font-extrabold text-[#063d2b] transition-colors hover:border-[#9fc8b5] hover:bg-[#f4fbf7] ${focusRing}`;
const primaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#063d2b] bg-[#063d2b] px-4 text-sm font-black text-white shadow-sm transition-colors hover:bg-[#082f23] disabled:cursor-wait disabled:opacity-70 ${focusRing}`;
const secondaryButtonClass = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#9fc8b5] bg-[#eaf7f0] px-4 text-sm font-black text-[#063d2b] transition-colors hover:border-[#063d2b] hover:bg-[#dff1e8] ${focusRing}`;
const dangerButtonClass = `inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-extrabold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 ${focusRing}`;
const iconButtonClass = `grid h-9 w-9 place-items-center rounded-lg border border-[#d7e6df] bg-white text-[#526b62] transition-colors hover:border-[#9fc8b5] hover:bg-[#f7fbf9] hover:text-[#063d2b] ${focusRing}`;
const pitchBackgroundClass = 'bg-[linear-gradient(rgba(5,37,27,.10),rgba(5,37,27,.24)),url(/assets/images/captain-field-bg-vertical.jpg),linear-gradient(160deg,#0e7a43,#07563d)] [background-position:center,center,center] [background-repeat:no-repeat,no-repeat,no-repeat] [background-size:auto,100%_100%,auto]';

function parsePayload(root) {
  try {
    const parsed = JSON.parse(root.dataset.payload || '{}');
    return {
      matchId: Number(parsed.matchId || 0),
      match: parsed.match || null,
      players: Array.isArray(parsed.players) ? parsed.players : [],
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
      matchId: 0,
      match: null,
      players: [],
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

function statValue(player, field) {
  const fallback = field === 'regularidad' ? 3.5 : (field === 'mentalidad' ? 3 : Number(player?.puntuacion || 3));
  return normalizeSix(player?.[field], fallback);
}

function isLowRhythmPlayer(player) {
  return statValue(player, 'ritmo_stat') <= 3;
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
  return applyRegularityAdjustment(positionBaseRating(player, position), player);
}

function positionPenaltyPercent(player, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (!position || getOrderedPlayerPositions(player).includes(position)) return 0;
  const general = Number(player?.puntuacion || 0);
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
  if (overall >= 90) return 'elite';
  if (overall >= 80) return 'gold';
  if (overall >= 65) return 'silver';
  return 'bronze';
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
  return Math.max(0, Math.floor(Number(teamSize || 0) / 3));
}

function maxDefLatPlayersPerPosition(teamSize) {
  return Math.max(0, Math.floor(Number(teamSize || 0) / 4));
}

function fieldLineLimit(position, teamSize) {
  const line = String(position || '').toUpperCase();
  if (line === 'ARQ') return 1;
  if (line === 'DEF' || line === 'LAT') return maxDefLatPlayersPerPosition(teamSize);
  return maxFieldPlayersPerLine(teamSize);
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
    assignment[key] = FORMATION_LINES.includes(override) ? override : getPrimaryPlayerPosition(player);
  });

  const goalkeeperCandidates = team
    .slice()
    .sort((a, b) => {
      const aCan = canPlayGoalkeeper(a);
      const bCan = canPlayGoalkeeper(b);
      if (aCan !== bCan) return aCan ? -1 : 1;
      const priorityDiff = goalkeeperSortValue(a) - goalkeeperSortValue(b);
      if (priorityDiff) return priorityDiff;
      return adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ');
    });
  const chosenGoalkeeper = goalkeeperCandidates[0];
  if (chosenGoalkeeper) {
    assignment[playerKey(chosenGoalkeeper)] = 'ARQ';
  }
  team.forEach((player) => {
    if (player !== chosenGoalkeeper && assignment[playerKey(player)] === 'ARQ') {
      assignment[playerKey(player)] = bestNaturalPlayerPosition(player) === 'ARQ' ? 'MED' : bestNaturalPlayerPosition(player);
    }
  });

  if (team.length >= 4) {
    REQUIRED_FIELD_LINES.forEach((line) => {
      const hasLine = team.some((player) => pitchLineForPosition(assignment[playerKey(player)]) === line);
      if (hasLine) return;
      const candidate = team
        .filter((player) => assignment[playerKey(player)] !== 'ARQ')
        .sort((a, b) => adjustedPositionRating(b, line) - adjustedPositionRating(a, line))[0];
      if (candidate) assignment[playerKey(candidate)] = line;
    });
  }

  return assignment;
}

function teamLineCounts(team, assignments) {
  const counts = Object.fromEntries(FORMATION_LINES.map((line) => [line, 0]));
  team.forEach((player) => {
    const position = assignments[playerKey(player)] || getPrimaryPlayerPosition(player);
    if (counts[position] !== undefined) counts[position] += 1;
  });
  return counts;
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
      return assigned === 'ARQ' ? Math.max(max, statValue(player, 'habilidad_arquero')) : max;
    }, 0),
  };
}

function average(team, field) {
  if (!team.length) return 0;
  return team.reduce((sum, player) => sum + statValue(player, field), 0) / team.length;
}

function scoreTeams(teams, pairHistory, assignmentOverrides = {}, weights = {}) {
  const totals = teams.map((team) => teamScore(team, assignmentOverrides));
  const diff = Math.max(...totals) - Math.min(...totals);
  const slowCounts = teams.map((team) => team.filter(isLowRhythmPlayer).length);
  const slowSpread = Math.max(...slowCounts) - Math.min(...slowCounts);
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
      if (teamSize >= 4 && pitchCounts[line] < 1) penalty += 120;
      if (pitchCounts[line] > maxFieldPlayersPerLine(teamSize)) penalty += (pitchCounts[line] - maxFieldPlayersPerLine(teamSize)) * 30;
    });
    FIELD_LINES.forEach((line) => {
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
  return {
    value: (diff * 1000) + (slowSpread * 60) + linePenalty + statPenalty + historicalRepeatPenalty(teams, pairHistory),
    diff,
    slowSpread,
    totals,
  };
}

function buildCandidateTeams(players, numTeams, teamSize, pairHistory, weights) {
  const teams = Array.from({ length: numTeams }, () => []);
  const goalkeepers = shuffle(players.filter(canPlayGoalkeeper))
    .sort((a, b) => {
      const priorityDiff = goalkeeperSortValue(a) - goalkeeperSortValue(b);
      if (priorityDiff) return priorityDiff;
      return adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ');
    })
    .slice(0, numTeams);
  if (goalkeepers.length < numTeams) return null;
  goalkeepers.forEach((player, index) => teams[index].push(player));
  const goalkeeperKeys = new Set(goalkeepers.map(playerKey));
  const remaining = shuffle(players.filter((player) => !goalkeeperKeys.has(playerKey(player))))
    .sort((a, b) => bestNaturalPlayerRating(b) - bestNaturalPlayerRating(a));

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

function generateBalancedTeams(players, numTeams, maxDiff, pairHistory, weights, avoidSignatures = new Set()) {
  const teamSize = players.length / numTeams;
  const attempts = Math.min(900, Math.max(220, players.length * players.length * 3));
  let best = null;
  let bestEval = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = buildCandidateTeams(shuffle(players), numTeams, teamSize, pairHistory, weights);
    if (!candidate) continue;
    const improved = improveBySwaps(candidate, teamSize, pairHistory, weights);
    const signature = drawSignature(improved.teams);
    const signaturePenalty = avoidSignatures.has(signature) ? 100000000 : 0;
    const evaluation = { ...improved.evaluation, value: improved.evaluation.value + signaturePenalty, signature };
    if (!bestEval || evaluation.value < bestEval.value) {
      best = improved.teams;
      bestEval = evaluation;
      if (!signaturePenalty && bestEval.diff <= maxDiff && bestEval.slowSpread <= 1) break;
    }
  }
  return best ? { teams: best, evaluation: bestEval, usedMaxDiff: Math.max(maxDiff, bestEval.diff) } : null;
}

function getFormationOptions(teamSize) {
  const fieldPlayers = Math.max(0, teamSize - 1);
  const maxPerLine = maxFieldPlayersPerLine(teamSize);
  const maxDefLat = maxDefLatPlayersPerPosition(teamSize);
  const candidates = [];
  for (let def = 0; def <= Math.min(maxDefLat, fieldPlayers); def += 1) {
    for (let lat = 0; lat <= Math.min(maxDefLat, fieldPlayers - def); lat += 1) {
      for (let med = 0; med <= Math.min(maxPerLine, fieldPlayers - def - lat); med += 1) {
        const del = fieldPlayers - def - lat - med;
        if (del < 0 || del > maxPerLine) continue;
        if (fieldPlayers >= 3 && ((def + lat) < 1 || med < 1 || del < 1)) continue;
        const balance = Math.max(def + lat, med, del) - Math.min(def + lat, med, del);
        candidates.push({ DEF: def, LAT: lat, MED: med, DEL: del, value: `${def}-${lat}-${med}-${del}`, balance });
      }
    }
  }
  return candidates
    .sort((a, b) => a.balance - b.balance || b.MED - a.MED || (b.DEF + b.LAT) - (a.DEF + a.LAT) || b.DEL - a.DEL)
    .slice(0, 5);
}

function parseFormationValue(value) {
  const parts = String(value || '').split('-').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  return { DEF: parts[0], LAT: parts[1], MED: parts[2], DEL: parts[3] };
}

function applyFormationToTeam(team, value) {
  const counts = parseFormationValue(value);
  if (!counts) return {};
  const assignments = {};
  const goalkeeper = team.slice().sort((a, b) => adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ'))[0];
  if (goalkeeper) assignments[playerKey(goalkeeper)] = 'ARQ';
  const remaining = team.filter((player) => playerKey(player) !== playerKey(goalkeeper));
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
  const positions = getOrderedPlayerPositions(player);
  const isLongName = player.nombre.length > 12;
  const fullCardText = 'text-[#f7fff9] [text-shadow:0_2px_0_rgba(0,0,0,.82),0_1px_6px_rgba(0,0,0,.55)]';
  return (
    <article
      className="relative mx-auto block aspect-[409/710] w-[168px] overflow-hidden border-0 bg-transparent p-0 drop-shadow-[0_7px_12px_rgba(2,14,9,0.22)]"
      style={{ background: `url("${cardBackgrounds[tier] || cardBackgrounds.bronze}") center / contain no-repeat`, fontFamily: '"Barlow Condensed", sans-serif' }}
      aria-label={`Ficha de ${player.nombre}`}
      data-sorteo-full-card="1"
    >
      <span className="absolute left-[9%] right-[8%] top-[8.8%] z-20 h-[49%] bg-gradient-to-b from-transparent via-[#07130f]/6 to-[#07130f]/34" aria-hidden="true" />
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
      >
        <img className={`h-full w-full object-contain object-top ${player.has_custom_photo ? '' : 'opacity-56'}`} src={player.photo_path} alt="" />
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

function CompactPlayerCard({ player, assignedPosition, draggableProps = {}, onOpen }) {
  const { dragging = false, ...domDraggableProps } = draggableProps;
  const adjusted = adjustedPositionRating(player, assignedPosition);
  const tier = playerCardTier(adjusted);
  const palette = cardPalettes[tier] || cardPalettes.bronze;
  const widthClass = 'w-[44px] min-[380px]:w-[54px] sm:w-[60px] xl:w-[72px] 2xl:w-[78px]';
  const outOfPosition = !getOrderedPlayerPositions(player).includes(assignedPosition);
  const secondary = !outOfPosition && assignedPosition !== getPrimaryPlayerPosition(player);
  const longName = String(player.nombre || '').trim().length > 8 || String(player.nombre || '').includes(' ');
  const veryLongName = String(player.nombre || '').trim().length > 11 || String(player.nombre || '').trim().split(/\s+/).some((part) => part.length > 8);
  const nameFontSize = veryLongName ? 'clamp(5.4px, 0.72vw, 9px)' : longName ? 'clamp(6px, 0.82vw, 10.5px)' : 'clamp(6.8px, 0.9vw, 12px)';
  return (
    <button
      type="button"
      className={`relative block aspect-[409/620] ${widthClass} shrink-0 overflow-hidden border-0 bg-transparent p-0 text-left drop-shadow-[0_4px_7px_rgba(2,14,9,0.24)] transition ${dragging ? 'scale-95 opacity-55' : 'hover:scale-[1.03]'}`}
      style={{ background: `url("${compactCardBackgrounds[tier] || compactCardBackgrounds.bronze}") center / contain no-repeat`, fontFamily: '"Barlow Condensed", sans-serif' }}
      onClick={onOpen}
      aria-label={`Ver ficha de ${player.nombre}`}
      {...domDraggableProps}
    >
      <span className="absolute left-[9%] right-[8%] top-[10.1%] z-20 h-[56.1%] bg-gradient-to-b from-transparent via-[#07130f]/8 to-[#07130f]/38" aria-hidden="true" />
      <span className={`absolute left-[14.2%] top-[15.8%] z-30 grid h-[29.8%] w-[23.2%] content-start justify-items-center ${palette.text}`}>
        <strong className="text-[.6rem] font-black leading-[.8] min-[380px]:text-[.66rem] sm:text-[.9rem] xl:text-[1.12rem]">{playerCardRating(adjusted)}</strong>
        <span className="mt-0.5 grid justify-items-center gap-px leading-none">
          <span className={`text-[.28rem] font-black uppercase leading-none min-[380px]:text-[.31rem] sm:text-[.44rem] xl:text-[.54rem] ${outOfPosition ? 'text-[#ffb4a8]' : secondary ? 'text-[#ffe9a6]' : ''}`}>{assignedPosition}</span>
          <span className="block aspect-square w-[8px] min-[380px]:w-[9px] sm:w-[11px]"><Arrow form={playerRegularityForm(player)} /></span>
        </span>
      </span>
      <span
        className="absolute left-[36.4%] right-[13.3%] top-[14.8%] z-10 flex h-[42.1%] items-start justify-center overflow-hidden"
        style={{ WebkitMaskImage: 'linear-gradient(180deg,#000 0 74%,transparent 100%)', maskImage: 'linear-gradient(180deg,#000 0 74%,transparent 100%)' }}
      >
        <img className={`h-full w-full object-contain object-top ${player.has_custom_photo ? '' : 'opacity-50'}`} src={player.photo_path} alt="" />
      </span>
      <strong
        className={`absolute left-[8.5%] right-[7.5%] top-[58.8%] z-30 grid h-[18.2%] place-items-center overflow-hidden px-0.5 text-center font-black uppercase leading-[.92] whitespace-normal break-words ${palette.text}`}
        style={{ fontSize: nameFontSize }}
      >
        {player.nombre}
      </strong>
    </button>
  );
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
      <section className="fixed inset-x-3 top-8 z-50 mx-auto grid max-w-md gap-4 rounded-lg border border-[#c9d8d1] bg-white p-4 shadow-[0_18px_42px_rgba(7,19,15,.24)]" role="dialog" aria-modal="true" aria-label={title}>
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
  const [players, setPlayers] = useState(() => payload.players.map(normalizePlayer));
  const [manualGoalkeepers, setManualGoalkeepers] = useState(() => initialManualGoalkeepers(payload.players.map(normalizePlayer)));
  const [numTeams] = useState(payload.numTeams);
  const [maxDiff, setMaxDiff] = useState(0.5);
  const [sortKey, setSortKey] = useState('nombre');
  const [sortDirection, setSortDirection] = useState(1);
  const [teams, setTeams] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [teamColors, setTeamColors] = useState(() => Array.from({ length: payload.numTeams }, (_, index) => teamColorOptions[index % teamColorOptions.length].name));
  const [teamFormations, setTeamFormations] = useState({});
  const [undoStacks, setUndoStacks] = useState({});
  const [error, setError] = useState(payload.loadError);
  const [success, setSuccess] = useState('');
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [formModal, setFormModal] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragState, setDragState] = useState(null);
  const [dragPoint, setDragPoint] = useState(null);
  const [persistedRedrawCount, setPersistedRedrawCount] = useState(payload.redrawCount);
  const [redrawsUsedThisSession, setRedrawsUsedThisSession] = useState(0);
  const [hasSavedDraw, setHasSavedDraw] = useState(payload.hasSavedDraw);
  const [generatedOnce, setGeneratedOnce] = useState(false);
  const seenDrawSignatures = useRef(new Set(payload.savedDrawSignature ? [payload.savedDrawSignature] : []));
  const teamsContainerRef = useRef(null);

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

    setGenerating(true);
    await new Promise((resolve) => requestAnimationFrame(() => window.setTimeout(resolve, 20)));
    try {
      const avoidSignatures = new Set(seenDrawSignatures.current);
      if (teams) avoidSignatures.add(drawSignature(teams));
      let result = null;
      for (let diff = Math.max(0.5, maxDiff); diff <= FLEXIBLE_MAX_DIFF; diff += 0.5) {
        result = generateBalancedTeams(candidates, numTeams, Math.min(diff, STRICT_MAX_DIFF), payload.pairHistory, payload.drawBalanceWeights, nextGenerationIsRedraw ? avoidSignatures : new Set());
        if (result && (!nextGenerationIsRedraw || !avoidSignatures.has(drawSignature(result.teams)))) break;
      }
      if (!result) {
        setError('No se encontro una combinacion valida con los jugadores seleccionados.');
        return null;
      }
      const signature = drawSignature(result.teams);
      if (signature) seenDrawSignatures.current.add(signature);
      setTeams(result.teams);
      setAssignments({});
      setTeamFormations({});
      setUndoStacks({});
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
    }
  }, [lockedMatch, manualGoalkeepers, maxDiff, nextGenerationIsRedraw, numTeams, payload.allowRedraw, payload.drawBalanceWeights, payload.pairHistory, payload.redrawLimit, players, redrawsRemaining, teams]);

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

  const setTeamColor = (teamIndex, colorName) => {
    if (teamColorTaken(colorName, teamIndex)) {
      setError('Cada equipo necesita un color de camiseta distinto.');
      return;
    }
    setError('');
    setTeamColors((current) => current.map((item, index) => (index === teamIndex ? colorName : item)));
  };

  const applyFormation = (teamIndex, value) => {
    if (!teams?.[teamIndex]) return;
    pushUndo(teamIndex);
    setTeamFormations((current) => ({ ...current, [teamIndex]: value }));
    if (value === 'auto') {
      const teamKeys = new Set(teams[teamIndex].map(playerKey));
      setAssignments((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !teamKeys.has(key))));
      return;
    }
    const nextAssignments = applyFormationToTeam(teams[teamIndex], value);
    setAssignments((current) => ({ ...current, ...nextAssignments }));
  };

  const lineDelta = (teamIndex, line, delta) => {
    if (!teams?.[teamIndex]) return;
    const team = teams[teamIndex];
    const currentAssignments = buildTeamAssignment(team, assignments);
    pushUndo(teamIndex);
    if (delta > 0) {
      const candidate = team
        .filter((player) => currentAssignments[playerKey(player)] !== line && currentAssignments[playerKey(player)] !== 'ARQ')
        .sort((a, b) => adjustedPositionRating(b, line) - adjustedPositionRating(a, line))[0];
      if (candidate) setAssignments((current) => ({ ...current, [playerKey(candidate)]: line }));
      return;
    }
    const candidate = team
      .filter((player) => currentAssignments[playerKey(player)] === line)
      .sort((a, b) => adjustedPositionRating(a, line) - adjustedPositionRating(b, line))[0];
    if (candidate) {
      const fallback = bestNaturalPlayerPosition(candidate) === line ? 'MED' : bestNaturalPlayerPosition(candidate);
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
    pushUndo(teamIndex);

    if (delta > 0) {
      const perPositionLimit = maxDefLatPlayersPerPosition(team.length);
      const candidate = team
        .filter((player) => {
          const currentLine = currentAssignments[playerKey(player)];
          return currentLine !== 'ARQ' && currentLine !== 'DEF' && currentLine !== 'LAT';
        })
        .flatMap((player) => ['DEF', 'LAT']
          .filter((targetLine) => (counts[targetLine] || 0) < perPositionLimit)
          .map((targetLine) => ({ player, targetLine, rating: adjustedPositionRating(player, targetLine) })))
        .sort((a, b) => b.rating - a.rating)[0];
      if (candidate) setAssignments((current) => ({ ...current, [playerKey(candidate.player)]: candidate.targetLine }));
      return;
    }

    const candidate = team
      .filter((player) => ['DEF', 'LAT'].includes(currentAssignments[playerKey(player)]))
      .sort((a, b) => {
        const assignedA = currentAssignments[playerKey(a)];
        const assignedB = currentAssignments[playerKey(b)];
        return adjustedPositionRating(a, assignedA) - adjustedPositionRating(b, assignedB);
      })[0];
    if (candidate) {
      const fallback = bestNaturalPlayerPosition(candidate);
      setAssignments((current) => ({ ...current, [playerKey(candidate)]: fallback === 'ARQ' || fallback === 'DEF' || fallback === 'LAT' ? 'MED' : fallback }));
    }
  };

  const movePlayer = (source, targetTeamIndex, targetLine = null, targetPlayerKey = null) => {
    if (!teams || source == null) return;
    const sourceTeamIndex = Number(source.teamIndex);
    const key = String(source.playerKey);
    if (!Number.isFinite(sourceTeamIndex) || !teams[sourceTeamIndex]) return;
    pushUndo(targetTeamIndex);
    if (sourceTeamIndex !== targetTeamIndex) pushUndo(sourceTeamIndex);
    setTeams((current) => {
      if (!current) return current;
      const next = current.map((team) => team.slice());
      const sourceIndex = next[sourceTeamIndex].findIndex((player) => playerKey(player) === key);
      if (sourceIndex < 0) return current;
      const [moving] = next[sourceTeamIndex].splice(sourceIndex, 1);
      if (targetPlayerKey) {
        const targetIndex = next[targetTeamIndex].findIndex((player) => playerKey(player) === targetPlayerKey);
        if (targetIndex >= 0) {
          const [target] = next[targetTeamIndex].splice(targetIndex, 1, moving);
          next[sourceTeamIndex].splice(sourceIndex, 0, target);
          return next;
        }
      }
      next[targetTeamIndex].push(moving);
      return next;
    });
    if (targetLine && FORMATION_LINES.includes(targetLine)) {
      setAssignments((current) => ({ ...current, [key]: targetLine }));
    }
  };

  const handleDragStart = (event, teamIndex, player, assignedPosition) => {
    const source = { teamIndex, playerKey: playerKey(player), assignedPosition };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify(source));
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    event.dataTransfer.setDragImage(img, 0, 0);
    setDragState({ ...source, player });
    setDragPoint({ x: event.clientX, y: event.clientY });
  };

  const sourceFromDragEvent = (event) => {
    try {
      return JSON.parse(event.dataTransfer.getData('application/json') || '{}');
    } catch {
      return dragState;
    }
  };

  const handleDrop = (event, teamIndex, line, targetPlayerKey = null) => {
    event.preventDefault();
    const source = sourceFromDragEvent(event);
    movePlayer(source, teamIndex, line, targetPlayerKey);
    setDragState(null);
    setDragPoint(null);
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
    if (typeof window.html2canvas !== 'function') {
      setError('No se pudo cargar el exportador de imagen. Recarga la pagina e intenta de nuevo.');
      return;
    }
    setExporting(true);
    try {
      const canvas = await window.html2canvas(teamsContainerRef.current, {
        backgroundColor: '#f6faf8',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `formaciones_goodfellas_${new Date().toISOString().slice(0, 10)}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch {
      setError('Hubo un error al generar la imagen.');
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
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || 'No se pudo guardar el sorteo.');
      setPersistedRedrawCount((value) => value + redrawsUsedThisSession);
      setRedrawsUsedThisSession(0);
      setHasSavedDraw(true);
      setGeneratedOnce(false);
      setError('');
      setSuccess(data.message || 'Sorteo guardado correctamente en la fecha.');
      window.setTimeout(() => navigate(payload.links?.back || 'editar_partidos.php'), 700);
    } catch (saveError) {
      setSuccess('');
      setError(saveError.message || 'No se pudo guardar el sorteo.');
    }
  };

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
      }}
    >
      <div className="grid gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button className={quietButtonClass} type="button" onClick={() => navigate(payload.links?.back || 'editar_partidos.php')}>
            <Icon name="arrowLeft" />
            Volver a fechas
          </button>
          {payload.match ? (
            <button className={secondaryButtonClass} type="button" onClick={() => navigate(payload.links?.finish)}>
              <Icon name="calendar" />
              Finalizar fecha
            </button>
          ) : (
            <button className={secondaryButtonClass} type="button" onClick={() => setFormModal({ mode: 'add' })}>
              <Icon name="plus" />
              Agregar jugador
            </button>
          )}
        </div>

        <header className="grid gap-3 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="m-0 text-xs font-extrabold uppercase tracking-[.12em] text-[#526b62]">Sorteo de equipos</p>
            <h1 className="m-0 text-xl font-black leading-tight text-[#07130f] sm:text-2xl">Generador GOODFELLAS</h1>
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
              <b className="block text-base font-black text-[#07130f]">{maxDiff}</b>
              <small className="text-[10px] font-extrabold uppercase text-[#526b62]">Diferencia</small>
            </span>
          </div>
        </header>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
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

        <main className={`grid content-start gap-4 lg:contents ${lockedMatch ? 'max-lg:order-1' : ''}`}>
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
                <input className="h-8 w-16 rounded-md border border-[#c9d8d1] bg-white px-2 text-center text-sm font-black text-[#07130f]" type="number" min="0.5" max="6" step="0.5" value={maxDiff} onChange={(event) => setMaxDiff(event.target.value)} />
              </label>
            </div>
            <div id="generateTeamsLoading" className={`${generating ? 'block' : 'hidden'} rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-800`} role="status" aria-live="polite">
              <strong className="block">Generando equipos...</strong>
              <span>Buscando la combinacion mas equilibrada.</span>
            </div>
            <Message id="error" tone="error">{error}</Message>
            <Message id="success" tone="success">{success}</Message>
          </div>

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
                    team
                      .slice()
                      .sort((a, b) => {
                        const assignedA = currentAssignments[playerKey(a)] || getPrimaryPlayerPosition(a);
                        const assignedB = currentAssignments[playerKey(b)] || getPrimaryPlayerPosition(b);
                        const orderDiff = (POSITION_ORDER[assignedA] ?? 99) - (POSITION_ORDER[assignedB] ?? 99);
                        if (orderDiff) return orderDiff;
                        return adjustedPositionRating(b, assignedB) - adjustedPositionRating(a, assignedA);
                      })
                      .forEach((player) => {
                        const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
                        const pitchLine = pitchLineForPosition(assigned);
                        (linePlayers[pitchLine] || linePlayers.MED).push(player);
                      });
                    const summary = teamTotalsSummary(team, assignments);
                    const formationOptions = getFormationOptions(team.length);
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
                            Formacion
                            <select className={inputClass} value={teamFormations[teamIndex] || 'auto'} onChange={(event) => applyFormation(teamIndex, event.target.value)}>
                              <option value="auto">Automatica</option>
                              {formationOptions.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
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
                          {PITCH_LINES.map((line) => {
                            const lineList = linePlayers[line] || [];
                            const label = line === 'DEF' ? 'DEF/LAT' : line;
                            const lineCounts = teamLineCounts(team, currentAssignments);
                            const count = line === 'DEF' ? lineCounts.DEF + lineCounts.LAT : lineCounts[line];
                            const max = line === 'ARQ' ? 1 : (line === 'DEF' ? maxDefLatPlayersPerPosition(team.length) * 2 : maxFieldPlayersPerLine(team.length));
                            const canTuneLine = line !== 'ARQ';
                            return (
                              <div
                                key={line}
                                className={`formation-line ${canTuneLine ? 'sorteo-line-with-tools' : 'sorteo-line-basic'} grid min-h-0 items-center gap-2 border-b border-white/15 last:border-b-0 max-[760px]:gap-1 ${
                                  canTuneLine
                                    ? 'grid-cols-[54px_minmax(0,1fr)_34px] max-[760px]:grid-cols-[32px_minmax(0,1fr)_22px] max-[760px]:gap-0.5'
                                    : 'grid-cols-[54px_minmax(0,1fr)] max-[760px]:grid-cols-[38px_minmax(0,1fr)]'
                                }`}
                              >
                                <div className="line-label grid justify-items-center gap-1 text-center text-[10px] font-black uppercase text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,.48)] max-[760px]:gap-0.5 max-[760px]:text-[9px]">
                                  <span className="leading-none">{label}</span>
                                  <small className="rounded bg-emerald-950/45 px-1 text-[9px] font-extrabold leading-tight text-white/75 max-[760px]:text-[8px]">{count}/{max}</small>
                                  {canTuneLine ? (
                                    <span className="grid gap-1 max-[760px]:gap-0.5">
                                      <button className="grid !h-7 !min-h-0 w-7 place-items-center rounded border border-white/30 bg-emerald-950/55 !p-0 text-xs font-black text-white hover:bg-emerald-950/80 max-[760px]:!h-5 max-[760px]:w-5 max-[760px]:text-[10px]" type="button" onClick={() => pitchLineDelta(teamIndex, line, -1)} aria-label={`Quitar jugador de ${label}`}>-</button>
                                    </span>
                                  ) : null}
                                </div>
                                <div
                                  className="line-players flex h-full min-h-0 flex-nowrap items-center justify-center gap-2 overflow-hidden rounded-lg border !border-white/10 !bg-emerald-950/10 p-1 max-[760px]:gap-1 max-[760px]:p-0.5"
                                  data-sorteo-drop-line={line}
                                  data-team-index={teamIndex}
                                  onDragOver={(event) => event.preventDefault()}
                                  onDrop={(event) => handleDrop(event, teamIndex, line)}
                                >
                                  {lineList.map((player) => {
                                    const assigned = currentAssignments[playerKey(player)] || getPrimaryPlayerPosition(player);
                                    return (
                                      <CompactPlayerCard
                                        key={playerKey(player)}
                                        player={player}
                                        assignedPosition={assigned}
                                        onOpen={() => !dragState && setPreview({ player, assignedPosition: assigned })}
                                        draggableProps={{
                                          draggable: true,
                                          dragging: dragState?.playerKey === playerKey(player),
                                          onDragStart: (event) => handleDragStart(event, teamIndex, player, assigned),
                                          onDragOver: (event) => event.preventDefault(),
                                          onDrop: (event) => handleDrop(event, teamIndex, assigned, playerKey(player)),
                                          'data-sorteo-drag-player': '1',
                                          'data-player-key': playerKey(player),
                                          'data-team-index': teamIndex,
                                          'data-assigned-position': assigned,
                                        }}
                                      />
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
              <div className="grid min-h-64 place-items-center rounded-lg border border-dashed border-[#c9d8d1] bg-white p-8 text-center text-sm font-semibold text-slate-500">
                Genera los equipos para ver la cancha y las cartas compactas.
              </div>
            )}
          </div>

          <div id="download-controls" className={`${teams ? 'grid' : 'hidden'} gap-3 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm lg:col-span-2 lg:row-start-3`}>
            <div className="flex flex-wrap justify-center gap-2">
              <button className={quietButtonClass} type="button" onClick={downloadTeamsJpg} disabled={exporting}><Icon name="download" />{exporting ? 'Generando JPG...' : 'Exportar JPG'}</button>
              <button className={quietButtonClass} type="button" onClick={copyTeams}><Icon name="clipboard" />Copiar</button>
              <button className={quietButtonClass} type="button" onClick={downloadTeamsText}><Icon name="download" />Descargar texto</button>
              {lockedMatch ? <button className={primaryButtonClass} type="button" onClick={saveDraw}><Icon name="save" />Guardar sorteo</button> : null}
            </div>
          </div>
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
            <div className="relative grid aspect-[409/710] w-[min(78vw,320px)] max-h-[82vh] place-items-center overflow-visible">
              <div className="origin-center scale-[1.72] sm:scale-[1.9]">
                <FullPlayerCard player={preview.player} assignedPosition={preview.assignedPosition} />
              </div>
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
          <CompactPlayerCard player={dragState.player} assignedPosition={dragState.assignedPosition} />
        </div>
      ) : null}
    </section>
  );
}
