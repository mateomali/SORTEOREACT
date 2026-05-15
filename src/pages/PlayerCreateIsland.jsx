import { useMemo, useState } from 'react';
import { StatRating } from '../components/StatRating.jsx';

const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
const positionLabels = {
  ARQ: 'Arquero',
  DEF: 'Defensor',
  MED: 'Mediocampista',
  DEL: 'Delantero',
};
const fieldOrder = ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity'];
const defaults = {
  technique: 3,
  rhythm: 3,
  defense_physical: 3,
  attack: 3,
  teamwork: 3,
  mentality: 3,
  regularity: 4,
  goalkeeper_skill: 3,
};

const darkPanelStyle = {
  background: '#fbfdfc',
  borderColor: '#bfd7ce',
  color: '#07130f',
};

const darkControlStyle = {
  background: '#ffffff',
  borderColor: '#dbe7e2',
  color: '#07130f',
};

const darkInputStyle = {
  background: '#ffffff',
  borderColor: '#c9ddd4',
  color: '#07130f',
};

const limeBadgeStyle = {
  background: '#e8f8ef',
  borderColor: '#bfe3d3',
  color: '#063d2b',
};

function stars(value) {
  const full = Math.floor(value);
  const half = value % 1 !== 0;
  return `${'\u2605'.repeat(full)}${half ? '\u00bd' : ''}${'\u2606'.repeat(Math.max(0, 6 - full - (half ? 1 : 0)))}`;
}

function formatRating(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function cardOverallFromSix(value) {
  const clamped = Math.max(1, Math.min(6, Number(value) || 1));
  const anchors = [[1, 35], [2.5, 54], [3, 64], [3.2, 69], [3.5, 74], [3.8, 79], [4, 81], [4.4, 86], [4.5, 87], [5, 92], [5.2, 93], [5.3, 94], [6, 98]];
  for (let index = 0; index < anchors.length - 1; index += 1) {
    const [fromRating, fromOverall] = anchors[index];
    const [toRating, toOverall] = anchors[index + 1];
    if (clamped <= toRating) {
      const ratio = (clamped - fromRating) / (toRating - fromRating);
      return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
    }
  }
  return 98;
}

function overall(stats, selectedPositions) {
  const hasGoalkeeper = selectedPositions[0] === 'ARQ';
  const base = hasGoalkeeper
    ? (stats.goalkeeper_skill * 0.42)
      + (stats.defense_physical * 0.14)
      + (stats.rhythm * 0.10)
      + (stats.technique * 0.10)
      + (stats.teamwork * 0.14)
      + (stats.mentality * 0.10)
    : (stats.technique * 0.18)
      + (stats.rhythm * 0.18)
      + (stats.defense_physical * 0.18)
      + (stats.attack * 0.24)
      + (stats.teamwork * 0.12)
      + (stats.mentality * 0.10);
  const regularityFactor = 1 + ((stats.regularity - 3.5) / 50);
  return Math.max(1, Math.min(6, Math.round(base * regularityFactor * 10) / 10));
}

function radarPoint(centerX, centerY, radius, index, total) {
  const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / total);
  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
  };
}

function PlayerRadar({ stats, labels, hasGoalkeeper }) {
  const fields = (hasGoalkeeper
    ? fieldOrder.map((field) => (field === 'attack' ? 'goalkeeper_skill' : field))
    : fieldOrder);
  const shortLabels = {
    technique: 'TEC',
    rhythm: 'RIT',
    defense_physical: 'SOL',
    attack: 'ATA',
    teamwork: 'EQU',
    mentality: 'MEN',
    regularity: 'REG',
    goalkeeper_skill: 'ARQ',
  };
  const useShortLabels = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  const size = 240;
  const viewBoxHeight = 278;
  const centerX = size / 2;
  const centerY = 112;
  const maxRadius = 78;
  const labelRadius = 103;
  const levels = [1, 2, 3, 4, 5, 6];
  const polygon = fields.map((field, index) => {
    const value = Math.max(1, Math.min(6, Number(stats[field]) || 3));
    const point = radarPoint(centerX, centerY, maxRadius * (value / 6), index, fields.length);
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }).join(' ');

  return (
    <aside className="player-radar-card rounded-lg border p-3" style={darkPanelStyle} data-player-radar>
      <div className="player-radar-head mb-2 flex items-end justify-between gap-2">
        <strong className="text-sm font-extrabold" style={{ color: '#022c22' }}>Perfil del jugador</strong>
        <span className="text-xs font-bold" style={{ color: '#64748b' }}>Analisis de stats</span>
      </div>
      <div className="player-radar-canvas mx-auto w-full max-w-[260px]" data-player-radar-canvas>
        <svg className="player-radar-svg h-auto w-full overflow-visible" viewBox={`0 0 ${size} ${viewBoxHeight}`} role="img" aria-label="Diagrama de stats">
          <g className="radar-grid">
            {levels.map((level) => {
              const radius = maxRadius * (level / 6);
              const points = fields.map((_, index) => {
                const point = radarPoint(centerX, centerY, radius, index, fields.length);
                return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
              }).join(' ');
              return <polygon key={level} points={points} />;
            })}
          </g>
          <g className="radar-axis">
            {fields.map((field, index) => {
              const end = radarPoint(centerX, centerY, maxRadius, index, fields.length);
              const label = radarPoint(centerX, centerY, labelRadius, index, fields.length);
              const anchor = Math.abs(label.x - centerX) < 8 ? 'middle' : (label.x > centerX ? 'start' : 'end');
              return (
                <g key={field}>
                  <line x1={centerX} y1={centerY} x2={end.x.toFixed(1)} y2={end.y.toFixed(1)} />
                  <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor={anchor}>{useShortLabels ? shortLabels[field] : (labels[field] || field)}</text>
                </g>
              );
            })}
          </g>
          <polygon className="radar-shape" points={polygon} />
          <g className="radar-points">
            {fields.map((field, index) => {
              const value = Math.max(1, Math.min(6, Number(stats[field]) || 3));
              const point = radarPoint(centerX, centerY, maxRadius * (value / 6), index, fields.length);
              return (
                <circle key={field} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="4">
                  <title>{labels[field] || field} {value}/6</title>
                </circle>
              );
            })}
          </g>
          <text className="radar-scale" x={centerX} y={viewBoxHeight - 14} textAnchor="middle">Escala 1 a 6 puntos</text>
        </svg>
      </div>
    </aside>
  );
}

export function PlayerCreateIsland({ root }) {
  const labels = JSON.parse(root.dataset.labels || '{}');
  const help = JSON.parse(root.dataset.help || '{}');
  const ratingHelp = JSON.parse(root.dataset.ratingHelp || '{}');
  const weightHelp = JSON.parse(root.dataset.weightHelp || '{}');
  const showInactive = root.dataset.showInactive || '0';
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [selectedPositions, setSelectedPositions] = useState([]);
  const [stats, setStats] = useState(defaults);
  const hasGoalkeeper = selectedPositions[0] === 'ARQ';
  const general = useMemo(() => overall(stats, selectedPositions), [stats, selectedPositions]);
  const generalCard = cardOverallFromSix(general);
  const positionLabel = selectedPositions.length ? selectedPositions.join(' / ') : 'SIN POSICION';

  const updateStat = (field, value) => {
    setStats((current) => ({ ...current, [field]: value }));
  };

  const updatePosition = (index, position) => {
    setSelectedPositions((current) => {
      const next = [...current];
      next[index] = position;
      const clean = next.filter(Boolean).filter((item, itemIndex, list) => list.indexOf(item) === itemIndex);
      return clean.slice(0, 2);
    });
  };

  return (
    <details className="mb-3.5 player-create-drawer players-admin-create rounded-lg border p-0">
      <summary className="player-create-summary flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
        <span className="text-lg font-extrabold">Crear jugador</span>
        <small className="rounded-md px-2 py-1 text-xs font-extrabold">Nuevo perfil</small>
      </summary>
      <form method="post" className="player-create-body react-player-create-form border-t border-lime-200/30 p-4">
        <input type="hidden" name="action" value="save" />
        <input type="hidden" name="id" value="0" />
        <input type="hidden" name="show_inactive" value={showInactive} />

        <div className="player-create-topline form-grid">
          <div className="form-row">
            <label htmlFor="reactPlayerName">Nombre</label>
            <input
              className="rounded-lg border px-3 py-2.5 text-sm"
              id="reactPlayerName"
              type="text"
              name="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="form-row">
            <label>General</label>
            <div className="desktop-player-admin-general grid gap-2">
              <div className="desktop-player-card-overall grid items-center gap-2 rounded-lg border p-2" style={darkPanelStyle}>
                <div className="mobile-player-card-rating" style={limeBadgeStyle}>
                  <strong style={{ color: '#ffffff' }} data-general-card-value>{generalCard}</strong>
                  <span style={{ color: '#ffffff' }}>GEN</span>
                </div>
                <div className="mobile-player-card-meta">
                  <span style={{ color: '#047857' }}>GENERAL</span>
                  <strong style={{ color: '#022c22' }} data-general-card-position>{positionLabel}</strong>
                </div>
              </div>
              <div className="player-general-rating player-general-rating-compact flex min-h-0 flex-col items-start justify-center gap-1 rounded-lg border-0 px-0 py-0" style={{ ...darkControlStyle, padding: '.45rem .6rem' }} data-general-rating>
                <strong className="text-xs font-extrabold" style={{ color: '#022c22' }} data-general-rating-value>{formatRating(general)}/6</strong>
                <span className="text-sm leading-none text-amber-300" data-general-rating-stars>{stars(general)}</span>
              </div>
            </div>
          </div>
          <div className="form-row">
            <label>Estado</label>
            <label className="chip inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-extrabold">
              <input
                type="checkbox"
                name="active"
                value="1"
                checked={active}
                onChange={(event) => setActive(event.target.checked)}
              />
              Jugador activo
            </label>
          </div>
        </div>

        <div className="form-row player-create-positions-row">
          <label>Posiciones</label>
          <div className="player-position-selects" data-player-position-selects>
            {['Primaria', 'Secundaria'].map((label, index) => (
              <label className="player-position-select grid min-w-0 gap-1 rounded-lg border p-1.5" style={darkControlStyle} key={label}>
                <span className="truncate text-[10px] font-black" style={{ color: '#36554a' }}>{label}</span>
                <select
                  className="min-h-9 w-full min-w-0 rounded-lg border px-2 py-1.5 text-xs font-extrabold"
                  style={darkInputStyle}
                  name="positions[]"
                  required={index === 0}
                  value={selectedPositions[index] || ''}
                  onChange={(event) => updatePosition(index, event.target.value)}
                >
                  {index === 0 ? <option value="" disabled>Elegir</option> : <option value="">Sin posicion</option>}
                  {positions.map((position) => (
                    <option
                      key={position}
                      value={position}
                      disabled={selectedPositions.includes(position) && selectedPositions[index] !== position}
                    >
                      {positionLabels[position] || position}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>

        <div className="player-stats-editor grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="form-grid">
            {fieldOrder.map((field) => {
              return (
                <div className="form-row stat-form-row rounded-lg border p-3" style={darkPanelStyle} data-attack-stat-row={field === 'attack' ? '' : undefined} key={field}>
                  <label className="mb-2 text-xs font-extrabold" style={{ color: '#047857' }}>{labels[field] || field}</label>
                  <StatRating
                    name={field}
                    label={labels[field] || field}
                    value={stats[field]}
                    onChange={(value) => updateStat(field, value)}
                  />
                </div>
              );
            })}
            {hasGoalkeeper ? (
              <div className="form-row stat-form-row rounded-lg border p-3" style={darkPanelStyle} data-goalkeeper-stat-row>
                <label className="mb-2 text-xs font-extrabold" style={{ color: '#047857' }}>{labels.goalkeeper_skill || 'Habilidad de arquero'}</label>
                <StatRating
                  name="goalkeeper_skill"
                  label={labels.goalkeeper_skill || 'Habilidad de arquero'}
                  value={stats.goalkeeper_skill}
                  onChange={(value) => updateStat('goalkeeper_skill', value)}
                />
              </div>
            ) : null}
          </div>
          <PlayerRadar stats={stats} labels={labels} hasGoalkeeper={hasGoalkeeper} />
        </div>

        <details className="player-stat-help mt-2 rounded-xl border border-lime-200/55 bg-emerald-950 text-lime-50 shadow-md shadow-emerald-950/15" data-player-stat-help>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-extrabold text-lime-50">Como funciona?<span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-lime-100 text-base font-extrabold leading-none text-[#07130f] shadow-sm">?</span></summary>
          <div className="player-stat-help-body grid gap-3 border-t border-lime-200/30 bg-emerald-950/70 p-3 md:grid-cols-2">
            <section>
              <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-200">Stats</h4>
              {Object.entries(help).map(([field, text]) => (
                <p className="m-0 text-xs leading-snug text-emerald-50/80" key={field} data-stat-help={field}>
                  <strong className="text-lime-100">{labels[field] || field}:</strong> {text}
                </p>
              ))}
            </section>
            <section>
              <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-200">Puntuacion</h4>
              {Object.entries(ratingHelp).map(([label, text]) => (
                <p className="m-0 text-xs leading-snug text-emerald-50/80" key={label}><strong className="text-lime-100">{label}:</strong> {text}</p>
              ))}
            </section>
            <section className="player-stat-help-wide md:col-span-2">
              <h4 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-lime-200">Promedio general</h4>
              {Object.entries(weightHelp).map(([label, text]) => (
                <p className="m-0 text-xs leading-snug text-emerald-50/80" key={label}><strong className="text-lime-100">{label}:</strong> {text}</p>
              ))}
            </section>
          </div>
        </details>

        <div className="btn-row">
          <button className="btn border border-lime-200/55 bg-lime-100 text-[#07130f] hover:bg-lime-200" type="submit">Crear jugador</button>
        </div>
      </form>
    </details>
  );
}


