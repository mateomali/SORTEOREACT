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
const mutedText = 'text-sm font-semibold leading-snug text-emerald-100/75';
const primaryButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-55';
const mutedButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-55';
const warningButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300/75 bg-amber-300 px-3.5 py-2 text-sm font-extrabold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-55';
const dangerButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200/80 bg-red-600 px-3.5 py-2 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-55';
const userActionButton = 'min-h-9 px-2 py-1.5 text-xs sm:min-h-10 sm:px-3.5 sm:py-2 sm:text-sm';

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-xl border border-lime-200/45 bg-emerald-950 p-3 text-lime-50">
      <span className="block text-xs font-black uppercase text-lime-100/80">{label}</span>
      <strong className="mt-1 block text-2xl font-black leading-none">{value}</strong>
    </div>
  );
}

function RoleOptions({ roleLabels, selected = 'jugador' }) {
  return Object.entries(roleLabels).map(([value, label]) => (
    <option key={value} value={value}>{label}</option>
  ));
}

function PlayerOptions({ players, currentUserId = null, linkedPlayerId = 0 }) {
  return (
    <>
      <option value="">Sin jugador</option>
      {players.map((player) => {
        const claimed = player.claimedBy !== null && player.claimedBy !== undefined;
        const claimedByOther = claimed && Number(player.claimedBy) !== Number(currentUserId);
        return (
          <option key={player.id} value={player.id} disabled={claimedByOther}>
            {player.name}{claimedByOther ? ' (ocupado)' : ''}
          </option>
        );
      })}
    </>
  );
}

function Toggle({ name, label, defaultChecked = false }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-lime-200/35 bg-emerald-950/92 px-3 py-2 text-sm font-bold text-lime-50">
      <input className="h-4 w-4 accent-lime-200" type="checkbox" name={name} value="1" defaultChecked={defaultChecked} />
      <span>{label}</span>
    </label>
  );
}

function CreateUserForm({ roleLabels, players }) {
  return (
    <section className={panelClass}>
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-black text-lime-50">Alta de usuario</h3>
        <p className={mutedText}>Crea una cuenta, vincula el jugador correspondiente y deja clave provisoria para primer ingreso.</p>
      </div>
      <form method="post" className="grid gap-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="grid gap-1.5">
            <span className={labelClass}>Usuario</span>
            <input className={inputClass} type="text" name="username" placeholder="nombre_usuario" autoComplete="off" required />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>Clave provisoria</span>
            <input className={inputClass} type="text" name="temporary_password" defaultValue="123456" minLength="6" required />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>Rol</span>
            <select className={inputClass} name="user_role" required defaultValue="jugador">
              <RoleOptions roleLabels={roleLabels} />
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>Jugador vinculado</span>
            <select className={inputClass} name="player_id" defaultValue="">
              <PlayerOptions players={players} />
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle name="active" label="Cuenta activa" defaultChecked />
          <Toggle name="can_vote" label="Puede votar premios y puntajes" defaultChecked />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950">Debe cambiar clave</span>
          <span className="text-xs font-semibold text-emerald-100/75">La clave provisoria se solicita cambiar en el primer login.</span>
        </div>
        <div>
          <button className={primaryButton} type="submit" name="action" value="create_user">Crear usuario</button>
        </div>
      </form>
    </section>
  );
}

function UserCard({ user, roleLabels, players, currentUserId }) {
  const linkedPlayerId = Number(user.player_id || 0);
  return (
    <form method="post" className="grid gap-3 rounded-xl border border-lime-200/25 bg-emerald-900/45 p-3">
      <input type="hidden" name="id" value={user.id} />
      <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-lime-100 text-lg font-black text-[#07130f]" aria-hidden="true">
          {user.initial || '?'}
        </div>
        <div className="min-w-0">
          <strong className="block truncate text-lime-50">{user.username}</strong>
          <small className="block text-xs font-semibold text-emerald-100/75">{linkedPlayerId > 0 ? user.player_name : 'Sin jugador vinculado'}</small>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${user.active ? 'bg-lime-100 text-[#07130f]' : 'bg-slate-200 text-slate-700'}`}>
          {user.roleLabel}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1.5">
          <span className={labelClass}>Usuario</span>
          <input className={inputClass} type="text" name="username" defaultValue={user.username} required />
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Rol</span>
          <select className={inputClass} name="user_role" required defaultValue={user.role}>
            <RoleOptions roleLabels={roleLabels} />
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className={labelClass}>Jugador vinculado</span>
          <select className={inputClass} name="player_id" defaultValue={linkedPlayerId > 0 ? String(linkedPlayerId) : ''}>
            <PlayerOptions players={players} currentUserId={user.id} linkedPlayerId={linkedPlayerId} />
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Toggle name="active" label="Cuenta activa" defaultChecked={user.active === true} />
        <Toggle name="can_vote" label="Puede votar premios y puntajes" defaultChecked={user.can_vote === true} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${user.active ? 'bg-lime-100 text-[#07130f]' : 'bg-amber-100 text-amber-950'}`}>
          {user.active ? 'Activo' : 'Bloqueado'}
        </span>
        {user.password_needs_reset ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-950">Debe cambiar clave</span> : null}
        <span className="text-xs font-semibold text-emerald-100/75">Creado {user.created_at}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <button className={`${primaryButton} ${userActionButton}`} type="submit" name="action" value="update_user">Guardar</button>
        <button className={`${mutedButton} ${userActionButton}`} type="submit" name="action" value="reset_user_password" data-confirm={`Reiniciar la clave de ${user.username} a 123456? En el proximo ingreso debera cambiarla.`}>Reset clave</button>
        <button className={`${warningButton} ${userActionButton}`} type="submit" name="action" value="unlink_user_player" disabled={linkedPlayerId <= 0} data-confirm={`Desvincular a ${user.player_name || ''} de la cuenta ${user.username}?`}>Desvincular jugador</button>
        <button className={`${dangerButton} ${userActionButton}`} type="submit" name="action" value="delete_user" disabled={Number(user.id) === Number(currentUserId)} data-confirm={`Eliminar definitivamente la cuenta ${user.username}?`}>Eliminar cuenta</button>
      </div>
    </form>
  );
}

function UsersList({ users, roleLabels, players, currentUserId }) {
  return (
    <section className={panelClass}>
      <div className="mb-3">
        <h3 className="mb-1 text-lg font-black text-lime-50">Cuentas del sitio</h3>
        <p className={mutedText}>Una cuenta puede estar vinculada a un jugador y tener rol usuario, jugador, directivo o admin.</p>
      </div>
      {!users.length ? (
        <p className={mutedText}>Todavia no hay cuentas creadas.</p>
      ) : (
        <div className="grid gap-3">
          {users.map((user) => (
            <UserCard key={user.id} user={user} roleLabels={roleLabels} players={players} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </section>
  );
}

export function UsuariosPageIsland({ root }) {
  const payload = readPayload(root);
  const summary = payload.summary || {};
  const users = Array.isArray(payload.users) ? payload.users : [];
  const players = Array.isArray(payload.players) ? payload.players : [];
  const roleLabels = payload.roleLabels || {};

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <div>
          <h1 className="m-0 text-lime-50">Usuarios</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">Asigna roles y permisos a las cuentas registradas.</p>
        </div>
        <a className={mutedButton} href="editar_partidos.php">Volver</a>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total" value={summary.total || 0} />
        <SummaryCard label="Activos" value={summary.active || 0} />
        <SummaryCard label="Jugadores" value={summary.players || 0} />
        <SummaryCard label="Habilitados voto" value={summary.canVote || 0} />
      </section>

      <CreateUserForm roleLabels={roleLabels} players={players} />
      <UsersList users={users} roleLabels={roleLabels} players={players} currentUserId={payload.currentUserId} />
    </div>
  );
}
