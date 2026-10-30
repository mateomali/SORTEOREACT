import { useEffect, useState } from 'react';

export function DrawPotsEditor({ allowSave = true, mode, onModeChange, pots, onChange: updatePots, onAutoBuild, players, numTeams, disabled, onSave, saving, saved, message }) {
  const [assembly, setAssembly] = useState('automatic');
  const [maxGeneralGap, setMaxGeneralGap] = useState(5);
  const [past, setPast] = useState([]);
  const [future, setFuture] = useState([]);
  const [beforeAutomatic, setBeforeAutomatic] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [movedPlayer, setMovedPlayer] = useState(null);
  useEffect(() => {
    if (movedPlayer === null) return;
    const timeout = setTimeout(() => setMovedPlayer(null), 700);
    return () => clearTimeout(timeout);
  }, [movedPlayer]);
  const copy = value => value.map(pot => ({ ...pot, playerIds: [...pot.playerIds] }));
  const onChange = next => {
    if (JSON.stringify(next) === JSON.stringify(pots)) return;
    setPast(previous => [...previous.slice(-49), copy(pots)]);
    setFuture([]);
    updatePots(next);
  };
  const undo = () => {
    if (!past.length) return;
    setFuture(previous => [copy(pots), ...previous]);
    updatePots(copy(past[past.length - 1]));
    setPast(previous => previous.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setPast(previous => [...previous.slice(-49), copy(pots)]);
    updatePots(copy(future[0]));
    setFuture(previous => previous.slice(1));
  };
  const buildAutomatic = () => {
    setBeforeAutomatic(copy(pots));
    setPast(previous => [...previous.slice(-49), copy(pots)]);
    setFuture([]);
    onAutoBuild(Number(maxGeneralGap));
  };
  const keys = new Set(players.map(player => String(player.id)));
  const membership = new Map(pots.flatMap((pot, index) => pot.playerIds.map(id => [String(id), index])));
  const assign = (id, value) => {
    if (String(membership.get(id) ?? '') === value) return;
    setSelectedPlayer(id);
    setMovedPlayer(id);
    onChange(pots.map((pot, index) => ({ ...pot, playerIds: [
      ...pot.playerIds.filter(key => String(key) !== id),
      ...(String(index) === value ? [id] : []),
    ] })));
  };
  const move = (index, direction) => {
    const next = pots.slice();
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };
  const control = 'min-h-10 rounded-md border border-[#adc8bb] bg-white px-2 text-sm text-[#07130f] disabled:opacity-50';
  const button = `${control} font-bold hover:bg-[#eef5f1]`;
  const playerRow = player => <div key={player.id} draggable={!disabled}
    onPointerDown={() => { if (!disabled) setSelectedPlayer(String(player.id)); }}
    onFocusCapture={() => { if (!disabled) setSelectedPlayer(String(player.id)); }}
    onDragStart={event => { if (disabled) return; setSelectedPlayer(String(player.id)); setDragged(String(player.id)); event.dataTransfer.setData('text/plain', String(player.id)); event.dataTransfer.effectAllowed = 'move'; }}
    onDragEnd={() => { setDragged(null); setDropTarget(null); }}
    className="draw-pot-player grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(100px,140px)_auto] items-center gap-2 border-t border-[#e4ede8] py-2 text-sm text-[#07130f]" data-pot-player={player.id}
    data-selected={selectedPlayer === String(player.id)} data-dragging={dragged === String(player.id)} data-arrived={movedPlayer === String(player.id)}>
    <span className="min-w-0"><strong className="block break-words">{player.nombre}</strong><span className="text-xs text-[#526b62]">{player.posicion} · {globalThis.GoodfellasRating?.card(Number(player.base_puntuacion ?? player.puntuacion ?? 3)) ?? '—'} GEN</span></span>
    <select className={`${control} min-w-0 w-full`} value={membership.get(String(player.id)) ?? ''} disabled={disabled} onChange={event => assign(String(player.id), event.target.value)} aria-label={`Pote de ${player.nombre}`}>
      <option value="">Sin pote</option>
      {pots.map((pot, index) => <option key={index} value={index}>{index + 1}. {pot.name || `Pote ${index + 1}`}</option>)}
    </select>
    <button className={button} type="button" disabled={disabled || !membership.has(String(player.id))} onClick={() => assign(String(player.id), '')} aria-label={`Quitar a ${player.nombre} del pote`}>×</button>
  </div>;
  const dropProps = target => ({
    onDragOver: event => { if (!disabled && dragged !== null) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(target); } },
    onDragLeave: event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(current => current === target ? null : current); },
    onDrop: event => { event.preventDefault(); if (disabled || dragged === null || !keys.has(dragged)) return; assign(dragged, target); setDragged(null); setDropTarget(null); },
  });
  return <section className="grid min-w-0 gap-3 rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-3" aria-label="Sorteo por potes" data-draw-pots>
    <div className="draw-pots-setup">
    <h3 className="draw-pots-section-title [-webkit-text-fill-color:currentColor]!">Configuración del sorteo</h3>
    <label className="grid gap-1 text-sm font-bold text-[#07130f]">
      Modalidad de sorteo
      <select className={control} value={mode} onChange={event => onModeChange(event.target.value)} disabled={disabled}>
        <option value="standard">Sorteo habitual</option>
        <option value="pots">Sorteo por potes</option>
      </select>
    </label>
    {mode === 'pots' ? <>
      <p className="m-0 text-sm text-[#526b62]">Cada pote reúne jugadores de la misma posición y puntaje similar, para repartir alternativas equivalentes entre los {numTeams} equipos. El número indica el orden de reparto, no el nivel del grupo. Se mantienen las reglas de arqueros y posiciones.</p>
      <label className="grid gap-1 text-sm font-bold text-[#07130f]">Armado de potes
        <select className={control} value={assembly} disabled={disabled} onChange={event => setAssembly(event.target.value)} aria-label="Armado de potes">
          <option value="manual">Manual</option>
          <option value="automatic">Automático por posición y promedio</option>
        </select>
      </label>
      {assembly === 'automatic' ? <div className="grid gap-2">
        <p className="m-0 text-xs text-[#526b62]">Agrupa por posición principal y generales similares. Para evitar jugadores solos, considera la posición secundaria y LAT como comodín de DEF/MED. Si aún queda un jugador aislado, lo incorpora al pote de campo con puntaje más cercano, aunque requiera mezclar posiciones o superar la diferencia máxima. Todos los arqueros seleccionados van en un único pote. Podés editar y reordenar la propuesta. Los ausentes guardados se conservan aparte.</p>
        <label className="grid gap-1 text-xs font-bold text-[#526b62]">Diferencia máxima de general dentro del pote
          <input className={control} type="number" min="0" max="64" step="1" value={maxGeneralGap} disabled={disabled} onChange={event => setMaxGeneralGap(event.target.value)} aria-label="Diferencia máxima de general dentro del pote" />
        </label>
        <button className={`${button} justify-self-start`} type="button" disabled={disabled || !players.length || maxGeneralGap === '' || Number(maxGeneralGap) < 0 || Number(maxGeneralGap) > 64} onClick={buildAutomatic}>Armar potes automáticamente</button>
      </div> : null}
      <p className="m-0 text-xs font-bold text-[#063d2b]">Si un pote tiene exactamente 2 convocados, deben jugar en equipos distintos. Con más de 2, pueden compartir equipo.</p>
    </> : null}
    </div>
    {mode === 'pots' ? <>
      <div className="draw-pots-toolbar flex flex-wrap items-center gap-2" aria-label="Historial de potes">
        <strong className="draw-pots-toolbar-label">Edición de potes</strong>
        <button className={button} type="button" disabled={disabled || !past.length} onClick={undo}>Deshacer</button>
        <button className={button} type="button" disabled={disabled || !future.length} onClick={redo}>Rehacer</button>
        <button className={button} type="button" disabled={disabled || beforeAutomatic === null} onClick={() => { onChange(copy(beforeAutomatic)); setBeforeAutomatic(null); }}>Deshacer armado automático</button>
      </div>
      <div className="draw-pots-hierarchy-heading flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="m-0 text-base font-bold text-[#07130f]">Jerarquía de potes</h3>
        <span className="text-sm text-[#526b62]">{pots.length} potes · {players.filter(player => !membership.has(String(player.id))).length} sin asignar</span>
      </div>
      <p className="m-0 text-xs text-[#526b62]">Grupos por características similares; un pote posterior puede tener mayor promedio. Arrastrá jugadores a otro pote o elegí su destino en la lista.</p>
      <div className="grid gap-3" aria-label="Asignar jugadores a potes">
        {pots.map((pot, index) => {
          const members = players.filter(player => membership.get(String(player.id)) === index)
            .sort((a, b) => Number(b.base_puntuacion ?? b.puntuacion ?? 3) - Number(a.base_puntuacion ?? a.puntuacion ?? 3)
              || a.nombre.localeCompare(b.nombre, 'es'));
          const count = members.length;
          const absent = pot.playerIds.length - count;
          const average = count && globalThis.GoodfellasRating?.card
            ? Math.round(members.reduce((sum, player) => sum + Number(globalThis.GoodfellasRating.card(Number(player.base_puntuacion ?? player.puntuacion ?? 3))), 0) / count)
            : null;
          return <div key={index} className="draw-pot-target draw-pot-window" {...dropProps(String(index))} data-pot-row data-drop-active={dropTarget === String(index)}>
            <div className="draw-pot-header">
              <span className="draw-pot-rank" aria-hidden="true">{index + 1}</span>
              <strong>Pote {index + 1}</strong>
              {average !== null ? <span className="draw-pot-average">Promedio {average} GEN</span> : null}
            </div>
            <div className="draw-pot-settings">
            <div className="grid min-w-0 gap-1">
              <label className="grid gap-1 text-sm font-bold text-[#063d2b]">Nombre del pote
                <input className={control} value={pot.name} maxLength={60} onChange={event => onChange(pots.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} disabled={disabled} aria-label={`Nombre del pote ${index + 1}`} />
              </label>
              <span className="text-xs text-[#526b62]">{count} convocados · Reparto inicial {Math.floor(count / numTeams)}–{Math.ceil(count / numTeams)} por equipo{count === 2 ? ' · Siempre separados' : ''}{absent > 0 ? ` · ${absent} guardados fuera de esta selección` : ''}</span>

            </div>
            <div className="flex items-center gap-1">
              <button className={button} type="button" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Subir pote ${index + 1}`}>↑</button>
              <button className={button} type="button" disabled={disabled || index === pots.length - 1} onClick={() => move(index, 1)} aria-label={`Bajar pote ${index + 1}`}>↓</button>
              <button className={`${button} draw-pot-delete`} type="button" disabled={disabled} onClick={() => onChange(pots.filter((_, i) => i !== index))} aria-label={`Eliminar pote ${index + 1}`}>Eliminar</button>
            </div>
            </div>
            <div className="draw-pot-members min-w-0">
              {members.map(playerRow)}
              {count === 0 ? <p className="m-0 py-2 text-sm text-[#526b62]">Sin convocados asignados. Elegí este pote en la lista de un jugador o arrastralo acá.</p> : null}
            </div>
          </div>;
        })}
      </div>
      <button className={`${button} justify-self-start`} type="button" disabled={disabled || pots.length >= 100} onClick={() => onChange([...pots, { name: `Pote ${pots.length + 1}`, playerIds: [] }])}>Agregar pote</button>
      <div className="draw-pot-target draw-pots-unassigned min-w-0 rounded-md border p-3" {...dropProps('')} data-drop-active={dropTarget === ''} aria-label="Jugadores sin pote">
        <h3 className="m-0 text-sm font-bold text-[#07130f]">Sin pote · {players.filter(player => !membership.has(String(player.id))).length}</h3>
        {players.filter(player => !membership.has(String(player.id))).map(playerRow)}
        {players.every(player => membership.has(String(player.id))) ? <p className="m-0 pt-2 text-sm text-[#526b62]">Todos los convocados tienen pote.</p> : null}
      </div>
      <p className="m-0 text-xs text-[#526b62]">Todos los seleccionados deben tener un pote. Los jugadores ausentes conservan su grupo para próximas fechas. Eliminar un pote deja a sus jugadores sin pote.</p>
      {allowSave && <div className="draw-pots-save flex flex-wrap items-center gap-2">
        <button className={button} type="button" disabled={disabled || saving || saved} onClick={onSave}>{saving ? 'Guardando…' : 'Guardar potes para próximas fechas'}</button>
        <span className="text-xs text-[#526b62]" role="status">{message || (saved ? 'Plantilla guardada' : 'Cambios sin guardar en la plantilla')}</span>
      </div>}
    </> : null}
  </section>;
}
