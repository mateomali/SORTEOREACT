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
if (typeof sorteoLegacyConfig.savedDrawSignature === 'string' && sorteoLegacyConfig.savedDrawSignature !== '') {
  seenDrawSignatures.add(sorteoLegacyConfig.savedDrawSignature);
}
var REQUIRED_FIELD_LINES = ['DEF', 'MED', 'DEL'];
var STRICT_MAX_DIFF = 2.5;
var FLEXIBLE_MAX_DIFF = 6.0;

function maxFieldPlayersPerLine(teamSize) {
  return Math.max(0, Math.floor(Number(teamSize || 0) / 2));
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
  { name: "VERDE", class: "team-verde" }
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

var posicionEmojis = { ARQ: '🥅', DEF: '🛡️', MED: '🎯', DEL: '⚽' };

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
    return (statValue(jugador, 'solidez') * 0.60)
      + (statValue(jugador, 'ritmo_stat') * 0.12)
      + (statValue(jugador, 'tecnica') * 0.08)
      + (statValue(jugador, 'compromiso') * 0.08)
      + (statValue(jugador, 'mentalidad') * 0.08)
      + (statValue(jugador, 'ataque') * 0.04);
  }
  if (position === 'DEL') {
    return (statValue(jugador, 'ataque') * 0.60)
      + (statValue(jugador, 'tecnica') * 0.12)
      + (statValue(jugador, 'ritmo_stat') * 0.10)
      + (statValue(jugador, 'mentalidad') * 0.08)
      + (statValue(jugador, 'compromiso') * 0.06)
      + (statValue(jugador, 'solidez') * 0.04);
  }
  if (position === 'MED') {
    return (statValue(jugador, 'solidez') + statValue(jugador, 'ataque')) / 2;
  }
  return Number(jugador.puntuacion || 0);
}

function adjustedPositionRating(jugador, assignedPosition) {
  const position = String(assignedPosition || '').toUpperCase();
  const naturalPositions = getOrderedPlayerPositions(jugador);
  const generalRating = Number(jugador.puntuacion || 0);
  if (!position || naturalPositions.includes(position)) {
    return Math.max(1, Math.min(6, generalRating));
  }
  const baseRating = positionBaseRating(jugador, position);
  return Math.max(1, Math.min(6, baseRating));
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
    [5.2, 93], [5.3, 94], [6.0, 98],
  ];
  for (let i = 0; i < anchors.length - 1; i += 1) {
    const [fromRating, fromOverall] = anchors[i];
    const [toRating, toOverall] = anchors[i + 1];
    if (rating <= toRating) {
      const ratio = (rating - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 98;
}

function playerCardRatingHtml(value, label = 'GEN') {
  return `
    <span class="player-card-rating" title="Puntaje tarjeta">
      <strong>${playerCardRating(value)}</strong>
      <span>${escapeHtml(label)}</span>
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
  const orderMapping = { ARQ: 1, DEF: 2, MED: 3, DEL: 4 };
  const posArray = player.posicion.split('/');
  const orders = posArray.map(pos => orderMapping[pos] || 99);
  return Math.min(...orders);
}

function getOrderedPlayerPositions(player) {
  const posicionesValidas = ['ARQ', 'DEF', 'MED', 'DEL'];
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
        return (a.puntuacion - b.puntuacion) || String(a.nombre).localeCompare(String(b.nombre));
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
  const lineasCampo = ['DEF', 'MED', 'DEL'];
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
      if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
      return a.nombre.localeCompare(b.nombre);
    });

  const arqueroTitular = candidatosArq[0]
    || equipo.slice().sort((a, b) => (a.puntuacion - b.puntuacion) || String(a.nombre).localeCompare(String(b.nombre)))[0]
    || null;
  const asignacion = new Map();
  const preferenciasPorJugador = new Map();

  equipo.forEach(jugador => {
    const posiciones = getOrderedPlayerPositions(jugador);
    let preferencias = posiciones.slice();

    if (jugador === arqueroTitular) {
      // El arquero titular queda fijo en el arco.
      preferencias = ['ARQ'];
    } else if (posiciones.includes('ARQ')) {
      // Si no es el arquero titular, debe usar otra posición de campo.
      preferencias = posiciones.filter(pos => pos !== 'ARQ');
      if (!preferencias.length) {
        preferencias = ['ARQ'];
      }
    }

    preferenciasPorJugador.set(jugador, preferencias);
    asignacion.set(jugador, preferencias[0] || 'MED');
  });

  const contarLineas = () => {
    const conteo = { ARQ: 0, DEF: 0, MED: 0, DEL: 0 };
    asignacion.forEach(pos => {
      if (conteo[pos] === undefined) {
        conteo.MED++;
        return;
      }
      conteo[pos]++;
    });
    return conteo;
  };

  // Reubica jugadores multi-posicion si una linea supera el maximo permitido.
  let huboCambios = true;
  while (huboCambios) {
    huboCambios = false;
    const conteoActual = contarLineas();
    const lineasExcedidas = lineasCampo
      .filter(linea => conteoActual[linea] > maxPorLinea)
      .sort((a, b) => conteoActual[b] - conteoActual[a]);

    if (!lineasExcedidas.length) break;

    for (const lineaOrigen of lineasExcedidas) {
      const candidatosMover = equipo
        .filter(jugador => asignacion.get(jugador) === lineaOrigen)
        .filter(jugador => (preferenciasPorJugador.get(jugador) || []).some(pos => pos !== lineaOrigen))
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
        const destinos = preferencias.filter(pos => pos !== lineaOrigen && lineasCampo.includes(pos) && conteo[pos] < maxPorLinea);
        if (!destinos.length) continue;

        destinos.sort((a, b) => {
          const faltaA = conteo[a] === 0 ? 1 : 0;
          const faltaB = conteo[b] === 0 ? 1 : 0;
          if (faltaA !== faltaB) return faltaB - faltaA;
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
  const lineaMaximaValida = lineasCampo.every(linea => conteoFinal[linea] <= maxPorLinea);

  return { asignacion, arquerosAsignados, conteoFinal, lineaMaximaValida };
}

function countAssignmentLines(assignment) {
  const counts = { ARQ: 0, DEF: 0, MED: 0, DEL: 0 };
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

  const maxPerLine = maxFieldPlayersPerLine(equipo.length);
  const goalkeeper = equipo.find(jugador => base.asignacion.get(jugador) === 'ARQ')
    || equipo.find(jugador => getPrimaryPlayerPosition(jugador) === 'ARQ' || isEmergencyGoalkeeper(jugador))
    || equipo.slice().sort((a, b) => (a.puntuacion - b.puntuacion) || String(a.nombre).localeCompare(String(b.nombre)))[0]
    || null;
  const fieldPlayers = equipo.filter(jugador => jugador !== goalkeeper);
  const formationOptions = getFormationOptions(equipo.length).filter(option => (
    option.DEF + option.MED + option.DEL === fieldPlayers.length
    && Math.max(option.DEF, option.MED, option.DEL) <= maxPerLine
  ));
  const options = formationOptions.length
    ? formationOptions
    : [{ DEF: 1, MED: Math.max(0, fieldPlayers.length - 2), DEL: 1, value: 'fallback' }];

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

    const linesByNeed = ['DEF', 'MED', 'DEL'].sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
    for (const line of linesByNeed) {
      for (let slot = 0; slot < (counts[line] || 0); slot++) {
        const candidates = Array.from(remaining).sort((a, b) => {
          const naturalA = getOrderedPlayerPositions(a).includes(line) ? 1 : 0;
          const naturalB = getOrderedPlayerPositions(b).includes(line) ? 1 : 0;
          if (naturalA !== naturalB) return naturalB - naturalA;
          const ratingDiff = adjustedPositionRating(b, line) - adjustedPositionRating(a, line);
          if (Math.abs(ratingDiff) > 0.0001) return ratingDiff;
          return String(a.nombre).localeCompare(String(b.nombre));
        });
        const chosen = candidates[0];
        if (!chosen) break;
        assignment.set(chosen, line);
        remaining.delete(chosen);
        score += adjustedPositionRating(chosen, line);
        if (!getOrderedPlayerPositions(chosen).includes(line)) {
          score -= 2;
        }
      }
    }

    remaining.forEach(jugador => {
      const fallback = ['DEF', 'MED', 'DEL']
        .filter(line => (countAssignmentLines(assignment)[line] || 0) < maxPerLine)
        .sort((a, b) => adjustedPositionRating(jugador, b) - adjustedPositionRating(jugador, a))[0] || 'MED';
      assignment.set(jugador, fallback);
      score += adjustedPositionRating(jugador, fallback);
    });

    const countsFinal = countAssignmentLines(assignment);
    const valid = countsFinal.ARQ === 1
      && REQUIRED_FIELD_LINES.every(line => countsFinal[line] >= 1 && countsFinal[line] <= maxPerLine);
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
    lineaMaximaValida: REQUIRED_FIELD_LINES.every(line => conteoFinal[line] <= maxPerLine),
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
    div.className = 'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-emerald-950 shadow-sm';
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
  const maxTeamSizeByFormation = 1 + (maxPerLine * REQUIRED_FIELD_LINES.length);
  if (teamSize > maxTeamSizeByFormation) {
    return `Cada equipo tendria ${teamSize} jugadores. La regla actual permite maximo 1 arquero y ${maxPerLine} por linea de campo (${maxTeamSizeByFormation} por equipo).`;
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
  const maxTeamSizeByFormation = 1 + (maxPerLine * REQUIRED_FIELD_LINES.length);
  if (teamSize > maxTeamSizeByFormation) {
    errorDiv.textContent = `Con ${teamSize} jugadores por equipo no se puede respetar la formacion: maximo 1 arquero y ${maxPerLine} por linea de campo (maximo ${maxTeamSizeByFormation} por equipo).`;
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
  const total = equipo.reduce((sum, j) => sum + Number(j.puntuacion || 0), 0);
  const lentos = equipo.filter(isLowRhythmPlayer).length;
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
  const lineas = assignment.conteoFinal || { ARQ: 0, DEF: 0, MED: 0, DEL: 0 };
  const fueraDePosicion = equipo.filter(jugador => {
    const assignedPosition = getPrimaryPosition(jugador, assignment.asignacion);
    return !getOrderedPlayerPositions(jugador).includes(assignedPosition);
  }).length;
  return {
    total,
    lentos,
    rapidos,
    balance,
    lineas,
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
    const ratingA = Number(a.puntuacion || 0);
    const ratingB = Number(b.puntuacion || 0);
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

function evaluarEquipos(equipos, teamSize, maxDiff, options = {}) {
  const stats = equipos.map(equipo => teamStats(equipo, options));
  const puntos = stats.map(s => s.total);
  const lentos = stats.map(s => s.lentos);
  const rapidos = stats.map(s => s.rapidos);
  const diffPuntos = Math.max(...puntos) - Math.min(...puntos);
  const diffLentos = Math.max(...lentos) - Math.min(...lentos);
  const diffRapidos = Math.max(...rapidos) - Math.min(...rapidos);

  const repeatPenalty = historicalRepeatPenalty(equipos);
  const balancePenalty = weightedBalancePenalty(stats);
  const outOfPositionPenalty = stats.reduce((sum, stat) => sum + (stat.fueraDePosicion || 0), 0) * 12;
  const flatPlayers = equipos.flat();
  const bandIds = options.bandIds || playerBandIds(flatPlayers);
  const lowBandSpread = countSpread(teamBandCounts(equipos, bandIds.low));
  const highBandSpread = countSpread(teamBandCounts(equipos, bandIds.high));
  const bandPenalty = (lowBandSpread * 120) + (highBandSpread * 90);
  let penalidad = balancePenalty + diffLentos * 25 + diffRapidos * 10 + repeatPenalty + outOfPositionPenalty + bandPenalty;
  let hardOk = true;

  const fieldPlayers = Math.max(0, teamSize - 1);
  const minFieldLine = fieldPlayers >= 3 ? 1 : 0;
  const maxFieldLine = maxFieldPlayersPerLine(teamSize);

  for (const stat of stats) {
    if (stat.arqueros !== 1) {
      penalidad += Math.abs(stat.arqueros - 1) * 100000;
      hardOk = false;
    }
    for (const linea of REQUIRED_FIELD_LINES) {
      const cantidad = stat.lineas[linea] || 0;
      if (cantidad < minFieldLine) penalidad += (minFieldLine - cantidad) * 25000;
      if (cantidad > maxFieldLine) penalidad += (cantidad - maxFieldLine) * 25000;
    }
  }

  const perfecto = hardOk
    && diffPuntos <= maxDiff
    && diffLentos <= 1
    && lowBandSpread <= 1
    && highBandSpread <= 1
    && equipos.every(equipo => equipo.length === teamSize)
    && stats.every(stat => REQUIRED_FIELD_LINES.every(linea => (stat.lineas[linea] || 0) >= minFieldLine && (stat.lineas[linea] || 0) <= maxFieldLine));

  return { penalidad, perfecto, diffPuntos, diffLentos, diffRapidos, lowBandSpread, highBandSpread, repeatPenalty, balancePenalty, outOfPositionPenalty, bandPenalty, stats };
}

function construirCandidato(players, numEquipos, teamSize, semilla, options = {}) {
  const arqueros = players.filter(p => getPrimaryPlayerPosition(p) === 'ARQ' || isEmergencyGoalkeeper(p)).sort(() => Math.random() - 0.5);
  const arquerosPuros = arqueros.filter(isPureGoalkeeper);
  const arquerosMixtos = arqueros.filter(p => !isPureGoalkeeper(p));
  const arquerosTitulares = [...arquerosPuros, ...arquerosMixtos]
    .sort((a, b) => {
      if (semilla % 3 === 0) return b.puntuacion - a.puntuacion;
      if (semilla % 3 === 1) return a.puntuacion - b.puntuacion;
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
      if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
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

  while (cambio) {
    cambio = false;
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
    const avoidPenalty = options.avoidSignatures?.has(drawSignature(equipos)) ? 100000000 : 0;
    const adjustedEvaluation = { ...evaluacion, penalidad: evaluacion.penalidad + avoidPenalty };
    if (!mejorEval || adjustedEvaluation.penalidad < mejorEval.penalidad) {
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
    const avoidPenalty = scopedOptions.avoidSignatures?.has(drawSignature(mejorado.equipos)) ? 100000000 : 0;
    const adjustedEvaluation = { ...mejorado.evaluacion, penalidad: mejorado.evaluacion.penalidad + avoidPenalty };
    if (!mejorEval || adjustedEvaluation.penalidad < mejorEval.penalidad) {
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
    const counts = { DEF: 0, MED: 0, DEL: 0 };
    equipo.forEach(jugador => {
      const assigned = assignments[playerKey(jugador)] || '';
      if (['ARQ', 'DEF', 'MED', 'DEL'].includes(assigned)) {
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
      return { ok: false, reason: `${nombreEquipo} supera el limite de ${maxFieldPlayersPerLine(teamSize)} jugadores en una linea de campo.` };
    }
    const posiciones = new Set(asignacion.values());
    const posicionesRequeridas = ['ARQ', 'DEF', 'MED', 'DEL'];
    if (!posicionesRequeridas.every(p => posiciones.has(p))) {
      const faltantes = posicionesRequeridas.filter(p => !posiciones.has(p)).join(', ');
      return { ok: false, reason: `${nombreEquipo} no cubre todas las lineas requeridas. Falta: ${faltantes}.` };
    }

    const puntuacion = equipo.reduce((sum, j) => sum + Number(j.puntuacion || 0), 0);
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
  const candidates = [];
  for (let def = 0; def <= fieldPlayers; def++) {
    for (let med = 0; med <= fieldPlayers - def; med++) {
      const del = fieldPlayers - def - med;
      if (fieldPlayers >= 3 && (def < 1 || med < 1 || del < 1)) continue;
      if (Math.max(def, med, del) > maxPerLine) continue;
      const values = [def, med, del];
      const balance = Math.max(...values) - Math.min(...values);
      candidates.push({ DEF: def, MED: med, DEL: del, value: `${def}-${med}-${del}`, balance });
    }
  }

  const preferred = [];
  const addBest = (sorter) => {
    const option = candidates.slice().sort(sorter).find(item => !preferred.some(p => p.value === item.value));
    if (option) preferred.push(option);
  };

  addBest((a, b) => a.balance - b.balance || b.MED - a.MED || b.DEF - a.DEF);
  addBest((a, b) => b.DEF - a.DEF || a.balance - b.balance);
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
    return {
      DEF: Math.min(maxPerLine, Math.max(0, parseInt(custom.DEF || 0, 10))),
      MED: Math.min(maxPerLine, Math.max(0, parseInt(custom.MED || 0, 10))),
      DEL: Math.min(maxPerLine, Math.max(0, parseInt(custom.DEL || 0, 10)))
    };
  }
  const parts = selectedFormation.split('-').map(value => parseInt(value, 10));
  return { DEF: parts[0] || 0, MED: parts[1] || 0, DEL: parts[2] || 0 };
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
  const first = getFormationOptions(teamSize)[0] || { DEF: 0, MED: 0, DEL: Math.max(0, teamSize - 1) };
  return { DEF: first.DEF, MED: first.MED, DEL: first.DEL };
}

function fieldLineMinimum(teamSize) {
  return Math.max(0, Number(teamSize || 0) - 1) >= 3 ? 1 : 0;
}

function currentFormationLineCounts(teamIndex) {
  const team = lastEquipos && lastEquipos[teamIndex] ? lastEquipos[teamIndex] : [];
  const assignment = buildFormationAssignment(team, teamIndex);
  const counts = { DEF: 0, MED: 0, DEL: 0 };
  team.forEach(jugador => {
    const position = getPrimaryPosition(jugador, assignment);
    if (counts[position] !== undefined) counts[position]++;
  });
  return counts;
}

function normalizeCustomFormationCounts(teamSize, currentCounts, changedLine, requestedValue) {
  const total = Math.max(0, Number(teamSize || 0) - 1);
  const min = fieldLineMinimum(teamSize);
  const max = maxFieldPlayersPerLine(teamSize);
  const lines = ['DEF', 'MED', 'DEL'];
  const counts = {};
  lines.forEach(line => {
    counts[line] = Math.min(max, Math.max(min, parseInt(currentCounts?.[line] || 0, 10)));
  });

  if (lines.includes(changedLine)) {
    counts[changedLine] = Math.min(max, Math.max(min, parseInt(requestedValue || 0, 10)));
  }

  let diff = total - lines.reduce((sum, line) => sum + counts[line], 0);
  while (diff !== 0) {
    const candidates = lines
      .filter(line => line !== changedLine)
      .filter(line => diff > 0 ? counts[line] < max : counts[line] > min)
      .sort((a, b) => diff > 0 ? counts[a] - counts[b] : counts[b] - counts[a]);
    const line = candidates[0] || lines.find(item => diff > 0 ? counts[item] < max : counts[item] > min);
    if (!line) break;
    counts[line] += diff > 0 ? 1 : -1;
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

  ['DEF', 'MED', 'DEL'].forEach(line => {
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

  ['DEF', 'MED', 'DEL'].forEach(line => {
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
  if (!['ARQ', 'DEF', 'MED', 'DEL'].includes(position)) return;

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
  const remaining = { DEF: counts.DEF, MED: counts.MED, DEL: counts.DEL };
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
    if (['DEF', 'MED', 'DEL'].includes(manual)) {
      assignment.set(jugador, manual);
      assigned.add(jugador);
      if (remaining[manual] !== undefined && remaining[manual] > 0) {
        remaining[manual]--;
      }
    }
  }

  for (const line of ['DEF', 'MED', 'DEL']) {
    while (remaining[line] > 0) {
      const candidates = equipo
        .filter(jugador => !assigned.has(jugador))
        .sort((a, b) => {
          const prefA = getOrderedPlayerPositions(a).includes(line) ? 0 : 1;
          const prefB = getOrderedPlayerPositions(b).includes(line) ? 0 : 1;
          if (prefA !== prefB) return prefA - prefB;
          if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
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
    const lineCounts = { DEF: 0, MED: 0, DEL: 0 };
    assignment.forEach(pos => {
      if (lineCounts[pos] !== undefined) lineCounts[pos]++;
    });
    const fallback = ['DEF', 'MED', 'DEL'].sort((a, b) => lineCounts[a] - lineCounts[b])[0];
    assignment.set(jugador, fallback);
    assigned.add(jugador);
  }

  return assignment;
}

function mostrarEquipos(equipos) {
  const container = document.getElementById('equipos-generados');
  container.innerHTML = '';
  const matchupTitle = document.createElement('div');
  matchupTitle.className = 'mx-auto w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-center text-xl font-black text-emerald-950 shadow-sm';
  matchupTitle.dataset.sorteoMatchupTitle = '1';
  matchupTitle.textContent = getMatchupDisplayName(equipos.length);
  container.appendChild(matchupTitle);
  
  equipos.forEach((equipo, index) => {
    const equipoDiv = document.createElement('div');
    equipoDiv.className = 'grid gap-3 rounded-2xl border border-emerald-200 bg-white p-3 text-emerald-950 shadow-lg shadow-emerald-950/10';
    equipoDiv.dataset.teamIndex = String(index);
    equipoDiv.dataset.sorteoTeamCard = '1';
    const teamColor = getTeamColor(index);
    let headerText = getTeamDisplayName(index);
    if (teamColor) {
      equipoDiv.dataset.teamColor = teamColor.class;
    }
    
    const jugadoresOrdenados = equipo.slice().sort((a, b) => {
      const orderA = getPlayerOrder(a);
      const orderB = getPlayerOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      return a.nombre.localeCompare(b.nombre);
    });
    
    const resumenStats = teamTotalsSummary(jugadoresOrdenados);
    const asignacionPosiciones = buildFormationAssignment(jugadoresOrdenados, index);
    const totalPuntos = jugadoresOrdenados.reduce((sum, jugador) => {
      const assignedPosition = getPrimaryPosition(jugador, asignacionPosiciones);
      return sum + adjustedPositionRating(jugador, assignedPosition);
    }, 0);
    const maxCustomLine = maxFieldPlayersPerLine(jugadoresOrdenados.length);

    const ordenCancha = ['ARQ', 'DEF', 'MED', 'DEL'];
    const etiquetasPosicion = {
      ARQ: 'ARQ',
      DEF: 'DEF',
      MED: 'MED',
      DEL: 'DEL'
    };
    const jugadoresPorLinea = { ARQ: [], DEF: [], MED: [], DEL: [] };

    jugadoresOrdenados.forEach(jugador => {
      const posicionPrincipal = getPrimaryPosition(jugador, asignacionPosiciones);
      if (!jugadoresPorLinea[posicionPrincipal]) {
        jugadoresPorLinea.MED.push(jugador);
        return;
      }
      jugadoresPorLinea[posicionPrincipal].push(jugador);
    });

    ordenCancha.forEach(pos => {
      jugadoresPorLinea[pos].sort((a, b) => {
        if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
        return a.nombre.localeCompare(b.nombre);
      });
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
        ${ordenCancha.map(pos => `
          <div class="formation-line captain-formation-line ${pos === 'ARQ' ? '' : 'has-line-tools'}">
            ${pos === 'ARQ' ? `
              <div class="line-label captain-line-label"><span><strong>${etiquetasPosicion[pos]}</strong><small>${jugadoresPorLinea[pos].length}/1</small></span></div>
            ` : `
              <div class="line-label captain-line-label has-line-controls">
                <span><strong>${etiquetasPosicion[pos]}</strong><small>${jugadoresPorLinea[pos].length}/${maxCustomLine}</small></span>
                <button class="captain-line-control is-minus" type="button" data-sorteo-action="team-line-delta" data-team-index="${index}" data-line="${pos}" data-delta="-1" aria-label="Quitar jugador de ${pos}">-</button>
              </div>
              <button class="captain-line-control is-plus" type="button" data-sorteo-action="team-line-delta" data-team-index="${index}" data-line="${pos}" data-delta="1" aria-label="Agregar jugador a ${pos}">+</button>
            `}
            <div class="line-players" data-sorteo-drop-line="${pos}" data-team-index="${index}">
              ${jugadoresPorLinea[pos].map(j => {
                const adjustedRating = adjustedPositionRating(j, pos);
                const generalRating = Number(j.puntuacion || 0);
                const outOfPosition = !getOrderedPlayerPositions(j).includes(pos);
                const penaltyPercent = positionPenaltyPercent(j, pos);
                const cardTitle = `General ${formatRating(generalRating)} ⭐ | Ajustada ${pos} ${formatRating(adjustedRating)} ⭐`;
                return `
                <div class="formation-player captain-formation-player ${outOfPosition ? 'is-out-of-position' : ''}" draggable="true" data-sorteo-drag-player="1" data-team-index="${index}" data-player-key="${playerKey(j)}" data-assigned-position="${pos}" title="${escapeHtml(cardTitle)}">
                  ${playerCardRatingHtml(adjustedRating, pos)}
                  <strong>${escapeHtml(j.nombre)} ${isLowRhythmPlayer(j) ? '&#128034;' : ''}</strong>
                  ${playerPositionPillsHtml(j)}
                  <span class="formation-player-meta">${formatRating(generalRating)}${penaltyPercent > 0 ? ` <em class="formation-penalty-badge">-${penaltyPercent}%</em>` : ''}</span>
                </div>
              `}).join('')}
            </div>
          </div>
        `).join('')}
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
  html2canvas(equiposContainer, {
    backgroundColor: null,
    scale: 2
  }).then(canvas => {
    const link = document.createElement('a');
    link.download = 'equipos_goodfellas.jpg';
    link.href = canvas.toDataURL('image/jpeg', 1.0);
    link.click();
  }).catch(err => {
    console.error('Error al generar la imagen:', err);
    alert('Hubo un error al generar la imagen');
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
    equipo.forEach(j => {
      texto += `${j.nombre} ${isLowRhythmPlayer(j) ? '🐢' : ''} - ${j.posicion} - ${j.puntuacion} pts\n`;
    });
    const totalPuntos = equipo.reduce((sum, j) => sum + j.puntuacion, 0);
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
  return window.matchMedia('(min-width: 761px)').matches;
}

function clearSorteoFormationDragHighlights(root = document) {
  root.querySelectorAll('.is-team-drag-over, .is-drag-over')
    .forEach(el => el.classList.remove('is-team-drag-over', 'is-drag-over'));
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
  const sourceRect = card.getBoundingClientRect();
  const offsetX = event.clientX - sourceRect.left;
  const offsetY = event.clientY - sourceRect.top;
  let hasMoved = false;
  let ghost = null;

  formationPointerDragState = {
    teamIndex: Number(card.dataset.teamIndex),
    playerKey: card.dataset.playerKey || ''
  };
  formationPointerDragTarget = null;
  card.classList.add('is-dragging');

  const moveGhost = (moveEvent) => {
    if (!ghost) return;
    ghost.style.left = `${moveEvent.clientX - offsetX}px`;
    ghost.style.top = `${moveEvent.clientY - offsetY}px`;
  };

  const onPointerMove = (moveEvent) => {
    const distance = Math.hypot(moveEvent.clientX - event.clientX, moveEvent.clientY - event.clientY);
    if (!hasMoved && distance < 4) return;
    if (!hasMoved) {
      hasMoved = true;
      ghost = card.cloneNode(true);
      ghost.classList.add('is-pointer-drag-ghost');
      ghost.style.width = `${sourceRect.width}px`;
      ghost.style.height = `${sourceRect.height}px`;
      document.body.appendChild(ghost);
    }
    moveEvent.preventDefault();
    moveGhost(moveEvent);
    markSorteoFormationDragTarget(formationDropTargetFromPoint(moveEvent.clientX, moveEvent.clientY, ghost), root);
  };

  const onPointerUp = (upEvent) => {
    window.removeEventListener('pointermove', onPointerMove, true);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);

    const target = hasMoved
      ? formationDropTargetFromPoint(upEvent.clientX, upEvent.clientY, ghost) || formationPointerDragTarget
      : null;
    if (target) handleSorteoFormationDrop(formationPointerDragState, target);

    card.classList.remove('is-dragging');
    ghost?.remove();
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
    if (!control || !root.contains(control)) return;
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
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify({
      teamIndex: Number(playerCard.dataset.teamIndex),
      playerKey: playerCard.dataset.playerKey || ''
    }));
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
}
// Lista inicial de jugadores según lo solicitado
if (MATCH_ID > 0) {
  jugadores = PRELOADED_JUGADORES.map(j => ({
    id: j.id,
    nombre: j.nombre,
    posicion: normalizarPosiciones(j.posicion),
    ritmo: normalizarRitmo(j.ritmo),
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
