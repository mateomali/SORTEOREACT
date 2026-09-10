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
const mutedButton = 'inline-flex min-h-10 items-center justify-center rounded-lg border border-lime-200/35 bg-emerald-950/80 px-3.5 py-2 text-sm font-extrabold text-lime-50 no-underline transition hover:bg-emerald-900';
const primaryButton = 'inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-lime-200/75 bg-lime-100 px-3.5 py-2 text-sm font-extrabold text-[#07130f] transition hover:bg-lime-200';

export function VotarSorteoPageIsland({ root }) {
  const payload = readPayload(root);
  const options = Array.isArray(payload.options) ? payload.options : [];

  return (
    <div className="grid gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-lime-200/60 bg-emerald-950 px-4 py-3 text-lime-50 shadow-sm shadow-emerald-950/15">
        <div>
          <h1 className="m-0 text-lime-50">Votar sorteo</h1>
          <p className="m-0 mt-1 text-sm font-semibold text-emerald-100/80">
            {payload.matchLabel} - podes cambiar tu voto hasta {payload.deadline}.
          </p>
        </div>
        <a className={mutedButton} href="perfil.php">Mi perfil</a>
      </section>

      {!options.length ? (
        <section className={panel}>
          <p className="text-sm font-semibold text-emerald-100/75">El admin todavia no genero las opciones de sorteo para esta fecha.</p>
        </section>
      ) : (
        <section className="grid gap-3 pb-2 lg:grid-cols-3">
          {options.map((option) => {
            const selected = Number(payload.selectedOptionId) === Number(option.id);
            return (
              <form key={option.id} method="post" className="min-w-0">
                <input type="hidden" name="match_id" value={payload.matchId} />
                <input type="hidden" name="option_id" value={option.id} />
                <MultiDrawOptionCard option={option} selected={selected} currentPlayerId={payload.currentPlayerId}>
                  <button className={selected ? `${mutedButton} w-full` : primaryButton} type="submit">
                    {selected ? 'Votado' : 'Votar esta opcion'}
                  </button>
                </MultiDrawOptionCard>
              </form>
            );
          })}
        </section>
      )}
    </div>
  );
}
