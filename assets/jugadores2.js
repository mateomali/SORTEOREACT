(function () {
  const players = Array.from(document.querySelectorAll('[data-j2-player]'));
  const searchInput = document.getElementById('j2Search');
  const filterButtons = Array.from(document.querySelectorAll('[data-j2-filter]'));
  const sortButton = document.querySelector('[data-j2-sort="overall"]');
  const empty = document.querySelector('[data-j2-empty]');
  const backdrop = document.querySelector('.j2-modal-backdrop');
  let radarOverlay = null;
  let activeFilter = 'all';
  let topSort = false;
  const anchors = [[1, 35], [2.5, 54], [3, 64], [3.2, 69], [3.5, 74], [3.8, 79], [4, 81], [4.4, 86], [4.5, 87], [5, 92], [5.2, 93], [5.3, 94], [6, 99]];

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
    return 99;
  };

  const sixFromOverall = (value) => {
    const overall = Math.max(35, Math.min(99, Math.round(Number(value) || 64)));
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
    if (overall >= 94) return '#38bdf8';
    if (overall >= 88) return '#16a34a';
    if (overall >= 76) return '#65a30d';
    if (overall >= 65) return '#d97706';
    if (overall >= 52) return '#ea580c';
    return '#dc2626';
  };

  const positionWeights = {
    ARQ: { goalkeeper_skill: 0.42, defense_physical: 0.14, rhythm: 0.10, technique: 0.10, teamwork: 0.14, mentality: 0.10 },
    DEF: { defense_physical: 0.28, rhythm: 0.20, technique: 0.18, teamwork: 0.13, mentality: 0.13, attack: 0.08 },
    LAT: { rhythm: 0.24, defense_physical: 0.22, technique: 0.17, teamwork: 0.15, attack: 0.12, mentality: 0.10 },
    DEL: { attack: 0.31, rhythm: 0.20, technique: 0.17, teamwork: 0.14, mentality: 0.10, defense_physical: 0.08 },
    MED: { technique: 0.24, rhythm: 0.23, teamwork: 0.19, mentality: 0.13, defense_physical: 0.12, attack: 0.09 },
  };

  const statFallback = (field, form) => {
    if (['technique', 'attack', 'teamwork', 'goalkeeper_skill'].includes(field)) return 3;
    if (field === 'regularity') return 3.5;
    if (field === 'rhythm') {
      const pace = String(form.querySelector('select[name="pace"]')?.value || '').toLowerCase();
      return pace === 'lento' ? 2 : 4;
    }
    return 3;
  };

  const formStatRating = (form, field) => {
    const hidden = form.querySelector(`input[name="${CSS.escape(field)}"][data-j2-six-input]`);
    return normalizeSixRating(hidden?.value, statFallback(field, form));
  };

  const recalculateFormOverall = (form) => {
    if (!form) return;
    const modal = form.closest('[data-j2-modal]');
    const primaryPosition = String(form.querySelector('[data-j2-position-select]')?.value || 'MED').toUpperCase();
    const weights = positionWeights[primaryPosition] || positionWeights.MED;
    let rating = Object.entries(weights).reduce((total, [field, weight]) => total + (formStatRating(form, field) * weight), 0);
    const regularity = formStatRating(form, 'regularity');
    rating = Math.max(1, Math.min(6, rating * (1 + ((regularity - 3.5) / 50))));
    const overall = overallFromSix(Math.round(rating * 10) / 10);
    modal?.querySelectorAll('.j2-modal-rating b').forEach((node) => {
      node.textContent = String(overall);
    });
    modal?.querySelectorAll('.j2-admin-story .j2-modal-summary article:first-child strong').forEach((node) => {
      node.textContent = String(overall);
    });
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
      if (sourceValue === '' || !Number.isFinite(rawOverall) || rawOverall < 35 || rawOverall > 99) {
        return;
      }
    }

    const overall = Math.max(35, Math.min(99, Math.round(Number.isFinite(rawOverall) ? rawOverall : 64)));
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
    recalculateFormOverall(input.closest('[data-j2-edit-form]'));
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
    recalculateFormOverall(form);
  };

  const syncPhotoPreview = (input) => {
    const file = input.files?.[0];
    const form = input.closest('[data-j2-edit-form]');
    const preview = form?.querySelector('[data-j2-photo-preview]');
    const image = preview?.querySelector('img');
    const filename = form?.querySelector('[data-j2-photo-filename]');
    if (!file || !preview || !image || !file.type.startsWith('image/')) {
      return;
    }
    image.src = URL.createObjectURL(file);
    preview.classList.remove('is-default');
    preview.classList.add('is-custom');
    if (filename) {
      filename.textContent = file.name;
    }
  };

  const closeRadarOverlay = () => {
    radarOverlay?.remove();
    radarOverlay = null;
    document.body.classList.remove('j2-radar-viewer-open');
  };

  const openRadarOverlay = (source) => {
    const svg = source?.querySelector?.('.j2-radar-svg');
    if (!svg) return;
    closeRadarOverlay();
    const modal = source.closest('[data-j2-modal]');
    const name = modal?.querySelector('.j2-modal-head h2')?.textContent?.trim() || 'Jugador';
    radarOverlay = document.createElement('div');
    radarOverlay.className = 'j2-radar-viewer';
    const panel = document.createElement('div');
    panel.className = 'j2-radar-viewer-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', `Radar completo de ${name}`);
    const closeButton = document.createElement('button');
    closeButton.className = 'j2-radar-viewer-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Cerrar radar');
    closeButton.dataset.j2RadarClose = '1';
    const title = document.createElement('div');
    title.className = 'j2-radar-viewer-title';
    title.textContent = name;
    const stage = document.createElement('div');
    stage.className = 'j2-radar-viewer-stage';
    stage.appendChild(svg.cloneNode(true));
    panel.append(closeButton, title, stage);
    radarOverlay.appendChild(panel);
    document.body.appendChild(radarOverlay);
    document.body.classList.add('j2-radar-viewer-open');
    radarOverlay.querySelector('[data-j2-radar-close]')?.focus();
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
    if (event.target.closest('[data-j2-radar-close]')) {
      closeRadarOverlay();
      return;
    }

    if (event.target.classList?.contains('j2-radar-viewer')) {
      closeRadarOverlay();
      return;
    }

    const radarCard = event.target.closest('.j2-profile-card');
    if (radarCard?.querySelector('.j2-radar-svg')) {
      openRadarOverlay(radarCard);
      return;
    }

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
      if (radarOverlay) {
        closeRadarOverlay();
        return;
      }
      closeModal();
    }
  });

  const bindEditForm = (form) => {
    if (!form || form.dataset.j2EditFormBound === '1') return;
    form.dataset.j2EditFormBound = '1';
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
    form.querySelectorAll('[data-j2-photo-input]').forEach((input) => {
      input.addEventListener('change', () => syncPhotoPreview(input));
    });
  };

  document.addEventListener('input', (event) => {
    const range = event.target.closest?.('[data-j2-stat-range]');
    if (range) {
      syncStatControl(range, true);
    }
  });

  document.addEventListener('change', (event) => {
    const range = event.target.closest?.('[data-j2-stat-range]');
    if (range) {
      syncStatControl(range, true);
    }
  });

  document.querySelectorAll('[data-j2-edit-form]').forEach((form) => {
    bindEditForm(form);
  });
})();
