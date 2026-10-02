import React, { useState } from 'react';

const panelClass = 'mx-auto w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/15 bg-white text-[#07130f] shadow-sm shadow-emerald-950/10';
const panelHeadClass = 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 border-b border-emerald-900/20 bg-emerald-950 px-3 py-2.5 text-lime-50';
const ratingClass = 'inline-flex h-10 w-10 items-center justify-center rounded-lg bg-lime-100 text-sm font-black leading-none text-[#07130f]';
const titleClass = 'mb-0 text-base font-black leading-tight text-[#07130f]';
const helpClass = 'text-[13px] font-semibold leading-snug text-slate-500';
const labelClass = 'mb-1 block text-xs font-black leading-tight text-[#07130f]';
const inputClass = 'h-10 w-full rounded-lg border border-emerald-900/25 bg-white px-3 text-sm font-bold text-[#07130f] outline-none placeholder:text-slate-500/70 placeholder:font-semibold focus:border-emerald-800 focus:ring-4 focus:ring-emerald-900/10 max-[760px]:h-9 max-[760px]:text-[13px]';
const passwordFieldClass = 'grid grid-cols-[minmax(0,1fr)_40px] items-stretch gap-1.5';
const passwordToggleClass = 'inline-flex h-10 items-center justify-center rounded-lg border border-emerald-900/15 bg-emerald-50 text-[#07130f] hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-900/15 max-[760px]:h-9';
const submitClass = 'inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-950 px-3 text-sm font-black text-white transition hover:bg-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-900/15 max-[760px]:h-9';
const detailsClass = 'group mt-3 rounded-lg border border-emerald-900/15 bg-emerald-50/55 px-2.5 py-1.5';
const summaryClass = 'flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-md text-[13px] font-black text-[#07130f] [&::-webkit-details-marker]:hidden';
const summaryIconClass = 'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-emerald-950 text-sm font-black leading-none text-white';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function EyeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PasswordInput({ id, name = 'password', autoComplete, minLength, placeholder, required = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={passwordFieldClass}>
      <input
        id={id}
        className={inputClass}
        type={visible ? 'text' : 'password'}
        name={name}
        autoComplete={autoComplete}
        minLength={minLength}
        placeholder={placeholder}
        required={required}
      />
      <button
        className={passwordToggleClass}
        type="button"
        data-password-toggle={id}
        aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'}
        aria-pressed={visible ? 'true' : 'false'}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon />
      </button>
    </div>
  );
}

function LoginHeader({ pendingUsername }) {
  return (
    <section className="mx-auto mb-3 flex w-full max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/15 bg-white px-3 py-3 shadow-sm shadow-emerald-950/5 max-[760px]:mb-2 max-[760px]:py-2">
      <div>
        <h1 className="mb-0 text-xl font-black leading-tight text-[#07130f] max-[760px]:text-lg">Ingreso</h1>
        <p className="text-[13px] font-semibold leading-snug text-slate-500 max-[760px]:hidden">
          Acceso para jugadores, directivos y administradores.
        </p>
      </div>
      <a className="inline-flex min-h-8 items-center justify-center rounded-lg border border-emerald-900/15 bg-white px-3 py-1.5 text-xs font-black text-[#07130f] no-underline hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-900/10" href="index.php">
        Volver al inicio
      </a>
    </section>
  );
}

function PlayerLoginForm({ next }) {
  return (
    <>
      <div className="mb-3 max-[760px]:mb-2">
        <h3 className={titleClass}>Entrar al sitio</h3>
        <p className={`${helpClass} max-[380px]:hidden`}>Usa tu usuario. El sistema abre las funciones segun tu rol.</p>
      </div>
      <form method="post" className="grid gap-2.5 max-[760px]:gap-2">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="role" value="user_login" />
        <div className="min-w-0">
          <label className={labelClass}>Usuario</label>
          <input className={inputClass} type="text" name="username" autoComplete="username" placeholder="tu_usuario" required autoFocus />
        </div>
        <div className="min-w-0">
          <label className={labelClass}>Clave</label>
          <PasswordInput id="userPassword" autoComplete="current-password" placeholder="Tu clave" required />
        </div>
        <button className={submitClass} type="submit">Entrar</button>
      </form>
    </>
  );
}

function PasswordResetForm({ pendingUsername }) {
  return (
    <>
      <div className="mb-3 max-[760px]:mb-2">
        <h3 className={titleClass}>Elegir clave nueva</h3>
        <p className={helpClass}>Ingresaste como {pendingUsername}. Cambia la clave para continuar.</p>
      </div>
      <form method="post" className="grid gap-2.5 max-[760px]:gap-2">
        <input type="hidden" name="role" value="site_user_change_password" />
        <div className="min-w-0">
          <label className={labelClass}>Nueva clave</label>
          <PasswordInput id="newSiteUserPassword" name="new_password" autoComplete="new-password" minLength="4" placeholder="Minimo 4 caracteres" required />
        </div>
        <div className="min-w-0">
          <label className={labelClass}>Repetir clave</label>
          <PasswordInput id="confirmSiteUserPassword" name="confirm_password" autoComplete="new-password" minLength="4" placeholder="Repetir clave" required />
        </div>
        <button className={submitClass} type="submit">Guardar y entrar</button>
      </form>
      <form method="post" className="mt-2">
        <input type="hidden" name="role" value="cancel_site_user_change_password" />
        <button className="inline-flex min-h-8 w-full items-center justify-center rounded-lg border border-emerald-900/15 bg-white px-3 py-1.5 text-xs font-black text-[#07130f] hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-900/10" type="submit">
          Ingresar con otro usuario
        </button>
      </form>
    </>
  );
}

function RegisterDetails({ registerPlayers }) {
  const hasPlayers = registerPlayers.length > 0;
  return (
    <details id="registro-jugador" className={detailsClass}>
      <summary className={summaryClass}>
        <span>Crear cuenta de jugador</span>
        <span className={`${summaryIconClass} group-open:hidden`}>+</span>
        <span className={`${summaryIconClass} hidden group-open:inline-flex`}>-</span>
      </summary>
      <div className="mt-3">
        <div className="mb-3">
          <h3 className={titleClass}>Vincularme a un jugador</h3>
          <p className={helpClass}>La cuenta queda vinculada a tu perfil de jugador.</p>
        </div>
        <form method="post" className="grid gap-2.5">
          <input type="hidden" name="role" value="player_register" />
          <div className="min-w-0">
            <label className={labelClass}>Mi jugador</label>
            <select className={inputClass} name="player_id" required>
              <option value="">Elegir jugador...</option>
              {registerPlayers.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className={labelClass}>Usuario</label>
            <input className={inputClass} type="text" name="username" autoComplete="username" placeholder="tu_usuario" required />
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div className="min-w-0">
              <label className={labelClass}>Clave</label>
              <PasswordInput id="registerPassword" autoComplete="new-password" minLength="6" placeholder="Minimo 6 caracteres" required />
            </div>
            <div className="min-w-0">
              <label className={labelClass}>Repetir clave</label>
              <PasswordInput id="registerConfirmPassword" name="confirm_password" autoComplete="new-password" minLength="6" placeholder="Repetir clave" required />
            </div>
          </div>
          <button className={`${submitClass} disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`} type="submit" disabled={!hasPlayers}>
            Vincular jugador
          </button>
          {!hasPlayers ? <p className={helpClass}>No quedan jugadores activos disponibles para registrar.</p> : null}
        </form>
      </div>
    </details>
  );
}

function AdminDetails({ next }) {
  return (
    <details id="login-admin" className="group w-full scroll-mt-20 rounded-xl border border-emerald-900/15 bg-white px-3 py-2 text-[#07130f] shadow-sm shadow-emerald-950/5">
      <summary className={summaryClass}>
        <span>Acceso admin inicial</span>
        <span className={`${summaryIconClass} group-open:hidden`}>+</span>
        <span className={`${summaryIconClass} hidden group-open:inline-flex`}>-</span>
      </summary>
      <form method="post" className="mt-3 grid gap-2.5">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="role" value="admin_bootstrap" />
        <div className="min-w-0">
          <label className={labelClass}>Clave admin global</label>
          <PasswordInput id="adminPassword" autoComplete="current-password" placeholder="Clave del administrador" />
        </div>
        <button className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-emerald-900/15 bg-emerald-50 px-3 text-sm font-black text-[#07130f] transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-900/10" type="submit">
          Entrar como admin
        </button>
      </form>
    </details>
  );
}

export function LoginPageIsland({ root }) {
  const payload = readPayload(root);
  const next = payload.next || 'index.php';
  const pendingUsername = payload.pendingUsername || '';
  const registerPlayers = Array.isArray(payload.registerPlayers) ? payload.registerPlayers : [];

  return (
    <>
      <LoginHeader pendingUsername={pendingUsername} />
      <section className="mx-auto grid w-full max-w-md gap-3 max-[760px]:gap-2">
        <article id="login-jugador" className={`${panelClass} scroll-mt-20`}>
          <div className={panelHeadClass}>
            <span className={ratingClass}>GF</span>
            <div>
              <strong className="block min-w-0 text-base font-black leading-tight text-lime-50">Goodfellas</strong>
              <span className="block min-w-0 text-xs font-extrabold leading-tight text-lime-100 max-[380px]:hidden">
                {pendingUsername ? 'Clave provisoria' : 'Cuenta de acceso'}
              </span>
            </div>
          </div>
          <div className="p-4 max-[760px]:p-3">
            {pendingUsername ? (
              <PasswordResetForm pendingUsername={pendingUsername} />
            ) : (
              <>
                <PlayerLoginForm next={next} />
                <RegisterDetails registerPlayers={registerPlayers} />
              </>
            )}
          </div>
        </article>
        {!pendingUsername ? <AdminDetails next={next} /> : null}
      </section>
    </>
  );
}
