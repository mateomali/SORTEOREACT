import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function HistorySearchIsland({ root }) {
  const total = Number(root.dataset.total || 0);
  const inputId = root.dataset.inputId || 'homeHistorySearch';
  const [query, setQuery] = useState('');
  const [year, setYear] = useState('');
  const [status, setStatus] = useState('');
  const options = useMemo(() => {
    const cards = Array.from(document.querySelectorAll('[data-home-history-card]'));
    return { years: [...new Set(cards.map(card => card.dataset.year).filter(Boolean))].sort().reverse(), statuses: [...new Map(cards.map(card => [card.dataset.status, card.dataset.statusLabel])).entries()].filter(([value]) => value) };
  }, []);
  const [visible, setVisible] = useState(total);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll('[data-home-history-card]'));
    const empty = document.querySelector('[data-home-history-empty]');
    const normalizedQuery = normalize(query);
    let nextVisible = 0;

    cards.forEach((card) => {
      const haystack = normalize(card.dataset.search || '');
      const matches = (normalizedQuery === '' || haystack.includes(normalizedQuery)) && (!year || card.dataset.year === year) && (!status || card.dataset.status === status);
      card.hidden = !matches;
      if (matches) {
        nextVisible += 1;
      }
    });

    if (empty) {
      empty.hidden = nextVisible !== 0;
    }

    setVisible(nextVisible);
  }, [query, year, status]);

  return (
    <div className="history-search" role="search">
      <div className="history-search-field"><label htmlFor={inputId}>Buscar historial</label>
      <input
        id={inputId}
        type="search"
        placeholder="Fecha, capitan o resultado..."
        autoComplete="off"
        data-home-history-search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      </div>
      <label className="history-select-field">Temporada<select aria-label="Temporada" value={year} onChange={event => setYear(event.target.value)}><option value="">Todas</option>{options.years.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
      <label className="history-select-field">Estado<select aria-label="Estado" value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option>{options.statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <span data-home-history-count role="status" aria-live="polite">
        {query.trim() === '' && !year && !status ? `${total} fechas` : `${visible} de ${total} fechas`}
      </span>
      {query || year || status ? <button className="history-clear-filters" type="button" onClick={() => { setQuery(''); setYear(''); setStatus(''); }}>Limpiar filtros</button> : null}
    </div>
  );
}
