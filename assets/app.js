(() => {
  const nav = document.getElementById('mainNav');
  const toggle = document.getElementById('menuToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  const getMainContent = () => document.querySelector('main.content');

  const showToast = (message, type = 'info') => {
    if (!message) return;
    let stack = document.querySelector('[data-toast-stack]');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'app-toast-stack';
      stack.setAttribute('data-toast-stack', '');
      document.body.appendChild(stack);
    }

    const toast = document.createElement('div');
    toast.className = `app-toast app-toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.textContent = message;
    stack.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 220);
    }, type === 'error' ? 4200 : 2600);
  };

  const setBusy = (el, busy) => {
    if (!el) return;
    el.classList.toggle('is-partial-loading', busy);
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  };

  const collapseMobileDetails = (root = document) => {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    root.querySelectorAll('details[data-mobile-collapsed]').forEach((details) => {
      details.open = false;
    });
  };

  const updateActiveNavigation = (nextDocument) => {
    const nextNav = nextDocument.querySelector('#mainNav');
    const currentNav = document.querySelector('#mainNav');
    if (!nextNav || !currentNav) return;
    currentNav.innerHTML = nextNav.innerHTML;
    currentNav.classList.remove('open');
  };

  const updateStatsPlayerSearch = (input = document.querySelector('[data-stats-player-search]')) => {
    const statsPlayerSearch = input;
    const statsPlayerResult = document.querySelector('[data-stats-player-result]');
    const statsPlayerRows = Array.from(document.querySelectorAll('[data-stats-player-row]'));
    const statsFilterRows = Array.from(document.querySelectorAll('[data-stats-player-filter-row]'));
    if (!statsPlayerSearch || !statsPlayerResult || !statsPlayerRows.length) return;

    const query = statsPlayerSearch.value.trim().toLowerCase();
    [...statsPlayerRows, ...statsFilterRows].forEach((row) => row.classList.remove('is-highlighted'));

    if (query === '') {
      statsPlayerResult.hidden = true;
      [...statsPlayerRows, ...statsFilterRows].forEach((row) => {
        row.classList.remove('hidden');
      });
      return;
    }

    const exact = statsPlayerRows.find((row) => (row.dataset.playerName || '').toLowerCase() === query);
    const partial = statsPlayerRows.find((row) => (row.dataset.playerName || '').toLowerCase().includes(query));
    const selected = exact || partial;

    statsPlayerRows.forEach((row) => {
      const name = (row.dataset.playerName || '').toLowerCase();
      row.classList.toggle('hidden', !name.includes(query));
    });
    statsFilterRows.forEach((row) => {
      const name = (row.dataset.playerName || '').toLowerCase();
      const isMatch = name.includes(query);
      row.classList.toggle('hidden', !isMatch);
      row.classList.toggle('is-highlighted', Boolean(selected) && name === (selected.dataset.playerName || '').toLowerCase());
    });

    if (!selected) {
      statsPlayerResult.hidden = true;
      return;
    }

    selected.classList.add('is-highlighted');
    statsPlayerResult.hidden = false;
    document.querySelector('[data-stats-player-name]').textContent = selected.dataset.playerName || '-';
    document.querySelector('[data-stats-player-matches]').textContent = selected.dataset.matches || '-';
    document.querySelector('[data-stats-player-goals]').textContent = selected.dataset.goals || '-';
    document.querySelector('[data-stats-player-rating]').textContent = selected.dataset.rating || '-';
    document.querySelector('[data-stats-player-pg]').textContent = selected.dataset.pg || '0';
    document.querySelector('[data-stats-player-pe]').textContent = selected.dataset.pe || '0';
    document.querySelector('[data-stats-player-pp]').textContent = selected.dataset.pp || '0';
  };

  const openAwardsPopover = (button) => {
    const sourceId = button.getAttribute('data-awards-target');
    const source = sourceId ? document.getElementById(sourceId) : null;
    const awardsPopover = document.querySelector('[data-awards-popover]');
    const awardsPopoverTitle = document.querySelector('[data-awards-popover-title]');
    const awardsPopoverBody = document.querySelector('[data-awards-popover-body]');
    if (!awardsPopover || !awardsPopoverBody || !source) return;

    if (awardsPopoverTitle) {
      awardsPopoverTitle.textContent = button.getAttribute('data-awards-title')
        || `Premios - ${button.getAttribute('data-awards-player') || 'Jugador'}`;
    }
    awardsPopoverBody.innerHTML = source.innerHTML;
    awardsPopover.hidden = false;
  };

  const closeAwardsPopover = () => {
    const awardsPopover = document.querySelector('[data-awards-popover]');
    const awardsPopoverBody = document.querySelector('[data-awards-popover-body]');
    if (!awardsPopover) return;
    awardsPopover.hidden = true;
    if (awardsPopoverBody) awardsPopoverBody.innerHTML = '';
  };

  const initFinishPlayerSwap = (root = document) => {
    if (root.querySelector('[data-finish-player-swap-bound]')) return;
    const rows = Array.from(root.querySelectorAll('[data-finish-player-row]'));
    if (!rows.length) return;

    const desktopEnabled = () => window.matchMedia('(min-width: 761px)').matches;
    const clearOver = () => {
      root.querySelectorAll('[data-finish-player-row].is-drag-over').forEach((row) => row.classList.remove('is-drag-over'));
    };

    const swapRows = (source, target) => {
      if (!source || !target || source === target) return;
      const sourceTeam = source.dataset.teamNumber || '';
      const targetTeam = target.dataset.teamNumber || '';
      const sourcePosition = source.dataset.position || '';
      const targetPosition = target.dataset.position || '';

      source.dataset.teamNumber = targetTeam;
      target.dataset.teamNumber = sourceTeam;
      source.dataset.position = targetPosition;
      target.dataset.position = sourcePosition;

      const sourceTeamInput = source.querySelector('[data-finish-player-team-input]');
      const targetTeamInput = target.querySelector('[data-finish-player-team-input]');
      const sourcePositionInput = source.querySelector('[data-finish-player-position-input]');
      const targetPositionInput = target.querySelector('[data-finish-player-position-input]');
      const sourcePositionLabel = source.querySelector('[data-finish-player-position-label]');
      const targetPositionLabel = target.querySelector('[data-finish-player-position-label]');

      if (sourceTeamInput) sourceTeamInput.value = targetTeam;
      if (targetTeamInput) targetTeamInput.value = sourceTeam;
      if (sourcePositionInput) sourcePositionInput.value = targetPosition;
      if (targetPositionInput) targetPositionInput.value = sourcePosition;
      if (sourcePositionLabel) sourcePositionLabel.textContent = targetPosition;
      if (targetPositionLabel) targetPositionLabel.textContent = sourcePosition;

      const sourceMarker = document.createComment('finish-swap-source');
      const targetMarker = document.createComment('finish-swap-target');
      source.parentNode.insertBefore(sourceMarker, source);
      target.parentNode.insertBefore(targetMarker, target);
      sourceMarker.parentNode.insertBefore(target, sourceMarker);
      targetMarker.parentNode.insertBefore(source, targetMarker);
      sourceMarker.remove();
      targetMarker.remove();
      showToast('Jugadores intercambiados. Guarda valoraciones para confirmar.', 'success');
    };

    rows.forEach((row) => {
      row.setAttribute('data-finish-player-swap-bound', '1');
      row.addEventListener('dragstart', (event) => {
        if (!desktopEnabled()) {
          event.preventDefault();
          return;
        }
        row.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.playerId || '');
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        clearOver();
      });
      row.addEventListener('dragover', (event) => {
        if (!desktopEnabled()) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        row.classList.add('is-drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('is-drag-over'));
      row.addEventListener('drop', (event) => {
        if (!desktopEnabled()) return;
        event.preventDefault();
        row.classList.remove('is-drag-over');
        const sourceId = event.dataTransfer.getData('text/plain');
        const source = sourceId ? root.querySelector(`[data-finish-player-row][data-player-id="${CSS.escape(sourceId)}"]`) : null;
        swapRows(source, row);
      });
    });
  };

  initFinishPlayerSwap();

  const normalizeSearchText = (value) => String(value || '')
    .toLocaleLowerCase('es-AR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const bindEncounterHistoryControls = (root = document) => {
    const input = root.querySelector('[data-encounter-history-search]');
    const cards = Array.from(root.querySelectorAll('[data-encounter-card]'));
    const overviewPanels = Array.from(root.querySelectorAll('[data-encounter-status-filter]'));
    if (!input || !cards.length) return;

    const history = root.querySelector('.encounters-history') || document.querySelector('.encounters-history');
    const pagination = history?.querySelector('.pagination') || null;
    const empty = root.querySelector('[data-encounter-history-empty]');
    const count = root.querySelector('[data-encounter-history-count]');
    const currentPage = root.querySelector('[data-encounter-current-page]')?.getAttribute('data-encounter-current-page') || '1';
    const total = cards.length;
    let activeStatus = '';

    const applyFilter = () => {
      const query = normalizeSearchText(input.value);
      let visible = 0;

      cards.forEach((card) => {
        const haystack = normalizeSearchText(card.dataset.search || '');
        const matchesPage = query === '' && activeStatus === '' ? card.dataset.page === currentPage : true;
        const matchesQuery = query === '' || haystack.includes(query);
        const matchesStatus = activeStatus === '' || card.dataset.status === activeStatus;
        const matches = matchesPage && matchesQuery && matchesStatus;
        card.classList.toggle('encounter-page-hidden', !matches);
        if (matches) visible++;
      });

      if (pagination) {
        pagination.hidden = query !== '' || activeStatus !== '';
      }
      if (empty) {
        empty.hidden = visible !== 0;
      }
      if (count) {
        count.textContent = query === '' && activeStatus === ''
          ? `${total} fechas`
          : `${visible} de ${total} fechas`;
      }
      overviewPanels.forEach((panel) => {
        const isActive = panel.dataset.encounterStatusFilter === activeStatus;
        panel.classList.toggle('is-active', isActive);
        panel.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    };

    if (!input.hasAttribute('data-bound-encounter-search')) {
      input.setAttribute('data-bound-encounter-search', '1');
      input.addEventListener('input', applyFilter);
    }

    overviewPanels.forEach((panel) => {
      if (panel.hasAttribute('data-bound-encounter-status')) return;
      panel.setAttribute('data-bound-encounter-status', '1');
      const toggleStatus = () => {
        const nextStatus = panel.dataset.encounterStatusFilter || '';
        activeStatus = activeStatus === nextStatus ? '' : nextStatus;
        applyFilter();
        history?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      panel.addEventListener('click', toggleStatus);
      panel.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        toggleStatus();
      });
    });

    applyFilter();

    const focusedCard = root.querySelector('[data-focus-match="1"]');
    if (focusedCard && !focusedCard.hasAttribute('data-focus-applied')) {
      focusedCard.setAttribute('data-focus-applied', '1');
      window.setTimeout(() => {
        focusedCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        focusedCard.focus({ preventScroll: true });
      }, 120);
    }
  };

  const hydrateDynamicContent = (root = document) => {
    collapseMobileDetails(root);
    refreshExistingImportPlayers(root);
    bindParticipantControls(root);
    bindEncounterHistoryControls(root);
    updateStatsPlayerSearch(root.querySelector?.('[data-stats-player-search]') || undefined);
  };

  const partialNavigate = async (url, { replace = false, source = null } = {}) => {
    const content = getMainContent();
    if (!content) {
      window.location.href = url;
      return;
    }

    setBusy(content, true);
    if (source) source.classList.add('is-loading');

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: { 'X-Requested-With': 'fetch', Accept: 'text/html' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextContent = nextDocument.querySelector('main.content');
      if (!nextContent) throw new Error('Missing partial content');

      document.title = nextDocument.title || document.title;
      updateActiveNavigation(nextDocument);
      content.replaceChildren(...Array.from(nextContent.childNodes));
      hydrateDynamicContent(content);
      if (replace) {
        window.history.replaceState({ partial: true }, '', url);
      } else {
        window.history.pushState({ partial: true }, '', url);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showToast('Vista actualizada', 'success');
    } catch (error) {
      showToast('No se pudo actualizar sin recargar. Abriendo la pagina completa.', 'error');
      window.location.href = url;
    } finally {
      setBusy(content, false);
      if (source) source.classList.remove('is-loading');
    }
  };

  const replaceMainContentFromDocument = (nextDocument) => {
    const content = getMainContent();
    const nextContent = nextDocument.querySelector('main.content');
    if (!content || !nextContent) throw new Error('Missing partial content');

    document.title = nextDocument.title || document.title;
    updateActiveNavigation(nextDocument);
    content.replaceChildren(...Array.from(nextContent.childNodes));
    hydrateDynamicContent(content);
    return content;
  };

  const importFormSelector = '#importPlayersForm, #clearImportPlayersForm, form[id^="createImportPlayerForm"], form[id^="useExistingImportPlayerForm"]';

  const submitImportFormDynamically = async (form, submitter = null) => {
    const content = getMainContent();
    if (!content) {
      form.submit();
      return;
    }

    const url = new URL(form.action || window.location.href, window.location.href);
    const formData = new FormData(form);
    setBusy(content, true);
    submitter?.classList.add('is-loading');

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        body: formData,
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch', Accept: 'text/html' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, 'text/html');
      const nextContent = replaceMainContentFromDocument(nextDocument);
      const importPanel = nextContent.querySelector('#importar-listado');
      importPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Listado actualizado', 'success');
    } catch (error) {
      showToast('No se pudo actualizar dinamicamente. Reintentando con recarga.', 'error');
      window.sessionStorage?.setItem(importScrollKey, String(window.scrollY));
      form.submit();
    } finally {
      setBusy(content, false);
      submitter?.classList.remove('is-loading');
    }
  };

  const getParticipantLimit = () => {
    const teams = Number.parseInt(document.querySelector('[data-num-teams]')?.value || '2', 10);
    const playersPerTeam = Number.parseInt(document.querySelector('[data-players-per-team]')?.value || '9', 10);
    return Math.max(1, teams || 1) * Math.max(1, playersPerTeam || 1);
  };

  const updateImportPlayerLimit = () => {
    document.querySelectorAll('[data-import-max-players]').forEach((input) => {
      input.value = String(getParticipantLimit());
    });
  };

  const importScrollKey = 'goodfellasImportScrollY';
  const savedImportScroll = window.sessionStorage?.getItem(importScrollKey);
  if (savedImportScroll !== null) {
    window.sessionStorage.removeItem(importScrollKey);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: Number.parseInt(savedImportScroll, 10) || 0, left: 0 });
    });
  }

  const updateSelectionCount = (target) => {
    if (!target) return;
    const checkboxes = Array.from(document.querySelectorAll(`input[name="${target}[]"]`));
    const counters = Array.from(document.querySelectorAll(`[data-selection-count="${target}"]`));
    const maxCounters = Array.from(document.querySelectorAll(`[data-selection-max="${target}"]`));
    const selectAll = document.querySelector(`[data-select-all="${target}"]`);
    const limitMessage = document.querySelector('[data-selection-limit-message]');
    const mobileSubmit = document.querySelector('[data-mobile-submit]');

    let checked = checkboxes.filter((el) => el.checked);
    let limit = checkboxes.length;

    if (target === 'participants') {
      limit = getParticipantLimit();
      maxCounters.forEach((maxCounter) => {
        maxCounter.textContent = String(limit);
      });
      if (checked.length > limit) {
        checked.slice(limit).forEach((el) => {
          el.checked = false;
        });
        checked = checkboxes.filter((el) => el.checked);
      }
      checkboxes.forEach((el) => {
        el.disabled = !el.checked && checked.length >= limit;
      });
      if (limitMessage) {
        const remaining = Math.max(0, limit - checked.length);
        limitMessage.textContent = remaining === 0
          ? `Limite alcanzado: ${limit} jugadores. Quita uno para agregar otro.`
          : `Puedes agregar ${remaining} jugador${remaining === 1 ? '' : 'es'} mas. Limite total: ${limit}.`;
      }
    }

    checkboxes.forEach((el) => {
      const row = el.closest('.player-picker-item');
      const toggle = row?.querySelector('[data-participant-toggle]');
      const remove = row?.querySelector('[data-remove-player-row]');
      row?.classList.toggle('selected', el.checked);
      toggle?.classList.toggle('is-added', el.checked);
      if (toggle) {
        toggle.textContent = el.checked ? 'Convocado' : 'Agregar';
        toggle.disabled = !el.checked && el.disabled;
      }
      if (remove) {
        remove.disabled = el.checked;
        remove.classList.toggle('is-disabled', el.checked);
      }
    });

    counters.forEach((counter) => {
      counter.textContent = String(checked.length);
    });
    if (target === 'participants' && mobileSubmit) {
      const isComplete = checked.length === limit;
      mobileSubmit.disabled = !isComplete;
      mobileSubmit.classList.toggle('is-ready', isComplete);
    }
    if (selectAll) {
      const availableCheckboxes = target === 'participants'
        ? checkboxes.filter((el) => el.closest('[data-player-row]')?.getAttribute('data-removed') !== '1')
        : checkboxes;
      const cappedTotal = target === 'participants' ? Math.min(limit, availableCheckboxes.length) : availableCheckboxes.length;
      const checkedAvailable = availableCheckboxes.filter((el) => el.checked).length;
      selectAll.checked = cappedTotal > 0 && checkedAvailable === cappedTotal;
      selectAll.indeterminate = checkedAvailable > 0 && checkedAvailable < cappedTotal;
    }
    if (target === 'participants') {
      renderSelectedParticipants(checked);
      filterParticipantRows();
    }
  };

  const renderSelectedParticipants = (checked) => {
    const containers = Array.from(document.querySelectorAll('[data-selected-participants]'));
    const emptyMessages = Array.from(document.querySelectorAll('[data-selected-empty]'));
    if (!containers.length) return;

    if (!checked.length) {
      containers.forEach((container) => {
        container.innerHTML = '';
      });
      emptyMessages.forEach((empty) => empty.classList.remove('hidden'));
      return;
    }

    emptyMessages.forEach((empty) => empty.classList.add('hidden'));
    const html = checked.map((el, index) => `
      <div class="selected-player-item">
        <span>
          <strong>${index + 1}. ${escapeHtml(el.dataset.playerName || '')}</strong>
          <small>${escapeHtml(el.dataset.playerMeta || '')}</small>
        </span>
        <button type="button" data-remove-participant="${escapeHtml(el.value)}" aria-label="Quitar ${escapeHtml(el.dataset.playerName || 'jugador')}">
          <span class="remove-label">Quitar</span>
          <span class="remove-icon">x</span>
        </button>
      </div>
    `).join('');

    containers.forEach((container) => {
      container.innerHTML = html;
    });

    document.querySelectorAll('[data-remove-participant]').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-remove-participant');
        const checkbox = document.querySelector(`input[name="participants[]"][value="${cssEscape(id)}"]`);
        if (checkbox) {
          checkbox.checked = false;
          updateSelectionCount('participants');
        }
      });
    });
  };

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') {
      return window.CSS.escape(String(value));
    }
    return String(value).replace(/["\\]/g, '\\$&');
  };

  const filterParticipantRows = () => {
    const search = document.querySelector('[data-participant-search]');
    const rows = Array.from(document.querySelectorAll('[data-player-row]'));
    const empty = document.querySelector('[data-participant-empty]');
    if (!search || !rows.length) return;

    const query = search.value.trim().toLowerCase();
    let visibleCount = 0;
    rows.forEach((row) => {
      const checkbox = row.querySelector('input[name="participants[]"]');
      const haystack = row.getAttribute('data-search') || '';
      const removed = row.getAttribute('data-removed') === '1';
      const visible = !removed && (query === '' || haystack.includes(query));
      row.classList.toggle('hidden', !visible);
      if (visible) visibleCount++;
    });
    if (empty) {
      empty.classList.toggle('hidden', visibleCount !== 0);
    }
  };

  const applyImportedPlayerIds = (root = document) => {
    const importedPlayerIds = root.querySelector('[data-imported-player-ids]');
    if (!importedPlayerIds) return;
    try {
      const ids = JSON.parse(importedPlayerIds.textContent || '[]').map((id) => String(id));
      ids.forEach((id) => {
        const checkbox = document.querySelector(`input[name="participants[]"][value="${cssEscape(id)}"]`);
        const row = checkbox?.closest('[data-player-row]');
        if (checkbox) {
          checkbox.checked = true;
          row?.removeAttribute('data-removed');
        }
      });
    } catch (error) {
      // Ignore malformed import state; the server remains the source of truth.
    }
  };

  const normalizeImportName = (value) => String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const existingImportPlayersSource = document.querySelector('[data-existing-import-players]');
  let existingImportPlayers = [];
  const refreshExistingImportPlayers = (root = document) => {
    const source = root.querySelector('[data-existing-import-players]');
    existingImportPlayers = [];
    if (!source) return;
    try {
      existingImportPlayers = JSON.parse(source.textContent || '[]');
    } catch (error) {
      existingImportPlayers = [];
    }
  };
  refreshExistingImportPlayers(document);

  const scoreExistingPlayer = (query, player) => {
    const name = normalizeImportName(player.name);
    if (!query || !name) return 0;
    if (name === query) return 100;
    if (name.includes(query) || query.includes(name)) return 82;
    const queryParts = query.split(' ').filter(Boolean);
    const sharedParts = queryParts.filter((part) => name.includes(part)).length;
    return sharedParts > 0 ? 60 + sharedParts * 5 : 0;
  };

  const updateImportExistingPanel = (input) => {
    const index = input.getAttribute('data-missing-index');
    const panel = document.querySelector(`[data-existing-player-panel="${cssEscape(index)}"]`);
    const title = panel?.querySelector('[data-existing-player-title]');
    const options = panel?.querySelector('[data-existing-player-options]');
    if (!panel || !title || !options) return;

    const query = normalizeImportName(input.value);
    const matches = existingImportPlayers
      .map((player) => ({ player, score: scoreExistingPlayer(query, player) }))
      .filter((item) => item.score >= 60)
      .sort((a, b) => b.score - a.score || String(a.player.name).localeCompare(String(b.player.name)))
      .slice(0, 4);

    panel.classList.toggle('hidden', matches.length === 0);
    if (!matches.length) {
      options.innerHTML = '';
      return;
    }

    title.textContent = matches[0].score === 100 ? 'Jugador ya existente' : 'Posibles coincidencias';
    options.innerHTML = matches.map(({ player }) => `
      <button
        class="btn btn-muted"
        type="submit"
        form="useExistingImportPlayerForm${escapeHtml(index)}"
        data-use-existing-player="${escapeHtml(index)}"
        data-player-id="${escapeHtml(player.id)}"
      >
        Usar ${escapeHtml(player.name)}
      </button>
    `).join('');
  };

  const bindParticipantControls = (root = document) => {
    root.querySelectorAll('[data-select-all]:not([data-bound-selection])').forEach((selectAll) => {
      selectAll.setAttribute('data-bound-selection', '1');
      const target = selectAll.getAttribute('data-select-all');
      updateSelectionCount(target);
      selectAll.addEventListener('change', () => {
        if (!target) return;
        const checkboxes = Array.from(document.querySelectorAll(`input[name="${target}[]"]`));
        const limit = target === 'participants' ? getParticipantLimit() : checkboxes.length;
        const pool = target === 'participants'
          ? checkboxes.filter((el) => el.closest('[data-player-row]')?.getAttribute('data-removed') !== '1')
          : checkboxes;
        checkboxes.forEach((el) => {
          el.checked = false;
        });
        pool.forEach((el, index) => {
          el.checked = selectAll.checked && index < limit;
        });
        updateSelectionCount(target);
      });
    });

    root.querySelectorAll('[data-random-select]:not([data-bound-random])').forEach((button) => {
      button.setAttribute('data-bound-random', '1');
      const target = button.getAttribute('data-random-select');
      button.addEventListener('click', () => {
        if (!target) return;
        const checkboxes = Array.from(document.querySelectorAll(`input[name="${target}[]"]`));
        const limit = target === 'participants' ? getParticipantLimit() : checkboxes.length;
        const visible = checkboxes.filter((el) => {
          const row = el.closest('[data-player-row]');
          return !row || (!row.classList.contains('hidden') && row.getAttribute('data-removed') !== '1');
        });
        const pool = visible.length >= limit ? visible : checkboxes;
        const shuffled = [...pool].sort(() => Math.random() - 0.5);

        checkboxes.forEach((el) => {
          el.checked = false;
        });
        shuffled.slice(0, Math.min(limit, shuffled.length)).forEach((el) => {
          el.checked = true;
        });
        updateSelectionCount(target);
      });
    });

    root.querySelectorAll('input[name="participants[]"]:not([data-bound-participant-checkbox])').forEach((checkbox) => {
      checkbox.setAttribute('data-bound-participant-checkbox', '1');
      checkbox.addEventListener('change', () => updateSelectionCount('participants'));
    });

    root.querySelectorAll('[data-participant-toggle]:not([data-bound-participant-toggle])').forEach((button) => {
      button.setAttribute('data-bound-participant-toggle', '1');
      button.addEventListener('click', () => {
        const row = button.closest('[data-player-row]');
        const checkbox = row?.querySelector('input[name="participants[]"]');
        if (!checkbox || (!checkbox.checked && checkbox.disabled)) return;
        checkbox.checked = !checkbox.checked;
        updateSelectionCount('participants');
      });
    });

    root.querySelectorAll('[data-remove-import-participant]:not([data-bound-import-remove])').forEach((button) => {
      button.setAttribute('data-bound-import-remove', '1');
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-remove-import-participant');
        const checkbox = document.querySelector(`input[name="participants[]"][value="${cssEscape(id)}"]`);
        if (!checkbox) return;
        checkbox.checked = false;
        button.closest('.import-list-matches span')?.remove();
        updateSelectionCount('participants');
      });
    });

    root.querySelectorAll('[data-remove-player-row]:not([data-bound-remove-player-row])').forEach((button) => {
      button.setAttribute('data-bound-remove-player-row', '1');
      button.addEventListener('click', () => {
        const row = button.closest('[data-player-row]');
        const checkbox = row?.querySelector('input[name="participants[]"]');
        if (!row || checkbox?.checked) return;
        row.setAttribute('data-removed', '1');
        row.classList.add('hidden');
      });
    });

    root.querySelectorAll('[data-import-player-name-input]:not([data-bound-import-name])').forEach((input) => {
      input.setAttribute('data-bound-import-name', '1');
      input.addEventListener('input', () => updateImportExistingPanel(input));
      updateImportExistingPanel(input);
    });

    const participantSearch = root.querySelector('[data-participant-search]');
    if (participantSearch && !participantSearch.hasAttribute('data-bound-participant-search')) {
      participantSearch.setAttribute('data-bound-participant-search', '1');
      participantSearch.addEventListener('input', filterParticipantRows);
    }

    applyImportedPlayerIds(root);
    updateImportPlayerLimit();
    updateSelectionCount('participants');
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-use-existing-player]');
    if (!button) return;
    const index = button.getAttribute('data-use-existing-player');
    const input = document.querySelector(`[data-use-existing-player-input="${cssEscape(index)}"]`);
    if (input) {
      input.value = button.getAttribute('data-player-id') || '';
    }
  });

  bindParticipantControls(document);
  bindEncounterHistoryControls(document);

  const filterPlayerTableRows = () => {
    const search = document.querySelector('[data-player-list-search]');
    const rows = Array.from(document.querySelectorAll('[data-player-table-row]'));
    if (!search || !rows.length) return;

    const query = search.value.trim().toLowerCase();
    rows.forEach((row) => {
      const haystack = row.getAttribute('data-search') || '';
      row.classList.toggle('hidden', !(query === '' || haystack.includes(query)));
    });
  };

  const playerListSearch = document.querySelector('[data-player-list-search]');
  if (playerListSearch) {
    playerListSearch.addEventListener('input', filterPlayerTableRows);
    filterPlayerTableRows();
  }

  const playerStatFields = ['technique', 'rhythm', 'defense_physical', 'attack', 'teamwork', 'regularity', 'goalkeeper_skill'];
  const formatPlayerRating = (rating) => Number.isInteger(rating) ? String(rating) : Number(rating || 0).toFixed(1);
  const playerRatingStars = (rating) => {
    const number = Number(rating || 0);
    const full = Math.floor(number);
    const half = number % 1 !== 0;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(Math.max(0, 6 - full - (half ? 1 : 0)));
  };
  const parsePlayerJsonResponse = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      if (response.redirected || /login\.php|<!doctype html|<html/i.test(text)) {
        throw new Error('La sesion expiro. Volve a iniciar sesion e intenta guardar nuevamente.');
      }
      throw new Error('El servidor no devolvio una respuesta valida. Recarga la pagina e intenta nuevamente.');
    }
  };
  const syncPlayerStatControl = (root, value) => {
    if (!root) return;
    const rating = Math.max(1, Math.min(6, Number(value) || 1));
    const input = root.querySelector('[data-stat-rating-input]');
    const label = root.querySelector('[data-stat-rating-value]');
    if (input) input.value = String(rating);
    if (label) label.textContent = `${rating}/6`;
    root.querySelectorAll('[data-stat-value]').forEach((button) => {
      const current = Number(button.getAttribute('data-stat-value') || '0');
      button.classList.toggle('is-active', current <= rating);
      button.setAttribute('aria-checked', current === rating ? 'true' : 'false');
    });
  };
  const applyPlayerSavePayload = (payload, sourceForm) => {
    const player = payload?.player || {};
    const id = String(player.id || sourceForm?.querySelector('input[name="id"]')?.value || '');
    if (!id) return;

    const sourceData = sourceForm ? new FormData(sourceForm) : null;
    const escapedId = window.CSS && typeof window.CSS.escape === 'function'
      ? window.CSS.escape(id)
      : id.replace(/"/g, '\\"');
    const row = document.querySelector(`[data-player-edit-row][data-player-id="${escapedId}"]`);
    const rating = Number(player.skill || 0);

    if (row) {
      if (player.search) row.setAttribute('data-search', player.search);
      const nameInput = row.querySelector('input[name="name"]');
      if (nameInput && sourceData?.has('name')) nameInput.value = String(sourceData.get('name') || '');
      const activeInput = row.querySelector('input[name="active"]');
      if (activeInput && sourceData) activeInput.checked = sourceData.has('active');
      const positions = sourceData ? sourceData.getAll('positions[]').map(String) : [];
      row.querySelectorAll('input[name="positions[]"]').forEach((checkbox) => {
        checkbox.checked = positions.includes(checkbox.value);
      });
      playerStatFields.forEach((field) => {
        if (!sourceData?.has(field)) return;
        const input = row.querySelector(`[data-stat-rating-input][name="${field}"]`);
        syncPlayerStatControl(input?.closest('[data-stat-rating]'), sourceData.get(field));
      });
      const general = row.querySelector('[data-general-rating]');
      const value = general?.querySelector('[data-general-rating-value]');
      const stars = general?.querySelector('[data-general-rating-stars]');
      if (value) value.textContent = `${formatPlayerRating(rating)}/6`;
      if (stars) stars.textContent = playerRatingStars(rating);
      row.updatePlayerDirtySnapshot?.();
    }

    document.querySelectorAll(`[data-player-edit-dialog="${escapedId}"]`).forEach((dialog) => {
      const title = dialog.querySelector('.player-edit-head .small-muted');
      if (title && sourceData?.has('name')) title.textContent = String(sourceData.get('name') || '');
    });

    const mobileCard = document.querySelector(`[data-player-edit-open="${escapedId}"]`)?.closest('[data-player-table-row]');
    if (mobileCard && sourceData) {
      const strong = mobileCard.querySelector('strong');
      const small = mobileCard.querySelector('small');
      if (strong && sourceData.has('name')) strong.textContent = String(sourceData.get('name') || '');
      if (small && player.positions) small.textContent = `${player.positions} | General ${player.skill_label || `${formatPlayerRating(rating)} estrellas`}`;
      if (player.search) mobileCard.setAttribute('data-search', player.search);
    }
  };

  document.querySelectorAll('[data-player-edit-row]').forEach((row) => {
    const fields = Array.from(row.querySelectorAll('input, select, textarea'));
    const rememberRestoreTarget = (target) => {
      if (!target || target.closest('[data-player-row-save], .player-trash-icon, .player-scout-row-button')) return;
      row.playerRestoreTarget = target;
    };
    const normalizedFieldValue = (field) => {
      if (field.matches('[type="checkbox"], [type="radio"]')) {
        return field.checked ? '1' : '0';
      }
      if (field.matches('[type="number"]')) {
        const numberValue = Number.parseFloat(field.value);
        return Number.isNaN(numberValue) ? '' : String(numberValue);
      }
      return field.value;
    };
    let snapshot = fields.map((field) => ({
      field,
      value: normalizedFieldValue(field),
    }));
    const updateDirtyState = () => {
      const isDirty = snapshot.some(({ field, value }) => (
        normalizedFieldValue(field) !== value
      ));
      row.classList.toggle('is-dirty', isDirty);
    };
    row.updatePlayerDirtySnapshot = () => {
      snapshot = fields.map((field) => ({
        field,
        value: normalizedFieldValue(field),
      }));
      updateDirtyState();
    };
    fields.forEach((field) => {
      field.addEventListener('input', (event) => {
        rememberRestoreTarget(event.target);
        updateDirtyState();
      });
      field.addEventListener('change', (event) => {
        rememberRestoreTarget(event.target);
        updateDirtyState();
      });
    });
    row.addEventListener('pointerdown', (event) => {
      rememberRestoreTarget(event.target.closest('button, input, select, textarea'));
    });
    row.addEventListener('focusin', (event) => {
      rememberRestoreTarget(event.target.closest('button, input, select, textarea'));
    });
    updateDirtyState();
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[id^="player-row-"]');
    if (!form) return;

    const row = document.querySelector(`[data-player-edit-row] [form="${form.id}"]`)?.closest('[data-player-edit-row]');
    const saveButton = document.querySelector(`[data-player-row-save][form="${form.id}"]`);
    if (!row || !saveButton || saveButton.disabled) return;

    event.preventDefault();
    const rowTopBeforeSave = row.getBoundingClientRect().top;
    const restoreTarget = row.playerRestoreTarget instanceof HTMLElement
      ? row.playerRestoreTarget
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const formData = new FormData(form);
    formData.set('ajax', '1');
    if (!formData.get('ajax_token') && window.playerAjaxToken) {
      formData.set('ajax_token', window.playerAjaxToken);
    }
    saveButton.disabled = true;
    saveButton.classList.add('is-loading');
    row.classList.add('is-saving');
    row.classList.remove('is-saved');

    try {
      const response = await fetch(form.action || window.location.href, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' },
      });
      const payload = await parsePlayerJsonResponse(response);
      if (!response.ok || !payload.ok) {
        if (response.status === 401 && payload.login_url) {
          window.location.href = payload.login_url;
          return;
        }
        throw new Error(payload.message || 'No se pudo guardar el jugador.');
      }

      applyPlayerSavePayload(payload, form);
      const rowTopAfterSave = row.getBoundingClientRect().top;
      if (Number.isFinite(rowTopBeforeSave) && Number.isFinite(rowTopAfterSave)) {
        window.scrollBy({ top: rowTopAfterSave - rowTopBeforeSave, left: 0, behavior: 'auto' });
      }
      if (restoreTarget && document.contains(restoreTarget) && typeof restoreTarget.focus === 'function') {
        restoreTarget.focus({ preventScroll: true });
      }

      row.updatePlayerDirtySnapshot?.();
      row.classList.add('is-saved');
      showToast(payload.message || 'Jugador actualizado.', 'success');
      window.setTimeout(() => row.classList.remove('is-saved'), 1200);
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el jugador.', 'error');
    } finally {
      row.classList.remove('is-saving');
      saveButton.disabled = false;
      saveButton.classList.remove('is-loading');
    }
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form.player-edit-panel');
    if (!form) return;

    const id = Number(form.querySelector('input[name="id"]')?.value || 0);
    const submitButton = event.submitter || form.querySelector('button[type="submit"]');
    if (id <= 0 || submitButton?.disabled) return;

    if (window.matchMedia('(max-width: 760px)').matches) {
      return;
    }

    event.preventDefault();
    const formData = new FormData(form);
    formData.set('ajax', '1');
    if (!formData.get('ajax_token') && window.playerAjaxToken) {
      formData.set('ajax_token', window.playerAjaxToken);
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent || '';
      submitButton.textContent = 'Guardando...';
    }

    try {
      const response = await fetch(form.action || window.location.href, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'fetch' },
      });
      const payload = await parsePlayerJsonResponse(response);
      if (!response.ok || !payload.ok) {
        if (response.status === 401 && payload.login_url) {
          window.location.href = payload.login_url;
          return;
        }
        throw new Error(payload.message || 'No se pudo guardar el jugador.');
      }
      applyPlayerSavePayload(payload, form);
      showToast(payload.message || 'Jugador actualizado.', 'success');
      const dialog = form.closest('dialog');
      if (dialog) {
        if (typeof dialog.close === 'function') {
          dialog.close();
        }
        dialog.removeAttribute('open');
        document.activeElement?.blur?.();
      }
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el jugador.', 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = submitButton.dataset.originalText || 'Guardar cambios';
        delete submitButton.dataset.originalText;
      }
    }
  });

  document.querySelectorAll('[data-player-edit-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-player-edit-open');
      const escapedId = id && window.CSS && typeof window.CSS.escape === 'function'
        ? window.CSS.escape(id)
        : String(id || '').replace(/"/g, '\\"');
      const dialog = id ? document.querySelector(`[data-player-edit-dialog="${escapedId}"]`) : null;
      if (!dialog) return;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  });

  document.querySelectorAll('[data-player-edit-dialog]').forEach((dialog) => {
    dialog.querySelectorAll('[data-player-edit-close]').forEach((button) => {
      button.addEventListener('click', () => {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      });
    });
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        if (typeof dialog.close === 'function') {
          dialog.close();
        } else {
          dialog.removeAttribute('open');
        }
      }
    });
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-player-status-toggle]');
    if (!button) return;

    event.preventDefault();
    const form = button.closest('form');
    if (!form || button.disabled) return;

    const card = button.closest('[data-player-table-row]');
    const originalSearch = card?.getAttribute('data-search') || '';
    const wasActive = button.classList.contains('is-active');
    const applyStatus = (active) => {
      button.textContent = active ? 'Activo' : 'Inactivo';
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-inactive', !active);
      if (card) {
        const withoutState = originalSearch
          .replace(/\bactivo si\b/g, '')
          .replace(/\binactivo no\b/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        card.setAttribute('data-search', `${withoutState} ${active ? 'activo si' : 'inactivo no'}`.trim());
      }
    };

    applyStatus(!wasActive);
    button.disabled = true;
    button.classList.add('is-loading');

    const formData = new FormData(form);
    formData.set('ajax', '1');
    try {
      const response = await fetch(form.action || window.location.href, {
        method: 'POST',
        body: formData,
        headers: { 'X-Requested-With': 'fetch' },
      });
      const payload = await response.json();
      if (response.ok && payload.ok) {
        applyStatus(Number(payload.active) === 1);
      }
    } catch (error) {
      // Keep the interaction local; the next page load will reconcile if the request failed.
    } finally {
      button.disabled = false;
      button.classList.remove('is-loading');
    }
  });

  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-stats-player-search]');
    if (input) updateStatsPlayerSearch(input);
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-stats-player-search]');
    if (input) updateStatsPlayerSearch(input);
  });
  updateStatsPlayerSearch();

  const matchDetailPanel = document.querySelector('[data-match-detail-panel]');
  const matchDetailToggles = Array.from(document.querySelectorAll('[data-match-detail-toggle]'));
  if (matchDetailPanel && matchDetailToggles.length) {
    const updateMatchDetailLabels = (collapsed) => {
      document.querySelectorAll('[data-match-detail-label]').forEach((label) => {
        const symbol = label.querySelector('[data-match-detail-symbol]');
        const isActiveItem = label.closest('.match-list-item.active') !== null;
        const value = !collapsed && isActiveItem ? '-' : '+';
        if (symbol) {
          symbol.textContent = value;
          return;
        }
        label.textContent = `${value} Detalles`;
      });
      document.querySelectorAll('[data-match-detail-toggle]').forEach((toggle) => {
        const symbol = toggle.querySelector('[data-match-detail-symbol]');
        if (symbol) {
          symbol.textContent = collapsed ? '+' : '-';
        }
        toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      });
    };
    updateMatchDetailLabels(matchDetailPanel.hidden);
    matchDetailToggles.forEach((matchDetailToggle) => matchDetailToggle.addEventListener('click', (event) => {
      event.preventDefault();
      const collapsed = !matchDetailPanel.hidden;
      matchDetailPanel.hidden = collapsed;
      matchDetailToggles.forEach((toggle) => toggle.classList.toggle('details-collapsed', collapsed));
      updateMatchDetailLabels(collapsed);
    }));
  }

  document.querySelectorAll('[data-dismissible-alert]').forEach((alert) => {
    alert.querySelector('[data-dismissible-alert-close]')?.addEventListener('click', () => {
      alert.hidden = true;
    });
  });

  document.addEventListener('click', (event) => {
    const awardsTrigger = event.target.closest('[data-awards-trigger]');
    if (awardsTrigger) {
      openAwardsPopover(awardsTrigger);
      return;
    }
    if (event.target.closest('[data-awards-popover-close]')) {
      closeAwardsPopover();
      return;
    }
    if (event.target.matches('[data-awards-popover]')) {
      closeAwardsPopover();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAwardsPopover();
    }
  });

  collapseMobileDetails();

  document.querySelectorAll('[data-num-teams], [data-players-per-team]').forEach((input) => {
    input.addEventListener('input', () => {
      updateImportPlayerLimit();
      updateSelectionCount('participants');
    });
    input.addEventListener('change', () => {
      updateImportPlayerLimit();
      updateSelectionCount('participants');
    });
  });

  const updateRoundRobinLegRows = (form) => {
    if (!form) return;
    const toggle = form.querySelector('[data-round-robin-legs-toggle]');
    const showSecondLeg = !toggle || toggle.checked;
    form.querySelectorAll('[data-round-robin-row][data-round-robin-leg="2"]').forEach((row) => {
      row.hidden = !showSecondLeg;
    });
  };

  document.querySelectorAll('[data-round-robin-form]').forEach(updateRoundRobinLegRows);

  document.addEventListener('change', (event) => {
    const toggle = event.target.closest('[data-round-robin-legs-toggle]');
    if (!toggle) return;
    updateRoundRobinLegRows(toggle.closest('[data-round-robin-form]'));
  });

  let lastRoundRobinSubmitter = null;

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-round-robin-form] button[type="submit"]');
    if (!button) return;
    lastRoundRobinSubmitter = button;
  });
  document.addEventListener('pointerdown', (event) => {
    const button = event.target.closest('[data-round-robin-form] button[type="submit"]');
    if (!button) return;
    lastRoundRobinSubmitter = button;
  });

  const extractHtmlErrorMessage = async (response) => {
    const html = await response.text();
    const nextDocument = new DOMParser().parseFromString(html, 'text/html');
    const title = (nextDocument.querySelector('title')?.textContent || '').trim();
    const flash = (nextDocument.querySelector('.flash, .error, .alert, h1, h2')?.textContent || '').trim();
    const detail = flash || title;
    if (response.redirected || response.url.includes('login.php')) {
      return 'La sesion admin vencio. Vuelve a ingresar y reintenta.';
    }
    return detail
      ? `El servidor devolvio HTML en lugar de JSON: ${detail}`
      : 'El servidor devolvio una pagina HTML en lugar de JSON. Revisa el login o un error PHP del servidor.';
  };

  const parseRoundRobinScore = (input) => {
    const value = String(input?.value || '').trim();
    if (value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
  };

  const buildRoundRobinStandingsHtml = (form) => {
    const teams = new Map();
    const rows = Array.from(form.querySelectorAll('[data-round-robin-row]'))
      .filter((row) => !row.hidden);

    rows.forEach((row) => {
      const home = row.getAttribute('data-round-robin-home');
      const away = row.getAttribute('data-round-robin-away');
      const homeCell = row.querySelector('[data-label="Local"]');
      const awayCell = row.querySelector('[data-label="Visitante"]');
      [
        [home, homeCell],
        [away, awayCell],
      ].forEach(([team, cell]) => {
        if (!team || teams.has(team)) return;
        teams.set(team, {
          team,
          label: cell?.innerHTML || `Equipo ${team}`,
          points: 0,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          gf: 0,
          ga: 0,
          gd: 0,
        });
      });
    });

    let playedCount = 0;
    rows.forEach((row) => {
      const home = row.getAttribute('data-round-robin-home');
      const away = row.getAttribute('data-round-robin-away');
      const homeGoals = parseRoundRobinScore(row.querySelector('input[name$="[home]"]'));
      const awayGoals = parseRoundRobinScore(row.querySelector('input[name$="[away]"]'));
      if (!home || !away || homeGoals === null || awayGoals === null) return;
      const homeRow = teams.get(home);
      const awayRow = teams.get(away);
      if (!homeRow || !awayRow) return;

      playedCount += 1;
      homeRow.played += 1;
      awayRow.played += 1;
      homeRow.gf += homeGoals;
      homeRow.ga += awayGoals;
      awayRow.gf += awayGoals;
      awayRow.ga += homeGoals;

      if (homeGoals > awayGoals) {
        homeRow.won += 1;
        awayRow.lost += 1;
        homeRow.points += 3;
      } else if (homeGoals < awayGoals) {
        awayRow.won += 1;
        homeRow.lost += 1;
        awayRow.points += 3;
      } else {
        homeRow.drawn += 1;
        awayRow.drawn += 1;
        homeRow.points += 1;
        awayRow.points += 1;
      }
    });

    if (playedCount === 0) return '';

    const standings = Array.from(teams.values()).map((team) => ({
      ...team,
      gd: team.gf - team.ga,
    })).sort((a, b) => (
      (b.points - a.points)
      || (b.gd - a.gd)
      || (b.gf - a.gf)
      || (Number.parseInt(a.team, 10) - Number.parseInt(b.team, 10))
    ));

    const body = standings.map((team) => `
      <tr>
        <td data-label="Equipo" class="round-robin-standing-team"><strong>${team.label}</strong></td>
        <td data-label="Pts">${team.points}</td>
        <td data-label="PJ">${team.played}</td>
        <td data-label="G">${team.won}</td>
        <td data-label="E">${team.drawn}</td>
        <td data-label="P">${team.lost}</td>
        <td data-label="GF">${team.gf}</td>
        <td data-label="GC">${team.ga}</td>
        <td data-label="DG">${team.gd}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap mt-3" data-round-robin-standings-wrap>
        <table class="finish-table round-robin-standings">
          <thead>
            <tr>
              <th>Equipo</th>
              <th>Pts</th>
              <th>PJ</th>
              <th>G</th>
              <th>E</th>
              <th>P</th>
              <th>GF</th>
              <th>GC</th>
              <th>DG</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  };

  const submitRoundRobinScores = async (form, submitter) => {
    const target = form.querySelector('[data-round-robin-standings-target]');
    const winnerTarget = form.querySelector('[data-round-robin-winner-target]');
    const actionValue = submitter?.value || 'save_round_robin_scores';
    const action = ['calculate_round_robin_winner', 'finalize_round_robin_date'].includes(actionValue)
      ? actionValue
      : 'save_round_robin_scores';
    const rawFormData = new FormData(form);
    const formData = new FormData();
    formData.append('ajax', '1');
    formData.append('action', action);
    formData.append('match_id', rawFormData.get('match_id') || '');
    formData.append('round_robin_legs', rawFormData.has('round_robin_legs') ? '2' : '1');
    rawFormData.forEach((value, key) => {
      if (key.startsWith('round_robin[')) {
        formData.append(key, value);
      }
    });
    if (!formData.get('match_id')) {
      const urlMatch = new URL(form.action || window.location.href, window.location.href).searchParams.get('match_id');
      if (urlMatch) formData.set('match_id', urlMatch);
    }

    const buttons = Array.from(form.querySelectorAll('button'));
    buttons.forEach((button) => { button.disabled = true; });
    if (submitter) submitter.classList.add('is-loading');
    setBusy(target || form, true);

    try {
      const endpoint = new URL(form.getAttribute('action') || 'finalizar_partido.php', window.location.href);
      const response = await fetch(endpoint.toString(), {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          'X-Requested-With': 'fetch',
          Accept: 'application/json',
        },
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(await extractHtmlErrorMessage(response));
      }
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || 'No se pudo guardar el fixture.');
      }
      if (target) {
        target.innerHTML = payload.standings_html || buildRoundRobinStandingsHtml(form);
        if (!payload.standings_html) {
          target.innerHTML = buildRoundRobinStandingsHtml(form);
        }
      }
      if (winnerTarget) {
        winnerTarget.innerHTML = payload.winner_html || '';
      }
      if (action === 'finalize_round_robin_date') {
        const url = new URL(window.location.href);
        url.searchParams.set('edit_details', '1');
        url.hash = 'valoraciones';
        window.location.href = url.toString();
        return;
      }
      if (action !== 'calculate_round_robin_winner') {
        const savedRow = submitter?.closest('[data-round-robin-row]');
        if (savedRow) {
          savedRow.classList.add('is-round-robin-saved');
          submitter.classList.remove('btn-muted');
          submitter.classList.add('btn-primary', 'is-saved');
          submitter.textContent = 'Guardado';
        }
        showToast(payload.message || 'Resultados parciales guardados.', 'success');
      }
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el fixture.', 'error');
    } finally {
      buttons.forEach((button) => { button.disabled = false; });
      if (submitter) submitter.classList.remove('is-loading');
      setBusy(target || form, false);
    }
  };

  document.addEventListener('input', (event) => {
    const input = event.target.closest('[data-round-robin-row] input');
    if (!input) return;
    const row = input.closest('[data-round-robin-row]');
    const button = row?.querySelector('.round-robin-row-save');
    row?.classList.remove('is-round-robin-saved');
    if (button) {
      button.classList.remove('btn-primary', 'is-saved');
      button.classList.add('btn-muted');
      button.textContent = 'Guardar';
    }
  });

  document.addEventListener('submit', (event) => {
    const roundRobinForm = event.target.closest('[data-round-robin-form]');
    const roundRobinSubmitter = event.submitter || lastRoundRobinSubmitter;
    if (roundRobinForm && ['save_round_robin_scores', 'calculate_round_robin_winner', 'finalize_round_robin_date'].includes(roundRobinSubmitter?.value || '')) {
      event.preventDefault();
      submitRoundRobinScores(roundRobinForm, roundRobinSubmitter || null);
      lastRoundRobinSubmitter = null;
      return;
    }

    const importForm = event.target.closest(importFormSelector);
    if (importForm && String(importForm.method || 'get').toLowerCase() === 'post') {
      event.preventDefault();
      submitImportFormDynamically(importForm, event.submitter || null);
      return;
    }

    const form = event.target.closest('form[data-partial-form]');
    if (!form || String(form.method || 'get').toLowerCase() !== 'get') return;

    event.preventDefault();
    const url = new URL(form.action || window.location.href, window.location.href);
    const formData = new FormData(form);
    url.search = '';
    formData.forEach((value, key) => {
      if (String(value).trim() !== '') {
        url.searchParams.append(key, value);
      }
    });
    partialNavigate(url.toString(), { source: form });
  });

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-partial-link]');
    if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    partialNavigate(url.toString(), { source: link });
  });

  window.addEventListener('popstate', () => {
    partialNavigate(window.location.href, { replace: true });
  });

  const initManualTeams = () => {
    const root = document.querySelector('[data-manual-teams]');
    const config = window.manualTeamsConfig;
    if (!root || !config || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    const board = root.querySelector('[data-manual-board]');
    const status = root.querySelector('[data-manual-status]');
    const colorToolbar = root.querySelector('[data-manual-color-toolbar]');
    const searchInput = root.querySelector('[data-manual-player-search]');
    const mobilePanel = root.querySelector('[data-manual-mobile-panel]');
    const formationNote = root.querySelector('[data-manual-formation-note]');
    const characteristicsPanel = root.querySelector('[data-manual-team-characteristics]');
    const saveButton = root.querySelector('[data-manual-save]');
    const players = Array.isArray(config.players) ? config.players : [];
    const numTeams = Number(config.numTeams || 2);
    const playersPerTeam = Number(config.playersPerTeam || 1);
    const positions = ['ARQ', 'DEF', 'MED', 'DEL'];
    const teamColors = [
      { name: 'ROSA', className: 'manual-team-rosa' },
      { name: 'AZUL', className: 'manual-team-azul' },
      { name: 'NARANJA', className: 'manual-team-naranja' },
      { name: 'NEGRO', className: 'manual-team-negro' },
      { name: 'VERDE', className: 'manual-team-verde' },
    ];
    const selectedTeamColors = Array.from({ length: numTeams }, (_, index) => teamColors[index % teamColors.length].name);
    const assignments = new Map(players.map((player) => [String(player.id), {
      team: '',
      position: String(player.positions || 'MED').split('/').map((p) => p.trim().toUpperCase()).find((p) => positions.includes(p)) || 'MED',
    }]));

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    })[char]);

    const teamLabel = (teamNumber) => `Equipo ${teamNumber}`;
    const teamColorByName = (colorName) => teamColors.find((color) => color.name === colorName) || teamColors[0];
    const playerSearchText = (player) => [
      player.name,
      player.positions,
      player.pace,
      Number(player.skill || 0).toFixed(1),
    ].join(' ').toLowerCase();
    const desktopDragEnabled = () => window.matchMedia('(min-width: 761px)').matches;
    const mobileAssignEnabled = () => window.matchMedia('(max-width: 760px)').matches;
    let longPressTimer = null;
    let longPressKey = '';
    let touchAssignActive = false;

    const counts = () => {
      const values = Array.from({ length: numTeams }, () => 0);
      let pending = 0;
      players.forEach((player) => {
        const team = Number(assignments.get(String(player.id))?.team || 0);
        if (team >= 1 && team <= numTeams) {
          values[team - 1] += 1;
        } else {
          pending += 1;
        }
      });
      return { values, pending };
    };

    const teamsAreComplete = () => {
      const current = counts();
      const hasWrongSize = current.values.some((count) => count !== playersPerTeam);
      return current.pending === 0 && !hasWrongSize && players.length === numTeams * playersPerTeam;
    };

    const statValue = (player, field) => {
      const value = Number(player[field]);
      if (Number.isFinite(value) && value > 0) return value;
      return field === 'regularity' ? 3.5 : Number(player.skill || 0);
    };

    const lowRhythm = (player) => statValue(player, 'rhythm') <= 3;

    const teamPlayers = (teamNumber) => players.filter((player) => String(assignments.get(String(player.id))?.team || '') === String(teamNumber));

    const teamCharacteristics = (team) => {
      const total = team.reduce((sum, player) => sum + Number(player.skill || 0), 0);
      const average = (field) => team.length
        ? team.reduce((sum, player) => sum + statValue(player, field), 0) / team.length
        : 0;
      const goalkeeperSkill = team.reduce((max, player) => {
        if (!String(player.positions || '').split('/').map((pos) => pos.trim().toUpperCase()).includes('ARQ')) return max;
        return Math.max(max, statValue(player, 'goalkeeper_skill'));
      }, 0);
      return {
        total,
        attack: average('attack'),
        defensePhysical: average('defense_physical'),
        rhythm: average('rhythm'),
        technique: average('technique'),
        teamwork: average('teamwork'),
        regularity: average('regularity'),
        goalkeeperSkill,
        slow: team.filter(lowRhythm).length,
        fast: team.filter((player) => !lowRhythm(player)).length,
      };
    };

    const renderTeamCharacteristics = () => {
      if (!characteristicsPanel) return;
      if (!teamsAreComplete()) {
        characteristicsPanel.hidden = true;
        characteristicsPanel.innerHTML = '';
        return;
      }
      characteristicsPanel.hidden = false;
      characteristicsPanel.innerHTML = `
        <div class="team-characteristics-grid">
          ${Array.from({ length: numTeams }, (_, index) => {
            const teamNumber = index + 1;
            const summary = teamCharacteristics(teamPlayers(teamNumber));
            const color = teamColorByName(selectedTeamColors[index]);
            return `
              <article class="team-characteristics-card ${color.className}">
                <strong>${teamLabel(teamNumber)} (${escapeHtml(color.name)})</strong>
                <div class="team-characteristics-main">
                  <span>General ${summary.total.toFixed(1)}</span>
                  <span>${summary.fast} rapidos / ${summary.slow} lentos</span>
                </div>
                <div class="team-characteristics-stats">
                  ${summary.goalkeeperSkill > 0 ? `<span>Arquero ${summary.goalkeeperSkill.toFixed(1)}</span>` : `<span>Ataque ${summary.attack.toFixed(1)}</span>`}
                  <span>Solidez ${summary.defensePhysical.toFixed(1)}</span>
                  <span>Ritmo ${summary.rhythm.toFixed(1)}</span>
                  <span>Tecnica ${summary.technique.toFixed(1)}</span>
                  <span>Compromiso ${summary.teamwork.toFixed(1)}</span>
                  <span>Regularidad ${summary.regularity.toFixed(1)}</span>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      `;
    };

    const updateStatus = () => {
      const current = counts();
      const fullTeams = current.values.filter((count) => count === playersPerTeam).length;
      const canSave = teamsAreComplete();
      if (status) {
        status.className = `manual-teams-status mt-3 ${canSave ? 'is-ok' : 'is-pending'}`;
        status.textContent = canSave
          ? 'Todos los equipos estan completos. Ya podes elegir formaciones y guardar.'
          : `Pendientes: ${current.pending}. Equipos completos: ${fullTeams}/${numTeams}. Cada equipo debe tener ${playersPerTeam} jugadores.`;
      }
      if (formationNote) {
        formationNote.textContent = canSave
          ? 'Formaciones habilitadas. Revisa la posicion de cada jugador y guarda al final.'
          : 'Completa todos los equipos para habilitar formaciones y guardar.';
      }
      if (saveButton) {
        saveButton.disabled = !canSave;
      }
      renderTeamCharacteristics();
    };

    const warnTeamLimitReached = () => {
      const message = 'Ya llegaste al maximo de jugadores.';
      if (status) {
        status.className = 'manual-teams-status mt-3 is-warning';
        status.textContent = message;
      }
      showToast(message, 'error');
    };

    const closeMobilePanel = () => {
      if (!mobilePanel) return;
      mobilePanel.hidden = true;
      mobilePanel.innerHTML = '';
      longPressKey = '';
      touchAssignActive = false;
    };

    const openMobilePanel = (key) => {
      if (!mobilePanel || !mobileAssignEnabled()) return;
      const player = players.find((item) => String(item.id) === String(key));
      if (!player) return;
      const current = counts();
      longPressKey = String(key);
      touchAssignActive = true;
      mobilePanel.hidden = false;
      mobilePanel.innerHTML = `
        <div class="manual-mobile-assign-card">
          <div class="manual-mobile-assign-head">
            <div>
              <span>Asignar jugador</span>
              <strong>${escapeHtml(player.name)}</strong>
            </div>
            <button type="button" class="btn btn-muted" data-manual-mobile-cancel>Cancelar</button>
          </div>
          <div class="manual-mobile-assign-grid">
            ${Array.from({ length: numTeams }, (_, index) => {
              const teamNumber = index + 1;
              const selectedColor = teamColorByName(selectedTeamColors[index]);
              const count = current.values[index] || 0;
              const isCurrent = String(assignments.get(String(key))?.team || '') === String(teamNumber);
              const isFull = count >= playersPerTeam && !isCurrent;
              return `
                <button
                  type="button"
                  class="manual-mobile-team-target ${selectedColor.className} ${isCurrent ? 'is-current' : ''}"
                  data-manual-mobile-team="${teamNumber}"
                  ${isFull ? 'disabled' : ''}
                >
                  <strong aria-label="${teamLabel(teamNumber)} ${selectedColor.name}"><span class="manual-shirt-icon" aria-hidden="true"></span></strong>
                  <span>${count}/${playersPerTeam}</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      `;
    };

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const renderColorToolbar = () => {
      if (!colorToolbar) return;
      colorToolbar.innerHTML = `
        <div class="manual-team-color-toolbar-head">
          <strong>Camisetas</strong>
          <span>Elegilas antes de asignar jugadores.</span>
        </div>
        <div class="manual-team-color-grid">
          ${Array.from({ length: numTeams }, (_, index) => {
            const selectedColor = teamColorByName(selectedTeamColors[index]);
            return `
              <label class="manual-team-color-card ${selectedColor.className}">
                <span>${teamLabel(index + 1)}</span>
                <select data-manual-color="${index}">
                  ${teamColors.map((color) => `<option value="${color.name}" ${selectedColor.name === color.name ? 'selected' : ''}>${color.name}</option>`).join('')}
                </select>
              </label>
            `;
          }).join('')}
        </div>
      `;
    };

    const render = () => {
      if (!board) return;
      renderColorToolbar();
      const query = String(searchInput?.value || '').trim().toLowerCase();
      const groups = { '': [] };
      for (let i = 1; i <= numTeams; i += 1) groups[String(i)] = [];
      players.forEach((player) => {
        if (query !== '' && !playerSearchText(player).includes(query)) {
          return;
        }
        const team = String(assignments.get(String(player.id))?.team || '');
        (groups[groups[team] ? team : ''] || groups['']).push(player);
      });
      const visibleCount = Object.values(groups).reduce((sum, group) => sum + group.length, 0);
      const formationEnabled = teamsAreComplete();

      const renderPlayer = (player) => {
        const key = String(player.id);
        const assignment = assignments.get(key) || { team: '', position: 'MED' };
        return `
          <article class="manual-player-card" data-player-id="${escapeHtml(key)}" draggable="true">
            <div>
              <strong>${escapeHtml(player.name)}</strong>
              <small>${escapeHtml(player.positions || 'MED')} | ${escapeHtml(player.pace || '')} | ${Number(player.skill || 0).toFixed(1)}</small>
            </div>
            <div class="manual-player-controls">
              <select data-manual-team>
                <option value="">Sin equipo</option>
                ${Array.from({ length: numTeams }, (_, index) => {
                  const value = String(index + 1);
                  return `<option value="${value}" ${assignment.team === value ? 'selected' : ''}>${teamLabel(index + 1)}</option>`;
                }).join('')}
              </select>
              <select data-manual-position ${formationEnabled ? '' : 'disabled'} title="${formationEnabled ? 'Elegir posicion' : 'Completa todos los equipos para habilitar formaciones'}">
                ${positions.map((position) => `<option value="${position}" ${assignment.position === position ? 'selected' : ''}>${position}</option>`).join('')}
              </select>
            </div>
          </article>
        `;
      };

      board.innerHTML = `
        <section class="manual-team-column manual-team-column-pool">
          <header><strong>Sin equipo</strong><span>${groups[''].length}</span></header>
          <div class="manual-team-list">${groups[''].map(renderPlayer).join('') || '<p class="small-muted">Sin pendientes.</p>'}</div>
        </section>
        ${Array.from({ length: numTeams }, (_, index) => {
          const teamNumber = index + 1;
          const group = groups[String(teamNumber)] || [];
          const selectedColor = teamColorByName(selectedTeamColors[index]);
          return `
            <section class="manual-team-column ${selectedColor.className}" data-manual-drop-team="${teamNumber}">
              <header><strong>${teamLabel(teamNumber)} (${selectedColor.name})</strong><span>${group.length}/${playersPerTeam}</span></header>
              <div class="manual-team-list">${group.map(renderPlayer).join('') || '<p class="small-muted">Todavia no hay jugadores.</p>'}</div>
            </section>
          `;
        }).join('')}
        ${query !== '' && visibleCount === 0 ? '<p class="manual-player-search-empty">No hay jugadores que coincidan con la busqueda.</p>' : ''}
      `;
      updateStatus();
    };

    const assignPlayerToTeam = (key, targetTeam) => {
      const current = assignments.get(key) || { team: '', position: 'MED' };
      const normalizedTeam = String(targetTeam || '');
      if (normalizedTeam !== '' && normalizedTeam !== current.team) {
        const currentCounts = counts();
        const targetIndex = Number(normalizedTeam) - 1;
        if ((currentCounts.values[targetIndex] || 0) >= playersPerTeam) {
          warnTeamLimitReached();
          return false;
        }
      }
      current.team = normalizedTeam;
      assignments.set(key, current);
      if (searchInput && String(searchInput.value || '').trim() !== '') {
        searchInput.value = '';
      }
      render();
      return true;
    };

    searchInput?.addEventListener('input', render);

    board?.addEventListener('change', (event) => {
      const colorSelect = event.target.closest('[data-manual-color]');
      if (colorSelect) {
        const teamIndex = Number(colorSelect.getAttribute('data-manual-color'));
        if (teamIndex >= 0 && teamIndex < selectedTeamColors.length) {
          selectedTeamColors[teamIndex] = String(colorSelect.value || teamColors[teamIndex % teamColors.length].name);
          render();
        }
        return;
      }

      const card = event.target.closest('[data-player-id]');
      if (!card) return;
      const key = String(card.getAttribute('data-player-id') || '');
      const current = assignments.get(key) || { team: '', position: 'MED' };
      if (event.target.matches('[data-manual-team]')) {
        const targetTeam = String(event.target.value || '');
        if (!assignPlayerToTeam(key, targetTeam)) {
          event.target.value = current.team;
        }
        return;
      }
      if (event.target.matches('[data-manual-position]')) {
        current.position = String(event.target.value || 'MED');
      }
      assignments.set(key, current);
      render();
    });

    colorToolbar?.addEventListener('change', (event) => {
      if (event.target.matches('[data-manual-color]')) {
        const teamIndex = Number(event.target.getAttribute('data-manual-color'));
        if (teamIndex >= 0 && teamIndex < selectedTeamColors.length) {
          selectedTeamColors[teamIndex] = String(event.target.value || teamColors[teamIndex % teamColors.length].name);
          render();
        }
        return;
      }
    });

    board?.addEventListener('dragstart', (event) => {
      if (!desktopDragEnabled()) {
        event.preventDefault();
        return;
      }
      const card = event.target.closest('[data-player-id]');
      if (!card) return;
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(card.getAttribute('data-player-id') || ''));
    });

    board?.addEventListener('dragend', (event) => {
      event.target.closest('[data-player-id]')?.classList.remove('is-dragging');
      board.querySelectorAll('.manual-team-column.is-drag-over').forEach((column) => column.classList.remove('is-drag-over'));
    });

    board?.addEventListener('dragover', (event) => {
      if (!desktopDragEnabled()) return;
      const column = event.target.closest('[data-manual-drop-team]');
      if (!column) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      column.classList.add('is-drag-over');
    });

    board?.addEventListener('dragleave', (event) => {
      const column = event.target.closest('[data-manual-drop-team]');
      if (!column || column.contains(event.relatedTarget)) return;
      column.classList.remove('is-drag-over');
    });

    board?.addEventListener('drop', (event) => {
      if (!desktopDragEnabled()) return;
      const column = event.target.closest('[data-manual-drop-team]');
      if (!column) return;
      event.preventDefault();
      column.classList.remove('is-drag-over');
      const key = event.dataTransfer.getData('text/plain');
      if (!key) return;
      assignPlayerToTeam(key, String(column.getAttribute('data-manual-drop-team') || ''));
    });

    board?.addEventListener('touchstart', (event) => {
      if (!mobileAssignEnabled()) return;
      const card = event.target.closest('[data-player-id]');
      if (!card || event.target.closest('select, button, input')) return;
      clearLongPress();
      const key = String(card.getAttribute('data-player-id') || '');
      longPressTimer = window.setTimeout(() => {
        openMobilePanel(key);
      }, 450);
    }, { passive: true });

    board?.addEventListener('touchmove', clearLongPress, { passive: true });
    board?.addEventListener('touchmove', (event) => {
      if (!touchAssignActive || !mobilePanel || mobilePanel.hidden) return;
      const touch = event.touches[0];
      if (!touch) return;
      const target = document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-manual-mobile-team]');
      mobilePanel.querySelectorAll('.manual-mobile-team-target.is-touch-over').forEach((button) => button.classList.remove('is-touch-over'));
      if (target && !target.disabled) {
        target.classList.add('is-touch-over');
      }
    }, { passive: true });
    board?.addEventListener('touchend', (event) => {
      clearLongPress();
      if (!touchAssignActive || !longPressKey || !mobilePanel || mobilePanel.hidden) return;
      const touch = event.changedTouches[0];
      const target = touch
        ? document.elementFromPoint(touch.clientX, touch.clientY)?.closest('[data-manual-mobile-team]')
        : null;
      if (target && !target.disabled && assignPlayerToTeam(longPressKey, String(target.getAttribute('data-manual-mobile-team') || ''))) {
        closeMobilePanel();
        return;
      }
      closeMobilePanel();
    }, { passive: true });
    board?.addEventListener('touchcancel', clearLongPress, { passive: true });

    mobilePanel?.addEventListener('click', (event) => {
      if (event.target.closest('[data-manual-mobile-cancel]')) {
        closeMobilePanel();
        return;
      }
      const target = event.target.closest('[data-manual-mobile-team]');
      if (!target || !longPressKey) return;
      if (assignPlayerToTeam(longPressKey, String(target.getAttribute('data-manual-mobile-team') || ''))) {
        closeMobilePanel();
      }
    });

    saveButton?.addEventListener('click', async () => {
      updateStatus();
      if (saveButton.disabled) return;

      const teams = Array.from({ length: numTeams }, (_, index) => ({
        color_name: teamColorByName(selectedTeamColors[index]).name,
        players: [],
      }));
      players.forEach((player) => {
        const assignment = assignments.get(String(player.id)) || {};
        const team = Number(assignment.team || 0);
        if (team >= 1 && team <= numTeams) {
          teams[team - 1].players.push({
            id: Number(player.id),
            assigned_position: positions.includes(assignment.position) ? assignment.position : 'MED',
          });
        }
      });

      saveButton.disabled = true;
      saveButton.classList.add('is-loading');
      try {
        const response = await fetch('guardar_sorteo.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            match_id: Number(config.matchId),
            num_teams: numTeams,
            draw_mode: 'manual',
            teams,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || 'No se pudieron guardar los equipos.');
        }
        showToast(payload.message || 'Equipos guardados.', 'success');
        window.location.href = `finalizar_partido.php?match_id=${Number(config.matchId)}`;
      } catch (error) {
        showToast(error.message || 'No se pudieron guardar los equipos.', 'error');
        saveButton.disabled = false;
      } finally {
        saveButton.classList.remove('is-loading');
      }
    });

    render();
  };

  initManualTeams();

  document.querySelectorAll('[data-confirm]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const message = el.getAttribute('data-confirm') || 'Confirmar accion?';
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });
})();
