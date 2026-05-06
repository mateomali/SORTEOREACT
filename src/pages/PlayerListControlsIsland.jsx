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

export function PlayerListControlsIsland({ root }) {
  const total = Number(root.dataset.total || 0);
  const toggleUrl = root.dataset.toggleUrl || '';
  const toggleLabel = root.dataset.toggleLabel || '';
  const modeLabel = root.dataset.modeLabel || '';
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(total);

  const helperText = useMemo(() => {
    if (query.trim() === '') {
      return `${total} jugadores`;
    }
    return `${visible} de ${total} jugadores`;
  }, [query, total, visible]);

  useEffect(() => {
    const rows = Array.from(document.querySelectorAll('[data-player-table-row]'));
    const empty = document.querySelector('[data-player-list-empty]');
    const normalizedQuery = normalize(query);

    rows.forEach((row) => {
      const haystack = normalize(row.dataset.search || '');
      const matches = normalizedQuery === '' || haystack.includes(normalizedQuery);
      row.hidden = !matches;
      row.classList.toggle('hidden', !matches);
    });

    const nextVisible = uniqueVisibleCount(rows);
    setVisible(nextVisible);
    if (empty) {
      empty.hidden = nextVisible !== 0;
    }
  }, [query]);

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
        <span aria-live="polite">{helperText}</span>
        {modeLabel ? <small>{modeLabel}</small> : null}
        {toggleUrl && toggleLabel ? (
          <a className="btn btn-muted" href={toggleUrl}>
            {toggleLabel}
          </a>
        ) : null}
      </div>
    </div>
  );
}
