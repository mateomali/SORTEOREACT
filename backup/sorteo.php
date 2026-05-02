<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Generador de Equipos GOODFELLAS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <style>
    :root {
      --color-primary: #2c3e50;
      --color-secondary: #3498db;
      --color-star: #ffd700;
      --color-rosa: #ffafbd;
      --color-success: #27ae60;
      --color-error: #e74c3c;
      --color-warning: #f39c12;
      --border-radius: 8px;
      --box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      --transition: all 0.3s ease;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 16px;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d);
      background-attachment: fixed;
      color: #333;
      -webkit-text-size-adjust: 100%;
    }
    
    .container { 
      max-width: 1200px; 
      margin: 10px auto; 
      padding: 15px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: var(--border-radius);
      box-shadow: var(--box-shadow);
    }
    
    h1 {
      text-align: center;
      color: #2c3e50;
      font-size: 1.8rem;
      margin-bottom: 15px;
      text-shadow: 1px 1px 2px rgba(0,0,0,0.1);
      background: linear-gradient(to right, #3498db, #2c3e50);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      padding: 8px;
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
    }
    
    .soccer-ball {
      width: 30px;
      height: 30px;
      background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="%232c3e50" d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm0 448c-105.9 0-192-86.1-192-192S150.1 64 256 64s192 86.1 192 192-86.1 192-192 192zm160-192c0-88.4-71.6-160-160-160-28.3 0-54.8 7.3-77.8 20.2l179.6 179.6c12.9-23 20.2-49.5 20.2-77.8zm-320 0c0 88.4 71.6 160 160 160 28.3 0 54.8-7.3 77.8-20.2L93.8 154.2C80.9 177.2 73.6 203.7 73.6 232v24z"/></svg>');
      background-size: contain;
    }
    
    .accordion {
      margin-bottom: 15px;
      border: 1px solid #e0e0e0;
      border-radius: var(--border-radius);
      overflow: hidden;
      box-shadow: var(--box-shadow);
    }
    
    .accordion-header {
      padding: 14px;
      background: linear-gradient(to right, #3498db, #2c3e50);
      color: white;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: var(--transition);
      font-weight: 600;
      font-size: 1.1rem;
    }
    
    .accordion-header:hover { 
      background: linear-gradient(to right, #2980b9, #1a2530);
    }
    
    .accordion-header::after {
      content: '▼';
      font-size: 0.8em;
      transition: transform 0.3s;
    }
    
    .accordion.active .accordion-header::after { 
      transform: rotate(180deg); 
    }
    
    .accordion-content {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.4s ease-out;
    }
    
    .players-list {
      border: 1px solid #e0e0e0; 
      border-radius: var(--border-radius);
      background: white;
      overflow: hidden;
    }
    
    .data-controls {
      margin-top: 15px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      padding: 10px;
    }
    
    .sort-controls {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      flex-wrap: wrap;
      padding: 0 10px;
      position: relative;
    }
    
    .sort-dropdown {
      position: relative;
      display: inline-block;
      width: 100%;
    }
    
    .sort-dropdown-btn {
      background: linear-gradient(to right, #3498db, #2c3e50);
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: var(--transition);
      font-weight: 600;
      box-shadow: var(--box-shadow);
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    
    .sort-dropdown-content {
      display: none;
      position: absolute;
      background-color: white;
      min-width: 100%;
      box-shadow: var(--box-shadow);
      z-index: 1;
      border-radius: var(--border-radius);
      overflow: hidden;
      top: 100%;
      left: 0;
      margin-top: 5px;
    }
    
    .sort-dropdown-content a {
      color: #333;
      padding: 10px 15px;
      text-decoration: none;
      display: block;
      transition: var(--transition);
      font-size: 0.95rem;
    }
    
    .sort-dropdown-content a:hover {
      background-color: #f0f0f0;
    }
    
    .sort-dropdown.active .sort-dropdown-content {
      display: block;
    }
    
    .data-controls button {
      background: linear-gradient(to right, #3498db, #2c3e50);
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: var(--transition);
      font-weight: 600;
      box-shadow: var(--box-shadow);
      font-size: 0.95rem;
      display: flex;
      align-items: center;
      gap: 5px;
      flex: 1;
      min-width: 150px;
    }
    
    .data-controls button:hover { 
      opacity: 0.9;
      transform: translateY(-2px);
    }
    
    .file-input { display: none; }
    
    .file-label {
      background: linear-gradient(to right, #27ae60, #219653);
      color: white;
      padding: 10px 15px;
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: var(--transition);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
      box-shadow: var(--box-shadow);
      font-size: 0.95rem;
      flex: 1;
      min-width: 150px;
      justify-content: center;
    }
    
    .file-label:hover {
      opacity: 0.9;
      transform: translateY(-2px);
    }
    
    .player-item { 
      display: flex;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid #f0f0f0;
      transition: var(--transition);
      position: relative;
    }
    
    .player-item:hover {
      background: #f5f9ff;
    }
    
    .player-item input[type="checkbox"] {
      flex-shrink: 0;
      margin-right: 10px;
      width: 20px;
      height: 20px;
      cursor: pointer;
    }
    
    .player-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    
    .player-name {
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 2px;
      font-size: 0.95rem;
    }
    
    .player-details {
      display: flex;
      align-items: center;
      font-size: 0.85rem;
      color: #666;
    }
    
    .position-emoji {
      margin-right: 5px;
      font-size: 1rem;
    }
    
    .stars { 
      color: var(--color-star);
      font-weight: bold;
      letter-spacing: 1px;
      font-size: 0.85rem;
    }
    
    .action-buttons {
      display: flex;
      gap: 6px;
      margin-left: 10px;
    }
    
    .action-buttons button {
      background: var(--color-secondary);
      color: white;
      border: none;
      padding: 8px;
      border-radius: 6px;
      cursor: pointer;
      width: 36px;
      height: 36px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 16px;
      transition: var(--transition);
      box-shadow: var(--box-shadow);
    }
    
    .action-buttons button:hover { 
      opacity: 0.9; 
      transform: scale(1.1);
    }
    
    .action-buttons .btn-edit {
      background: var(--color-warning);
    }
    
    .action-buttons .btn-delete {
      background: var(--color-error);
    }
    
    .controls { 
      display: flex; 
      gap: 12px; 
      margin: 20px 0;
      flex-wrap: wrap;
    }
    
    .main-controls { 
      flex-direction: column; 
      align-items: flex-start; 
      background: #f8f9fa;
      padding: 15px;
      border-radius: var(--border-radius);
      border: 1px solid #e9ecef;
      gap: 15px;
    }
    
    button {
      background: linear-gradient(to right, #3498db, #2c3e50);
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: var(--border-radius);
      cursor: pointer;
      font-size: 1rem;
      font-weight: 600;
      transition: var(--transition);
      box-shadow: var(--box-shadow);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
    }
    
    button:hover { 
      opacity: 0.9; 
      transform: translateY(-2px);
    }
    
    .error { 
      color: var(--color-error); 
      margin: 12px 0;
      padding: 10px;
      background: #fdecea;
      border-radius: var(--border-radius);
      border-left: 4px solid var(--color-error);
      font-weight: 600;
      display: none;
      font-size: 0.9rem;
    }
    
    .success {
      color: var(--color-success);
      margin: 12px 0;
      padding: 10px;
      background: #edf7f0;
      border-radius: var(--border-radius);
      border-left: 4px solid var(--color-success);
      font-weight: 600;
      display: none;
      font-size: 0.9rem;
    }
    
    .teams-container { 
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
      margin-top: 20px;
    }
    
    .team { 
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: var(--border-radius);
      padding: 15px;
      box-shadow: var(--box-shadow);
      transition: var(--transition);
      overflow: hidden;
    }
    
    .team:hover {
      transform: translateY(-3px);
    }
    
    .team-naranja { 
      background: linear-gradient(135deg, #ff9a00, #ff5e00);
      color: white;
    }
    
    .team-negro { 
      background: linear-gradient(135deg, #2c3e50, #000000);
      color: white;
    }
    
    .team-negro * { color: white; }
    
    .team-verde { 
      background: linear-gradient(135deg, #00b09b, #96c93d);
      color: white;
    }
    
    .team-azul { 
      background: linear-gradient(135deg, #3498db, #2c3e50);
      color: white;
    }
    
    .team-rosa {
      background: linear-gradient(135deg, #ffafbd, #ffc3a0);
      color: #333;
    }
    
    .team-formation {
      position: relative;
      margin-top: 12px;
      border-radius: 12px;
      padding: 14px 10px 10px;
      background:
        linear-gradient(90deg, rgba(255,255,255,0.14) 0 2px, transparent 2px 100%),
        linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
        linear-gradient(160deg, #1c8b3a, #11692f);
      background-size: 48px 100%, 100% 28px, 100% 100%;
      border: 2px solid rgba(255,255,255,0.45);
    }

    .team-formation::before,
    .team-formation::after {
      content: '';
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      border: 2px solid rgba(255,255,255,0.5);
      pointer-events: none;
    }

    .team-formation::before {
      top: 6px;
      width: 36%;
      height: 22%;
      border-radius: 0 0 70px 70px;
      border-top: none;
    }

    .team-formation::after {
      bottom: 6px;
      width: 36%;
      height: 22%;
      border-radius: 70px 70px 0 0;
      border-bottom: none;
    }

    .formation-line {
      display: grid;
      grid-template-columns: 42px 1fr;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      position: relative;
      z-index: 1;
    }

    .formation-line:last-child {
      margin-bottom: 0;
    }

    .line-label {
      color: #f4fff1;
      font-weight: 700;
      font-size: 0.8rem;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.35);
      text-align: center;
    }

    .line-players {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .formation-player {
      min-width: 120px;
      max-width: 100%;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.4);
      background: rgba(2, 34, 9, 0.55);
      color: #fff;
      padding: 6px 8px;
      text-align: center;
      line-height: 1.25;
    }

    .formation-player-name {
      display: block;
      font-weight: 700;
      font-size: 0.9rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .formation-player-meta {
      display: block;
      font-size: 0.8rem;
      opacity: 0.95;
    }

    .formation-resumen {
      margin-top: 10px;
      font-weight: 700;
      color: #f4fff1;
      text-align: center;
      font-size: 0.9rem;
      text-shadow: 0 1px 2px rgba(0,0,0,0.35);
    }
    
    .totals { 
      font-weight: bold;
      margin-top: 15px;
      padding-top: 10px;
      border-top: 2px solid var(--color-primary);
      font-size: 1rem;
      text-align: center;
      background: rgba(0,0,0,0.1);
      padding: 8px;
      border-radius: var(--border-radius);
    }
    
    .slow-emoji { margin-left: 5px; }
    
    .select-all { 
      margin-bottom: 10px;
      padding: 10px;
      background: #edf2f7;
      border-radius: var(--border-radius);
    }
    
    .select-all label {
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
    }
    
    .team-color-config {
      margin: 20px 0;
      padding: 15px;
      border: 1px solid #ddd;
      border-radius: var(--border-radius);
      background: #f8f9fa;
      max-width: 100%;
    }
    
    .team-color-config h3 {
      margin-top: 0;
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
      font-size: 1.2rem;
    }
    
    .team-color-config label {
      margin-right: 15px;
      display: inline-block;
      margin-bottom: 12px;
      font-weight: 600;
      font-size: 0.95rem;
    }
    
    .team-color-config select {
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid #ddd;
      background: white;
      font-size: 0.95rem;
      box-shadow: var(--box-shadow);
    }
    
    .modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .modal-content {
      background: white;
      padding: 20px;
      border-radius: var(--border-radius);
      width: 95%;
      max-width: 500px;
      box-shadow: 0 15px 40px rgba(0,0,0,0.3);
      position: relative;
    }
    
    .modal-content h3 {
      margin-top: 0;
      color: #2c3e50;
      border-bottom: 2px solid #3498db;
      padding-bottom: 12px;
      font-size: 1.3rem;
    }
    
    input[type="text"],
    select {
      font-size: 16px;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: var(--border-radius);
      box-sizing: border-box;
      width: 100%;
      transition: var(--transition);
      margin-bottom: 12px;
    }
    
    input[type="text"]:focus,
    select:focus {
      border-color: #3498db;
      outline: none;
      box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
    }
    
    #numEquipos, #maxDiff { width: 80px; }
    
    .fab-add {
      position: fixed;
      bottom: 25px;
      right: 25px;
      background: linear-gradient(135deg, #3498db, #2c3e50);
      color: white;
      border: none;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      font-size: 30px;
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
      z-index: 1000;
      box-shadow: 0 6px 15px rgba(0,0,0,0.3);
      transition: var(--transition);
    }
    
    .fab-add:hover {
      transform: scale(1.1) rotate(90deg);
      box-shadow: 0 8px 20px rgba(0,0,0,0.4);
    }
    
    .score-control {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      padding: 6px 12px;
      border-radius: var(--border-radius);
      border: 1px solid #ddd;
      margin-bottom: 12px;
    }
    
    .score-control button {
      background: #3498db;
      color: white;
      border: none;
      padding: 5px 12px;
      font-size: 18px;
      border-radius: 6px;
      cursor: pointer;
      width: auto;
      height: auto;
      box-shadow: none;
      min-height: auto;
    }
    
    .score-control span {
      width: 40px;
      text-align: center;
      font-weight: bold;
      font-size: 1.1rem;
    }
    
    .close-modal {
      position: absolute;
      top: 12px;
      right: 12px;
      background: transparent;
      border: none;
      font-size: 22px;
      cursor: pointer;
      color: #7f8c8d;
      transition: var(--transition);
    }
    
    .close-modal:hover {
      color: var(--color-error);
    }
    
    .team-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid rgba(255,255,255,0.3);
    }
    
    .team-title {
      font-size: 1.3rem;
      font-weight: 700;
    }
    
    .team-stats {
      font-size: 0.95rem;
      background: rgba(0,0,0,0.2);
      padding: 4px 10px;
      border-radius: 20px;
    }
    
    .form-row {
      margin-bottom: 12px;
    }
    
    .form-row label { 
      display: block; 
      margin-bottom: 6px;
      font-weight: 600;
      color: #2c3e50;
      font-size: 0.95rem;
    }
    
    .position-checkboxes { 
      display: flex; 
      gap: 12px;
      flex-wrap: wrap;
    }
    
    .position-checkboxes label {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: normal;
      margin-bottom: 0;
    }
    
    .position-checkboxes input[type="checkbox"] {
      width: 18px;
      height: 18px;
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 10px;
        margin: 8px;
      }
      
      h1 { 
        font-size: 1.5rem;
        padding: 6px;
      }
      
      .soccer-ball {
        width: 25px;
        height: 25px;
      }
      
      .accordion-header {
        padding: 12px;
        font-size: 1rem;
      }
      
      .player-item {
        padding: 8px 10px;
      }
      
      .player-name {
        font-size: 0.95rem;
      }
      
      .player-details {
        font-size: 0.85rem;
      }
      
      .action-buttons button {
        width: 32px;
        height: 32px;
        font-size: 14px;
        padding: 6px;
      }
      
      button, .file-label, .sort-dropdown-btn {
        padding: 10px 15px;
        font-size: 0.95rem;
        width: 100%;
        justify-content: center;
      }
      
      .controls {
        gap: 8px;
        margin: 15px 0;
      }
      
      .teams-container {
        gap: 12px;
      }
      
      .team {
        padding: 12px;
      }

      .formation-player {
        min-width: 104px;
      }
      
      .modal-content {
        padding: 15px;
      }
      
      .position-checkboxes {
        gap: 8px;
      }
      
      .fab-add {
        width: 55px;
        height: 55px;
        font-size: 28px;
        bottom: 20px;
        right: 20px;
      }
    }
    
    @media (max-width: 480px) {
      .player-item {
        flex-wrap: wrap;
      }
      
      .player-info {
        flex-basis: calc(100% - 60px);
      }
      
      .action-buttons {
        position: absolute;
        top: 8px;
        right: 8px;
      }
      
      .data-controls {
        flex-direction: column;
      }
      
      .data-controls button, .file-label {
        width: 100%;
      }
      
      .team-color-config label {
        display: block;
        margin-right: 0;
        width: 100%;
      }
      
      .team-color-config select {
        width: 100%;
        margin-bottom: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1><span class="soccer-ball"></span> Generador de Equipos GOODFELLAS <span class="soccer-ball"></span></h1>
    <div class="controls">
      <button onclick="abrirModalAgregar()"><span style="font-size: 1.2em;">+</span> Añadir Jugador</button>
    </div>
    <div class="accordion">
      <div class="accordion-header" onclick="toggleAccordion(this)">
        <h3>👥 Jugadores Disponibles</h3>
      </div>
      <div class="accordion-content">
        <div class="players-list">
          <div class="data-controls">
            <button onclick="exportarJugadoresCSV()">💾 Guardar lista de jugadores</button>
            <label class="file-label">
              📥 Importar lista de jugadores
              <input type="file" class="file-input" id="csvInput" accept=".csv" onchange="importarJugadoresCSV(event)">
            </label>
          </div>
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
          <div class="select-all">
            <label>
              <input type="checkbox" id="select-all" onchange="toggleSelectAll(this)" checked> 
              Seleccionar todos
            </label>
          </div>
          <div id="jugadores-container"></div>
        </div>
      </div>
    </div>
    <div class="controls main-controls">
      <div>
        <label>Número de Equipos:</label>
        <div class="score-control" id="teamControl">
          <button type="button" onclick="decrementTeam()">−</button>
          <span id="teamDisplay">2</span>
          <button type="button" onclick="incrementTeam()">+</button>
        </div>
      </div>
      <div>
        <label>Diferencia máxima permitida:</label>
        <div class="score-control" id="diffControl">
          <button type="button" onclick="decrementDiff()">−</button>
          <span id="diffDisplay">0.5</span>
          <button type="button" onclick="incrementDiff()">+</button>
        </div>
      </div>
      <button onclick="generarEquipos()">🎲 Generar Equipos</button>
    </div>
    <div id="error" class="error"></div>
    <div id="success" class="success"></div>
    <div id="equipos-generados" class="teams-container"></div>
    <div class="controls" id="download-controls" style="display: none; margin-top: 20px;">
      <button onclick="copiarEquiposClipboard()">📋 Copiar al Portapapeles</button>
      <button onclick="descargarEquiposJPG()">📸 Descargar como JPG</button>
      <button onclick="descargarEquiposTexto()">📝 Descargar como Texto</button>
    </div>
    <div class="team-color-config">
      <h3>Configuración de Camisetas</h3>
      <div id="team-color-settings"></div>
    </div>
  </div>

  <div id="addModal" class="modal">
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
        <button onclick="cerrarModal('addModal')" style="background: #95a5a6;">❌ Cancelar</button>
      </div>
    </div>
  </div>

  <div id="editModal" class="modal">
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
        <button onclick="cerrarModal('editModal')" style="background: #95a5a6;">❌ Cancelar</button>
      </div>
    </div>
  </div>

  <button class="fab-add" onclick="abrirModalAgregar()">+</button>

  <script>
    let jugadores = [];
    let editIndex = -1;
    let currentSort = 'nombre';
    let sortDirection = 1;
    var lastEquipos = null;

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
        document.getElementById('download-controls').style.display = 'none';
      }
    }
    function decrementTeam() {
      const teamDisplay = document.getElementById('teamDisplay');
      let value = parseInt(teamDisplay.textContent);
      if (value > 2) {
        value -= 1;
        teamDisplay.textContent = value;
        actualizarTeamColorSettings();
        document.getElementById('download-controls').style.display = 'none';
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
      const content = accordion.querySelector('.accordion-content');
      if (accordion.classList.contains('active')) {
        content.style.maxHeight = null;
        accordion.classList.remove('active');
      } else {
        content.style.maxHeight = content.scrollHeight + "px";
        accordion.classList.add('active');
      }
    }

    function toggleSelectAll(checkbox) {
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
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

    function importarJugadoresCSV(event) {
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
              ritmo: ritmo.toLowerCase(),
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
      const maxPorLinea = 3;
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
          <input type="checkbox" id="jugador-${index}" ${jugador.selected ? 'checked' : ''} onchange="jugadores[${index}].selected = this.checked">
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
      const accordionContent = document.querySelector('.accordion-content');
      if (accordionContent && document.querySelector('.accordion').classList.contains('active')) {
        accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
      }
    }

    function abrirModalAgregar() {
      document.getElementById('addNombre').value = '';
      document.querySelectorAll('.addPosicion').forEach(cb => cb.checked = false);
      document.getElementById('addEdad').value = 'rápido';
      document.getElementById('addScoreDisplay').textContent = "1.0";
      document.getElementById('addModal').style.display = 'flex';
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
      document.getElementById('editModal').style.display = 'flex';
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
      document.getElementById(modalId).style.display = 'none';
      editIndex = -1;
    }

    function eliminarJugador(index) {
      if (confirm('¿Estás seguro de eliminar este jugador?')) {
        jugadores.splice(index, 1);
        actualizarListaJugadores();
      }
    }

    function generarEquipos() {
      const errorDiv = document.getElementById('error');
      const successDiv = document.getElementById('success');
      errorDiv.textContent = '';
      errorDiv.style.display = 'none';
      successDiv.style.display = 'none';
      
      const numEquipos = parseInt(document.getElementById('teamDisplay').textContent);
      const maxDiff = parseFloat(document.getElementById('diffDisplay').textContent);
      const selectedPlayers = jugadores.filter(j => j.selected);
      
      if (isNaN(maxDiff) || maxDiff < 0) {
        errorDiv.textContent = 'La diferencia máxima debe ser un número positivo';
        errorDiv.style.display = 'block';
        return;
      }
      if (selectedPlayers.length === 0) {
        errorDiv.textContent = 'Selecciona al menos un jugador';
        errorDiv.style.display = 'block';
        return;
      }
      if (selectedPlayers.length % numEquipos !== 0) {
        errorDiv.textContent = `Jugadores seleccionados (${selectedPlayers.length}) no es divisible por ${numEquipos}`;
        errorDiv.style.display = 'block';
        return;
      }

      const teamSize = selectedPlayers.length / numEquipos;
      if (teamSize > 12) {
        errorDiv.textContent = `Con ${teamSize} jugadores por equipo no se puede respetar el tope de 3 por línea (máximo 12 por equipo).`;
        errorDiv.style.display = 'block';
        return;
      }
      
      const lentos = selectedPlayers.filter(p => p.ritmo === 'lento');
      if (lentos.length < numEquipos) {
        errorDiv.textContent = `Se necesitan mínimo ${numEquipos} jugadores "lentos"`;
        errorDiv.style.display = 'block';
        return;
      }
      
      const arqueros = selectedPlayers.filter(p => p.posicion.includes('ARQ'));
      if (arqueros.length < numEquipos) {
        errorDiv.textContent = `Se necesitan mínimo ${numEquipos} arqueros`;
        errorDiv.style.display = 'block';
        return;
      }
      
      const arquerosPuros = arqueros.filter(isPureGoalkeeper);
      if (arquerosPuros.length > numEquipos) {
        errorDiv.textContent = `Hay ${arquerosPuros.length} arqueros puros para ${numEquipos} equipos. Debe haber como maximo 1 arquero puro por equipo.`;
        errorDiv.style.display = 'block';
        return;
      }

      const equipos = generarEquiposValidos(selectedPlayers, numEquipos, maxDiff);
      if (equipos) {
        lastEquipos = equipos;
        mostrarEquipos(equipos);
        successDiv.textContent = `Equipos generados exitosamente con diferencia máxima de ${maxDiff}`;
        successDiv.style.display = 'block';
      } else {
        errorDiv.textContent = `No se encontró una combinación válida en 50000 intentos con diferencia máxima de ${maxDiff}. Intenta aumentar la diferencia máxima.`;
        errorDiv.style.display = 'block';
      }
    }

    function generarEquiposValidos(players, numEquipos, maxDiff) {
      const teamSize = players.length / numEquipos;
      for (let intento = 0; intento < 50000; intento++) {
        // Separar jugadores por tipo
        const arqueros = players.filter(p => p.posicion.includes('ARQ')).sort(() => Math.random() - 0.5);
        
        const arquerosTitulares = arqueros.slice(0, numEquipos);
        const jugadoresDeCampo = players.filter(p => !arquerosTitulares.includes(p));
        const lentosCampo = jugadoresDeCampo.filter(p => p.ritmo === 'lento').sort(() => Math.random() - 0.5);
        const rapidosCampo = jugadoresDeCampo.filter(p => p.ritmo === 'rápido').sort(() => Math.random() - 0.5);

        const equipos = Array.from({length: numEquipos}, () => []);
        const puntosPorEquipo = new Array(numEquipos).fill(0);
        
        // Asignar arqueros balanceados
        for (let i = 0; i < arquerosTitulares.length; i++) {
          equipos[i].push(arquerosTitulares[i]);
          puntosPorEquipo[i] += arquerosTitulares[i].puntuacion;
        }
        
        // Asignar lentos no-arqueros balanceados
        for (let i = 0; i < lentosCampo.length; i++) {
          const equipoIndex = i % numEquipos;
          equipos[equipoIndex].push(lentosCampo[i]);
          puntosPorEquipo[equipoIndex] += lentosCampo[i].puntuacion;
        }
        
        // Asignar rápidos al equipo con menor puntuación
        const rapidosOrdenados = [...rapidosCampo].sort((a, b) => b.puntuacion - a.puntuacion);
        for (const jugador of rapidosOrdenados) {
          let minPuntos = Infinity;
          let equipoIndex = 0;
          let equiposDisponibles = [];
          
          // Encontrar equipos con espacio disponible
          for (let i = 0; i < numEquipos; i++) {
            if (equipos[i].length < teamSize) {
              equiposDisponibles.push(i);
            }
          }
          
          // Si hay equipos disponibles, seleccionar el de menor puntuación
          if (equiposDisponibles.length > 0) {
            for (let i of equiposDisponibles) {
              if (puntosPorEquipo[i] < minPuntos) {
                minPuntos = puntosPorEquipo[i];
                equipoIndex = i;
              }
            }
          } else {
            // Si no hay espacio en ningún equipo, asignar al primero
            equipoIndex = 0;
          }
          
          equipos[equipoIndex].push(jugador);
          puntosPorEquipo[equipoIndex] += jugador.puntuacion;
        }
        
        // Verificar restricciones
        if (validarEquipos(equipos, teamSize, maxDiff)) {
          return equipos;
        }
      }
      return null;
    }

    function validarEquipos(equipos, teamSize, maxDiff) {
      let puntuaciones = [];
      
      for (const equipo of equipos) {
        // Verificar tamaño del equipo
        if (equipo.length !== teamSize) return false;

        // Verificar posiciones obligatorias con una sola plaza de arquero.
        const { asignacion, arquerosAsignados, lineaMaximaValida } = buildTeamPositionAssignment(equipo);
        if (arquerosAsignados !== 1) {
          return false;
        }
        if (!lineaMaximaValida) {
          return false;
        }
        const posiciones = new Set(asignacion.values());        
        const posicionesRequeridas = ['ARQ', 'DEF', 'MED', 'DEL'];
        if (!posicionesRequeridas.every(p => posiciones.has(p))) {
          return false;
        }
        
        // Calcular puntuación total
        const puntuacion = equipo.reduce((sum, j) => sum + j.puntuacion, 0);
        puntuaciones.push(puntuacion);
        
        // Verificar balance de ritmos
        const rapidos = equipo.filter(j => j.ritmo === 'rápido').length;
        const lentos = equipo.filter(j => j.ritmo === 'lento').length;
        if (Math.abs(rapidos - lentos) > 2.5) {
          return false;
        }
      }
      
      // Verificar diferencia máxima de puntuación
      const max = Math.max(...puntuaciones);
      const min = Math.min(...puntuaciones);
      return (max - min) <= maxDiff;
    }

    function mostrarEquipos(equipos) {
      const container = document.getElementById('equipos-generados');
      container.innerHTML = '';
      
      equipos.forEach((equipo, index) => {
        const equipoDiv = document.createElement('div');
        equipoDiv.className = 'team';
        const teamColor = getTeamColor(index);
        let headerText = `Equipo ${index + 1}`;
        if (teamColor) {
          equipoDiv.classList.add(teamColor.class);
          headerText += ` - ${teamColor.name}`;
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
        const { asignacion: asignacionPosiciones } = buildTeamPositionAssignment(jugadoresOrdenados);

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
          <div class="team-formation">
            ${ordenCancha.map(pos => `
              <div class="formation-line">
                <div class="line-label">${etiquetasPosicion[pos]}</div>
                <div class="line-players">
                  ${jugadoresPorLinea[pos].map(j => `
                    <div class="formation-player">
                      <span class="formation-player-name">${j.nombre} ${j.ritmo === 'lento' ? '🐢' : ''}</span>
                      <span class="formation-player-meta">${obtenerEmojisDePosiciones(j.posicion)} ${convertirPuntuacionAEstrellas(j.puntuacion)}</span>
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
      
      document.getElementById('download-controls').style.display = 'flex';
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
      equipos.forEach((equipo, index) => {
        const teamColor = getTeamColor(index);
        texto += `Equipo ${index + 1} - ${teamColor ? teamColor.name : ''}\n`;
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
      equipos.forEach((equipo, index) => {
        const teamColor = getTeamColor(index);
        texto += `\n Equipo "${teamColor ? teamColor.name.toUpperCase() : 'sin color'}":\n`;
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

    // Lista inicial de jugadores según lo solicitado
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
    
    // Inicializar la lista de jugadores
    actualizarListaJugadores();
  </script>
</body>
</html>



