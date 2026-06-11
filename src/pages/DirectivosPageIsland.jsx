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
const inputClass = 'w-full rounded-lg border border-lime-200/40 bg-emerald-950/92 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/55 focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25';
const labelClass = 'text-xs font-black uppercase text-lime-100/85';
const primaryButtonClass = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200';
const mutedButtonClass = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 transition hover:bg-emerald-900';
const dangerButtonClass = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200/80 bg-red-600 px-3.5 py-2 text-sm font-extrabold text-white transition hover:bg-red-700';
const smallMutedClass = 'text-sm font-semibold leading-snug text-emerald-100/75';

function SummaryCard({ label, value, warning = false }) {
  return (
    <div className={`rounded-xl border p-3 ${warning ? 'border-amber-200/75 bg-amber-50 text-amber-950' : 'border-lime-200/45 bg-emerald-950 text-lime-50'}`}>
      <span className={`block text-xs font-black uppercase ${warning ? 'text-amber-700' : 'text-lime-100/80'}`}>{label}</span>
      <strong className="mt-1 block text-2xl font-black leading-none">{value}</strong>
    </div>
  );
}

function CreateDirectivoForm() {
  return (
    <section className={panelClass}>
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-black text-lime-50">Nuevo directivo</h3>
        <p className={smallMutedClass}>Se crea con clave inicial 1234. Al primer ingreso queda obligado a elegir su clave privada.</p>
      </div>
      <form method="post" className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
        <input type="hidden" name="action" value="create_directivo" />
        <label className="grid gap-1.5">
          <span className={labelClass}>Nombre</span>
          <input className={inputClass} type="text" name="name" required autoComplete="off" placeholder="Nombre del directivo" />
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-lime-200/35 bg-emerald-950/92 px-3 py-2 text-sm font-bold text-lime-50">
          <input className="h-4 w-4 accent-lime-200" type="checkbox" name="active" value="1" defaultChecked />
          <span>Habilitado para votar</span>
        </label>
        <button className={primaryButtonClass} type="submit" data-confirm="Crear este directivo con clave inicial 1234?">
          Crear directivo
        </button>
      </form>
    </section>
  );
}

function VoteInviteMatch({ match }) {
  const invites = Array.isArray(match.invites) ? match.invites : [];
  const availablePlayers = Array.isArray(match.availablePlayers) ? match.availablePlayers : [];

  return (
    <article className="rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
      <div className="mb-3 grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-lime-100 text-lg font-black text-[#07130f]" aria-hidden="true">#</div>
        <div className="min-w-0">
          <strong className="block truncate text-lime-50">{match.label}</strong>
          <small className="block text-xs font-semibold text-emerald-100/75">{match.date}</small>
        </div>
        <span className="rounded-full border border-lime-200/35 bg-emerald-950/80 px-2.5 py-1 text-xs font-black text-lime-100">
          {invites.length} tokens
        </span>
      </div>

      {availablePlayers.length ? (
        <form method="post" className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <input type="hidden" name="action" value="create_vote_invite" />
          <input type="hidden" name="match_id" value={match.id} />
          <label className="grid gap-1.5">
            <span className={labelClass}>Jugador invitado</span>
            <select className={inputClass} name="player_id" required defaultValue="">
              <option value="">Seleccionar jugador</option>
              {availablePlayers.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
          <button className={primaryButtonClass} type="submit" data-confirm="Generar token para este jugador y esta votacion?">
            Generar token
          </button>
        </form>
      ) : (
        <p className={smallMutedClass}>Todos los jugadores activos ya tienen token para esta votacion.</p>
      )}

      {!invites.length ? (
        <p className={smallMutedClass}>Todavia no hay invitados para esta votacion.</p>
      ) : (
        <div className="grid gap-2">
          {invites.map((invite) => (
            <div key={`${invite.player_name}-${invite.token}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-lime-200/20 bg-emerald-950/70 px-3 py-2">
              <span>
                <strong className="block text-sm text-lime-50">{invite.player_name}</strong>
                <small>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${invite.vote_complete ? 'bg-lime-100 text-[#07130f]' : 'bg-amber-100 text-amber-950'}`}>
                    {invite.vote_complete ? 'Usado' : 'Pendiente'}
                  </span>
                </small>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-lime-200/35 bg-emerald-950 px-2.5 py-1 text-xs font-black text-lime-100">{invite.token}</span>
                <button className={`${mutedButtonClass} token-copy-btn min-h-8 px-3 py-1.5 text-xs`} type="button" data-copy-token={invite.token}>
                  Copiar
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function VoteInvitesSection({ matches }) {
  return (
    <section id="invitar-votantes" className={panelClass}>
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-black text-lime-50">Invitar jugadores a votar</h3>
        <p className={smallMutedClass}>Genera tokens numericos de 5 cifras solo para la ultima fecha finalizada con votacion abierta.</p>
      </div>
      {!matches.length ? (
        <p className={smallMutedClass}>No hay votaciones abiertas para generar tokens.</p>
      ) : (
        <div className="grid gap-3">
          {matches.map((match) => <VoteInviteMatch key={match.id} match={match} />)}
        </div>
      )}
    </section>
  );
}

function MemberCard({ member }) {
  const resetConfirm = `Reiniciar clave de ${member.name}? Volvera a ingresar con 1234 y debera cambiarla.`;
  const deleteConfirm = `Eliminar directivo ${member.name}? Tambien se eliminaran sus votos cargados.`;

  return (
    <form method="post" className="grid gap-3 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
      <input type="hidden" name="id" value={member.id} />
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-lime-100 text-lg font-black text-[#07130f]" aria-hidden="true">
          {member.initial || '?'}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-lime-50">{member.name}</strong>
          <small className="block text-xs font-semibold text-emerald-100/75">
            {member.needsPassword ? 'Debe crear su clave privada' : 'Clave privada activa'}
          </small>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${member.active ? 'bg-lime-100 text-[#07130f]' : 'bg-slate-200 text-slate-700'}`}>
          {member.active ? 'Habilitado' : 'Deshabilitado'}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-1.5">
          <span className={labelClass}>Usuario</span>
          <input className={inputClass} type="text" name="name" defaultValue={member.name} required />
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-lime-200/35 bg-emerald-950/92 px-3 py-2 text-sm font-bold text-lime-50">
          <input className="h-4 w-4 accent-lime-200" type="checkbox" name="active" value="1" defaultChecked={member.active === true} />
          <span>Puede votar</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${member.needsPassword ? 'bg-amber-100 text-amber-950' : 'bg-lime-100 text-[#07130f]'}`}>
          {member.needsPassword ? 'Clave pendiente' : 'Clave creada'}
        </span>
        <span className="text-xs font-semibold text-emerald-100/75">Reset: vuelve a 1234</span>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <button className={primaryButtonClass} type="submit" name="action" value="update_directivo">Guardar</button>
        <button className={mutedButtonClass} type="submit" name="action" value="reset_directivo_password" data-confirm={resetConfirm}>
          Reiniciar clave
        </button>
        <button className={dangerButtonClass} type="submit" name="action" value="delete_directivo" data-confirm={deleteConfirm}>
          Eliminar
        </button>
      </div>
    </form>
  );
}

function MembersSection({ members }) {
  return (
    <section className={panelClass}>
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-black text-lime-50">Junta habilitada</h3>
        <p className={smallMutedClass}>Administra usuarios, estado de voto y reinicio de clave.</p>
      </div>
      {!members.length ? (
        <p className={smallMutedClass}>Todavia no hay directivos cargados.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {members.map((member) => <MemberCard key={member.id} member={member} />)}
        </div>
      )}
    </section>
  );
}

export function DirectivosPageIsland({ root }) {
  const payload = readPayload(root);
  const summary = payload.summary || {};
  const members = Array.isArray(payload.members) ? payload.members : [];
  const voteInviteMatches = Array.isArray(payload.voteInviteMatches) ? payload.voteInviteMatches : [];

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <div>
          <h1 className="m-0 text-lime-50">Directivos</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            Habilita quienes pueden votar puntajes y premios despues de cada fecha finalizada.
          </p>
        </div>
        <a className={mutedButtonClass} href="editar_partidos.php">Volver</a>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total" value={summary.total || 0} />
        <SummaryCard label="Habilitados" value={summary.active || 0} />
        <SummaryCard label="Claves pendientes" value={summary.pendingPasswords || 0} warning={Number(summary.pendingPasswords || 0) > 0} />
      </section>

      <CreateDirectivoForm />
      <VoteInvitesSection matches={voteInviteMatches} />
      <MembersSection members={members} />
    </div>
  );
}
