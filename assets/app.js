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
    if (!statsPlayerSearch || !statsPlayerResult || !statsPlayerRows.length) return;

    const query = statsPlayerSearch.value.trim().toLowerCase();
    statsPlayerRows.forEach((row) => row.classList.remove('is-highlighted'));

    if (query === '') {
      statsPlayerResult.hidden = true;
      statsPlayerRows.forEach((row) => {
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

  const hydrateDynamicContent = (root = document) => {
    collapseMobileDetails(root);
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
        toggle.textContent = el.checked ? 'Agregado' : 'Agregar';
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
    const html = checked.map((el) => `
      <div class="selected-player-item">
        <span>
          <strong>${escapeHtml(el.dataset.playerName || '')}</strong>
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

  document.querySelectorAll('[data-select-all]').forEach((selectAll) => {
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

  document.querySelectorAll('[data-random-select]').forEach((button) => {
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

  document.querySelectorAll('input[name="participants[]"]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => updateSelectionCount('participants'));
  });

  document.querySelectorAll('[data-participant-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-player-row]');
      const checkbox = row?.querySelector('input[name="participants[]"]');
      if (!checkbox || (!checkbox.checked && checkbox.disabled)) return;
      checkbox.checked = !checkbox.checked;
      updateSelectionCount('participants');
    });
  });

  document.querySelectorAll('[data-remove-player-row]').forEach((button) => {
    button.addEventListener('click', () => {
      const row = button.closest('[data-player-row]');
      const checkbox = row?.querySelector('input[name="participants[]"]');
      if (!row || checkbox?.checked) return;
      row.setAttribute('data-removed', '1');
      row.classList.add('hidden');
    });
  });

  const importedPlayerIds = document.querySelector('[data-imported-player-ids]');
  if (importedPlayerIds) {
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
  }

  const normalizeImportName = (value) => String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const existingImportPlayersSource = document.querySelector('[data-existing-import-players]');
  let existingImportPlayers = [];
  if (existingImportPlayersSource) {
    try {
      existingImportPlayers = JSON.parse(existingImportPlayersSource.textContent || '[]');
    } catch (error) {
      existingImportPlayers = [];
    }
  }

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

  document.querySelectorAll('[data-import-player-name-input]').forEach((input) => {
    input.addEventListener('input', () => updateImportExistingPanel(input));
    updateImportExistingPanel(input);
  });

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-use-existing-player]');
    if (!button) return;
    const index = button.getAttribute('data-use-existing-player');
    const input = document.querySelector(`[data-use-existing-player-input="${cssEscape(index)}"]`);
    if (input) {
      input.value = button.getAttribute('data-player-id') || '';
    }
  });

  document.querySelectorAll('#importPlayersForm, #clearImportPlayersForm, form[id^="createImportPlayerForm"], form[id^="useExistingImportPlayerForm"]').forEach((form) => {
    form.addEventListener('submit', () => {
      window.sessionStorage?.setItem(importScrollKey, String(window.scrollY));
    });
  });

  const participantSearch = document.querySelector('[data-participant-search]');
  if (participantSearch) {
    participantSearch.addEventListener('input', filterParticipantRows);
    updateImportPlayerLimit();
    updateSelectionCount('participants');
  }

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

  document.querySelectorAll('[data-player-edit-row]').forEach((row) => {
    const fields = Array.from(row.querySelectorAll('input, select, textarea'));
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
    const snapshot = fields.map((field) => ({
      field,
      value: normalizedFieldValue(field),
    }));
    const updateDirtyState = () => {
      const isDirty = snapshot.some(({ field, value }) => (
        normalizedFieldValue(field) !== value
      ));
      row.classList.toggle('is-dirty', isDirty);
    };
    fields.forEach((field) => {
      field.addEventListener('input', updateDirtyState);
      field.addEventListener('change', updateDirtyState);
    });
    updateDirtyState();
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

  document.addEventListener('submit', (event) => {
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

  document.querySelectorAll('[data-confirm]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const message = el.getAttribute('data-confirm') || 'Confirmar accion?';
      if (!window.confirm(message)) {
        event.preventDefault();
      }
    });
  });
})();
