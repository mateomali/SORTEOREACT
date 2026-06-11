import { useEffect } from 'react';
import { ManualTeamsSearchAssistIsland } from './ManualTeamsSearchAssistIsland.jsx';

function readPayload(root) {
  try {
    return JSON.parse(root.dataset.payload || '{}');
  } catch {
    return {};
  }
}

const panelClass = 'rounded-xl border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-sm shadow-emerald-950/15';
const mutedButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900 sm:w-auto';

function StatusPanel({ children }) {
  return (
    <section className={panelClass}>
      <p className="m-0 rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm font-extrabold text-red-800">
        {children}
      </p>
    </section>
  );
}

function ManualTeamsShell({ payload }) {
  const match = payload.match || {};
  const config = payload.config || {};
  const players = Array.isArray(config.players) ? config.players : [];
  const expectedPlayers = Number(match.expectedPlayers || 0);
  const configJson = JSON.stringify(config);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent('goodfellas:init-manual-teams'));
  }, [configJson]);

  return (
    <section className={`${panelClass} manual-teams-shell`} data-manual-teams>
      <script
        type="application/json"
        data-manual-teams-config
        dangerouslySetInnerHTML={{ __html: configJson }}
      />
      <div className="section-toolbar">
        <div>
          <h3>{match.title}</h3>
          <p className="small-muted">
            {match.date} | {players.length}/{expectedPlayers} convocados | {match.numTeams} equipos de {match.playersPerTeam}
          </p>
        </div>
      </div>

      {players.length !== expectedPlayers ? (
        <div className="flash flash-error mt-3">
          La fecha tiene {players.length} convocados y necesita {expectedPlayers} para armar equipos iguales.
        </div>
      ) : null}

      <div className="manual-teams-status mt-3" data-manual-status />
      <div className="manual-team-color-toolbar mt-3" data-manual-color-toolbar />
      <div className="manual-player-search mt-3" role="search">
        <label htmlFor="manualPlayerSearch">Buscar jugador</label>
        <div className="manual-player-search-box">
          <span aria-hidden="true">Buscar</span>
          <input id="manualPlayerSearch" type="search" placeholder="Nombre, posicion, ritmo o puntaje..." autoComplete="off" data-manual-player-search />
        </div>
        <ManualTeamsSearchAssistIsland root={{ dataset: { target: 'manualPlayerSearch' } }} />
      </div>
      <div className="manual-teams-board mt-3" data-manual-board />
      <div className="manual-mobile-assign-panel" data-manual-mobile-panel hidden />
      <div className="manual-save-footer mt-3">
        <p className="small-muted" data-manual-formation-note>Completa todos los equipos para habilitar formaciones y guardar.</p>
        <div className="manual-team-characteristics" data-manual-team-characteristics hidden />
        <button className="btn btn-primary" type="button" data-manual-save>Guardar equipos</button>
      </div>
    </section>
  );
}

export function EquiposManualPageIsland({ root }) {
  const payload = readPayload(root);

  return (
    <div className="grid gap-4">
      <section className="flex flex-col gap-3 rounded-xl border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="m-0 text-lime-50">Equipos manuales</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            Asigna cada convocado a un equipo y guarda la fecha sin sorteo ni draft.
          </p>
        </div>
        <a className={mutedButton} href={payload.backUrl || 'editar_partidos.php'}>Volver a fechas</a>
      </section>

      {payload.state === 'missing' ? <StatusPanel>Fecha no encontrada.</StatusPanel> : null}
      {payload.state === 'finished' ? <StatusPanel>La fecha ya esta finalizada.</StatusPanel> : null}
      {payload.state === 'ready' ? <ManualTeamsShell payload={payload} /> : null}
    </div>
  );
}
