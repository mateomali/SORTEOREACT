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
    <div className="participant-search react-participant-controls">
      <input
        type="search"
        placeholder="Buscar jugador por nombre, posicion o ritmo"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <label className="chip">
        <input
          type="checkbox"
          checked={visible > 0 && selected >= Math.min(limit || visible, visible)}
          onChange={(event) => selectAll(event.target.checked)}
        />
        Seleccionar visibles
      </label>
      <button className="btn btn-muted" type="button" onClick={randomSelect}>Seleccion al azar</button>
      <span className="participant-react-helper" aria-live="polite">
        {selected}/{limit || selected} convocados · {visible} visibles · {helper}
      </span>
    </div>
  );
}
