import React, { useState } from 'react';

const lineOrder = ['ARQ', 'DEF', 'LAT', 'MED', 'DEL'];

function groupedPlayers(team) {
  const groups = Object.fromEntries(lineOrder.map((line) => [line, []]));
  (team.players || []).forEach((player) => {
    const line = lineOrder.includes(player.assigned_position) ? player.assigned_position : 'MED';
    groups[line].push(player);
  });
  return groups;
}

function PlayerRow({ player, currentPlayerId }) {
  const isCurrent = Number(player.id) === Number(currentPlayerId);
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_48px] items-center gap-2 rounded-lg border px-2.5 py-2 ${isCurrent ? 'border-lime-200 bg-lime-100 text-[#07130f]' : 'border-lime-200/20 bg-emerald-950/65 text-lime-50'}`}>
      <span className="min-w-0">
        <strong className="block truncate text-sm font-black">
          {player.name}{isCurrent ? ' Vos' : ''}
        </strong>
        <small className={`block text-xs font-semibold ${isCurrent ? 'text-emerald-950/75' : 'text-emerald-100/75'}`}>
          {Number(player.rating || 0).toFixed(1)} pts
        </small>
      </span>
      <strong className={`text-right text-xs font-black ${isCurrent ? 'text-[#07130f]' : 'text-lime-100'}`}>{player.assigned_position || 'MED'}</strong>
    </div>
  );
}

function TeamList({ team, currentPlayerId }) {
  return (
    <section className="rounded-lg border border-lime-200/25 bg-emerald-900/45 p-3">
      <h4 className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-black text-lime-50">
        <span>{team.team_name || 'Equipo'}</span>
        <span className="flex flex-wrap gap-1.5">
          <em className="rounded-md border border-lime-200/25 bg-emerald-950/80 px-2 py-1 text-xs not-italic text-lime-100">General {Number(team.total_skill || 0).toFixed(1)}</em>
          {team.color_name ? <strong className="rounded-md border border-lime-200/25 bg-emerald-950/80 px-2 py-1 text-xs text-lime-100">{team.color_name}</strong> : null}
        </span>
      </h4>
      <div className="grid gap-1.5">
        {(team.players || []).map((player) => (
          <PlayerRow key={`${team.team_number}-${player.id}-${player.assigned_position}`} player={player} currentPlayerId={currentPlayerId} />
        ))}
      </div>
    </section>
  );
}

function PitchTeam({ team, currentPlayerId }) {
  const groups = groupedPlayers(team);
  return (
    <section className="min-h-[420px] rounded-lg border border-lime-200/25 bg-emerald-900/45 p-3">
      <h4 className="mb-2 flex items-center justify-between gap-2 text-sm font-black text-lime-50">
        <span>{team.team_name || 'Equipo'}</span>
        <span className="text-xs text-lime-100">{Number(team.total_skill || 0).toFixed(1)}</span>
      </h4>
      <div className="grid h-[360px] grid-rows-5 gap-2 rounded-lg border border-lime-200/15 bg-emerald-950/75 p-2">
        {lineOrder.map((line) => (
          <div key={line} className="grid grid-cols-[36px_minmax(0,1fr)] items-center gap-2">
            <span className="text-[10px] font-black text-lime-100/80">{line}</span>
            <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
              {groups[line].length ? groups[line].map((player) => {
                const isCurrent = Number(player.id) === Number(currentPlayerId);
                return (
                  <span key={`${line}-${player.id}`} className={`max-w-[112px] truncate rounded-md border px-2 py-1 text-[11px] font-black ${isCurrent ? 'border-lime-200 bg-lime-100 text-[#07130f]' : 'border-lime-200/25 bg-emerald-900 text-lime-50'}`}>
                    {player.name}
                  </span>
                );
              }) : <span className="text-xs font-semibold text-emerald-100/45">-</span>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MultiDrawOptionCard({ option, selected = false, currentPlayerId = 0, children }) {
  const [pitchOpen, setPitchOpen] = useState(false);
  const teams = Array.isArray(option.teams) ? option.teams : [];

  return (
    <article className={`grid gap-3 rounded-lg border p-3 ${selected ? 'border-lime-200 bg-emerald-900/80' : 'border-lime-200/25 bg-emerald-950/65'}`}>
      <button className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-lime-200/25 bg-emerald-950/80 px-3 py-2 text-left text-lime-50" type="button" onClick={() => setPitchOpen((current) => !current)}>
        <span className="min-w-0">
          <strong className="block truncate text-sm font-black">{pitchOpen ? 'Ver lista' : 'Ver en cancha'}: Opcion {option.option_number}</strong>
          <small className="text-xs font-semibold text-emerald-100/75">Diferencia {Number(option.total_diff || 0).toFixed(1)}</small>
        </span>
        <span className="rounded-md border border-lime-200/25 bg-emerald-900 px-2.5 py-1 text-xs font-black text-lime-100">{Number(option.vote_count || 0)} votos</span>
      </button>

      {pitchOpen ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {teams.map((team) => <PitchTeam key={team.team_number} team={team} currentPlayerId={currentPlayerId} />)}
        </div>
      ) : (
        <div className="grid gap-3">
          {teams.map((team) => <TeamList key={team.team_number} team={team} currentPlayerId={currentPlayerId} />)}
        </div>
      )}

      {children}
    </article>
  );
}
