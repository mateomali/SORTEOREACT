export function bindMatchWizard(root) {
  const form = root.querySelector('[data-match-wizard]');
  if (!form || !form.querySelector('[data-wizard-summary]')) return;
  const panels = [...form.querySelectorAll('[data-wizard-panel]')];
  const buttons = [...form.querySelectorAll('[data-wizard-go]')];
  const draftKey = 'goodfellas:match-import-configuration';
  const fields = ['title', 'rental_court_id', 'match_date', 'num_teams', 'players_per_team', 'valuation_mode'];
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    sessionStorage.removeItem(draftKey);
    if (draft && root.querySelector('#importar-listado')) {
      fields.forEach(name => {
        const input = form.querySelector(`[name="${name}"]`);
        if (input && draft[name] !== undefined) input.value = draft[name];
      });
      form.querySelector('[data-num-teams]')?.dispatchEvent(new Event('change', { bubbles: true }));
    }
  } catch { /* Continue with the server defaults when storage is unavailable. */ }
  const syncSummary = () => {
    const teams = form.querySelector('[name="num_teams"]');
    const players = form.querySelector('[name="players_per_team"]');
    root.querySelectorAll('[data-match-cup-total]').forEach(node => { node.textContent = String(Number(teams.value) * Number(players.value)); });
    root.querySelectorAll('[data-match-team-total]').forEach(node => { node.textContent = teams.value; });
    root.querySelectorAll('[data-match-per-team]').forEach(node => { node.textContent = players.value; });
  };
  const configurationChange = event => {
    if (event.target.matches('[name="num_teams"], [name="players_per_team"], [name="rental_court_id"]')) syncSummary();
  };
  let step = 1;
  const validConfiguration = () => {
    for (const input of panels[0].querySelectorAll('input, select')) {
      if (!input.checkValidity()) {
        showStep(1);
        input.reportValidity();
        return false;
      }
    }
    return true;
  };
  const showStep = (next, focus = true) => {
    syncSummary();
    step = next;
    form.dataset.wizardStep = String(next);
    panels.forEach((panel, index) => { panel.hidden = index + 1 !== next; });
    buttons.forEach(button => {
      if (Number(button.dataset.wizardGo) === next) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    const court = form.querySelector('[name="rental_court_id"]');
    const date = form.querySelector('[name="match_date"]');
    const teams = form.querySelector('[name="num_teams"]');
    const players = form.querySelector('[name="players_per_team"]');
    form.querySelector('[data-wizard-summary]').textContent = `${court.selectedOptions[0]?.textContent} · ${date.value.replace('T', ' ')} · ${teams.value} equipos de ${players.value}`;
    if (focus) {
      const target = next === 1 ? panels[0].querySelector('h2') : form.querySelector('#participantSearchReact');
      (target || panels[next - 1]).scrollIntoView({ block: 'start' });
      target?.focus({ preventScroll: true });
    }
  };
  const click = event => {
    const button = event.target.closest('[data-wizard-go]');
    if (!button || !form.contains(button)) return;
    const next = Number(button.dataset.wizardGo);
    if (next === 2 && !validConfiguration()) return;
    showStep(next);
    document.dispatchEvent(new CustomEvent('goodfellas:configuration-changed'));
  };
  const submit = event => {
    if (event.target !== form) {
      if (root.contains(event.target) && /^(importPlayersForm|clearImportPlayersForm|createImportPlayerForm|useExistingImportPlayerForm)/.test(event.target.id)) {
        try {
          sessionStorage.setItem(draftKey, JSON.stringify(Object.fromEntries(fields.map(name => [name, form.querySelector(`[name="${name}"]`)?.value]))));
        } catch { /* The import still works without draft storage. */ }
      }
      return;
    }
    if (step === 1) {
      event.preventDefault();
      if (validConfiguration()) showStep(2);
    } else if (!validConfiguration()) event.preventDefault();
  };
  form.addEventListener('click', click);
  root.addEventListener('submit', submit);
  const invalid = () => showStep(1, false);
  form.addEventListener('invalid', invalid, true);
  form.addEventListener('input', configurationChange);
  form.addEventListener('change', configurationChange);
  showStep(root.querySelector('[data-imported-player-ids]') ? 2 : 1, false);
  return () => {
    form.removeEventListener('click', click);
    form.removeEventListener('invalid', invalid, true);
    form.removeEventListener('input', configurationChange);
    form.removeEventListener('change', configurationChange);
    root.removeEventListener('submit', submit);
  };
}
