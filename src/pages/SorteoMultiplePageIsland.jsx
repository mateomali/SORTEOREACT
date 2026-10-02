import React from 'react';
import { MultiDrawOptionCard } from './MultiDrawOptionCard.jsx';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const panel = 'rounded-lg border border-lime-200/55 bg-emerald-950 p-4 text-lime-50 shadow-sm shadow-emerald-950/15';
const mutedText = 'text-sm font-semibold leading-snug text-emerald-100/75';
const mutedButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900';
const primaryButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200';
const warningButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-300/75 bg-amber-300 px-3.5 py-2 text-sm font-extrabold text-amber-950 transition hover:bg-amber-200';

function StatBox({ label, value }) {
  return (
    <article className="rounded-lg border border-lime-200/45 bg-emerald-950 p-3 text-lime-50">
      <div className="text-xs font-black text-lime-100/80">{label}</div>
      <div className="mt-1 text-2xl font-black leading-none">{value}</div>
    </article>
  );
}

export function SorteoMultiplePageIsland({ root }) {
  const payload = readPayload(root);
  const options = Array.isArray(payload.options) ? payload.options : [];
  const winnerId = Number(payload.winnerId || 0);

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <div>
          <h1 className="m-0 text-lime-50">Sorteo multiple</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">{payload.matchLabel} - cierre {payload.deadline}</p>
        </div>
        <a className={mutedButton} href="editar_partidos.php">Volver</a>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <StatBox label="Jugadores" value={payload.participantsCount || 0} />
        <StatBox label="Variantes" value={payload.drawCount || 0} />
        <StatBox label="Cierre" value={`${payload.lockMinutes || 0}m`} />
      </section>

      <section className={panel}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="mb-1 text-lg font-black text-lime-50">Variantes</h3>
            <p className={mutedText}>La votacion es opcional. El admin puede cerrar cuando quiera o dejar que cierre por tiempo.</p>
          </div>
          {options.length && winnerId <= 0 ? (
            <form method="post">
              <input type="hidden" name="match_id" value={payload.matchId} />
              <button className={warningButton} type="submit" name="action" value="generate_options" data-confirm="Regenerar las variantes? Se borraran los votos existentes.">
                Regenerar variantes
              </button>
            </form>
          ) : null}
        </div>

        {!options.length ? (
          <p className={mutedText}>Las variantes se generan automaticamente al abrir esta pantalla si la fecha esta programada y tiene convocados validos.</p>
        ) : (
          <>
            {winnerId <= 0 ? (
              <form method="post" className="mb-3">
                <input type="hidden" name="match_id" value={payload.matchId} />
                <button className={primaryButton} type="submit" name="action" value="apply_current_winner" data-confirm="Finalizar la votacion ahora y aplicar la opcion ganadora actual?">
                  Finalizar votacion y aplicar ganadora
                </button>
              </form>
            ) : null}
            <div className="grid gap-3">
              {options.map((option) => (
                <MultiDrawOptionCard key={option.id} option={option} selected={winnerId === Number(option.id)} currentPlayerId={payload.currentPlayerId} />
              ))}
            </div>
          </>
        )}
      </section>

      {options.length && winnerId <= 0 ? (
        <section className={panel}>
          <h3 className="mb-1 text-lg font-black text-lime-50">Cierre automatico</h3>
          <p className={`${mutedText} mb-3`}>Al llegar el cierre, gana la opcion con mas votos. Si hay empate, gana la mas equilibrada.</p>
          <form method="post">
            <input type="hidden" name="match_id" value={payload.matchId} />
            <button className={mutedButton} type="submit" name="action" value="finalize_due">Probar cierre automatico ahora</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
