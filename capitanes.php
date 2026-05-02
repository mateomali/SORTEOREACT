<?php
declare(strict_types=1);

require_once __DIR__ . '/lib/helpers.php';
require_once __DIR__ . '/lib/repository.php';

$pdo = db();
$matchId = isset($_GET['match_id']) ? (int) $_GET['match_id'] : 0;
$teamView = isset($_GET['team']) ? (int) $_GET['team'] : 0;
$captainToken = trim((string) ($_GET['token'] ?? ''));
$isCaptainView = in_array($teamView, [1, 2], true) && $captainToken !== '';
$viewMode = (string) ($_GET['view'] ?? '');

if (!$isCaptainView) {
    require_admin();
}

function absolute_url(string $path): string
{
    if (APP_PUBLIC_URL !== '') {
        return rtrim(APP_PUBLIC_URL, '/') . '/' . ltrim($path, '/');
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? '127.0.0.1:8000');
    $base = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
    return $scheme . '://' . $host . ($base === '' ? '' : $base) . '/' . ltrim($path, '/');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'start_draft') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    $captain1 = (int) ($_POST['captain1'] ?? 0);
    $captain2 = (int) ($_POST['captain2'] ?? 0);
    $participants = repo_match_participants_basic($matchId);
    $participantIds = array_map(static fn(array $p): int => (int) $p['id'], $participants);

    if ($matchId <= 0 || !$participants) {
        flash('error', 'Selecciona un partido con convocados.');
        redirect('capitanes.php');
    }
    if (count($participants) % 2 !== 0) {
        flash('error', 'El modo capitanes requiere una cantidad par de jugadores.');
        redirect('capitanes.php?match_id=' . $matchId);
    }
    if ($captain1 <= 0 || $captain2 <= 0 || $captain1 === $captain2 || !in_array($captain1, $participantIds, true) || !in_array($captain2, $participantIds, true)) {
        flash('error', 'Elige dos capitanes distintos dentro de los convocados.');
        redirect('capitanes.php?match_id=' . $matchId);
    }

    $captainSkills = [];
    foreach ($participants as $participant) {
        $pid = (int) $participant['id'];
        if ($pid === $captain1 || $pid === $captain2) {
            $captainSkills[$pid] = (float) $participant['skill'];
        }
    }
    $firstTeam = ($captainSkills[$captain2] ?? 0.0) < ($captainSkills[$captain1] ?? 0.0) ? 2 : 1;

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
        $pdo->prepare(
            'UPDATE match_players
             SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0
             WHERE match_id = :mid'
        )->execute(['mid' => $matchId]);

        $token1 = bin2hex(random_bytes(16));
        $token2 = bin2hex(random_bytes(16));
        $pdo->prepare(
            'INSERT INTO captain_drafts (match_id, captain1_player_id, captain2_player_id, captain1_token, captain2_token, current_team, status, started_at)
             VALUES (:mid, :c1, :c2, :t1, :t2, :current_team, "active", NOW())'
        )->execute(['mid' => $matchId, 'c1' => $captain1, 'c2' => $captain2, 't1' => $token1, 't2' => $token2, 'current_team' => $firstTeam]);
        $pdo->prepare(
            'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
             VALUES (:mid, :pid, :team, :picker, :pick_order)'
        )->execute(['mid' => $matchId, 'pid' => $captain1, 'team' => 1, 'picker' => $captain1, 'pick_order' => 1]);
        $pdo->prepare(
            'INSERT INTO captain_picks (match_id, player_id, team_number, picked_by_player_id, pick_order)
             VALUES (:mid, :pid, :team, :picker, :pick_order)'
        )->execute(['mid' => $matchId, 'pid' => $captain2, 'team' => 2, 'picker' => $captain2, 'pick_order' => 2]);
        $pdo->prepare('UPDATE match_players SET team_number = 1 WHERE match_id = :mid AND player_id = :pid')
            ->execute(['mid' => $matchId, 'pid' => $captain1]);
        $pdo->prepare('UPDATE match_players SET team_number = 2 WHERE match_id = :mid AND player_id = :pid')
            ->execute(['mid' => $matchId, 'pid' => $captain2]);
        $pdo->prepare('UPDATE matches SET status = "programado", draw_mode = "captains", draw_started_at = NOW(), draw_completed_at = NULL, finalized_at = NULL WHERE id = :mid')->execute(['mid' => $matchId]);

        $pdo->commit();
        flash('success', 'Modo capitanes iniciado.');
        redirect('capitanes.php?match_id=' . $matchId);
    } catch (Throwable $e) {
        $pdo->rollBack();
        flash('error', 'No se pudo iniciar: ' . $e->getMessage());
        redirect('capitanes.php?match_id=' . $matchId);
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'reset_draft') {
    $matchId = (int) ($_POST['match_id'] ?? 0);
    if ($matchId > 0) {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('DELETE FROM captain_picks WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare('DELETE FROM captain_drafts WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare('DELETE FROM match_teams WHERE match_id = :mid')->execute(['mid' => $matchId]);
            $pdo->prepare(
                'UPDATE match_players
                 SET team_number = NULL, assigned_position = NULL, is_goalkeeper = 0
                 WHERE match_id = :mid'
            )->execute(['mid' => $matchId]);
            $pdo->prepare('UPDATE matches SET status = "programado", draw_mode = "none", draw_started_at = NULL, draw_completed_at = NULL, finalized_at = NULL WHERE id = :mid')->execute(['mid' => $matchId]);
            $pdo->commit();
            flash('success', 'Draft reiniciado.');
        } catch (Throwable $e) {
            $pdo->rollBack();
            flash('error', 'No se pudo reiniciar: ' . $e->getMessage());
        }
    }
    redirect($matchId > 0 ? 'capitanes.php?match_id=' . $matchId : 'capitanes.php');
}

$matches = repo_matches("status IN ('programado','sorteado')");
$selectedMatch = $matchId > 0 ? repo_match_by_id($matchId) : null;
$participants = $selectedMatch ? repo_match_participants_basic((int) $selectedMatch['id']) : [];
$draft = null;
if ($selectedMatch) {
    $stmt = $pdo->prepare('SELECT * FROM captain_drafts WHERE match_id = :mid LIMIT 1');
    $stmt->execute(['mid' => (int) $selectedMatch['id']]);
    $draft = $stmt->fetch() ?: null;
    if ($draft && ((string) ($draft['captain1_token'] ?? '') === '' || (string) ($draft['captain2_token'] ?? '') === '')) {
        $draft['captain1_token'] = (string) ($draft['captain1_token'] ?: bin2hex(random_bytes(16)));
        $draft['captain2_token'] = (string) ($draft['captain2_token'] ?: bin2hex(random_bytes(16)));
        $pdo->prepare(
            'UPDATE captain_drafts SET captain1_token = :t1, captain2_token = :t2 WHERE match_id = :mid'
        )->execute([
            'mid' => (int) $selectedMatch['id'],
            't1' => $draft['captain1_token'],
            't2' => $draft['captain2_token'],
        ]);
    }
}

$captain1Link = '';
$captain2Link = '';
$captain1Whatsapp = '';
$captain2Whatsapp = '';
if ($selectedMatch && $draft) {
    $captain1Link = absolute_url('capitanes.php?match_id=' . (int) $selectedMatch['id'] . '&team=1&token=' . urlencode((string) ($draft['captain1_token'] ?? '')));
    $captain2Link = absolute_url('capitanes.php?match_id=' . (int) $selectedMatch['id'] . '&team=2&token=' . urlencode((string) ($draft['captain2_token'] ?? '')));
    $matchLabel = (string) ($selectedMatch['title'] ?: ('Partido #' . $selectedMatch['id']));
    $captain1WhatsappText = "Link para elegir equipo como Capitan 1\n" . $matchLabel . "\n\n" . $captain1Link;
    $captain2WhatsappText = "Link para elegir equipo como Capitan 2\n" . $matchLabel . "\n\n" . $captain2Link;
    $captain1Whatsapp = 'https://wa.me/?text=' . rawurlencode($captain1WhatsappText);
    $captain2Whatsapp = 'https://wa.me/?text=' . rawurlencode($captain2WhatsappText);
}

$title = 'Capitanes | ' . APP_NAME;
$activePage = 'capitanes.php';
require __DIR__ . '/includes/header.php';
?>

<section class="page-head">
  <div>
    <h1><?= $isCaptainView ? 'Eleccion de capitan' : 'Modo capitanes' ?></h1>
    <p class="small-muted"><?= $isCaptainView ? 'Espera tu turno y elige un jugador.' : 'Draft remoto por turnos sobre los convocados del partido.' ?></p>
  </div>
</section>

<?php if (!$isCaptainView): ?>
<section class="card mb-3.5">
  <form method="get" class="form-grid">
    <div class="form-row">
      <label>Seleccionar partido</label>
      <select name="match_id" onchange="this.form.submit()">
        <option value="">Elegir...</option>
        <?php foreach ($matches as $m): ?>
          <option value="<?= (int) $m['id'] ?>" <?= selected_attr($selectedMatch && (int) $selectedMatch['id'] === (int) $m['id']) ?>>
            <?= h(date('d/m H:i', strtotime((string) $m['match_date'])) . ' - ' . ($m['title'] ?: ('Partido #' . $m['id'])) . ' [' . $m['participants_count'] . ' jugadores]') ?>
          </option>
        <?php endforeach; ?>
      </select>
    </div>
  </form>
</section>
<?php endif; ?>

<?php if ($selectedMatch && !$draft && !$isCaptainView): ?>
  <section class="card">
    <h3>Iniciar draft</h3>
    <form method="post" class="form-grid">
      <input type="hidden" name="action" value="start_draft">
      <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
      <div class="form-row">
        <label>Capitan equipo 1</label>
        <select name="captain1" required>
          <option value="">Elegir...</option>
          <?php foreach ($participants as $p): ?>
            <option value="<?= (int) $p['id'] ?>"><?= h((string) $p['name'] . ' - ' . $p['positions'] . ' - ' . skill_label((float) $p['skill'])) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="form-row">
        <label>Capitan equipo 2</label>
        <select name="captain2" required>
          <option value="">Elegir...</option>
          <?php foreach ($participants as $p): ?>
            <option value="<?= (int) $p['id'] ?>"><?= h((string) $p['name'] . ' - ' . $p['positions'] . ' - ' . skill_label((float) $p['skill'])) ?></option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="btn-row">
        <button class="btn btn-primary" type="submit">Iniciar modo capitanes</button>
      </div>
    </form>
  </section>
<?php elseif ($selectedMatch && $draft): ?>
  <?php if (!$isCaptainView): ?>
  <section class="card mb-3.5">
    <h3><?= h((string) ($selectedMatch['title'] ?: ('Partido #' . $selectedMatch['id']))) ?></h3>
    <p class="small-muted">Pasa estos links a cada capitan. Cada link tiene un token propio y solo permite elegir para ese equipo.</p>
    <div class="grid cols-2 mb-3">
      <div class="stat-box">
        <div class="label">Link capitan 1</div>
        <input type="text" readonly value="<?= h($captain1Link) ?>" onclick="this.select()">
        <div class="btn-row captain-link-actions">
          <a class="btn btn-primary" href="<?= h($captain1Link) ?>">Abrir</a>
          <a class="btn btn-whatsapp" href="<?= h($captain1Whatsapp) ?>" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
      <div class="stat-box">
        <div class="label">Link capitan 2</div>
        <input type="text" readonly value="<?= h($captain2Link) ?>" onclick="this.select()">
        <div class="btn-row captain-link-actions">
          <a class="btn btn-warning" href="<?= h($captain2Link) ?>">Abrir</a>
          <a class="btn btn-whatsapp" href="<?= h($captain2Whatsapp) ?>" target="_blank" rel="noopener">WhatsApp</a>
        </div>
      </div>
    </div>
    <div class="btn-row">
      <a class="btn btn-muted" href="finalizar_partido.php?match_id=<?= (int) $selectedMatch['id'] ?>">Ver equipos</a>
      <form method="post" class="inline">
        <input type="hidden" name="action" value="reset_draft">
        <input type="hidden" name="match_id" value="<?= (int) $selectedMatch['id'] ?>">
        <button class="btn btn-danger" type="submit" data-confirm="Reiniciar el draft de capitanes?">Reiniciar</button>
      </form>
    </div>
  </section>
  <?php endif; ?>

  <section class="captain-board" id="formacion" data-match-id="<?= (int) $selectedMatch['id'] ?>" data-team-view="<?= in_array($teamView, [1, 2], true) ? $teamView : 0 ?>" data-token="<?= h($captainToken) ?>" data-view-mode="<?= h($viewMode) ?>">
    <div class="captain-waiting-panel" id="captainWaitingPanel" hidden>
      <div class="captain-waiting-card" role="status" aria-live="polite">
        <span class="captain-waiting-kicker">Modo capitanes</span>
        <strong>ESPERANDO JUGADOR</strong>
        <span id="captainWaitingText">Aguardando la eleccion del otro capitan.</span>
      </div>
    </div>

    <div class="captain-status card">
      <h3 id="draftTitle">Cargando...</h3>
      <p id="draftTurn" class="small-muted"></p>
      <div id="draftMessage" class="flash flash-info hidden"></div>
    </div>

    <div class="grid cols-2 captain-teams-grid mt-3.5">
      <article class="card" data-captain-team-card="1">
        <h3 id="team1Title">Equipo 1</h3>
        <div id="team1List" class="captain-team-list"></div>
      </article>
      <article class="card" data-captain-team-card="2">
        <h3 id="team2Title">Equipo 2</h3>
        <div id="team2List" class="captain-team-list"></div>
      </article>
    </div>

    <section class="card mt-3.5">
      <h3>Jugadores disponibles</h3>
      <div id="availablePots" class="captain-pots"></div>
    </section>
  </section>

  <script>
    (() => {
      const board = document.querySelector('.captain-board');
      const matchId = parseInt(board.dataset.matchId, 10);
      const teamView = parseInt(board.dataset.teamView, 10);
      const captainToken = board.dataset.token || '';
      const viewMode = board.dataset.viewMode || '';
      const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
      let state = null;

      const escapeHtml = (value) => String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

      const formatSkill = (value) => {
        const number = Number(value || 0);
        return `${Number.isInteger(number) ? String(number) : number.toFixed(1)}⭐`;
      };
      const playerMeta = (p) => `${escapeHtml(p.positions)} | ${escapeHtml(p.pace_label)} | ${formatSkill(p.skill)}`;
      const teamTotalSkill = (teamNumber) => {
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        return players.reduce((total, player) => total + Number(player.skill || 0), 0);
      };

      const updateWaitingPanel = () => {
        const panel = document.getElementById('captainWaitingPanel');
        const text = document.getElementById('captainWaitingText');
        if (!panel || !state || !state.ok) return;

        const isWaiting = captainToken !== ''
          && (teamView === 1 || teamView === 2)
          && state.draft.status === 'active'
          && state.draft.current_team !== teamView;

        panel.hidden = !isWaiting;
        if (isWaiting && text) {
          text.textContent = state.draft.current_captain
            ? `Turno de ${state.draft.current_captain}.`
            : 'Aguardando la eleccion del otro capitan.';
        }
      };

      const formationPresets = (playersCount) => {
        const fieldPlayers = Math.max(0, playersCount - 1);
        const balancedDef = Math.max(1, Math.floor(fieldPlayers / 3));
        const balancedMed = Math.max(1, Math.ceil(fieldPlayers / 3));
        const balancedDel = Math.max(0, fieldPlayers - balancedDef - balancedMed);
        const offensiveDef = Math.max(1, Math.floor(fieldPlayers / 4));
        const offensiveDel = Math.max(1, Math.ceil(fieldPlayers / 3));
        const offensiveMed = Math.max(0, fieldPlayers - offensiveDef - offensiveDel);
        const defensiveDef = Math.max(1, Math.ceil(fieldPlayers / 3));
        const defensiveDel = Math.max(1, Math.floor(fieldPlayers / 4));
        const defensiveMed = Math.max(0, fieldPlayers - defensiveDef - defensiveDel);
        return [
          { name: `Equilibrada ${balancedDef}-${balancedMed}-${balancedDel}`, counts: { DEF: balancedDef, MED: balancedMed, DEL: balancedDel } },
          { name: `Ofensiva ${offensiveDef}-${offensiveMed}-${offensiveDel}`, counts: { DEF: offensiveDef, MED: offensiveMed, DEL: offensiveDel } },
          { name: `Defensiva ${defensiveDef}-${defensiveMed}-${defensiveDel}`, counts: { DEF: defensiveDef, MED: defensiveMed, DEL: defensiveDel } },
        ];
      };

      const applyFormationPreset = (container, players, presetIndex) => {
        const preset = formationPresets(players.length)[presetIndex];
        if (!preset) return;
        const selects = Array.from(container.querySelectorAll('.captain-position-select'));
        const goalkeeper = players.find(p => String(p.positions).split('/').includes('ARQ')) || players[0];
        const remaining = players.filter(p => p.id !== goalkeeper.id);
        const assignments = {};
        if (goalkeeper) {
          assignments[goalkeeper.id] = 'ARQ';
        }
        for (const line of ['DEF', 'MED', 'DEL']) {
          let needed = preset.counts[line] || 0;
          const preferred = remaining.filter(p => !assignments[p.id] && String(p.positions).split('/').includes(line));
          const fallback = remaining.filter(p => !assignments[p.id] && !preferred.includes(p));
          for (const player of [...preferred, ...fallback]) {
            if (needed <= 0) break;
            assignments[player.id] = line;
            needed--;
          }
        }
        remaining.filter(p => !assignments[p.id]).forEach(p => {
          assignments[p.id] = p.primary_position && p.primary_position !== 'ARQ' ? p.primary_position : 'MED';
        });
        selects.forEach(select => {
          const next = assignments[parseInt(select.dataset.playerId, 10)];
          if (next) select.value = next;
        });
        renderFormationLines(container, players);
      };

      const currentPlayerPosition = (container, player) => {
        const select = container.querySelector(`.captain-position-select[data-player-id="${player.id}"]`);
        return select ? select.value : (player.assigned_position || player.primary_position || 'MED');
      };

      const renderFormationLines = (container, players) => {
        const field = container.querySelector('.captain-formation-field');
        if (!field) return;
        field.innerHTML = positions.map(pos => {
          const linePlayers = players.filter(player => currentPlayerPosition(container, player) === pos);
          return `
            <div class="formation-line captain-formation-line">
              <div class="line-label">${pos}</div>
              <div class="line-players">
                ${linePlayers.length ? linePlayers.map(player => `
                  <div class="formation-player captain-formation-player">
                    <strong>${escapeHtml(player.name)}</strong>
                    <span>${formatSkill(player.skill)}</span>
                    <select class="captain-position-select" data-player-id="${player.id}">
                      ${positions.map(option => `<option value="${option}" ${currentPlayerPosition(container, player) === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                  </div>
                `).join('') : '<span class="formation-player empty-slot">-</span>'}
              </div>
            </div>
          `;
        }).join('');
        field.querySelectorAll('.captain-position-select').forEach(select => {
          select.addEventListener('change', () => renderFormationLines(container, players));
        });
      };

      const renderFormationEditor = (teamNumber, players) => `
        <div class="captain-formation-tools">
          <label>Formacion</label>
          <select data-formation-preset="${teamNumber}">
            <option value="">Personalizada</option>
            ${formationPresets(players.length).map((preset, index) => `<option value="${index}">${escapeHtml(preset.name)}</option>`).join('')}
          </select>
        </div>
        <div class="team-formation captain-formation-field"></div>
        <button class="btn btn-primary captain-save-formation" type="button" data-save-formation="${teamNumber}">Guardar formacion</button>
      `;

      const renderReadonlyTeam = (players) => players.map(p => `
        <div class="captain-player picked">
          <strong>${escapeHtml(p.name)}</strong>
          <span>${playerMeta(p)}</span>
          <span>Ubicacion: ${escapeHtml(p.assigned_position || p.primary_position)}</span>
        </div>
      `).join('') || '<p class="small-muted">Sin jugadores.</p>';

      const renderTeam = (teamNumber, containerId) => {
        const container = document.getElementById(containerId);
        const players = state.teams[String(teamNumber)] || state.teams[teamNumber] || [];
        const canEditFormation = captainToken !== ''
          && teamView === teamNumber
          && state.draft.status === 'completed'
          && state.match.can_edit_formations;
        container.innerHTML = canEditFormation ? renderFormationEditor(teamNumber, players) : renderReadonlyTeam(players);
        if (canEditFormation) {
          renderFormationLines(container, players);
          container.querySelector('[data-save-formation]').addEventListener('click', () => saveFormation(teamNumber, container));
          container.querySelector('[data-formation-preset]')?.addEventListener('change', (event) => {
            if (event.target.value !== '') {
              applyFormationPreset(container, players, parseInt(event.target.value, 10));
            }
          });
        }
      };

      const renderAvailable = () => {
        const container = document.getElementById('availablePots');
        const canPick = captainToken !== '' && teamView > 0 && state.draft.status === 'active' && state.draft.current_team === teamView;
        const rule = state.pick_rule || { enforced: false, message: '' };
        const available = state.available || [];
        const groups = {};
        for (const pos of positions) groups[pos] = [];
        for (const player of available) {
          (groups[player.primary_position] || groups.MED).push(player);
        }
        const ruleHtml = rule.message ? `<div class="captain-rule ${rule.enforced ? 'active' : ''}">${escapeHtml(rule.message)}</div>` : '';
        container.innerHTML = ruleHtml + positions.map(pos => `
          <section class="captain-pot">
            <h4>${pos}</h4>
            ${groups[pos].length ? groups[pos].map(p => `
              <button class="captain-player ${p.pick_allowed ? '' : 'not-available'}" type="button" data-player-id="${p.id}" ${canPick && p.pick_allowed ? '' : 'disabled'}>
                <strong>${escapeHtml(p.name)}</strong>
                <span>${playerMeta(p)}</span>
                ${p.pick_allowed ? '' : '<span class="captain-player-unavailable">No disponible aun</span>'}
              </button>
            `).join('') : '<p class="small-muted">Sin jugadores disponibles.</p>'}
          </section>
        `).join('');

        container.querySelectorAll('[data-player-id]').forEach(button => {
          button.addEventListener('click', () => pickPlayer(parseInt(button.dataset.playerId, 10)));
        });
      };

      const render = () => {
        if (!state || !state.ok) return;
        if (shouldRedirectToFormation()) {
          redirectToFormation();
          return;
        }
        document.getElementById('draftTitle').textContent = `${state.match.title} - ${state.match.participants_count} convocados`;
        document.getElementById('team1Title').textContent = `Equipo 1 - ${state.draft.captains[1].name} (${state.teams[1].length}/${state.match.target_team_size}) - ${teamTotalSkill(1).toFixed(1)} pts`;
        document.getElementById('team2Title').textContent = `Equipo 2 - ${state.draft.captains[2].name} (${state.teams[2].length}/${state.match.target_team_size}) - ${teamTotalSkill(2).toFixed(1)} pts`;
        const turn = document.getElementById('draftTurn');
        if (state.draft.status === 'completed') {
          if (teamView > 0 && captainToken !== '' && state.match.can_edit_formations) {
            turn.innerHTML = 'Draft completo. Ajusta la formacion de tu equipo y toca Guardar formacion.';
          } else if (teamView > 0 && captainToken !== '') {
            turn.innerHTML = 'Draft completo. La formacion ya no se puede editar porque el partido esta finalizado.';
          } else {
            turn.innerHTML = 'Draft completo. Los equipos ya quedaron guardados para finalizar el partido.';
          }
        } else if (teamView > 0 && captainToken === '') {
          turn.innerHTML = 'Este link no tiene token de capitan. Pide al admin el link correcto.';
        } else if (teamView === state.draft.current_team) {
          turn.innerHTML = `<strong>Tu turno:</strong> elige un jugador.`;
        } else if (teamView === 1 || teamView === 2) {
          turn.innerHTML = `Turno de ${escapeHtml(state.draft.current_captain)}. Espera a que el otro capitan elija.`;
        } else {
          turn.innerHTML = `Turno de ${escapeHtml(state.draft.current_captain)}. Entra con el link del capitan correspondiente para elegir.`;
        }
        renderTeam(1, 'team1List');
        renderTeam(2, 'team2List');
        updateWaitingPanel();
        const formationOnly = state.draft.status === 'completed' && teamView > 0 && captainToken !== '';
        document.querySelector('.captain-teams-grid')?.classList.toggle('formation-only', formationOnly);
        document.querySelectorAll('[data-captain-team-card]').forEach(card => {
          const cardTeam = parseInt(card.dataset.captainTeamCard, 10);
          card.toggleAttribute('hidden', formationOnly && cardTeam !== teamView);
        });
        renderAvailable();
        document.querySelector('#availablePots')?.closest('.card')?.toggleAttribute('hidden', state.draft.status === 'completed' && teamView > 0 && captainToken !== '');
      };

      const shouldRedirectToFormation = () => {
        return state
          && state.ok
          && state.draft.status === 'completed'
          && teamView > 0
          && captainToken !== ''
          && viewMode !== 'formacion';
      };

      const redirectToFormation = () => {
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'formacion');
        url.hash = 'formacion';
        window.location.replace(url.toString());
      };

      const loadState = async () => {
        const response = await fetch(`capitanes_api.php?action=state&match_id=${matchId}`, { cache: 'no-store' });
        state = await response.json();
        if (shouldRedirectToFormation()) {
          redirectToFormation();
          return;
        }
        render();
      };

      const showMessage = (message, type = 'info') => {
        const el = document.getElementById('draftMessage');
        el.className = `flash flash-${type}`;
        el.textContent = message;
        el.classList.remove('hidden');
      };

      const pickPlayer = async (playerId) => {
        const response = await fetch('capitanes_api.php?action=pick', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId, team_number: teamView, player_id: playerId, token: captainToken })
        });
        const data = await response.json();
        if (!data.ok) {
          showMessage(data.message || 'No se pudo elegir el jugador.', 'error');
          await loadState();
          return;
        }
        state = data;
        if (shouldRedirectToFormation()) {
          redirectToFormation();
          return;
        }
        showMessage('Jugador elegido. Turno actualizado.', 'success');
        render();
      };

      const saveFormation = async (teamNumber, container) => {
        const assignments = Array.from(container.querySelectorAll('.captain-position-select')).map(select => ({
          player_id: parseInt(select.dataset.playerId, 10),
          assigned_position: select.value
        }));
        const response = await fetch('capitanes_api.php?action=save_formation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ match_id: matchId, team_number: teamNumber, token: captainToken, assignments })
        });
        const data = await response.json();
        if (!data.ok) {
          showMessage(data.message || 'No se pudo guardar la formacion.', 'error');
          await loadState();
          return;
        }
        state = data;
        showMessage('Formacion guardada.', 'success');
        render();
      };

      loadState();
      setInterval(loadState, 2500);
    })();
  </script>
<?php endif; ?>

<?php require __DIR__ . '/includes/footer.php'; ?>
