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

function parsePlayerPositions(positions) {
  const allowed = new Set(['ARQ', 'DEF', 'LAT', 'MED', 'DEL']);
  return String(positions || '')
    .split('/')
    .map((position) => position.trim().toUpperCase())
    .filter((position, index, list) => allowed.has(position) && list.indexOf(position) === index)
    .slice(0, 2);
}

function pitchLine(position) {
  const normalized = String(position || '').toUpperCase();
  return normalized === 'LAT' ? 'DEF' : normalized;
}

function positionFitFactor(playerPositions, position) {
  const normalizedPosition = String(position || '').toUpperCase();
  if (!normalizedPosition) return 1;
  const naturalIndex = playerPositions.indexOf(normalizedPosition);
  if (naturalIndex === 0) return 1;
  if (naturalIndex === 1) return 0.95;
  const naturalLines = playerPositions.map(pitchLine);
  return naturalLines.includes(pitchLine(normalizedPosition)) ? 0.90 : 0.90;
}

function recalculatePositionRating(rowStats, position, playerPositions, positionWeights) {
  const normalizedPosition = String(position || 'MED').toUpperCase();
  const weights = positionWeights[normalizedPosition] || positionWeights.MED || {};
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
  const fitFactor = positionFitFactor(playerPositions, normalizedPosition);
  return overallFromInternal(Math.round(adjusted * fitFactor * 10) / 10);
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

const panel = 'rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm';
const label = 'text-xs font-extrabold text-[#526b62]';
const selectClass = 'min-h-10 rounded-lg border border-[#adc8bb] bg-white px-3 text-sm font-bold text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60';

function HeaderPanel({ payload }) {
  return (
    <div className={`${panel} valuation-header-panel grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`}>
      <div className="valuation-header-copy">
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
        <form method="get" className="valuation-member-form grid gap-1 text-xs font-extrabold text-[#526b62]">
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
        {progress.map((row) => {
          const percent = totalPlayers > 0 ? Math.max(0, Math.min(100, Math.round((row.voted_players / totalPlayers) * 100))) : 0;
          return (
            <div key={row.id} className={`valuation-progress-card rounded-lg border border-[#d7e6df] bg-[#f8fbfa] p-2 ${row.complete ? 'is-complete' : ''}`}>
              <div className="valuation-progress-card-head">
                <strong className="block text-sm font-black text-[#07130f]">{row.name}</strong>
                <span className="text-xs font-bold text-[#526b62]">{row.voted_players}/{totalPlayers} jugadores</span>
              </div>
              <div className="valuation-progress-meter" aria-hidden="true">
                <span style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ValuationRow({ player, fields, labels, values, setValue, generals, positionWeights, isVisible = true }) {
  const rowStats = values[player.id] || player.stats || {};
  const positionRatings = generals[player.id] || [];
  const rowHasChanges = fields.some((field) => String(rowStats[field] ?? '') !== String(player.stats?.[field] ?? ''));
  const statusClass = rowHasChanges ? 'has-unsaved-values' : (player.voted ? 'is-voted' : 'is-pending-vote');
  const statusLabel = rowHasChanges ? 'Por guardar' : (player.voted ? 'Modificado' : '');

  const stepValue = (field, direction) => {
    const current = rowStats[field] === '' ? 0 : Number(rowStats[field]);
    const next = Math.max(0, Math.min(99, Math.round((Number.isFinite(current) ? current : 0) + direction)));
    setValue(player.id, field, String(next));
  };

  return (
    <tr
      className={`border-t border-[#d7e6df] ${statusClass} ${isVisible ? '' : 'is-valuation-filtered-out'}`}
      data-valuation-player-row
      data-primary-position={player.primaryPosition}
      data-valuation-status={statusLabel}
      aria-hidden={isVisible ? undefined : 'true'}
    >
      <td className="valuation-player-cell sticky left-0 z-10 bg-white px-3 py-2" data-label="Jugador">
        <div className="valuation-player-name-line">
          <strong className="block text-[#07130f]">{player.name}</strong>
          {statusLabel ? <span className="valuation-row-status">{statusLabel}</span> : null}
        </div>
        <div className="valuation-position-ratings" aria-label={`Puntajes por posicion de ${player.name}`}>
          {positionRatings.map((rating) => (
            <small key={rating.position} className={`valuation-position-rating ${rating.changed ? 'is-live-changed' : ''}`}>
              <span>{rating.position}</span>
              <strong>{rating.value}</strong>
            </small>
          ))}
        </div>
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
      <td className="valuation-save-cell px-2 py-2 text-center" data-label="Guardar">
        <button
          className="valuation-row-save-button"
          type="submit"
          name="save_player_id"
          value={player.id}
          disabled={!rowHasChanges}
          aria-label={`Guardar cambios de ${player.name}`}
          title={rowHasChanges ? `Guardar cambios de ${player.name}` : 'Sin cambios para guardar'}
        >
          <span>Guardar</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 4h11.2L20 7.8V20H5V4Zm2 2v12h11V8.6L15.4 6H15v5H8V6H7Zm3 0v3h3V6h-3Zm-1 9h7v-2H9v2Z" fill="currentColor" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

function ValuationForm({ payload }) {
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const labels = payload.labels || {};
  const players = Array.isArray(payload.players) ? payload.players : [];
  const positionWeights = payload.positionWeights || {};
  const [searchQuery, setSearchQuery] = useState('');
  const [values, setValues] = useState(() => Object.fromEntries(players.map((player) => [player.id, { ...(player.stats || {}) }])));
  const normalizedSearch = normalizeSearchText(searchQuery);
  const visiblePlayerIds = useMemo(() => {
    if (normalizedSearch === '') return new Set(players.map((player) => player.id));
    return new Set(players.filter((player) => normalizeSearchText(player.name).includes(normalizedSearch)).map((player) => player.id));
  }, [normalizedSearch, players]);
  const visibleCount = visiblePlayerIds.size;
  const votedCount = players.filter((player) => player.voted).length;
  const pendingCount = Math.max(0, players.length - votedCount);
  const resultText = normalizedSearch === ''
    ? `${players.length} jugadores`
    : `${visibleCount} de ${players.length} jugadores`;

  const generals = useMemo(() => {
    const next = {};
    players.forEach((player) => {
      const positions = parsePlayerPositions(player.positions);
      const naturalPositions = positions.length ? positions : [player.primaryPosition || 'MED'];
      next[player.id] = naturalPositions.map((position) => {
        const value = recalculatePositionRating(values[player.id], position, naturalPositions, positionWeights) ?? player.general;
        const initialValue = recalculatePositionRating(player.stats, position, naturalPositions, positionWeights) ?? player.general;
        return {
          position,
          value,
          changed: Number(value) !== Number(initialValue),
        };
      });
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
      <div className="valuation-search-bar rounded-lg border border-[#d7e6df] bg-white p-3 shadow-sm" role="search">
        <label className={label} htmlFor="valuationPlayerSearch">Buscar jugador</label>
        <div className="valuation-search-control">
          <input
            id="valuationPlayerSearch"
            className="min-h-10 w-full rounded-lg border border-[#adc8bb] bg-white py-2 pl-3 pr-10 text-sm font-bold text-[#07130f] outline-none focus:border-[#063d2b] focus:ring-2 focus:ring-lime-200/60"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nombre del jugador"
            autoComplete="off"
          />
          <svg className="valuation-search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.8 5.2a5.6 5.6 0 1 0 0 11.2 5.6 5.6 0 0 0 0-11.2Zm-7.1 5.6a7.1 7.1 0 1 1 12.7 4.4l3.6 3.6-1.2 1.2-3.6-3.6A7.1 7.1 0 0 1 3.7 10.8Z" fill="currentColor" />
          </svg>
        </div>
        <div className="valuation-status-summary" aria-live="polite">
          <span className="valuation-search-count">{resultText}</span>
          <span className="valuation-summary-chip is-voted">Modificados: {votedCount}</span>
          <span className="valuation-summary-chip is-pending">Pendientes: {pendingCount}</span>
        </div>
      </div>
      <section className="valuation-table-shell overflow-hidden rounded-lg border border-[#d7e6df] bg-white shadow-sm">
        <div className="valuation-table-wrap overflow-auto">
          <table className="valuation-table min-w-[1190px] w-full border-collapse text-sm">
            <thead className="bg-emerald-950 text-white">
              <tr>
                <th className="sticky left-0 z-20 bg-emerald-950 px-3 py-2 text-left">Jugador</th>
                <th className="px-3 py-2 text-left">Posiciones</th>
                {fields.map((field) => <th key={field} className="px-2 py-2 text-center">{labels[field] || field}</th>)}
                <th className="px-2 py-2 text-center">Guardar</th>
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
                  isVisible={visiblePlayerIds.has(player.id)}
                />
              ))}
            </tbody>
          </table>
          {normalizedSearch !== '' && visibleCount === 0 ? (
            <p className="valuation-search-empty m-0 p-4 text-sm font-bold text-[#526b62]">No hay jugadores que coincidan con la busqueda.</p>
          ) : null}
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
