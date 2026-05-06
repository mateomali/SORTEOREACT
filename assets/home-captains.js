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
      return Number.isInteger(number) ? String(number) : number.toFixed(1);
    };

    const teamTotalSkill = (players) => players.reduce((total, player) => total + Number(player.skill || 0), 0);
    const statValue = (player, field) => {
      const value = Number(player[field]);
      if (Number.isFinite(value) && value > 0) return value;
      return field === 'regularity' ? 3.5 : (field === 'mentality' ? 3.0 : Number(player.skill || 0));
    };
    const lowRhythm = (player) => statValue(player, 'rhythm') <= 3;
    const teamAverage = (players, field) => players.length
      ? players.reduce((total, player) => total + statValue(player, field), 0) / players.length
      : 0;
    const hasGoalkeeper = (player) => String(player.positions || '').split('/').map((pos) => pos.trim().toUpperCase()).includes('ARQ');
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
            <span>Ritmo ${teamAverage(players, 'rhythm').toFixed(1)}</span>
            <span>Tecnica ${teamAverage(players, 'technique').toFixed(1)}</span>
            <span>Juego en equipo ${teamAverage(players, 'teamwork').toFixed(1)}</span>
            <span>Mentalidad ${teamAverage(players, 'mentality').toFixed(1)}</span>
            <span>Regularidad ${teamAverage(players, 'regularity').toFixed(1)}</span>
          </div>
        </div>
      `;
    };

    const renderFormation = (players) => {
      const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
      return positions.map((position) => {
        const linePlayers = players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === position);
        const playerHtml = linePlayers.length
          ? linePlayers.map((player) => `
              <div class="formation-player">
                <strong>${escapeHtml(player.name)}</strong>
                <span>${escapeHtml(player.positions)} | ${escapeHtml(player.pace_label)} | ${formatSkill(player.skill)} pts</span>
              </div>
            `).join('')
          : '<span class="formation-player empty-slot">-</span>';

        return `
          <div class="formation-line">
            <div class="line-label">${position}</div>
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
            <span class="small-muted">${players.length}/${targetSize} jugadores | ${totalSkill.toFixed(1)} pts</span>
          </div>
          <div class="team-formation">${renderFormation(players)}</div>
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
