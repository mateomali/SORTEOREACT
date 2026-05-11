import { useEffect, useMemo, useRef, useState } from 'react';

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderRankingCard(player) {
  const rankingCard = document.querySelector('[data-stats-selected-ranking-card]');
  const rankingTitle = document.querySelector('[data-stats-selected-ranking-title]');
  const rankingGrid = document.querySelector('[data-stats-selected-ranking-grid]');
  if (!rankingCard || !rankingGrid) return;

  const rankings = Array.isArray(player?.rankings) ? player.rankings : [];
  if (!rankings.length) {
    rankingGrid.innerHTML = '';
    rankingCard.hidden = true;
    return;
  }

  if (rankingTitle) rankingTitle.textContent = `Posición en rankings de ${player.name || 'jugador'}`;
  rankingGrid.innerHTML = rankings.map((item) => {
    const position = item.position ?? null;
    const total = Number(item.total || 0);
    const isTop = position !== null && Number(position) <= 3;
    const value = item.value !== null && item.value !== undefined && item.value !== ''
      ? ` | ${escapeHtml(item.value)} ${escapeHtml(item.suffix || '')}`.trimEnd()
      : '';
    return `
      <article class="profile-ranking-item${isTop ? ' is-top' : ''}">
        <span class="profile-ranking-label">${escapeHtml(item.label || '')}</span>
        <strong class="profile-ranking-position">${position !== null ? `#${position}` : '-'}</strong>
        <small>${position !== null ? `de ${total}` : 'sin datos'}${value}</small>
      </article>
    `;
  }).join('');
  rankingCard.hidden = false;
}

function hideSelectedRankingCard() {
  const rankingCard = document.querySelector('[data-stats-selected-ranking-card]');
  const rankingGrid = document.querySelector('[data-stats-selected-ranking-grid]');
  if (rankingCard) rankingCard.hidden = true;
  if (rankingGrid) rankingGrid.innerHTML = '';
}

function parsePlayers(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncHtmlFromDocument(nextDocument, selector) {
  const current = document.querySelector(selector);
  const next = nextDocument.querySelector(selector);
  if (current && next) current.innerHTML = next.innerHTML;
}

function syncStatsFilterUi(nextDocument) {
  syncHtmlFromDocument(nextDocument, '.stats-year-options');
  syncHtmlFromDocument(nextDocument, '.stats-court-options');
  syncHtmlFromDocument(nextDocument, '.stats-head-summary');
  syncHtmlFromDocument(nextDocument, '#statsPlayerList');

  const currentFilterSummary = document.querySelector('.stats-filter-hub-summary small');
  const nextFilterSummary = nextDocument.querySelector('.stats-filter-hub-summary small');
  if (currentFilterSummary && nextFilterSummary) currentFilterSummary.textContent = nextFilterSummary.textContent;

  const currentRankingContext = document.querySelector('[data-stats-selected-ranking-context]');
  const nextRankingContext = nextDocument.querySelector('[data-stats-selected-ranking-context]');
  if (currentRankingContext && nextRankingContext) currentRankingContext.textContent = nextRankingContext.textContent;
}

function isStatsFilterNavigation(element) {
  return Boolean(element?.closest('.stats-filter-hub'));
}

function buildUrlFromForm(form) {
  const url = new URL(form.getAttribute('action') || window.location.href, window.location.href);
  url.search = '';
  const formData = new FormData(form);
  formData.forEach((value, key) => {
    const stringValue = String(value || '').trim();
    if (stringValue !== '') url.searchParams.append(key, stringValue);
  });
  return url;
}

export function StatsPlayerSearchIsland({ root }) {
  const [players, setPlayers] = useState(() => parsePlayers(root.dataset.players));
  const [query, setQuery] = useState(root.dataset.initialQuery || '');
  const latestFilterRequest = useRef(0);
  const hasQuery = query.trim() !== '';

  const selected = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return null;
    return players.find((player) => normalize(player.name) === normalized)
      || players.find((player) => normalize(player.name).includes(normalized))
      || null;
  }, [players, query]);

  useEffect(() => {
    const normalized = normalize(query);
    document.querySelectorAll('[data-stats-player-search-param]').forEach((input) => {
      input.value = query.trim();
    });
    document.querySelectorAll('a[data-partial-link][href^="estadisticas.php"]').forEach((link) => {
      const nextHref = new URL(link.getAttribute('href') || 'estadisticas.php', window.location.href);
      if (query.trim()) {
        nextHref.searchParams.set('player_search', query.trim());
      } else {
        nextHref.searchParams.delete('player_search');
      }
      link.setAttribute('href', `${nextHref.pathname.split('/').pop()}${nextHref.search}${nextHref.hash}`);
    });
    const rows = Array.from(document.querySelectorAll('[data-stats-player-row]'));
    const filterRows = Array.from(document.querySelectorAll('[data-stats-player-filter-row]'));
    const result = document.querySelector('[data-stats-player-result]');
    const selectedData = selected;
    [...rows, ...filterRows].forEach((row) => row.classList.remove('is-highlighted'));

    if (!normalized) {
      result && (result.hidden = true);
      const profileCard = document.querySelector('[data-stats-selected-profile-card]');
      const profileTarget = document.querySelector('[data-stats-selected-profile]');
      if (profileCard) profileCard.hidden = true;
      if (profileTarget) profileTarget.innerHTML = '';
      hideSelectedRankingCard();
      [...rows, ...filterRows].forEach((row) => row.classList.remove('hidden'));
      return;
    }

    rows.forEach((row) => {
      const name = normalize(row.dataset.playerName);
      const matches = name.includes(normalized);
      row.classList.toggle('hidden', !matches);
      row.classList.toggle('is-highlighted', Boolean(selectedData) && name === normalize(selectedData.name));
    });
    filterRows.forEach((row) => {
      const name = normalize(row.dataset.playerName);
      const matches = name.includes(normalized);
      row.classList.toggle('hidden', !matches);
      row.classList.toggle('is-highlighted', Boolean(selectedData) && name === normalize(selectedData.name));
    });

    if (!result || !selectedData) {
      if (result) result.hidden = true;
      const profileCard = document.querySelector('[data-stats-selected-profile-card]');
      const profileTarget = document.querySelector('[data-stats-selected-profile]');
      if (profileCard) profileCard.hidden = true;
      if (profileTarget) profileTarget.innerHTML = '';
      hideSelectedRankingCard();
      return;
    }

    result.hidden = false;
    const setText = (selector, value) => {
      const element = document.querySelector(selector);
      if (element) element.textContent = value || '-';
    };
    setText('[data-stats-player-name]', selectedData.name);
    setText('[data-stats-player-matches]', selectedData.matches);
    setText('[data-stats-player-goals]', selectedData.goals);
    setText('[data-stats-player-rating]', selectedData.rating);
    setText('[data-stats-player-pg]', selectedData.pg);
    setText('[data-stats-player-pe]', selectedData.pe);
    setText('[data-stats-player-pp]', selectedData.pp);
    const profileCard = document.querySelector('[data-stats-selected-profile-card]');
    const profileTarget = document.querySelector('[data-stats-selected-profile]');
    if (profileCard) profileCard.hidden = true;
    if (profileTarget) profileTarget.innerHTML = '';
    renderRankingCard(selectedData);
  }, [players, query, selected]);

  useEffect(() => {
    const currentQuery = query.trim();
    if (!currentQuery) return undefined;
    let active = true;

    const updateStatsForCurrentPlayer = async (targetUrl) => {
      const requestId = latestFilterRequest.current + 1;
      latestFilterRequest.current = requestId;
      const url = new URL(targetUrl, window.location.href);
      url.searchParams.set('player_search', currentQuery);

      const rankingCard = document.querySelector('[data-stats-selected-ranking-card]');
      if (rankingCard) rankingCard.setAttribute('aria-busy', 'true');

      try {
        const response = await fetch(url.toString(), {
          cache: 'no-store',
          headers: {
            Accept: 'text/html',
            'X-Requested-With': 'fetch',
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        if (!active || requestId !== latestFilterRequest.current) return;

        const nextDocument = new DOMParser().parseFromString(html, 'text/html');
        const nextRoot = nextDocument.querySelector('[data-react-island="stats_player_search"]');
        const nextPlayers = parsePlayers(nextRoot?.dataset.players);
        root.dataset.players = nextRoot?.dataset.players || '[]';
        setPlayers(nextPlayers);
        syncStatsFilterUi(nextDocument);
        window.history.pushState(window.history.state, '', url.toString());
      } catch (error) {
        console.error('No se pudo actualizar estadisticas del jugador.', error);
        window.location.href = url.toString();
      } finally {
        if (rankingCard) rankingCard.removeAttribute('aria-busy');
      }
    };

    const handleClick = (event) => {
      const link = event.target.closest?.('a[data-partial-link]');
      if (!link || !isStatsFilterNavigation(link)) return;
      event.preventDefault();
      event.stopPropagation();
      updateStatsForCurrentPlayer(link.href);
    };

    const handleSubmit = (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement) || !form.matches('[data-partial-form]') || !isStatsFilterNavigation(form)) return;
      event.preventDefault();
      event.stopPropagation();
      const url = buildUrlFromForm(form);
      updateStatsForCurrentPlayer(url.toString());
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('submit', handleSubmit, true);
    return () => {
      active = false;
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, [query, root]);

  useEffect(() => {
    const nextUrl = new URL(window.location.href);
    const trimmedQuery = query.trim();
    if (trimmedQuery) {
      nextUrl.searchParams.set('player_search', trimmedQuery);
    } else {
      nextUrl.searchParams.delete('player_search');
    }
    window.history.replaceState(window.history.state, '', nextUrl.toString());
  }, [query]);

  return (
    <div
      className="stats-player-search react-stats-search"
      style={{
        display: 'grid',
        gridTemplateColumns: hasQuery ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
        gap: '6px',
        padding: '8px',
      }}
    >
      <label
        htmlFor="statsPlayerSearchReact"
        style={{ margin: 0, fontSize: '.78rem', lineHeight: 1, fontWeight: 900 }}
      >
        Buscar jugador
      </label>
      <input
        id="statsPlayerSearchReact"
        type="search"
        list="statsPlayerList"
        placeholder="Escribe o elige un jugador..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        style={{
          minHeight: '38px',
          borderRadius: '10px',
          padding: '7px 10px',
          fontSize: '.84rem',
          fontWeight: 800,
        }}
      />
      {hasQuery ? (
        <button
          className="btn btn-muted"
          type="button"
          onClick={() => setQuery('')}
          style={{ minHeight: '38px', borderRadius: '10px', padding: '7px 10px', fontSize: '.72rem' }}
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
