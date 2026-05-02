(() => {
  const nav = document.getElementById('mainNav');
  const toggle = document.getElementById('menuToggle');
  if (nav && toggle) {
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }

  const getParticipantLimit = () => {
    const teams = Number.parseInt(document.querySelector('[data-num-teams]')?.value || '2', 10);
    const playersPerTeam = Number.parseInt(document.querySelector('[data-players-per-team]')?.value || '9', 10);
    return Math.max(1, teams || 1) * Math.max(1, playersPerTeam || 1);
  };

  const updateSelectionCount = (target) => {
    if (!target) return;
    const checkboxes = Array.from(document.querySelectorAll(`input[name="${target}[]"]`));
    const counter = document.querySelector(`[data-selection-count="${target}"]`);
    const maxCounter = document.querySelector(`[data-selection-max="${target}"]`);
    const selectAll = document.querySelector(`[data-select-all="${target}"]`);
    const limitMessage = document.querySelector('[data-selection-limit-message]');

    let checked = checkboxes.filter((el) => el.checked);
    let limit = checkboxes.length;

    if (target === 'participants') {
      limit = getParticipantLimit();
      if (maxCounter) {
        maxCounter.textContent = String(limit);
      }
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

    checked.forEach((el) => el.closest('.player-picker-item')?.classList.add('selected'));
    checkboxes
      .filter((el) => !el.checked)
      .forEach((el) => el.closest('.player-picker-item')?.classList.remove('selected'));

    if (counter) {
      counter.textContent = String(checked.length);
    }
    if (selectAll) {
      const cappedTotal = target === 'participants' ? Math.min(limit, checkboxes.length) : checkboxes.length;
      selectAll.checked = cappedTotal > 0 && checked.length === cappedTotal;
      selectAll.indeterminate = checked.length > 0 && checked.length < cappedTotal;
    }
    if (target === 'participants') {
      renderSelectedParticipants(checked);
      filterParticipantRows();
    }
  };

  const renderSelectedParticipants = (checked) => {
    const container = document.querySelector('[data-selected-participants]');
    const empty = document.querySelector('[data-selected-empty]');
    if (!container) return;

    if (!checked.length) {
      container.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
      return;
    }

    if (empty) empty.classList.add('hidden');
    container.innerHTML = checked.map((el) => `
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

    container.querySelectorAll('[data-remove-participant]').forEach((button) => {
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
      const visible = !checkbox?.checked && (query === '' || haystack.includes(query));
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
      checkboxes.forEach((el, index) => {
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
        return !row || !row.classList.contains('hidden');
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

  const participantSearch = document.querySelector('[data-participant-search]');
  if (participantSearch) {
    participantSearch.addEventListener('input', filterParticipantRows);
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

  const statsPlayerSearch = document.querySelector('[data-stats-player-search]');
  const statsPlayerResult = document.querySelector('[data-stats-player-result]');
  const statsPlayerRows = Array.from(document.querySelectorAll('[data-stats-player-row]'));
  const updateStatsPlayerSearch = () => {
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

  if (statsPlayerSearch) {
    statsPlayerSearch.addEventListener('input', updateStatsPlayerSearch);
    statsPlayerSearch.addEventListener('change', updateStatsPlayerSearch);
    updateStatsPlayerSearch();
  }

  const matchDetailPanel = document.querySelector('[data-match-detail-panel]');
  const matchDetailToggle = document.querySelector('[data-match-detail-toggle]');
  if (matchDetailPanel && matchDetailToggle) {
    const matchDetailLabel = matchDetailToggle.querySelector('[data-match-detail-label]');
    matchDetailToggle.addEventListener('click', (event) => {
      event.preventDefault();
      const collapsed = !matchDetailPanel.hidden;
      matchDetailPanel.hidden = collapsed;
      matchDetailToggle.classList.toggle('details-collapsed', collapsed);
      if (matchDetailLabel) {
        matchDetailLabel.textContent = collapsed ? 'Detalles' : 'Compactar';
      }
    });
  }

  const awardsPopover = document.querySelector('[data-awards-popover]');
  const awardsPopoverTitle = document.querySelector('[data-awards-popover-title]');
  const awardsPopoverBody = document.querySelector('[data-awards-popover-body]');
  const closeAwardsPopover = () => {
    if (!awardsPopover) return;
    awardsPopover.hidden = true;
    if (awardsPopoverBody) awardsPopoverBody.innerHTML = '';
  };

  document.querySelectorAll('[data-awards-trigger]').forEach((button) => {
    button.addEventListener('click', () => {
      const sourceId = button.getAttribute('data-awards-target');
      const source = sourceId ? document.getElementById(sourceId) : null;
      if (!awardsPopover || !awardsPopoverBody || !source) return;

      if (awardsPopoverTitle) {
        awardsPopoverTitle.textContent = `Premios - ${button.getAttribute('data-awards-player') || 'Jugador'}`;
      }
      awardsPopoverBody.innerHTML = source.innerHTML;
      awardsPopover.hidden = false;
    });
  });

  document.querySelector('[data-awards-popover-close]')?.addEventListener('click', closeAwardsPopover);
  awardsPopover?.addEventListener('click', (event) => {
    if (event.target === awardsPopover) {
      closeAwardsPopover();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAwardsPopover();
    }
  });

  const mobileCollapsedDetails = Array.from(document.querySelectorAll('details[data-mobile-collapsed]'));
  if (mobileCollapsedDetails.length && window.matchMedia('(max-width: 760px)').matches) {
    mobileCollapsedDetails.forEach((details) => {
      details.open = false;
    });
  }

  document.querySelectorAll('[data-num-teams], [data-players-per-team]').forEach((input) => {
    input.addEventListener('input', () => updateSelectionCount('participants'));
    input.addEventListener('change', () => updateSelectionCount('participants'));
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
