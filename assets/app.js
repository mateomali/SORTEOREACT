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
        awardsPopoverTitle.textContent = button.getAttribute('data-awards-title')
          || `Premios - ${button.getAttribute('data-awards-player') || 'Jugador'}`;
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
