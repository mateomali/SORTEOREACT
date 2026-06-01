(() => {
  const textSource = document.querySelector('[data-finish-share-text]');
  if (!textSource || textSource.dataset.finishShareBound === '1') return;
  textSource.dataset.finishShareBound = '1';

  const getText = () => textSource.value || textSource.textContent || '';
  const copyText = async (text) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    document.body.appendChild(input);
    input.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(input);
    return copied;
  };

  const flashButton = (button, label) => {
    const original = button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = original;
    }, 1600);
  };

  const openAndroidShareSheet = (text) => {
    const isAndroid = /Android/i.test(navigator.userAgent || '');
    if (!isAndroid) return false;
    const encodedText = encodeURIComponent(text);
    window.location.href = `intent://share/#Intent;action=android.intent.action.SEND;type=text/plain;S.android.intent.extra.TEXT=${encodedText};end`;
    return true;
  };

  document.querySelector('[data-finish-share]')?.addEventListener('click', async (event) => {
    const button = event.currentTarget;
    const text = getText();
    if (navigator.share) {
      try {
        await navigator.share({ text });
        flashButton(button, 'Compartido');
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    if (openAndroidShareSheet(text)) {
      flashButton(button, 'Abriendo...');
      return;
    }
    await copyText(text);
    flashButton(button, 'Copiado');
  });

  document.querySelector('[data-finish-copy]')?.addEventListener('click', async (event) => {
    await copyText(getText());
    flashButton(event.currentTarget, 'Copiado');
  });
})();

(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('edit_formations') !== '1') return;

  const panel = document.getElementById('formaciones');
  if (!panel) return;

  window.requestAnimationFrame(() => {
    panel.scrollIntoView({ block: 'start', behavior: params.get('formation_saved') === '1' ? 'auto' : 'smooth' });
  });
})();

(() => {
  const form = document.getElementById('formaciones');
  const configScript = form?.querySelector('[data-finish-team-analysis-config]');
  const panel = form?.querySelector('[data-finish-team-analysis]');
  const pitchPreview = form?.querySelector('[data-finish-formation-pitch]');
  const buttons = form ? Array.from(form.querySelectorAll('[data-finish-analyze-teams]')) : [];
  if (!form || !configScript || !panel || !buttons.length || form.dataset.teamAnalysisReady === '1') return;
  form.dataset.teamAnalysisReady = '1';

  const config = JSON.parse(configScript.textContent || '{}');
  const players = Array.isArray(config.players) ? config.players : [];
  const playersById = new Map(players.map((player) => [String(player.id), player]));
  const numTeams = Math.max(2, Number(config.numTeams || 2));
  const playersPerTeam = Math.max(1, Number(config.playersPerTeam || Math.ceil(players.length / numTeams)));
  const maxDiff = Math.max(0.1, Number(config.maxDiff || 0.5));
  const positions = ['ARQ', 'DEF', 'LAT', 'MED', 'DEL'];
  const requiredPitchLines = ['ARQ', 'DEF', 'MED', 'DEL'];
  const fieldStatWeights = {
    DEF: { defense_physical: 0.31, rhythm: 0.18, technique: 0.13, teamwork: 0.16, mentality: 0.12, attack: 0.10 },
    LAT: { rhythm: 0.24, defense_physical: 0.19, technique: 0.17, attack: 0.14, teamwork: 0.15, mentality: 0.11 },
    MED: { technique: 0.24, rhythm: 0.22, defense_physical: 0.12, teamwork: 0.17, attack: 0.13, mentality: 0.12 },
    DEL: { attack: 0.31, rhythm: 0.20, technique: 0.17, teamwork: 0.14, mentality: 0.10, defense_physical: 0.08 },
  };
  const goalkeeperStatWeights = { goalkeeper_skill: 0.42, defense_physical: 0.14, rhythm: 0.10, technique: 0.10, teamwork: 0.14, mentality: 0.10 };
  const drawBalanceWeights = {
    general: 50,
    attack: 15,
    defense_physical: 15,
    rhythm: 18,
    technique: 5,
    teamwork: 8,
    mentality: 10,
    regularity: 5,
    goalkeeper_skill: 25,
  };
  const statLabels = {
    attack: 'ataque',
    defense_physical: 'solidez defensiva',
    rhythm: 'ritmo',
    technique: 'tecnica',
    teamwork: 'juego en equipo',
    mentality: 'mentalidad',
    regularity: 'regularidad',
    goalkeeper_skill: 'arquero',
  };
  const pendingRecommendations = new Map();

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[char]);

  const statValue = (player, field) => {
    const value = Number(player[field]);
    if (Number.isFinite(value) && value > 0) return value;
    if (field === 'regularity') return 3.5;
    if (field === 'mentality') return 3.0;
    if (field === 'rhythm') return String(player.pace || '').toLowerCase() === 'lento' ? 2.0 : 4.0;
    if (field === 'defense_physical') return 3.0;
    return Number(player.skill || 3.0);
  };
  const parsePositions = (player) => String(player.positions || '')
    .split('/')
    .map((position) => position.trim().toUpperCase())
    .filter((position, index, list) => positions.includes(position) && list.indexOf(position) === index)
    .slice(0, 2);
  const positionIndex = (player, position) => parsePositions(player).indexOf(position);
  const hasPosition = (player, position) => positionIndex(player, position) !== -1;
  const positionFitFactor = (player, position) => {
    const index = positionIndex(player, position);
    if (index === 0) return 1;
    if (index === 1) return 0.94;
    const naturalLines = parsePositions(player).map(pitchLine);
    return naturalLines.includes(pitchLine(position)) ? 0.86 : 0.72;
  };
  const pitchLine = (position) => (position === 'LAT' ? 'DEF' : position);
  const lowRhythm = (player) => statValue(player, 'rhythm') <= 3;
  const regularityAdjusted = (rating, player) => Math.max(1, Math.min(6, rating * (1 + ((statValue(player, 'regularity') - 3.5) / 50))));
  const positionRating = (player, position) => {
    const weights = position === 'ARQ' ? goalkeeperStatWeights : (fieldStatWeights[position] || fieldStatWeights.MED);
    const total = Object.entries(weights).reduce((sum, [field, weight]) => sum + (statValue(player, field) * weight), 0);
    return Math.round(regularityAdjusted(total, player) * positionFitFactor(player, position) * 10) / 10;
  };
  const bestNaturalPosition = (player) => parsePositions(player)
    .sort((left, right) => {
      const ratingDiff = positionRating(player, right) - positionRating(player, left);
      return ratingDiff !== 0 ? ratingDiff : positions.indexOf(left) - positions.indexOf(right);
    })[0] || 'MED';
  const bestNaturalRating = (player) => positionRating(player, bestNaturalPosition(player));
  const sum = (values) => values.reduce((total, value) => total + value, 0);
  const spread = (values) => values.length ? Math.max(...values) - Math.min(...values) : 0;
  const minItem = (items, valueGetter) => items.reduce((best, item) => (best === null || valueGetter(item) < valueGetter(best) ? item : best), null);
  const maxItem = (items, valueGetter) => items.reduce((best, item) => (best === null || valueGetter(item) > valueGetter(best) ? item : best), null);
  const lineLimit = (position) => {
    if (position === 'ARQ') return 1;
    if (position === 'DEF' || position === 'LAT') return Math.max(0, Math.floor(playersPerTeam / 4));
    return Math.max(0, Math.floor(playersPerTeam / 3));
  };

  const cardRating = (value) => {
    const clamped = Math.max(1, Math.min(6, Number(value) || 0));
    const anchors = [
      [1.0, 35.0],
      [2.5, 54.0],
      [3.0, 64.0],
      [3.2, 69.0],
      [3.5, 74.0],
      [3.8, 79.0],
      [4.0, 81.0],
      [4.4, 86.0],
      [4.5, 87.0],
      [5.0, 92.0],
      [5.2, 93.0],
      [5.3, 94.0],
      [6.0, 99.0],
    ];
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const [fromRating, fromOverall] = anchors[index];
      const [toRating, toOverall] = anchors[index + 1];
      if (clamped <= toRating) {
        const ratio = (clamped - fromRating) / (toRating - fromRating);
        return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
      }
    }
    return 99;
  };

  const cardTier = (rating) => {
    const overall = cardRating(rating);
    if (overall >= 90) return 'elite';
    if (overall >= 80) return 'gold';
    if (overall >= 65) return 'silver';
    return 'bronze';
  };

  const compactCardBackground = (tier) => ({
    bronze: 'assets/card-backgrounds/reference-compact-bronze.png',
    silver: 'assets/card-backgrounds/reference-compact-silver.png',
    gold: 'assets/card-backgrounds/reference-compact-gold.png',
    elite: 'assets/card-backgrounds/reference-compact-elite.png',
  }[tier] || 'assets/card-backgrounds/reference-compact-bronze.png');

  const cardRegularity = (player) => {
    const regularity = statValue(player, 'regularity');
    if (regularity >= 4.5) return ['up', 'Regularidad alta'];
    if (regularity < 3.0) return ['down', 'Regularidad baja'];
    return ['right', 'Regularidad normal'];
  };

  const groupFormationLines = (playersList) => positions.reduce((lines, position) => {
    lines[position] = playersList.filter((player) => (player.assigned_position || bestNaturalPosition(player)) === position);
    return lines;
  }, {});

  const formationLinePlayers = (lines, line) => {
    if (line !== 'DEF') return lines[line] || [];
    const lateral = lines.LAT || [];
    const defenders = lines.DEF || [];
    return lateral.length > 1
      ? [...lateral.slice(0, 1), ...defenders, ...lateral.slice(1)]
      : [...lateral, ...defenders];
  };

  const tacticLabel = (lines) => [
    (lines.DEF || []).length,
    (lines.LAT || []).length,
    (lines.MED || []).length,
    (lines.DEL || []).length,
  ].join('-');

  const renderFormationPlayer = (player) => {
    const position = positions.includes(player.assigned_position) ? player.assigned_position : bestNaturalPosition(player);
    const rating = positionRating(player, position);
    const [regularityForm, regularityLabel] = cardRegularity(player);
    const isNatural = hasPosition(player, position);
    const secondary = isNatural && position !== parsePositions(player)[0];
    const photoPath = player.photo_path || 'assets/players/default-player-silhouette.png';
    const photoClass = player.photo_custom ? 'is-custom' : 'is-default';
    const tier = cardTier(rating);
    const name = String(player.name || 'Jugador').trim();
    const veryLongName = name.length > 11 || name.split(/\s+/).some((part) => part.length > 8);
    const longName = name.length > 8 || name.includes(' ');
    const nameSize = veryLongName ? 'clamp(5.4px, 0.72vw, 9px)' : longName ? 'clamp(6px, 0.82vw, 10.5px)' : 'clamp(6.8px, 0.9vw, 12px)';
    return `
      <button
        class="sorteo-static-player-card formation-card-tier-${tier}${isNatural ? '' : ' is-out-of-position'}"
        type="button"
        draggable="true"
        data-finish-pitch-player
        data-static-player-key="${escapeHtml(player.id)}"
        data-assigned-position="${escapeHtml(position)}"
        data-player-skill="${escapeHtml(rating)}"
        style="--finish-card-bg: url('${escapeHtml(compactCardBackground(tier))}'); --finish-name-size: ${nameSize};"
        aria-label="Intercambiar ${escapeHtml(name)}"
      >
        <span class="sorteo-static-player-shade" aria-hidden="true"></span>
        <span class="sorteo-static-player-rating">
          <strong>${escapeHtml(cardRating(rating))}</strong>
          <span class="${!isNatural ? 'is-out-of-position' : secondary ? 'is-secondary-position' : ''}">${escapeHtml(position)}</span>
          <span class="sorteo-static-player-form is-${regularityForm}" title="${escapeHtml(regularityLabel)}" aria-label="${escapeHtml(regularityLabel)}"></span>
        </span>
        <span class="sorteo-static-player-photo ${photoClass}" aria-hidden="true"${player.photo_custom ? ' data-player-photo-frame="1"' : ''}><img src="${escapeHtml(photoPath)}" alt=""${player.photo_custom ? ' data-player-photo-oval="1"' : ''}></span>
        <strong class="sorteo-static-player-name">${escapeHtml(name)}</strong>
      </button>
    `;
  };

  const averageStat = (team, field) => team.players.length
    ? team.players.reduce((total, player) => total + statValue(player, field), 0) / team.players.length
    : 0;

  const renderTeamStats = (team) => {
    const goalkeeper = Math.max(0, ...team.players
      .filter((player) => (player.assigned_position || bestNaturalPosition(player)) === 'ARQ')
      .map((player) => statValue(player, 'goalkeeper_skill')));
    return [
      ['Arquero', goalkeeper || averageStat(team, 'attack')],
      ['Solidez', averageStat(team, 'defense_physical')],
      ['Ritmo', averageStat(team, 'rhythm')],
      ['Tecnica', averageStat(team, 'technique')],
      ['Equipo', averageStat(team, 'teamwork')],
      ['Mentalidad', averageStat(team, 'mentality')],
      ['Regularidad', averageStat(team, 'regularity')],
    ].map(([label, value]) => `<span>${escapeHtml(label)} ${Number(value).toFixed(1)}</span>`).join('');
  };

  const renderCanonicalPitch = (summaries) => `
    <div class="finish-sorteo-pitch-grid">
      ${summaries.map((team) => {
        const lines = groupFormationLines(team.players);
        return `
          <article class="team-card sorteo-team-card finish-sorteo-team" data-team-index="${escapeHtml(team.teamNumber - 1)}" data-sorteo-team-card="1">
            <div class="team-head">
              <div>
                <h4>${escapeHtml(team.label)}</h4>
                <p>${team.players.length} jugadores | ${team.players.filter(lowRhythm).length} lentos | ${escapeHtml(tacticLabel(lines))}</p>
              </div>
              <span class="finish-sorteo-team-score">${team.total.toFixed(1)} pts</span>
            </div>
            <div class="team-formation" data-static-team-formation data-static-formation-locked="1" data-team-number="${escapeHtml(team.teamNumber)}">
              ${requiredPitchLines.map((line) => {
                const linePlayers = formationLinePlayers(lines, line);
                const label = line === 'DEF' && (lines.LAT || []).length ? 'DEF/LAT' : line;
                const count = line === 'DEF' ? (lines.DEF || []).length + (lines.LAT || []).length : (lines[line] || []).length;
                const max = line === 'ARQ' ? 1 : (line === 'DEF' ? lineLimit('DEF') + lineLimit('LAT') : lineLimit(line));
                return `
                  <div class="formation-line sorteo-line-basic">
                    <div class="line-label">
                      <span>${escapeHtml(label)}</span>
                      <small>${escapeHtml(count)}/${escapeHtml(max)}</small>
                    </div>
                    <div class="line-players">
                      ${linePlayers.length ? linePlayers.map(renderFormationPlayer).join('') : '<span class="formation-player empty-slot">-</span>'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div class="sorteo-team-stats">${renderTeamStats(team)}</div>
          </article>
        `;
      }).join('')}
    </div>
  `;

  const renderPitchPreview = () => {
    if (!pitchPreview) return;
    pitchPreview.innerHTML = renderCanonicalPitch(buildSummaries(currentSnapshots()));
  };

  const teamLabelFromSelect = (teamNumber) => {
    const anyTeamSelect = form.querySelector('select[name^="player_team["]');
    const option = anyTeamSelect ? Array.from(anyTeamSelect.options).find((item) => Number(item.value) === Number(teamNumber)) : null;
    const text = option?.textContent?.trim() || `Equipo ${teamNumber}`;
    return /^equipo\b/i.test(text) ? text : `Equipo ${teamNumber} (${text})`;
  };

  const teamColorName = (teamNumber, fallbackLabel = '') => {
    const colorSelect = form.querySelector(`select[name="team_color[${CSS.escape(String(teamNumber))}]"]`);
    const selected = String(colorSelect?.value || '').trim().toUpperCase();
    if (selected) return selected;
    const match = String(fallbackLabel || '').match(/\(([^)]+)\)\s*$/);
    return match ? match[1].trim().toUpperCase() : '';
  };

  const teamIconColor = (colorName) => ({
    ROSA: '#ec4899',
    AZUL: '#2563eb',
    VERDE: '#16a34a',
    NEGRO: '#111827',
    NARANJA: '#f97316',
    CAMISADO: '#f8fafc',
    DESCAMISADO: '#d6d3d1',
  }[String(colorName || '').toUpperCase()] || '#047857');

  const renderTeamIcon = (team) => {
    const colorName = teamColorName(team.teamNumber, team.label);
    const color = teamIconColor(colorName);
    const label = colorName ? `Camiseta ${colorName}` : `Equipo ${team.teamNumber}`;
    return `<svg class="team-heart-icon finish-analysis-team-icon" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(label)}" focusable="false" fill="${escapeHtml(color)}" style="--team-heart-fill: ${escapeHtml(color)}"><path fill="${escapeHtml(color)}" style="fill: var(--team-heart-fill, ${escapeHtml(color)})" d="M8.2 3.5 12 5.1l3.8-1.6 4.2 3.1-2.2 3.5-1.6-.8V20H7.8V9.3l-1.6.8L4 6.6l4.2-3.1Z" /></svg>`;
  };

  const renderSwapTitle = (item) => `
    <span class="finish-analysis-swap-title">
      <span>${escapeHtml(item.leftPlayer.name)} ${renderTeamIcon(item.leftTeam)}</span>
      <span class="finish-analysis-swap-arrow" aria-hidden="true">↔</span>
      <span>${escapeHtml(item.rightPlayer.name)} ${renderTeamIcon(item.rightTeam)}</span>
    </span>
  `;

  const currentSnapshots = () => {
    const teams = Array.from({ length: numTeams }, (_, index) => ({
      teamNumber: index + 1,
      label: teamLabelFromSelect(index + 1),
      players: [],
    }));
    form.querySelectorAll('select[name^="player_team["]').forEach((teamSelect) => {
      const match = teamSelect.name.match(/\[(\d+)\]/);
      const player = match ? playersById.get(match[1]) : null;
      if (!player) return;
      const teamNumber = Number(teamSelect.value || 0);
      const positionSelect = form.querySelector(`select[name="player_position[${match[1]}]"]`);
      const assignedPosition = positions.includes(positionSelect?.value) ? positionSelect.value : bestNaturalPosition(player);
      if (teamNumber >= 1 && teamNumber <= teams.length) {
        teams[teamNumber - 1].players.push({ ...player, assigned_position: assignedPosition });
      }
    });
    return teams;
  };

  const bandIds = () => {
    if (players.length < 4) return { low: new Set(), high: new Set() };
    const sorted = [...players].sort((left, right) => {
      const diff = bestNaturalRating(left) - bestNaturalRating(right);
      return diff !== 0 ? diff : String(left.name || '').localeCompare(String(right.name || ''));
    });
    const bandSize = Math.max(1, Math.floor(players.length * 0.25));
    return {
      low: new Set(sorted.slice(0, bandSize).map((player) => String(player.id))),
      high: new Set(sorted.slice(-bandSize).map((player) => String(player.id))),
    };
  };

  const lowLiability = (player) => {
    const rating = bestNaturalRating(player);
    return Math.max(0, 2.5 - rating) * 2 + (rating < 2 ? (2 - rating) * 3 : 0);
  };

  const weakestPairScore = (team) => {
    const ratings = team.map(bestNaturalRating).sort((left, right) => left - right);
    return sum(ratings.slice(0, Math.max(1, Math.min(2, ratings.length))));
  };

  const analyzeTeam = (snapshot, bands) => {
    const statFields = Object.keys(statLabels);
    const lineCounts = Object.fromEntries(positions.map((position) => [position, 0]));
    const statTotals = Object.fromEntries(statFields.map((field) => [field, 0]));
    const outOfPosition = [];
    snapshot.players.forEach((player) => {
      const assigned = positions.includes(player.assigned_position) ? player.assigned_position : bestNaturalPosition(player);
      lineCounts[assigned] = (lineCounts[assigned] || 0) + 1;
      statFields.forEach((field) => {
        if (field === 'goalkeeper_skill' && !hasPosition(player, 'ARQ') && assigned !== 'ARQ') return;
        statTotals[field] += statValue(player, field);
      });
      if (!hasPosition(player, assigned)) outOfPosition.push(player);
    });
    const pitchCounts = {
      ARQ: lineCounts.ARQ || 0,
      DEF: (lineCounts.DEF || 0) + (lineCounts.LAT || 0),
      MED: lineCounts.MED || 0,
      DEL: lineCounts.DEL || 0,
    };
    return {
      ...snapshot,
      total: sum(snapshot.players.map((player) => positionRating(player, player.assigned_position || bestNaturalPosition(player)))),
      slow: snapshot.players.filter(lowRhythm).length,
      fast: snapshot.players.filter((player) => !lowRhythm(player)).length,
      statTotals,
      lineCounts,
      pitchCounts,
      missingLines: requiredPitchLines.filter((line) => (pitchCounts[line] || 0) <= 0),
      overloadedLines: positions.filter((line) => (lineCounts[line] || 0) > lineLimit(line)),
      outOfPosition,
      highBand: snapshot.players.filter((player) => bands.high.has(String(player.id))).length,
      lowBand: snapshot.players.filter((player) => bands.low.has(String(player.id))).length,
      floorScore: weakestPairScore(snapshot.players),
      liability: sum(snapshot.players.map(lowLiability)),
    };
  };

  const buildSummaries = (snapshots) => {
    const bands = bandIds();
    return snapshots.map((snapshot) => analyzeTeam(snapshot, bands));
  };

  const analysisCost = (summaries) => {
    let cost = spread(summaries.map((team) => team.total)) * drawBalanceWeights.general;
    Object.keys(statLabels).forEach((field) => {
      cost += spread(summaries.map((team) => team.statTotals[field] || 0)) * (drawBalanceWeights[field] || 0);
    });
    cost += spread(summaries.map((team) => team.slow)) * 20;
    cost += spread(summaries.map((team) => team.lowBand)) * 120;
    cost += spread(summaries.map((team) => team.highBand)) * 90;
    cost += spread(summaries.map((team) => team.floorScore)) * 55;
    cost += spread(summaries.map((team) => team.liability)) * 85;
    summaries.forEach((team) => {
      cost += team.missingLines.length * 240;
      cost += team.overloadedLines.length * 160;
      cost += Math.abs((team.lineCounts.ARQ || 0) - 1) * 260;
      cost += team.outOfPosition.length * 20;
    });
    return cost;
  };

  const issuesFor = (summaries) => {
    const issues = [];
    const totalGap = spread(summaries.map((team) => team.total));
    const strongest = maxItem(summaries, (team) => team.total);
    const weakest = minItem(summaries, (team) => team.total);
    if (strongest && weakest && totalGap > maxDiff) {
      issues.push(['alta', `Diferencia general de ${totalGap.toFixed(1)} puntos`, `${strongest.label} queda por encima de ${weakest.label}. El limite configurado es ${maxDiff.toFixed(1)}.`]);
    }
    summaries.forEach((team) => {
      if ((team.lineCounts.ARQ || 0) !== 1) issues.push(['alta', `${team.label} tiene ${(team.lineCounts.ARQ || 0)} arqueros`, 'El criterio del sorteo valida un arquero por equipo.']);
      if (team.missingLines.length) issues.push(['alta', `${team.label} no cubre ${team.missingLines.join(', ')}`, 'Cada equipo necesita arquero, defensa, medio y ataque representados.']);
      if (team.overloadedLines.length) issues.push(['media', `${team.label} carga demasiado ${team.overloadedLines.join(', ')}`, 'El sorteo limita acumulacion por linea para evitar equipos partidos.']);
      if (team.outOfPosition.length) issues.push(['media', `${team.label} tiene ${team.outOfPosition.length} fuera de posicion`, team.outOfPosition.slice(0, 3).map((player) => player.name).join(', ')]);
    });
    if (spread(summaries.map((team) => team.slow)) > 1) {
      const mostSlow = maxItem(summaries, (team) => team.slow);
      const leastSlow = minItem(summaries, (team) => team.slow);
      issues.push(['media', `Ritmo lento desparejo (${mostSlow.slow - leastSlow.slow} de diferencia)`, `${mostSlow.label} concentra ${mostSlow.slow} lentos y ${leastSlow.label} tiene ${leastSlow.slow}.`]);
    }
    Object.entries(statLabels).forEach(([field, label]) => {
      const values = summaries.map((team) => team.players.length ? (team.statTotals[field] || 0) / team.players.length : 0);
      const gap = spread(values);
      if (gap <= (field === 'goalkeeper_skill' ? 0.8 : 0.55)) return;
      const strong = summaries[values.indexOf(Math.max(...values))];
      const weak = summaries[values.indexOf(Math.min(...values))];
      issues.push([field === 'goalkeeper_skill' ? 'alta' : 'media', `Brecha de ${label}: ${gap.toFixed(1)}`, `${weak.label} queda corto frente a ${strong.label}.`]);
    });
    if (spread(summaries.map((team) => team.highBand)) > 0) {
      const strong = maxItem(summaries, (team) => team.highBand);
      const weak = minItem(summaries, (team) => team.highBand);
      issues.push(['media', 'Jugadores fuertes concentrados', `${strong.label} tiene ${strong.highBand}; ${weak.label} tiene ${weak.highBand}.`]);
    }
    if (spread(summaries.map((team) => team.lowBand)) > 0) {
      const loaded = maxItem(summaries, (team) => team.lowBand);
      const light = minItem(summaries, (team) => team.lowBand);
      issues.push(['media', 'Jugadores mas flojos concentrados', `${loaded.label} tiene ${loaded.lowBand}; ${light.label} tiene ${light.lowBand}.`]);
    }
    return issues.slice(0, 8);
  };

  const swapRecommendations = (snapshots, summaries) => {
    const baseCost = analysisCost(summaries);
    const candidates = [];
    for (let left = 0; left < snapshots.length - 1; left += 1) {
      for (let right = left + 1; right < snapshots.length; right += 1) {
        snapshots[left].players.forEach((leftPlayer, leftIndex) => {
          snapshots[right].players.forEach((rightPlayer, rightIndex) => {
            const next = snapshots.map((team) => ({ ...team, players: [...team.players] }));
            next[left].players[leftIndex] = rightPlayer;
            next[right].players[rightIndex] = leftPlayer;
            const nextSummaries = buildSummaries(next);
            const improvement = baseCost - analysisCost(nextSummaries);
            if (improvement <= Math.max(12, baseCost * 0.03)) return;
            candidates.push({
              leftPlayer,
              rightPlayer,
              leftTeam: summaries[left],
              rightTeam: summaries[right],
              nextGap: spread(nextSummaries.map((team) => team.total)),
              improvement,
            });
          });
        });
      }
    }
    return candidates.sort((left, right) => right.improvement - left.improvement).slice(0, 3);
  };

  const renderAnalysis = (options = {}) => {
    const snapshots = currentSnapshots();
    const summaries = buildSummaries(snapshots);
    const issues = issuesFor(summaries);
    const recommendations = swapRecommendations(snapshots, summaries);
    pendingRecommendations.clear();
    recommendations.forEach((item, index) => {
      pendingRecommendations.set(String(index), item);
    });
    panel.hidden = false;
    panel.innerHTML = `
      <div class="manual-analysis-head">
        <strong>Analisis de equipos</strong>
        <span>${options.applied ? 'Cambio aplicado. ' : ''}Diferencia general ${spread(summaries.map((team) => team.total)).toFixed(1)} / limite ${maxDiff.toFixed(1)}</span>
      </div>
      <div class="manual-analysis-findings">
        <strong>Puntos flojos</strong>
        ${issues.length
          ? `<ul>${issues.map(([severity, title, detail]) => `<li><span>${escapeHtml(severity)}</span><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div></li>`).join('')}</ul>`
          : '<p>No aparecen falencias fuertes con los criterios del sorteo.</p>'}
      </div>
      <div class="manual-analysis-findings">
        <strong>Cambios sugeridos</strong>
        ${recommendations.length
          ? `<ul>${recommendations.map((item, index) => `<li><span aria-hidden="true">↔</span><div><strong>${renderSwapTitle(item)}</strong><p>Baja la diferencia general proyectada a ${item.nextGap.toFixed(1)} y mejora el balance global.</p><button class="btn btn-muted finish-analysis-apply" type="button" data-finish-apply-swap="${index}" data-left-player="${escapeHtml(item.leftPlayer.id)}" data-right-player="${escapeHtml(item.rightPlayer.id)}">Aplicar cambio</button></div></li>`).join('')}</ul>`
          : '<p>No hay un intercambio simple que mejore claramente el balance.</p>'}
      </div>
    `;
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const syncFormationRowLocation = (playerId) => {
    const row = form.querySelector(`[data-finish-formation-row][data-player-id="${CSS.escape(String(playerId))}"]`);
    const teamSelect = form.querySelector(`select[name="player_team[${CSS.escape(String(playerId))}]"]`);
    const teamNumber = Number(teamSelect?.value || 0);
    const targetBody = form.querySelector(`[data-finish-formation-team="${CSS.escape(String(teamNumber))}"] tbody`);
    if (row && targetBody && row.parentElement !== targetBody) {
      targetBody.appendChild(row);
    }
  };

  const swapPlayersById = (leftId, rightId) => {
    if (!leftId || !rightId || String(leftId) === String(rightId)) return false;
    const leftTeam = form.querySelector(`select[name="player_team[${CSS.escape(String(leftId))}]"]`);
    const rightTeam = form.querySelector(`select[name="player_team[${CSS.escape(String(rightId))}]"]`);
    const leftPosition = form.querySelector(`select[name="player_position[${CSS.escape(String(leftId))}]"]`);
    const rightPosition = form.querySelector(`select[name="player_position[${CSS.escape(String(rightId))}]"]`);
    if (!leftTeam || !rightTeam) return false;
    const nextLeftTeam = rightTeam.value;
    const nextRightTeam = leftTeam.value;
    const nextLeftPosition = rightPosition?.value;
    const nextRightPosition = leftPosition?.value;
    leftTeam.value = nextLeftTeam;
    rightTeam.value = nextRightTeam;
    if (leftPosition && positions.includes(nextLeftPosition)) leftPosition.value = nextLeftPosition;
    if (rightPosition && positions.includes(nextRightPosition)) rightPosition.value = nextRightPosition;
    syncFormationRowLocation(leftId);
    syncFormationRowLocation(rightId);
    renderPitchPreview();
    panel.hidden = true;
    panel.innerHTML = '';
    return true;
  };

  const applySwap = (recommendation) => {
    const leftId = String(recommendation.leftPlayer.id);
    const rightId = String(recommendation.rightPlayer.id);
    if (!swapPlayersById(leftId, rightId)) return;
    window.requestAnimationFrame(() => {
      renderAnalysis({ applied: true });
    });
  };

  renderPitchPreview();
  buttons.forEach((button) => button.addEventListener('click', renderAnalysis));
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-finish-apply-swap]');
    if (!button) return;
    const recommendation = pendingRecommendations.get(String(button.getAttribute('data-finish-apply-swap')));
    if (recommendation) {
      applySwap(recommendation);
    }
  });
  pitchPreview?.addEventListener('dragstart', (event) => {
    const card = event.target.closest('[data-finish-pitch-player]');
    if (!card) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(card.getAttribute('data-static-player-key') || ''));
    card.classList.add('is-dragging');
  });
  pitchPreview?.addEventListener('dragend', () => {
    pitchPreview.querySelectorAll('.is-dragging, .is-drag-over').forEach((item) => item.classList.remove('is-dragging', 'is-drag-over'));
  });
  pitchPreview?.addEventListener('dragover', (event) => {
    const card = event.target.closest('[data-finish-pitch-player]');
    if (!card) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    pitchPreview.querySelectorAll('.is-drag-over').forEach((item) => {
      if (item !== card) item.classList.remove('is-drag-over');
    });
    card.classList.add('is-drag-over');
  });
  pitchPreview?.addEventListener('drop', (event) => {
    const card = event.target.closest('[data-finish-pitch-player]');
    if (!card) return;
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    const targetId = card.getAttribute('data-static-player-key');
    swapPlayersById(sourceId, targetId);
  });
  form.addEventListener('change', (event) => {
    if (event.target.matches('select[name^="player_team["], select[name^="player_position["]')) {
      if (event.target.matches('select[name^="player_team["]')) {
        const match = event.target.name.match(/\[(\d+)\]/);
        if (match) syncFormationRowLocation(match[1]);
      }
      renderPitchPreview();
      panel.hidden = true;
      panel.innerHTML = '';
    }
  });
})();
