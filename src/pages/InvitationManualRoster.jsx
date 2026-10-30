import { useState } from 'react';

export function InvitationManualRoster({ players, teams, benches, numTeams, goalkeeperIds, separatedPairs = [], teamName, onApply }) {
  const [destinations, setDestinations] = useState(() => Object.fromEntries((teams || []).flatMap((team, index) => [...team, ...(benches[index] || [])].map(player => [String(player.id), String(index)]))));
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(!teams);
  const [error, setError] = useState('');
  const size = players.length / numTeams;
  const groups = Array.from({ length: numTeams }, (_, index) => players.filter(player => destinations[String(player.id)] === String(index)));
  const assigned = groups.reduce((sum, group) => sum + group.length, 0);
  const valid = Number.isInteger(size) && assigned === players.length && groups.every(group => group.length === size && group.filter(player => goalkeeperIds.has(String(player.id))).length === 1);
  const names = new Map(players.map(player => [String(player.id), player.nombre]));
  const conflicts = new Map();
  for (const restriction of separatedPairs) {
    const ids = restriction.map(String).filter(id => names.has(id));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const left = ids[i], right = ids[j];
      const destination = destinations[left];
      if (destination !== undefined && destination !== '' && destination === destinations[right]) {
        conflicts.set([left, right].sort().join(':'), `${names.get(left)} y ${names.get(right)} no pueden jugar juntos por restricción (${teamName(Number(destination))}).`);
      }
    }
  }
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return <details open={open} onToggle={event => setOpen(event.currentTarget.open)} className="rounded-lg border border-[#d7e6df] bg-white p-3" data-manual-roster>
    <summary className="cursor-pointer text-sm font-bold">Asignar jugadores · {assigned}/{players.length}</summary>
    <div className="grid gap-3 pt-3">
      <p className="m-0 text-xs">Elegí un equipo para cada jugador. Cada equipo necesita {size} jugadores y un arquero.</p>
      <div className="flex flex-wrap gap-2 text-xs" aria-label="Jugadores por equipo">{groups.map((group, index) => <span key={index}>{teamName(index)}: {group.length}/{size} · {group.filter(player => goalkeeperIds.has(String(player.id))).length} ARQ</span>)}</div>
      {conflicts.size ? <div role="alert" className="grid gap-1 text-sm text-red-700">{[...conflicts].map(([key, message]) => <p key={key} className="m-0">{message}</p>)}</div> : null}
      <label className="grid gap-1 text-sm">Buscar jugador<input type="search" className="min-h-10 rounded-md border border-[#adc8bb] px-2" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="grid gap-1">{players.filter(player => normalize(player.nombre).includes(normalize(query))).map(player => <label key={player.id} className="grid grid-cols-2 items-center gap-2 border-b border-[#d7e6df] py-2 text-sm">
        <span><strong>{player.nombre}</strong><span className="block text-xs">{goalkeeperIds.has(String(player.id)) ? 'Arquero' : player.posicion}</span></span>
        <select aria-label={`Equipo de ${player.nombre}`} className="min-h-10 min-w-0 rounded-md border border-[#adc8bb] bg-white px-2" value={destinations[String(player.id)] ?? ''} onChange={event => { setDestinations(current => ({ ...current, [String(player.id)]: event.target.value })); setError(''); }}>
          <option value="">Sin equipo</option>{groups.map((_, index) => <option key={index} value={index}>{teamName(index)}</option>)}
        </select>
      </label>)}</div>
      {!valid ? <p role="status" className="m-0 text-xs">Completá todos los equipos con la misma cantidad de jugadores y un arquero por equipo.</p> : null}
      {error ? <p role="alert" className="m-0 text-sm text-red-700">{error}</p> : null}
      <button type="button" className="gf-button gf-button-primary min-h-11 rounded-md bg-[#063d2b] px-3 text-white! disabled:opacity-50" disabled={!valid || conflicts.size > 0} onClick={() => { const message = onApply(groups); if (message) setError(message); else setOpen(false); }}>Ubicar en cancha</button>
    </div>
  </details>;
}
