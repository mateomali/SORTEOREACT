import { useEffect, useMemo, useState } from 'react';

function normalize(value) {
  return String(value || '').toLocaleLowerCase('es-AR').trim();
}

export function StatsPlayerSearchIsland({ root }) {
  const players = JSON.parse(root.dataset.players || '[]');
  const [query, setQuery] = useState('');

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
  }, [query, selected]);

  return (
    <div className="stats-player-search react-stats-search">
      <label htmlFor="statsPlayerSearchReact">Buscar jugador</label>
      <input
        id="statsPlayerSearchReact"
        type="search"
        list="statsPlayerList"
        placeholder="Escribe o elige un jugador"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {query.trim() !== '' ? (
        <button className="btn btn-muted" type="button" onClick={() => setQuery('')}>Limpiar</button>
      ) : null}
    </div>
  );
}
