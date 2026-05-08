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

    const playerCardRating = (value) => {
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
    };
    const playerCardRatingHtml = (value, label = 'GEN') => `
      <span class="player-card-rating" title="Puntaje tarjeta">
        <strong>${playerCardRating(value)}</strong>
        <span>${escapeHtml(label)}</span>
      </span>
    `;

    const teamTotalSkill = (players) => players.reduce((total, player) => total + Number(player.skill || 0), 0);
    const teamTacticLabel = (players) => {
      const counts = ['DEF', 'MED', 'DEL'].map((position) => (
        players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === position).length
      ));
      return counts.join('-');
    };
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
    const playerPositions = (player) => String(player.positions || '')
      .split('/')
      .map((pos) => pos.trim().toUpperCase())
      .filter(Boolean);
    const weightedPositionRating = (player, weights) => (
      Object.entries(weights).reduce((total, [field, weight]) => total + (statValue(player, field) * weight), 0)
    );
    const applyRegularityAdjustment = (rating, player) => {
      const factor = 1 + ((statValue(player, 'regularity') - 3.5) / 50);
      return Math.max(1, Math.min(6, rating * factor));
    };
    const adjustedPositionRating = (player, assignedPosition) => {
      const position = String(assignedPosition || '').toUpperCase();
      const generalRating = Number(player.skill || 0);
      if (!position || playerPositions(player).includes(position)) {
        return Math.max(1, Math.min(6, generalRating));
      }
      let rating = generalRating;
      if (position === 'ARQ') {
        const goalkeeperSkill = playerPositions(player).includes('ARQ') ? statValue(player, 'goalkeeper_skill') : 2.0;
        rating = (goalkeeperSkill * 0.42)
          + (statValue(player, 'defense_physical') * 0.14)
          + (statValue(player, 'rhythm') * 0.10)
          + (statValue(player, 'technique') * 0.10)
          + (statValue(player, 'teamwork') * 0.14)
          + (statValue(player, 'mentality') * 0.10);
      } else if (position === 'DEF') {
        rating = weightedPositionRating(player, {
          defense_physical: 0.60,
          rhythm: 0.12,
          technique: 0.08,
          teamwork: 0.08,
          mentality: 0.08,
          attack: 0.04,
        });
      } else if (position === 'MED') {
        rating = weightedPositionRating(player, {
          technique: 0.22,
          teamwork: 0.20,
          rhythm: 0.18,
          mentality: 0.14,
          defense_physical: 0.13,
          attack: 0.13,
        });
      } else if (position === 'DEL') {
        rating = weightedPositionRating(player, {
          attack: 0.60,
          technique: 0.12,
          rhythm: 0.10,
          mentality: 0.08,
          teamwork: 0.06,
          defense_physical: 0.04,
        });
      }
      return applyRegularityAdjustment(rating, player);
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
            <span>Ritmo ${teamAverage(players, 'rhythm').toFixed(1)}</span>
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
        const linePlayers = players.filter((player) => (player.assigned_position || player.primary_position || 'MED') === position);
        const playerHtml = linePlayers.length
          ? linePlayers.map((player) => {
            const adjustedRating = adjustedPositionRating(player, position);
            return `
              <div class="formation-player" draggable="false" data-static-formation-player data-static-player-key="${escapeHtml(player.id || player.name)}" data-team-number="${teamNumber}" data-assigned-position="${position}" data-player-skill="${Number(player.skill || 0)}">
                ${playerCardRatingHtml(adjustedRating, position)}
                <strong>${escapeHtml(player.name)}</strong>
                <span class="formation-player-meta">${ratingWithStar(player.skill)}</span>
              </div>
            `;
          }).join('')
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
              <span class="small-muted">${players.length}/${targetSize} jugadores</span>
            </div>
          <div class="formation-title-row">
            <div class="formation-total-title" data-formation-total-title><span>Base</span><strong>${totalSkill.toFixed(1)} pts</strong></div>
            <div class="formation-total-title formation-tactic-title"><span>TACTICA</span><strong data-formation-tactic>${teamTacticLabel(players)}</strong></div>
          </div>
          <div class="team-formation" data-static-team-formation data-static-formation-locked="1" data-team-number="${teamNumber}">${renderFormation(players, teamNumber)}</div>
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
