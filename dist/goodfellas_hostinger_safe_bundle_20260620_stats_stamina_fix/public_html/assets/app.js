(() => {
  const nav = document.getElementById('mainNav');
  const toggle = document.getElementById('menuToggle');
  const backdrop = document.getElementById('mainNavBackdrop');
  if (nav && toggle) {
    let focusBeforeMenu = null;
    const isMobileNav = () => window.matchMedia('(max-width: 760px)').matches;
    const isCompactNav = () => isMobileNav() || window.getComputedStyle(toggle).display !== 'none';
    const getFirstNavControl = () => nav.querySelector('a, summary, button, [tabindex]:not([tabindex="-1"])');
    const setBodyScrollLock = (locked) => {
      document.body.style.overflow = locked ? 'hidden' : '';
      document.body.classList.toggle('gf-mobile-menu-open', locked);
    };
    const setMenuOpen = (open, { focusMenu = true, restoreFocus = true } = {}) => {
      const wasOpen = !nav.classList.contains('hidden');
      if (open && !wasOpen) {
        focusBeforeMenu = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      }
      nav.classList.toggle('hidden', !open);
      nav.classList.toggle('flex', open);
      backdrop?.classList.toggle('hidden', !open || !isMobileNav());
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'Cerrar menu' : 'Abrir menu');
      toggle.textContent = open ? 'Cerrar' : 'Menu';
      setBodyScrollLock(open && isMobileNav());
      if (!open) {
        nav.querySelectorAll('details[open]').forEach((details) => {
          details.open = false;
        });
        if (restoreFocus && isMobileNav()) {
          const target = focusBeforeMenu && document.contains(focusBeforeMenu) ? focusBeforeMenu : toggle;
          window.setTimeout(() => target.focus({ preventScroll: true }));
        }
      } else if (focusMenu && isMobileNav()) {
        window.setTimeout(() => {
          getFirstNavControl()?.focus({ preventScroll: true });
        });
      }
    };
    toggle.addEventListener('click', () => setMenuOpen(nav.classList.contains('hidden')));
    backdrop?.addEventListener('click', () => setMenuOpen(false));
    nav.addEventListener('click', (event) => {
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || !nav.contains(link)) return;
      if (isCompactNav()) {
        setMenuOpen(false, { restoreFocus: false });
      } else {
        nav.querySelectorAll('details[open]').forEach((details) => {
          details.open = false;
        });
      }
    });
    nav.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const link = event.target instanceof Element ? event.target.closest('a') : null;
      if (!link || !nav.contains(link) || !isCompactNav()) return;
      window.setTimeout(() => {
        setMenuOpen(false);
      });
    });
    nav.addEventListener('toggle', (event) => {
      const details = event.target instanceof HTMLDetailsElement ? event.target : null;
      if (!details || !details.open || !nav.contains(details)) return;
      nav.querySelectorAll('details[open]').forEach((current) => {
        if (current !== details) {
          current.open = false;
        }
      });
    }, true);
    document.addEventListener('click', (event) => {
      if (nav.contains(event.target) || toggle.contains(event.target)) return;
      nav.querySelectorAll('details[open]').forEach((details) => {
        details.open = false;
      });
      if (isMobileNav() && !nav.classList.contains('hidden')) {
        setMenuOpen(false);
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      nav.querySelectorAll('details[open]').forEach((details) => {
        details.open = false;
      });
      if (isMobileNav() && !nav.classList.contains('hidden')) {
        setMenuOpen(false);
      }
    });
    window.addEventListener('resize', () => {
      if (!isMobileNav()) {
        nav.classList.remove('hidden', 'flex');
        backdrop?.classList.add('hidden');
        setBodyScrollLock(false);
        focusBeforeMenu = null;
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Abrir menu');
        toggle.textContent = 'Menu';
      } else if (!nav.classList.contains('flex')) {
        nav.classList.add('hidden');
        backdrop?.classList.add('hidden');
        setBodyScrollLock(false);
        focusBeforeMenu = null;
      } else {
        backdrop?.classList.remove('hidden');
        setBodyScrollLock(true);
      }
    });
  }

  const getMainContent = () => document.querySelector('main.content');

  const appUi = window.GoodfellasApp || {};
  const showToast = appUi.showToast || (() => {});
  const setBusy = appUi.setBusy || ((el, busy) => {
    if (!el) return;
    el.classList.toggle('is-partial-loading', busy);
    el.setAttribute('aria-busy', busy ? 'true' : 'false');
  });

  const mountReactIslands = (root = document) => {
    const scope = root instanceof HTMLElement || root instanceof Document ? root : document;
    scope.querySelectorAll?.('[data-react-root]:not([data-react-mounted="1"])').forEach((island) => {
      document.dispatchEvent(new CustomEvent('goodfellas:mount-react', { detail: { root: island } }));
    });
  };

  const collapseMobileDetails = (root = document) => {
    if (!window.matchMedia('(max-width: 760px)').matches) return;
    root.querySelectorAll('details[data-mobile-collapsed]').forEach((details) => {
      details.open = false;
    });
  };

  const scrollExpandedPanelIntoView = (panel, { delay = 80 } = {}) => {
    if (!(panel instanceof HTMLElement)) return;
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    window.setTimeout(() => {
      panel.scrollIntoView({ behavior, block: 'start', inline: 'nearest' });
    }, delay);
  };

  const bindExpandablePanelScroll = (root = document) => {
    root.querySelectorAll?.('details:not([data-expand-scroll-bound="1"])').forEach((details) => {
      details.dataset.expandScrollBound = '1';
      details.addEventListener('toggle', () => {
        if (!details.open || details.dataset.disableExpandScroll === '1') return;
        scrollExpandedPanelIntoView(details);
      });
    });
  };

  const focusHashTarget = () => {
    if (!window.location.hash) return;
    let targetId = window.location.hash.slice(1);
    try {
      targetId = decodeURIComponent(targetId);
    } catch (error) {
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    window.setTimeout(() => {
      target.focus({ preventScroll: false });
    }, 0);
  };

  const bindStaticTeamFormationDrag = () => {
    if (document.documentElement.dataset.staticTeamFormationDragBound === '1') return;
    document.documentElement.dataset.staticTeamFormationDragBound = '1';
    let dragSource = null;
    const undoStacks = new WeakMap();

    const playerCardFromEvent = (event) => event.target?.closest?.('[data-static-formation-player]');
    const formationLines = (formation) => Array.from(formation.querySelectorAll('.formation-line'));
    const formationLocked = (formation) => formation?.dataset?.staticFormationLocked === '1';
    const lineKey = (line) => line.querySelector('.line-label')?.textContent?.trim() || '';
    const linePositions = (line) => lineKey(line)
      .split('/')
      .map((position) => position.trim().toUpperCase())
      .filter(Boolean);
    const linePlayers = (line) => line.querySelector('.line-players');
    const clampRating = (value) => Math.max(1, Math.min(6, Number(value || 0)));
    const playerCardRating = (value) => {
      const rating = clampRating(value);
      const anchors = [
        [1.0, 35], [2.5, 54], [3.0, 64], [3.2, 69], [3.5, 74],
        [3.8, 79], [4.0, 81], [4.4, 86], [4.5, 87], [5.0, 92],
        [5.2, 93], [5.3, 94], [6.0, 98],
      ];
      for (let i = 0; i < anchors.length - 1; i += 1) {
        const [fromRating, fromOverall] = anchors[i];
        const [toRating, toOverall] = anchors[i + 1];
        if (rating <= toRating) {
          const ratio = (rating - fromRating) / (toRating - fromRating);
          return Math.round(fromOverall + ((toOverall - fromOverall) * ratio));
        }
      }
      return 98;
    };
    const playerCardTier = (value) => {
      const overall = playerCardRating(value);
      if (overall >= 88) return 'supreme';
      if (overall >= 84) return 'elite';
      if (overall >= 76) return 'gold';
      if (overall >= 66) return 'silver';
      return 'bronze';
    };
    const updatePlayerCardTier = (card, value) => {
      if (!card?.classList?.contains('formation-card-sin-stat')) return;
      ['bronze', 'silver', 'gold', 'elite', 'supreme'].forEach((tier) => {
        card.classList.toggle(`formation-card-tier-${tier}`, playerCardTier(value) === tier);
      });
    };
    const updatePlayerCardPositionState = (card, assignedPosition) => {
      if (!card?.classList?.contains('formation-card-sin-stat')) return;
      const positions = cardPositions(card);
      const primary = positions[0] || '';
      card.classList.toggle('is-position-changed', Boolean(primary && String(assignedPosition || '').toUpperCase() !== primary));
    };
    const cardPositions = (card) => String(card.dataset.playerPositions || '')
      .split('/')
      .map((position) => position.trim().toUpperCase())
      .filter(Boolean);
    const cardStat = (card, field) => {
      const datasetKey = `player${field.charAt(0).toUpperCase()}${field.slice(1)}`;
      if (field === 'Stamina' && !card.dataset[datasetKey]) return cardStat(card, 'Rhythm');
      const fallback = field === 'Regularity' ? 3.5 : (field === 'Mentality' ? 3.0 : Number(card.dataset.playerSkill || 0));
      const value = Number(card.dataset[datasetKey]);
      return Number.isFinite(value) && value > 0 ? value : fallback;
    };
    const weightedCardRating = (card, weights) => (
      Object.entries(weights).reduce((total, [field, weight]) => total + (cardStat(card, field) * weight), 0)
    );
    const applyCardRegularity = (rating, card) => clampRating(rating * (1 + ((cardStat(card, 'Regularity') - 3.5) / 50)));
    const adjustedCardRating = (card, assignedPosition) => {
      const position = String(assignedPosition || '').toUpperCase();
      const generalRating = clampRating(card.dataset.playerSkill || 0);
      const positions = cardPositions(card);
      if (!position || positions.includes(position)) return generalRating;
      let rating = generalRating;
      if (position === 'ARQ') {
        const goalkeeperSkill = positions.includes('ARQ') ? cardStat(card, 'GoalkeeperSkill') : 2.0;
        rating = (goalkeeperSkill * 0.38)
          + (cardStat(card, 'DefensePhysical') * 0.12)
          + (cardStat(card, 'Rhythm') * 0.08)
          + (cardStat(card, 'Stamina') * 0.08)
          + (cardStat(card, 'Technique') * 0.10)
          + (cardStat(card, 'Teamwork') * 0.14)
          + (cardStat(card, 'Mentality') * 0.10);
      } else if (position === 'DEF') {
        rating = weightedCardRating(card, {
          DefensePhysical: 0.26,
          Stamina: 0.18,
          Rhythm: 0.16,
          Technique: 0.16,
          Teamwork: 0.12,
          Mentality: 0.12,
          Attack: 0.06,
        });
      } else if (position === 'LAT') {
        rating = weightedCardRating(card, {
          Rhythm: 0.22,
          DefensePhysical: 0.20,
          Stamina: 0.18,
          Technique: 0.16,
          Teamwork: 0.14,
          Attack: 0.07,
          Mentality: 0.03,
        });
      } else if (position === 'MED') {
        rating = weightedCardRating(card, {
          Technique: 0.22,
          Rhythm: 0.18,
          Teamwork: 0.18,
          Stamina: 0.15,
          Mentality: 0.12,
          DefensePhysical: 0.09,
          Attack: 0.06,
        });
      } else if (position === 'DEL') {
        rating = weightedCardRating(card, {
          Attack: 0.30,
          Rhythm: 0.20,
          Technique: 0.16,
          Teamwork: 0.12,
          Stamina: 0.10,
          Mentality: 0.08,
          DefensePhysical: 0.04,
        });
      }
      return applyCardRegularity(rating, card);
    };
    const updatePlayerCardRating = (card) => {
      const ratingBox = card?.querySelector?.('.player-card-rating');
      if (!ratingBox) return;
      const position = String(card.dataset.assignedPosition || '').toUpperCase();
      const adjustedRating = adjustedCardRating(card, position);
      const value = ratingBox.querySelector('strong');
      const label = ratingBox.querySelector('span');
      if (value) value.textContent = String(playerCardRating(adjustedRating));
      if (label) label.textContent = card.classList.contains('formation-card-sin-stat') ? 'GEN' : (position || 'GEN');
      const positionLabel = card.querySelector('.formation-card-position');
      if (positionLabel) positionLabel.textContent = position || 'GEN';
      if (position === 'LAT') {
        card.dataset.laneRole = 'lateral';
      } else {
        delete card.dataset.laneRole;
      }
      updatePlayerCardTier(card, adjustedRating);
      updatePlayerCardPositionState(card, position);
    };
    const assignedPositionForLine = (card, line) => {
      const positions = linePositions(line);
      if (!positions.length) return '';
      if (positions.length === 1) return positions[0];
      const current = String(card.dataset.assignedPosition || '').toUpperCase();
      if (positions.includes(current)) return current;
      const natural = cardPositions(card).find((position) => positions.includes(position));
      return natural || positions[0];
    };
    const orderDefenseLinePlayers = (formation) => {
      formationLines(formation).forEach((line) => {
        if (!linePositions(line).includes('LAT')) return;
        const parent = linePlayers(line);
        if (!parent) return;
        const cards = Array.from(parent.querySelectorAll('[data-static-formation-player]'));
        const laterals = cards.filter((card) => String(card.dataset.assignedPosition || '').toUpperCase() === 'LAT');
        const defenders = cards.filter((card) => String(card.dataset.assignedPosition || '').toUpperCase() !== 'LAT');
        if (!laterals.length) return;
        const leftCount = Math.ceil(laterals.length / 2);
        [...laterals.slice(0, leftCount), ...defenders, ...laterals.slice(leftCount)].forEach((card) => {
          parent.appendChild(card);
        });
      });
    };
    const ensureUndoButton = (formation) => {
      if (formationLocked(formation)) return;
      if (!formation || formation.querySelector(':scope > [data-static-formation-undo]')) return;
      const button = document.createElement('button');
      button.className = 'formation-undo-button';
      button.type = 'button';
      button.title = 'Deshacer ultimo cambio';
      button.setAttribute('aria-label', 'Deshacer ultimo cambio');
      button.dataset.staticFormationUndo = '1';
      button.disabled = true;
      button.textContent = '\u21b6';
      formation.prepend(button);
    };
    const refreshUndoButton = (formation) => {
      if (formationLocked(formation)) return;
      ensureUndoButton(formation);
      const button = formation.querySelector(':scope > [data-static-formation-undo]');
      if (button) button.disabled = !(undoStacks.get(formation) || []).length;
    };
    const updateFormationTotal = (formation) => {
      if (!formation) return;
      const titleContainer = formation.previousElementSibling?.matches?.('.formation-title-row')
        ? formation.previousElementSibling
        : null;
      const externalTitle = formation.previousElementSibling?.matches?.('.formation-total-title')
        ? formation.previousElementSibling
        : titleContainer?.querySelector('[data-formation-total-title]') || null;
      let badge = formation.querySelector(':scope > [data-formation-total]');
      if (externalTitle) {
        if (badge) badge.remove();
        badge = null;
      }
      const total = Array.from(formation.querySelectorAll('[data-static-formation-player]'))
        .reduce((sum, card) => sum + Number(card.dataset.playerSkill || card.dataset.skill || 0), 0);
      if (externalTitle) {
        const value = externalTitle.querySelector('strong');
        if (value) value.textContent = `${total.toFixed(1)} pts`;
        const tactic = titleContainer?.querySelector('[data-formation-tactic]') || externalTitle.querySelector('[data-formation-tactic]');
        if (tactic) {
          const cards = Array.from(formation.querySelectorAll('[data-static-formation-player]'));
          const counts = ['DEF', 'LAT', 'MED', 'DEL'].map((position) => (
            cards.filter((card) => String(card.dataset.assignedPosition || '').toUpperCase() === position).length
          ));
          tactic.textContent = counts.join('-');
        }
        return;
      }
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'formation-total-badge';
        badge.dataset.formationTotal = '1';
        badge.setAttribute('aria-live', 'polite');
        formation.prepend(badge);
      }
      badge.textContent = `TOTAL: ${total.toFixed(1)} pts`;
    };
    const ensureAllUndoButtons = (root = document) => {
      root.querySelectorAll?.('[data-static-team-formation]').forEach((formation) => {
        refreshUndoButton(formation);
        syncAssignedPositions(formation);
        updateFormationTotal(formation);
      });
    };
    const snapshotFormation = (formation) => formationLines(formation).flatMap((line) => {
      const parent = linePlayers(line);
      return Array.from(parent?.querySelectorAll('[data-static-formation-player]') || []).map((card, index) => ({
        card,
        index,
        line: lineKey(line),
        assignedPosition: card.dataset.assignedPosition || lineKey(line),
      }));
    });
    const pushUndo = (formation) => {
      const stack = undoStacks.get(formation) || [];
      stack.push(snapshotFormation(formation));
      undoStacks.set(formation, stack);
      refreshUndoButton(formation);
    };
    const restoreSnapshot = (formation, snapshot) => {
      snapshot.forEach((item) => {
        const line = formationLines(formation).find((candidate) => lineKey(candidate) === item.line);
        const parent = linePlayers(line);
        if (!parent || !item.card) return;
        const cards = Array.from(parent.querySelectorAll('[data-static-formation-player]'));
        parent.insertBefore(item.card, cards[item.index] || null);
        item.card.dataset.assignedPosition = item.assignedPosition || item.line;
      });
      syncAssignedPositions(formation);
      updateFormationTotal(formation);
    };
    const undoFormation = (formation) => {
      const stack = undoStacks.get(formation) || [];
      const snapshot = stack.pop();
      if (!snapshot) return;
      restoreSnapshot(formation, snapshot);
      refreshUndoButton(formation);
    };
    const cleanup = () => {
      document.querySelectorAll('[data-static-formation-player].is-dragging, [data-static-formation-player].is-drag-over')
        .forEach((card) => card.classList.remove('is-dragging', 'is-drag-over'));
    };
    const swapElements = (source, target) => {
      const sourceParent = source.parentNode;
      const targetParent = target.parentNode;
      if (!sourceParent || !targetParent || source === target) return;
      const sourceNext = source.nextSibling === target ? source : source.nextSibling;
      const targetNext = target.nextSibling === source ? target : target.nextSibling;
      targetParent.insertBefore(source, targetNext);
      sourceParent.insertBefore(target, sourceNext);
    };
    const syncAssignedPositions = (formation) => {
      formation.querySelectorAll('[data-static-formation-player]').forEach((card) => {
        const line = card.closest('.formation-line');
        const assigned = line ? assignedPositionForLine(card, line) : '';
        if (assigned) card.dataset.assignedPosition = assigned;
        updatePlayerCardRating(card);
      });
      orderDefenseLinePlayers(formation);
    };
    const wouldKeepSingleGoalkeeper = (formation, source, target) => {
      let goalkeepers = 0;
      formation.querySelectorAll('[data-static-formation-player]').forEach((card) => {
        let position = card.dataset.assignedPosition || '';
        if (card === source) {
          position = target.dataset.assignedPosition || position;
        } else if (card === target) {
          position = source.dataset.assignedPosition || position;
        }
        if (position === 'ARQ') goalkeepers++;
      });
      return goalkeepers <= 1;
    };

    document.addEventListener('dragstart', (event) => {
      const card = playerCardFromEvent(event);
      const formation = card?.closest('[data-static-team-formation]');
      if (!card || !formation) return;
      if (formationLocked(formation)) {
        event.preventDefault();
        dragSource = null;
        return;
      }
      dragSource = card;
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.staticPlayerKey || '');
    });

    document.addEventListener('dragover', (event) => {
      const card = playerCardFromEvent(event);
      if (!card || !dragSource || card === dragSource) return;
      const formation = card.closest('[data-static-team-formation]');
      if (formationLocked(formation)) return;
      if (formation !== dragSource.closest('[data-static-team-formation]')) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      card.classList.add('is-drag-over');
    });

    document.addEventListener('dragleave', (event) => {
      const card = playerCardFromEvent(event);
      if (card) card.classList.remove('is-drag-over');
    });

    document.addEventListener('drop', (event) => {
      const target = playerCardFromEvent(event);
      if (!target || !dragSource || target === dragSource) return;
      const formation = target.closest('[data-static-team-formation]');
      if (!formation || formation !== dragSource.closest('[data-static-team-formation]')) return;
      if (formationLocked(formation)) return;
      event.preventDefault();
      if (!wouldKeepSingleGoalkeeper(formation, dragSource, target)) {
        showToast('Cada equipo puede tener como maximo un arquero.', 'error');
        cleanup();
        dragSource = null;
        return;
      }
      pushUndo(formation);
      swapElements(dragSource, target);
      syncAssignedPositions(formation);
      updateFormationTotal(formation);
      cleanup();
      dragSource = null;
    });

    document.addEventListener('dragend', () => {
      cleanup();
      dragSource = null;
    });

    document.addEventListener('click', (event) => {
      const button = event.target?.closest?.('[data-static-formation-undo]');
      if (!button) return;
      const formation = button.closest('[data-static-team-formation]');
      if (!formation) return;
      undoFormation(formation);
    });

    ensureAllUndoButtons();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches('[data-static-team-formation]')) {
            refreshUndoButton(node);
          } else {
            ensureAllUndoButtons(node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  const updateActiveNavigation = (nextDocument) => {
    const nextNav = nextDocument.querySelector('#mainNav');
    const currentNav = document.querySelector('#mainNav');
    if (!nextNav || !currentNav) return;
    currentNav.innerHTML = nextNav.innerHTML;
    currentNav.classList.remove('open');
  };

  const updatePageChrome = (nextDocument) => {
    const nextBodyClass = nextDocument.body?.getAttribute('class') || '';
    if (nextBodyClass) {
      document.body.className = nextBodyClass;
    } else {
      document.body.removeAttribute('class');
    }
    updateActiveNavigation(nextDocument);
  };

  const scrollToUrlTarget = (url, fallbackTop = true) => {
    const hash = new URL(url, window.location.href).hash;
    const id = hash ? decodeURIComponent(hash.slice(1)) : '';
    const target = id ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (fallbackTop) {
      const restoreTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      restoreTop();
      window.requestAnimationFrame(() => {
        restoreTop();
        window.requestAnimationFrame(restoreTop);
      });
      [40, 120, 240, 480].forEach((delay) => {
        window.setTimeout(restoreTop, delay);
      });
    }
  };

  const runPageScripts = (nextDocument) => {
    nextDocument.querySelectorAll('script').forEach((script) => {
      const type = (script.type || '').trim().toLowerCase();
      if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) return;

      if (script.src) {
        const src = new URL(script.src, window.location.href);
        if (/\/assets\/(?:app|react\/react-app)\.js$/i.test(src.pathname)) return;
        const shouldRerunScript = /\/assets\/(?:sorteo-legacy|capitanes|finalizar-partido|jugadores|home-captains)\.js$/i.test(src.pathname);
        if (!shouldRerunScript && document.querySelector(`script[src="${src.href}"]`)) return;
        const nextScript = document.createElement('script');
        nextScript.src = src.href;
        nextScript.async = false;
        if (type === 'module') nextScript.type = 'module';
        if (shouldRerunScript) {
          nextScript.addEventListener('load', () => nextScript.remove(), { once: true });
          nextScript.addEventListener('error', () => nextScript.remove(), { once: true });
        }
        document.body.appendChild(nextScript);
        return;
      }

      const nextScript = document.createElement('script');
      if (type === 'module') nextScript.type = 'module';
      nextScript.textContent = script.textContent || '';
      document.body.appendChild(nextScript);
      nextScript.remove();
    });
  };

  bindStaticTeamFormationDrag();

  const bindCompactFormationCardPreview = (root = document) => {
    root.querySelectorAll?.('.formation-card-compacta.formation-card-sin-stat').forEach((card) => {
      if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      if (!card.hasAttribute('role')) card.setAttribute('role', 'button');
      if (!card.hasAttribute('aria-label')) {
        const name = card.querySelector('.formation-player-name')?.textContent?.trim() || 'jugador';
        card.setAttribute('aria-label', `Ver carta stat de ${name}`);
      }
    });

    if (document.documentElement.dataset.compactFormationPreviewBound === '1') return;
    document.documentElement.dataset.compactFormationPreviewBound = '1';
    let activePreview = null;

    const closePreview = () => {
      activePreview?.remove();
      activePreview = null;
      document.body.classList.remove('has-formation-card-preview');
    };

    const openPreview = (sourceCard) => {
      if (!sourceCard?.classList?.contains('formation-card-compacta')) return;
      closePreview();

      const preview = document.createElement('div');
      preview.className = 'formation-card-preview-overlay';
      preview.setAttribute('role', 'dialog');
      preview.setAttribute('aria-modal', 'true');
      preview.setAttribute('aria-label', 'Carta stat del jugador');
      preview.innerHTML = `
        <button class="formation-card-preview-close" type="button" aria-label="Cerrar carta">×</button>
        <div class="formation-card-preview-stage team-formation"></div>
      `;

      const card = sourceCard.cloneNode(true);
      card.classList.remove('formation-card-compacta', 'is-dragging', 'is-drag-over');
      card.classList.add('formation-card-preview-stat');
      card.setAttribute('draggable', 'false');
      card.removeAttribute('data-static-formation-player');
      card.removeAttribute('data-sorteo-drag-player');
      card.removeAttribute('data-drag-player-id');
      preview.querySelector('.formation-card-preview-stage')?.appendChild(card);
      document.body.appendChild(preview);
      document.body.classList.add('has-formation-card-preview');
      activePreview = preview;
      preview.querySelector('.formation-card-preview-close')?.focus({ preventScroll: true });
    };

    document.addEventListener('click', (event) => {
      const closeButton = event.target.closest?.('.formation-card-preview-close');
      if (closeButton) {
        event.preventDefault();
        closePreview();
        return;
      }
      if (activePreview && event.target === activePreview) {
        closePreview();
        return;
      }
      const card = event.target.closest?.('.formation-card-compacta.formation-card-sin-stat');
      if (!card || !root.contains(card)) return;
      event.preventDefault();
      openPreview(card);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && activePreview) {
        closePreview();
        return;
      }
      if (!['Enter', ' '].includes(event.key)) return;
      const card = event.target.closest?.('.formation-card-compacta.formation-card-sin-stat');
      if (!card) return;
      event.preventDefault();
      openPreview(card);
    });
  };

  const updateStatsPlayerSearch = (input = document.querySelector('[data-stats-player-search]')) => {
    const statsPlayerSearch = input;
    const statsPlayerResult = document.querySelector('[data-stats-player-result]');
    const statsPlayerRows = Array.from(document.querySelectorAll('[data-stats-player-row]'));
    const statsFilterRows = Array.from(document.querySelectorAll('[data-stats-player-filter-row]'));
    if (!statsPlayerSearch || !statsPlayerResult || !statsPlayerRows.length) return;

    const normalizeStatsPlayerName = (value) => String(value || '')
      .toLocaleLowerCase('es-AR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
    const escapeStatsRankingHtml = (value) => String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    const parseStatsRankings = (value) => {
      try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        return [];
      }
    };
    const hideStatsRankingCard = () => {
      const rankingCard = document.querySelector('[data-stats-selected-ranking-card]');
      const rankingGrid = document.querySelector('[data-stats-selected-ranking-grid]');
      if (rankingCard) rankingCard.hidden = true;
      if (rankingGrid) rankingGrid.innerHTML = '';
    };
    const renderStatsRankingCard = (selected) => {
      const rankingCard = document.querySelector('[data-stats-selected-ranking-card]');
      const rankingTitle = document.querySelector('[data-stats-selected-ranking-title]');
      const rankingGrid = document.querySelector('[data-stats-selected-ranking-grid]');
      if (!rankingCard || !rankingGrid) return;
      const rankings = parseStatsRankings(selected.dataset.rankings || '[]');
      if (!rankings.length) {
        hideStatsRankingCard();
        return;
      }
      if (rankingTitle) rankingTitle.textContent = `Posición en rankings de ${selected.dataset.playerName || 'jugador'}`;
      rankingGrid.innerHTML = rankings.map((item) => {
        const position = item.position ?? null;
        const total = Number(item.total || 0);
        const isTop = position !== null && Number(position) <= 3;
        const value = item.value !== null && item.value !== undefined && item.value !== ''
          ? ` | ${escapeStatsRankingHtml(item.value)} ${escapeStatsRankingHtml(item.suffix || '')}`.trimEnd()
          : '';
        return `
          <article class="profile-ranking-item${isTop ? ' is-top' : ''}">
            <span class="profile-ranking-label">${escapeStatsRankingHtml(item.label || '')}</span>
            <strong class="profile-ranking-position">${position !== null ? `#${position}` : '-'}</strong>
            <small>${position !== null ? `de ${total}` : 'sin datos'}${value}</small>
          </article>
        `;
      }).join('');
      rankingCard.hidden = false;
    };
    const query = normalizeStatsPlayerName(statsPlayerSearch.value);
    [...statsPlayerRows, ...statsFilterRows].forEach((row) => row.classList.remove('is-highlighted'));

    if (query === '') {
      statsPlayerResult.hidden = true;
      const selectedProfileCard = document.querySelector('[data-stats-selected-profile-card]');
      const selectedProfile = document.querySelector('[data-stats-selected-profile]');
      if (selectedProfileCard) selectedProfileCard.hidden = true;
      if (selectedProfile) selectedProfile.innerHTML = '';
      hideStatsRankingCard();
      [...statsPlayerRows, ...statsFilterRows].forEach((row) => {
        row.classList.remove('hidden');
      });
      return;
    }

    const exact = statsPlayerRows.find((row) => normalizeStatsPlayerName(row.dataset.playerName) === query);
    const partial = statsPlayerRows.find((row) => normalizeStatsPlayerName(row.dataset.playerName).includes(query));
    const selected = exact || partial;

    statsPlayerRows.forEach((row) => {
      const name = normalizeStatsPlayerName(row.dataset.playerName);
      row.classList.toggle('hidden', !name.includes(query));
    });
    statsFilterRows.forEach((row) => {
      const name = normalizeStatsPlayerName(row.dataset.playerName);
      const isMatch = name.includes(query);
      row.classList.toggle('hidden', !isMatch);
      row.classList.toggle('is-highlighted', Boolean(selected) && name === normalizeStatsPlayerName(selected.dataset.playerName));
    });

    if (!selected) {
      statsPlayerResult.hidden = true;
      const selectedProfileCard = document.querySelector('[data-stats-selected-profile-card]');
      const selectedProfile = document.querySelector('[data-stats-selected-profile]');
      if (selectedProfileCard) selectedProfileCard.hidden = true;
      if (selectedProfile) selectedProfile.innerHTML = '';
      hideStatsRankingCard();
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
    const selectedProfileCard = document.querySelector('[data-stats-selected-profile-card]');
    const selectedProfile = document.querySelector('[data-stats-selected-profile]');
    if (selectedProfileCard && selectedProfile) {
      selectedProfile.innerHTML = '';
      selectedProfileCard.hidden = true;
    }
    renderStatsRankingCard(selected);
  };

  const bindSortableStatsPlayerGrids = (root = document) => {
    root.querySelectorAll?.('[data-stats-sortable-grid]:not([data-stats-sortable-bound="1"])').forEach((grid) => {
      grid.dataset.statsSortableBound = '1';
      const buttons = Array.from(grid.querySelectorAll('[data-stats-sort]'));
      const rows = () => Array.from(grid.querySelectorAll('[data-stats-player-row]'));
      const normalizeNumber = (value) => {
        const rawValue = String(value ?? '').trim();
        if (rawValue === '' || rawValue === '-') return null;
        const normalized = Number(rawValue.replace(',', '.'));
        return Number.isFinite(normalized) ? normalized : null;
      };
      const valueFor = (row, key, type) => {
        if (type === 'number') {
          return normalizeNumber(key === 'rating' ? row.dataset.ratingSort : row.dataset[key]);
        }
        return String(key === 'name' ? row.dataset.playerName : row.dataset[key] || '').trim().toLowerCase();
      };
      const resetButtons = (activeKey, direction) => {
        buttons.forEach((button) => {
          const active = button.dataset.statsSort === activeKey;
          button.classList.toggle('is-active', active);
          button.dataset.sortDirection = active ? direction : '';
          button.setAttribute('aria-sort', active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none');
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
          if (active) {
            const label = button.querySelector('span')?.textContent?.trim() || 'columna';
            button.setAttribute('title', `${label}: ${direction === 'asc' ? 'menor a mayor' : 'mayor a menor'}`);
          } else {
            button.removeAttribute('title');
          }
        });
      };

      buttons.forEach((button) => {
        button.setAttribute('aria-sort', 'none');
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          grid.querySelectorAll('[data-stats-row-detail-panel]').forEach((panel) => panel.remove());
          grid.querySelectorAll('[data-stats-row-detail-trigger][aria-expanded="true"]').forEach((trigger) => {
            trigger.setAttribute('aria-expanded', 'false');
            trigger.classList.remove('is-active');
          });
          const key = button.dataset.statsSort || '';
          const type = button.dataset.sortType || 'text';
          const previousDirection = buttons.find((candidate) => (
            candidate.dataset.statsSort === key && candidate.dataset.sortDirection
          ))?.dataset.sortDirection || '';
          const direction = previousDirection === 'desc' ? 'asc' : (previousDirection === 'asc' ? 'desc' : (type === 'number' ? 'desc' : 'asc'));
          const directionMultiplier = direction === 'asc' ? 1 : -1;
          const sortedRows = rows().sort((leftRow, rightRow) => {
            const leftValue = valueFor(leftRow, key, type);
            const rightValue = valueFor(rightRow, key, type);
            if (type === 'number') {
              if (leftValue === null && rightValue === null) return Number(leftRow.dataset.sortIndex || 0) - Number(rightRow.dataset.sortIndex || 0);
              if (leftValue === null) return 1;
              if (rightValue === null) return -1;
              if (leftValue !== rightValue) return (leftValue - rightValue) * directionMultiplier;
            } else {
              const comparison = leftValue.localeCompare(rightValue, 'es', { sensitivity: 'base', numeric: true });
              if (comparison !== 0) return comparison * directionMultiplier;
            }
            return Number(leftRow.dataset.sortIndex || 0) - Number(rightRow.dataset.sortIndex || 0);
          });

          resetButtons(key, direction);
          sortedRows.forEach((row) => grid.appendChild(row));
        });
      });
    });
  };

  const bindStatsRowDetailToggles = (root = document) => {
    root.querySelectorAll?.('[data-stats-row-detail-trigger]:not([data-stats-row-detail-bound="1"])').forEach((trigger) => {
      trigger.dataset.statsRowDetailBound = '1';
      trigger.addEventListener('click', () => {
        const row = trigger.closest('[data-stats-player-row]');
        const grid = row?.closest('[data-stats-sortable-grid]');
        const sourceId = trigger.dataset.detailTarget || '';
        const source = sourceId ? document.getElementById(sourceId) : null;
        if (!row || grid == null || !source) return;

        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        grid.querySelectorAll('[data-stats-row-detail-panel]').forEach((panel) => panel.remove());
        grid.querySelectorAll('[data-stats-row-detail-trigger][aria-expanded="true"]').forEach((candidate) => {
          candidate.setAttribute('aria-expanded', 'false');
          candidate.classList.remove('is-active');
        });
        if (isOpen) return;

        const panel = document.createElement('div');
        panel.className = 'stats-player-row-detail';
        panel.dataset.statsRowDetailPanel = '1';
        panel.innerHTML = source.innerHTML;
        row.after(panel);
        trigger.setAttribute('aria-expanded', 'true');
        trigger.classList.add('is-active');
      });
    });
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

  const bindEncounterActionMenus = (root = document) => {
    const syncActionMenuState = () => {
      document.body.classList.toggle('gf-encounter-action-open', !!document.querySelector('.encounter-action-menu[open]'));
    };
    root.querySelectorAll?.('.encounter-action-menu:not([data-action-menu-bound="1"])').forEach((menu) => {
      menu.dataset.actionMenuBound = '1';
      menu.querySelector('summary')?.addEventListener('click', () => {
        if (menu.open) return;
        const history = menu.closest('.encounters-history');
        history?.querySelectorAll('.encounter-action-menu[open]').forEach((current) => {
          if (current !== menu) {
            current.open = false;
          }
        });
      });
      menu.addEventListener('toggle', () => {
        if (menu.open) {
          const history = menu.closest('.encounters-history');
          history?.querySelectorAll('.encounter-action-menu[open]').forEach((current) => {
            if (current !== menu) {
              current.open = false;
            }
          });
        }
        window.setTimeout(syncActionMenuState);
      });
    });
    syncActionMenuState();
  };

  const bindProfileSummaryFilters = (root = document) => {
    root.querySelectorAll?.('[data-profile-result-filters]:not([data-profile-result-bound="1"])').forEach((filterGroup) => {
      filterGroup.dataset.profileResultBound = '1';
      const panel = filterGroup.closest('.profile-summary-panel');
      const list = panel?.querySelector('[data-profile-result-list]');
      const buttons = Array.from(filterGroup.querySelectorAll('[data-profile-result-filter]'));
      const items = Array.from(list?.querySelectorAll('[data-profile-result-item]') || []);
      if (!list || !buttons.length || !items.length) return;

      const applyFilter = (activeResult) => {
        buttons.forEach((button) => {
          const active = button.dataset.profileResultFilter === activeResult;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
        items.forEach((item) => {
          const visible = !activeResult || item.dataset.profileResultItem === activeResult;
          item.hidden = !visible;
        });
      };

      buttons.forEach((button) => {
        button.addEventListener('click', () => {
          const next = button.getAttribute('aria-pressed') === 'true'
            ? ''
            : (button.dataset.profileResultFilter || '');
          applyFilter(next);
        });
      });
    });
  };

  const hydrateDynamicContent = (root = document) => {
    mountReactIslands(root);
    collapseMobileDetails(root);
    refreshExistingImportPlayers(root);
    bindParticipantControls(root);
    bindEncounterHistoryControls(root);
    bindEncounterActionMenus(root);
    bindPlayerEditRows(root);
    bindPlayerEditDialogs(root);
    bindPlayerListSearch(root);
    bindSortableStatsPlayerGrids(root);
    bindStatsRowDetailToggles(root);
    bindExpandablePanelScroll(root);
    bindCompactFormationCardPreview(root);
    bindMatchDetailToggles(root);
    bindDismissibleAlerts(root);
    bindMultiDrawPitchToggles(root);
    bindProfileSummaryFilters(root);
    bindRentalCourtSelect(root);
    bindTeamCountControls(root);
    bindRoundRobinControls(root);
    initFinishPlayerSwap(root);
    initManualTeams();
    const statsSearch = root.querySelector?.('[data-stats-player-search]');
    if (statsSearch) updateStatsPlayerSearch(statsSearch);
  };
  window.goodfellasHydrateDynamicContent = hydrateDynamicContent;

  const partialNavigate = async (url, { replace = false, source = null, scroll = true } = {}) => {
    const content = getMainContent();
    if (!content) {
      window.location.href = url;
      return;
    }
    const previousScroll = {
      left: window.scrollX,
      top: window.scrollY,
    };
    const restoreScrollPosition = () => {
      window.scrollTo({
        left: previousScroll.left,
        top: previousScroll.top,
        behavior: 'auto',
      });
    };

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
      document.dispatchEvent(new CustomEvent('goodfellas:before-partial-render'));
      updatePageChrome(nextDocument);
      content.replaceChildren(...Array.from(nextContent.childNodes));
      runPageScripts(content);
      hydrateDynamicContent(content);
      const nextUrl = response.url || url;
      if (replace) {
        window.history.replaceState({ partial: true }, '', nextUrl);
      } else {
        window.history.pushState({ partial: true }, '', nextUrl);
      }
      if (scroll) {
        scrollToUrlTarget(nextUrl);
      } else {
        restoreScrollPosition();
        window.requestAnimationFrame(() => {
          restoreScrollPosition();
          window.requestAnimationFrame(restoreScrollPosition);
        });
        [40, 120, 240, 480].forEach((delay) => {
          window.setTimeout(restoreScrollPosition, delay);
        });
      }
    } catch (error) {
      showToast('No se pudo actualizar sin recargar. Abriendo la página completa.', 'error');
      window.location.href = url;
    } finally {
      setBusy(content, false);
      if (source) source.classList.remove('is-loading');
    }
  };
  window.goodfellasPartialNavigate = partialNavigate;

  const replaceMainContentFromDocument = (nextDocument) => {
    const content = getMainContent();
    const nextContent = nextDocument.querySelector('main.content');
    if (!content || !nextContent) throw new Error('Missing partial content');

    document.title = nextDocument.title || document.title;
    document.dispatchEvent(new CustomEvent('goodfellas:before-partial-render'));
    updatePageChrome(nextDocument);
    content.replaceChildren(...Array.from(nextContent.childNodes));
    runPageScripts(content);
    hydrateDynamicContent(content);
    return content;
  };

  const importFormSelector = '#importPlayersForm, #clearImportPlayersForm, form[id^="createImportPlayerForm"], form[id^="useExistingImportPlayerForm"]';
  const escapeSelector = (value) => (
    window.CSS && typeof window.CSS.escape === 'function'
      ? window.CSS.escape(String(value))
      : String(value).replace(/["\\]/g, '\\$&')
  );

  const partialFormSkipSelector = [
    '[data-no-partial]',
    '[data-round-robin-form]',
    'form[id^="player-row-"]',
    'form.player-edit-panel',
    importFormSelector,
  ].join(',');

  const shouldSubmitFormPartially = (form) => {
    if (!form || form.matches(partialFormSkipSelector)) return false;
    if (form.target && form.target !== '_self') return false;
    if (String(form.getAttribute('method') || 'get').toLowerCase() === 'dialog') return false;
    const enctype = String(form.getAttribute('enctype') || '').toLowerCase();
    if (enctype.includes('multipart/form-data')) return false;
    if (form.querySelector('input[type="file"]')) return false;

    const action = new URL(form.getAttribute('action') || window.location.href, window.location.href);
    if (action.origin !== window.location.origin) return false;
    if (/\/(?:backup|logout)\.php$/i.test(action.pathname)) return false;
    return true;
  };

  const getSubmitFormData = (form, submitter = null) => {
    let formData;
    try {
      formData = submitter ? new FormData(form, submitter) : new FormData(form);
    } catch (error) {
      formData = new FormData(form);
      if (submitter?.name && !formData.has(submitter.name)) {
        formData.append(submitter.name, submitter.value || '');
      }
    }
    return formData;
  };

  const submitFormPartially = async (form, submitter = null) => {
    const method = String(form.getAttribute('method') || 'get').toLowerCase();
    const action = new URL(form.getAttribute('action') || window.location.href, window.location.href);
    const formData = getSubmitFormData(form, submitter);

    if (method === 'get') {
      action.search = '';
      formData.forEach((value, key) => {
        if (String(value).trim() !== '') {
          action.searchParams.append(key, value);
        }
      });
      await partialNavigate(action.toString(), { source: form, scroll: false });
      return;
    }

    const content = getMainContent();
    const anchorId = form.closest('[id]')?.id || form.getAttribute('id') || '';
    setBusy(content, true);
    form.classList.add('is-partial-loading');
    if (submitter) {
      submitter.disabled = true;
      submitter.classList.add('is-loading');
    }

    try {
      const response = await fetch(action.toString(), {
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
      const nextUrl = response.url || action.toString();
      window.history.replaceState({ partial: true }, '', nextUrl);

      const nextAnchor = anchorId ? nextContent.querySelector(`#${escapeSelector(anchorId)}`) : null;
      if (nextAnchor) {
        nextAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      showToast('Cambios guardados', 'success');
    } catch (error) {
      showToast('No se pudo actualizar sin recargar. Reintentando con recarga.', 'error');
      form.submit();
    } finally {
      setBusy(content, false);
      form.classList.remove('is-partial-loading');
      if (submitter) {
        submitter.disabled = false;
        submitter.classList.remove('is-loading');
      }
    }
  };

  const shouldNavigatePartially = (link) => {
    if (!link || link.target || link.download || link.hasAttribute('data-no-partial')) return false;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return false;
    if (/\/(?:logout|migrar_schema)\.php$/i.test(url.pathname)) return false;
    if (/\.(?:zip|csv|xlsx?|pdf|png|jpe?g|webp|gif|sql)$/i.test(url.pathname)) return false;
    return true;
  };

  const submitImportFormDynamically = async (form, submitter = null) => {
    const content = getMainContent();
    if (!content) {
      form.submit();
      return;
    }

    const url = new URL(form.getAttribute('action') || window.location.href, window.location.href);
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
    const mobileMarquee = document.querySelector('[data-participant-marquee]');

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

    const toggleClassList = (element, classes, enabled) => {
      if (!element) return;
      classes.forEach((className) => element.classList.toggle(className, enabled));
    };
    const selectedRowClasses = ['border-lime-200/70', 'bg-emerald-800/90', 'ring-2', 'ring-lime-200/25'];
    const addedButtonClasses = ['bg-emerald-600', 'text-white', 'hover:bg-emerald-700'];
    const defaultButtonClasses = ['bg-lime-100', 'text-[#07130f]', 'hover:bg-lime-200'];
    const disabledRemoveClasses = ['opacity-40', 'cursor-not-allowed'];
    const readyMobileClasses = ['bg-lime-100', 'text-[#07130f]', 'hover:bg-lime-200'];
    const idleMobileClasses = ['bg-lime-100/15', 'text-emerald-100/70'];

    checkboxes.forEach((el) => {
      const row = el.closest('[data-player-row]');
      const toggle = row?.querySelector('[data-participant-toggle]');
      const remove = row?.querySelector('[data-remove-player-row]');
      toggleClassList(row, selectedRowClasses, el.checked);
      toggleClassList(toggle, addedButtonClasses, el.checked);
      toggleClassList(toggle, defaultButtonClasses, !el.checked);
      if (toggle) {
        toggle.textContent = el.checked ? 'Convocado' : 'Agregar';
        toggle.disabled = !el.checked && el.disabled;
      }
      if (remove) {
        remove.disabled = el.checked;
        toggleClassList(remove, disabledRemoveClasses, el.checked);
      }
    });

    counters.forEach((counter) => {
      counter.textContent = String(checked.length);
    });
    if (target === 'participants' && mobileSubmit) {
      const isComplete = checked.length === limit;
      mobileSubmit.disabled = !isComplete;
      toggleClassList(mobileSubmit, readyMobileClasses, isComplete);
      toggleClassList(mobileSubmit, idleMobileClasses, !isComplete);
    }
    if (target === 'participants' && mobileMarquee) {
      mobileMarquee.hidden = checked.length === 0;
      if (checked.length === 0) {
        mobileMarquee.open = false;
      }
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
      <div class="flex items-center justify-between gap-2 rounded-xl border border-lime-200/55 bg-emerald-800/90 p-2 text-lime-50 shadow-sm shadow-emerald-950/20">
        <span class="min-w-0">
          <strong class="block truncate text-sm font-black text-lime-50">${index + 1}. ${escapeHtml(el.dataset.playerName || '')}</strong>
          <small class="block truncate text-xs font-semibold text-emerald-100/82">${escapeHtml(el.dataset.playerMeta || '')}</small>
        </span>
        <button class="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg border border-red-300/45 bg-red-950/85 px-2.5 py-2 text-sm font-black text-red-100 transition hover:bg-red-900 hover:text-white" type="button" data-remove-participant="${escapeHtml(el.value)}" aria-label="Quitar ${escapeHtml(el.dataset.playerName || 'jugador')}">
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
        class="inline-flex min-h-10 items-center justify-center rounded-xl border border-lime-200/35 bg-emerald-950 px-3.5 py-2.5 text-sm font-extrabold text-lime-50 transition hover:border-lime-200/65 hover:bg-lime-100/12 hover:text-lime-100"
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
        button.closest('span')?.remove();
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

  document.addEventListener('goodfellas:participants-changed', () => {
    updateSelectionCount('participants');
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

  bindParticipantControls(document);
  bindEncounterHistoryControls(document);
  bindEncounterActionMenus(document);

  const filterPlayerTableRows = (root = document) => {
    const search = root.querySelector?.('[data-player-list-search]') || document.querySelector('[data-player-list-search]');
    const scope = search?.closest('main.content') || document;
    const rows = Array.from(scope.querySelectorAll('[data-player-table-row]'));
    if (!search || !rows.length) return;

    const query = search.value.trim().toLowerCase();
    rows.forEach((row) => {
      const haystack = row.getAttribute('data-search') || '';
      row.classList.toggle('hidden', !(query === '' || haystack.includes(query)));
    });
  };

  const bindPlayerListSearch = (root = document) => {
    const playerListSearch = root.querySelector?.('[data-player-list-search]') || document.querySelector('[data-player-list-search]');
    if (!playerListSearch || playerListSearch.dataset.playerListSearchBound === '1') return;
    playerListSearch.dataset.playerListSearchBound = '1';
    playerListSearch.addEventListener('input', () => filterPlayerTableRows(root));
    filterPlayerTableRows(root);
  };

  const playerStatFields = ['technique', 'rhythm', 'stamina', 'defense_physical', 'attack', 'teamwork', 'mentality', 'regularity', 'goalkeeper_skill'];
  const formatPlayerRating = (rating) => Number.isInteger(rating) ? String(rating) : Number(rating || 0).toFixed(1);
  const playerRatingStars = (rating) => {
    const number = Number(rating || 0);
    const full = Math.floor(number);
    const half = number % 1 !== 0;
    return '\u2605'.repeat(full) + (half ? '1/2' : '') + '\u2606'.repeat(Math.max(0, 6 - full - (half ? 1 : 0)));
  };
  const parsePlayerJsonResponse = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      if (response.redirected || /login\.php|<!doctype html|<html/i.test(text)) {
        throw new Error('La sesion expiro. Volve a iniciar sesion e intenta guardar nuevamente.');
      }
      throw new Error('El servidor no devolvió una respuesta válida. Recarga la página e intenta nuevamente.');
    }
  };
  const syncPlayerStatControl = (root, value) => {
    if (!root) return;
    const rating = Math.max(1, Math.min(6, Number(value) || 1));
    const tone = rating <= 2 ? 'low' : (rating <= 3 ? 'medium' : (rating <= 4 ? 'good' : 'elite'));
    const input = root.querySelector('[data-stat-rating-input]');
    const label = root.querySelector('[data-stat-rating-value]');
    const range = root.querySelector('[data-stat-rating-range]');
    const bar = root.querySelector('[data-stat-rating-bar]');
    root.setAttribute('data-stat-rating-tone', tone);
    if (input) input.value = String(rating);
    if (label) label.textContent = `${rating}/6`;
    if (range) range.value = String(rating);
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, Math.round((rating / 6) * 100)))}%`;
    root.querySelectorAll('[data-stat-value]').forEach((button) => {
      const current = Number(button.getAttribute('data-stat-value') || '0');
      const active = current <= rating;
      button.classList.toggle('is-active', active);
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

  const bindPlayerEditRows = (root = document) => {
    root.querySelectorAll?.('[data-player-edit-row]:not([data-player-edit-row-bound="1"])').forEach((row) => {
      row.dataset.playerEditRowBound = '1';
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
        row.classList.toggle('bg-amber-950/60', isDirty);
        row.classList.toggle('shadow-inner', isDirty);
        row.classList.toggle('shadow-amber-200/30', isDirty);
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
  };

  const submitPlayerRowForm = async (form, explicitSaveButton = null) => {
    const playerRowFormId = form.getAttribute('id') || '';
    const row = document.querySelector(`[data-player-edit-row] [form="${playerRowFormId}"]`)?.closest('[data-player-edit-row]');
    const saveButton = explicitSaveButton || document.querySelector(`[data-player-row-save][form="${playerRowFormId}"]`);
    if (!row || !saveButton || saveButton.disabled) return;

    const rowTopBeforeSave = row.getBoundingClientRect().top;
    const restoreTarget = row.playerRestoreTarget instanceof HTMLElement
      ? row.playerRestoreTarget
      : (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    const formData = new FormData(form);
    formData.set('ajax', '1');
    const ajaxToken = window.playerAjaxToken || document.querySelector('[data-player-ajax-token]')?.dataset.playerAjaxToken || '';
    if (!formData.get('ajax_token') && ajaxToken) {
      formData.set('ajax_token', ajaxToken);
    }
    saveButton.disabled = true;
    saveButton.classList.add('is-loading');
    row.classList.add('is-saving');
    row.classList.add('bg-lime-100/10');
    row.classList.remove('is-saved');
    row.classList.remove('bg-lime-100/20');

    try {
      const response = await fetch(form.getAttribute('action') || window.location.href, {
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
      row.classList.add('bg-lime-100/20');
      showToast(payload.message || 'Jugador actualizado.', 'success');
      window.setTimeout(() => {
        row.classList.remove('is-saved');
        row.classList.remove('bg-lime-100/20');
      }, 1200);
    } catch (error) {
      showToast(error.message || 'No se pudo guardar el jugador.', 'error');
    } finally {
      row.classList.remove('is-saving');
      row.classList.remove('bg-lime-100/10');
      saveButton.disabled = false;
      saveButton.classList.remove('is-loading');
    }
  };

  document.addEventListener('click', (event) => {
    const saveButton = event.target.closest('[data-player-row-save]');
    if (!saveButton) return;

    const formId = saveButton.getAttribute('form');
    const form = formId ? document.getElementById(formId) : saveButton.closest('form');
    if (!form || !form.matches('form[id^="player-row-"]')) return;

    event.preventDefault();
    submitPlayerRowForm(form, saveButton);
  });

  document.addEventListener('submit', async (event) => {
    const form = event.target.closest('form[id^="player-row-"]');
    if (!form) return;

    event.preventDefault();
    submitPlayerRowForm(form);
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
    const ajaxToken = window.playerAjaxToken || document.querySelector('[data-player-ajax-token]')?.dataset.playerAjaxToken || '';
    if (!formData.get('ajax_token') && ajaxToken) {
      formData.set('ajax_token', ajaxToken);
    }
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.originalText = submitButton.textContent || '';
      submitButton.textContent = 'Guardando...';
    }

    try {
      const response = await fetch(form.getAttribute('action') || window.location.href, {
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

  let playerDialogHistoryToken = 0;
  let activePlayerDialog = null;
  let closingPlayerDialogFromHistory = false;

  const closePlayerEditDialog = (dialog, { fromHistory = false } = {}) => {
    if (!dialog) return;
    if (fromHistory) closingPlayerDialogFromHistory = true;
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    if (fromHistory) {
      closingPlayerDialogFromHistory = false;
      if (activePlayerDialog === dialog) activePlayerDialog = null;
    }
  };

  const syncPlayerDialogHistoryOnClose = (dialog) => {
    if (closingPlayerDialogFromHistory || activePlayerDialog !== dialog) return;
    activePlayerDialog = null;
    if (window.history.state?.goodfellasPlayerDialog) {
      window.history.back();
    }
  };

  const openPlayerEditDialog = (dialog) => {
    if (!dialog) return;
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    if (activePlayerDialog !== dialog) {
      activePlayerDialog = dialog;
      playerDialogHistoryToken += 1;
      window.history.pushState({
        ...(window.history.state || {}),
        goodfellasPlayerDialog: true,
        goodfellasPlayerDialogToken: playerDialogHistoryToken,
      }, '', window.location.href);
    }
  };

  window.addEventListener('popstate', () => {
    if (!activePlayerDialog?.open) {
      activePlayerDialog = null;
      return;
    }
    closePlayerEditDialog(activePlayerDialog, { fromHistory: true });
  });

  const bindPlayerEditDialogs = (root = document) => {
    root.querySelectorAll?.('[data-player-edit-open]:not([data-player-edit-open-bound="1"])').forEach((button) => {
      button.dataset.playerEditOpenBound = '1';
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-player-edit-open');
        const escapedId = id && window.CSS && typeof window.CSS.escape === 'function'
          ? window.CSS.escape(id)
          : String(id || '').replace(/"/g, '\\"');
        const dialog = id ? document.querySelector(`[data-player-edit-dialog="${escapedId}"]`) : null;
        if (!dialog) return;
        openPlayerEditDialog(dialog);
      });
    });

    root.querySelectorAll?.('.mobile-player-list-item[data-player-table-row]:not([data-player-row-open-bound="1"])').forEach((row) => {
      row.dataset.playerRowOpenBound = '1';
      row.addEventListener('click', (event) => {
        if (event.target.closest('button, a, input, select, textarea, form, label')) {
          return;
        }
        const openButton = row.querySelector('[data-player-edit-open]');
        openButton?.click();
      });
    });

    root.querySelectorAll?.('[data-player-edit-dialog]:not([data-player-edit-dialog-bound="1"])').forEach((dialog) => {
      dialog.dataset.playerEditDialogBound = '1';
      dialog.querySelectorAll('[data-player-edit-close]').forEach((button) => {
        button.addEventListener('click', () => {
          closePlayerEditDialog(dialog);
        });
      });
      dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
          closePlayerEditDialog(dialog);
        }
      });
      dialog.addEventListener('close', () => syncPlayerDialogHistoryOnClose(dialog));
    });
  };

  document.addEventListener('click', async (event) => {
    const statButton = event.target.closest('[data-stat-value]');
    if (statButton) {
      const root = statButton.closest('[data-stat-rating]');
      if (!root || root.hasAttribute('data-stat-rating-readonly')) return;
      event.preventDefault();
      syncPlayerStatControl(root, statButton.getAttribute('data-stat-value'));
      root.querySelector('[data-stat-rating-input]')?.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }

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
      button.classList.toggle('bg-lime-100', active);
      button.classList.toggle('text-[#07130f]', active);
      button.classList.toggle('bg-emerald-900', !active);
      button.classList.toggle('text-emerald-100/70', !active);
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
      const response = await fetch(form.getAttribute('action') || window.location.href, {
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
    const ratingRange = event.target.closest('[data-stat-rating-range]');
    if (ratingRange) {
      syncPlayerStatControl(ratingRange.closest('[data-stat-rating]'), ratingRange.value);
      return;
    }

    const input = event.target.closest('[data-stats-player-search]');
    if (input) updateStatsPlayerSearch(input);
  });

  document.addEventListener('change', (event) => {
    const input = event.target.closest('[data-stats-player-search]');
    if (input) updateStatsPlayerSearch(input);
  });
  updateStatsPlayerSearch();

  const bindMatchDetailToggles = (root = document) => {
    const scope = root instanceof Document ? root : (root?.closest?.('main.content') || root || document);
    const matchDetailPanel = scope.querySelector?.('[data-match-detail-panel]');
    const matchDetailToggles = Array.from(scope.querySelectorAll?.('[data-match-detail-toggle]') || []);
    if (!matchDetailPanel || !matchDetailToggles.length || matchDetailPanel.dataset.matchDetailBound === '1') return;
    matchDetailPanel.dataset.matchDetailBound = '1';
    const updateMatchDetailLabels = (collapsed) => {
      scope.querySelectorAll('[data-match-detail-label]').forEach((label) => {
        const symbol = label.querySelector('[data-match-detail-symbol]');
        const isActiveItem = label.closest('.match-list-item.active') !== null;
        const value = !collapsed && isActiveItem ? '-' : '+';
        if (symbol) {
          symbol.textContent = value;
          symbol.dataset.matchDetailIcon = value === '-' ? 'collapse' : 'expand';
          return;
        }
        label.textContent = `${value} Detalles`;
      });
      scope.querySelectorAll('[data-match-detail-toggle]').forEach((toggle) => {
        const symbol = toggle.querySelector('[data-match-detail-symbol]');
        if (symbol) {
          symbol.textContent = collapsed ? '+' : '-';
          symbol.dataset.matchDetailIcon = collapsed ? 'expand' : 'collapse';
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
      if (!collapsed) {
        scrollExpandedPanelIntoView(matchDetailPanel);
      }
    }));
  };

  const bindDismissibleAlerts = (root = document) => {
    root.querySelectorAll?.('[data-dismissible-alert]:not([data-dismissible-alert-bound="1"])').forEach((alert) => {
      alert.dataset.dismissibleAlertBound = '1';
      alert.querySelector('[data-dismissible-alert-close]')?.addEventListener('click', () => {
        alert.hidden = true;
      });
    });
  };

  const bindMultiDrawPitchToggles = (root = document) => {
    const setMultiDrawPitchState = (option, showPitch) => {
      const listView = option?.querySelector('[data-multi-draw-list-view]');
      const pitchView = option?.querySelector('[data-multi-draw-pitch-view]');
      const label = option?.querySelector('[data-multi-draw-pitch-label]');
      if (!option || !listView || !pitchView) return;
      pitchView.hidden = !showPitch;
      listView.hidden = showPitch;
      option.classList.toggle('lg:col-span-full', showPitch);
      if (label) {
        label.textContent = showPitch ? 'Ver lista' : 'Ver en cancha';
      }
      if (showPitch) {
        scrollExpandedPanelIntoView(option);
      }
    };

    root.querySelectorAll?.('[data-multi-draw-pitch-toggle]:not([data-multi-draw-pitch-bound="1"])').forEach((trigger) => {
      trigger.dataset.multiDrawPitchBound = '1';
      trigger.addEventListener('click', () => {
        const option = trigger.closest('.multi-draw-option');
        const pitchView = option?.querySelector('[data-multi-draw-pitch-view]');
        if (!option || !pitchView) return;
        setMultiDrawPitchState(option, pitchView.hidden);
      });
    });

    root.querySelectorAll?.('[data-multi-draw-pitch-close]:not([data-multi-draw-pitch-close-bound="1"])').forEach((trigger) => {
      trigger.dataset.multiDrawPitchCloseBound = '1';
      trigger.addEventListener('click', () => {
        const option = trigger.closest('.multi-draw-option');
        if (!option) return;
        setMultiDrawPitchState(option, false);
      });
    });
  };

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

  const bindTeamCountControls = (root = document) => {
    root.querySelectorAll?.('[data-num-teams], [data-players-per-team]').forEach((input) => {
      if (input.dataset.teamCountBound === '1') return;
      input.dataset.teamCountBound = '1';
      input.addEventListener('input', () => {
        updateImportPlayerLimit();
        updateSelectionCount('participants');
      });
      input.addEventListener('change', () => {
        updateImportPlayerLimit();
        updateSelectionCount('participants');
      });
    });
  };

  const bindRentalCourtSelect = (root = document) => {
    const script = root.querySelector?.('[data-rental-court-options]') || document.querySelector('[data-rental-court-options]');
    const select = root.querySelector?.('[data-rental-court-select]') || document.querySelector('[data-rental-court-select]');
    if (!script || !select || select.dataset.rentalCourtBound === '1') return;
    let options = [];
    try {
      options = JSON.parse(script.textContent || '[]');
    } catch {
      options = [];
    }
    const highlightInput = (input, enabled) => {
      if (!input) return;
      input.classList.toggle('border-lime-200', enabled);
      input.classList.toggle('bg-lime-100', enabled);
      input.classList.toggle('text-[#07130f]', enabled);
      input.classList.toggle('ring-4', enabled);
      input.classList.toggle('ring-lime-200/30', enabled);
      input.classList.toggle('shadow-lg', enabled);
      input.classList.toggle('shadow-lime-200/15', enabled);
      input.classList.toggle('border-lime-200/40', !enabled);
      input.classList.toggle('bg-emerald-950/92', !enabled);
      input.classList.toggle('text-lime-50', !enabled);
    };
    const toggleBadge = (badge, enabled) => {
      if (!badge) return;
      badge.hidden = !enabled;
      badge.classList.toggle('hidden', !enabled);
    };
    const applySelectedCourt = () => {
      const selected = options.find((option) => String(option.id) === String(select.value));
      const preview = select.form?.querySelector('[data-rental-court-next-preview]');
      const dateInput = select.form?.querySelector('[data-rental-court-date-input]');
      const dateChanged = select.form?.querySelector('[data-rental-court-date-changed]');
      const autoInputs = Array.from(select.form?.querySelectorAll('[data-rental-court-field-input]') || []);
      const autoBadges = Array.from(select.form?.querySelectorAll('[data-rental-court-field-changed]') || []);
      if (!selected) {
        if (preview) {
          preview.hidden = true;
          preview.textContent = '';
          preview.classList.add('hidden');
        }
        highlightInput(dateInput, false);
        toggleBadge(dateChanged, false);
        autoInputs.forEach((input) => highlightInput(input, false));
        autoBadges.forEach((badge) => toggleBadge(badge, false));
        return;
      }
      const teamsInput = select.form?.querySelector('[data-num-teams]');
      const playersInput = select.form?.querySelector('[data-players-per-team]');
      if (dateInput) dateInput.value = selected.date || dateInput.value;
      if (teamsInput) teamsInput.value = String(selected.numTeams || 2);
      if (playersInput) playersInput.value = String(selected.playersPerTeam || 9);
      highlightInput(dateInput, true);
      toggleBadge(dateChanged, true);
      autoInputs.forEach((input) => highlightInput(input, true));
      autoBadges.forEach((badge) => toggleBadge(badge, true));
      if (preview) {
        preview.hidden = false;
        preview.classList.remove('hidden');
        preview.textContent = `Próxima fecha calculada: ${selected.dateLabel || selected.date} | ${selected.numTeams || 2} equipos | ${selected.playersPerTeam || 9} jugadores por equipo`;
      }
      updateImportPlayerLimit();
      updateSelectionCount('participants');
    };
    select.dataset.rentalCourtBound = '1';
    select.addEventListener('change', applySelectedCourt);
    if (String(select.value) !== '0') {
      applySelectedCourt();
    }
  };

  const updateRoundRobinLegRows = (form) => {
    if (!form) return;
    const toggle = form.querySelector('[data-round-robin-legs-toggle]');
    const showSecondLeg = !toggle || toggle.checked;
    form.querySelectorAll('[data-round-robin-row][data-round-robin-leg="2"]').forEach((row) => {
      row.hidden = !showSecondLeg;
    });
  };

  const bindRoundRobinControls = (root = document) => {
    root.querySelectorAll?.('[data-round-robin-form]').forEach(updateRoundRobinLegRows);
  };

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
      ? `El servidor devolvió HTML en lugar de JSON: ${detail}`
      : 'El servidor devolvió una página HTML en lugar de JSON. Revisa el login o un error PHP del servidor.';
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
      const urlMatch = new URL(form.getAttribute('action') || window.location.href, window.location.href).searchParams.get('match_id');
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
        partialNavigate(url.toString(), { replace: true, source: form });
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
    const juntaVoteForm = event.target.closest('[data-junta-vote-submit]');
    if (juntaVoteForm) {
      if (juntaVoteForm.dataset.submitting === '1') {
        event.preventDefault();
        return;
      }
      const ratingCount = juntaVoteForm.querySelectorAll('input[name^="rating["]').length;
      const awardCount = Array.from(juntaVoteForm.querySelectorAll('input[name^="awards["]'))
        .filter((input) => String(input.value || '').trim() !== '').length;
      const confirmMessage = `Esta seguro que esta es su votacion?\n\nPuntajes cargados: ${ratingCount}\nPremios elegidos: ${awardCount}`;
      if (!window.confirm(confirmMessage)) {
        event.preventDefault();
        return;
      }
      juntaVoteForm.dataset.submitting = '1';
      const message = document.createElement('p');
      message.className = 'flash flash-success junta-vote-pending-message';
      message.setAttribute('role', 'status');
      message.setAttribute('tabindex', '-1');
      message.textContent = 'gracias por votar, retornando al sitio...';
      juntaVoteForm.before(message);
      message.focus?.({ preventScroll: false });
      const submitter = event.submitter || juntaVoteForm.querySelector('[type="submit"]');
      if (submitter) {
        submitter.disabled = true;
        submitter.textContent = 'Enviando...';
      }
    }

    const roundRobinForm = event.target.closest('[data-round-robin-form]');
    const roundRobinSubmitter = event.submitter || lastRoundRobinSubmitter;
    if (roundRobinForm && ['save_round_robin_scores', 'calculate_round_robin_winner', 'finalize_round_robin_date'].includes(roundRobinSubmitter?.value || '')) {
      event.preventDefault();
      submitRoundRobinScores(roundRobinForm, roundRobinSubmitter || null);
      lastRoundRobinSubmitter = null;
      return;
    }

    const importForm = event.target.closest(importFormSelector);
    if (importForm && String(importForm.getAttribute('method') || 'get').toLowerCase() === 'post') {
      event.preventDefault();
      submitImportFormDynamically(importForm, event.submitter || null);
      return;
    }

    const partialCandidate = event.target.closest('form');
    if (shouldSubmitFormPartially(partialCandidate)) {
      event.preventDefault();
      submitFormPartially(partialCandidate, event.submitter || null);
      return;
    }

    const postForm = event.target.closest('form');
    if (
      postForm
      && String(postForm.getAttribute('method') || 'get').toLowerCase() === 'post'
      && !postForm.hasAttribute('data-junta-vote-submit')
      && !postForm.hasAttribute('data-no-submit-lock')
      && !postForm.hasAttribute('data-no-partial')
    ) {
      if (postForm.dataset.submitting === '1') {
        event.preventDefault();
        return;
      }
      postForm.dataset.submitting = '1';
      const submitter = event.submitter || postForm.querySelector('[type="submit"]');
      if (submitter && !submitter.hasAttribute('data-keep-enabled') && !submitter.name) {
        submitter.disabled = true;
        if (!submitter.dataset.originalText) {
          submitter.dataset.originalText = submitter.textContent || '';
        }
        if (!submitter.closest('[data-junta-vote-submit]')) {
          submitter.textContent = 'Procesando...';
        }
      }
    }

    const form = event.target.closest('form[data-partial-form]');
    if (!form || String(form.getAttribute('method') || 'get').toLowerCase() !== 'get') return;

    event.preventDefault();
    const url = new URL(form.getAttribute('action') || window.location.href, window.location.href);
    const formData = new FormData(form);
    url.search = '';
    formData.forEach((value, key) => {
      if (String(value).trim() !== '') {
        url.searchParams.append(key, value);
      }
    });
    partialNavigate(url.toString(), {
      source: form,
      scroll: form.dataset.partialScroll !== 'none',
    });
  });

  document.addEventListener('change', (event) => {
    const control = event.target.closest('[data-auto-submit]');
    const form = control?.form;
    if (!control || !form) return;

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.submit();
    }
  });

  document.addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-copy-token]');
    if (!copyButton) return;
    const token = String(copyButton.getAttribute('data-copy-token') || '').trim();
    if (!token) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(token);
      } else {
        const input = document.createElement('textarea');
        input.value = token;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.left = '-9999px';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      const original = copyButton.textContent;
      copyButton.textContent = 'Copiado';
      showToast('Token copiado.', 'success');
      window.setTimeout(() => { copyButton.textContent = original || 'Copiar'; }, 1400);
    } catch (error) {
      showToast('No se pudo copiar el token.', 'error');
    }
  });

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-password-toggle]');
    if (!toggle) return;
    const targetId = toggle.getAttribute('data-password-toggle');
    const input = targetId ? document.getElementById(targetId) : toggle.closest('.password-field')?.querySelector('input');
    if (!(input instanceof HTMLInputElement)) return;
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    toggle.setAttribute('aria-pressed', showing ? 'false' : 'true');
    toggle.setAttribute('aria-label', showing ? 'Mostrar clave' : 'Ocultar clave');
    toggle.innerHTML = showing
      ? '<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>'
      : '<svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.7 5.2A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.1 2.9"/><path d="M6.1 6.4C3.8 8 2.5 12 2.5 12s3.5 7 9.5 7a9.6 9.6 0 0 0 4.5-1.1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></svg>';
  });

  document.addEventListener('click', (event) => {
    const confirmed = event.target.closest('[data-confirm]');
    if (confirmed) {
      const message = confirmed.getAttribute('data-confirm') || 'Confirmar accion?';
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    const link = event.target.closest('a[href]');
    if (!link || link.target || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    if (!shouldNavigatePartially(link)) return;
    const url = new URL(link.href, window.location.href);
    event.preventDefault();
    partialNavigate(url.toString(), {
      source: link,
      scroll: link.dataset.partialScroll !== 'none',
    });
  });

  window.addEventListener('popstate', () => {
    partialNavigate(window.location.href, { replace: true });
  });

  const initManualTeams = () => {
    const root = document.querySelector('[data-manual-teams]');
    const configScript = root?.querySelector('[data-manual-teams-config]');
    const config = configScript
      ? JSON.parse(configScript.textContent || '{}')
      : window.manualTeamsConfig;
    if (!root || !config || root.dataset.ready === '1') return;
    root.dataset.ready = '1';

    const board = root.querySelector('[data-manual-board]');
    const status = root.querySelector('[data-manual-status]');
    const colorToolbar = root.querySelector('[data-manual-color-toolbar]');
    const searchInput = root.querySelector('[data-manual-player-search]');
    const mobilePanel = root.querySelector('[data-manual-mobile-panel]');
    const formationNote = root.querySelector('[data-manual-formation-note]');
    const characteristicsPanel = root.querySelector('[data-manual-team-characteristics]');
    const analysisPanel = root.querySelector('[data-manual-analysis]');
    const analyzeButton = root.querySelector('[data-manual-analyze]');
    const saveButton = root.querySelector('[data-manual-save]');
    const players = Array.isArray(config.players) ? config.players : [];
    const numTeams = Number(config.numTeams || 2);
    const playersPerTeam = Number(config.playersPerTeam || 1);
    const maxDiff = Math.max(0.1, Number(config.maxDiff || 1));
    const positions = ['ARQ', 'DEF', 'LAT', 'MED', 'DEL'];
    const requiredPitchLines = ['ARQ', 'DEF', 'MED', 'DEL'];
    const fieldStatWeights = {
      DEF: { defense_physical: 0.26, stamina: 0.18, rhythm: 0.16, technique: 0.16, teamwork: 0.12, mentality: 0.12, attack: 0.06 },
      LAT: { rhythm: 0.22, defense_physical: 0.20, stamina: 0.18, technique: 0.16, teamwork: 0.14, attack: 0.07, mentality: 0.03 },
      MED: { technique: 0.22, rhythm: 0.18, teamwork: 0.18, stamina: 0.15, mentality: 0.12, defense_physical: 0.09, attack: 0.06 },
      DEL: { attack: 0.30, rhythm: 0.20, technique: 0.16, teamwork: 0.12, stamina: 0.10, mentality: 0.08, defense_physical: 0.04 },
    };
    const goalkeeperStatWeights = { goalkeeper_skill: 0.38, defense_physical: 0.12, rhythm: 0.08, stamina: 0.08, technique: 0.10, teamwork: 0.14, mentality: 0.10 };
    const drawBalanceWeights = {
      general: 50,
      attack: 15,
      defense_physical: 15,
      rhythm: 16,
      stamina: 16,
      technique: 5,
      teamwork: 8,
      mentality: 10,
      regularity: 5,
      goalkeeper_skill: 25,
    };
    const analysisStatLabels = {
      attack: 'ataque',
      defense_physical: 'solidez defensiva',
      rhythm: 'velocidad',
      stamina: 'resistencia',
      technique: 'tecnica',
      teamwork: 'juego en equipo',
      mentality: 'mentalidad',
      regularity: 'regularidad',
      goalkeeper_skill: 'arquero',
    };
    const teamColors = [
      { name: 'ROSA', className: 'manual-team-rosa' },
      { name: 'AZUL', className: 'manual-team-azul' },
      { name: 'NARANJA', className: 'manual-team-naranja' },
      { name: 'NEGRO', className: 'manual-team-negro' },
      { name: 'VERDE', className: 'manual-team-verde' },
      { name: 'CAMISADO', className: 'manual-team-camisado' },
      { name: 'DESCAMISADO', className: 'manual-team-descamisado' },
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
    const teamColorIsTaken = (colorName, ownIndex) => selectedTeamColors.some((selected, index) => (
      index !== ownIndex && String(selected).toUpperCase() === String(colorName).toUpperCase()
    ));
    const teamColorsAreUnique = () => selectedTeamColors.every((colorName, index) => (
      String(colorName || '').trim() !== '' && !teamColorIsTaken(colorName, index)
    ));
    const setTeamColor = (teamIndex, colorName) => {
      const fallback = teamColors[teamIndex % teamColors.length].name;
      const normalized = String(colorName || fallback).toUpperCase();
      if (teamColorIsTaken(normalized, teamIndex)) {
        showToast('Cada equipo necesita un color de camiseta distinto.', 'error');
        render();
        return false;
      }
      selectedTeamColors[teamIndex] = normalized;
      render();
      return true;
    };
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
    let analysisVisible = false;

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
      if (field === 'stamina') return statValue(player, 'rhythm');
      return field === 'regularity' ? 3.5 : (field === 'mentality' ? 3.0 : Number(player.skill || 0));
    };

    const lowRhythm = (player) => statValue(player, 'rhythm') <= 3;

    const teamPlayers = (teamNumber) => players.filter((player) => String(assignments.get(String(player.id))?.team || '') === String(teamNumber));

    const parsePlayerPositions = (player) => String(player.positions || '')
      .split('/')
      .map((position) => position.trim().toUpperCase())
      .filter((position, index, list) => positions.includes(position) && list.indexOf(position) === index)
      .slice(0, 2);

    const playerPositionIndex = (player, position) => parsePlayerPositions(player).indexOf(position);
    const playerHasPosition = (player, position) => playerPositionIndex(player, position) !== -1;
    const playerPrimaryPosition = (player) => parsePlayerPositions(player)[0] || 'MED';
    const pitchLine = (position) => (position === 'LAT' ? 'DEF' : position);
    const playerPositionFitFactor = (player, position) => {
      const index = playerPositionIndex(player, position);
      if (index === 0) return 1;
      if (index === 1) return 0.95;
      const naturalLines = parsePlayerPositions(player).map(pitchLine);
      return naturalLines.includes(pitchLine(position)) ? 0.90 : 0.90;
    };
    const mainLineLimit = () => Math.max(0, Math.floor(playersPerTeam / 3));
    const defenseSideLimit = () => Math.max(0, Math.floor(playersPerTeam / 4));
    const lineLimit = (position) => {
      if (position === 'ARQ') return 1;
      if (position === 'DEF' || position === 'LAT') return defenseSideLimit();
      return mainLineLimit();
    };

    const regularityAdjusted = (rating, player) => Math.max(1, Math.min(6, rating * (1 + ((statValue(player, 'regularity') - 3.5) / 50))));
    const positionRating = (player, position) => {
      const weights = position === 'ARQ' ? goalkeeperStatWeights : (fieldStatWeights[position] || fieldStatWeights.MED);
      const total = Object.entries(weights).reduce((sum, [field, weight]) => sum + (statValue(player, field) * weight), 0);
      return Math.round(regularityAdjusted(total, player) * playerPositionFitFactor(player, position) * 10) / 10;
    };
    const bestNaturalPosition = (player) => parsePlayerPositions(player)
      .sort((left, right) => {
        const ratingDiff = positionRating(player, right) - positionRating(player, left);
        if (ratingDiff !== 0) return ratingDiff;
        return positions.indexOf(left) - positions.indexOf(right);
      })[0] || 'MED';
    const bestNaturalRating = (player) => positionRating(player, bestNaturalPosition(player));
    const assignedPositionFor = (player) => {
      const assignment = assignments.get(String(player.id)) || {};
      return positions.includes(assignment.position) ? assignment.position : bestNaturalPosition(player);
    };
    const assignedRating = (player) => positionRating(player, assignedPositionFor(player));

    const teamSnapshots = () => Array.from({ length: numTeams }, (_, index) => ({
      teamNumber: index + 1,
      color: teamColorByName(selectedTeamColors[index]),
      players: teamPlayers(index + 1),
    }));

    const sum = (values) => values.reduce((total, value) => total + value, 0);
    const spread = (values) => values.length ? Math.max(...values) - Math.min(...values) : 0;
    const minItem = (items, valueGetter) => items.reduce((best, item) => (best === null || valueGetter(item) < valueGetter(best) ? item : best), null);
    const maxItem = (items, valueGetter) => items.reduce((best, item) => (best === null || valueGetter(item) > valueGetter(best) ? item : best), null);

    const bandIds = () => {
      if (players.length < 4) return { low: new Set(), high: new Set() };
      const sorted = [...players].sort((left, right) => {
        const diff = bestNaturalRating(left) - bestNaturalRating(right);
        return diff !== 0 ? diff : String(left.name || '').localeCompare(String(right.name || ''));
      });
      const bandSize = Math.max(1, Math.floor(players.length * 0.25));
      return {
        low: new Set(sorted.slice(0, bandSize).map((player) => String(player.id))),
        high: new Set(sorted.slice(-bandSize).map((player) => String(player.id))),
      };
    };

    const lowLiability = (player) => {
      const rating = bestNaturalRating(player);
      return Math.max(0, 2.5 - rating) * 2 + (rating < 2 ? (2 - rating) * 3 : 0);
    };

    const weakestPairScore = (team, count = 2) => {
      const ratings = team.map(bestNaturalRating).sort((left, right) => left - right);
      return sum(ratings.slice(0, Math.max(1, Math.min(count, ratings.length))));
    };

    const analyzeTeam = (snapshot, bands) => {
      const statFields = Object.keys(analysisStatLabels);
      const lineCounts = Object.fromEntries(positions.map((position) => [position, 0]));
      const statTotals = Object.fromEntries(statFields.map((field) => [field, 0]));
      const outOfPosition = [];
      snapshot.players.forEach((player) => {
        const assigned = assignedPositionFor(player);
        lineCounts[assigned] = (lineCounts[assigned] || 0) + 1;
        statFields.forEach((field) => {
          if (field === 'goalkeeper_skill' && !playerHasPosition(player, 'ARQ') && assigned !== 'ARQ') return;
          statTotals[field] += statValue(player, field);
        });
        if (!playerHasPosition(player, assigned)) {
          outOfPosition.push(player);
        }
      });
      const pitchCounts = {
        ARQ: lineCounts.ARQ || 0,
        DEF: (lineCounts.DEF || 0) + (lineCounts.LAT || 0),
        MED: lineCounts.MED || 0,
        DEL: lineCounts.DEL || 0,
      };
      return {
        ...snapshot,
        total: sum(snapshot.players.map(assignedRating)),
        slow: snapshot.players.filter(lowRhythm).length,
        fast: snapshot.players.filter((player) => !lowRhythm(player)).length,
        statTotals,
        lineCounts,
        pitchCounts,
        missingLines: requiredPitchLines.filter((line) => (pitchCounts[line] || 0) <= 0),
        overloadedLines: positions.filter((line) => (lineCounts[line] || 0) > lineLimit(line)),
        outOfPosition,
        highBand: snapshot.players.filter((player) => bands.high.has(String(player.id))).length,
        lowBand: snapshot.players.filter((player) => bands.low.has(String(player.id))).length,
        floorScore: weakestPairScore(snapshot.players, 2),
        liability: sum(snapshot.players.map(lowLiability)),
      };
    };

    const analysisCost = (summaries) => {
      const statFields = Object.keys(analysisStatLabels);
      let cost = spread(summaries.map((team) => team.total)) * drawBalanceWeights.general;
      statFields.forEach((field) => {
        cost += spread(summaries.map((team) => team.statTotals[field] || 0)) * (drawBalanceWeights[field] || 0);
      });
      cost += spread(summaries.map((team) => team.slow)) * 20;
      cost += spread(summaries.map((team) => team.lowBand)) * 120;
      cost += spread(summaries.map((team) => team.highBand)) * 90;
      cost += spread(summaries.map((team) => team.floorScore)) * 55;
      cost += spread(summaries.map((team) => team.liability)) * 85;
      summaries.forEach((team) => {
        cost += team.missingLines.length * 240;
        cost += team.overloadedLines.length * 160;
        cost += Math.abs((team.lineCounts.ARQ || 0) - 1) * 260;
        cost += team.outOfPosition.length * 20;
      });
      return cost;
    };

    const buildSummariesFromSnapshots = (snapshots) => {
      const bands = bandIds();
      return snapshots.map((snapshot) => analyzeTeam(snapshot, bands));
    };

    const teamDisplayName = (summary) => `${teamLabel(summary.teamNumber)} (${summary.color.name})`;

    const describeAnalysisIssues = (summaries) => {
      const issues = [];
      const totals = summaries.map((team) => team.total);
      const strongest = maxItem(summaries, (team) => team.total);
      const weakest = minItem(summaries, (team) => team.total);
      const totalGap = spread(totals);
      if (strongest && weakest && totalGap > maxDiff) {
        issues.push({
          severity: 'alta',
          title: `Diferencia general de ${totalGap.toFixed(1)} puntos`,
          detail: `${teamDisplayName(strongest)} queda por encima de ${teamDisplayName(weakest)}. El limite configurado para el sorteo es ${maxDiff.toFixed(1)}.`,
        });
      }

      summaries.forEach((team) => {
        if ((team.lineCounts.ARQ || 0) !== 1) {
          issues.push({
            severity: 'alta',
            title: `${teamDisplayName(team)} tiene ${(team.lineCounts.ARQ || 0)} arqueros`,
            detail: 'El sorteo valida un arquero por equipo. Ajusta la posición o mueve un jugador.',
          });
        }
        if (team.missingLines.length) {
          issues.push({
            severity: 'alta',
            title: `${teamDisplayName(team)} no cubre ${team.missingLines.join(', ')}`,
            detail: 'Cada equipo necesita arquero, defensa, medio y ataque representados.',
          });
        }
        if (team.overloadedLines.length) {
          issues.push({
            severity: 'media',
            title: `${teamDisplayName(team)} carga demasiado ${team.overloadedLines.join(', ')}`,
            detail: 'El criterio del sorteo limita acumulacion por linea para evitar equipos partidos.',
          });
        }
        if (team.outOfPosition.length) {
          issues.push({
            severity: 'media',
            title: `${teamDisplayName(team)} tiene ${team.outOfPosition.length} fuera de posicion`,
            detail: team.outOfPosition.slice(0, 3).map((player) => player.name).join(', '),
          });
        }
      });

      const slowGap = spread(summaries.map((team) => team.slow));
      if (slowGap > 1) {
        const mostSlow = maxItem(summaries, (team) => team.slow);
        const leastSlow = minItem(summaries, (team) => team.slow);
        issues.push({
          severity: 'media',
          title: `Jugadores lentos desparejos (${slowGap} de diferencia)`,
          detail: `${teamDisplayName(mostSlow)} concentra ${mostSlow.slow} lentos y ${teamDisplayName(leastSlow)} tiene ${leastSlow.slow}.`,
        });
      }

      ['attack', 'defense_physical', 'rhythm', 'stamina', 'technique', 'teamwork', 'mentality', 'regularity', 'goalkeeper_skill'].forEach((field) => {
        const values = summaries.map((team) => team.players.length ? (team.statTotals[field] || 0) / team.players.length : 0);
        const gap = spread(values);
        const threshold = field === 'goalkeeper_skill' ? 0.8 : 0.55;
        if (gap <= threshold) return;
        const strong = summaries[values.indexOf(Math.max(...values))];
        const weak = summaries[values.indexOf(Math.min(...values))];
        issues.push({
          severity: field === 'goalkeeper_skill' ? 'alta' : 'media',
          title: `Brecha de ${analysisStatLabels[field]}: ${gap.toFixed(1)}`,
          detail: `${teamDisplayName(weak)} queda corto frente a ${teamDisplayName(strong)}.`,
        });
      });

      const highGap = spread(summaries.map((team) => team.highBand));
      if (highGap > 0) {
        const highTeam = maxItem(summaries, (team) => team.highBand);
        const lowTeam = minItem(summaries, (team) => team.highBand);
        issues.push({
          severity: 'media',
          title: 'Jugadores fuertes concentrados',
          detail: `${teamDisplayName(highTeam)} tiene ${highTeam.highBand}; ${teamDisplayName(lowTeam)} tiene ${lowTeam.highBand}.`,
        });
      }

      const lowGap = spread(summaries.map((team) => team.lowBand));
      if (lowGap > 0) {
        const highLowTeam = maxItem(summaries, (team) => team.lowBand);
        const lowLowTeam = minItem(summaries, (team) => team.lowBand);
        issues.push({
          severity: 'media',
          title: 'Jugadores mas flojos concentrados',
          detail: `${teamDisplayName(highLowTeam)} tiene ${highLowTeam.lowBand}; ${teamDisplayName(lowLowTeam)} tiene ${lowLowTeam.lowBand}.`,
        });
      }

      if (spread(summaries.map((team) => team.floorScore)) > 1) {
        const weakFloor = minItem(summaries, (team) => team.floorScore);
        issues.push({
          severity: 'media',
          title: `${teamDisplayName(weakFloor)} tiene banco mas fragil`,
          detail: 'El sorteo penaliza que los dos puntajes mas bajos queden muy juntos.',
        });
      }

      return issues.slice(0, 8);
    };

    const swapRecommendations = (summaries) => {
      const baseSnapshots = teamSnapshots();
      const baseCost = analysisCost(summaries);
      const candidates = [];
      for (let left = 0; left < baseSnapshots.length - 1; left += 1) {
        for (let right = left + 1; right < baseSnapshots.length; right += 1) {
          baseSnapshots[left].players.forEach((leftPlayer, leftIndex) => {
            baseSnapshots[right].players.forEach((rightPlayer, rightIndex) => {
              const nextSnapshots = baseSnapshots.map((team) => ({ ...team, players: [...team.players] }));
              nextSnapshots[left].players[leftIndex] = rightPlayer;
              nextSnapshots[right].players[rightIndex] = leftPlayer;
              const nextSummaries = buildSummariesFromSnapshots(nextSnapshots);
              const nextCost = analysisCost(nextSummaries);
              const improvement = baseCost - nextCost;
              if (improvement <= Math.max(12, baseCost * 0.03)) return;
              candidates.push({
                leftPlayer,
                rightPlayer,
                leftTeam: summaries[left],
                rightTeam: summaries[right],
                nextSummaries,
                improvement,
                nextTotalGap: spread(nextSummaries.map((team) => team.total)),
              });
            });
          });
        }
      }
      return candidates
        .sort((a, b) => b.improvement - a.improvement)
        .slice(0, 3);
    };

    const renderManualAnalysis = () => {
      if (!analysisPanel) return;
      if (!analysisVisible || !teamsAreComplete()) {
        analysisPanel.hidden = true;
        analysisPanel.innerHTML = '';
        return;
      }
      const summaries = buildSummariesFromSnapshots(teamSnapshots());
      const issues = describeAnalysisIssues(summaries);
      const recommendations = swapRecommendations(summaries);
      analysisPanel.hidden = false;
      analysisPanel.innerHTML = `
        <div class="manual-analysis-head">
          <strong>Analisis de equipos</strong>
          <span>Diferencia general ${spread(summaries.map((team) => team.total)).toFixed(1)} / limite ${maxDiff.toFixed(1)}</span>
        </div>
        <div class="manual-analysis-grid">
          ${summaries.map((team) => `
            <article>
              <strong>${escapeHtml(teamDisplayName(team))}</strong>
              <span>General ${team.total.toFixed(1)} | ${team.fast} rapidos / ${team.slow} lentos</span>
              <span>Lineas ARQ ${team.lineCounts.ARQ || 0}, DEF ${(team.lineCounts.DEF || 0) + (team.lineCounts.LAT || 0)}, MED ${team.lineCounts.MED || 0}, DEL ${team.lineCounts.DEL || 0}</span>
            </article>
          `).join('')}
        </div>
        <div class="manual-analysis-findings">
          <strong>Puntos flojos</strong>
          ${issues.length
            ? `<ul>${issues.map((issue) => `<li><span>${escapeHtml(issue.severity)}</span><div><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.detail)}</p></div></li>`).join('')}</ul>`
            : '<p>No aparecen falencias fuertes con los criterios del sorteo.</p>'}
        </div>
        <div class="manual-analysis-findings">
          <strong>Cambios sugeridos</strong>
          ${recommendations.length
            ? `<ul>${recommendations.map((item) => `<li><span>swap</span><div><strong>${escapeHtml(item.leftPlayer.name)} (${teamLabel(item.leftTeam.teamNumber)}) por ${escapeHtml(item.rightPlayer.name)} (${teamLabel(item.rightTeam.teamNumber)})</strong><p>Baja la diferencia general proyectada a ${item.nextTotalGap.toFixed(1)} y mejora el balance global.</p></div></li>`).join('')}</ul>`
            : '<p>No hay un intercambio simple que mejore claramente el balance.</p>'}
        </div>
      `;
    };

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
        stamina: average('stamina'),
        technique: average('technique'),
        teamwork: average('teamwork'),
        mentality: average('mentality'),
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
                  <span>Velocidad ${summary.rhythm.toFixed(1)}</span>
                  <span>Resistencia ${summary.stamina.toFixed(1)}</span>
                  <span>Tecnica ${summary.technique.toFixed(1)}</span>
                  <span>Juego en equipo ${summary.teamwork.toFixed(1)}</span>
                  <span>Mentalidad ${summary.mentality.toFixed(1)}</span>
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
      const colorsOk = teamColorsAreUnique();
      const canSave = teamsAreComplete() && colorsOk;
      if (status) {
        status.className = `manual-teams-status mt-3 ${canSave ? 'is-ok' : 'is-pending'}`;
        status.textContent = canSave
          ? 'Todos los equipos estan completos. Ya podes elegir formaciones y guardar.'
          : !colorsOk
            ? 'Cada equipo debe tener un color de camiseta distinto.'
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
      if (analyzeButton) {
        analyzeButton.disabled = !canSave;
      }
      renderTeamCharacteristics();
      renderManualAnalysis();
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
                  ${teamColors.map((color) => `<option value="${color.name}" ${selectedColor.name === color.name ? 'selected' : ''} ${teamColorIsTaken(color.name, index) ? 'disabled' : ''}>${color.name}</option>`).join('')}
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
        ${query !== '' && visibleCount === 0 ? '<p class="manual-player-search-empty">No hay jugadores que coincidan con la búsqueda.</p>' : ''}
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
      analysisVisible = false;
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
          setTeamColor(teamIndex, colorSelect.value);
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
      analysisVisible = false;
      render();
    });

    colorToolbar?.addEventListener('change', (event) => {
      if (event.target.matches('[data-manual-color]')) {
        const teamIndex = Number(event.target.getAttribute('data-manual-color'));
        if (teamIndex >= 0 && teamIndex < selectedTeamColors.length) {
          setTeamColor(teamIndex, event.target.value);
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

    analyzeButton?.addEventListener('click', () => {
      updateStatus();
      if (analyzeButton.disabled) return;
      analysisVisible = true;
      renderManualAnalysis();
      analysisPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    saveButton?.addEventListener('click', async () => {
      updateStatus();
      if (saveButton.disabled) return;
      if (!teamColorsAreUnique()) {
        showToast('Cada equipo necesita un color de camiseta distinto.', 'error');
        return;
      }

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
        partialNavigate(`finalizar_partido.php?match_id=${Number(config.matchId)}`, { source: saveButton });
      } catch (error) {
        showToast(error.message || 'No se pudieron guardar los equipos.', 'error');
        saveButton.disabled = false;
      } finally {
        saveButton.classList.remove('is-loading');
      }
    });

    render();
  };

  document.addEventListener('goodfellas:init-manual-teams', initManualTeams);
  initManualTeams();

  const returnHomeAfterJuntaVote = document.querySelector('[data-junta-return-home="1"]');
  if (returnHomeAfterJuntaVote) {
    window.setTimeout(() => {
      window.location.href = 'index.php';
    }, 2600);
  }

  hydrateDynamicContent(document);
  focusHashTarget();
  window.addEventListener('hashchange', focusHashTarget);
})();

