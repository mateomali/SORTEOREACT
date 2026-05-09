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
    button.classList.remove('bg-lime-100/15', 'text-lime-50');
    button.dataset.sortDirection = active ? sort.direction : '';
    button.setAttribute('aria-sort', active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    const icon = button.querySelector('span[aria-hidden="true"]');
    if (icon) icon.textContent = active ? (sort.direction === 'asc' ? '↑' : '↓') : '↕';
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
    <div className="player-list-react-controls grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 shadow-sm shadow-emerald-950/5 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="player-list-search-shell grid gap-1">
        <label className="mb-0 text-xs font-extrabold uppercase tracking-wide text-emerald-800" htmlFor="playerListSearchReact">Buscar jugador</label>
        <input
          className="player-list-search-input w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          id="playerListSearchReact"
          type="search"
          placeholder="Nombre, posicion o stats"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="player-list-react-side flex items-end">
        <span className="player-count-filter inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-100 bg-white px-3 py-2 text-xs font-extrabold text-emerald-950" aria-live="polite">
          <strong>{helperText}</strong>
          {canFilterActive ? (
            <label className="mb-0 inline-flex items-center gap-1.5 text-emerald-950">
              <input
                className="player-active-filter-checkbox"
                type="checkbox"
                checked={activeOnly}
                onChange={(event) => setActiveOnly(event.target.checked)}
              />
              <small className="text-xs font-extrabold text-emerald-950">Solo activos</small>
            </label>
          ) : null}
        </span>
      </div>
      <div className="player-mobile-sort-strip col-span-full hidden gap-1 max-[900px]:grid max-[900px]:grid-cols-3" aria-label="Ordenar jugadores">
        {[
          ['name', 'Nombre'],
          ['general', 'Puntaje'],
          ['positions', 'Posicion'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`min-h-9 rounded-xl border px-2 py-1 text-xs font-extrabold ${sort.key === key ? 'is-active border-lime-200 bg-lime-100 text-emerald-950' : 'border-lime-200/35 bg-emerald-950 text-lime-50'}`}
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
