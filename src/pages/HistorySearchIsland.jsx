import { useEffect, useState } from 'react';

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
  const [visible, setVisible] = useState(total);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll('[data-home-history-card]'));
    const empty = document.querySelector('[data-home-history-empty]');
    const normalizedQuery = normalize(query);
    let nextVisible = 0;

    cards.forEach((card) => {
      const haystack = normalize(card.dataset.search || '');
      const matches = normalizedQuery === '' || haystack.includes(normalizedQuery);
      card.hidden = !matches;
      if (matches) {
        nextVisible += 1;
      }
    });

    if (empty) {
      empty.hidden = nextVisible !== 0;
    }

    setVisible(nextVisible);
  }, [query]);

  return (
    <div className="history-search" role="search">
      <label htmlFor={inputId}>Buscar historial</label>
      <input
        id={inputId}
        type="search"
        placeholder="Fecha, capitan o resultado..."
        autoComplete="off"
        data-home-history-search
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span data-home-history-count>
        {query.trim() === '' ? `${total} fechas` : `${visible} de ${total} fechas`}
      </span>
    </div>
  );
}
