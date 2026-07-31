import React from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const panelClass = 'rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-sm shadow-emerald-950/15';
const mutedText = 'text-sm font-semibold leading-snug text-emerald-100/75';
const chipClass = 'inline-flex min-h-7 items-center rounded-full border border-lime-200/35 bg-emerald-950/80 px-2.5 py-1 text-xs font-black text-lime-100';
const inputClass = 'w-full rounded-lg border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/55 focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25';
const compactInputClass = 'min-h-9 w-full rounded-lg border border-lime-200/35 bg-emerald-950/92 px-2.5 py-2 text-sm font-bold text-lime-50 outline-none focus:border-lime-200 focus:ring-2 focus:ring-lime-200/20';
const primaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200';
const mutedButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900';
const warningButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300/75 bg-amber-300 px-3.5 py-2 text-sm font-extrabold text-amber-950 transition hover:bg-amber-200';

function VoteCard({ match }) {
  return (
    <a
      className={`grid gap-2 rounded-xl border p-3 text-lime-50 no-underline transition hover:bg-emerald-900/60 ${match.selected ? 'border-lime-200 bg-emerald-900/80' : 'border-lime-200/25 bg-emerald-900/45'}`}
      href={`junta_votaciones.php?match_id=${match.id}`}
    >
      <h3 className="m-0 text-base font-black text-lime-50">{match.label}</h3>
      <p className="m-0 text-xs font-semibold text-emerald-100/75">{match.date}</p>
      <div className="flex flex-wrap gap-2">
        <span className={chipClass}>{match.submitted}/{match.eligible} votos</span>
        <span className={chipClass}>Abierta</span>
      </div>
      <small className="text-xs font-semibold text-emerald-100/75">Cierre: {match.deadline}</small>
    </a>
  );
}

function OpenVotes({ matches }) {
  return (
    <section className={panelClass}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="mb-1 text-lg font-black text-lime-50">Votaciones abiertas</h3>
          <p className={mutedText}>Fechas con votacion activa y tiempo disponible.</p>
        </div>
        <span className={chipClass}>{matches.length} abiertas</span>
      </div>
      {!matches.length ? (
        <p className={mutedText}>No hay votaciones abiertas en este momento.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matches.map((match) => <VoteCard key={match.id} match={match} />)}
        </div>
      )}
    </section>
  );
}

function HistoryVotes({ matches }) {
  return (
    <details className={panelClass}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-lime-50 [&::-webkit-details-marker]:hidden">
        <span>Historial de votaciones</span>
        <small className="text-xs font-black text-lime-100">{matches.length} fechas</small>
      </summary>
      {!matches.length ? (
        <p className={`${mutedText} mt-3`}>Todavia no hay historial de votaciones cerradas.</p>
      ) : (
        <div className="mt-3 grid gap-2">
          {matches.map((match) => (
            <a
              key={match.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-lime-50 no-underline hover:bg-emerald-900/55 ${match.selected ? 'border-lime-200 bg-emerald-900/75' : 'border-lime-200/20 bg-emerald-900/35'}`}
              href={`junta_votaciones.php?match_id=${match.id}`}
            >
              <span className="min-w-0">
                <strong className="block truncate text-sm">{match.label}</strong>
                <small className="block text-xs font-semibold text-emerald-100/75">{match.date} | {match.historyStatus}</small>
              </span>
              <span className={chipClass}>{match.submitted}/{match.eligible} votos</span>
            </a>
          ))}
        </div>
      )}
    </details>
  );
}

function StatusPanel({ match }) {
  return (
    <section className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 text-lg font-black text-lime-50">{match.label}</h3>
          <p className={mutedText}>
            {match.submitted}/{match.eligible} directivos votaron. Cierre automatico: {match.deadline}.
          </p>
          <div className="mt-3 h-3 overflow-hidden rounded-full border border-lime-200/25 bg-emerald-900" aria-label={`Progreso de votacion ${match.progress}%`}>
            <span className="block h-full rounded-full bg-lime-200" style={{ width: `${match.progress}%` }} />
          </div>
        </div>
        <span className={chipClass}>{match.statusLabel}</span>
      </div>

      {match.isAdmin && !match.publication ? (
        <form method="post" className="mt-3">
          <input type="hidden" name="action" value="force_publish_directive_vote" />
          <input type="hidden" name="match_id" value={match.id} />
          <button className={warningButton} type="submit" data-confirm="Finalizar la votacion y publicar resultados con los votos cargados hasta ahora?">
            Finalizar votacion
          </button>
        </form>
      ) : null}

      {match.statusMessage ? (
        <p
          id="junta-voto-estado"
          className={`mt-3 rounded-lg border px-3 py-2 text-sm font-bold ${match.showReturnHome || match.myVoteComplete ? 'border-lime-200 bg-lime-100 text-[#07130f]' : 'border-lime-200/25 bg-emerald-900/35 text-emerald-100'}`}
          tabIndex="-1"
          role={match.showReturnHome || match.myVoteComplete ? 'status' : undefined}
          data-junta-return-home={match.showReturnHome ? '1' : undefined}
        >
          {match.statusMessage}
        </p>
      ) : !match.isDirectivo ? (
        <p className="mt-3 rounded-lg border border-sky-200/65 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-950">
          {match.isAdmin ? 'Como admin podes ver el estado, invitar jugadores y cerrar la votacion.' : 'Ingresa los puntajes y premios con tu token de invitacion.'}
        </p>
      ) : null}
    </section>
  );
}

function InvitePanel({ match }) {
  const inviteRows = Array.isArray(match.inviteRows) ? match.inviteRows : [];
  const playerOptions = Array.isArray(match.invitePlayerOptions) ? match.invitePlayerOptions : [];
  if (!match.isAdmin || match.publication || !match.isOpen) return null;

  return (
    <section className={panelClass}>
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-black text-lime-50">Invitar jugadores a votar</h3>
        <p className={mutedText}>Genera tokens numericos de 5 cifras. Cada token sirve solo para esta fecha.</p>
      </div>
      {playerOptions.length ? (
        <form method="post" className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <input type="hidden" name="action" value="create_vote_invite" />
          <input type="hidden" name="match_id" value={match.id} />
          <label className="grid gap-1.5">
            <span className="text-xs font-black uppercase text-lime-100/85">Jugador invitado</span>
            <select className={inputClass} name="player_id" required defaultValue="">
              <option value="">Seleccionar jugador</option>
              {playerOptions.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
          <button className={primaryButton} type="submit" data-confirm="Generar token para este jugador y esta votacion?">
            Generar token
          </button>
        </form>
      ) : (
        <p className={mutedText}>Todos los jugadores activos ya tienen token para esta votacion.</p>
      )}
      {!inviteRows.length ? (
        <p className={mutedText}>Todavia no hay invitados para esta votacion.</p>
      ) : (
        <div className="grid gap-2">
          {inviteRows.map((invite) => (
            <div key={`${invite.player_name}-${invite.token}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-lime-200/20 bg-emerald-900/35 px-3 py-2">
              <span>
                <strong className="block text-sm text-lime-50">{invite.player_name}</strong>
                <small>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${invite.vote_complete ? 'bg-lime-100 text-[#07130f]' : 'bg-amber-100 text-amber-950'}`}>
                    {invite.vote_complete ? 'Usado' : 'Pendiente'}
                  </span>
                </small>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className={chipClass}>{invite.token}</span>
                <button className={`${mutedButton} token-copy-btn min-h-8 px-3 py-1.5 text-xs`} type="button" data-copy-token={invite.token}>
                  Copiar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PublishedResults({ match }) {
  if (!match.publication) return null;
  return (
    <>
      <section className={panelClass}>
        <h3 className="mb-3 text-lg font-black text-lime-50">Resultados publicados</h3>
        <div className="overflow-x-auto rounded-lg border border-lime-200/25">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-emerald-900/70">
              <tr>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Jugador</th>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Equipo</th>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Puntaje final</th>
              </tr>
            </thead>
            <tbody>
              {match.participants.map((player) => (
                <tr key={player.id}>
                  <td className="border-b border-lime-200/10 px-3 py-2"><strong>{player.name}</strong></td>
                  <td className="border-b border-lime-200/10 px-3 py-2 text-emerald-100">{player.teamLabel}</td>
                  <td className="border-b border-lime-200/10 px-3 py-2"><strong>{player.finalRating}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={panelClass}>
        <h3 className="mb-3 text-lg font-black text-lime-50">Premios</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {match.awards.map((award) => (
            <div key={award.code} className="rounded-lg border border-lime-200/25 bg-emerald-900/45 p-3">
              <label className="mb-2 flex items-center gap-2 text-sm font-black text-lime-50">
                <span title={award.label}>{award.icon}</span>
                <span>{award.label}</span>
              </label>
              <strong className="text-emerald-100">{award.winner}</strong>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function VoteForm({ match }) {
  if (match.publication || match.currentVoteMemberId <= 0 || !match.isOpen) return null;
  const playerOptions = match.participants || [];
  const goalkeeperOptions = playerOptions.filter((player) => player.isGoalkeeper);

  return (
    <form method="post" className="grid gap-4" data-junta-vote-submit="1">
      <input type="hidden" name="action" value="save_directive_vote" />
      <input type="hidden" name="match_id" value={match.id} />
      <datalist id="matchAwardPlayers">
        {playerOptions.map((player) => <option key={player.id} value={player.awardValue} />)}
      </datalist>
      <datalist id="matchAwardGoalkeepers">
        {goalkeeperOptions.map((player) => <option key={player.id} value={player.awardValue} />)}
      </datalist>

      <details className={panelClass} open>
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-lime-50 [&::-webkit-details-marker]:hidden">
          <span>Puntajes</span>
          <small className="text-xs font-black text-lime-100">Promedio final por junta</small>
        </summary>
        <div className="mt-3 overflow-x-auto rounded-lg border border-lime-200/25">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead className="bg-emerald-900/70">
              <tr>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Jugador</th>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Equipo</th>
                <th className="border-b border-lime-200/20 px-3 py-2 text-left text-xs font-black uppercase text-lime-100">Puntaje</th>
              </tr>
            </thead>
            <tbody>
              {playerOptions.map((player) => (
                <tr key={player.id}>
                  <td className="border-b border-lime-200/10 px-3 py-2"><strong>{player.name}</strong></td>
                  <td className="border-b border-lime-200/10 px-3 py-2"><small className="font-semibold text-emerald-100/75">{player.teamLabel}</small></td>
                  <td className="border-b border-lime-200/10 px-3 py-2">
                    <input className={`${compactInputClass} max-w-28`} type="number" min="1" max="10" step="0.5" name={`rating[${player.id}]`} defaultValue={player.ratingValue} required />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className={panelClass} open>
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-lime-50 [&::-webkit-details-marker]:hidden">
          <span>Premios</span>
          <small className="text-xs font-black text-lime-100">Gana quien tenga mas votos</small>
        </summary>
        <p className={`${mutedText} mt-3`}>En caso de empate define: mas promedio de junta, mas goles y luego nombre alfabetico.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {match.awards.map((award) => (
            <div key={award.code} className="grid gap-1.5 rounded-lg border border-lime-200/25 bg-emerald-900/45 p-3">
              <label className="flex items-center gap-2 text-sm font-black text-lime-50" htmlFor={`award-${award.code}`}>
                <span title={award.label}>{award.icon}</span>
                <span>{award.label}</span>
              </label>
              <input
                id={`award-${award.code}`}
                className={inputClass}
                type="text"
                list={award.listId}
                name={`awards[${award.code}]`}
                defaultValue={award.value}
                placeholder="Buscar jugador"
              />
            </div>
          ))}
        </div>
      </details>

      <div className="flex justify-end">
        <button className={primaryButton} type="submit">Enviar voto</button>
      </div>
    </form>
  );
}

function ClosedNotice({ match }) {
  if (match.publication || (match.currentVoteMemberId > 0 && match.isOpen)) return null;
  return (
    <section className={panelClass}>
      <p className={mutedText}>La votacion no esta abierta para este usuario o ya termino el plazo. Al refrescar la pagina se revisa si corresponde publicar.</p>
    </section>
  );
}

export function JuntaVotacionesPageIsland({ root }) {
  const payload = readPayload(root);
  const openVoteMatches = Array.isArray(payload.openVoteMatches) ? payload.openVoteMatches : [];
  const historyVoteMatches = Array.isArray(payload.historyVoteMatches) ? payload.historyVoteMatches : [];
  const selectedMatch = payload.selectedMatch || null;

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <div>
          <h1 className="m-0 text-lime-50">Junta directiva</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">Votacion de puntajes y premios de fechas finalizadas.</p>
        </div>
        {payload.isAdmin ? <a className={mutedButton} href="directivos.php">Administrar directivos</a> : null}
      </section>

      {!payload.hasMatches ? (
        <section className={panelClass}>
          <p className={mutedText}>No hay fechas finalizadas para votar.</p>
        </section>
      ) : (
        <>
          <OpenVotes matches={openVoteMatches} />
          <HistoryVotes matches={historyVoteMatches} />
          {selectedMatch ? (
            <>
              <StatusPanel match={selectedMatch} />
              <InvitePanel match={selectedMatch} />
              <PublishedResults match={selectedMatch} />
              <VoteForm match={selectedMatch} />
              <ClosedNotice match={selectedMatch} />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
