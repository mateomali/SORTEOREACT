if (typeof window.goodfellasHomeCaptainsCleanup === 'function') {
  window.goodfellasHomeCaptainsCleanup();
}
(() => {
    const root = document.querySelector('[data-public-captain-live]');
    if (!root) return;

    const matchId = parseInt(root.dataset.matchId || '0', 10);
    const status = root.querySelector('[data-public-captain-status]');
    const teamsRoot = root.querySelector('[data-public-captain-teams]');
    let stopped = false;

    const escapeHtml = (value) => String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

    const formatSkill = (value) => {
      const number = Number(value || 0);
      return number.toFixed(1);
    };
    const ratingWithStar = (value) => `${formatSkill(value)} ⭐`;

    const playerCardRating = value => globalThis.GoodfellasRating.card(value);
    const playerCardRatingHtml = (value, label = 'GEN') => `
      <span class="player-card-rating" title="Puntaje tarjeta">
        <strong>${playerCardRating(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </span>
    `;
    const playerCardPhotoPath = (player) => {
      const path = String(player.photo_path || '');
      return path.startsWith('uploads/players/') && !path.includes('..')
        ? path
        : 'assets/players/default-player-silhouette.png';
    };
    const playerCardPhotoHtml = (player) => {
      const path = playerCardPhotoPath(player);
      const photoClass = path.startsWith('uploads/players/') ? ' is-custom' : ' is-default';
      return `<span class="formation-card-photo${photoClass}" aria-hidden="true"><img src="${escapeHtml(path)}" alt=""></span>`;
    };
    const playerCardRegularityForm = (player) => {
      const rating = Math.max(1, Math.min(6, statValue(player, 'regularity')));
      if (rating >= 4.5) return ['up', 'Regularidad alta'];
      if (rating < 3.0) return ['down', 'Regularidad baja'];
      return ['right', 'Regularidad normal'];
    };
    const playerCardRegularityHtml = (player) => {
      const [form, label] = playerCardRegularityForm(player);
      return `<span class="formation-card-regularity is-${escapeHtml(form)}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}"></span>`;
    };
    const playerCardTier = (value) => {
      const overall = playerCardRating(value);
      if (overall >= 88) return 'supreme';
      if (overall >= 84) return 'elite';
      if (overall >= 76) return 'gold';
      if (overall >= 66) return 'silver';
      return 'bronze';
    };
    const playerCardStatValue = (player, field) => playerCardRating(statValue(player, field));
    const playerCardStats = (player, assignedPosition) => {
      const position = String(assignedPosition || '').toUpperCase();
      if (position === 'ARQ') {
        return [
          ['ARQ', playerCardStatValue(player, 'goalkeeper_skill')],
          ['VEL', playerCardStatValue(player, 'rhythm')],
          ['DEF', playerCardStatValue(player, 'defense_physical')],
          ['TEC', playerCardStatValue(player, 'technique')],
          ['EQU', playerCardStatValue(player, 'teamwork')],
          ['MEN', playerCardStatValue(player, 'mentality')],
        ];
      }
      return [
        ['TEC', playerCardStatValue(player, 'technique')],
        ['VEL', playerCardStatValue(player, 'rhythm')],
        ['DEF', playerCardStatValue(player, 'defense_physical')],
        ['ATA', playerCardStatValue(player, 'attack')],
        ['EQU', playerCardStatValue(player, 'teamwork')],
        ['MEN', playerCardStatValue(player, 'mentality')],
      ];
    };
    const playerCardStatsHtml = (player, assignedPosition) => `
      <span class="formation-card-stats" aria-label="Stats del jugador">
        ${playerCardStats(player, assignedPosition).map(([label, value]) => `
          <span class="formation-card-stat"><span>${escapeHtml(label)}</span><strong>${value}</strong></span>
        `).join('')}
      </span>
    `;

    const teamTotalSkill = (players) => players.reduce((total, player) => {
      const position = player.assigned_position || player.primary_position || 'MED';
      return total + adjustedPositionRating(player, position);
    }, 0);
    const teamTacticLabel = (players) => {
      const counts = ['DEF', 'LAT', 'MED', 'DEL'].map((position) => (
        players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === position).length
      ));
      return counts.join('-');
    };
    const statValue = (player, field) => {
      const value = Number(player[field]);
      if (Number.isFinite(value) && value > 0) return value;
      if (field === 'stamina') return statValue(player, 'rhythm');
      if (field === 'pass_vision') return statValue(player, 'technique');
      return field === 'regularity' ? 3.5 : (field === 'mentality' ? 3.0 : Number(player.skill || 0));
    };
    const lowRhythm = (player) => statValue(player, 'rhythm') <= 3;
    const teamAverage = (players, field) => players.length
      ? players.reduce((total, player) => total + statValue(player, field), 0) / players.length
      : 0;
    const hasGoalkeeper = (player) => String(player.positions || '').split('/').map((pos) => pos.trim().toUpperCase()).includes('ARQ');
    const playerPositions = (player) => String(player.positions || '')
      .split('/')
      .map((pos) => pos.trim().toUpperCase())
      .filter(Boolean);
    const primaryPosition = (player) => playerPositions(player)[0] || '';
    const pitchLineForPosition = (position) => String(position || '').toUpperCase() === 'LAT' ? 'DEF' : String(position || '').toUpperCase();
    const positionFitFactor = (player, position) => globalThis.GoodfellasRating.fit(playerPositions(player), position);
    const isPositionChanged = (player, assignedPosition) => {
      const primary = primaryPosition(player);
      return primary !== '' && String(assignedPosition || '').toUpperCase() !== primary;
    };
    const adjustedPositionRating = (player, assignedPosition) => {
      const role = String(assignedPosition || '').toUpperCase();
      if (!role) return Math.max(1, Math.min(6, Number(player.skill || 0)));
      const stats = Object.fromEntries(Object.keys(globalThis.GoodfellasRating.policy().weights.MED).concat('goalkeeper_skill', 'regularity').map(field => [field, statValue(player, field)]));
      return globalThis.GoodfellasRating.position(stats, role, playerPositions(player));
    };
    const renderTeamCharacteristics = (players) => {
      if (!players.length) return '';
      const goalkeeperSkill = players.reduce((max, player) => (
        hasGoalkeeper(player) ? Math.max(max, statValue(player, 'goalkeeper_skill')) : max
      ), 0);
      return `
        <div class="public-team-characteristics">
          <div class="team-characteristics-main">
            <span>General ${teamTotalSkill(players).toFixed(1)}</span>
            <span>${players.filter((player) => !lowRhythm(player)).length} rapidos / ${players.filter(lowRhythm).length} lentos</span>
          </div>
          <div class="team-characteristics-stats">
            ${goalkeeperSkill > 0 ? `<span>Arquero ${goalkeeperSkill.toFixed(1)}</span>` : `<span>Ataque ${teamAverage(players, 'attack').toFixed(1)}</span>`}
            <span>Solidez ${teamAverage(players, 'defense_physical').toFixed(1)}</span>
            <span>Velocidad ${teamAverage(players, 'rhythm').toFixed(1)}</span>
            <span>Ida y vuelta ${teamAverage(players, 'stamina').toFixed(1)}</span>
            <span>Pase/Vision ${teamAverage(players, 'pass_vision').toFixed(1)}</span>
            <span>Tecnica ${teamAverage(players, 'technique').toFixed(1)}</span>
            <span>Juego en equipo ${teamAverage(players, 'teamwork').toFixed(1)}</span>
            <span>Mentalidad ${teamAverage(players, 'mentality').toFixed(1)}</span>
            <span>Regularidad ${teamAverage(players, 'regularity').toFixed(1)}</span>
          </div>
        </div>
      `;
    };

    const renderFormation = (players, teamNumber) => {
      const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
      return positions.map((position) => {
        const linePlayers = position === 'DEF'
          ? [
              ...players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === 'LAT').slice(0, 1),
              ...players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === 'DEF'),
              ...players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === 'LAT').slice(1),
            ]
          : players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === position);
        const playerHtml = linePlayers.length
          ? linePlayers.map((player) => {
            const assignedPosition = player.assigned_position || player.primary_position || position;
            const adjustedRating = adjustedPositionRating(player, assignedPosition);
            const changedClass = isPositionChanged(player, assignedPosition) ? ' is-position-changed' : '';
            const laneRole = assignedPosition === 'LAT' ? ' data-lane-role="lateral"' : '';
            return `
              <div class="formation-player formation-card-sin-stat formation-card-compacta formation-card-tier-${playerCardTier(adjustedRating)}${changedClass}" draggable="false" data-static-formation-player data-static-player-key="${escapeHtml(player.id || player.name)}" data-team-number="${teamNumber}" data-assigned-position="${assignedPosition}" data-player-skill="${Number(player.skill || 0)}" data-player-positions="${escapeHtml(player.positions || player.primary_position || '')}"${laneRole}>
                ${playerCardRatingHtml(adjustedRating, 'GEN')}
                <span class="formation-lane-indicator" aria-hidden="true"><span></span><span></span><span></span></span>
                ${playerCardPhotoHtml(player)}
                <strong class="formation-player-name">${escapeHtml(player.name)}</strong>
                <span class="formation-player-meta formation-player-position formation-card-position">${escapeHtml(assignedPosition)}</span>
                ${playerCardRegularityHtml(player)}
              </div>
            `;
          }).join('')
          : '<span class="formation-player empty-slot">-</span>';

        return `
          <div class="formation-line${position === 'DEF' && linePlayers.some((player) => (player.assigned_position || player.primary_position || 'MED') === 'LAT') ? ' is-projected-defense' : ''}">
            <div class="line-label">${position === 'DEF' && linePlayers.some((player) => (player.assigned_position || player.primary_position || 'MED') === 'LAT') ? 'DEF/LAT' : position}</div>
            <div class="line-players">${playerHtml}</div>
          </div>
        `;
      }).join('');
    };

    const renderTeamCard = (state, teamNumber) => {
      const players = state.teams?.[teamNumber] || [];
      const captainName = state.draft?.captains?.[teamNumber]?.name || `Equipo ${teamNumber}`;
      const targetSize = Number(state.match?.target_team_size || 0);
      const totalSkill = teamTotalSkill(players);

      return `
        <article class="team-card">
          <div class="team-head">
            <h4>${escapeHtml(captainName)}</h4>
              <span class="small-muted">${players.length}/${targetSize} jugadores</span>
            </div>
          <div class="formation-title-row">
            <div class="formation-total-title" data-formation-total-title><span>Base</span><strong>${totalSkill.toFixed(1)} pts</strong></div>
            <div class="formation-total-title formation-tactic-title"><span>TACTICA</span><strong data-formation-tactic>${teamTacticLabel(players)}</strong></div>
          </div>
          <div class="team-formation is-base-formation" data-static-team-formation data-static-formation-locked="1" data-team-number="${teamNumber}">${renderFormation(players, teamNumber)}</div>
          ${renderTeamCharacteristics(players)}
        </article>
      `;
    };

    const render = (state) => {
      if (!state.ok) {
        status.textContent = state.message || 'No se pudo cargar el sorteo.';
        return;
      }

      const teamsHtml = renderTeamCard(state, 1) + renderTeamCard(state, 2);
      teamsRoot.innerHTML = teamsHtml;

      const availableCount = Array.isArray(state.available) ? state.available.length : 0;
      if (state.draft?.status === 'completed') {
        stopped = true;
        root.hidden = true;
        return;
      }

      if (state.draft?.current_captain) {
        status.textContent = `Turno de ${state.draft.current_captain} | ${availableCount} disponibles`;
      } else {
        status.textContent = `${availableCount} jugadores disponibles`;
      }

    };

    const loadState = async () => {
      if (stopped || !matchId) return;
      try {
        const response = await fetch(`capitanes_api.php?action=state&match_id=${matchId}`, { cache: 'no-store' });
        const state = await response.json();
        render(state);
      } catch (error) {
        status.textContent = 'Reintentando actualizacion...';
      }
    };

    loadState();
    const timer = window.setInterval(loadState, 3000);
    window.goodfellasHomeCaptainsCleanup = () => {
      window.goodfellasHomeCaptainsCleanup();
    };
    document.addEventListener('goodfellas:before-partial-render', () => {
      window.goodfellasHomeCaptainsCleanup();
    }, { once: true });
    window.addEventListener('beforeunload', () => {
      window.goodfellasHomeCaptainsCleanup();
    });
  })();
