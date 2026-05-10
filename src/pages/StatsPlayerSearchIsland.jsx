import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '').toLocaleLowerCase('es-AR').trim();
}

export function StatsPlayerSearchIsland({ root }) {
  const players = JSON.parse(root.dataset.players || '[]');
  const [query, setQuery] = useState('');
  const hasQuery = query.trim() !== '';

  const selected = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return null;
    return players.find((player) => normalize(player.name) === normalized)
      || players.find((player) => normalize(player.name).includes(normalized))
      || null;
  }, [players, query]);

  useEffect(() => {
    const normalized = normalize(query);
    const rows = Array.from(document.querySelectorAll('[data-stats-player-row]'));
    const filterRows = Array.from(document.querySelectorAll('[data-stats-player-filter-row]'));
    const result = document.querySelector('[data-stats-player-result]');
    [...rows, ...filterRows].forEach((row) => row.classList.remove('is-highlighted'));

    if (!normalized) {
      result && (result.hidden = true);
      const profileCard = document.querySelector('[data-stats-selected-profile-card]');
      const profileTarget = document.querySelector('[data-stats-selected-profile]');
      if (profileCard) profileCard.hidden = true;
      if (profileTarget) profileTarget.innerHTML = '';
      [...rows, ...filterRows].forEach((row) => row.classList.remove('hidden'));
      return;
    }

    rows.forEach((row) => {
      const name = normalize(row.dataset.playerName);
      const matches = name.includes(normalized);
      row.classList.toggle('hidden', !matches);
      row.classList.toggle('is-highlighted', Boolean(selected) && name === normalize(selected.name));
    });
    filterRows.forEach((row) => {
      const name = normalize(row.dataset.playerName);
      const matches = name.includes(normalized);
      row.classList.toggle('hidden', !matches);
      row.classList.toggle('is-highlighted', Boolean(selected) && name === normalize(selected.name));
    });

    if (!result || !selected) {
      if (result) result.hidden = true;
      const profileCard = document.querySelector('[data-stats-selected-profile-card]');
      const profileTarget = document.querySelector('[data-stats-selected-profile]');
      if (profileCard) profileCard.hidden = true;
      if (profileTarget) profileTarget.innerHTML = '';
      return;
    }

    result.hidden = false;
    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value || '-';
    };
    setText('[data-stats-player-name]', selected.name);
    setText('[data-stats-player-matches]', selected.matches);
    setText('[data-stats-player-goals]', selected.goals);
    setText('[data-stats-player-rating]', selected.rating);
    setText('[data-stats-player-pg]', selected.pg);
    setText('[data-stats-player-pe]', selected.pe);
    setText('[data-stats-player-pp]', selected.pp);
    const profileCard = document.querySelector('[data-stats-selected-profile-card]');
    const profileTarget = document.querySelector('[data-stats-selected-profile]');
    const profileSource = selected.profileId ? document.getElementById(selected.profileId) : null;
    if (profileCard && profileTarget) {
      if (profileSource) {
        profileTarget.innerHTML = profileSource.innerHTML;
        profileCard.hidden = false;
        window.goodfellasHydrateDynamicContent?.(profileTarget);
      } else {
        profileTarget.innerHTML = '';
        profileCard.hidden = true;
      }
    }
  }, [query, selected]);

  return (
    <div
      className="stats-player-search react-stats-search"
      style={{
        display: 'grid',
        gridTemplateColumns: hasQuery ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
        gap: '6px',
        padding: '8px',
      }}
    >
      <label
        htmlFor="statsPlayerSearchReact"
        style={{ margin: 0, fontSize: '.78rem', lineHeight: 1, fontWeight: 900 }}
      >
        Buscar jugador
      </label>
      <input
        id="statsPlayerSearchReact"
        type="search"
        list="statsPlayerList"
        placeholder="Escribe o elige un jugador..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{
          minHeight: '38px',
          borderRadius: '10px',
          padding: '7px 10px',
          fontSize: '.84rem',
          fontWeight: 800,
        }}
      />
      {hasQuery ? (
        <button
          className="btn btn-muted"
          type="button"
          onClick={() => setQuery('')}
          style={{ minHeight: '38px', borderRadius: '10px', padding: '7px 10px', fontSize: '.72rem' }}
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
