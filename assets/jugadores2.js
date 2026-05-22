(function () {
  const players = Array.from(document.querySelectorAll('[data-j2-player]'));
  const searchInput = document.getElementById('j2Search');
  const filterButtons = Array.from(document.querySelectorAll('[data-j2-filter]'));
  const sortButton = document.querySelector('[data-j2-sort="overall"]');
  const empty = document.querySelector('[data-j2-empty]');
  const backdrop = document.querySelector('.j2-modal-backdrop');
  let activeFilter = 'all';
  let topSort = false;
  const anchors = [[1, 35], [2.5, 54], [3, 64], [3.2, 69], [3.5, 74], [3.8, 79], [4, 81], [4.4, 86], [4.5, 87], [5, 92], [5.2, 93], [5.3, 94], [6, 98]];

  const normalizeSixRating = (value, fallback = 1) => {
    const number = Number.parseFloat(String(value ?? ''));
    const base = Number.isFinite(number) ? number : fallback;
    return Math.max(1, Math.min(6, Math.round(base * 10) / 10));
  };

  const formatRating = (rating) => Number.isInteger(rating) ? String(rating) : rating.toFixed(1);

  const overallFromSix = (value) => {
    const clamped = Math.max(1, Math.min(6, Number(value) || 1));
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const [fromRating, fromOverall] = anchors[index];
      const [toRating, toOverall] = anchors[index + 1];
      if (clamped <= toRating) {
        const ratio = (clamped - fromRating) / (toRating - fromRating);
        return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
      }
    }
    return 98;
  };

  const sixFromOverall = (value) => {
    const overall = Math.max(35, Math.min(98, Math.round(Number(value) || 64)));
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const [fromRating, fromOverall] = anchors[index];
      const [toRating, toOverall] = anchors[index + 1];
      if (overall <= toOverall) {
        const ratio = (overall - fromOverall) / (toOverall - fromOverall);
        return normalizeSixRating(fromRating + ((toRating - fromRating) * ratio));
      }
    }
    return 6;
  };

  const toneFromOverall = (overall) => {
    if (overall >= 88) return '#16a34a';
    if (overall >= 76) return '#65a30d';
    if (overall >= 65) return '#d97706';
    if (overall >= 52) return '#ea580c';
    return '#dc2626';
  };

  const syncDirtyStatRow = (row) => {
    if (!row) return;
    const numberInput = row.querySelector('[data-j2-stat-overall-input]');
    const saveButton = row.querySelector('[data-j2-stat-row-save]');
    const initial = Number(row.dataset.j2InitialOverall || '');
    const current = Number(numberInput?.value || '');
    const isDirty = Number.isFinite(initial) && Number.isFinite(current) && current !== initial;
    row.classList.toggle('is-dirty', isDirty);
    if (saveButton) {
      saveButton.hidden = !isDirty;
    }
  };

  const syncStatControl = (input, commit = false) => {
    const row = input.closest('[data-j2-edit-stat]');
    if (!row) return;
    const numberInput = row.querySelector('[data-j2-stat-overall-input]');
    const rangeInput = row.querySelector('[data-j2-stat-range]');
    const sixInput = row.querySelector('[data-j2-six-input]');
    const isRange = input.matches('[data-j2-stat-range]');
    const sourceValue = isRange ? rangeInput?.value : numberInput?.value;
    const rawOverall = Number(sourceValue);

    if (!isRange && !commit) {
      if (sourceValue === '' || !Number.isFinite(rawOverall) || rawOverall < 35 || rawOverall > 98) {
        return;
      }
    }

    const overall = Math.max(35, Math.min(98, Math.round(Number.isFinite(rawOverall) ? rawOverall : 64)));
    const rating = sixFromOverall(overall);
    if (numberInput) numberInput.value = String(overall);
    if (rangeInput) rangeInput.value = String(overall);
    if (sixInput) sixInput.value = rating.toFixed(1);
    const six = row.querySelector('[data-j2-stat-six]');
    const fill = row.querySelector('[data-j2-stat-fill]');
    if (six) six.textContent = `${formatRating(rating)}/6`;
    if (fill) {
      fill.style.width = `${Math.max(10, Math.min(100, (overall / 99) * 100))}%`;
      fill.style.backgroundColor = toneFromOverall(overall);
    }
    if (rangeInput) {
      rangeInput.style.setProperty('--j2-range-color', toneFromOverall(overall));
    }
    syncDirtyStatRow(row);
  };

  const syncEditForm = (form) => {
    const selects = Array.from(form.querySelectorAll('[data-j2-position-select]'));
    const selected = selects.map((select) => select.value).filter(Boolean);
    selects.forEach((select) => {
      Array.from(select.options).forEach((option) => {
        option.disabled = option.value !== '' && option.value !== select.value && selected.includes(option.value);
      });
    });
    const goalkeeperRow = form.querySelector('[data-j2-goalkeeper-row]');
    if (goalkeeperRow) {
      const showGoalkeeper = selects[0]?.value === 'ARQ';
      goalkeeperRow.hidden = !showGoalkeeper;
      goalkeeperRow.querySelectorAll('input').forEach((input) => {
        input.disabled = !showGoalkeeper;
      });
    }
    form.querySelectorAll('[data-j2-stat-overall-input], [data-j2-stat-range]').forEach((input) => syncStatControl(input, true));
    form.querySelectorAll('[data-j2-edit-stat]').forEach((row) => syncDirtyStatRow(row));
  };

  const applyView = () => {
    const query = (searchInput?.value || '').trim().toLowerCase();
    const sorted = players.slice().sort((a, b) => {
      if (!topSort) return 0;
      return Number(b.dataset.j2Overall || 0) - Number(a.dataset.j2Overall || 0);
    });

    sorted.forEach((node) => {
      if (topSort && node.parentElement) {
        node.parentElement.appendChild(node);
      }
    });

    let visibleCards = 0;
    players.forEach((node) => {
      const matchesFilter = activeFilter === 'all' || node.dataset.j2Group === activeFilter;
      const haystack = [
        node.dataset.j2Search || '',
        node.dataset.j2Overall || '',
        node.dataset.j2Rating || '',
      ].join(' ');
      const matchesQuery = query === '' || haystack.includes(query);
      const visible = matchesFilter && matchesQuery;
      node.hidden = !visible;
      if (visible && node.classList.contains('j2-player-card')) {
        visibleCards += 1;
      }
    });

    if (empty) {
      empty.hidden = visibleCards > 0;
    }
  };

  searchInput?.addEventListener('input', applyView);

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.j2Filter || 'all';
      filterButtons.forEach((item) => item.classList.toggle('is-selected', item === button));
      applyView();
    });
  });

  sortButton?.addEventListener('click', () => {
    topSort = !topSort;
    sortButton.classList.toggle('is-selected', topSort);
    applyView();
  });

  const closeModal = () => {
    if (backdrop) {
      backdrop.hidden = true;
    }
    document.querySelectorAll('[data-j2-modal]').forEach((modal) => {
      modal.hidden = true;
    });
  };

  document.addEventListener('click', (event) => {
    const statInfoToggle = event.target.closest('[data-j2-stat-info-toggle]');
    if (statInfoToggle) {
      event.preventDefault();
      const row = statInfoToggle.closest('[data-j2-edit-stat]');
      const open = !row?.classList.contains('is-info-open');
      row?.classList.toggle('is-info-open', open);
      statInfoToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }

    const opener = event.target.closest('[data-j2-open]');
    if (opener) {
      const modal = document.querySelector(`[data-j2-modal="${CSS.escape(opener.dataset.j2Open || '')}"]`);
      if (modal) {
        document.querySelectorAll('[data-j2-modal]').forEach((item) => {
          item.hidden = true;
        });
        modal.hidden = false;
        if (backdrop) {
          backdrop.hidden = false;
        }
      }
    }

    if (event.target.closest('[data-j2-close]')) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    const statInfoToggle = event.target.closest?.('[data-j2-stat-info-toggle]');
    if (statInfoToggle && ['Enter', ' '].includes(event.key)) {
      event.preventDefault();
      statInfoToggle.click();
      return;
    }

    if (event.key === 'Escape') {
      closeModal();
    }
  });

  document.querySelectorAll('[data-j2-edit-form]').forEach((form) => {
    syncEditForm(form);
    form.querySelectorAll('[data-j2-stat-overall-input]').forEach((input) => {
      input.addEventListener('input', () => syncStatControl(input));
      input.addEventListener('change', () => syncStatControl(input, true));
      input.addEventListener('blur', () => syncStatControl(input, true));
    });
    form.querySelectorAll('[data-j2-stat-range]').forEach((range) => {
      range.addEventListener('input', () => syncStatControl(range, true));
      range.addEventListener('change', () => syncStatControl(range, true));
    });
    form.querySelectorAll('[data-j2-position-select]').forEach((select) => {
      select.addEventListener('change', () => syncEditForm(form));
    });
  });
})();
