import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function participantRows() {
  return Array.from(document.querySelectorAll('[data-player-row]'));
}

function participantCheckboxes() {
  return Array.from(document.querySelectorAll('input[name="participants[]"]'));
}

function notifySelectionChanged() {
  document.dispatchEvent(new CustomEvent('goodfellas:participants-changed'));
}

export function ParticipantControlsIsland({ root }) {
  const limit = Number(root.dataset.limit || 0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [visible, setVisible] = useState(0);

  const helper = useMemo(() => {
    const remaining = Math.max(0, limit - selected);
    return selected >= limit
      ? `Limite alcanzado: ${limit}`
      : `${remaining} lugares libres`;
  }, [limit, selected]);

  const syncSelected = () => {
    setSelected(participantCheckboxes().filter((checkbox) => checkbox.checked).length);
  };

  const focusResults = () => {
    const list = document.querySelector('[data-participant-list]');
    const firstVisibleRow = participantRows().find((row) => !row.classList.contains('hidden'));
    const target = firstVisibleRow || list || document.querySelector('[data-participant-empty]');

    if (!target) {
      return;
    }

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => target.focus({ preventScroll: true }), 260);
  };

  useEffect(() => {
    const rows = participantRows();
    const normalizedQuery = normalize(query);
    let nextVisible = 0;

    rows.forEach((row) => {
      const haystack = normalize(row.dataset.search || '');
      const removed = row.getAttribute('data-removed') === '1';
      const matches = !removed && (normalizedQuery === '' || haystack.includes(normalizedQuery));
      row.classList.toggle('hidden', !matches);
      if (matches) {
        nextVisible += 1;
      }
    });

    const empty = document.querySelector('[data-participant-empty]');
    if (empty) {
      empty.classList.toggle('hidden', nextVisible !== 0);
    }
    setVisible(nextVisible);
  }, [query]);

  useEffect(() => {
    const onChange = (event) => {
      if (event.target?.matches?.('input[name="participants[]"]')) {
        window.setTimeout(syncSelected, 0);
      }
    };
    const onClick = (event) => {
      if (event.target?.closest?.('[data-participant-toggle], [data-remove-participant], [data-remove-import-participant]')) {
        window.setTimeout(syncSelected, 0);
      }
    };

    document.addEventListener('change', onChange);
    document.addEventListener('click', onClick);
    syncSelected();

    return () => {
      document.removeEventListener('change', onChange);
      document.removeEventListener('click', onClick);
    };
  }, []);

  const selectAll = (checked) => {
    const checkboxes = participantCheckboxes();
    const pool = checkboxes.filter((checkbox) => {
      const row = checkbox.closest('[data-player-row]');
      return row && row.getAttribute('data-removed') !== '1' && !row.classList.contains('hidden');
    });

    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    if (checked) {
      pool.slice(0, limit || pool.length).forEach((checkbox) => {
        checkbox.checked = true;
      });
    }
    notifySelectionChanged();
    syncSelected();
  };

  const randomSelect = () => {
    const checkboxes = participantCheckboxes();
    const visiblePool = checkboxes.filter((checkbox) => {
      const row = checkbox.closest('[data-player-row]');
      return row && row.getAttribute('data-removed') !== '1' && !row.classList.contains('hidden');
    });
    const pool = visiblePool.length ? visiblePool : checkboxes;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);

    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    shuffled.slice(0, Math.min(limit || shuffled.length, shuffled.length)).forEach((checkbox) => {
      checkbox.checked = true;
    });
    notifySelectionChanged();
    syncSelected();
  };

  return (
    <div className="grid items-end gap-3 rounded-xl border border-lime-200/30 bg-emerald-950 p-3 text-lime-50 shadow-md shadow-emerald-950/20 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <label className="mb-1.5 block text-sm font-black text-lime-100" htmlFor="participantSearchReact">Buscar jugador</label>
        <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
          <input
            className="min-h-11 w-full rounded-xl border border-lime-200/40 bg-emerald-900/60 px-3 py-2.5 text-sm font-semibold text-lime-50 outline-none placeholder:text-emerald-100/60 focus:border-lime-200 focus:ring-4 focus:ring-lime-200/25"
            id="participantSearchReact"
            type="search"
            placeholder="Nombre, posicion o ritmo"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                focusResults();
              }
            }}
          />
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200/45 bg-lime-100 text-emerald-950 shadow-md shadow-emerald-950/15 transition hover:bg-lime-200 focus:outline-none focus:ring-4 focus:ring-lime-200/30"
            type="button"
            onClick={focusResults}
            aria-label="Ir a resultados de busqueda"
            title="Ir a resultados"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 max-[760px]:items-stretch">
        <label className="mb-0 inline-flex min-h-11 items-center gap-2 rounded-xl border border-lime-200/35 bg-emerald-950 px-3 py-2 text-sm font-bold text-lime-50 shadow-sm">
          <input
            className="h-4 w-4 accent-lime-200"
            type="checkbox"
            checked={visible > 0 && selected >= Math.min(limit || visible, visible)}
            onChange={(event) => selectAll(event.target.checked)}
          />
          <small className="text-xs font-black">Seleccionar visibles</small>
        </label>
        <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3.5 py-2.5 text-sm font-black text-lime-50 shadow-md shadow-emerald-950/15 transition hover:border-lime-200/65 hover:bg-lime-100/12 hover:text-lime-100" type="button" onClick={randomSelect}>Seleccion al azar</button>
        <span className="inline-flex min-h-11 items-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3 py-2 text-xs font-black text-lime-100" aria-live="polite">
          {selected}/{limit || selected} convocados - {visible} visibles - {helper}
        </span>
      </div>
    </div>
  );
}
