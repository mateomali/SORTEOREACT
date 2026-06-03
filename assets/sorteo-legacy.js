function navigateSorteoLegacy(url) {
  if (window.goodfellasPartialNavigate) {
    window.goodfellasPartialNavigate(url);
    return;
  }
  window.location.href = url;
}

var sorteoLegacyConfig = JSON.parse(document.querySelector('[data-sorteo-legacy-config]')?.textContent || '{}');
var jugadores = [];
var editIndex = -1;
var currentSort = 'nombre';
var sortDirection = 1;
var lastEquipos = null;
var teamFormations = {};
var customFormations = {};
var manualAssignments = {};
var teamFormationUndoStack = {};
var MATCH_ID = Number(sorteoLegacyConfig.matchId || 0);
var PRELOADED_JUGADORES = Array.isArray(sorteoLegacyConfig.players) ? sorteoLegacyConfig.players : [];
var HISTORICAL_TEAMMATE_PAIRS = sorteoLegacyConfig.pairHistory || {};
var DRAW_BALANCE_WEIGHTS = sorteoLegacyConfig.drawBalanceWeights || {};
var LOCKED_MATCH_MODE = MATCH_ID > 0;
var ALLOW_REDRAW = sorteoLegacyConfig.allowRedraw !== false;
var REDRAW_LIMIT = Math.max(0, Number(sorteoLegacyConfig.redrawLimit ?? 3));
var persistedRedrawCount = Math.max(0, Number(sorteoLegacyConfig.redrawCount || 0));
var hasSavedDraw = !!sorteoLegacyConfig.hasSavedDraw;
var redrawsUsedThisSession = 0;
var generatedOnceThisSession = false;
var seenDrawSignatures = new Set();
var formationPointerDragState = null;
var formationPointerDragTarget = null;
var formationCardPreviewOverlay = null;
if (typeof sorteoLegacyConfig.savedDrawSignature === 'string' && sorteoLegacyConfig.savedDrawSignature !== '') {
  seenDrawSignatures.add(sorteoLegacyConfig.savedDrawSignature);
}
var REQUIRED_FIELD_LINES = ['DEF', 'MED', 'DEL'];
var FIELD_LINES = ['DEF', 'LAT', 'MED', 'DEL'];
var FORMATION_LINES = ['ARQ', ...FIELD_LINES];
var PITCH_LINES = ['ARQ', 'DEF', 'MED', 'DEL'];
var TACTIC_LINES = ['DEF', 'MED', 'DEL'];
var STRICT_MAX_DIFF = 2.5;
var FLEXIBLE_MAX_DIFF = 6.0;

function pitchLineForPosition(position) {
  return String(position || '').toUpperCase() === 'LAT' ? 'DEF' : String(position || '').toUpperCase();
}

function pitchLineCountsFromLogical(logicalCounts = {}) {
  return {
    ARQ: Number(logicalCounts.ARQ || 0),
    DEF: Number(logicalCounts.DEF || 0) + Number(logicalCounts.LAT || 0),
    MED: Number(logicalCounts.MED || 0),
    DEL: Number(logicalCounts.DEL || 0),
  };
}

function countPitchAssignmentLines(assignment) {
  const logical = countAssignmentLines(assignment);
  return pitchLineCountsFromLogical(logical);
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

function fieldLineCountsFitLimits(counts, teamSize) {
  const pitchCounts = pitchLineCountsFromLogical(counts);
  const max = maxFieldPlayersPerLine(teamSize);
  const hasGoalkeeperCount = Object.prototype.hasOwnProperty.call(counts || {}, 'ARQ');
  return (!hasGoalkeeperCount || pitchCounts.ARQ === fieldLineMinimum('ARQ', teamSize))
    && REQUIRED_FIELD_LINES.every(line => (
      Number(pitchCounts[line] || 0) >= fieldLineMinimum(line, teamSize)
      && Number(pitchCounts[line] || 0) <= max
    ));
}

function normalizarPosiciones(rawPosiciones) {
  return String(rawPosiciones || '')
    .split('/')
    .map(pos => pos.trim().toUpperCase())
    .filter(Boolean)
    .join('/');
}

function normalizarRitmo(rawRitmo) {
  return String(rawRitmo || '').toLowerCase() === 'lento' ? 'lento' : 'rápido';
}

// Configuración inicial de colores
var TEAM_COLOR_OPTIONS = [
  { name: "ROSA", class: "team-rosa" },
  { name: "AZUL", class: "team-azul" },
  { name: "NARANJA", class: "team-naranja" },
  { name: "NEGRO", class: "team-negro" },
  { name: "VERDE", class: "team-verde" },
  { name: "CAMISADO", class: "team-camisado" },
  { name: "DESCAMISADO", class: "team-descamisado" }
];
var teamColorMapping = TEAM_COLOR_OPTIONS.map(option => ({ ...option }));

function setTeamColor(equipoIndex, colorName, className) {
  teamColorMapping[equipoIndex] = { name: colorName, class: className };
}
function getTeamColor(equipoIndex) {
  return teamColorMapping[equipoIndex];
}

function isTeamColorTaken(selectedClass, ownIndex) {
  return teamColorMapping.some((teamColor, index) => (
    index !== ownIndex && teamColor && teamColor.class === selectedClass
  ));
}

function teamColorsAreUnique(teamCount) {
  const used = new Set();
  for (let index = 0; index < teamCount; index++) {
    const teamColor = getTeamColor(index);
    if (!teamColor || !teamColor.name) return false;
    const colorName = String(teamColor.name).trim().toUpperCase();
    if (used.has(colorName)) return false;
    used.add(colorName);
  }
  return true;
}

function getTeamColorHeart(colorName) {
  const hearts = {
    ROSA: '💗',
    AZUL: '💙',
    VERDE: '💚',
    NEGRO: '🖤',
    NARANJA: '🧡'
  };
  hearts.CAMISADO = 'C';
  hearts.DESCAMISADO = 'D';
  return hearts[String(colorName || '').trim().toUpperCase()] || '';
}

function getTeamDisplayName(equipoIndex) {
  const teamColor = getTeamColor(equipoIndex);
  const heart = getTeamColorHeart(teamColor?.name);
  return heart ? `EQUIPO ${heart}` : `EQUIPO ${equipoIndex + 1}`;
}

function getMatchupDisplayName(teamCount) {
  return Array.from({ length: teamCount }, (_, index) => getTeamDisplayName(index)).join(' VS ');
}

function toggleSortDropdown() {
  const dropdown = document.getElementById('sortDropdown');
  dropdown?.querySelector('[data-sort-dropdown-content]')?.classList.toggle('hidden');
}

function selectSortOption(criteria) {
  const dropdown = document.getElementById('sortDropdown');
  dropdown?.querySelector('[data-sort-dropdown-content]')?.classList.add('hidden');
  sortPlayers(criteria);
}

function actualizarTeamColorSettings() {
  const numEquipos = parseInt(document.getElementById('teamDisplay').textContent, 10);
  for (let i = 0; i < numEquipos; i++) {
    if (!teamColorMapping[i]) {
      const option = TEAM_COLOR_OPTIONS[i % TEAM_COLOR_OPTIONS.length];
      setTeamColor(i, option.name, option.class);
    }
  }
}

function teamColorOptionsHtml(teamIndex) {
  const teamColor = getTeamColor(teamIndex) || TEAM_COLOR_OPTIONS[teamIndex % TEAM_COLOR_OPTIONS.length];
  return TEAM_COLOR_OPTIONS.map(option => (
    `<option value="${option.class}" ${teamColor.class === option.class ? 'selected' : ''} ${isTeamColorTaken(option.class, teamIndex) ? 'disabled' : ''}>${option.name}</option>`
  )).join('');
}

function refreshTeamColorControls() {
  document.querySelectorAll('[data-sorteo-action="team-color-change"][data-team-index]').forEach(control => {
    const teamIndex = Number(control.dataset.teamIndex);
    control.innerHTML = teamColorOptionsHtml(teamIndex);
  });
}

function onTeamColorChange(teamIndex, selectedClass) {
  const selected = TEAM_COLOR_OPTIONS.find(option => option.class === selectedClass);
  if (!selected) return;
  if (isTeamColorTaken(selected.class, teamIndex)) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.textContent = 'Cada equipo necesita un color de camiseta distinto.';
      errorDiv.classList.remove('hidden');
    } else {
      alert('Cada equipo necesita un color de camiseta distinto.');
    }
    const control = document.querySelector(`[data-sorteo-action="team-color-change"][data-team-index="${teamIndex}"]`);
    const current = getTeamColor(teamIndex);
    if (control && current) control.value = current.class;
    refreshTeamColorControls();
    return;
  }

  setTeamColor(teamIndex, selected.name, selected.class);
  const errorDiv = document.getElementById('error');
  if (errorDiv) {
    errorDiv.textContent = '';
    errorDiv.classList.add('hidden');
  }
  refreshTeamColorControls();

  const teamCard = document.querySelector(`#equipos-generados [data-team-index="${teamIndex}"]`);
  if (teamCard) {
    teamCard.dataset.teamColor = selected.class;
    const title = teamCard.querySelector('[data-team-title]');
    if (title) title.textContent = getTeamDisplayName(teamIndex);
  }

  const matchupTitle = document.querySelector('#equipos-generados [data-sorteo-matchup-title]');
  if (matchupTitle && lastEquipos) {
    matchupTitle.textContent = getMatchupDisplayName(lastEquipos.length);
  }
}

function incrementTeam() {
  const teamDisplay = document.getElementById('teamDisplay');
  let value = parseInt(teamDisplay.textContent);
  if (value < 4) {
    value += 1;
    teamDisplay.textContent = value;
    actualizarTeamColorSettings();
    document.getElementById('download-controls').classList.add('hidden');
  }
}
function decrementTeam() {
  const teamDisplay = document.getElementById('teamDisplay');
  let value = parseInt(teamDisplay.textContent);
  if (value > 2) {
    value -= 1;
    teamDisplay.textContent = value;
    actualizarTeamColorSettings();
    document.getElementById('download-controls').classList.add('hidden');
  }
}

function incrementDiff() {
  const diffDisplay = document.getElementById('diffDisplay');
  let value = parseFloat(diffDisplay.textContent);
  if (value < 3) {
    value += 0.5;
    diffDisplay.textContent = value.toFixed(1);
  }
}
function decrementDiff() {
  const diffDisplay = document.getElementById('diffDisplay');
  let value = parseFloat(diffDisplay.textContent);
  if (value > 0.5) {
    value -= 0.5;
    diffDisplay.textContent = value.toFixed(1);
  }
}

actualizarTeamColorSettings();

function toggleAccordion(header) {
  const accordion = header.parentElement;
  accordion.classList.toggle('active');
}

function toggleSelectAll(checkbox) {
  if (LOCKED_MATCH_MODE) {
    jugadores.forEach(j => j.selected = true);
    checkbox.checked = true;
    actualizarListaJugadores();
    return;
  }
  jugadores.forEach(j => j.selected = checkbox.checked);
  actualizarListaJugadores();
}

function sortPlayers(criteria) {
  const sortButton = document.querySelector('.sort-dropdown-btn span:first-child');
  if (currentSort === criteria) {
    sortDirection *= -1;
  } else {
    currentSort = criteria;
    sortDirection = 1;
  }
  
  // Actualizar texto del botón
  let sortText = '🔽 Ordenar por: ';
  if (criteria === 'nombre') sortText += 'Nombre';
  else if (criteria === 'puntuacion') sortText += 'Puntuación';
  else if (criteria === 'ritmo') sortText += 'Ritmo';
  sortButton.textContent = sortText;
  
  jugadores.sort((a, b) => {
    if (criteria === 'nombre') return a.nombre.localeCompare(b.nombre) * sortDirection;
    if (criteria === 'puntuacion') return (a.puntuacion - b.puntuacion) * sortDirection;
    if (criteria === 'ritmo') return (isLowRhythmPlayer(a) === isLowRhythmPlayer(b) ? 0 : isLowRhythmPlayer(a) ? 1 : -1) * sortDirection;
    return 0;
  });
  actualizarListaJugadores();
}

function exportarJugadoresCSV() {
  if (LOCKED_MATCH_MODE) {
    alert('En modo fecha los jugadores se administran desde la base de datos.');
    return;
  }
  const csvContent = [
    ['Nombre', 'Posicion', 'Ritmo', 'Puntuacion'].join(','),
    ...jugadores.map(j => [
      `"${j.nombre.replace(/"/g, '""')}"`,
      j.posicion,
      j.ritmo,
      j.puntuacion
    ].join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'jugadores_goodfellas.csv');
  link.classList.add('hidden');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function importarJugadoresCSV(event) {
  if (LOCKED_MATCH_MODE) {
    alert('En modo fecha los jugadores se administran desde la base de datos.');
    event.target.value = '';
    return;
  }
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const csvData = e.target.result;
    const rows = csvData.split('\n').slice(1);
    const nuevosJugadores = rows
      .filter(row => row.trim() !== '')
      .map(row => {
        const [nombre, posicion, ritmo, puntuacion] = row.split(',').map(f => f.trim().replace(/^"(.*)"$/, '$1'));
        return {
          nombre: nombre.replace(/""/g, '"'),
          posicion,
          ritmo: normalizarRitmo(ritmo),
          puntuacion: parseFloat(puntuacion),
          selected: true
        };
      })
      .filter(j => j.nombre && j.posicion && !isNaN(j.puntuacion));
      
    jugadores = nuevosJugadores;
    actualizarListaJugadores();
    sortPlayers(currentSort);
    alert(`${nuevosJugadores.length} jugadores importados correctamente`);
  };
  reader.readAsText(file);
  event.target.value = '';
}

var posicionEmojis = { ARQ: '🥅', DEF: '🛡️', LAT: '↔️', MED: '🎯', DEL: '⚽' };

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function convertirPuntuacionAEstrellas(puntuacion) {
  const estrellasLlenas = Math.floor(puntuacion);
  const tieneMedia = (puntuacion % 1) >= 0.5;
  return '<span class="stars">' + '★'.repeat(estrellasLlenas) + (tieneMedia ? '½' : '') + '</span>';
}

function obtenerEmojisDePosiciones(posiciones) {
  return posiciones.split('/').map(pos => posicionEmojis[pos] || '').join('');
}

function statValue(jugador, campo) {
  const fallback = campo === 'regularidad' ? 3.5 : (campo === 'mentalidad' ? 3.0 : Number(jugador.puntuacion || 0));
  const value = Number(jugador[campo]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function isLowRhythmPlayer(jugador) {
  const rhythm = Number(jugador.ritmo_stat);
  if (Number.isFinite(rhythm) && rhythm > 0) {
    return rhythm <= 3;
  }
  return jugador.ritmo === 'lento';
}

function isIrregularPlayer(jugador) {
  return playerCardRating(statValue(jugador, 'regularidad')) < 70;
}

function teamAverage(equipo, campo) {
  if (!equipo.length) return 0;
  return equipo.reduce((sum, jugador) => sum + statValue(jugador, campo), 0) / equipo.length;
}

function teamTotalsSummary(equipo) {
  return {
    general: equipo.reduce((sum, jugador) => sum + Number(jugador.puntuacion || 0), 0),
    tecnica: teamAverage(equipo, 'tecnica'),
    ritmo: teamAverage(equipo, 'ritmo_stat'),
    solidez: teamAverage(equipo, 'solidez'),
    ataque: teamAverage(equipo, 'ataque'),
    compromiso: teamAverage(equipo, 'compromiso'),
    mentalidad: teamAverage(equipo, 'mentalidad'),
    regularidad: teamAverage(equipo, 'regularidad'),
    arquero: equipo.reduce((max, jugador) => {
      if (!getOrderedPlayerPositions(jugador).includes('ARQ')) return max;
      return Math.max(max, statValue(jugador, 'habilidad_arquero'));
    }, 0)
  };
}

function positionBaseRating(jugador, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (position === 'ARQ') {
    if (!getOrderedPlayerPositions(jugador).includes('ARQ')) {
      return 2.0;
    }
    return statValue(jugador, 'habilidad_arquero');
  }
  if (position === 'DEF') {
    return (statValue(jugador, 'solidez') * 0.28)
      + (statValue(jugador, 'ritmo_stat') * 0.20)
      + (statValue(jugador, 'tecnica') * 0.18)
      + (statValue(jugador, 'compromiso') * 0.13)
      + (statValue(jugador, 'mentalidad') * 0.13)
      + (statValue(jugador, 'ataque') * 0.08);
  }
  if (position === 'LAT') {
    return (statValue(jugador, 'ritmo_stat') * 0.24)
      + (statValue(jugador, 'solidez') * 0.22)
      + (statValue(jugador, 'tecnica') * 0.17)
      + (statValue(jugador, 'compromiso') * 0.15)
      + (statValue(jugador, 'ataque') * 0.12)
      + (statValue(jugador, 'mentalidad') * 0.10);
  }
  if (position === 'DEL') {
    return (statValue(jugador, 'ataque') * 0.31)
      + (statValue(jugador, 'ritmo_stat') * 0.20)
      + (statValue(jugador, 'tecnica') * 0.17)
      + (statValue(jugador, 'compromiso') * 0.14)
      + (statValue(jugador, 'mentalidad') * 0.10)
      + (statValue(jugador, 'solidez') * 0.08);
  }
  if (position === 'MED') {
    return (statValue(jugador, 'tecnica') * 0.24)
      + (statValue(jugador, 'ritmo_stat') * 0.23)
      + (statValue(jugador, 'compromiso') * 0.19)
      + (statValue(jugador, 'mentalidad') * 0.13)
      + (statValue(jugador, 'solidez') * 0.12)
      + (statValue(jugador, 'ataque') * 0.09);
  }
  return Number(jugador.puntuacion || 0);
}

function applyRegularityAdjustment(rating, jugador) {
  const factor = 1 + ((statValue(jugador, 'regularidad') - 3.5) / 50);
  return Math.max(1, Math.min(6, rating * factor));
}

function adjustedPositionRating(jugador, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (!position) return Math.max(1, Math.min(6, Number(jugador.puntuacion || 0)));
  const baseRating = positionBaseRating(jugador, position);
  return applyRegularityAdjustment(baseRating, jugador);
}

function positionPenaltyPercent(jugador, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (!position || getOrderedPlayerPositions(jugador).includes(position)) return 0;
  const generalRating = Number(jugador.puntuacion || 0);
  const adjustedRating = adjustedPositionRating(jugador, position);
  if (!generalRating || adjustedRating >= generalRating) return 0;
  return Math.max(1, Math.min(99, Math.round((1 - (adjustedRating / generalRating)) * 100)));
}

function formatRating(value) {
  const number = Number(value || 0);
  return number.toFixed(1);
}

function playerCardRating(value) {
  const rating = Math.max(1, Math.min(6, Number(value || 0)));
  const anchors = [
    [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
    [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
    [5.2, 93], [5.3, 94], [6.0, 99],
  ];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [fromRating, fromOverall] = anchors[i];
    const [toRating, toOverall] = anchors[i + 1];
    if (rating <= toRating) {
      const ratio = (rating - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 99;
}

function playerCardRatingHtml(value, label = 'GEN') {
  return `
    <span class="player-card-rating" title="Puntaje tarjeta">
      <strong>${playerCardRating(value)}</strong>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function playerCardPhotoPath(jugador) {
  const path = String(jugador.photo_path || '');
  return path.startsWith('uploads/players/') && !path.includes('..')
    ? path
    : 'assets/players/default-player-silhouette.png';
}

function playerCardPhotoHtml(jugador) {
  const path = playerCardPhotoPath(jugador);
  const photoClass = path.startsWith('uploads/players/') ? ' is-custom' : ' is-default';
  return `<span class="formation-card-photo${photoClass}" aria-hidden="true"><img src="${escapeHtml(path)}" alt=""></span>`;
}

function playerCardTier(value) {
  const overall = playerCardRating(value);
  if (overall >= 88) return 'supreme';
  if (overall >= 84) return 'elite';
  if (overall >= 76) return 'gold';
  if (overall >= 66) return 'silver';
  return 'bronze';
}

function playerCardStatValue(jugador, campo) {
  return playerCardRating(statValue(jugador, campo));
}

function playerCardStats(jugador, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  if (position === 'ARQ') {
    return [
      ['ARQ', playerCardStatValue(jugador, 'habilidad_arquero')],
      ['RIT', playerCardStatValue(jugador, 'ritmo_stat')],
      ['DEF', playerCardStatValue(jugador, 'solidez')],
      ['TEC', playerCardStatValue(jugador, 'tecnica')],
      ['EQU', playerCardStatValue(jugador, 'compromiso')],
      ['MEN', playerCardStatValue(jugador, 'mentalidad')],
    ];
  }
  return [
    ['TEC', playerCardStatValue(jugador, 'tecnica')],
    ['RIT', playerCardStatValue(jugador, 'ritmo_stat')],
    ['DEF', playerCardStatValue(jugador, 'solidez')],
    ['ATA', playerCardStatValue(jugador, 'ataque')],
    ['EQU', playerCardStatValue(jugador, 'compromiso')],
    ['MEN', playerCardStatValue(jugador, 'mentalidad')],
  ];
}

function playerCardStatsHtml(jugador, assignedPosition) {
  return `
    <span class="formation-card-stats" aria-label="Stats del jugador">
      ${playerCardStats(jugador, assignedPosition).map(([label, value]) => `
        <span class="formation-card-stat"><span>${escapeHtml(label)}</span><strong>${value}</strong></span>
      `).join('')}
    </span>
  `;
}

function playerCardRegularityForm(jugador) {
  const rating = Math.max(1, Math.min(6, statValue(jugador, 'regularidad')));
  if (rating >= 4.5) return ['up', 'Regularidad alta'];
  if (rating < 3.0) return ['down', 'Regularidad baja'];
  return ['right', 'Regularidad normal'];
}

function playerCardRegularityHtml(jugador) {
  const [form, label] = playerCardRegularityForm(jugador);
  return `<span class="formation-card-regularity is-${escapeHtml(form)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
}

function playerCardReferenceStatsHtml(jugador, primaryPosition) {
  return `
    <span class="formation-card-stats" aria-label="Stats del jugador">
      ${playerCardStats(jugador, primaryPosition).map(([label, value]) => `
        <span class="formation-card-stat"><strong>${value}</strong><span>${escapeHtml(label)}</span></span>
      `).join('')}
    </span>
  `;
}

function playerPositionPillsHtml(jugador) {
  return `
    <span class="captain-player-position-icons" aria-label="Posiciones naturales">
      ${getOrderedPlayerPositions(jugador).map((position, index) => `
        <span class="captain-position-pill ${index === 0 ? 'is-primary' : 'is-secondary'}" title="${position} ${index === 0 ? 'primaria' : 'secundaria'}" aria-label="${position} ${index === 0 ? 'primaria' : 'secundaria'}">${position}</span>
      `).join('')}
    </span>
  `;
}

function getPlayerOrder(player) {
  const orderMapping = { ARQ: 1, DEF: 2, LAT: 3, MED: 4, DEL: 5 };
  const posArray = player.posicion.split('/');
  const orders = posArray.map(pos => orderMapping[pos] || 99);
  return Math.min(...orders);
}

function getOrderedPlayerPositions(player) {
  const posicionesValidas = FORMATION_LINES;
  const posiciones = String(player.posicion || '').split('/').map(p => p.trim().toUpperCase()).filter(Boolean);
  const limpias = [];
  posiciones.forEach(pos => {
    if (posicionesValidas.includes(pos) && !limpias.includes(pos)) {
      limpias.push(pos);
    }
  });
  return limpias.length ? limpias.slice(0, 2) : ['MED'];
}

function getPrimaryPlayerPosition(player) {
  return getOrderedPlayerPositions(player)[0] || 'MED';
}

function getBestNaturalPlayerPosition(player) {
  return getOrderedPlayerPositions(player)
    .slice()
    .sort((a, b) => {
      const ratingDiff = adjustedPositionRating(player, b) - adjustedPositionRating(player, a);
      if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
      return FORMATION_LINES.indexOf(a) - FORMATION_LINES.indexOf(b);
    })[0] || 'MED';
}

function getBestNaturalPlayerRating(player) {
  return adjustedPositionRating(player, getBestNaturalPlayerPosition(player));
}

function isPureGoalkeeper(player) {
  const posiciones = getOrderedPlayerPositions(player);
  return posiciones.length === 1 && posiciones[0] === 'ARQ';
}

function isEmergencyGoalkeeper(player) {
  return player && player.emergencyGoalkeeper === true;
}

function hasSecondaryPlayerPosition(player, position) {
  return getOrderedPlayerPositions(player).slice(1).includes(position);
}

function prepareEmergencyGoalkeepers(players, numEquipos) {
  const arqueros = players.filter(p => getPrimaryPlayerPosition(p) === 'ARQ');
  const missing = Math.max(0, numEquipos - arqueros.length);
  if (missing === 0) {
    return { players, emergencyGoalkeepers: [] };
  }

  const emergencyIds = new Set(
    players
      .filter(p => getPrimaryPlayerPosition(p) !== 'ARQ')
      .slice()
      .sort((a, b) => {
        const secondaryA = hasSecondaryPlayerPosition(a, 'ARQ') ? 0 : 1;
        const secondaryB = hasSecondaryPlayerPosition(b, 'ARQ') ? 0 : 1;
        if (secondaryA !== secondaryB) return secondaryA - secondaryB;
        return (getBestNaturalPlayerRating(a) - getBestNaturalPlayerRating(b)) || String(a.nombre).localeCompare(String(b.nombre));
      })
      .slice(0, missing)
      .map(playerKey)
  );

  const prepared = players.map(player => {
    if (!emergencyIds.has(playerKey(player))) {
      return player;
    }
    const fieldPositions = getOrderedPlayerPositions(player).filter(position => position !== 'ARQ');
    return {
      ...player,
      posicion: ['ARQ', ...fieldPositions].slice(0, 2).join('/'),
      habilidad_arquero: 2.0,
      emergencyGoalkeeper: true,
    };
  });

  return {
    players: prepared,
    emergencyGoalkeepers: prepared.filter(player => emergencyIds.has(playerKey(player))),
  };
}

function buildTeamPositionAssignment(equipo) {
  const lineasCampo = FIELD_LINES;
  const maxPorLinea = maxFieldPlayersPerLine(equipo.length);
  const candidatosArq = equipo
    .filter(jugador => getPrimaryPlayerPosition(jugador) === 'ARQ' || isEmergencyGoalkeeper(jugador))
    .sort((a, b) => {
      const emergencyA = isEmergencyGoalkeeper(a) ? 1 : 0;
      const emergencyB = isEmergencyGoalkeeper(b) ? 1 : 0;
      if (emergencyA !== emergencyB) return emergencyA - emergencyB;
      const pureA = isPureGoalkeeper(a) ? 0 : 1;
      const pureB = isPureGoalkeeper(b) ? 0 : 1;
      if (pureA !== pureB) return pureA - pureB;
      const ratingDiff = adjustedPositionRating(b, 'ARQ') - adjustedPositionRating(a, 'ARQ');
      if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
      return a.nombre.localeCompare(b.nombre);
    });

  const arqueroTitular = candidatosArq[0] || null;
  const asignacion = new Map();
  const preferenciasPorJugador = new Map();

  equipo.forEach(jugador => {
    const posiciones = getOrderedPlayerPositions(jugador)
      .slice()
      .sort((a, b) => {
        const ratingDiff = adjustedPositionRating(jugador, b) - adjustedPositionRating(jugador, a);
        if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
        return FORMATION_LINES.indexOf(a) - FORMATION_LINES.indexOf(b);
      });
    let preferencias = posiciones.slice();

    if (jugador === arqueroTitular) {
      // El arquero titular queda fijo en el arco.
      preferencias = ['ARQ'];
    } else if (posiciones.includes('ARQ')) {
      // Si no es el arquero titular, debe usar otra posicion de campo.
      preferencias = posiciones.filter(pos => pos !== 'ARQ');
      if (!preferencias.length) {
        preferencias = ['ARQ'];
      }
    }

    preferenciasPorJugador.set(jugador, preferencias);
    asignacion.set(jugador, preferencias[0] || 'MED');
  });

  const contarLineas = () => {
    const conteo = Object.fromEntries(FORMATION_LINES.map(line => [line, 0]));
    asignacion.forEach(pos => {
      if (conteo[pos] === undefined) {
        conteo.MED++;
        return;
      }
      conteo[pos]++;
    });
    return conteo;
  };

  const contarLineasCancha = () => pitchLineCountsFromLogical(contarLineas());

  REQUIRED_FIELD_LINES.forEach(linea => {
    let guard = 0;
    while (guard < equipo.length) {
      guard++;
      const conteoCancha = contarLineasCancha();
      if ((conteoCancha[linea] || 0) >= fieldLineMinimum(linea, equipo.length)) break;
      const candidato = equipo
        .filter(jugador => asignacion.get(jugador) !== 'ARQ')
        .filter(jugador => {
          const actual = pitchLineForPosition(asignacion.get(jugador));
          return actual !== linea && (conteoCancha[actual] || 0) > fieldLineMinimum(actual, equipo.length);
        })
        .sort((a, b) => adjustedPositionRating(b, linea) - adjustedPositionRating(a, linea))[0];
      if (!candidato) break;
      asignacion.set(candidato, linea);
    }
  });

  // Reubica jugadores multi-posicion si una linea visual supera el maximo permitido.
  let huboCambios = true;
  while (huboCambios) {
    huboCambios = false;
    const conteoCanchaActual = contarLineasCancha();
    const lineasExcedidas = REQUIRED_FIELD_LINES
      .filter(linea => conteoCanchaActual[linea] > maxPorLinea)
      .sort((a, b) => conteoCanchaActual[b] - conteoCanchaActual[a]);
    const conteoActual = contarLineas();
    const lineasLogicasExcedidas = lineasCampo
      .filter(linea => conteoActual[linea] > fieldLineLimit(linea, equipo.length))
      .sort((a, b) => conteoActual[b] - conteoActual[a]);
    lineasLogicasExcedidas.forEach(linea => {
      if (!lineasExcedidas.includes(linea)) lineasExcedidas.push(linea);
    });

    if (!lineasExcedidas.length) break;

    for (const lineaExcedida of lineasExcedidas) {
      const origenes = lineaExcedida === 'DEF' ? ['DEF', 'LAT'] : [lineaExcedida];
      const candidatosMover = equipo
        .filter(jugador => origenes.includes(asignacion.get(jugador)))
        .filter(jugador => (preferenciasPorJugador.get(jugador) || []).some(pos => !origenes.includes(pos)))
        .sort((a, b) => {
          const altA = (preferenciasPorJugador.get(a) || []).length;
          const altB = (preferenciasPorJugador.get(b) || []).length;
          if (altA !== altB) return altB - altA;
          return a.nombre.localeCompare(b.nombre);
        });

      let movioDesdeLinea = false;
      for (const jugador of candidatosMover) {
        const preferencias = preferenciasPorJugador.get(jugador) || [];
        const conteo = contarLineas();
        const conteoCancha = contarLineasCancha();
        const posicionActual = asignacion.get(jugador);
        const destinos = preferencias.filter(pos => {
          if (origenes.includes(pos) || !lineasCampo.includes(pos)) return false;
          const proposed = { ...conteo };
          proposed[posicionActual] = Math.max(0, Number(proposed[posicionActual] || 0) - 1);
          proposed[pos] = Number(proposed[pos] || 0) + 1;
          return fieldLineCountsFitLimits(proposed, equipo.length);
        });
        if (!destinos.length) continue;

        destinos.sort((a, b) => {
          const pitchA = pitchLineForPosition(a);
          const pitchB = pitchLineForPosition(b);
          const faltaA = conteoCancha[pitchA] === 0 ? 1 : 0;
          const faltaB = conteoCancha[pitchB] === 0 ? 1 : 0;
          if (faltaA !== faltaB) return faltaB - faltaA;
          if (conteoCancha[pitchA] !== conteoCancha[pitchB]) return conteoCancha[pitchA] - conteoCancha[pitchB];
          if (conteo[a] !== conteo[b]) return conteo[a] - conteo[b];
          return preferencias.indexOf(a) - preferencias.indexOf(b);
        });

        asignacion.set(jugador, destinos[0]);
        huboCambios = true;
        movioDesdeLinea = true;
        break;
      }

      if (movioDesdeLinea) break;
    }
  }

  const conteoFinal = contarLineas();
  const arquerosAsignados = conteoFinal.ARQ;
  const lineaMaximaValida = fieldLineCountsFitLimits(conteoFinal, equipo.length);

  return { asignacion, arquerosAsignados, conteoFinal, lineaMaximaValida };
}

function countAssignmentLines(assignment) {
  const counts = Object.fromEntries(FORMATION_LINES.map(line => [line, 0]));
  assignment.forEach(pos => {
    if (counts[pos] === undefined) {
      counts.MED++;
      return;
    }
    counts[pos]++;
  });
  return counts;
}

function buildFlexibleTeamPositionAssignment(equipo) {
  const base = buildTeamPositionAssignment(equipo);
  if (base.arquerosAsignados === 1 && base.lineaMaximaValida) {
    return { ...base, flexible: false };
  }

  const goalkeeper = equipo.find(jugador => base.asignacion.get(jugador) === 'ARQ')
    || equipo.find(jugador => getPrimaryPlayerPosition(jugador) === 'ARQ' || isEmergencyGoalkeeper(jugador))
    || null;
  if (!goalkeeper) {
    return { ...base, flexible: false };
  }
  const fieldPlayers = equipo.filter(jugador => jugador !== goalkeeper);
  const formationOptions = getFormationOptions(equipo.length).filter(option => (
    FIELD_LINES.reduce((sum, line) => sum + (option[line] || 0), 0) === fieldPlayers.length
    && fieldLineCountsFitLimits(option, equipo.length)
  ));
  const options = formationOptions.length
    ? formationOptions
    : [{ DEF: 1, LAT: 0, MED: Math.max(0, fieldPlayers.length - 2), DEL: 1, value: 'fallback' }];

  let bestAssignment = null;
  let bestScore = -Infinity;

  for (const counts of options) {
    const assignment = new Map();
    const remaining = new Set(fieldPlayers);
    let score = 0;
    if (goalkeeper) {
      assignment.set(goalkeeper, 'ARQ');
      score += adjustedPositionRating(goalkeeper, 'ARQ');
    }

    const linesByNeed = FIELD_LINES.slice().sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    for (const line of linesByNeed) {
      for (let slot = 0; slot < (counts[line] || 0); slot++) {
        const candidates = Array.from(remaining).sort((a, b) => {
          const positionsA = getOrderedPlayerPositions(a);
          const positionsB = getOrderedPlayerPositions(b);
          const naturalA = line === 'DEF' ? (positionsA.includes('DEF') || positionsA.includes('LAT') ? 1 : 0) : (positionsA.includes(line) ? 1 : 0);
          const naturalB = line === 'DEF' ? (positionsB.includes('DEF') || positionsB.includes('LAT') ? 1 : 0) : (positionsB.includes(line) ? 1 : 0);
          if (naturalA !== naturalB) return naturalB - naturalA;
          const ratingA = line === 'DEF' ? Math.max(adjustedPositionRating(a, 'DEF'), adjustedPositionRating(a, 'LAT')) : adjustedPositionRating(a, line);
          const ratingB = line === 'DEF' ? Math.max(adjustedPositionRating(b, 'DEF'), adjustedPositionRating(b, 'LAT')) : adjustedPositionRating(b, line);
          const ratingDiff = ratingB - ratingA;
          if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
          return String(a.nombre).localeCompare(String(b.nombre));
        });
        const chosen = candidates[0];
        if (!chosen) break;
        const chosenPositions = getOrderedPlayerPositions(chosen);
        const assignedLine = line === 'DEF' && chosenPositions.includes('LAT') && (!chosenPositions.includes('DEF') || adjustedPositionRating(chosen, 'LAT') >= adjustedPositionRating(chosen, 'DEF'))
          ? 'LAT'
          : line;
        assignment.set(chosen, assignedLine);
        remaining.delete(chosen);
        score += adjustedPositionRating(chosen, assignedLine);
        if (!getOrderedPlayerPositions(chosen).includes(assignedLine)) {
          score -= 2;
        }
      }
    }

    remaining.forEach(jugador => {
      const fallbackPitch = TACTIC_LINES
        .filter(line => {
          const counts = countAssignmentLines(assignment);
          if (line === 'DEF') {
            return counts.DEF < fieldLineLimit('DEF', equipo.length) || counts.LAT < fieldLineLimit('LAT', equipo.length);
          }
          return counts[line] < fieldLineLimit(line, equipo.length);
        })
        .sort((a, b) => adjustedPositionRating(jugador, b) - adjustedPositionRating(jugador, a))[0] || 'MED';
      const fallbackCounts = countAssignmentLines(assignment);
      const fallback = fallbackPitch === 'DEF'
        && getOrderedPlayerPositions(jugador).includes('LAT')
        && fallbackCounts.LAT < fieldLineLimit('LAT', equipo.length)
          ? 'LAT'
          : fallbackPitch;
      assignment.set(jugador, fallback);
      score += adjustedPositionRating(jugador, fallback);
    });

    const countsFinal = countAssignmentLines(assignment);
    const pitchCountsFinal = pitchLineCountsFromLogical(countsFinal);
    const valid = countsFinal.ARQ === 1
      && REQUIRED_FIELD_LINES.every(line => pitchCountsFinal[line] >= fieldLineMinimum(line, equipo.length))
      && fieldLineCountsFitLimits(countsFinal, equipo.length);
    if (valid && score > bestScore) {
      bestScore = score;
      bestAssignment = assignment;
    }
  }

  if (!bestAssignment) {
    return { ...base, flexible: false };
  }

  const conteoFinal = countAssignmentLines(bestAssignment);
  return {
    asignacion: bestAssignment,
    arquerosAsignados: conteoFinal.ARQ,
    conteoFinal,
    lineaMaximaValida: fieldLineCountsFitLimits(conteoFinal, equipo.length),
    flexible: true,
  };
}

function buildPositionAssignment(equipo, { allowOutOfPosition = false } = {}) {
  return allowOutOfPosition ? buildFlexibleTeamPositionAssignment(equipo) : buildTeamPositionAssignment(equipo);
}

function getPrimaryPosition(player, asignacionEquipo = null) {
  if (asignacionEquipo && asignacionEquipo.has(player)) {
    return asignacionEquipo.get(player);
  }
  return getPrimaryPlayerPosition(player);
}

function actualizarListaJugadores() {
  const container = document.getElementById('jugadores-container');
  container.innerHTML = '';
  jugadores.forEach((jugador, index) => {
    const div = document.createElement('div');
    div.className = 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[#07130f] shadow-sm';
    div.innerHTML = `
      <input type="checkbox" id="jugador-${index}" ${jugador.selected ? 'checked' : ''} ${LOCKED_MATCH_MODE ? 'disabled' : ''} data-sorteo-action="toggle-player" data-player-index="${index}">
      <div class="player-info">
        <span class="player-name">${jugador.nombre} ${isLowRhythmPlayer(jugador) ? '🐢' : ''}</span>
        <span class="player-details">
          <span class="position-emoji">${obtenerEmojisDePosiciones(jugador.posicion)}</span> - ${convertirPuntuacionAEstrellas(jugador.puntuacion)}
        </span>
      </div>
      <div class="action-buttons">
        <button type="button" data-sorteo-action="edit-player" data-player-index="${index}" class="btn-edit">✏️</button>
        <button type="button" data-sorteo-action="delete-player" data-player-index="${index}" class="btn-delete">🗑️</button>
      </div>
    `;
    container.appendChild(div);
  });
}

function abrirModalAgregar() {
  if (LOCKED_MATCH_MODE) {
    alert('En modo fecha no se pueden agregar jugadores desde esta pantalla.');
    return;
  }
  document.getElementById('addNombre').value = '';
  document.querySelectorAll('.addPosicion').forEach(cb => cb.checked = false);
  document.getElementById('addEdad').value = 'rápido';
  document.getElementById('addScoreDisplay').textContent = "1.0";
  document.getElementById('addModal').classList.remove('hidden');
}

function incrementScore(modalType) {
  let display = modalType === 'add' ? document.getElementById('addScoreDisplay') : document.getElementById('editScoreDisplay');
  let current = parseFloat(display.textContent);
  if (current < 6) {
    current = Math.min(6, current + 0.5);
    display.textContent = current.toFixed(1);
  }
}
function decrementScore(modalType) {
  let display = modalType === 'add' ? document.getElementById('addScoreDisplay') : document.getElementById('editScoreDisplay');
  let current = parseFloat(display.textContent);
  if (current > 1) {
    current = Math.max(1, current - 0.5);
    display.textContent = current.toFixed(1);
  }
}

function guardarJugador() {
  if (LOCKED_MATCH_MODE) {
    alert('En modo fecha no se pueden agregar jugadores desde esta pantalla.');
    return;
  }
  const nombre = document.getElementById('addNombre').value.trim();
  const posiciones = Array.from(document.querySelectorAll('.addPosicion:checked')).map(cb => cb.value).join('/');
  const ritmo = document.getElementById('addEdad').value;
  const puntuacion = parseFloat(document.getElementById('addScoreDisplay').textContent);
  if (!nombre || posiciones === '' || isNaN(puntuacion)) {
    alert('Completa todos los campos requeridos');
    return;
  }
  jugadores.push({ nombre, posicion: posiciones, ritmo, puntuacion, selected: true });
  actualizarListaJugadores();
  cerrarModal('addModal');
  const newIndex = jugadores.length - 1;
  const newPlayerElement = document.getElementById('jugador-' + newIndex);
  if (newPlayerElement) {
    newPlayerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function editarJugador(index) {
  const jugador = jugadores[index];
  document.getElementById('editNombre').value = jugador.nombre;
  document.querySelectorAll('.editPosicion').forEach(cb => {
    cb.checked = jugador.posicion.split('/').includes(cb.value);
  });
  document.getElementById('editEdad').value = jugador.ritmo;
  document.getElementById('editScoreDisplay').textContent = jugador.puntuacion.toFixed(1);
  editIndex = index;
  document.getElementById('editModal').classList.remove('hidden');
}

function guardarEdicion() {
  const nombre = document.getElementById('editNombre').value.trim();
  const posiciones = Array.from(document.querySelectorAll('.editPosicion:checked')).map(cb => cb.value).join('/');
  const ritmo = document.getElementById('editEdad').value;
  const puntuacion = parseFloat(document.getElementById('editScoreDisplay').textContent);
  if (!nombre || posiciones === '' || isNaN(puntuacion)) {
    alert('Completa todos los campos requeridos');
    return;
  }
  jugadores[editIndex] = { nombre, posicion: posiciones, ritmo, puntuacion, selected: jugadores[editIndex].selected };
  actualizarListaJugadores();
  cerrarModal('editModal');
  const editedElement = document.getElementById('jugador-' + editIndex);
  if (editedElement) {
    editedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function cerrarModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
  editIndex = -1;
}

function eliminarJugador(index) {
  if (LOCKED_MATCH_MODE) {
    alert('En modo fecha no se pueden eliminar jugadores desde esta pantalla.');
    return;
  }
  if (confirm('¿Estás seguro de eliminar este jugador?')) {
    jugadores.splice(index, 1);
    actualizarListaJugadores();
  }
}

function explicarBloqueoSorteo(players, numEquipos, maxDiff) {
  if (players.length === 0) return 'No hay jugadores seleccionados.';
  if (players.length % numEquipos !== 0) {
    return `Hay ${players.length} jugadores seleccionados y no se pueden dividir en ${numEquipos} equipos iguales.`;
  }
  const teamSize = players.length / numEquipos;
  const maxPerLine = maxFieldPlayersPerLine(teamSize);
  if (teamSize < 5) {
    return `Cada equipo tendria ${teamSize} jugadores. La formacion minima requiere 1 arquero y al menos 1 jugador en DEF/LAT, MED y DEL.`;
  }
  const maxTeamSizeByFormation = 1 + (maxPerLine * 3);
  if (teamSize > maxTeamSizeByFormation) {
    return `Cada equipo tendria ${teamSize} jugadores. La regla actual permite maximo 1 arquero y ${maxPerLine} por linea: DEF/LAT, MED y DEL (${maxTeamSizeByFormation} por equipo).`;
  }
  const arqueros = players.filter(p => getPrimaryPlayerPosition(p) === 'ARQ');
  if (arqueros.length < numEquipos) {
    return `Hay ${arqueros.length} arqueros naturales para ${numEquipos} equipos. Se completaran los arqueros faltantes con los jugadores de menor puntaje.`;
  }
  const arquerosPuros = arqueros.filter(isPureGoalkeeper);
  if (arquerosPuros.length > numEquipos) {
    return `Hay ${arquerosPuros.length} arqueros puros para ${numEquipos} equipos. Como el arquero es una sola plaza, sobra al menos un arquero puro.`;
  }
  const missingLines = REQUIRED_FIELD_LINES.filter(linea => players.filter(p => getOrderedPlayerPositions(p).includes(linea)).length < numEquipos);
  if (missingLines.length) {
    return `Faltan jugadores para cubrir todas las lineas en cada equipo. Lineas con menos de ${numEquipos} opciones: ${missingLines.join(', ')}.`;
  }
  return `No se encontro una combinacion que cumpla todas las reglas: diferencia maxima ${maxDiff.toFixed(1)}, 1 arquero por equipo, ritmo equilibrado, al menos DEF/MED/DEL y maximo ${maxPerLine} por linea.`;
}

function setGeneratingTeams(isGenerating) {
  const button = document.getElementById('generateTeamsButton');
  const loading = document.getElementById('generateTeamsLoading');
  if (button) {
    button.disabled = isGenerating || (nextGenerationIsRedraw() && (!ALLOW_REDRAW || redrawsRemaining() <= 0));
    button.classList.toggle('is-loading', isGenerating);
    button.textContent = isGenerating ? 'Generando...' : generateButtonLabel();
  }
  if (loading) {
    loading.hidden = !isGenerating;
  }
}

function waitForPaint() {
  return new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 20)));
}

async function generarEquipos() {
  const errorDiv = document.getElementById('error');
  const successDiv = document.getElementById('success');
  errorDiv.textContent = '';
  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');
  
  const numEquipos = parseInt(document.getElementById('teamDisplay').textContent);
  const maxDiff = parseFloat(document.getElementById('diffDisplay').textContent);
  const rawSelectedPlayers = LOCKED_MATCH_MODE ? jugadores.slice() : jugadores.filter(j => j.selected);
  const emergencyPreparation = prepareEmergencyGoalkeepers(rawSelectedPlayers, numEquipos);
  const selectedPlayers = emergencyPreparation.players;
  
  if (isNaN(maxDiff) || maxDiff < 0) {
    errorDiv.textContent = 'La diferencia máxima debe ser un número positivo';
    errorDiv.classList.remove('hidden');
    return;
  }
  if (selectedPlayers.length === 0) {
    errorDiv.textContent = 'Selecciona al menos un jugador';
    errorDiv.classList.remove('hidden');
    return;
  }
  if (selectedPlayers.length % numEquipos !== 0) {
    errorDiv.textContent = `Jugadores seleccionados (${selectedPlayers.length}) no es divisible por ${numEquipos}`;
    errorDiv.classList.remove('hidden');
    return;
  }

  const teamSize = selectedPlayers.length / numEquipos;
  const maxPerLine = maxFieldPlayersPerLine(teamSize);
  if (teamSize < 5) {
    errorDiv.textContent = `Con ${teamSize} jugadores por equipo no se puede respetar la formacion minima: 1 arquero y al menos 1 jugador en DEF/LAT, MED y DEL.`;
    errorDiv.classList.remove('hidden');
    return;
  }
  const maxTeamSizeByFormation = 1 + (maxPerLine * 3);
  if (teamSize > maxTeamSizeByFormation) {
    errorDiv.textContent = `Con ${teamSize} jugadores por equipo no se puede respetar la formacion: maximo 1 arquero y ${maxPerLine} por linea: DEF/LAT, MED y DEL (maximo ${maxTeamSizeByFormation} por equipo).`;
    errorDiv.classList.remove('hidden');
    return;
  }
  
  const arqueros = selectedPlayers.filter(p => getPrimaryPlayerPosition(p) === 'ARQ');
  const arquerosPuros = arqueros.filter(isPureGoalkeeper);
  if (arquerosPuros.length > numEquipos) {
    errorDiv.textContent = `Hay ${arquerosPuros.length} arqueros puros para ${numEquipos} equipos. Debe haber como maximo 1 arquero puro por equipo.`;
    errorDiv.classList.remove('hidden');
    return;
  }

  const isRedraw = nextGenerationIsRedraw();
  if (isRedraw && !ALLOW_REDRAW) {
    errorDiv.textContent = 'Esta fecha no permite rehacer el sorteo.';
    errorDiv.classList.remove('hidden');
    refreshGenerateButtonState();
    return;
  }
  if (isRedraw && redrawsRemaining() <= 0) {
    errorDiv.textContent = `Ya se usaron los ${REDRAW_LIMIT} re-sorteos permitidos para esta fecha.`;
    errorDiv.classList.remove('hidden');
    refreshGenerateButtonState();
    return;
  }

  setGeneratingTeams(true);
  await waitForPaint();

  try {
  const previousSignatures = new Set(seenDrawSignatures);
  if (lastEquipos) {
    previousSignatures.add(drawSignature(lastEquipos));
  }
  let resultado = null;
  const attempts = isRedraw ? 30 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const attemptPlayers = isRedraw ? shuffledPlayers(selectedPlayers) : selectedPlayers;
    const candidate = generarEquiposConDiferenciaAuto(attemptPlayers, numEquipos, maxDiff, isRedraw ? { avoidSignatures: previousSignatures } : {});
    if (!candidate) continue;
    const signature = drawSignature(candidate.equipos);
    if (!isRedraw || !previousSignatures.has(signature)) {
      resultado = candidate;
      break;
    }
    if (!resultado) {
      resultado = candidate;
    }
  }
  if (isRedraw && resultado && previousSignatures.has(drawSignature(resultado.equipos))) {
    resultado = null;
  }
  if (resultado) {
    applyFlexibleFormationAssignments(resultado);
    const validation = validarEquiposDetalle(resultado.equipos, teamSize, Number(resultado.usedMaxDiff || maxDiff), {
      strictBalance: resultado.perfecto,
      allowOutOfPosition: !!resultado.flexiblePositions,
    });
    if (!validation.ok) {
      errorDiv.textContent = validation.reason;
      errorDiv.classList.remove('hidden');
      return;
    }
    lastEquipos = resultado.equipos;
    rememberDrawSignature(resultado.equipos);
    if (isRedraw) {
      redrawsUsedThisSession += 1;
    }
    generatedOnceThisSession = true;
    document.getElementById('diffDisplay').textContent = Number(resultado.usedMaxDiff || maxDiff).toFixed(1);
    mostrarEquipos(resultado.equipos);
    successDiv.textContent = `Equipos generados exitosamente con diferencia máxima de ${maxDiff}`;
    if (resultado.perfecto) {
      successDiv.textContent = `Equipos generados con diferencia maxima ${Number(resultado.usedMaxDiff || maxDiff).toFixed(1)}.`;
    }
    if (!resultado.perfecto) {
      successDiv.textContent = `Se genero el mejor equilibrio encontrado. Diferencia de puntos: ${resultado.metricas.diffPuntos.toFixed(1)}.`;
    }
    if (resultado.flexiblePositions) {
      const outOfPosition = (resultado.metricas.stats || []).reduce((sum, stat) => sum + Number(stat.fueraDePosicion || 0), 0);
      successDiv.textContent += ` Se usaron ${outOfPosition} cambios de posicion con penalidad.`;
    }
    if (emergencyPreparation.emergencyGoalkeepers.length) {
      const emergencyNames = emergencyPreparation.emergencyGoalkeepers.map(p => p.nombre).join(', ');
      successDiv.textContent += ` Arqueros de emergencia: ${emergencyNames}.`;
    }
    if (isRedraw) {
      successDiv.textContent += ` Re-sorteo ${persistedRedrawCount + redrawsUsedThisSession}/${REDRAW_LIMIT}.`;
    }
    successDiv.classList.remove('hidden');
    refreshGenerateButtonState();
  } else {
    errorDiv.textContent = isRedraw
      ? `No se encontro otro equipo diferente que cumpla las reglas. ${explicarBloqueoSorteo(selectedPlayers, numEquipos, FLEXIBLE_MAX_DIFF)}`
      : `No se encontro una combinacion valida aumentando la diferencia de a 0.5 hasta el maximo de ${FLEXIBLE_MAX_DIFF.toFixed(1)} puntos. ${explicarBloqueoSorteo(selectedPlayers, numEquipos, FLEXIBLE_MAX_DIFF)}`;
    errorDiv.classList.remove('hidden');
  }
  } finally {
    setGeneratingTeams(false);
  }
}

function clonarEquipos(equipos) {
  return equipos.map(equipo => equipo.slice());
}

function teamStats(equipo, { allowOutOfPosition = false } = {}) {
  const assignment = buildPositionAssignment(equipo, { allowOutOfPosition });
  const total = equipo.reduce((sum, j) => {
    const assignedPosition = getPrimaryPosition(j, assignment.asignacion);
    return sum + adjustedPositionRating(j, assignedPosition);
  }, 0);
  const lentos = equipo.filter(isLowRhythmPlayer).length;
  const irregulares = equipo.filter(isIrregularPlayer).length;
  const rapidos = equipo.length - lentos;
  const balance = {
    general: total,
    ataque: equipo.reduce((sum, j) => sum + statValue(j, 'ataque'), 0),
    solidez: equipo.reduce((sum, j) => sum + statValue(j, 'solidez'), 0),
    ritmo: equipo.reduce((sum, j) => sum + statValue(j, 'ritmo_stat'), 0),
    tecnica: equipo.reduce((sum, j) => sum + statValue(j, 'tecnica'), 0),
    compromiso: equipo.reduce((sum, j) => sum + statValue(j, 'compromiso'), 0),
    mentalidad: equipo.reduce((sum, j) => sum + statValue(j, 'mentalidad'), 0),
    regularidad: equipo.reduce((sum, j) => sum + statValue(j, 'regularidad'), 0),
    arquero: equipo.reduce((max, j) => {
      if (!getOrderedPlayerPositions(j).includes('ARQ')) return max;
      return Math.max(max, statValue(j, 'habilidad_arquero'));
    }, 0)
  };
  const lineas = assignment.conteoFinal || Object.fromEntries(FORMATION_LINES.map(line => [line, 0]));
  const lineasCancha = pitchLineCountsFromLogical(lineas);
  const fueraDePosicion = equipo.filter(jugador => {
    const assignedPosition = getPrimaryPosition(jugador, assignment.asignacion);
    return !getOrderedPlayerPositions(jugador).includes(assignedPosition);
  }).length;
  return {
    total,
    lentos,
    irregulares,
    rapidos,
    balance,
    lineas,
    lineasCancha,
    arqueros: assignment.arquerosAsignados || 0,
    lineaMaximaValida: !!assignment.lineaMaximaValida,
    fueraDePosicion,
  };
}

function teammatePairKey(a, b) {
  const idA = parseInt(a.id || 0, 10);
  const idB = parseInt(b.id || 0, 10);
  if (!idA || !idB) return '';
  return idA < idB ? `${idA}-${idB}` : `${idB}-${idA}`;
}

function historicalRepeatPenalty(equipos) {
  let penalty = 0;
  for (const equipo of equipos) {
    for (let i = 0; i < equipo.length; i++) {
      for (let j = i + 1; j < equipo.length; j++) {
        const key = teammatePairKey(equipo[i], equipo[j]);
        if (!key) continue;
        const repeats = Number(HISTORICAL_TEAMMATE_PAIRS[key] || 0);
        if (repeats > 0) {
          penalty += repeats * repeats * 35;
        }
      }
    }
  }
  return penalty;
}

function statSpread(values) {
  return Math.max(...values) - Math.min(...values);
}

function weightedBalancePenalty(stats) {
  return Object.entries(DRAW_BALANCE_WEIGHTS).reduce((total, [campo, peso]) => {
    const values = stats.map(s => Number(s.balance?.[campo] || 0));
    return total + (statSpread(values) * Number(peso || 0));
  }, 0);
}

function playerBandIds(players, ratio = 0.25) {
  if (!Array.isArray(players) || players.length < 4) {
    return { low: new Set(), high: new Set() };
  }
  const ordered = players.slice().sort((a, b) => {
    const ratingA = getBestNaturalPlayerRating(a);
    const ratingB = getBestNaturalPlayerRating(b);
    if (ratingA !== ratingB) return ratingA - ratingB;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });
  const bandSize = Math.max(1, Math.floor(ordered.length * ratio));
  return {
    low: new Set(ordered.slice(0, bandSize).map(playerKey)),
    high: new Set(ordered.slice(-bandSize).map(playerKey)),
  };
}

function teamBandCounts(equipos, bandIds) {
  return equipos.map(equipo => equipo.reduce((count, jugador) => (
    bandIds.has(playerKey(jugador)) ? count + 1 : count
  ), 0));
}

function countSpread(values) {
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}

function teamFloorScore(equipo, count = 2) {
  const ratings = equipo
    .map(jugador => getBestNaturalPlayerRating(jugador))
    .sort((a, b) => a - b);
  return ratings.slice(0, Math.max(1, Math.min(count, ratings.length))).reduce((sum, rating) => sum + rating, 0);
}

function teamFloorSpread(equipos, count = 2) {
  const values = equipos.map(equipo => teamFloorScore(equipo, count));
  return countSpread(values);
}

function playerLowLiability(jugador) {
  const rating = getBestNaturalPlayerRating(jugador);
  let liability = Math.max(0, 2.5 - rating) * 2;
  if (rating < 2) {
    liability += (2 - rating) * 3;
  }
  return liability;
}

function teamLowLiabilityScore(equipo) {
  return equipo.reduce((sum, jugador) => sum + playerLowLiability(jugador), 0);
}

function teamLowLiabilitySpread(equipos) {
  return countSpread(equipos.map(teamLowLiabilityScore));
}

function evaluarEquipos(equipos, teamSize, maxDiff, options = {}) {
  const stats = equipos.map(equipo => teamStats(equipo, options));
  const puntos = stats.map(s => s.total);
  const lentos = stats.map(s => s.lentos);
  const irregulares = stats.map(s => s.irregulares);
  const rapidos = stats.map(s => s.rapidos);
  const diffPuntos = Math.max(...puntos) - Math.min(...puntos);
  const diffLentos = Math.max(...lentos) - Math.min(...lentos);
  const diffIrregulares = Math.max(...irregulares) - Math.min(...irregulares);
  const diffRapidos = Math.max(...rapidos) - Math.min(...rapidos);

  const repeatPenalty = historicalRepeatPenalty(equipos);
  const balancePenalty = weightedBalancePenalty(stats);
  const outOfPositionPenalty = stats.reduce((sum, stat) => sum + (stat.fueraDePosicion || 0), 0) * 12;
  const flatPlayers = equipos.flat();
  const bandIds = options.bandIds || playerBandIds(flatPlayers);
  const lowBandSpread = countSpread(teamBandCounts(equipos, bandIds.low));
  const highBandSpread = countSpread(teamBandCounts(equipos, bandIds.high));
  const bandPenalty = (lowBandSpread * 120) + (highBandSpread * 90);
  const floorSpread = teamFloorSpread(equipos, 2);
  const floorPenalty = floorSpread * 55;
  const lowLiabilitySpread = teamLowLiabilitySpread(equipos);
  const lowLiabilityPenalty = lowLiabilitySpread * 85;
  const irregularPenalty = diffIrregulares * 95;
  let penalidad = balancePenalty + diffLentos * 25 + diffRapidos * 10 + irregularPenalty + repeatPenalty + outOfPositionPenalty + bandPenalty + floorPenalty + lowLiabilityPenalty;
  let hardOk = true;

  const maxFieldLine = maxFieldPlayersPerLine(teamSize);

  for (const stat of stats) {
    if (stat.arqueros !== 1) {
      penalidad += Math.abs(stat.arqueros - 1) * 100000;
      hardOk = false;
    }
    for (const linea of REQUIRED_FIELD_LINES) {
      const cantidad = stat.lineasCancha?.[linea] || 0;
      const minFieldLine = fieldLineMinimum(linea, teamSize);
      if (cantidad < minFieldLine) penalidad += (minFieldLine - cantidad) * 25000;
      if (cantidad > maxFieldLine) penalidad += (cantidad - maxFieldLine) * 25000;
    }
  }

  const perfecto = hardOk
    && diffPuntos <= maxDiff
    && diffLentos <= 1
    && diffIrregulares <= 1
    && lowBandSpread <= 1
    && highBandSpread <= 1
    && floorSpread <= 1
    && lowLiabilitySpread <= 1
    && equipos.every(equipo => equipo.length === teamSize)
    && stats.every(stat => REQUIRED_FIELD_LINES.every(linea => (stat.lineasCancha?.[linea] || 0) >= fieldLineMinimum(linea, teamSize) && (stat.lineasCancha?.[linea] || 0) <= maxFieldLine));

  return { penalidad, perfecto, diffPuntos, diffLentos, diffIrregulares, diffRapidos, lowBandSpread, highBandSpread, floorSpread, lowLiabilitySpread, repeatPenalty, balancePenalty, outOfPositionPenalty, bandPenalty, floorPenalty, lowLiabilityPenalty, irregularPenalty, stats };
}

function construirCandidato(players, numEquipos, teamSize, semilla, options = {}) {
  const arqueros = players.filter(p => getPrimaryPlayerPosition(p) === 'ARQ' || isEmergencyGoalkeeper(p)).sort(() => Math.random() - 0.5);
  const arquerosPuros = arqueros.filter(isPureGoalkeeper);
  const arquerosMixtos = arqueros.filter(p => !isPureGoalkeeper(p));
  const arquerosTitulares = [...arquerosPuros, ...arquerosMixtos]
    .sort((a, b) => {
      if (semilla % 3 === 0) return getBestNaturalPlayerRating(b) - getBestNaturalPlayerRating(a);
      if (semilla % 3 === 1) return getBestNaturalPlayerRating(a) - getBestNaturalPlayerRating(b);
      return Math.random() - 0.5;
    })
    .slice(0, numEquipos);

  if (arquerosTitulares.length < numEquipos) return null;

  const equipos = Array.from({ length: numEquipos }, () => []);
  const titulares = new Set(arquerosTitulares);
  arquerosTitulares.forEach((jugador, index) => equipos[index].push(jugador));

  const restantes = players
    .filter(p => !titulares.has(p))
    .sort((a, b) => {
      const ritmoA = isLowRhythmPlayer(a) ? 1 : 0;
      const ritmoB = isLowRhythmPlayer(b) ? 1 : 0;
      if (semilla % 4 === 0 && ritmoA !== ritmoB) return ritmoB - ritmoA;
      if (semilla % 4 === 1 && ritmoA !== ritmoB) return ritmoA - ritmoB;
      const ratingDiff = getBestNaturalPlayerRating(b) - getBestNaturalPlayerRating(a);
      if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
      return Math.random() - 0.5;
    });

  for (const jugador of restantes) {
    let mejorEquipo = null;
    let mejorScore = Infinity;
    for (let idx = 0; idx < numEquipos; idx++) {
      if (equipos[idx].length >= teamSize) continue;
      const candidato = clonarEquipos(equipos);
      candidato[idx].push(jugador);
      const score = evaluarEquipos(candidato, teamSize, 999, options).penalidad;
      if (score < mejorScore) {
        mejorScore = score;
        mejorEquipo = idx;
      }
    }
    if (mejorEquipo === null) return null;
    equipos[mejorEquipo].push(jugador);
  }

  return equipos.every(equipo => equipo.length === teamSize) ? equipos : null;
}

function mejorarPorIntercambios(equipos, teamSize, maxDiff, options = {}) {
  let mejor = clonarEquipos(equipos);
  let mejorEval = evaluarEquipos(mejor, teamSize, maxDiff, options);
  let cambio = true;
  let pasadas = 0;

  while (cambio && pasadas < 3) {
    cambio = false;
    pasadas++;
    for (let a = 0; a < mejor.length; a++) {
      for (let b = a + 1; b < mejor.length; b++) {
        for (let i = 0; i < mejor[a].length; i++) {
          for (let j = 0; j < mejor[b].length; j++) {
            const candidato = clonarEquipos(mejor);
            const tmp = candidato[a][i];
            candidato[a][i] = candidato[b][j];
            candidato[b][j] = tmp;
            const evaluacion = evaluarEquipos(candidato, teamSize, maxDiff, options);
            if (evaluacion.penalidad + 0.0001 < mejorEval.penalidad) {
              mejor = candidato;
              mejorEval = evaluacion;
              cambio = true;
            }
          }
        }
      }
    }
  }

  return { equipos: mejor, evaluacion: mejorEval };
}

function drawEvaluationRank(evaluation) {
  return [
    evaluation?.perfecto ? 0 : 1,
    evaluation?.signatureAvoided ? 1 : 0,
    Number(evaluation?.penalidad || 0),
  ];
}

function drawEvaluationIsBetter(candidate, current) {
  if (!current) return true;
  const left = drawEvaluationRank(candidate);
  const right = drawEvaluationRank(current);
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) {
      return left[index] < right[index];
    }
  }
  return false;
}

function generarDosEquiposOptimos(players, teamSize, maxDiff, options = {}) {
  const total = players.length;
  const indices = [0];
  let mejor = null;
  let mejorEval = null;

  function evaluarSeleccion() {
    const elegidos = new Set(indices);
    const equipoA = [];
    const equipoB = [];
    for (let i = 0; i < total; i++) {
      if (elegidos.has(i)) equipoA.push(players[i]);
      else equipoB.push(players[i]);
    }
    const equipos = [equipoA, equipoB];
    const evaluacion = evaluarEquipos(equipos, teamSize, maxDiff, options);
    const signatureAvoided = options.avoidSignatures?.has(drawSignature(equipos)) || false;
    const adjustedEvaluation = {
      ...evaluacion,
      signatureAvoided,
      penalidad: evaluacion.penalidad + (signatureAvoided ? 100000000 : 0),
    };
    if (drawEvaluationIsBetter(adjustedEvaluation, mejorEval)) {
      mejor = equipos;
      mejorEval = adjustedEvaluation;
    }
  }

  function backtrack(start) {
    if (indices.length === teamSize) {
      evaluarSeleccion();
      return;
    }
    const faltan = teamSize - indices.length;
    for (let i = start; i <= total - faltan; i++) {
      indices.push(i);
      backtrack(i + 1);
      indices.pop();
    }
  }

  backtrack(1);
  return mejor ? { equipos: mejor, evaluacion: mejorEval } : null;
}

function generarEquiposOptimos(players, numEquipos, maxDiff, options = {}) {
  const teamSize = players.length / numEquipos;
  const scopedOptions = { ...options, bandIds: options.bandIds || playerBandIds(players) };
  if (numEquipos === 2 && players.length <= 20) {
    const exacto = generarDosEquiposOptimos(players, teamSize, maxDiff, scopedOptions);
    if (exacto) {
      return {
        equipos: exacto.equipos,
        perfecto: exacto.evaluacion.perfecto,
        metricas: exacto.evaluacion
      };
    }
  }

  let mejor = null;
  let mejorEval = null;
  const intentos = Math.min(1800, Math.max(500, players.length * players.length * 4));

  for (let intento = 0; intento < intentos; intento++) {
    const candidato = construirCandidato(players, numEquipos, teamSize, intento, scopedOptions);
    if (!candidato) continue;
    const mejorado = mejorarPorIntercambios(candidato, teamSize, maxDiff, scopedOptions);
    const signatureAvoided = scopedOptions.avoidSignatures?.has(drawSignature(mejorado.equipos)) || false;
    const adjustedEvaluation = {
      ...mejorado.evaluacion,
      signatureAvoided,
      penalidad: mejorado.evaluacion.penalidad + (signatureAvoided ? 100000000 : 0),
    };
    if (drawEvaluationIsBetter(adjustedEvaluation, mejorEval)) {
      mejor = mejorado.equipos;
      mejorEval = adjustedEvaluation;
      if (mejorEval.perfecto && (mejorEval.repeatPenalty || 0) === 0) break;
    }
  }

  if (!mejor) return null;
  return { equipos: mejor, perfecto: mejorEval.perfecto, metricas: mejorEval };
}

function generatedAssignments(equipos, options = {}) {
  return equipos.map(equipo => {
    const assignment = buildPositionAssignment(equipo, options).asignacion;
    const out = {};
    equipo.forEach(jugador => {
      out[playerKey(jugador)] = getPrimaryPosition(jugador, assignment);
    });
    return out;
  });
}

function generarEquiposConDiferenciaAuto(players, numEquipos, initialDiff = 0.5, options = {}) {
  const start = Math.min(STRICT_MAX_DIFF, Math.max(0.5, initialDiff || 0.5));
  let mejorResultado = null;
  for (let diff = start; diff <= STRICT_MAX_DIFF; diff += 0.5) {
    const resultado = generarEquiposOptimos(players, numEquipos, diff, options);
    if (resultado && (!mejorResultado || resultado.metricas.penalidad < mejorResultado.metricas.penalidad)) {
      mejorResultado = resultado;
      mejorResultado.usedMaxDiff = Math.max(diff, resultado.metricas.diffPuntos || diff);
    }
    if (resultado && resultado.perfecto) {
      resultado.usedMaxDiff = diff;
      return resultado;
    }
  }

  let mejorFlexible = null;
  for (let diff = 0.5; diff <= FLEXIBLE_MAX_DIFF; diff += 0.5) {
    const resultado = generarEquiposOptimos(players, numEquipos, diff, { ...options, allowOutOfPosition: true });
    if (!resultado) continue;
    resultado.flexiblePositions = true;
    resultado.flexibleAssignments = generatedAssignments(resultado.equipos, { allowOutOfPosition: true });
    if (!mejorFlexible || resultado.metricas.penalidad < mejorFlexible.metricas.penalidad) {
      mejorFlexible = resultado;
      mejorFlexible.usedMaxDiff = Math.max(diff, resultado.metricas.diffPuntos || diff);
    }
    if (resultado.perfecto) {
      resultado.usedMaxDiff = diff;
      return resultado;
    }
  }

  return mejorFlexible || mejorResultado;
}

function applyFlexibleFormationAssignments(resultado) {
  if (!resultado?.flexiblePositions || !Array.isArray(resultado.flexibleAssignments)) return;
  teamFormations = {};
  customFormations = {};
  manualAssignments = {};
  resultado.equipos.forEach((equipo, teamIndex) => {
    const assignments = resultado.flexibleAssignments[teamIndex] || {};
    const counts = Object.fromEntries(FIELD_LINES.map(line => [line, 0]));
    equipo.forEach(jugador => {
      const assigned = assignments[playerKey(jugador)] || '';
      if (FORMATION_LINES.includes(assigned)) {
        manualAssignments[playerKey(jugador)] = assigned;
        if (counts[assigned] !== undefined) counts[assigned]++;
      }
    });
    teamFormations[teamIndex] = 'custom';
    customFormations[teamIndex] = counts;
  });
}

function validarEquiposDetalle(equipos, teamSize, maxDiff, { strictBalance = true, allowOutOfPosition = false } = {}) {
  let puntuaciones = [];

  for (let equipoIndex = 0; equipoIndex < equipos.length; equipoIndex++) {
    const equipo = equipos[equipoIndex];
    const nombreEquipo = getTeamDisplayName(equipoIndex);
    if (equipo.length !== teamSize) {
      return { ok: false, reason: `${nombreEquipo} tiene ${equipo.length} jugadores y debe tener ${teamSize}.` };
    }

    const { asignacion, arquerosAsignados, lineaMaximaValida } = buildPositionAssignment(equipo, { allowOutOfPosition });
    if (arquerosAsignados !== 1) {
      return { ok: false, reason: `${nombreEquipo} queda con ${arquerosAsignados} arqueros asignados. Cada equipo debe tener exactamente 1 arquero.` };
    }
    if (!lineaMaximaValida) {
      return { ok: false, reason: `${nombreEquipo} supera el limite: maximo ${maxFieldPlayersPerLine(teamSize)} por linea: DEF/LAT, MED y DEL.` };
    }
    const posiciones = new Set(Array.from(asignacion.values()).map(pitchLineForPosition));
    const posicionesRequeridas = ['ARQ', ...REQUIRED_FIELD_LINES];
    if (!posicionesRequeridas.every(p => posiciones.has(p))) {
      const faltantes = posicionesRequeridas.filter(p => !posiciones.has(p)).join(', ');
      return { ok: false, reason: `${nombreEquipo} no cubre todas las lineas requeridas. Falta: ${faltantes}.` };
    }

    const puntuacion = equipo.reduce((sum, j) => {
      const assignedPosition = getPrimaryPosition(j, asignacion);
      return sum + adjustedPositionRating(j, assignedPosition);
    }, 0);
    puntuaciones.push(puntuacion);

  }

  const max = Math.max(...puntuaciones);
  const min = Math.min(...puntuaciones);
  const diff = max - min;
  if (strictBalance && diff > maxDiff) {
    return { ok: false, reason: `La diferencia de puntaje entre equipos es ${diff.toFixed(1)} y el maximo permitido es ${maxDiff.toFixed(1)}.` };
  }
  const lentosPorEquipo = equipos.map(equipo => equipo.filter(isLowRhythmPlayer).length);
  const diffLentos = Math.max(...lentosPorEquipo) - Math.min(...lentosPorEquipo);
  if (strictBalance && diffLentos > 1) {
    return { ok: false, reason: `Los equipos no reparten el ritmo de forma pareja: lentos por equipo ${lentosPorEquipo.join(' / ')}.` };
  }
  return { ok: true, reason: '' };
}

function validarEquipos(equipos, teamSize, maxDiff) {
  return validarEquiposDetalle(equipos, teamSize, maxDiff).ok;
}

function playerKey(jugador) {
  return String(jugador.id || jugador.nombre);
}

function drawSignature(equipos) {
  if (!Array.isArray(equipos) || !equipos.length) return '';
  return equipos
    .map(equipo => (Array.isArray(equipo) ? equipo : [])
      .map(jugador => playerKey(jugador))
      .sort()
      .join(','))
    .sort()
    .join('|');
}

function rememberDrawSignature(equipos) {
  const signature = drawSignature(equipos);
  if (signature) {
    seenDrawSignatures.add(signature);
  }
  return signature;
}

function shuffledPlayers(players) {
  const copy = players.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function redrawPolicyApplies() {
  return LOCKED_MATCH_MODE;
}

function nextGenerationIsRedraw() {
  return redrawPolicyApplies() && (hasSavedDraw || generatedOnceThisSession || !!lastEquipos);
}

function redrawsRemaining() {
  return Math.max(0, REDRAW_LIMIT - persistedRedrawCount - redrawsUsedThisSession);
}

function generateButtonLabel() {
  if (nextGenerationIsRedraw()) {
    return `Rehacer sorteo (${redrawsRemaining()} restantes)`;
  }
  return 'Generar equipos';
}

function refreshGenerateButtonState() {
  const button = document.getElementById('generateTeamsButton');
  if (!button) return;
  button.textContent = generateButtonLabel();
  button.disabled = nextGenerationIsRedraw() && (!ALLOW_REDRAW || redrawsRemaining() <= 0);
}

function getFormationOptions(teamSize) {
  const fieldPlayers = Math.max(0, teamSize - 1);
  const maxPerLine = maxFieldPlayersPerLine(teamSize);
  const maxDefLat = maxDefLatPlayersPerPosition(teamSize);
  const minDefLat = fieldLineMinimum('DEF', teamSize);
  const minMed = fieldLineMinimum('MED', teamSize);
  const minDel = fieldLineMinimum('DEL', teamSize);
  const candidates = [];
  for (let def = 0; def <= Math.min(maxDefLat, fieldPlayers); def++) {
    for (let lat = 0; lat <= Math.min(maxDefLat, fieldPlayers - def); lat++) {
      if (def + lat > maxPerLine) continue;
      for (let med = 0; med <= Math.min(maxPerLine, fieldPlayers - def - lat); med++) {
        const del = fieldPlayers - def - lat - med;
        if (del < 0 || del > maxPerLine) continue;
        if ((def + lat) < minDefLat || med < minMed || del < minDel) continue;
        const values = [def + lat, med, del];
        const balance = Math.max(...values) - Math.min(...values);
        candidates.push({ DEF: def, LAT: lat, MED: med, DEL: del, value: `${def}-${lat}-${med}-${del}`, balance });
      }
    }
  }

  const preferred = [];
  const addBest = (sorter) => {
    const option = candidates.slice().sort(sorter).find(item => !preferred.some(p => p.value === item.value));
    if (option) preferred.push(option);
  };

  addBest((a, b) => a.balance - b.balance || b.MED - a.MED || (b.DEF + b.LAT) - (a.DEF + a.LAT) || b.LAT - a.LAT);
  addBest((a, b) => (b.DEF + b.LAT) - (a.DEF + a.LAT) || a.balance - b.balance);
  addBest((a, b) => b.MED - a.MED || a.balance - b.balance);
  addBest((a, b) => b.DEL - a.DEL || a.balance - b.balance);

  return preferred.slice(0, 4);
}

function formationOptionsHtml(teamIndex, teamSize) {
  const options = getFormationOptions(teamSize);
  const selected = teamFormations[teamIndex] || 'auto';
  return `
    <option value="auto" ${selected === 'auto' ? 'selected' : ''}>Automatica</option>
    ${options.map(option => `<option value="${option.value}" ${selected === option.value ? 'selected' : ''}>${option.value}</option>`).join('')}
    <option value="custom" ${selected === 'custom' ? 'selected' : ''}>Personalizada</option>
  `;
}

function selectedFormationCounts(teamIndex, teamSize) {
  const selectedFormation = teamFormations[teamIndex] || 'auto';
  if (selectedFormation === 'auto') return null;
  if (selectedFormation === 'custom') {
    const custom = customFormations[teamIndex] || defaultFormationCounts(teamSize);
    const maxPerLine = maxFieldPlayersPerLine(teamSize);
    const maxDefLat = maxDefLatPlayersPerPosition(teamSize);
    const counts = {
      DEF: Math.min(maxDefLat, Math.max(0, parseInt(custom.DEF || 0, 10))),
      LAT: Math.min(maxDefLat, Math.max(0, parseInt(custom.LAT || 0, 10))),
      MED: Math.min(maxPerLine, Math.max(0, parseInt(custom.MED || 0, 10))),
      DEL: Math.min(maxPerLine, Math.max(0, parseInt(custom.DEL || 0, 10)))
    };
    while (counts.DEF + counts.LAT > maxPerLine) {
      if (counts.LAT >= counts.DEF && counts.LAT > 0) counts.LAT--;
      else if (counts.DEF > 0) counts.DEF--;
      else break;
    }
    return counts;
  }
  const parts = selectedFormation.split('-').map(value => parseInt(value, 10));
  if (parts.length >= 4) {
    return { DEF: parts[0] || 0, LAT: parts[1] || 0, MED: parts[2] || 0, DEL: parts[3] || 0 };
  }
  return { DEF: parts[0] || 0, LAT: 0, MED: parts[1] || 0, DEL: parts[2] || 0 };
}

function clonePlainObject(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function pushTeamFormationUndo(teamIndex) {
  const key = String(teamIndex);
  teamFormationUndoStack[key] = teamFormationUndoStack[key] || [];
  teamFormationUndoStack[key].push({
    lastEquipos: clonePlainObject(lastEquipos),
    teamFormations: clonePlainObject(teamFormations),
    customFormations: clonePlainObject(customFormations),
    manualAssignments: clonePlainObject(manualAssignments),
  });
}

function undoTeamFormationChange(teamIndex) {
  const key = String(teamIndex);
  const snapshot = (teamFormationUndoStack[key] || []).pop();
  if (!snapshot) return;
  if (snapshot.lastEquipos) lastEquipos = snapshot.lastEquipos;
  teamFormations = snapshot.teamFormations || {};
  customFormations = snapshot.customFormations || {};
  manualAssignments = snapshot.manualAssignments || {};
  if (lastEquipos) mostrarEquipos(lastEquipos);
}

function defaultFormationCounts(teamSize) {
  const first = getFormationOptions(teamSize)[0] || { DEF: 0, LAT: 0, MED: 0, DEL: Math.max(0, teamSize - 1) };
  return { DEF: first.DEF, LAT: first.LAT, MED: first.MED, DEL: first.DEL };
}

function customLineMinimum(line, teamSize) {
  const fieldPlayers = Math.max(0, Number(teamSize || 0) - 1);
  if (fieldPlayers === 4) return ['MED', 'DEL'].includes(line) ? 1 : 0;
  if (fieldPlayers < 5) return 0;
  if (line === 'MED') return 2;
  if (line === 'DEL') return 1;
  return 0;
}

function currentFormationLineCounts(teamIndex) {
  const team = lastEquipos && lastEquipos[teamIndex] ? lastEquipos[teamIndex] : [];
  const assignment = buildFormationAssignment(team, teamIndex);
  const counts = Object.fromEntries(FIELD_LINES.map(line => [line, 0]));
  team.forEach(jugador => {
    const position = getPrimaryPosition(jugador, assignment);
    if (counts[position] !== undefined) counts[position]++;
  });
  return counts;
}

function normalizeCustomFormationCounts(teamSize, currentCounts, changedLine, requestedValue) {
  const total = Math.max(0, Number(teamSize || 0) - 1);
  const lines = FIELD_LINES;
  const counts = {};
  lines.forEach(line => {
    const lineMin = customLineMinimum(line, teamSize);
    counts[line] = Math.min(fieldLineLimit(line, teamSize), Math.max(lineMin, parseInt(currentCounts?.[line] || 0, 10)));
  });

  if (lines.includes(changedLine)) {
    const lineMin = customLineMinimum(changedLine, teamSize);
    counts[changedLine] = Math.min(fieldLineLimit(changedLine, teamSize), Math.max(lineMin, parseInt(requestedValue || 0, 10)));
  }

  const clampDefenseLine = () => {
    for (const line of ['DEF', 'LAT']) {
      const lineMin = customLineMinimum(line, teamSize);
      while (counts[line] > fieldLineLimit(line, teamSize) && counts[line] > lineMin) {
        counts[line]--;
      }
    }
    while (counts.DEF + counts.LAT > maxFieldPlayersPerLine(teamSize)) {
      const line = changedLine === 'DEF' ? 'LAT' : changedLine === 'LAT' ? 'DEF' : (counts.LAT >= counts.DEF ? 'LAT' : 'DEF');
      const lineMin = customLineMinimum(line, teamSize);
      if (counts[line] > lineMin) {
        counts[line]--;
      } else {
        const other = line === 'DEF' ? 'LAT' : 'DEF';
        const otherMin = customLineMinimum(other, teamSize);
        if (counts[other] > otherMin) counts[other]--;
        else break;
      }
    }
    while (counts.DEF + counts.LAT < fieldLineMinimum('DEF', teamSize)) {
      const line = changedLine === 'LAT' ? 'LAT' : 'DEF';
      if (counts.DEF + counts.LAT >= maxFieldPlayersPerLine(teamSize)) break;
      counts[line]++;
    }
  };
  clampDefenseLine();

  let diff = total - lines.reduce((sum, line) => sum + counts[line], 0);
  while (diff !== 0) {
    const candidates = lines
      .filter(line => line !== changedLine)
      .filter(line => {
        if (diff > 0) return counts[line] < fieldLineLimit(line, teamSize);
        if (line === 'DEF' || line === 'LAT') return (counts.DEF + counts.LAT) > fieldLineMinimum('DEF', teamSize) && counts[line] > customLineMinimum(line, teamSize);
        return counts[line] > customLineMinimum(line, teamSize);
      })
      .sort((a, b) => diff > 0 ? counts[a] - counts[b] : counts[b] - counts[a]);
    const line = candidates[0] || lines.find(item => {
      if (diff > 0) return counts[item] < fieldLineLimit(item, teamSize);
      if (item === 'DEF' || item === 'LAT') return (counts.DEF + counts.LAT) > fieldLineMinimum('DEF', teamSize) && counts[item] > customLineMinimum(item, teamSize);
      return counts[item] > customLineMinimum(item, teamSize);
    });
    if (!line) break;
    counts[line] += diff > 0 ? 1 : -1;
    clampDefenseLine();
    diff += diff > 0 ? -1 : 1;
  }
  return counts;
}

function rebalanceManualAssignmentsForTeam(teamIndex, counts, previousAssignment) {
  const team = lastEquipos && lastEquipos[teamIndex] ? lastEquipos[teamIndex] : [];
  if (!team.length) return;

  team.forEach(jugador => {
    delete manualAssignments[playerKey(jugador)];
  });

  const assigned = new Set();
  const nextAssignment = new Map();
  const goalkeeper = team.find(jugador => previousAssignment?.get(jugador) === 'ARQ')
    || team.find(jugador => getPrimaryPlayerPosition(jugador) === 'ARQ' || isEmergencyGoalkeeper(jugador));
  if (goalkeeper) {
    assigned.add(goalkeeper);
    nextAssignment.set(goalkeeper, 'ARQ');
    manualAssignments[playerKey(goalkeeper)] = 'ARQ';
  }

  FIELD_LINES.forEach(line => {
    const preferredCurrent = team
      .filter(jugador => !assigned.has(jugador) && previousAssignment?.get(jugador) === line)
      .sort((a, b) => adjustedPositionRating(b, line) - adjustedPositionRating(a, line));
    while ((counts[line] || 0) > 0 && preferredCurrent.length) {
      const jugador = preferredCurrent.shift();
      assigned.add(jugador);
      nextAssignment.set(jugador, line);
      manualAssignments[playerKey(jugador)] = line;
      counts[line]--;
    }
  });

  FIELD_LINES.forEach(line => {
    while ((counts[line] || 0) > 0) {
      const candidates = team
        .filter(jugador => !assigned.has(jugador))
        .sort((a, b) => {
          const prefA = getOrderedPlayerPositions(a).includes(line) ? 0 : 1;
          const prefB = getOrderedPlayerPositions(b).includes(line) ? 0 : 1;
          if (prefA !== prefB) return prefA - prefB;
          return adjustedPositionRating(b, line) - adjustedPositionRating(a, line);
        });
      const jugador = candidates[0];
      if (!jugador) break;
      assigned.add(jugador);
      nextAssignment.set(jugador, line);
      manualAssignments[playerKey(jugador)] = line;
      counts[line]--;
    }
  });
}

function onTeamFormationChange(teamIndex, value) {
  pushTeamFormationUndo(teamIndex);
  teamFormations[teamIndex] = value;
  if (value === 'custom' && !customFormations[teamIndex] && lastEquipos && lastEquipos[teamIndex]) {
    customFormations[teamIndex] = defaultFormationCounts(lastEquipos[teamIndex].length);
  }
  if (lastEquipos) mostrarEquipos(lastEquipos);
}

function onTeamCustomFormationChange(teamIndex, line, value) {
  const team = lastEquipos && lastEquipos[teamIndex] ? lastEquipos[teamIndex] : [];
  if (!team.length) return;
  pushTeamFormationUndo(teamIndex);
  const previousAssignment = buildFormationAssignment(team, teamIndex);
  const current = currentFormationLineCounts(teamIndex);
  const counts = normalizeCustomFormationCounts(team.length, current, line, value);
  customFormations[teamIndex] = { ...counts };
  teamFormations[teamIndex] = 'custom';
  rebalanceManualAssignmentsForTeam(teamIndex, { ...counts }, previousAssignment);
  if (lastEquipos) mostrarEquipos(lastEquipos);
}

function onTeamLineDelta(teamIndex, line, delta) {
  const team = lastEquipos && lastEquipos[teamIndex] ? lastEquipos[teamIndex] : [];
  if (!team.length || line === 'ARQ') return;
  const current = currentFormationLineCounts(teamIndex);
  const nextValue = Number(current[line] || 0) + Number(delta || 0);
  onTeamCustomFormationChange(teamIndex, line, nextValue);
}

function onManualPositionChange(teamIndex, playerId, position) {
  const team = lastEquipos && lastEquipos[teamIndex] ? lastEquipos[teamIndex] : [];
  const player = team.find(jugador => playerKey(jugador) === String(playerId));
  if (player) {
    const currentAssignment = buildFormationAssignment(team, teamIndex);
    const proposedAssignment = new Map(currentAssignment);
    proposedAssignment.set(player, position);
    if (assignmentGoalkeeperCount(team, proposedAssignment) > 1) {
      alert('Cada equipo puede tener como maximo un arquero.');
      if (lastEquipos) mostrarEquipos(lastEquipos);
      return;
    }
    if (!fieldLineCountsFitLimits(countAssignmentLines(proposedAssignment), team.length)) {
      alert(`Limite de formacion: maximo ${maxFieldPlayersPerLine(team.length)} por linea: DEF/LAT, MED y DEL.`);
      if (lastEquipos) mostrarEquipos(lastEquipos);
      return;
    }
  }
  pushTeamFormationUndo(teamIndex);
  if (!customFormations[teamIndex] && lastEquipos && lastEquipos[teamIndex]) {
    customFormations[teamIndex] = defaultFormationCounts(lastEquipos[teamIndex].length);
  }
  teamFormations[teamIndex] = 'custom';
  manualAssignments[String(playerId)] = position;
  if (lastEquipos) mostrarEquipos(lastEquipos);
}

function assignmentGoalkeeperCount(team, assignment) {
  return team.reduce((count, jugador) => (
    count + (getPrimaryPosition(jugador, assignment) === 'ARQ' ? 1 : 0)
  ), 0);
}

function onFormationPlayerDrop(sourceTeamIndex, sourcePlayerKey, targetTeamIndex, targetPlayerKey) {
  if (!lastEquipos || sourcePlayerKey === targetPlayerKey) return;
  const sourceTeam = lastEquipos[sourceTeamIndex];
  const targetTeam = lastEquipos[targetTeamIndex];
  if (!sourceTeam || !targetTeam) return;

  const sourceAssignment = buildFormationAssignment(sourceTeam, sourceTeamIndex);
  const targetAssignment = sourceTeamIndex === targetTeamIndex
    ? sourceAssignment
    : buildFormationAssignment(targetTeam, targetTeamIndex);
  const sourcePlayer = sourceTeam.find(jugador => playerKey(jugador) === sourcePlayerKey);
  const targetPlayer = targetTeam.find(jugador => playerKey(jugador) === targetPlayerKey);
  if (!sourcePlayer || !targetPlayer) return;

  const sourcePosition = getPrimaryPosition(sourcePlayer, sourceAssignment);
  const targetPosition = getPrimaryPosition(targetPlayer, targetAssignment);

  if (sourceTeamIndex === targetTeamIndex) {
    const proposedAssignment = new Map(sourceAssignment);
    proposedAssignment.set(sourcePlayer, targetPosition);
    proposedAssignment.set(targetPlayer, sourcePosition);

    if (assignmentGoalkeeperCount(sourceTeam, proposedAssignment) > 1) {
      alert('Cada equipo puede tener como maximo un arquero.');
      return;
    }
  } else {
    const proposedSourceTeam = sourceTeam.map(jugador => (
      playerKey(jugador) === sourcePlayerKey ? targetPlayer : jugador
    ));
    const proposedTargetTeam = targetTeam.map(jugador => (
      playerKey(jugador) === targetPlayerKey ? sourcePlayer : jugador
    ));
    const proposedSourceAssignment = new Map(buildFormationAssignment(sourceTeam, sourceTeamIndex));
    const proposedTargetAssignment = new Map(buildFormationAssignment(targetTeam, targetTeamIndex));
    proposedSourceAssignment.delete(sourcePlayer);
    proposedTargetAssignment.delete(targetPlayer);
    proposedSourceAssignment.set(targetPlayer, sourcePosition);
    proposedTargetAssignment.set(sourcePlayer, targetPosition);

    if (
      assignmentGoalkeeperCount(proposedSourceTeam, proposedSourceAssignment) > 1
      || assignmentGoalkeeperCount(proposedTargetTeam, proposedTargetAssignment) > 1
    ) {
      alert('Cada equipo puede tener como maximo un arquero.');
      return;
    }
  }

  pushTeamFormationUndo(sourceTeamIndex);
  if (sourceTeamIndex !== targetTeamIndex) {
    pushTeamFormationUndo(targetTeamIndex);
  }

  if (sourceTeamIndex === targetTeamIndex) {
    const sourceIdx = sourceTeam.findIndex(jugador => playerKey(jugador) === sourcePlayerKey);
    const targetIdx = sourceTeam.findIndex(jugador => playerKey(jugador) === targetPlayerKey);
    if (sourceIdx >= 0 && targetIdx >= 0) {
      [lastEquipos[sourceTeamIndex][sourceIdx], lastEquipos[sourceTeamIndex][targetIdx]] = [lastEquipos[sourceTeamIndex][targetIdx], lastEquipos[sourceTeamIndex][sourceIdx]];
    }
  }

  if (sourceTeamIndex !== targetTeamIndex) {
    const sourceIdx = sourceTeam.findIndex(jugador => playerKey(jugador) === sourcePlayerKey);
    const targetIdx = targetTeam.findIndex(jugador => playerKey(jugador) === targetPlayerKey);
    if (sourceIdx >= 0 && targetIdx >= 0) {
      lastEquipos[sourceTeamIndex][sourceIdx] = targetPlayer;
      lastEquipos[targetTeamIndex][targetIdx] = sourcePlayer;
    }
  }

  if (!customFormations[sourceTeamIndex]) {
    customFormations[sourceTeamIndex] = defaultFormationCounts(sourceTeam.length);
  }
  if (!customFormations[targetTeamIndex]) {
    customFormations[targetTeamIndex] = defaultFormationCounts(targetTeam.length);
  }
  teamFormations[sourceTeamIndex] = 'custom';
  teamFormations[targetTeamIndex] = 'custom';
  manualAssignments[playerKey(sourcePlayer)] = targetPosition;
  manualAssignments[playerKey(targetPlayer)] = sourcePosition;
  mostrarEquipos(lastEquipos);
}

function onFormationLineDrop(sourceTeamIndex, sourcePlayerKey, targetTeamIndex, targetPosition) {
  if (!lastEquipos) return;
  const position = String(targetPosition || '').toUpperCase();
  if (!FORMATION_LINES.includes(position)) return;

  const team = lastEquipos[targetTeamIndex];
  if (!team) return;
  if (sourceTeamIndex !== targetTeamIndex) {
    const targetAssignment = buildFormationAssignment(team, targetTeamIndex);
    const targetPlayer = team.find(jugador => getPrimaryPosition(jugador, targetAssignment) === position) || team[0];
    if (targetPlayer) {
      onFormationPlayerDrop(sourceTeamIndex, sourcePlayerKey, targetTeamIndex, playerKey(targetPlayer));
    }
    return;
  }

  const player = team.find(jugador => playerKey(jugador) === sourcePlayerKey);
  if (!player) return;

  const assignment = buildFormationAssignment(team, targetTeamIndex);
  const currentPosition = getPrimaryPosition(player, assignment);
  if (currentPosition === position) return;

  onManualPositionChange(targetTeamIndex, sourcePlayerKey, position);
}

function buildFormationAssignment(equipo, teamIndex = 0) {
  const base = buildTeamPositionAssignment(equipo);
  const selectedFormation = teamFormations[teamIndex] || 'auto';
  if (selectedFormation === 'auto') {
    return base.asignacion;
  }

  const counts = selectedFormationCounts(teamIndex, equipo.length);
  const remaining = { DEF: counts.DEF || 0, LAT: counts.LAT || 0, MED: counts.MED || 0, DEL: counts.DEL || 0 };
  const assignment = new Map();
  const assigned = new Set();
  const baseGoalkeeper = equipo.find(jugador => base.asignacion.get(jugador) === 'ARQ')
    || equipo.find(jugador => getPrimaryPlayerPosition(jugador) === 'ARQ' || isEmergencyGoalkeeper(jugador));
  const manualGoalkeeper = equipo.find(jugador => manualAssignments[playerKey(jugador)] === 'ARQ');
  const selectedGoalkeeper = manualGoalkeeper || baseGoalkeeper;

  if (selectedGoalkeeper) {
    assignment.set(selectedGoalkeeper, 'ARQ');
    assigned.add(selectedGoalkeeper);
  }

  for (const jugador of equipo) {
    if (assigned.has(jugador)) continue;
    const manual = manualAssignments[playerKey(jugador)];
    if (FIELD_LINES.includes(manual)) {
      assignment.set(jugador, manual);
      assigned.add(jugador);
      if (remaining[manual] !== undefined && remaining[manual] > 0) {
        remaining[manual]--;
      }
    }
  }

  for (const line of FIELD_LINES) {
    while (remaining[line] > 0) {
      const candidates = equipo
        .filter(jugador => !assigned.has(jugador))
        .sort((a, b) => {
          const positionsA = getOrderedPlayerPositions(a);
          const positionsB = getOrderedPlayerPositions(b);
          const prefA = positionsA.includes(line) ? 0 : 1;
          const prefB = positionsB.includes(line) ? 0 : 1;
          if (prefA !== prefB) return prefA - prefB;
          const ratingA = adjustedPositionRating(a, line);
          const ratingB = adjustedPositionRating(b, line);
          const ratingDiff = ratingB - ratingA;
          if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
          return a.nombre.localeCompare(b.nombre);
        });
      if (!candidates.length) break;
      const chosen = candidates[0];
      assignment.set(chosen, line);
      assigned.add(chosen);
      remaining[line]--;
    }
  }

  for (const jugador of equipo) {
    if (assigned.has(jugador)) continue;
    const logicalCounts = countAssignmentLines(assignment);
    const fallback = FIELD_LINES.slice()
      .filter(line => {
        const proposed = { ...logicalCounts };
        proposed[line] = (proposed[line] || 0) + 1;
        return fieldLineCountsFitLimits(proposed, equipo.length);
      })
      .sort((a, b) => logicalCounts[a] - logicalCounts[b] || adjustedPositionRating(jugador, b) - adjustedPositionRating(jugador, a))[0] || 'MED';
    assignment.set(jugador, fallback);
    assigned.add(jugador);
  }

  return assignment;
}

function mostrarEquipos(equipos) {
  const container = document.getElementById('equipos-generados');
  container.innerHTML = '';
  const matchupTitle = document.createElement('div');
  matchupTitle.className = 'mx-auto w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-center text-xl font-black text-[#07130f] shadow-sm';
  matchupTitle.dataset.sorteoMatchupTitle = '1';
  matchupTitle.textContent = getMatchupDisplayName(equipos.length);
  container.appendChild(matchupTitle);
  
  equipos.forEach((equipo, index) => {
    const equipoDiv = document.createElement('div');
    equipoDiv.className = 'grid gap-3 rounded-2xl border border-emerald-200 bg-white p-3 text-[#07130f] shadow-lg shadow-emerald-950/10';
    equipoDiv.dataset.teamIndex = String(index);
    equipoDiv.dataset.sorteoTeamCard = '1';
    const teamColor = getTeamColor(index);
    let headerText = getTeamDisplayName(index);
    if (teamColor) {
      equipoDiv.dataset.teamColor = teamColor.class;
    }
    
    const jugadoresOrdenados = equipo.slice();
    
    const resumenStats = teamTotalsSummary(jugadoresOrdenados);
    const asignacionPosiciones = buildFormationAssignment(jugadoresOrdenados, index);
    const totalPuntos = jugadoresOrdenados.reduce((sum, jugador) => {
      const assignedPosition = getPrimaryPosition(jugador, asignacionPosiciones);
      return sum + adjustedPositionRating(jugador, assignedPosition);
    }, 0);
    const maxCustomLine = maxFieldPlayersPerLine(jugadoresOrdenados.length);

    const ordenCancha = PITCH_LINES;
    const etiquetasPosicion = {
      ARQ: 'ARQ',
      DEF: 'DEF',
      LAT: 'LAT',
      MED: 'MED',
      DEL: 'DEL'
    };
    const jugadoresPorLinea = Object.fromEntries(FORMATION_LINES.map(line => [line, []]));

    jugadoresOrdenados.forEach(jugador => {
      const posicionPrincipal = getPrimaryPosition(jugador, asignacionPosiciones);
      if (!jugadoresPorLinea[posicionPrincipal]) {
        jugadoresPorLinea.MED.push(jugador);
        return;
      }
      jugadoresPorLinea[posicionPrincipal].push(jugador);
    });

    equipoDiv.innerHTML = `
      <div class="team-head">
        <h4 data-team-title>${headerText}</h4>
        <span class="formation-total-badge">${totalPuntos.toFixed(1)} pts</span>
      </div>
      <div class="captain-formation-tools">
        <div class="team-control-group">
          <label>Camiseta</label>
          <select data-sorteo-action="team-color-change" data-team-index="${index}">
            ${teamColorOptionsHtml(index)}
          </select>
        </div>
        <div class="team-control-group">
          <label>Formacion</label>
          <select data-sorteo-action="team-formation-change" data-team-index="${index}">
            ${formationOptionsHtml(index, jugadoresOrdenados.length)}
          </select>
        </div>
      </div>
      <div class="formation-total-title"><span>Ajustada</span><strong>${totalPuntos.toFixed(1)} pts</strong></div>
      <div class="team-formation captain-formation-field" data-sorteo-drop-team="${index}">
        <button class="formation-undo-button" type="button" title="Deshacer ultimo cambio" aria-label="Deshacer ultimo cambio" data-sorteo-action="formation-undo" data-team-index="${index}" ${(teamFormationUndoStack[String(index)] || []).length ? '' : 'disabled'}>↶</button>
        ${ordenCancha.map(pos => {
          const linePlayers = pos === 'DEF'
            ? [...jugadoresPorLinea.LAT.slice(0, 1), ...jugadoresPorLinea.DEF, ...jugadoresPorLinea.LAT.slice(1)]
            : jugadoresPorLinea[pos];
          const lineControls = pos === 'DEF' ? ['DEF', 'LAT'] : [pos];
          return `
          <div class="formation-line captain-formation-line ${pos === 'ARQ' ? '' : 'has-line-tools'} ${pos === 'DEF' ? 'is-defense-line' : ''}">
            ${pos === 'ARQ' ? `
              <div class="line-label captain-line-label"><span><strong>${etiquetasPosicion[pos]}</strong><small>${jugadoresPorLinea[pos].length}/1</small></span></div>
            ` : `
              <div class="line-label captain-line-label has-line-controls">
                ${pos === 'DEF' ? `<span><strong>DEF/LAT</strong><small>${linePlayers.length}/${maxCustomLine}</small></span>` : ''}
                ${lineControls.map(controlLine => `
                  ${pos !== 'DEF' ? `<span><strong>${controlLine}</strong><small>${jugadoresPorLinea[controlLine].length}/${maxCustomLine}</small></span>` : ''}
                  <button class="captain-line-control is-minus" type="button" data-sorteo-action="team-line-delta" data-team-index="${index}" data-line="${controlLine}" data-delta="-1" aria-label="Quitar jugador de ${controlLine}">-</button>
                `).join('')}
              </div>
              ${lineControls.map(controlLine => `<button class="captain-line-control is-plus" type="button" data-sorteo-action="team-line-delta" data-team-index="${index}" data-line="${controlLine}" data-delta="1" aria-label="Agregar jugador a ${controlLine}">+</button>`).join('')}
            `}
            <div class="line-players" data-sorteo-drop-line="${pos}" data-team-index="${index}">
              ${linePlayers.map(j => {
                const assignedPosition = getPrimaryPosition(j, asignacionPosiciones);
                const adjustedRating = adjustedPositionRating(j, assignedPosition);
                const generalRating = Number(j.puntuacion || 0);
                const naturalPositions = getOrderedPlayerPositions(j);
                const primaryPosition = naturalPositions[0] || '';
                const outOfPosition = !naturalPositions.includes(assignedPosition);
                const secondaryPosition = !outOfPosition && assignedPosition !== primaryPosition;
                const positionChanged = outOfPosition || secondaryPosition;
                const penaltyPercent = positionPenaltyPercent(j, assignedPosition);
                const roleNote = secondaryPosition
                  ? ` | Secundaria: ${assignedPosition}. Primaria: ${primaryPosition}`
                  : (outOfPosition ? ' | Fuera de posicion natural' : '');
                const cardTitle = `General ${formatRating(generalRating)} | Ajustada ${assignedPosition} ${formatRating(adjustedRating)}${roleNote}`;
                return `
                <div class="formation-player captain-formation-player card-pro-relieve formation-card-sin-stat formation-card-compacta formation-card-tier-${playerCardTier(adjustedRating)} ${outOfPosition ? 'is-out-of-position' : ''} ${secondaryPosition ? 'is-secondary-position' : ''} ${positionChanged ? 'is-position-changed' : ''}" draggable="true" data-sorteo-drag-player="1" data-team-index="${index}" data-player-key="${playerKey(j)}" data-assigned-position="${assignedPosition}" title="${escapeHtml(cardTitle)}">
                  ${playerCardRatingHtml(adjustedRating, 'GEN')}
                  ${playerCardPhotoHtml(j)}
                  <strong class="formation-player-name">${escapeHtml(j.nombre)} ${isLowRhythmPlayer(j) ? '&#128034;' : ''}</strong>
                  <span class="captain-position-pill formation-player-meta formation-player-position formation-card-position ${secondaryPosition ? 'is-assigned-secondary' : ''}">${assignedPosition}${secondaryPosition ? ' <em class="formation-secondary-badge">2a</em>' : ''}</span>
                  ${playerCardRegularityHtml(j)}
                  ${penaltyPercent > 0 ? `<span class="formation-penalty-badge formation-card-penalty">-${penaltyPercent}%</span>` : ''}
                  ${playerCardStatsHtml(j, assignedPosition)}
                </div>
              `}).join('')}
            </div>
          </div>
        `;
        }).join('')}
      </div>
      <div class="totals">
        <div class="totals-breakdown" aria-label="Criterios considerados por el sorteo">
          ${resumenStats.arquero > 0 ? `<span>Arquero ${resumenStats.arquero.toFixed(1)}</span>` : `<span>Ataque ${resumenStats.ataque.toFixed(1)}</span>`}
          <span>Solidez ${resumenStats.solidez.toFixed(1)}</span>
          <span>Ritmo ${resumenStats.ritmo.toFixed(1)}</span>
          <span>Tecnica ${resumenStats.tecnica.toFixed(1)}</span>
          <span>Juego en equipo ${resumenStats.compromiso.toFixed(1)}</span>
          <span>Mentalidad ${resumenStats.mentalidad.toFixed(1)}</span>
          <span>Regularidad ${resumenStats.regularidad.toFixed(1)}</span>
        </div>
        <small>El sorteo pondera General 50, Ataque 15, Solidez 15, Ritmo 10, Tecnica 5, Juego en equipo 8, Mentalidad 10 y Regularidad 5. Tambien reparte el cuartil de menor puntaje y el cuartil top para evitar concentrar flojos o figuras.</small>
      </div>
    `;
    container.appendChild(equipoDiv);
  });
  
  document.getElementById('download-controls').classList.remove('hidden');
}

function descargarEquiposJPG() {
  const equiposContainer = document.getElementById('equipos-generados');
  if (!equiposContainer || !lastEquipos) {
    alert('Primero genera los equipos');
    return;
  }
  if (typeof html2canvas !== 'function') {
    alert('No se pudo cargar el exportador de imagen. Recarga la pagina e intenta de nuevo.');
    return;
  }
  const button = document.querySelector('[data-sorteo-action="download-teams-jpg"]');
  const originalText = button ? button.textContent : '';
  if (button) {
    button.disabled = true;
    button.textContent = 'Generando JPG...';
  }
  const fileDate = new Date().toISOString().slice(0, 10);
  html2canvas(equiposContainer, {
    backgroundColor: '#f6faf8',
    scale: 2,
    useCORS: true,
    onclone: (clonedDocument) => {
      clonedDocument.querySelectorAll('link[rel="stylesheet"], style').forEach(node => node.remove());
      const exportStyles = clonedDocument.createElement('style');
      exportStyles.textContent = `
        * { box-sizing: border-box; }
        body { margin: 0; background: #f6faf8; color: #07130f; font-family: Arial, sans-serif; }
        #equipos-generados { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; width: 1400px; max-width: 1400px; padding: 14px; background: #f6faf8; }
        #equipos-generados > div:first-child { grid-column: 1 / -1; border: 1px solid #b9d4c8; border-radius: 10px; background: #ffffff; padding: 12px; text-align: center; font-size: 22px; font-weight: 900; }
        [data-sorteo-team-card] { display: grid; gap: 10px; border: 1px solid #b9d4c8; border-radius: 10px; background: #eef6f1; padding: 10px; color: #07130f; }
        .team-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; border: 1px solid #d2e3da; border-radius: 9px; background: #ffffff; padding: 9px 11px; }
        .team-head h4 { margin: 0; font-size: 17px; font-weight: 900; }
        .formation-total-badge { border-radius: 7px; background: #dff7e9; padding: 5px 8px; font-size: 13px; font-weight: 900; }
        .formation-total-title, .captain-formation-tools, .formation-undo-button, .captain-line-control, .totals { display: none !important; }
        .captain-formation-field { display: grid; grid-template-rows: repeat(4, minmax(172px, 1fr)); gap: 10px; min-height: 760px; border: 1px solid #7fb89c; border-radius: 10px; background: linear-gradient(180deg, rgba(9,74,41,.96), rgba(13,70,42,.98)); padding: 14px; color: #f2fff7; }
        .captain-formation-line { display: grid; grid-template-columns: 58px minmax(0, 1fr); align-items: center; gap: 8px; min-height: 172px; }
        .captain-line-label { color: #f4fff8; text-align: center; font-size: 10px; font-weight: 900; text-shadow: 0 1px 2px rgba(0,0,0,.45); }
        .captain-line-label span { display: grid; gap: 2px; }
        .captain-line-label strong, .captain-line-label small { display: block; color: #f4fff8; }
        .line-players { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 10px; min-height: 172px; overflow: visible; }
        .captain-formation-player.formation-card-sin-stat { --formation-card-image: url("assets/card-backgrounds/clean-bronze.png"); --formation-slot-bg: rgba(245,240,229,.78); --formation-slot-line: rgba(7,19,15,.28); position: relative; display: block; flex: 0 0 118px; width: 118px; min-width: 118px; aspect-ratio: 409 / 710; border: 0; border-radius: 0; background: var(--formation-card-image) center / contain no-repeat; color: #07130f; padding: 0; overflow: hidden; filter: drop-shadow(0 4px 8px rgba(2,14,9,.24)); }
        .captain-formation-player.formation-card-tier-bronze { --formation-card-image: url("assets/card-backgrounds/clean-bronze.png"); --formation-slot-bg: rgba(248,217,155,.78); }
        .captain-formation-player.formation-card-tier-silver { --formation-card-image: url("assets/card-backgrounds/clean-silver.png"); --formation-slot-bg: rgba(249,255,251,.74); }
        .captain-formation-player.formation-card-tier-gold { --formation-card-image: url("assets/card-backgrounds/clean-gold.png"); --formation-slot-bg: rgba(255,240,157,.72); }
        .captain-formation-player.formation-card-tier-elite { --formation-card-image: url("assets/card-backgrounds/clean-elite.png"); --formation-slot-bg: rgba(247,241,255,.34); --formation-slot-line: rgba(243,237,255,.5); }
        .captain-formation-player.formation-card-tier-supreme { --formation-card-image: url("assets/card-backgrounds/reference-supreme.png"); --formation-slot-bg: rgba(223,253,243,.78); --formation-slot-line: rgba(159,255,230,.58); }
        .captain-formation-player.formation-card-sin-stat .player-card-rating { position: absolute; z-index: 2; top: 12.9%; left: 14%; display: grid; place-items: center; width: 23.5%; height: 12.8%; border: 0; border-radius: 0; background: transparent; color: #07130f; line-height: 1; }
        .captain-formation-player.formation-card-sin-stat .player-card-rating::before { content: ""; position: absolute; z-index: -1; top: -18%; left: -8.1%; width: 108.1%; height: 285%; border: 1px solid rgba(44,22,9,.2); border-radius: 8px; background: rgba(255,240,157,.28); box-shadow: inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(7,19,15,.1); }
        .captain-formation-player.formation-card-sin-stat .player-card-rating strong { display: block; color: #07130f; font-size: 16px; font-weight: 950; line-height: 1; text-align: center; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.52), 1px 0 0 rgba(255,255,255,.34), -1px 0 0 rgba(255,255,255,.26); }
        .captain-formation-player.formation-card-sin-stat .player-card-rating span { display: none; }
        .captain-formation-player.formation-card-sin-stat > .formation-card-position { position: absolute; z-index: 2; top: 24.6%; left: 14%; right: auto; display: grid; place-items: center; width: 23.5%; height: 6.6%; border: 0; border-radius: 0; background: transparent; color: #07130f; padding: 0; font-size: 8px; font-weight: 950; line-height: 1; text-transform: uppercase; text-shadow: 0 1px 0 rgba(255,255,255,.52), 1px 0 0 rgba(255,255,255,.34), -1px 0 0 rgba(255,255,255,.26); }
        .captain-formation-player.formation-card-sin-stat.is-position-changed > .formation-card-position { border-color: #07130f; background: #f2c14e; box-shadow: 0 0 0 1px rgba(255,250,206,.95), 0 0 0 3px rgba(7,19,15,.38), inset 0 -1px 0 rgba(7,19,15,.18); }
        .captain-formation-player.formation-card-sin-stat > .formation-player-name { position: absolute; z-index: 3; top: 47.2%; left: 11.5%; right: 8%; display: grid; place-items: center; width: auto; height: 12.4%; overflow: hidden; border: 0; border-radius: 8px; background: rgba(255,240,157,.64); color: #07130f; padding: 0 3px; font-size: 9px; font-weight: 950; line-height: 1; text-align: center; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; text-shadow: 0 1px 0 rgba(255,255,255,.52), 1px 0 0 rgba(255,255,255,.34), -1px 0 0 rgba(255,255,255,.26); }
        .formation-card-photo { position: absolute; z-index: 1; top: 8.8%; left: 36%; right: 8.5%; display: flex; align-items: flex-start; justify-content: center; height: 37.6%; overflow: hidden; border-radius: 8px; background: linear-gradient(180deg, transparent 0 74%, rgba(7,19,15,.08) 100%); }
        .formation-card-photo img { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center top; opacity: .62; border-radius: 8px; filter: drop-shadow(0 5px 6px rgba(0,0,0,.2)); }
        .formation-card-photo.is-custom img { opacity: 1; }
        .formation-card-regularity { position: absolute; z-index: 4; left: 20.7%; right: auto; top: 32.8%; width: 11.8%; height: 7.8%; border: 0; border-radius: 0; background: transparent; }
        .formation-card-regularity::before, .formation-card-regularity::after { content: ""; position: absolute; left: 50%; background: currentColor; transform: translateX(-50%); }
        .formation-card-regularity::before { top: 26%; width: 15%; height: 48%; }
        .formation-card-regularity::after { top: 17%; width: 44%; height: 44%; clip-path: polygon(50% 0, 100% 100%, 0 100%); }
        .formation-card-regularity.is-up { color: #0d6b3e; }
        .formation-card-regularity.is-right { color: #5b6370; transform: rotate(90deg); }
        .formation-card-regularity.is-down { color: #8a1f1f; transform: rotate(180deg); }
        .formation-card-stats { position: absolute; z-index: 3; top: 61.8%; left: 11.5%; right: 8%; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); grid-template-rows: repeat(3,1fr); gap: 8% 8%; height: 24.2%; overflow: hidden; border-top: 1px solid rgba(44,22,9,.2); border-bottom: 1px solid rgba(44,22,9,.18); border-radius: 8px; background: rgba(255,240,157,.2); padding: 4% 6% 3.5%; }
        .formation-card-stat { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 2px; overflow: hidden; border: 0; border-radius: 0; background: transparent; color: #07130f; padding: 0; font-size: 7px; font-weight: 950; line-height: 1; text-shadow: 0 1px 0 rgba(255,255,255,.52), 1px 0 0 rgba(255,255,255,.34), -1px 0 0 rgba(255,255,255,.26); }
        .formation-card-stat span, .formation-card-stat strong { display: block; min-width: 0; overflow: hidden; color: #07130f; font-size: inherit; font-weight: 950; line-height: 1; white-space: nowrap; }
        .formation-card-penalty { position: absolute; z-index: 4; top: 24.5%; left: 14%; display: grid; place-items: center; min-width: 24%; height: 8%; border: 1px solid rgba(127,29,29,.42); border-radius: 5px; background: rgba(255,232,232,.86); color: #7f1d1d; font-size: 7px; font-style: normal; font-weight: 950; line-height: 1; }
        .formation-secondary-badge { display: inline-flex; align-items: center; border-radius: 5px; background: #f2c14e; color: #2f2100; padding: 1px 3px; font-size: 6px; font-style: normal; font-weight: 900; line-height: 1; }
        .captain-formation-player.formation-card-compacta { flex-basis: 96px; width: 96px; min-width: 96px; aspect-ratio: 409 / 710; background-size: contain; background-position: center; }
        .captain-formation-player.formation-card-compacta .formation-card-stats { display: none; }
        .captain-formation-player.formation-card-compacta .player-card-rating { top: 12.9%; left: 14%; width: 23.5%; height: 12.8%; }
        .captain-formation-player.formation-card-compacta > .formation-card-position { top: 24.6%; left: 14%; right: auto; width: 23.5%; height: 6.6%; border: 0; }
        .captain-formation-player.formation-card-compacta .formation-card-photo { top: 8.8%; left: 36%; right: 8.5%; height: 37.6%; }
        .captain-formation-player.formation-card-compacta > .formation-player-name { top: 47.2%; left: 11.5%; right: 8%; width: auto; height: 12.4%; font-size: 8px; }
        .captain-formation-player.formation-card-compacta .formation-card-regularity { top: 32.8%; left: 20.7%; right: auto; bottom: auto; width: 11.8%; height: 7.8%; }
      `;
      clonedDocument.head.appendChild(exportStyles);
      clonedDocument.body.classList.add('is-exporting-formations');
      const clonedContainer = clonedDocument.getElementById('equipos-generados');
      if (clonedContainer) {
        clonedContainer.classList.add('formation-export-canvas');
        clonedContainer.style.width = '1400px';
      }
    },
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = `formaciones_goodfellas_${fileDate}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.95);
    link.click();
  }).catch(err => {
    console.error('Error al generar la imagen:', err);
    alert('Hubo un error al generar la imagen');
  }).finally(() => {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || 'Exportar formaciones JPG';
    }
  });
}

function descargarEquiposTexto() {
  const equipos = lastEquipos;
  if (!equipos) {
    alert('Primero genera los equipos');
    return;
  }
  let texto = 'EQUIPOS GOODFELLAS\n\n';
  texto += `${getMatchupDisplayName(equipos.length)}\n\n`;
  equipos.forEach((equipo, index) => {
    texto += `${getTeamDisplayName(index)}\n`;
    const asignacion = buildFormationAssignment(equipo, index);
    equipo.forEach(j => {
      const assignedPosition = getPrimaryPosition(j, asignacion);
      texto += `${j.nombre} ${isLowRhythmPlayer(j) ? '🐢' : ''} - ${assignedPosition} - ${adjustedPositionRating(j, assignedPosition).toFixed(1)} pts\n`;
    });
    const totalPuntos = equipo.reduce((sum, j) => {
      const assignedPosition = getPrimaryPosition(j, asignacion);
      return sum + adjustedPositionRating(j, assignedPosition);
    }, 0);
    const totalLentos = equipo.filter(isLowRhythmPlayer).length;
    texto += `Total: ${totalPuntos.toFixed(1)} pts | Lentos: ${totalLentos}\n\n`;
  });
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'equipos_goodfellas.txt';
  link.click();
}

function copiarEquiposClipboard() {
  const equipos = lastEquipos;
  if (!equipos) {
    alert('Primero genera los equipos');
    return;
  }
  let texto = '';
  texto += `${getMatchupDisplayName(equipos.length)}\n`;
  equipos.forEach((equipo, index) => {
    texto += `\n${getTeamDisplayName(index)}:\n`;
    equipo.forEach(j => {
      texto += `${j.nombre.toUpperCase()} ${isLowRhythmPlayer(j) ? '🐢' : ''}\n`;
    });
  });
  navigator.clipboard.writeText(texto)
    .then(() => {
      alert('¡Nombres de los equipos copiados al portapapeles! Puedes pegarlos en un chat.');
    })
    .catch(err => {
      console.error('Error al copiar al portapapeles:', err);
      alert('Hubo un error al copiar al portapapeles');
    });
}

function guardarSorteoEnBD() {
  if (!MATCH_ID) {
    alert('Esta pantalla no está vinculada a una fecha.');
    return;
  }
  if (!lastEquipos) {
    alert('Primero genera los equipos');
    return;
  }
  if (!teamColorsAreUnique(lastEquipos.length)) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
      errorDiv.textContent = 'Cada equipo necesita un color de camiseta distinto.';
      errorDiv.classList.remove('hidden');
    } else {
      alert('Cada equipo necesita un color de camiseta distinto.');
    }
    return;
  }

  const equiposPayload = [];
  for (const equipo of lastEquipos) {
    const ids = [];
    const asignacionPosiciones = buildFormationAssignment(equipo, equiposPayload.length);
    for (const jugador of equipo) {
      if (!jugador.id) {
        alert(`El jugador "${jugador.nombre}" no tiene ID de base de datos y no puede guardarse.`);
        return;
      }
      ids.push({
        id: jugador.id,
        assigned_position: getPrimaryPosition(jugador, asignacionPosiciones),
      });
    }
    const teamColor = getTeamColor(equiposPayload.length);
    equiposPayload.push({
      color_name: teamColor ? teamColor.name : '',
      players: ids
    });
  }

  const payload = {
    match_id: MATCH_ID,
    num_teams: parseInt(document.getElementById('teamDisplay').textContent, 10),
    redraw_increment: redrawsUsedThisSession,
    teams: equiposPayload
  };

  fetch('guardar_sorteo.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(async res => {
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'No se pudo guardar el sorteo');
    }
    const successDiv = document.getElementById('success');
    const errorDiv = document.getElementById('error');
    persistedRedrawCount += redrawsUsedThisSession;
    redrawsUsedThisSession = 0;
    hasSavedDraw = true;
    generatedOnceThisSession = false;
    refreshGenerateButtonState();
    errorDiv.classList.add('hidden');
    successDiv.textContent = data.message || 'Sorteo guardado correctamente en la fecha.';
    successDiv.classList.remove('hidden');
    window.setTimeout(() => {
      navigateSorteoLegacy('editar_partidos.php');
    }, 700);
  })
  .catch(err => {
    const errorDiv = document.getElementById('error');
    const successDiv = document.getElementById('success');
    successDiv.classList.add('hidden');
    errorDiv.textContent = err.message;
    errorDiv.classList.remove('hidden');
  });
}

function isFormationPointerDragEnabled() {
  return true;
}

function closeFormationCardPreview() {
  formationCardPreviewOverlay?.remove();
  formationCardPreviewOverlay = null;
  document.body.classList.remove('has-formation-card-preview');
}

function sorteoPlayerContextFromCard(card) {
  const teamIndex = Number(card?.dataset?.teamIndex);
  const key = String(card?.dataset?.playerKey || '');
  const team = Number.isInteger(teamIndex) && lastEquipos ? lastEquipos[teamIndex] : null;
  const player = Array.isArray(team) ? team.find(jugador => playerKey(jugador) === key) : null;
  if (!player) return null;
  const assignment = buildFormationAssignment(team, teamIndex);
  const assignedPosition = String(card?.dataset?.assignedPosition || getPrimaryPosition(player, assignment) || getPrimaryPlayerPosition(player)).toUpperCase();
  return { player, assignedPosition };
}

function sorteoFullPlayerCardHtml(player, assignedPosition) {
  const naturalPositions = getOrderedPlayerPositions(player);
  const primaryPosition = naturalPositions[0] || 'MED';
  const secondaryPosition = naturalPositions[1] || '';
  const overall = playerCardRating(player.puntuacion);
  const tier = playerCardTier(player.puntuacion);
  const penaltyPercent = positionPenaltyPercent(player, assignedPosition);
  const positionChanged = assignedPosition && !naturalPositions.includes(assignedPosition);
  const secondaryAssigned = assignedPosition && !positionChanged && assignedPosition !== primaryPosition;
  const longNameClass = String(player.nombre || '').length > 12 ? ' is-long-name' : '';

  return `
    <div class="formation-player card-pro-relieve formation-card-sin-stat formation-card-preview-stat formation-card-reference-full formation-card-tier-${tier}${positionChanged ? ' is-out-of-position is-position-changed' : ''}${secondaryAssigned ? ' is-secondary-position is-position-changed' : ''}${longNameClass}" role="img" aria-label="Credencial de ${escapeHtml(player.nombre || 'Jugador')}" title="General ${overall} | Posiciones ${escapeHtml(naturalPositions.join('/'))}${assignedPosition ? ` | En cancha ${escapeHtml(assignedPosition)}` : ''}">
      <span class="formation-card-reference-tint" aria-hidden="true"></span>
      <span class="player-card-rating" title="Puntaje general">
        <strong>${overall}</strong>
        <span class="formation-card-rating-positions">
          <span>${escapeHtml(primaryPosition)}</span>
          ${secondaryPosition ? `<span>${escapeHtml(secondaryPosition)}</span>` : ''}
          ${playerCardRegularityHtml(player)}
        </span>
      </span>
      ${playerCardPhotoHtml(player)}
      <strong class="formation-player-name">${escapeHtml(player.nombre || 'Jugador')}</strong>
      <span class="formation-card-reference-separator" aria-hidden="true"></span>
      ${playerCardReferenceStatsHtml(player, primaryPosition)}
      ${penaltyPercent > 0 ? `<span class="formation-penalty-badge formation-card-penalty">-${penaltyPercent}%</span>` : ''}
    </div>
  `;
}

function openFormationCardPreview(card) {
  if (!card) return;
  closeFormationCardPreview();
  const context = sorteoPlayerContextFromCard(card);
  if (!context) return;

  const overlay = document.createElement('div');
  overlay.className = 'formation-card-preview-overlay';
  overlay.innerHTML = `
    <button class="formation-card-preview-close" type="button" aria-label="Cerrar carta" data-formation-card-preview-close>&times;</button>
    <div class="formation-card-preview-stage">
      <div class="formation-card-preview-scale">
        ${sorteoFullPlayerCardHtml(context.player, context.assignedPosition)}
      </div>
    </div>
  `;
  (card.closest('.content') || document.body).appendChild(overlay);
  document.body.classList.add('has-formation-card-preview');
  formationCardPreviewOverlay = overlay;
  overlay.querySelector('[data-formation-card-preview-close]')?.focus();
}

function clearSorteoFormationDragHighlights(root = document) {
  root.querySelectorAll('.is-team-drag-over, .is-drag-over')
    .forEach(el => el.classList.remove('is-team-drag-over', 'is-drag-over'));
}

function setCleanSorteoDragPayload(event, playerCard) {
  if (!event.dataTransfer) return;
  const playerName = playerCard.querySelector('.formation-player-name')?.textContent.trim() || 'Jugador';
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('application/json', JSON.stringify({
    teamIndex: Number(playerCard.dataset.teamIndex),
    playerKey: playerCard.dataset.playerKey || ''
  }));
  event.dataTransfer.setData('text/plain', playerName);

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  event.dataTransfer.setDragImage(canvas, 0, 0);
}

function formationDropTargetFromPoint(clientX, clientY, ghost = null) {
  if (ghost) ghost.style.display = 'none';
  const target = document.elementFromPoint(clientX, clientY);
  if (ghost) ghost.style.display = '';
  return target?.closest?.('[data-sorteo-drag-player], [data-sorteo-drop-line], [data-sorteo-drop-team], [data-sorteo-team-card]') || null;
}

function markSorteoFormationDragTarget(target, root) {
  clearSorteoFormationDragHighlights(root);
  formationPointerDragTarget = target || null;
  if (!target) return;
  const targetCard = target.closest?.('[data-sorteo-drag-player]');
  const targetLine = target.closest?.('[data-sorteo-drop-line]');
  const targetField = target.closest?.('.captain-formation-field');
  const targetTeam = target.closest?.('[data-sorteo-team-card]');
  if (targetCard) {
    targetCard.classList.add('is-drag-over');
  } else if (targetLine) {
    targetLine.classList.add('is-drag-over');
  } else if (targetField) {
    targetField.classList.add('is-team-drag-over');
  } else if (targetTeam) {
    targetTeam.classList.add('is-team-drag-over');
  }
}

function handleSorteoFormationDrop(source, target) {
  if (!source || !target) return false;
  const targetCard = target.closest?.('[data-sorteo-drag-player]');
  const targetLine = target.closest?.('[data-sorteo-drop-line]');
  const targetTeam = targetCard?.dataset.teamIndex
    || targetLine?.dataset.teamIndex
    || target.closest?.('[data-sorteo-drop-team]')?.dataset.sorteoDropTeam
    || target.closest?.('[data-sorteo-team-card]')?.dataset.teamIndex;
  if (targetCard) {
    onFormationPlayerDrop(
      Number(source.teamIndex),
      String(source.playerKey || ''),
      Number(targetCard.dataset.teamIndex),
      String(targetCard.dataset.playerKey || '')
    );
    return true;
  }
  if (targetLine) {
    onFormationLineDrop(
      Number(source.teamIndex),
      String(source.playerKey || ''),
      Number(targetLine.dataset.teamIndex),
      String(targetLine.dataset.sorteoDropLine || '')
    );
    return true;
  }
  if (targetTeam) {
    const teamCard = target.closest?.('[data-sorteo-team-card]');
    const fallbackCard = teamCard?.querySelector('[data-sorteo-drag-player]');
    if (fallbackCard) {
      onFormationPlayerDrop(
        Number(source.teamIndex),
        String(source.playerKey || ''),
        Number(fallbackCard.dataset.teamIndex),
        String(fallbackCard.dataset.playerKey || '')
      );
      return true;
    }
  }
  return false;
}

function startSorteoFormationPointerDrag(event, card, root) {
  if (!isFormationPointerDragEnabled() || event.button !== 0 || event.target.closest('button, select, input, textarea')) {
    return false;
  }

  event.preventDefault();
  try {
    card.setPointerCapture?.(event.pointerId);
  } catch (error) {
    // Pointer capture is best-effort; window listeners keep the drag working.
  }
  const sourceRect = card.getBoundingClientRect();
  const offsetX = event.clientX - sourceRect.left;
  const offsetY = event.clientY - sourceRect.top;
  const moveThreshold = event.pointerType === 'mouse' ? 4 : 8;
  const playerName = card.querySelector('.formation-player-name')?.textContent.trim() || 'Jugador';
  let hasMoved = false;
  let ghost = null;
  let trail = null;

  formationPointerDragState = {
    teamIndex: Number(card.dataset.teamIndex),
    playerKey: card.dataset.playerKey || ''
  };
  formationPointerDragTarget = null;
  card.classList.add('is-dragging');

  const moveDragVisuals = (moveEvent) => {
    if (!ghost) return;
    ghost.style.left = `${moveEvent.clientX - offsetX}px`;
    ghost.style.top = `${moveEvent.clientY - offsetY}px`;
    if (trail) {
      trail.style.left = `${moveEvent.clientX}px`;
      trail.style.top = `${moveEvent.clientY}px`;
    }
  };

  const onPointerMove = (moveEvent) => {
    const distance = Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY);
    if (!hasMoved && distance < moveThreshold) return;
    if (!hasMoved) {
      hasMoved = true;
      ghost = card.cloneNode(true);
      ghost.classList.add('is-pointer-drag-ghost');
      ghost.setAttribute('aria-hidden', 'true');
      ghost.removeAttribute('data-sorteo-drag-player');
      ghost.removeAttribute('draggable');
      ghost.style.width = `${sourceRect.width}px`;
      ghost.style.height = `${sourceRect.height}px`;
      document.body.appendChild(ghost);

      trail = document.createElement('div');
      trail.className = 'formation-pointer-drag-trail';
      trail.textContent = playerName;
      document.body.appendChild(trail);
    }
    moveEvent.preventDefault();
    moveDragVisuals(moveEvent);
    markSorteoFormationDragTarget(formationDropTargetFromPoint(moveEvent.clientX, moveEvent.clientY, ghost), root);
  };

  const onPointerUp = (upEvent) => {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);

    const target = hasMoved
      ? formationDropTargetFromPoint(upEvent.clientX, upEvent.clientY, ghost) || formationPointerDragTarget
      : null;
    if (target) {
      handleSorteoFormationDrop(formationPointerDragState, target);
    } else if (!hasMoved) {
      openFormationCardPreview(card);
    }

    try {
      card.releasePointerCapture?.(event.pointerId);
    } catch (error) {
      // Ignore browsers that already released capture.
    }
    card.classList.remove('is-dragging');
    ghost?.remove();
    trail?.remove();
    formationPointerDragState = null;
    formationPointerDragTarget = null;
    clearSorteoFormationDragHighlights(root);
  };

  window.addEventListener('pointermove', onPointerMove, true);
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('pointercancel', onPointerUp, true);
  return true;
}


function bindSorteoLegacyEvents() {
  const root = document.querySelector('[data-sorteo-legacy-root]');
  if (!root || root.dataset.sorteoLegacyBound === '1') return;
  root.dataset.sorteoLegacyBound = '1';

  root.addEventListener('click', (event) => {
    const control = event.target.closest('[data-sorteo-action]');
    if (!control) {
      const card = event.target.closest('[data-sorteo-drag-player].formation-card-compacta');
      if (card && root.contains(card)) {
        openFormationCardPreview(card);
      }
      return;
    }
    if (!root.contains(control)) return;
    const action = control.dataset.sorteoAction;

    if (control.matches('a[href="#"]')) event.preventDefault();
    if (action === 'toggle-sort-dropdown') event.stopPropagation();

    switch (action) {
      case 'navigate': navigateSorteoLegacy(control.dataset.url || 'editar_partidos.php'); break;
      case 'open-add-player': abrirModalAgregar(); break;
      case 'toggle-accordion': toggleAccordion(control); break;
      case 'export-players-csv': exportarJugadoresCSV(); break;
      case 'toggle-sort-dropdown': toggleSortDropdown(); break;
      case 'select-sort': selectSortOption(control.dataset.sortKey || 'nombre'); break;
      case 'generate-teams': generarEquipos(); break;
      case 'copy-teams': copiarEquiposClipboard(); break;
      case 'download-teams-jpg': descargarEquiposJPG(); break;
      case 'download-teams-text': descargarEquiposTexto(); break;
      case 'save-draw': guardarSorteoEnBD(); break;
      case 'close-modal': cerrarModal(control.dataset.modalId || ''); break;
      case 'score-down': decrementScore(control.dataset.scoreMode || ''); break;
      case 'score-up': incrementScore(control.dataset.scoreMode || ''); break;
      case 'save-new-player': guardarJugador(); break;
      case 'save-player-edit': guardarEdicion(); break;
      case 'edit-player': editarJugador(Number(control.dataset.playerIndex)); break;
      case 'delete-player': eliminarJugador(Number(control.dataset.playerIndex)); break;
      case 'formation-undo': undoTeamFormationChange(Number(control.dataset.teamIndex)); break;
      case 'team-line-delta': onTeamLineDelta(Number(control.dataset.teamIndex), control.dataset.line || '', Number(control.dataset.delta || 0)); break;
      default: break;
    }
  });

  root.addEventListener('change', (event) => {
    const control = event.target.closest('[data-sorteo-action]');
    if (!control || !root.contains(control)) return;

    switch (control.dataset.sorteoAction) {
      case 'import-players-csv': importarJugadoresCSV(event); break;
      case 'toggle-select-all': toggleSelectAll(control); break;
      case 'toggle-player': jugadores[Number(control.dataset.playerIndex)].selected = control.checked; break;
      case 'team-color-change': onTeamColorChange(Number(control.dataset.teamIndex), control.value); break;
      case 'team-formation-change': onTeamFormationChange(Number(control.dataset.teamIndex), control.value); break;
      case 'manual-position-change': onManualPositionChange(Number(control.dataset.teamIndex), control.dataset.playerKey || '', control.value); break;
      default: break;
    }
  });

  root.addEventListener('pointerdown', (event) => {
    const playerCard = event.target.closest('[data-sorteo-drag-player]');
    if (!playerCard || !root.contains(playerCard)) return;
    startSorteoFormationPointerDrag(event, playerCard, root);
  });

  root.addEventListener('dragstart', (event) => {
    const playerCard = event.target.closest('[data-sorteo-drag-player]');
    if (!playerCard || !root.contains(playerCard)) return;
    if (event.target.closest('select')) {
      event.preventDefault();
      return;
    }
    playerCard.classList.add('is-dragging');
    setCleanSorteoDragPayload(event, playerCard);
  });

  root.addEventListener('dragend', (event) => {
    const playerCard = event.target.closest('[data-sorteo-drag-player]');
    if (playerCard) playerCard.classList.remove('is-dragging');
    clearSorteoFormationDragHighlights(root);
  });

  root.addEventListener('dragover', (event) => {
    const targetCard = event.target.closest('[data-sorteo-drag-player]');
    const targetLine = event.target.closest('[data-sorteo-drop-line]');
    const targetField = event.target.closest('[data-sorteo-drop-team]');
    if (!targetCard && !targetLine && (!targetField || !root.contains(targetField))) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    clearSorteoFormationDragHighlights(root);
    if (targetCard && root.contains(targetCard)) {
      targetCard.classList.add('is-drag-over');
    } else if (targetLine) {
      targetLine.classList.add('is-drag-over');
    } else if (targetField) {
      targetField.classList.add('is-team-drag-over');
    }
  });

  root.addEventListener('dragleave', (event) => {
    const targetCard = event.target.closest('[data-sorteo-drag-player]');
    if (targetCard) targetCard.classList.remove('is-drag-over');
    const targetLine = event.target.closest('[data-sorteo-drop-line]');
    if (targetLine) targetLine.classList.remove('is-drag-over');
    const targetField = event.target.closest('[data-sorteo-drop-team]');
    if (targetField && !targetField.contains(event.relatedTarget)) {
      targetField.classList.remove('is-team-drag-over');
    }
  });

  root.addEventListener('drop', (event) => {
    const targetCard = event.target.closest('[data-sorteo-drag-player]');
    const targetLine = event.target.closest('[data-sorteo-drop-line]');
    const targetField = event.target.closest('[data-sorteo-drop-team]');
    if (!targetCard && !targetLine && (!targetField || !root.contains(targetField))) return;
    event.preventDefault();
    clearSorteoFormationDragHighlights(root);
    let source = null;
    try {
      source = JSON.parse(event.dataTransfer.getData('application/json') || 'null');
    } catch (error) {
      source = null;
    }
    if (!source) return;
    handleSorteoFormationDrop(source, targetCard || targetLine || targetField);
  });

  document.addEventListener('click', (event) => {
    if (!formationCardPreviewOverlay) return;
    if (event.target.closest('[data-formation-card-preview-close]') || event.target.classList.contains('formation-card-preview-overlay')) {
      closeFormationCardPreview();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && formationCardPreviewOverlay) {
      closeFormationCardPreview();
    }
  });
}
// Lista inicial de jugadores según lo solicitado
if (MATCH_ID > 0) {
  jugadores = PRELOADED_JUGADORES.map(j => ({
    id: j.id,
    nombre: j.nombre,
    posicion: normalizarPosiciones(j.posicion),
    ritmo: normalizarRitmo(j.ritmo),
    photo_path: j.photo_path || '',
    has_custom_photo: !!j.has_custom_photo,
    puntuacion: parseFloat(j.puntuacion),
    tecnica: parseFloat(j.tecnica),
    ritmo_stat: parseFloat(j.ritmo_stat),
    solidez: parseFloat(j.solidez),
    ataque: parseFloat(j.ataque),
    compromiso: parseFloat(j.compromiso),
    mentalidad: parseFloat(j.mentalidad),
    regularidad: parseFloat(j.regularidad),
    habilidad_arquero: parseFloat(j.habilidad_arquero),
    selected: true
  }));
} else {
  jugadores = [
    { nombre: "VIKINGO", posicion: "DEF/MED", ritmo: "rápido", puntuacion: 4.5, selected: true },
    { nombre: "FRANCO K", posicion: "ARQ/DEF", ritmo: "rápido", puntuacion: 3.5, selected: true },
    { nombre: "MARCELO", posicion: "MED", ritmo: "lento", puntuacion: 1, selected: true },
    { nombre: "MARIANO PLANAS", posicion: "DEF", ritmo: "lento", puntuacion: 3.5, selected: true },
    { nombre: "FACU", posicion: "DEF", ritmo: "lento", puntuacion: 2.5, selected: true },
    { nombre: "CUERVO", posicion: "DEF/MED", ritmo: "lento", puntuacion: 5, selected: true },
    { nombre: "PABLO K", posicion: "MED", ritmo: "rápido", puntuacion: 3, selected: true },
    { nombre: "MANU", posicion: "DEF/MED", ritmo: "rápido", puntuacion: 5, selected: true },
    { nombre: "PABLO", posicion: "DEF", ritmo: "rápido", puntuacion: 5, selected: true },
    { nombre: "JAVI", posicion: "ARQ/DEF", ritmo: "rápido", puntuacion: 3.5, selected: true },
    { nombre: "CESAR", posicion: "DEF", ritmo: "lento", puntuacion: 4, selected: true },
    { nombre: "PELA", posicion: "DEL", ritmo: "rápido", puntuacion: 4, selected: true },
    { nombre: "BRIAN", posicion: "DEF/DEL", ritmo: "lento", puntuacion: 5, selected: true },
    { nombre: "AUGUSTO", posicion: "MED", ritmo: "rápido", puntuacion: 4, selected: true },
    { nombre: "NICO", posicion: "MED", ritmo: "rápido", puntuacion: 3.5, selected: true },
    { nombre: "MARIAN", posicion: "DEL", ritmo: "lento", puntuacion: 2.5, selected: true },
    { nombre: "GUILLE", posicion: "ARQ/DEF", ritmo: "lento", puntuacion: 1, selected: true },
    { nombre: "MAURI", posicion: "DEL", ritmo: "rápido", puntuacion: 3, selected: true }
  ];
}

// Inicializar la lista de jugadores
bindSorteoLegacyEvents();
actualizarListaJugadores();
refreshGenerateButtonState();
if (LOCKED_MATCH_MODE && jugadores.length === 0) {
  const errorDiv = document.getElementById('error');
  errorDiv.textContent = 'Esta fecha no tiene jugadores convocados. Cárgalos desde la pantalla de fechas.';
  errorDiv.classList.remove('hidden');
}

Object.assign(window, {
  navigateSorteoLegacy,
  generarEquipos,
  copiarEquiposClipboard,
  descargarEquiposJPG,
  descargarEquiposTexto,
  guardarSorteoEnBD,
});
