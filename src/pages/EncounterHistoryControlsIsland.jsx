import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function EncounterHistoryControlsIsland({ root }) {
  const total = Number(root.dataset.total || 0);
  const currentPage = root.dataset.currentPage || '1';
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [visible, setVisible] = useState(total);
  const hasActiveFilter = query.trim() !== '' || status !== '';

  const countLabel = useMemo(() => (
    !hasActiveFilter
      ? `${total} fechas`
      : `${visible} de ${total} fechas`
  ), [hasActiveFilter, total, visible]);

  const clearFilters = () => {
    setQuery('');
    setStatus('');
  };

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll('[data-encounter-card]'));
    const empty = document.querySelector('[data-encounter-history-empty]');
    const pagination = document.querySelector('.encounters-history .pagination');
    const normalizedQuery = normalize(query);
    let nextVisible = 0;

    cards.forEach((card) => {
      const haystack = normalize(card.dataset.search || '');
      const matchesPage = normalizedQuery === '' && status === '' ? card.dataset.page === currentPage : true;
      const matchesQuery = normalizedQuery === '' || haystack.includes(normalizedQuery);
      const matchesStatus = status === '' || card.dataset.status === status;
      const matches = matchesPage && matchesQuery && matchesStatus;
      card.classList.toggle('encounter-page-hidden', !matches);
      if (matches) {
        nextVisible += 1;
      }
    });

    if (empty) {
      empty.hidden = nextVisible !== 0;
    }
    if (pagination) {
      pagination.hidden = normalizedQuery !== '' || status !== '';
    }
    document.querySelectorAll('[data-encounter-status-filter]').forEach((panel) => {
      const isActive = panel.dataset.encounterStatusFilter === status;
      panel.classList.toggle('is-active', isActive);
      panel.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    setVisible(nextVisible);
  }, [query, status, currentPage]);

  useEffect(() => {
    const togglePanel = (panel) => {
      const nextStatus = panel.dataset.encounterStatusFilter || '';
      setStatus((current) => (current === nextStatus ? '' : nextStatus));
    };
    const onClick = (event) => {
      const panel = event.target instanceof Element
        ? event.target.closest('[data-encounter-status-filter]')
        : null;
      if (!panel) return;
      togglePanel(panel);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const panel = event.target instanceof Element
        ? event.target.closest('[data-encounter-status-filter]')
        : null;
      if (!panel) return;
        event.preventDefault();
      togglePanel(panel);
    };

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <div className="encounter-history-search" role="search">
      <label htmlFor="encounterHistorySearch">Buscar historial</label>
      <input
        id="encounterHistorySearch"
        type="search"
        placeholder="Fecha, capitán o resultado..."
        autoComplete="off"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <span data-encounter-history-count aria-live="polite">{countLabel}</span>
      {hasActiveFilter ? (
        <button className="btn btn-muted encounter-history-clear" type="button" onClick={clearFilters}>
          Limpiar filtro
        </button>
      ) : null}
    </div>
  );
}
