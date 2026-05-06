import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function FinishValuationControlsIsland({ root }) {
  const total = Number(root.dataset.total || 0);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(total);

  const helper = useMemo(() => (
    query.trim() === '' ? `${total} jugadores` : `${visible} de ${total} jugadores`
  ), [query, total, visible]);

  useEffect(() => {
    const rows = Array.from(document.querySelectorAll('[data-finish-player-row]'));
    const teams = Array.from(document.querySelectorAll('[data-finish-team]'));
    const empty = document.querySelector('[data-finish-valuations-empty]');
    const normalizedQuery = normalize(query);
    let nextVisible = 0;

    rows.forEach((row) => {
      const haystack = normalize(row.dataset.search || row.textContent || '');
      const matches = normalizedQuery === '' || haystack.includes(normalizedQuery);
      row.hidden = !matches;
      if (matches) {
        nextVisible += 1;
      }
    });

    teams.forEach((team) => {
      const hasVisibleRows = Array.from(team.querySelectorAll('[data-finish-player-row]'))
        .some((row) => !row.hidden);
      team.hidden = !hasVisibleRows;
    });

    if (empty) {
      empty.hidden = nextVisible !== 0;
    }
    setVisible(nextVisible);
  }, [query]);

  return (
    <div className="finish-valuation-controls" role="search">
      <label htmlFor="finishValuationSearch">Buscar jugador</label>
      <input
        id="finishValuationSearch"
        type="search"
        placeholder="Nombre, equipo o posicion"
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span aria-live="polite">{helper}</span>
    </div>
  );
}
