import React, { useEffect, useRef, useState } from 'react';

function GoalActionIcon({ remove = false }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{remove ? <><path d="M3 6h18M9 6V4h6v2M5 6l1 14h12l1-14M10 10v6M14 10v6" /></> : <><path d="m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5" /></>}</svg>;
}

function TeamIdentity({ team }) {
  const colors = { ROSA: '#ec4899', AZUL: '#2563eb', NARANJA: '#f97316', NEGRO: '#171717', VERDE: '#16a34a', BLANCO: '#ffffff', ROJO: '#dc2626', CAMISADO: '#f8fafc', DESCAMISADO: '#d6b493' };
  return <span className="live-team-identity"><svg className="live-team-shirt" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 3.5 12 5l4-1.5 5 4-3 4-2-1V21H8V10.5l-2 1-3-4Z" fill={colors[team?.color] || '#cbd5ce'} stroke="#52615b" strokeWidth="1.2" strokeLinejoin="round" />{team?.color === 'DESCAMISADO' && <path d="m5 3 15 19" stroke="#52615b" strokeWidth="2" />}</svg><span>{team?.label}</span></span>;
}

const scoreOf = (game) => Object.fromEntries(game.teams.map((t) => [t, game.goals.filter((g) => g.team === t).length]));
const clockText = (seconds) => {
  const value = Math.ceil(Math.abs(seconds));
  return `${seconds < 0 ? '−' : ''}${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};

function standingsOf(games, teams) {
  const rows = Object.fromEntries(teams.map((t) => [t.id, { ...t, played: 0, points: 0, gf: 0, ga: 0 }]));
  games.filter((g) => g.status === 'finished').forEach((g) => {
    const score = scoreOf(g);
    g.teams.forEach((t) => {
      const opponent = g.teams.find((id) => id !== t);
      rows[t].played++;
      rows[t].gf += score[t];
      rows[t].ga += score[opponent];
      rows[t].points += score[t] > score[opponent] ? 3 : score[t] === score[opponent] ? 1 : 0;
    });
  });
  return Object.values(rows).sort((a, b) => b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.id - b.id);
}

function GoalDialog({ editor, teams, players, busy, error, onSave, onClose }) {
  const ref = useRef(null);
  const [own, setOwn] = useState(editor.goal?.own || false);
  const [player, setPlayer] = useState(editor.goal?.player || '');
  const [search, setSearch] = useState('');
  useEffect(() => { ref.current.showModal(); }, []);
  const scorerTeam = own ? editor.game.teams.find((t) => t !== editor.team) : editor.team;
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const candidates = players.filter(p => p.team === scorerTeam && normalize(p.name).includes(normalize(search.trim())));
  return <dialog className="live-dialog live-goal-dialog" aria-labelledby="live-goal-dialog-title" ref={ref} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <form data-no-partial onSubmit={(event) => { event.preventDefault(); onSave({ own, player: own ? null : Number(player) || null }); }}>
      <div className="live-dialog-head"><h2 id="live-goal-dialog-title">{editor.goal ? 'Editar goleador' : <><span aria-hidden="true">⚽</span> Gol</>}<span className="live-goal-header-team"><TeamIdentity team={teams.find((t) => t.id === editor.team)} /></span></h2><button autoFocus className="live-icon-button" type="button" aria-label="Cerrar" disabled={busy} onClick={onClose}>×</button></div>
      {!own && <><label className="live-scorer-search">Buscar goleador<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Nombre del jugador" autoComplete="off" /></label>
      <fieldset><legend>{own ? 'Autor del gol en contra' : '¿Quién lo hizo?'}</legend>
        <div className="live-player-options">
          <label className="live-unidentified"><input type="radio" name="scorer" value="" checked={player === ''} onChange={() => setPlayer('')} /> Sin identificar / completar después</label>
          {candidates.map((p) => <label key={p.id}><input type="radio" name="scorer" value={p.id} checked={Number(player) === p.id} onChange={() => setPlayer(p.id)} /> {p.name}</label>)}
          {!candidates.length && <p className="live-scorer-empty" role="status">No hay jugadores con ese nombre.</p>}
        </div>
      </fieldset></>}
      {error && <p className="live-error" role="alert">{error}</p>}
      <footer className="live-goal-dialog-footer"><label className="live-check"><input type="checkbox" checked={own} onChange={(e) => { setOwn(e.target.checked); setPlayer(''); setSearch(''); }} /> Gol en contra</label><p>{own ? 'Gol en contra · No requiere goleador' : player ? players.find(p => p.id === Number(player))?.name : 'Goleador sin identificar'}</p><div className="live-actions"><button className="live-button" type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="live-button live-primary" disabled={busy}>Guardar {editor.goal ? 'goleador' : 'gol'}</button></div></footer>
    </form>
  </dialog>;
}

function ConfirmDialog({ title, children, busy, error, confirm, onConfirm, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current.showModal(); }, []);
  return <dialog className="live-dialog" ref={ref} onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}>
    <form data-no-partial onSubmit={(e) => { e.preventDefault(); onConfirm(new FormData(e.currentTarget)); }}>
      <h2>{title}</h2>{children}
      {error && <p className="live-error" role="alert">{error}</p>}
      <div className="live-actions"><button className="live-button" type="button" onClick={onClose} disabled={busy}>Cancelar</button><button className="live-button live-primary" autoFocus disabled={busy}>{confirm}</button></div>
    </form>
  </dialog>;
}

export function LiveMatchesIsland({ root }) {
  const [payload] = useState(() => JSON.parse(root.dataset.payload || '{}'));
  const [session, setSession] = useState(payload.session);
  const sessionRef = useRef(session);
  const anchor = useRef({ server: payload.serverNow, local: performance.now() });
  const [now, setNow] = useState(payload.serverNow);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('Guardado en el servidor');
  const [tab, setTab] = useState(payload.session.state.closed ? 'fixture' : 'match');
  const [editor, setEditorState] = useState(null);
  const setEditor = (value) => setEditorState(value ? { ...value, revision: sessionRef.current.revision } : null);
  const [confirm, setConfirmState] = useState(null);
  const setConfirm = (value) => setConfirmState(value ? { ...value, revision: sessionRef.current.revision } : null);
  const [first, setFirst] = useState(String(payload.teams[0]?.id || ''));
  const [second, setSecond] = useState(String(payload.teams[1]?.id || ''));
  const [minutes, setMinutes] = useState(payload.session.state.duration / 60);
  const endpoint = `partidos_en_vivo.php?match_id=${payload.matchId}&api=1`;
  const state = session.state;
  const games = state.games;
  const game = games.at(-1);
  const completed = games.filter((g) => g.status === 'finished').length;
  const target = payload.teams.length === 2 ? 1 : payload.teams.length * (payload.teams.length - 1);
  const active = game && game.status !== 'finished';
  const canEdit = payload.canPlay && !state.closed;
  const label = (id) => payload.teams.find((t) => t.id === id)?.label || `Equipo ${id}`;
  const identity = (id) => <TeamIdentity team={payload.teams.find((t) => t.id === id)} />;
  const score = game ? scoreOf(game) : {};
  const elapsed = game ? Math.min(game.status === 'finished' ? Infinity : game.duration, game.elapsed + (game.running_since === null ? 0 : Math.max(0, now - game.running_since))) : 0;
  const remaining = game ? game.duration - elapsed : state.duration;
  const rows = standingsOf(games, payload.teams);

  const [notice, setNotice] = useState('');
  const [sound, setSound] = useState(false);
  const audioRef = useRef(null);
  const lastAlert = useRef(null);
  const substitution = Math.floor(elapsed / 540);
  const alertKey = !active || game.status === 'ready' ? null : payload.teams.length === 2
    ? (substitution > 0 && elapsed < game.duration ? `change-${substitution}` : null)
    : (remaining > 0 && remaining <= 60 ? 'last-minute' : null);
  useEffect(() => {
    if (!alertKey) { setNotice(''); return; }
    const key = `${payload.matchId}-${games.length}-${alertKey}`;
    if (lastAlert.current === key) return;
    lastAlert.current = key;
    const message = payload.teams.length === 2 ? 'PRÓXIMA PELOTA AFUERA CAMBIO!!' : 'ÚLTIMO MINUTO';
    setNotice(message);
    let heard = false;
    try { heard = sessionStorage.getItem(key) === 'heard'; } catch {}
    if (sound && !heard) {
      try {
        const ctx = audioRef.current;
        if (ctx?.state === 'running') {
          for (let i = 0; i < 3; i++) {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.frequency.value = 880;
            gain.gain.value = 0.15;
            oscillator.connect(gain); gain.connect(ctx.destination);
            oscillator.start(ctx.currentTime + i * 0.4);
            oscillator.stop(ctx.currentTime + i * 0.4 + 0.2);
          }
        }
        if (typeof window.goodfellasSpeak === 'function') {
          window.goodfellasSpeak(message).catch(() => {});
        } else if ('speechSynthesis' in window) {
          const voice = new SpeechSynthesisUtterance(message);
          voice.lang = 'es-AR'; window.speechSynthesis.speak(voice);
        }
        sessionStorage.setItem(key, 'heard');
      } catch {}
    }
  }, [alertKey, sound, games.length, payload.matchId]);
  useEffect(() => () => { audioRef.current?.close(); }, []);

  function receive(data) {
    anchor.current = { server: data.server_now, local: performance.now() };
    setNow(data.server_now);
    if (data.session.revision !== sessionRef.current.revision) {
      sessionRef.current = data.session;
      setSession(data.session);
      setMinutes(data.session.state.duration / 60);
    }
    setConnection('Guardado en el servidor');
  }
  useEffect(() => {
    const tick = setInterval(() => setNow(anchor.current.server + (performance.now() - anchor.current.local) / 1000), 250);
    let alive = true;
    const controller = new AbortController();
    const sync = async () => {
      if (document.hidden || working.current) return;
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        if (alive && !working.current && data.session.revision >= sessionRef.current.revision) receive(data);
      } catch (e) { if (alive && e.name !== 'AbortError') setConnection('Sin conexión. Las acciones requieren conexión; el reloj sigue contando.'); }
    };
    const poll = setInterval(sync, 4000);
    const stop = () => { alive = false; controller.abort(); clearInterval(tick); clearInterval(poll); document.removeEventListener('visibilitychange', sync); window.removeEventListener('online', sync); window.removeEventListener('goodfellas:resume', sync); };
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('online', sync);
    window.addEventListener('goodfellas:resume', sync);
    document.addEventListener('goodfellas:before-partial-render', stop, { once: true });
    return () => { stop(); document.removeEventListener('goodfellas:before-partial-render', stop); };
  }, [endpoint]);

  async function act(action, input = {}, revision = sessionRef.current.revision) {
    if (working.current || !payload.canManage) return false;
    working.current = true;
    setBusy(true);
    setError('');
    setConnection('Guardando…');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': payload.csrf }, body: JSON.stringify({ ...input, action, revision }) });
      const data = await response.json();
      if (data.session) receive(data);
      if (!response.ok) throw new Error(data.message || 'No se pudo guardar.');
      return true;
    } catch (e) { setError(e.message || 'No se pudo guardar. Revisá la conexión y el historial antes de reintentar.'); setConnection('Revisá el estado antes de continuar'); return false; }
    finally { working.current = false; setBusy(false); }
  }

  function goalList(g, index, readonly = false, showTime = true, team = null) {
    return g.goals.some(goal => team === null || goal.team === team) ? <ol className="live-goal-list">{g.goals.map((goal, i) => (team === null || goal.team === team) && <li key={`${index}-${i}`}>
      <div><strong>{goal.own ? 'Gol en contra' : goal.player ? payload.players.find((p) => p.id === goal.player)?.name || 'Jugador' : 'Sin identificar'}</strong>{(team === null || goal.own || showTime) && <span>{team === null && identity(goal.team)}{goal.own ? (team === null ? ' · En contra' : 'En contra') : ''}{showTime && (goal.at === null ? ' · Cargado al finalizar' : ` · ${Math.floor(goal.at / 60)}′${String(goal.at % 60).padStart(2, '0')}″`)}</span>}</div>
      {!readonly && payload.canCorrect ? <div className="live-goal-actions" role="group" aria-label={`Acciones del gol ${i + 1}: ${goal.own ? 'Gol en contra' : goal.player ? payload.players.find((p) => p.id === goal.player)?.name || 'Jugador' : 'Sin identificar'}`}><button type="button" className="live-goal-action" aria-label={goal.player || goal.own ? 'Editar' : 'Asignar'} title={goal.own ? 'Editar gol en contra' : goal.player ? 'Editar goleador' : 'Asignar goleador'} disabled={busy} onClick={() => setEditor({ game: g, gameIndex: index, goal, goalIndex: i, team: goal.team })}><GoalActionIcon /></button>{(state.closed || index === games.length - 1) && <button type="button" className="live-goal-action live-goal-remove" aria-label="Quitar" title="Quitar gol" disabled={busy} onClick={() => setConfirm({ type: 'remove', goal: i, gameIndex: index })}><GoalActionIcon remove /></button>}</div> : null}
    </li>)}</ol> : <p className="live-muted">{team === null ? 'Todavía no hay goles registrados.' : 'Sin goles'}</p>;
  }

  return <div className="live-matches">
    <header className="live-page-header"><div><h1>Partidos en vivo</h1><p>{payload.title}</p></div><a className="live-button" href="editar_partidos.php">Volver a fechas</a></header>
    <div className="live-progress"><span><strong>{completed}</strong> / {target} {payload.teams.length === 2 ? 'partidos' : 'partidos del ida y vuelta'}{completed > target ? ` · ${completed - target} adicionales` : ''}</span><span role="status">{connection}</span></div>
    <div className="live-actions"><button className="live-button" type="button" onClick={async () => {
      if (sound) { setSound(false); return; }
      try {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (Audio) { audioRef.current ||= new Audio(); await audioRef.current.resume(); }
        lastAlert.current = null; setSound(true);
      } catch { setError('No se pudo activar el sonido en este dispositivo.'); }
    }}>{sound ? 'Desactivar avisos sonoros' : 'Activar avisos sonoros'}</button></div>
    {notice && <div className="live-notice" role="alert"><strong>{notice}</strong> <button className="live-button" onClick={() => setNotice('')}>Entendido</button></div>}
    {payload.teams.length === 2 && active && <p className="live-rotation-note">Próximo cambio en {clockText(Math.min(game.duration, (substitution + 1) * 540) - elapsed)} · un suplente, cambios cada 9 minutos efectivos.</p>}
    {game?.finish_reason && <p className="live-notice">{game.finish_reason === 'three_goals' ? 'Partido finalizado automáticamente: un equipo llegó a 3 goles.' : 'Partido finalizado: se cumplió el tiempo acordado.'}</p>}
    {canEdit && games.length === 1 && !active && payload.teams.length > 2 && !game.tie_choice && score[game.teams[0]] === score[game.teams[1]] && (!game.goals.length || !game.first_goal_known) && <div className="live-notice"><p>{game.goals.length ? 'Empate: indicá qué equipo marcó el primer gol para definir el siguiente cruce.' : 'Empate 0–0: elegí quién tiene prioridad para el siguiente cruce.'}</p>{game.teams.map(t => <button className="live-button" key={t} disabled={busy} onClick={() => act('tie_priority', { tie_choice: t })}>{label(t)}</button>)}</div>}
    {error && <div className="live-error" role="alert">{error}</div>}
    {payload.canManage && !payload.canPlay && !state.closed && <p className="live-notice">Publicá la fecha y completá sus equipos para comenzar.</p>}
    {state.closed && <div className="live-notice"><strong>Fecha finalizada.</strong> Los resultados y goleadores ya están guardados.{payload.isAdmin && <> <a href={`finalizar_partido.php?match_id=${payload.matchId}&edit_details=1#valoraciones`}>Ver premios y formaciones</a></>} <a href="junta_votaciones.php">Ir a votaciones</a></div>}
    {payload.canCorrect && <section className="live-panel live-result-options">
      <div><h2>{state.closed ? 'Corregir fecha finalizada' : 'Carga de resultados'}</h2><p className="live-muted">{state.closed ? 'Podés agregar o quitar partidos y corregir sus goles y goleadores. La fecha permanece finalizada; las posiciones y estadísticas se actualizan.' : 'Si no registraste los partidos, podés cargar los goles por equipo y sus autores al cerrar la fecha.'}</p></div>
      <div className="live-actions">
        {state.closed && <button type="button" className="live-button live-primary" disabled={busy} onClick={() => setConfirm({ type: 'add_game' })}>Agregar partido finalizado</button>}
        {payload.isAdmin && games.length === 0 && <a className="live-button" href={`finalizar_partido.php?match_id=${payload.matchId}&direct_result=1`}>Cargar goles y premios</a>}
      </div>
    </section>}
    {state.summary && <section className="live-panel"><h2>Resultado general de la fecha</h2><p className="live-muted">Se cargaron los totales sin detallar cruces. Para calcular posiciones hace falta registrar los partidos.</p><div className="live-pair-progress">{payload.teams.map(team => <div key={team.id}><TeamIdentity team={team} /><strong>{state.summary.team_goals[team.id] || 0} goles</strong><span>{payload.players.filter(player => player.team === team.id && state.summary.player_goals[player.id] > 0).map(player => `${player.name}: ${state.summary.player_goals[player.id]}`).join(' · ') || 'Sin goleadores'}</span></div>)}</div></section>}
    {payload.canCorrect && state.pending_scorers && <details className="live-panel live-legacy-scorers"><summary>Goleadores generales cargados antes del registro por partido</summary><p className="live-muted">Estos goles conservan sus autores en las estadísticas, pero todavía no tienen un partido asignado. Al asignar uno de ellos al mismo jugador en un partido, se descuenta de esta lista. Ajustá estas cantidades antes de quitar partidos si sus goles quedarían por debajo del total atribuido.</p><form data-no-partial key={session.revision} onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); await act('set_pending_scorers', { goals: Object.fromEntries(payload.players.map(player => [player.id, Number(data.get(String(player.id)))])) }, Number(data.get('revision'))); }}><input type="hidden" name="revision" value={session.revision} /><div className="live-setup-fields">{payload.players.map(player => <label key={player.id}>{player.name}<span className="live-muted">{label(player.team)}</span><input type="number" min="0" max="24000" name={String(player.id)} defaultValue={state.pending_scorers[player.id] || 0} required /></label>)}</div><button className="live-button" disabled={busy}>Guardar goleadores generales</button></form></details>}
    <nav className="live-tabs" aria-label="Vista de la fecha">{[['match', 'Partido'], ['fixture', 'Fixture'], ['table', 'Tabla']].map(([id, text]) => <button key={id} aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{text}</button>)}</nav>
    {tab !== 'match' && active && <div className="live-current-strip"><div><strong role="timer" aria-label="Tiempo restante">{clockText(remaining)}</strong><span>{game.teams.map((t) => `${label(t)} ${score[t]}`).join(' / ')}{game.status === 'paused' ? ' · Pausado' : remaining < 0 ? ' · Tiempo extra' : ''}</span></div><button className="live-button" onClick={() => setTab('match')}>Ir al partido</button></div>}

    {tab === 'match' && <>
      {!game ? state.closed ? <section className="live-panel"><h2>Sin partidos registrados</h2><p className="live-muted">Podés agregar los partidos terminados o usar la carga general de goles y premios.</p></section> : <section className="live-panel live-setup"><h2>¿Qué dos equipos empiezan?</h2><p className="live-muted">Elegí el primer cruce. Los siguientes se definirán con los resultados.</p><div className="live-setup-fields"><label>Primer equipo<select value={first} onChange={(e) => setFirst(e.target.value)}>{payload.teams.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label><label>Segundo equipo<select value={second} onChange={(e) => setSecond(e.target.value)}>{payload.teams.map((t) => <option key={t.id} value={t.id} disabled={String(t.id) === first}>{t.label}</option>)}</select></label></div><button className="live-button live-primary" disabled={busy || !canEdit || first === second} onClick={() => act('next', { teams: [Number(first), Number(second)] })}>Preparar primer partido</button></section> : <div className="live-match-layout">
        <section className="live-panel live-score-panel" aria-label={`Partido ${games.length}`}>
          <div className="live-match-heading"><h2>Partido {games.length}{games.length > target ? ' · Adicional' : ''}</h2><span>{game.status === 'finished' ? 'Finalizado' : game.status === 'ready' ? 'Por comenzar' : game.status === 'paused' ? 'Pausado' : 'En juego'}</span></div>
          <div className={`live-clock ${remaining < 0 ? 'live-overtime' : ''}`} role="timer" aria-label="Tiempo restante"><span>{clockText(remaining)}</span><p>{remaining < 0 ? 'Tiempo extra' : game.status === 'finished' ? 'Tiempo al finalizar' : 'Tiempo restante'}</p></div>
          {active && <div className="live-clock-controls" role="group" aria-label="Control del tiempo"><button className="live-button live-primary" disabled={busy || !canEdit} onClick={() => act(game.running_since === null ? 'start' : 'pause')}>{game.running_since !== null ? 'Pausar' : game.status === 'ready' ? 'Comenzar partido' : 'Reanudar'}</button></div>}
          <div className="live-scoreboard">{game.teams.map((t) => <div key={t} className="live-team-score"><h3>{identity(t)}</h3><strong aria-label={`Goles de ${label(t)}: ${score[t]}`}>{score[t]}</strong>{active && <button className="live-button live-goal-button" aria-label="+ Agregar gol" title={`Agregar gol para ${label(t)}`} disabled={busy || !canEdit} onClick={() => setEditor({ game, gameIndex: games.length - 1, team: t })}><span className="live-add-goal-symbol" aria-hidden="true">⚽</span><span>+ Gol</span></button>}</div>)}</div>
          {active && <div className="live-match-finish"><span>Cierre del partido</span><button className="live-button" disabled={busy || !canEdit} onClick={() => setConfirm({ type: 'finish' })}>Finalizar partido</button></div>}
          {active && <details className="live-bulk"><summary>Cargar resultado al finalizar</summary><p className="live-muted">Completá el marcador y después asigná los goleadores. Para descontar un gol, quitalo del historial.</p><form data-no-partial key={`${games.length}-${game.goals.length}`} onSubmit={async (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); await act('set_score', { scores: Object.fromEntries(game.teams.map((t) => [t, Number(data.get(String(t)))])) }); }}><div className="live-setup-fields">{game.teams.map((t) => <label key={t}>{identity(t)}<input type="number" name={String(t)} min={score[t]} max="100" defaultValue={score[t]} required /></label>)}</div><button className="live-button" disabled={busy || !canEdit}>Guardar marcador</button></form></details>}
          <p className="live-rotation-note">{game.reason}</p>
          {active && <p className="live-resting">Descansan: {payload.teams.filter((t) => !game.teams.includes(t.id)).map((t) => t.label).join(' / ')}</p>}
          {!active && canEdit && <button className="live-button live-primary live-next" disabled={busy} onClick={() => act('next', { extra: completed >= target })}>{completed >= target ? '+ Agregar un partido' : 'Preparar próximo partido'}</button>}
        </section>
        <section className="live-panel live-events"><h2>Goles del partido</h2>{!active && canEdit && <><p className="live-muted">Podés corregir los goles antes de preparar el próximo partido.</p><button className="live-button" disabled={busy} onClick={() => { setError(''); setConfirm({ type: 'correct', index: games.length - 1 }); }}>Corregir resultado</button></>}{goalList(game, games.length - 1)}</section>
      </div>}
      {canEdit && !active && <section className="live-between"><form data-no-partial onSubmit={(e) => { e.preventDefault(); act('duration', { minutes: Number(minutes) }); }}><label>Duración de los próximos partidos<div className="live-duration-input"><input aria-label="Duración en minutos" type="number" min={payload.teams.length === 2 ? 60 : 1} max={payload.teams.length === 2 ? 60 : 120} value={minutes} onChange={(e) => setMinutes(e.target.value)} required /><span>min</span><button className="live-button" disabled={busy || Number(minutes) * 60 === state.duration}>Guardar</button></div></label></form>{completed > 0 && <button className="live-button" disabled={busy} onClick={() => setConfirm({ type: 'close' })}>Finalizar fecha</button>}</section>}
    </>}

    {tab === 'fixture' && <section className="live-panel"><h2>Fixture y resultados</h2><p className="live-muted">{payload.teams.length === 2 ? 'Un partido de 60 minutos, con cambios cada 9 minutos efectivos.' : payload.teams.length === 3 ? 'Se priorizan los cruces pendientes para que cada pareja juegue dos veces. Ningún equipo juega tres partidos seguidos.' : 'Juegan los dos primeros, luego los dos que descansan. Siguen ganador contra perdedor y los cruces restantes. La vuelta repite el orden.'}</p>{games.length ? <ol className="live-fixture-list">{games.map((g, i) => { const s = scoreOf(g); return <li key={i} className="live-fixture-game"><header className="live-fixture-game-header"><h3>Partido {i + 1}</h3><span className="live-fixture-status">{g.status === 'finished' ? 'Finalizado' : 'Actual'}</span></header><div className="live-fixture-result"><span>{identity(g.teams[0])}</span><strong>{s[g.teams[0]]} – {s[g.teams[1]]}</strong><span>{identity(g.teams[1])}</span></div><section className="live-fixture-scorers" aria-label={`Goleadores del partido ${i + 1}`}><h4>Goleadores</h4><div className="live-fixture-goal-columns">{g.teams.map(t => <div key={t} className="live-fixture-team-goals"><h5>{identity(t)}</h5>{state.closed && payload.canCorrect && <button type="button" className="live-button" disabled={busy} onClick={() => setEditor({ game: g, gameIndex: i, team: t })}>Agregar gol a {label(t)}</button>}{goalList(g, i, false, false, t)}</div>)}</div></section>{g.status === 'finished' && payload.canCorrect && <footer className="live-fixture-game-footer"><button className="live-text-button" disabled={busy} onClick={() => { setError(''); setConfirm({ type: 'correct', index: i }); }}>Corregir resultado</button>{state.closed && <button type="button" className="live-text-button live-delete-game" disabled={busy} onClick={() => setConfirm({ type: 'delete_game', index: i })}>Quitar partido</button>}</footer>}</li>; })}</ol> : <p>Elegí los dos primeros equipos en la pestaña Partido.</p>}<h3>{payload.teams.length === 2 ? 'Cruce de la fecha' : 'Cruces del ida y vuelta'}</h3><div className="live-pair-progress">{payload.teams.flatMap((a, i) => payload.teams.slice(i + 1).map((b) => { const n = games.filter((g) => g.status === 'finished' && g.teams.includes(a.id) && g.teams.includes(b.id)).length; return <div key={`${a.id}-${b.id}`}><span>{a.label} / {b.label}</span><strong>{Math.min(n, payload.teams.length === 2 ? 1 : 2)} / {payload.teams.length === 2 ? 1 : 2}{n > (payload.teams.length === 2 ? 1 : 2) ? ` + ${n - (payload.teams.length === 2 ? 1 : 2)} extra` : ''}</strong></div>; }))}</div></section>}

    {tab === 'table' && <section className="live-panel"><h2>Tabla de posiciones</h2><p className="live-muted">Incluye partidos finalizados y adicionales. Victoria: 3 puntos; empate: 1. La prioridad para seguir jugando no cambia los puntos.</p><div className="live-table-scroll"><table className="live-table"><thead><tr><th>Equipo</th><th title="Partidos jugados">PJ</th><th title="Goles a favor">GF</th><th title="Goles en contra">GC</th><th title="Diferencia de gol">DG</th><th>Puntos</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><th><TeamIdentity team={r} /></th><td>{r.played}</td><td>{r.gf}</td><td>{r.ga}</td><td>{r.gf - r.ga}</td><td><strong>{r.points}</strong></td></tr>)}</tbody></table></div><button className="live-button" onClick={() => setConfirm({ type: 'winner' })}>Calcular ganador</button></section>}

    {confirm?.type === 'add_game' && <ConfirmDialog title="Agregar partido finalizado" confirm="Guardar partido" busy={busy} error={error} onClose={() => setConfirm(null)} onConfirm={async data => {
      const pair = [Number(data.get('home')), Number(data.get('away'))];
      if (await act('add_finished_game', { teams: pair, scores: { [pair[0]]: Number(data.get('home_goals')), [pair[1]]: Number(data.get('away_goals')) }, replace_summary: data.has('replace_summary') }, confirm.revision)) { setConfirm(null); setTab('fixture'); }
    }}>
      <p>Se agrega al fixture y se actualizan las posiciones y estadísticas. Después podés asignar sus goleadores.</p>
      <div className="live-setup-fields">
        <label>Equipo local<select name="home" defaultValue={payload.teams[0]?.id} required>{payload.teams.map(team => <option key={team.id} value={team.id}>{team.label}</option>)}</select></label>
        <label>Equipo visitante<select name="away" defaultValue={payload.teams[1]?.id} required>{payload.teams.map(team => <option key={team.id} value={team.id}>{team.label}</option>)}</select></label>
        <label>Goles local<input type="number" min="0" max="100" name="home_goals" defaultValue="0" required /></label>
        <label>Goles visitante<input type="number" min="0" max="100" name="away_goals" defaultValue="0" required /></label>
      </div>
      {state.summary && <label className="live-check"><input type="checkbox" name="replace_summary" required />Reemplazar la carga general de goles y goleadores por los partidos que voy a registrar. Los premios y puntajes se conservan.</label>}
    </ConfirmDialog>}
    {confirm?.type === 'delete_game' && <ConfirmDialog title={`Quitar partido ${confirm.index + 1}`} confirm="Quitar partido" busy={busy} error={error} onClose={() => setConfirm(null)} onConfirm={async () => { if (await act('delete_game', { game: confirm.index }, confirm.revision)) setConfirm(null); }}>
      <p>Se quitará este partido junto con sus goles y goleadores. Se recalcularán las posiciones y estadísticas; los demás partidos, premios y puntajes se conservan.</p>
    </ConfirmDialog>}
    {editor && <GoalDialog key={`${editor.gameIndex}-${editor.goalIndex ?? 'new'}`} editor={editor} teams={payload.teams} players={payload.players} busy={busy} error={error} onClose={() => setEditor(null)} onSave={async (data) => { const ok = await act(editor.goal ? 'edit_goal' : editor.game.status === 'finished' ? 'add_finished_goal' : 'goal', { ...data, team: editor.team, game: editor.gameIndex, goal: editor.goalIndex }, editor.revision); if (ok) setEditor(null); }} />}
    {confirm?.type === 'finish' && <ConfirmDialog title="Finalizar partido" confirm="Guardar y finalizar" busy={busy} error={error} onClose={() => setConfirm(null)} onConfirm={async (data) => { if (await act('finish', { tie_choice: Number(data.get('tie_choice')) }, confirm.revision)) setConfirm(null); }}><p>{label(game.teams[0])} <strong>{score[game.teams[0]]} – {score[game.teams[1]]}</strong> {label(game.teams[1])}</p>{payload.teams.length > 2 && games.length === 1 && score[game.teams[0]] === score[game.teams[1]] && (!game.goals.length || !game.first_goal_known) ? <fieldset><legend>{game.goals.length ? '¿Qué equipo marcó primero?' : payload.teams.length === 3 ? 'Empate 0–0: ¿quién sigue jugando? Se respeta el límite de dos partidos.' : 'Empate 0–0: ¿quién toma el lugar del ganador para el cruce?'}</legend>{game.teams.map((t) => <label className="live-radio" key={t}><input type="radio" name="tie_choice" value={t} required />{identity(t)}</label>)}</fieldset> : <p className="live-muted">Se guarda el resultado y se detiene el cronómetro. Podés completar los goleadores después.</p>}</ConfirmDialog>}
    {confirm?.type === 'remove' && <ConfirmDialog title="Quitar gol" confirm="Quitar gol" busy={busy} error={error} onClose={() => setConfirm(null)} onConfirm={async (data) => { if (await act('remove_goal', { game: confirm.gameIndex, goal: confirm.goal, tie_choice: Number(data.get('tie_choice')) }, confirm.revision)) setConfirm(null); }}><p>Se descontará este gol del marcador y se actualizará el resultado guardado.</p>{payload.teams.length > 2 && !state.closed && games.length === 1 && game.status === 'finished' && <fieldset><legend>Si queda empatado, indicá quién marcó primero; con 0–0, quién tiene prioridad.</legend>{game.teams.map((t) => <label className="live-radio" key={t}><input type="radio" name="tie_choice" value={t} />{identity(t)}</label>)}</fieldset>}</ConfirmDialog>}
    {confirm?.type === 'close' && <ConfirmDialog title="Finalizar fecha" confirm="Finalizar fecha" busy={busy} error={error} onClose={() => setConfirm(null)} onConfirm={async () => { if (await act('close', {}, confirm.revision)) setConfirm(null); }}><p>Se guardarán los resultados y las estadísticas de {completed} partidos.</p>{completed < target && <p className="live-notice">Todavía quedan {target - completed} partidos para completar el ida y vuelta.</p>}{games.some((g) => g.goals.some((goal) => goal.player === null && !goal.own)) && <p>Hay goles sin autor identificado. Completalos antes de finalizar si querés que cuenten en las estadísticas personales.</p>}<p>Después del cierre se habilitan las valoraciones según las reglas de esta fecha.</p></ConfirmDialog>}
    {confirm?.type === 'correct' && <ConfirmDialog title={`Corregir partido ${confirm.index + 1}`} confirm="Guardar corrección" busy={busy} error={error} onClose={() => setConfirm(null)} onConfirm={async (data) => { const edited = games[confirm.index]; if (await act('correct_game', { game: confirm.index, scores: Object.fromEntries(edited.teams.map((t) => [t, Number(data.get(String(t)))])), tie_choice: Number(data.get('tie_choice')) }, confirm.revision)) setConfirm(null); }}>
      <div className="live-setup-fields">{games[confirm.index].teams.map((t) => <label key={t}>{identity(t)}<input type="number" min="0" max="100" name={String(t)} defaultValue={scoreOf(games[confirm.index])[t]} required /></label>)}</div>
      {payload.teams.length > 2 && !state.closed && confirm.index === 0 && <fieldset><legend>Si queda empatado: ¿quién marcó primero? Con 0–0, ¿quién tiene prioridad?</legend>{games[confirm.index].teams.map((t) => <label className="live-radio" key={t}><input type="radio" name="tie_choice" value={t} />{identity(t)}</label>)}</fieldset>}
      <p className="live-muted">Si bajás el marcador, se quitarán los últimos goles del equipo. Los nuevos goles quedan sin autor hasta que los asignes. Los cruces ya armados conservan sus equipos.</p>
    </ConfirmDialog>}
    {confirm?.type === 'winner' && <ConfirmDialog title="Resultado de la fecha" confirm="Aceptar" busy={false} onClose={() => setConfirm(null)} onConfirm={() => setConfirm(null)}>{completed ? <><p><strong>{rows.filter((r) => r.points === rows[0].points && r.gf - r.ga === rows[0].gf - rows[0].ga && r.gf === rows[0].gf).map((r) => r.label).join(' / ')}</strong></p><p>{completed < target ? 'Lidera provisionalmente. ' : ''}Criterio: puntos, diferencia de gol y goles a favor. Si coinciden los tres valores, comparten el puesto.</p></> : <p>Todavía no hay partidos finalizados.</p>}</ConfirmDialog>}
  </div>;
}
