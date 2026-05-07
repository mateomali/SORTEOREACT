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

function stars(value) {
  const full = Math.floor(value);
  const half = value % 1 !== 0;
  return `${'★'.repeat(full)}${half ? '½' : ''}${'☆'.repeat(Math.max(0, 6 - full - (half ? 1 : 0)))}`;
}

function formatRating(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
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
    <aside className="player-radar-card" data-player-radar>
      <div className="player-radar-head">
        <strong>Perfil del jugador</strong>
        <span>Analisis de stats</span>
      </div>
      <div className="player-radar-canvas" data-player-radar-canvas>
        <svg viewBox={`0 0 ${size} ${viewBoxHeight}`} role="img" aria-label="Diagrama de estrella de stats">
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
                  <text x={label.x.toFixed(1)} y={label.y.toFixed(1)} textAnchor={anchor}>{labels[field] || field}</text>
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
          <text className="radar-scale" x={centerX} y={viewBoxHeight - 14} textAnchor="middle">Escala 1 a 6 estrellas</text>
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
    <details className="card mb-3.5 player-create-drawer">
      <summary className="player-create-summary">
        <span>Agregar jugador</span>
        <small>Cargar nuevo jugador</small>
      </summary>
      <form method="post" className="player-create-body react-player-create-form">
        <input type="hidden" name="action" value="save" />
        <input type="hidden" name="id" value="0" />
        <input type="hidden" name="show_inactive" value={showInactive} />

        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="reactPlayerName">Nombre</label>
            <input
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
            <div className="player-general-rating" data-general-rating>
              <strong data-general-rating-value>{formatRating(general)}/6</strong>
              <span data-general-rating-stars>{stars(general)}</span>
            </div>
          </div>
          <div className="form-row">
            <label>Estado</label>
            <label className="chip">
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

        <div className="form-row">
          <label>Posiciones</label>
          <div className="player-position-selects" data-player-position-selects>
            {['Primaria', 'Secundaria'].map((label, index) => (
              <label className="player-position-select" key={label}>
                <span>{label}</span>
                <select
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

        <div className="player-stats-editor">
          <div className="form-grid">
            {fieldOrder.map((field) => {
              return (
                <div className="form-row stat-form-row" data-attack-stat-row={field === 'attack' ? '' : undefined} key={field}>
                  <label>{labels[field] || field}</label>
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
              <div className="form-row stat-form-row" data-goalkeeper-stat-row>
                <label>{labels.goalkeeper_skill || 'Habilidad de arquero'}</label>
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

        <details className="player-stat-help" data-player-stat-help>
          <summary>¿Como funciona?</summary>
          <div className="player-stat-help-body">
            <section>
              <h4>Stats</h4>
              {Object.entries(help).map(([field, text]) => (
                <p key={field} data-stat-help={field}>
                  <strong>{labels[field] || field}:</strong> {text}
                </p>
              ))}
            </section>
            <section>
              <h4>Puntuacion</h4>
              {Object.entries(ratingHelp).map(([label, text]) => (
                <p key={label}><strong>{label}:</strong> {text}</p>
              ))}
            </section>
            <section className="player-stat-help-wide">
              <h4>Promedio general</h4>
              {Object.entries(weightHelp).map(([label, text]) => (
                <p key={label}><strong>{label}:</strong> {text}</p>
              ))}
            </section>
          </div>
        </details>

        <div className="btn-row">
          <button className="btn btn-primary" type="submit">Crear jugador</button>
        </div>
      </form>
    </details>
  );
}
