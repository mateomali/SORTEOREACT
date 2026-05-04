<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

require_admin();

if (!function_exists('repo_match_participants_basic')) {
    function repo_match_participants_basic(int $matchId): array
    {
        $stmt = db()->prepare(
            'SELECT p.id, p.name, p.positions, p.pace, p.skill
             FROM match_players mp
             INNER JOIN players p ON p.id = mp.player_id
             WHERE mp.match_id = :mid
             ORDER BY p.name ASC'
        );
        $stmt->execute(['mid' => $matchId]);
        return $stmt->fetchAll();
    }
}

$legacyMatchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$legacyLoadError = '';
$legacyMatch = null;
$legacyPlayers = [];
$legacyPairHistory = [];

try {
    $legacyMatch = $legacyMatchId > 0 ? repo_match_by_id($legacyMatchId) : null;
    if ($legacyMatch) {
        $participants = repo_match_participants_basic($legacyMatchId);
        $participantIds = [];
        foreach ($participants as $p) {
            $participantIds[] = (int) $p['id'];
            $legacyPlayers[] = [
                'id' => (int) $p['id'],
                'nombre' => (string) $p['name'],
                'posicion' => (string) $p['positions'],
                'ritmo' => ((string) $p['pace'] === 'lento') ? 'lento' : 'rápido',
                'puntuacion' => (float) $p['skill'],
                'selected' => true,
            ];
        }
        if ($participantIds) {
            $in = implode(',', array_fill(0, count($participantIds), '?'));
            $historyStmt = db()->prepare(
                "SELECT mp.match_id, mp.team_number, mp.player_id
                 FROM match_players mp
                 INNER JOIN matches m ON m.id = mp.match_id
                 WHERE mp.player_id IN ($in)
                   AND mp.team_number IS NOT NULL
                   AND mp.match_id <> ?
                   AND m.status IN ('sorteado', 'finalizado')
                 ORDER BY m.match_date DESC, mp.match_id DESC"
            );
            $historyStmt->execute(array_merge($participantIds, [$legacyMatchId]));
            $groupedHistory = [];
            foreach ($historyStmt->fetchAll() as $row) {
                $key = (int) $row['match_id'] . ':' . (int) $row['team_number'];
                $groupedHistory[$key][] = (int) $row['player_id'];
            }
            foreach ($groupedHistory as $ids) {
                $ids = array_values(array_unique($ids));
                sort($ids);
                $count = count($ids);
                for ($i = 0; $i < $count; $i++) {
                    for ($j = $i + 1; $j < $count; $j++) {
                        $pairKey = $ids[$i] . '-' . $ids[$j];
                        $legacyPairHistory[$pairKey] = ($legacyPairHistory[$pairKey] ?? 0) + 1;
                    }
                }
            }
        }
    }
} catch (Throwable $e) {
    $legacyLoadError = 'No se pudieron cargar datos del partido: ' . $e->getMessage();
}

$legacyPlayersJson = json_encode($legacyPlayers, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$legacyPairHistoryJson = json_encode($legacyPairHistory, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$legacyNumTeams = $legacyMatch ? (int) $legacyMatch['num_teams'] : 2;
$legacyMaxDiff = 0.5;
$tailwindVersion = (string) (@filemtime(__DIR__ . '/assets/tailwind.css') ?: time());
?>
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Generador de Equipos GOODFELLAS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="assets/tailwind.css?v=<?= h($tailwindVersion) ?>">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
</head>
<body class="sorteo-page">
  <div class="container">
    <div class="sorteo-backbar">
      <button type="button" onclick="window.location.href='editar_partidos.php'">Volver a partidos</button>
    </div>
    <h1><span class="soccer-ball"></span> Generador de Equipos GOODFELLAS <span class="soccer-ball"></span></h1>
    <?php if ($legacyMatch): ?>
      <div class="success mb-3">
        Partido: <strong><?= h((string) ($legacyMatch['title'] ?: ('Partido #' . $legacyMatch['id']))) ?></strong>
        | Fecha: <?= h(date('d/m/Y H:i', strtotime((string) $legacyMatch['match_date']))) ?>
      </div>
    <?php endif; ?>
    <?php if ($legacyLoadError !== ''): ?>
      <div class="error mb-3"><?= h($legacyLoadError) ?></div>
    <?php endif; ?>
    <div class="controls">
      <?php if ($legacyMatch): ?>
        <button type="button" onclick="window.location.href='finalizar_partido.php?match_id=<?= (int) $legacyMatch['id'] ?>'">Finalizar partido</button>
      <?php else: ?>
        <button onclick="abrirModalAgregar()"><span class="text-lg">+</span> Añadir Jugador</button>
      <?php endif; ?>
    </div>
    <div class="accordion">
      <div class="accordion-header" onclick="toggleAccordion(this)">
        <h3>👥 Jugadores Disponibles</h3>
      </div>
      <div class="accordion-content">
        <div class="players-list">
          <?php if (!$legacyMatch): ?>
            <div class="data-controls">
              <button onclick="exportarJugadoresCSV()">💾 Guardar lista de jugadores</button>
              <label class="file-label">
                📥 Importar lista de jugadores
                <input type="file" class="file-input" id="csvInput" accept=".csv" onchange="importarJugadoresCSV(event)">
              </label>
            </div>
          <?php endif; ?>
          <div class="sort-controls">
            <div class="sort-dropdown" id="sortDropdown">
              <button class="sort-dropdown-btn" onclick="event.stopPropagation(); toggleSortDropdown()">
                <span>🔽 Ordenar por: Nombre</span>
                <span>▼</span>
              </button>
              <div class="sort-dropdown-content">
                <a href="#" onclick="selectSortOption('nombre')">Nombre</a>
                <a href="#" onclick="selectSortOption('puntuacion')">Puntuación</a>
                <a href="#" onclick="selectSortOption('ritmo')">Ritmo</a>
              </div>
            </div>
          </div>
          <?php if (!$legacyMatch): ?>
            <div class="select-all">
              <label>
                <input type="checkbox" id="select-all" onchange="toggleSelectAll(this)" checked> 
                Seleccionar todos
              </label>
            </div>
          <?php endif; ?>
          <div id="jugadores-container"></div>
        </div>
      </div>
    </div>
    <div class="controls main-controls">
      <span id="teamDisplay" class="hidden"><?= h((string) $legacyNumTeams) ?></span>
      <span id="diffDisplay" class="hidden">0.5</span>
      <button onclick="generarEquipos()">⚽ Generar Equipos</button>
    </div>
    <div id="error" class="error"></div>
    <div id="success" class="success"></div>
    <div id="equipos-generados" class="teams-container"></div>
    <div class="controls mt-5 hidden" id="download-controls">
      <div class="download-action-row">
        <button onclick="copiarEquiposClipboard()">📋 Copiar al Portapapeles</button>
        <button onclick="descargarEquiposJPG()">📸 Descargar como JPG</button>
        <button onclick="descargarEquiposTexto()">📝 Descargar como Texto</button>
      </div>
      <?php if ($legacyMatch): ?>
        <div class="download-save-row">
          <button onclick="guardarSorteoEnBD()">💾 GUARDAR SORTEO</button>
        </div>
      <?php endif; ?>
    </div>
    <div class="team-color-config">
      <h3>Configuración de Camisetas</h3>
      <div id="team-color-settings"></div>
    </div>
  </div>

  <div id="addModal" class="modal hidden">
    <div class="modal-content">
      <button class="close-modal" onclick="cerrarModal('addModal')">×</button>
      <h3>Añadir Jugador</h3>
      <div class="form-row">
        <label>Nombre:</label>
        <input type="text" id="addNombre" required>
      </div>
      <div class="form-row">
        <label>Posiciones:</label>
        <div class="position-checkboxes">
          <label><input type="checkbox" class="addPosicion" value="ARQ"> 🥅 ARQ</label>
          <label><input type="checkbox" class="addPosicion" value="DEF"> 🛡️ DEF</label>
          <label><input type="checkbox" class="addPosicion" value="MED"> 🎯 MED</label>
          <label><input type="checkbox" class="addPosicion" value="DEL"> ⚽ DEL</label>
        </div>
      </div>
      <div class="form-row">
        <label>Ritmo:</label>
        <select id="addEdad">
          <option value="rápido">Rápido</option>
          <option value="lento">Lento</option>
        </select>
      </div>
      <div class="form-row">
        <label>Puntuación:</label>
        <div class="score-control" id="addScoreControl">
          <button type="button" onclick="decrementScore('add')">−</button>
          <span id="addScoreDisplay">1.0</span>
          <button type="button" onclick="incrementScore('add')">+</button>
        </div>
      </div>
      <div class="controls">
        <button onclick="guardarJugador()">💾 Guardar</button>
        <button class="btn-muted" onclick="cerrarModal('addModal')">❌ Cancelar</button>
      </div>
    </div>
  </div>

  <div id="editModal" class="modal hidden">
    <div class="modal-content">
      <button class="close-modal" onclick="cerrarModal('editModal')">×</button>
      <h3>Editar Jugador</h3>
      <div class="form-row">
        <label>Nombre:</label>
        <input type="text" id="editNombre" required>
      </div>
      <div class="form-row">
        <label>Posiciones:</label>
        <div class="position-checkboxes">
          <label><input type="checkbox" class="editPosicion" value="ARQ"> 🥅 ARQ</label>
          <label><input type="checkbox" class="editPosicion" value="DEF"> 🛡️ DEF</label>
          <label><input type="checkbox" class="editPosicion" value="MED"> 🎯 MED</label>
          <label><input type="checkbox" class="editPosicion" value="DEL"> ⚽ DEL</label>
        </div>
      </div>
      <div class="form-row">
        <label>Ritmo:</label>
        <select id="editEdad">
          <option value="rápido">Rápido</option>
          <option value="lento">Lento</option>
        </select>
      </div>
      <div class="form-row">
        <label>Puntuación:</label>
        <div class="score-control" id="editScoreControl">
          <button type="button" onclick="decrementScore('edit')">−</button>
          <span id="editScoreDisplay">1.0</span>
          <button type="button" onclick="incrementScore('edit')">+</button>
        </div>
      </div>
      <div class="controls">
        <button onclick="guardarEdicion()">💾 Guardar</button>
        <button class="btn-muted" onclick="cerrarModal('editModal')">❌ Cancelar</button>
      </div>
    </div>
  </div>

  <script>
    let jugadores = [];
    let editIndex = -1;
    let currentSort = 'nombre';
    let sortDirection = 1;
    var lastEquipos = null;
    const teamFormations = {};
    const customFormations = {};
    const manualAssignments = {};
    const MATCH_ID = <?= (int) $legacyMatchId ?>;
    const PRELOADED_JUGADORES = <?= $legacyPlayersJson ?: '[]' ?>;
    const HISTORICAL_TEAMMATE_PAIRS = <?= $legacyPairHistoryJson ?: '{}' ?>;
    const LOCKED_MATCH_MODE = MATCH_ID > 0;
    const MAX_FIELD_PLAYERS_PER_LINE = 5;
    const REQUIRED_FIELD_LINES = ['DEF', 'MED', 'DEL'];

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
    var teamColorMapping = [
      { name: "ROSA", class: "team-rosa" },
      { name: "AZUL", class: "team-azul" },
      { name: "NARANJA", class: "team-naranja" },
      { name: "NEGRO", class: "team-negro" },
      { name: "VERDE", class: "team-verde" }
    ];

    function setTeamColor(equipoIndex, colorName, className) {
      teamColorMapping[equipoIndex] = { name: colorName, class: className };
    }
    function getTeamColor(equipoIndex) {
      return teamColorMapping[equipoIndex];
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
      dropdown.classList.toggle('active');
    }

    function selectSortOption(criteria) {
      const dropdown = document.getElementById('sortDropdown');
      dropdown.classList.remove('active');
      sortPlayers(criteria);
    }

    function actualizarTeamColorSettings() {
      const numEquipos = parseInt(document.getElementById('teamDisplay').textContent);
      const container = document.getElementById('team-color-settings');
      container.innerHTML = '';
      const opciones = [
        { name: 'ROSA', class: 'team-rosa' },
        { name: 'AZUL', class: 'team-azul' },
        { name: 'NARANJA', class: 'team-naranja' },
        { name: 'NEGRO', class: 'team-negro' },
        { name: 'VERDE', class: 'team-verde' }
      ];
      
      for (let i = 0; i < numEquipos; i++) {
        const teamColor = getTeamColor(i) || opciones[i % opciones.length];
        const select = document.createElement('select');
        select.setAttribute('data-team-index', i);
        
        opciones.forEach(opt => {
          const optionElem = document.createElement('option');
          optionElem.value = opt.class;
          optionElem.text = opt.name;
          if (teamColor.name === opt.name) {
            optionElem.selected = true;
          }
          select.appendChild(optionElem);
        });
        
        select.addEventListener('change', function(e) {
          const teamIndex = parseInt(e.target.getAttribute('data-team-index'));
          const selectedClass = e.target.value;
          let selectedName = '';
          
          opciones.forEach(opt => {
            if (opt.class === selectedClass) {
              selectedName = opt.name;
            }
          });
          
          setTeamColor(teamIndex, selectedName, selectedClass);
          if (lastEquipos) {
            mostrarEquipos(lastEquipos);
          }
        });
        
        const label = document.createElement('label');
        label.textContent = `Equipo ${i + 1}: `;
        label.appendChild(select);
        container.appendChild(label);
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
        if (criteria === 'ritmo') return (a.ritmo === b.ritmo ? 0 : a.ritmo === 'lento' ? 1 : -1) * sortDirection;
        return 0;
      });
      actualizarListaJugadores();
    }

    function exportarJugadoresCSV() {
      if (LOCKED_MATCH_MODE) {
        alert('En modo partido los jugadores se administran desde la base de datos.');
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
        alert('En modo partido los jugadores se administran desde la base de datos.');
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

    const posicionEmojis = { ARQ: '🥅', DEF: '🛡️', MED: '🎯', DEL: '⚽' };

    function convertirPuntuacionAEstrellas(puntuacion) {
      const estrellasLlenas = Math.floor(puntuacion);
      const tieneMedia = (puntuacion % 1) >= 0.5;
      return '<span class="stars">' + '★'.repeat(estrellasLlenas) + (tieneMedia ? '½' : '') + '</span>';
    }

    function obtenerEmojisDePosiciones(posiciones) {
      return posiciones.split('/').map(pos => posicionEmojis[pos] || '').join('');
    }

    function getPlayerOrder(player) {
      const orderMapping = { ARQ: 1, DEF: 2, MED: 3, DEL: 4 };
      const posArray = player.posicion.split('/');
      const orders = posArray.map(pos => orderMapping[pos] || 99);
      return Math.min(...orders);
    }

    function getOrderedPlayerPositions(player) {
      const ordenCancha = ['ARQ', 'DEF', 'MED', 'DEL'];
      const posiciones = player.posicion.split('/').map(p => p.trim()).filter(Boolean);
      const posicionesOrdenadas = ordenCancha.filter(pos => posiciones.includes(pos));
      return posicionesOrdenadas.length ? posicionesOrdenadas : ['MED'];
    }

    function isPureGoalkeeper(player) {
      const posiciones = getOrderedPlayerPositions(player);
      return posiciones.length === 1 && posiciones[0] === 'ARQ';
    }

    function buildTeamPositionAssignment(equipo) {
      const lineasCancha = ['ARQ', 'DEF', 'MED', 'DEL'];
      const maxPorLinea = MAX_FIELD_PLAYERS_PER_LINE;
      const candidatosArq = equipo
        .filter(jugador => getOrderedPlayerPositions(jugador).includes('ARQ'))
        .sort((a, b) => {
          const pureA = isPureGoalkeeper(a) ? 0 : 1;
          const pureB = isPureGoalkeeper(b) ? 0 : 1;
          if (pureA !== pureB) return pureA - pureB;
          if (b.puntuacion !== a.puntuacion) return b.puntuacion - a.puntuacion;
          return a.nombre.localeCompare(b.nombre);
        });

      const arqueroTitular = candidatosArq[0] || null;
      const asignacion = new Map();
      const preferenciasPorJugador = new Map();

      equipo.forEach(jugador => {
        const posiciones = getOrderedPlayerPositions(jugador);
        let preferencias = posiciones.slice();

        if (jugador === arqueroTitular && posiciones.includes('ARQ')) {
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
        const lineasExcedidas = lineasCancha
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
            const destinos = preferencias.filter(pos => pos !== lineaOrigen && conteo[pos] < maxPorLinea);
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
      const lineaMaximaValida = lineasCancha.every(linea => conteoFinal[linea] <= maxPorLinea);

      return { asignacion, arquerosAsignados, conteoFinal, lineaMaximaValida };
    }

    function getPrimaryPosition(player, asignacionEquipo = null) {
      if (asignacionEquipo && asignacionEquipo.has(player)) {
        return asignacionEquipo.get(player);
      }
      return getOrderedPlayerPositions(player)[0];
    }

    function actualizarListaJugadores() {
      const container = document.getElementById('jugadores-container');
      container.innerHTML = '';
      jugadores.forEach((jugador, index) => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
          <input type="checkbox" id="jugador-${index}" ${jugador.selected ? 'checked' : ''} ${LOCKED_MATCH_MODE ? 'disabled' : ''} onchange="jugadores[${index}].selected = this.checked">
          <div class="player-info">
            <span class="player-name">${jugador.nombre} ${jugador.ritmo === 'lento' ? '🐢' : ''}</span>
            <span class="player-details">
              <span class="position-emoji">${obtenerEmojisDePosiciones(jugador.posicion)}</span> - ${convertirPuntuacionAEstrellas(jugador.puntuacion)}
            </span>
          </div>
          <div class="action-buttons">
            <button onclick="editarJugador(${index})" class="btn-edit">✏️</button>
            <button onclick="eliminarJugador(${index})" class="btn-delete">🗑️</button>
          </div>
        `;
        container.appendChild(div);
      });
    }

    function abrirModalAgregar() {
      if (LOCKED_MATCH_MODE) {
        alert('En modo partido no se pueden agregar jugadores desde esta pantalla.');
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
        alert('En modo partido no se pueden agregar jugadores desde esta pantalla.');
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
        alert('En modo partido no se pueden eliminar jugadores desde esta pantalla.');
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
      const maxTeamSizeByFormation = 1 + (MAX_FIELD_PLAYERS_PER_LINE * REQUIRED_FIELD_LINES.length);
      if (teamSize > maxTeamSizeByFormation) {
        return `Cada equipo tendria ${teamSize} jugadores. La regla actual permite maximo 1 arquero y ${MAX_FIELD_PLAYERS_PER_LINE} por linea de campo (${maxTeamSizeByFormation} por equipo).`;
      }
      const arqueros = players.filter(p => p.posicion.includes('ARQ'));
      if (arqueros.length < numEquipos) {
        return `Hay ${arqueros.length} jugadores que pueden atajar y se necesitan ${numEquipos}, uno por equipo.`;
      }
      const arquerosPuros = arqueros.filter(isPureGoalkeeper);
      if (arquerosPuros.length > numEquipos) {
        return `Hay ${arquerosPuros.length} arqueros puros para ${numEquipos} equipos. Como el arquero es una sola plaza, sobra al menos un arquero puro.`;
      }
      const missingLines = REQUIRED_FIELD_LINES.filter(linea => players.filter(p => getOrderedPlayerPositions(p).includes(linea)).length < numEquipos);
      if (missingLines.length) {
        return `Faltan jugadores para cubrir todas las lineas en cada equipo. Lineas con menos de ${numEquipos} opciones: ${missingLines.join(', ')}.`;
      }
      return `No se encontro una combinacion que cumpla todas las reglas: diferencia maxima ${maxDiff.toFixed(1)}, 1 arquero por equipo, ritmo equilibrado, al menos DEF/MED/DEL y maximo ${MAX_FIELD_PLAYERS_PER_LINE} por linea.`;
    }

    function generarEquipos() {
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      errorDiv.textContent = '';
      errorDiv.classList.add('hidden');
      successDiv.classList.add('hidden');
      
      const numEquipos = parseInt(document.getElementById('teamDisplay').textContent);
      const maxDiff = parseFloat(document.getElementById('diffDisplay').textContent);
      const selectedPlayers = LOCKED_MATCH_MODE ? jugadores.slice() : jugadores.filter(j => j.selected);
      
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
      const maxTeamSizeByFormation = 1 + (MAX_FIELD_PLAYERS_PER_LINE * REQUIRED_FIELD_LINES.length);
      if (teamSize > maxTeamSizeByFormation) {
        errorDiv.textContent = `Con ${teamSize} jugadores por equipo no se puede respetar la formacion: maximo 1 arquero y ${MAX_FIELD_PLAYERS_PER_LINE} por linea de campo (maximo ${maxTeamSizeByFormation} por equipo).`;
        errorDiv.classList.remove('hidden');
        return;
      }
      
      const arqueros = selectedPlayers.filter(p => p.posicion.includes('ARQ'));
      if (arqueros.length < numEquipos) {
        errorDiv.textContent = `Se necesitan mínimo ${numEquipos} arqueros`;
        errorDiv.classList.remove('hidden');
        return;
      }
      
      const arquerosPuros = arqueros.filter(isPureGoalkeeper);
      if (arquerosPuros.length > numEquipos) {
        errorDiv.textContent = `Hay ${arquerosPuros.length} arqueros puros para ${numEquipos} equipos. Debe haber como maximo 1 arquero puro por equipo.`;
        errorDiv.classList.remove('hidden');
        return;
      }

      const resultado = generarEquiposConDiferenciaAuto(selectedPlayers, numEquipos, maxDiff);
      if (resultado) {
        const validation = validarEquiposDetalle(resultado.equipos, teamSize, Number(resultado.usedMaxDiff || maxDiff));
        if (!validation.ok) {
          errorDiv.textContent = validation.reason;
          errorDiv.classList.remove('hidden');
          return;
        }
        lastEquipos = resultado.equipos;
        document.getElementById('diffDisplay').textContent = Number(resultado.usedMaxDiff || maxDiff).toFixed(1);
        mostrarEquipos(resultado.equipos);
        moveTeamColorConfigForMobile();
        successDiv.textContent = `Equipos generados exitosamente con diferencia máxima de ${maxDiff}`;
        if (resultado.perfecto) {
          successDiv.textContent = `Equipos generados con diferencia maxima ${Number(resultado.usedMaxDiff || maxDiff).toFixed(1)}.`;
        }
        if (!resultado.perfecto) {
          successDiv.textContent = `Se genero el mejor equilibrio encontrado. Diferencia de puntos: ${resultado.metricas.diffPuntos.toFixed(1)}.`;
        }
        successDiv.classList.remove('hidden');
      } else {
        errorDiv.textContent = `No se encontro una combinacion valida aumentando la diferencia de a 0.5 hasta el maximo de 2.0 puntos. ${explicarBloqueoSorteo(selectedPlayers, numEquipos, 2)}`;
        errorDiv.classList.remove('hidden');
      }
    }

    function moveTeamColorConfigForMobile() {
      if (!window.matchMedia('(max-width: 760px)').matches) return;
      const colorConfig = document.querySelector('.team-color-config');
      const teamsContainer = document.getElementById('equipos-generados');
      if (!colorConfig || !teamsContainer || colorConfig.dataset.mobileMoved === '1') return;
      teamsContainer.parentNode.insertBefore(colorConfig, teamsContainer);
      colorConfig.dataset.mobileMoved = '1';
    }

    function clonarEquipos(equipos) {
      return equipos.map(equipo => equipo.slice());
    }

    function teamStats(equipo) {
      const total = equipo.reduce((sum, j) => sum + j.puntuacion, 0);
      const lentos = equipo.filter(j => j.ritmo === 'lento').length;
      const rapidos = equipo.length - lentos;
      const assignment = buildTeamPositionAssignment(equipo);
      const lineas = assignment.conteoFinal || { ARQ: 0, DEF: 0, MED: 0, DEL: 0 };
      return {
        total,
        lentos,
        rapidos,
        lineas,
        arqueros: assignment.arquerosAsignados || 0,
        lineaMaximaValida: !!assignment.lineaMaximaValida
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

    function evaluarEquipos(equipos, teamSize, maxDiff) {
      const stats = equipos.map(teamStats);
      const puntos = stats.map(s => s.total);
      const lentos = stats.map(s => s.lentos);
      const rapidos = stats.map(s => s.rapidos);
      const diffPuntos = Math.max(...puntos) - Math.min(...puntos);
      const diffLentos = Math.max(...lentos) - Math.min(...lentos);
      const diffRapidos = Math.max(...rapidos) - Math.min(...rapidos);

      const repeatPenalty = historicalRepeatPenalty(equipos);
      let penalidad = diffLentos * 1600 + diffPuntos * 1000 + diffRapidos * 120 + repeatPenalty;
      let hardOk = true;

      const fieldPlayers = Math.max(0, teamSize - 1);
      const minFieldLine = fieldPlayers >= 3 ? 1 : 0;
      const maxFieldLine = MAX_FIELD_PLAYERS_PER_LINE;

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
        && equipos.every(equipo => equipo.length === teamSize)
        && stats.every(stat => REQUIRED_FIELD_LINES.every(linea => (stat.lineas[linea] || 0) >= minFieldLine && (stat.lineas[linea] || 0) <= maxFieldLine));

      return { penalidad, perfecto, diffPuntos, diffLentos, diffRapidos, repeatPenalty, stats };
    }

    function construirCandidato(players, numEquipos, teamSize, semilla) {
      const arqueros = players.filter(p => p.posicion.includes('ARQ')).sort(() => Math.random() - 0.5);
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
          const ritmoA = a.ritmo === 'lento' ? 1 : 0;
          const ritmoB = b.ritmo === 'lento' ? 1 : 0;
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
          const score = evaluarEquipos(candidato, teamSize, 999).penalidad;
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

    function mejorarPorIntercambios(equipos, teamSize, maxDiff) {
      let mejor = clonarEquipos(equipos);
      let mejorEval = evaluarEquipos(mejor, teamSize, maxDiff);
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
                const evaluacion = evaluarEquipos(candidato, teamSize, maxDiff);
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

    function generarDosEquiposOptimos(players, teamSize, maxDiff) {
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
        const evaluacion = evaluarEquipos(equipos, teamSize, maxDiff);
        if (!mejorEval || evaluacion.penalidad < mejorEval.penalidad) {
          mejor = equipos;
          mejorEval = evaluacion;
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

    function generarEquiposOptimos(players, numEquipos, maxDiff) {
      const teamSize = players.length / numEquipos;
      if (numEquipos === 2 && players.length <= 20) {
        const exacto = generarDosEquiposOptimos(players, teamSize, maxDiff);
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
        const candidato = construirCandidato(players, numEquipos, teamSize, intento);
        if (!candidato) continue;
        const mejorado = mejorarPorIntercambios(candidato, teamSize, maxDiff);
        if (!mejorEval || mejorado.evaluacion.penalidad < mejorEval.penalidad) {
          mejor = mejorado.equipos;
          mejorEval = mejorado.evaluacion;
          if (mejorEval.perfecto && (mejorEval.repeatPenalty || 0) === 0) break;
        }
      }

      if (!mejor) return null;
      return { equipos: mejor, perfecto: mejorEval.perfecto, metricas: mejorEval };
    }

    function generarEquiposConDiferenciaAuto(players, numEquipos, initialDiff = 0.5) {
      const start = Math.min(2, Math.max(0.5, initialDiff || 0.5));
      for (let diff = start; diff <= 2; diff += 0.5) {
        const resultado = generarEquiposOptimos(players, numEquipos, diff);
        if (resultado && resultado.perfecto) {
          resultado.usedMaxDiff = diff;
          return resultado;
        }
      }
      return null;
    }

    function validarEquiposDetalle(equipos, teamSize, maxDiff) {
      let puntuaciones = [];

      for (let equipoIndex = 0; equipoIndex < equipos.length; equipoIndex++) {
        const equipo = equipos[equipoIndex];
        const nombreEquipo = getTeamDisplayName(equipoIndex);
        if (equipo.length !== teamSize) {
          return { ok: false, reason: `${nombreEquipo} tiene ${equipo.length} jugadores y debe tener ${teamSize}.` };
        }

        const { asignacion, arquerosAsignados, lineaMaximaValida } = buildTeamPositionAssignment(equipo);
        if (arquerosAsignados !== 1) {
          return { ok: false, reason: `${nombreEquipo} queda con ${arquerosAsignados} arqueros asignados. Cada equipo debe tener exactamente 1 arquero.` };
        }
        if (!lineaMaximaValida) {
          return { ok: false, reason: `${nombreEquipo} supera el limite de ${MAX_FIELD_PLAYERS_PER_LINE} jugadores en una linea de campo.` };
        }
        const posiciones = new Set(asignacion.values());
        const posicionesRequeridas = ['ARQ', 'DEF', 'MED', 'DEL'];
        if (!posicionesRequeridas.every(p => posiciones.has(p))) {
          const faltantes = posicionesRequeridas.filter(p => !posiciones.has(p)).join(', ');
          return { ok: false, reason: `${nombreEquipo} no cubre todas las lineas requeridas. Falta: ${faltantes}.` };
        }

        const puntuacion = equipo.reduce((sum, j) => sum + j.puntuacion, 0);
        puntuaciones.push(puntuacion);

      }

      const max = Math.max(...puntuaciones);
      const min = Math.min(...puntuaciones);
      const diff = max - min;
      if (diff > maxDiff) {
        return { ok: false, reason: `La diferencia de puntaje entre equipos es ${diff.toFixed(1)} y el maximo permitido es ${maxDiff.toFixed(1)}.` };
      }
      const lentosPorEquipo = equipos.map(equipo => equipo.filter(j => j.ritmo === 'lento').length);
      const diffLentos = Math.max(...lentosPorEquipo) - Math.min(...lentosPorEquipo);
      if (diffLentos > 1) {
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

    function getFormationOptions(teamSize) {
      const fieldPlayers = Math.max(0, teamSize - 1);
      const candidates = [];
      for (let def = 0; def <= fieldPlayers; def++) {
        for (let med = 0; med <= fieldPlayers - def; med++) {
          const del = fieldPlayers - def - med;
          if (fieldPlayers >= 3 && (def < 1 || med < 1 || del < 1)) continue;
          if (Math.max(def, med, del) > MAX_FIELD_PLAYERS_PER_LINE) continue;
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
        return {
          DEF: Math.min(MAX_FIELD_PLAYERS_PER_LINE, Math.max(0, parseInt(custom.DEF || 0, 10))),
          MED: Math.min(MAX_FIELD_PLAYERS_PER_LINE, Math.max(0, parseInt(custom.MED || 0, 10))),
          DEL: Math.min(MAX_FIELD_PLAYERS_PER_LINE, Math.max(0, parseInt(custom.DEL || 0, 10)))
        };
      }
      const parts = selectedFormation.split('-').map(value => parseInt(value, 10));
      return { DEF: parts[0] || 0, MED: parts[1] || 0, DEL: parts[2] || 0 };
    }

    function defaultFormationCounts(teamSize) {
      const first = getFormationOptions(teamSize)[0] || { DEF: 0, MED: 0, DEL: Math.max(0, teamSize - 1) };
      return { DEF: first.DEF, MED: first.MED, DEL: first.DEL };
    }

    function onTeamFormationChange(teamIndex, value) {
      teamFormations[teamIndex] = value;
      if (value === 'custom' && !customFormations[teamIndex] && lastEquipos && lastEquipos[teamIndex]) {
        customFormations[teamIndex] = defaultFormationCounts(lastEquipos[teamIndex].length);
      }
      if (lastEquipos) mostrarEquipos(lastEquipos);
    }

    function onTeamCustomFormationChange(teamIndex, line, value) {
      if (!customFormations[teamIndex] && lastEquipos && lastEquipos[teamIndex]) {
        customFormations[teamIndex] = defaultFormationCounts(lastEquipos[teamIndex].length);
      }
      customFormations[teamIndex][line] = Math.min(MAX_FIELD_PLAYERS_PER_LINE, Math.max(0, parseInt(value || '0', 10)));
      teamFormations[teamIndex] = 'custom';
      if (lastEquipos) mostrarEquipos(lastEquipos);
    }

    function onManualPositionChange(teamIndex, playerId, position) {
      if (!customFormations[teamIndex] && lastEquipos && lastEquipos[teamIndex]) {
        customFormations[teamIndex] = defaultFormationCounts(lastEquipos[teamIndex].length);
      }
      teamFormations[teamIndex] = 'custom';
      manualAssignments[String(playerId)] = position;
      if (lastEquipos) mostrarEquipos(lastEquipos);
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
        || equipo.find(jugador => getOrderedPlayerPositions(jugador).includes('ARQ'));

      if (baseGoalkeeper) {
        assignment.set(baseGoalkeeper, 'ARQ');
        assigned.add(baseGoalkeeper);
      }

      for (const jugador of equipo) {
        if (assigned.has(jugador)) continue;
        const manual = manualAssignments[playerKey(jugador)];
        if (['ARQ', 'DEF', 'MED', 'DEL'].includes(manual)) {
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
      matchupTitle.className = 'sorteo-matchup-title';
      matchupTitle.textContent = getMatchupDisplayName(equipos.length);
      container.appendChild(matchupTitle);
      
      equipos.forEach((equipo, index) => {
        const equipoDiv = document.createElement('div');
        equipoDiv.className = 'team';
        const teamColor = getTeamColor(index);
        let headerText = getTeamDisplayName(index);
        if (teamColor) {
          equipoDiv.classList.add(teamColor.class);
        }
        
        const jugadoresOrdenados = equipo.slice().sort((a, b) => {
          const orderA = getPlayerOrder(a);
          const orderB = getPlayerOrder(b);
          if (orderA !== orderB) return orderA - orderB;
          return a.nombre.localeCompare(b.nombre);
        });
        
        const totalPuntos = jugadoresOrdenados.reduce((sum, j) => sum + j.puntuacion, 0);
        const totalLentos = jugadoresOrdenados.filter(j => j.ritmo === 'lento').length;
        const totalRapidos = jugadoresOrdenados.length - totalLentos;
        const asignacionPosiciones = buildFormationAssignment(jugadoresOrdenados, index);
        const custom = customFormations[index] || defaultFormationCounts(jugadoresOrdenados.length);
        const customVisible = (teamFormations[index] || 'auto') === 'custom';

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

        const resumenFormacion = ordenCancha.map(pos => jugadoresPorLinea[pos].length).join('-');
        
        equipoDiv.innerHTML = `
          <div class="team-header">
            <div class="team-title">${headerText}</div>
            <div class="team-stats">${totalPuntos.toFixed(1)} ⭐</div>
          </div>
          <div class="team-formation-controls">
            <label>Formacion</label>
            <select onchange="onTeamFormationChange(${index}, this.value)">
              ${formationOptionsHtml(index, jugadoresOrdenados.length)}
            </select>
            <div class="team-custom-formation ${customVisible ? '' : 'hidden'}">
              <span>DEF</span>
              <input type="number" min="0" max="${MAX_FIELD_PLAYERS_PER_LINE}" value="${custom.DEF}" onchange="onTeamCustomFormationChange(${index}, 'DEF', this.value)">
              <span>MED</span>
              <input type="number" min="0" max="${MAX_FIELD_PLAYERS_PER_LINE}" value="${custom.MED}" onchange="onTeamCustomFormationChange(${index}, 'MED', this.value)">
              <span>DEL</span>
              <input type="number" min="0" max="${MAX_FIELD_PLAYERS_PER_LINE}" value="${custom.DEL}" onchange="onTeamCustomFormationChange(${index}, 'DEL', this.value)">
            </div>
          </div>
          <div class="team-formation">
            ${ordenCancha.map(pos => `
              <div class="formation-line">
                <div class="line-label">${etiquetasPosicion[pos]}</div>
                <div class="line-players">
                  ${jugadoresPorLinea[pos].map(j => `
                    <div class="formation-player">
                      <span class="formation-player-name">${j.nombre} ${j.ritmo === 'lento' ? '🐢' : ''}</span>
                      <span class="formation-player-meta">${obtenerEmojisDePosiciones(j.posicion)} ${convertirPuntuacionAEstrellas(j.puntuacion)}</span>
                      <select class="formation-manual-select" onchange="onManualPositionChange(${index}, '${playerKey(j)}', this.value)">
                        ${ordenCancha.map(linea => `<option value="${linea}" ${pos === linea ? 'selected' : ''}>${linea}</option>`).join('')}
                      </select>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
            <div class="formation-resumen">Formación: ${resumenFormacion}</div>
          </div>
          <div class="totals">
            Total: ${totalPuntos.toFixed(1)} pts | 
            Lentos: ${totalLentos} | 
            Rápidos: ${totalRapidos}
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
          texto += `${j.nombre} ${j.ritmo === 'lento' ? '🐢' : ''} - ${j.posicion} - ${j.puntuacion} pts\n`;
        });
        const totalPuntos = equipo.reduce((sum, j) => sum + j.puntuacion, 0);
        const totalLentos = equipo.filter(j => j.ritmo === 'lento').length;
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
          texto += `${j.nombre.toUpperCase()} ${j.ritmo === 'lento' ? '🐢' : ''}\n`;
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
        alert('Esta pantalla no está vinculada a un partido.');
        return;
      }
      if (!lastEquipos) {
        alert('Primero genera los equipos');
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
        errorDiv.classList.add('hidden');
        successDiv.textContent = data.message || 'Sorteo guardado correctamente en el partido.';
        successDiv.classList.remove('hidden');
        window.setTimeout(() => {
          window.location.href = 'editar_partidos.php';
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

    // Lista inicial de jugadores según lo solicitado
    if (MATCH_ID > 0) {
      jugadores = PRELOADED_JUGADORES.map(j => ({
        id: j.id,
        nombre: j.nombre,
        posicion: normalizarPosiciones(j.posicion),
        ritmo: normalizarRitmo(j.ritmo),
        puntuacion: parseFloat(j.puntuacion),
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
    actualizarListaJugadores();
    if (LOCKED_MATCH_MODE && jugadores.length === 0) {
      const errorDiv = document.getElementById('error');
      errorDiv.textContent = 'Este partido no tiene jugadores convocados. Cárgalos desde la pantalla de partidos.';
      errorDiv.classList.remove('hidden');
    }
</script>
</body>
</html>

