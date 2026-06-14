import React, { useMemo, useState } from 'react';

function readPayload(root) {
  const raw = root.dataset.payload || root.querySelector('script[type="application/json"]')?.textContent || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const anchors = [
  [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
  [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
  [5.2, 93], [5.3, 94], [6.0, 99],
];

function normalizeInternal(value, fallback = 3.0) {
  const numeric = Number.isFinite(Number(value)) ? Number(value) : fallback;
  return Math.max(1.0, Math.min(6.0, Math.round(numeric * 10) / 10));
}

function internalFromOverall(value) {
  const overall = Math.max(0, Math.min(99, Number(value) || 0));
  if (overall <= 35) return 1.0;
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = anchors[index];
    const [toRating, toOverall] = anchors[index + 1];
    if (overall <= toOverall) {
      const ratio = (overall - fromOverall) / (toOverall - fromOverall);
      return normalizeInternal(fromRating + ((toRating - fromRating) * ratio));
    }
  }
  return 6.0;
}

function overallFromInternal(value) {
  const rating = normalizeInternal(value);
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = anchors[index];
    const [toRating, toOverall] = anchors[index + 1];
    if (rating <= toRating) {
      const ratio = (rating - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 99;
}

function recalculateGeneral(rowStats, primaryPosition, positionWeights) {
  const position = String(primaryPosition || 'MED').toUpperCase();
  const weights = positionWeights[position] || positionWeights.MED || {};
  let total = 0;
  let usedWeight = 0;
  Object.entries(rowStats || {}).forEach(([field, value]) => {
    const weight = Number(weights[field] || 0);
    if (weight <= 0) return;
    total += internalFromOverall(value) * weight;
    usedWeight += weight;
  });
  if (usedWeight <= 0) return null;
  const regularity = rowStats.regularity !== undefined ? internalFromOverall(rowStats.regularity) : 3.5;
  const adjusted = Math.max(1.0, Math.min(6.0, (total / usedWeight) * (1 + ((regularity - 3.5) / 50))));
  return overallFromInternal(Math.round(adjusted * 10) / 10);
}

const panel = 'rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm';
const label = 'text-xs font-extrabold text-[#526b62]';
const selectClass = 'min-h-10 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-bold text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60';

function HeaderPanel({ payload }) {
  return (
    <div className={`${panel} grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`}>
      <div>
        <h1 className="m-0 text-xl font-black leading-tight text-[#07130f]">Mis valoraciones</h1>
        <p className="m-0 mt-1 text-sm font-semibold text-[#526b62]">
          Carga de stats globales en escala 0-99. El promedio se calcula solo con directivos que hayan cargado valores.
        </p>
        {payload.currentMember ? (
          <p className="m-0 mt-1 text-xs font-bold text-[#526b62]">
            Directivo: <strong className="text-[#07130f]">{payload.currentMember.name}</strong>
          </p>
        ) : null}
      </div>
      {payload.isAdmin && payload.members?.length ? (
        <form method="get" className="grid gap-1 text-xs font-extrabold text-[#526b62]">
          <label htmlFor="directivo_id">Editar como</label>
          <select id="directivo_id" className={selectClass} name="directivo_id" defaultValue={payload.voterId || ''} onChange={(event) => event.currentTarget.form?.submit()}>
            <option value="">Elegir directivo</option>
            {payload.members.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </form>
      ) : null}
    </div>
  );
}

function ProgressPanel({ progress, totalPlayers }) {
  if (!progress?.length) return null;
  return (
    <section className={`${panel} grid gap-2 valuation-progress`}>
      <h2 className="m-0 text-base font-black text-[#07130f]">Estado de carga</h2>
      <div className="valuation-progress-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {progress.map((row) => (
          <div key={row.id} className="valuation-progress-card rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2">
            <strong className="block text-sm font-black text-[#07130f]">{row.name}</strong>
            <span className="text-xs font-bold text-[#526b62]">{row.voted_players}/{totalPlayers} jugadores</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValuationRow({ player, fields, labels, values, setValue, generals, positionWeights }) {
  const rowStats = values[player.id] || player.stats || {};
  const general = generals[player.id] ?? player.general;
  const changedGeneral = Number(general) !== Number(player.general);

  const stepValue = (field, direction) => {
    const current = rowStats[field] === '' ? 0 : Number(rowStats[field]);
    const next = Math.max(0, Math.min(99, Math.round((Number.isFinite(current) ? current : 0) + direction)));
    setValue(player.id, field, String(next));
  };

  return (
    <tr className="border-t border-[#d7e6df]" data-valuation-player-row data-primary-position={player.primaryPosition}>
      <td className="valuation-player-cell sticky left-0 z-10 bg-white px-3 py-2" data-label="Jugador">
        <strong className="block text-[#07130f]">{player.name}</strong>
        <small className="valuation-general-badge">
          <span>GEN</span>
          <strong className={`valuation-general-value ${changedGeneral ? 'is-live-changed' : ''}`} data-general-initial={player.general}>{general}</strong>
        </small>
      </td>
      <td className="valuation-position-cell px-3 py-2 font-bold text-[#526b62]" data-label="Posiciones">{player.positions}</td>
      {fields.map((field) => {
        const inputValue = rowStats[field] ?? '';
        const changed = String(inputValue) !== String(player.stats?.[field] ?? '');
        return (
          <td key={field} className={`valuation-stat-cell px-1.5 py-2 text-center ${changed ? 'is-stat-changed' : ''}`} data-label={labels[field] || field}>
            <div className="valuation-stepper">
              <button className="valuation-step-button" type="button" data-valuation-step="-1" aria-label={`Bajar ${labels[field] || field}`} onClick={() => stepValue(field, -1)}>-</button>
              <input
                className={`valuation-stat-input h-9 w-16 rounded-md border border-[#adc8bb] bg-white px-2 text-center text-sm font-black text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60 ${changed ? 'is-stat-changed' : ''}`}
                type="number"
                min="0"
                max="99"
                step="1"
                name={`stats[${player.id}][${field}]`}
                value={inputValue}
                inputMode="numeric"
                data-stat-field={field}
                data-initial-value={player.stats?.[field] ?? ''}
                onChange={(event) => setValue(player.id, field, event.target.value)}
              />
              <button className="valuation-step-button" type="button" data-valuation-step="1" aria-label={`Subir ${labels[field] || field}`} onClick={() => stepValue(field, 1)}>+</button>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

function ValuationForm({ payload }) {
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const labels = payload.labels || {};
  const players = Array.isArray(payload.players) ? payload.players : [];
  const positionWeights = payload.positionWeights || {};
  const [values, setValues] = useState(() => Object.fromEntries(players.map((player) => [player.id, { ...(player.stats || {}) }])));

  const generals = useMemo(() => {
    const next = {};
    players.forEach((player) => {
      next[player.id] = recalculateGeneral(values[player.id], player.primaryPosition, positionWeights) ?? player.general;
    });
    return next;
  }, [players, positionWeights, values]);

  const setValue = (playerId, field, value) => {
    setValues((current) => ({
      ...current,
      [playerId]: {
        ...(current[playerId] || {}),
        [field]: value,
      },
    }));
  };

  if (!payload.currentMember) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-[#7a4b00]">
        Selecciona un directivo para cargar valoraciones.
      </section>
    );
  }

  return (
    <form method="post" className="valuation-form grid gap-3">
      <section className="valuation-table-shell overflow-hidden rounded-lg border border-[#d7e6df] bg-white shadow-sm">
        <div className="valuation-table-wrap overflow-auto">
          <table className="valuation-table min-w-[1120px] w-full border-collapse text-sm">
            <thead className="bg-emerald-950 text-white">
              <tr>
                <th className="sticky left-0 z-20 bg-emerald-950 px-3 py-2 text-left">Jugador</th>
                <th className="px-3 py-2 text-left">Posiciones</th>
                {fields.map((field) => <th key={field} className="px-2 py-2 text-center">{labels[field] || field}</th>)}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <ValuationRow
                  key={player.id}
                  player={player}
                  fields={fields}
                  labels={labels}
                  values={values}
                  setValue={setValue}
                  generals={generals}
                  positionWeights={positionWeights}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="valuation-actions flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm">
        <p className="m-0 text-xs font-bold text-[#526b62]">Guardar recalcula los promedios generales usando solo valoraciones cargadas.</p>
        <button className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#063d2b] bg-[#063d2b] px-4 text-sm font-black text-white hover:bg-[#082f23]" type="submit">
          Guardar valoraciones
        </button>
      </div>
    </form>
  );
}

export function MisValoracionesPageIsland({ root }) {
  const payload = readPayload(root);
  const players = Array.isArray(payload.players) ? payload.players : [];

  return (
    <section className="mx-auto grid w-full max-w-7xl gap-3 px-3 py-3 text-[#07130f] sm:px-5 lg:py-5">
      <HeaderPanel payload={payload} />
      {payload.isAdmin ? <ProgressPanel progress={payload.progress || []} totalPlayers={players.length} /> : null}
      <ValuationForm payload={payload} />
    </section>
  );
}
