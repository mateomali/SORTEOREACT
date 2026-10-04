import React, { useState } from 'react';

const panelClass = 'mx-auto w-full max-w-md overflow-hidden rounded-xl border border-emerald-900/15 bg-white text-[#07130f] shadow-sm shadow-emerald-950/10';
const panelHeadClass = 'grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 border-b border-emerald-900/20 bg-emerald-950 px-3 py-2.5 text-lime-50';
const ratingClass = 'inline-flex h-11 w-10 items-center justify-center rounded-lg bg-lime-100 text-sm font-black leading-none text-[#07130f]';
const titleClass = 'mb-0 text-base font-black leading-tight text-[#07130f]';
const helpClass = 'text-sm font-medium leading-relaxed text-[#526b62]';
const labelClass = 'mb-1 block text-sm font-bold leading-tight text-[#07130f]';
const inputClass = 'h-11 w-full rounded-lg border border-emerald-900/25 bg-white px-3 text-base font-medium text-[#07130f] outline-none placeholder:text-slate-500/70 placeholder:font-semibold focus:border-emerald-800 focus:ring-4 focus:ring-emerald-900/10';
const passwordFieldClass = 'grid grid-cols-[minmax(0,1fr)_44px] items-stretch gap-1.5';
const passwordToggleClass = 'inline-flex h-11 items-center justify-center rounded-lg border border-emerald-900/15 bg-emerald-50 text-[#07130f] hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-900/15';
const submitClass = 'inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-950 px-3 text-sm font-black text-white transition hover:bg-emerald-900 focus:outline-none focus:ring-4 focus:ring-emerald-900/15';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function EyeIcon({ visible }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="3" />
      {visible ? <path d="M3 3l18 18" /> : null}
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
        aria-controls={id}
        aria-label={visible ? 'Ocultar clave' : 'Mostrar clave'}
        aria-pressed={visible ? 'true' : 'false'}
        onClick={() => setVisible((current) => !current)}
      >
        <EyeIcon visible={visible} />
      </button>
    </div>
  );
}

function LoginHeader() {
  return (
    <section className="mx-auto mb-3 flex w-full max-w-md flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-900/15 bg-white px-3 py-3 shadow-sm shadow-emerald-950/5 max-[760px]:mb-2 max-[760px]:py-2">
      <div>
        <h1 className="mb-0 text-xl font-black leading-tight text-[#07130f] max-[760px]:text-lg">Iniciar sesión</h1>
        <p className="text-sm font-medium leading-relaxed text-[#526b62]">
          Acceso para jugadores, directivos y administradores.
        </p>
      </div>
      <a className="inline-flex min-h-8 items-center justify-center rounded-lg border border-emerald-900/15 bg-white px-3 py-1.5 text-xs font-black text-[#07130f] no-underline hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-900/10" href="index.php">
        Volver al inicio
      </a>
    </section>
  );
}

function PlayerLoginForm({ next, username }) {
  return (
    <>
      <div className="mb-3 max-[760px]:mb-2">
        <h3 className={titleClass}>Ingresar con tu cuenta</h3>
        <p className={`${helpClass}`}>Jugadores, directivos y administradores ingresan con su usuario y clave.</p>
      </div>
      <form method="post" className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="role" value="user_login" />
        <div className="min-w-0">
          <label className={labelClass} htmlFor="loginUsername">Usuario</label>
          <input id="loginUsername" defaultValue={username} className={inputClass} type="text" name="username" autoComplete="username" placeholder="tu_usuario" required autoFocus autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="min-w-0">
          <label className={labelClass} htmlFor="userPassword">Clave</label>
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
      <form method="post" className="grid gap-4">
        <input type="hidden" name="role" value="site_user_change_password" />
        <div className="min-w-0">
          <label className={labelClass} htmlFor="newSiteUserPassword">Nueva clave</label>
          <PasswordInput id="newSiteUserPassword" name="new_password" autoComplete="new-password" minLength="4" placeholder="Minimo 4 caracteres" required />
        </div>
        <div className="min-w-0">
          <label className={labelClass} htmlFor="confirmSiteUserPassword">Repetir clave</label>
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

function RegisterPanel({ registerPlayers }) {
  const hasPlayers = registerPlayers.length > 0;
  return (
    <div id="registro-jugador">
        <div className="mb-3">
          <h3 className={titleClass}>Vincularme a un jugador</h3>
          <p className={helpClass}>La cuenta queda vinculada a tu perfil de jugador.</p>
        </div>
        <form method="post" className="grid gap-2.5">
          <input type="hidden" name="role" value="player_register" />
          <div className="min-w-0">
            <label className={labelClass} htmlFor="registerPlayer">Mi jugador</label>
            <select id="registerPlayer" className={inputClass} name="player_id" required>
              <option value="">Elegir jugador...</option>
              {registerPlayers.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-0">
            <label className={labelClass} htmlFor="registerUsername">Usuario</label>
            <input id="registerUsername" className={inputClass} type="text" name="username" autoCapitalize="none" spellCheck={false} autoComplete="username" placeholder="tu_usuario" required />
          </div>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            <div className="min-w-0">
              <label className={labelClass} htmlFor="registerPassword">Clave</label>
              <PasswordInput id="registerPassword" autoComplete="new-password" minLength="6" placeholder="Minimo 6 caracteres" required />
            </div>
            <div className="min-w-0">
              <label className={labelClass} htmlFor="registerConfirmPassword">Repetir clave</label>
              <PasswordInput id="registerConfirmPassword" name="confirm_password" autoComplete="new-password" minLength="6" placeholder="Repetir clave" required />
            </div>
          </div>
          <button className={`${submitClass} disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500`} type="submit" disabled={!hasPlayers}>
            Vincular jugador
          </button>
          {!hasPlayers ? <p className={helpClass}>No quedan jugadores activos disponibles para registrar.</p> : null}
        </form>
    </div>
  );
}

function AdminPanel({ next }) {
  return (
    <div id="login-admin">
      <h3 className={titleClass}>Acceso de administrador</h3>
      <p className={`${helpClass} mt-2`}>Si tenés una cuenta de administrador, usá el formulario de usuario. Para ingresar con la clave global, usá este acceso.</p>
      <form method="post" className="mt-3 grid gap-2.5">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="role" value="admin_bootstrap" />
        <div className="min-w-0">
          <label className={labelClass} htmlFor="adminPassword">Clave admin global</label>
          <PasswordInput id="adminPassword" autoComplete="current-password" placeholder="Clave del administrador" required />
        </div>
        <button className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-emerald-900/15 bg-emerald-50 px-3 text-sm font-black text-[#07130f] transition hover:bg-emerald-100 focus:outline-none focus:ring-4 focus:ring-emerald-900/10" type="submit">
          Entrar como admin
        </button>
      </form>
    </div>
  );
}

export function LoginPageIsland({ root }) {
  const payload = readPayload(root);
  const next = payload.next || 'index.php';
  const pendingUsername = payload.pendingUsername || '';
  const registerPlayers = Array.isArray(payload.registerPlayers) ? payload.registerPlayers : [];
  const [panel, setPanel] = useState(payload.action === 'player_register' ? 'register' : payload.action === 'admin_bootstrap' ? 'admin' : 'login');
  const tabs = [['login', 'Ingresar'], ['register', 'Crear usuario'], ['admin', 'Administrador']];

  return (
    <>
      <LoginHeader />
      <section className="mx-auto grid w-full max-w-md gap-3">
        {!pendingUsername ? (
          <nav aria-label="Opciones de acceso" className="grid grid-cols-3 gap-1 rounded-lg border border-emerald-900/15 bg-white p-1">
            {tabs.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={panel === value} aria-controls={`access-${value}`} onClick={() => setPanel(value)} className={`min-h-11 rounded-md px-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-900/30 ${panel === value ? 'bg-emerald-950 text-white' : 'text-[#07130f] hover:bg-emerald-50'}`}>
                {label}
              </button>
            ))}
          </nav>
        ) : null}
        <article id="login-jugador" className={`${panelClass} scroll-mt-20`}>
          <div className={panelHeadClass}>
            <span className={ratingClass}>GF</span>
            <div>
              <strong className="block min-w-0 text-base font-black leading-tight text-lime-50">Goodfellas</strong>
              <span className="block min-w-0 text-xs font-extrabold leading-tight text-lime-100">
                {pendingUsername ? 'Clave provisoria' : tabs.find(([value]) => value === panel)[1]}
              </span>
            </div>
          </div>
          <div className="p-4 max-[760px]:p-4">
            {pendingUsername ? (
              <PasswordResetForm pendingUsername={pendingUsername} />
            ) : (
              <>
                <div id="access-login" hidden={panel !== 'login'}>
                  <PlayerLoginForm next={next} username={payload.username || ''} />
                </div>
                <div id="access-register" hidden={panel !== 'register'}>
                  <RegisterPanel registerPlayers={registerPlayers} />
                </div>
                <div id="access-admin" hidden={panel !== 'admin'}>
                  <AdminPanel next={next} />
                </div>
              </>
            )}
          </div>
        </article>
      </section>
    </>
  );
}
