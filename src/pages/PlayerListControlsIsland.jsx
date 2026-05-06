import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function uniqueVisibleCount(rows) {
  const ids = new Set();
  rows.forEach((row) => {
    if (row.hidden || row.classList.contains('hidden')) return;
    const id = row.dataset.playerId || row.id || row.dataset.search || '';
    if (id !== '') {
      ids.add(id);
    }
  });
  return ids.size;
}

function sortValue(row, key) {
  const value = row.dataset[`sort${key.charAt(0).toUpperCase()}${key.slice(1)}`] || '';
  if (key === 'general' || key === 'stats' || key === 'active') {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) ? number : 0;
  }
  return normalize(value);
}

function syncSortHeaders(sort) {
  document.querySelectorAll('[data-player-sort]').forEach((button) => {
    const active = button.dataset.playerSort === sort.key;
    button.classList.toggle('is-active', active);
    button.dataset.sortDirection = active ? sort.direction : '';
    button.setAttribute('aria-sort', active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
  });
}

function sortContainer(selector, sort) {
  const container = document.querySelector(selector);
  if (!container) return;
  const rows = Array.from(container.querySelectorAll('[data-player-table-row]'));
  const direction = sort.direction === 'asc' ? 1 : -1;
  rows
    .sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * direction;
      }
      return String(left).localeCompare(String(right), 'es-AR', { numeric: true }) * direction;
    })
    .forEach((row) => container.appendChild(row));
}

function applySort(sort) {
  sortContainer('.players-desktop-table tbody', sort);
  sortContainer('.mobile-player-list-body', sort);
  syncSortHeaders(sort);
}

export function PlayerListControlsIsland({ root }) {
  const total = Number(root.dataset.total || 0);
  const canFilterActive = root.dataset.canFilterActive === '1';
  const [query, setQuery] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [visible, setVisible] = useState(total);
  const [sort, setSort] = useState({ key: 'name', direction: 'asc' });

  const helperText = useMemo(() => {
    if (query.trim() === '' && !activeOnly) {
      return `${total} jugadores`;
    }
    return `${visible} de ${total} jugadores`;
  }, [activeOnly, query, total, visible]);

  useEffect(() => {
    const rows = Array.from(document.querySelectorAll('[data-player-table-row]'));
    const empty = document.querySelector('[data-player-list-empty]');
    const normalizedQuery = normalize(query);

    rows.forEach((row) => {
      const haystack = normalize(row.dataset.search || '');
      const matchesQuery = normalizedQuery === '' || haystack.includes(normalizedQuery);
      const matchesActive = !activeOnly || row.dataset.sortActive === '1';
      const matches = matchesQuery && matchesActive;
      row.hidden = !matches;
      row.classList.toggle('hidden', !matches);
    });

    const nextVisible = uniqueVisibleCount(rows);
    setVisible(nextVisible);
    if (empty) {
      empty.hidden = nextVisible !== 0;
    }
  }, [activeOnly, query]);

  useEffect(() => {
    applySort(sort);
  }, [sort]);

  useEffect(() => {
    const buttons = Array.from(document.querySelectorAll('[data-player-sort]'));
    const cleanups = buttons.map((button) => {
      const onClick = () => {
        const key = button.dataset.playerSort || 'name';
        setSort((current) => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
      };
      button.addEventListener('click', onClick);
      return () => button.removeEventListener('click', onClick);
    });
    syncSortHeaders(sort);
    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  return (
    <div className="player-list-react-controls">
      <div className="player-list-search-shell">
        <label htmlFor="playerListSearchReact">Buscar jugador</label>
        <input
          id="playerListSearchReact"
          type="search"
          placeholder="Nombre, posicion o stats"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="player-list-react-side">
        <span className="player-count-filter" aria-live="polite">
          <strong>{helperText}</strong>
          {canFilterActive ? (
            <label>
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              <small>Solo activos</small>
            </label>
          ) : null}
        </span>
      </div>
      <div className="player-mobile-sort-strip" aria-label="Ordenar jugadores">
        {[
          ['name', 'Nombre'],
          ['general', 'Puntaje'],
          ['positions', 'Posicion'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={sort.key === key ? 'is-active' : ''}
            data-direction={sort.key === key ? sort.direction : ''}
            onClick={() => {
              setSort((current) => ({
                key,
                direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
              }));
            }}
          >
            <span>{label}</span>
            <strong>{sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '↕'}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
