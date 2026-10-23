const { test, expect } = require('@playwright/test');
const { execFileSync } = require('node:child_process');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';

test('verified goals agree between player profiles and the general scorers list', async ({ page }) => {
  const expected = JSON.parse(execFileSync('C:/xampp/php/php.exe', [], {
    input: "<?php require 'lib/goal_corrections.php'; echo json_encode(verified_goal_totals_2026());", encoding: 'utf8',
  }));
  await page.goto(`${BASE}/jugadores2.php`);
  const payload = await page.locator('[data-react-island="jugadores2_page"]').evaluate(node => JSON.parse(node.dataset.payload));
  for (const [name, goals] of Object.entries(expected)) {
    const player = payload.players.find(player => player.name === name);
    expect(player, name).toBeTruthy();
    expect(player.annualResults.goals, name).toBe(goals);
  }
  expect(payload.players.find(player => player.name === 'MARIAN').annualResults.ranks.goals).toBe(1);
  expect(payload.players.find(player => player.name === 'FRANCO COMOLLI').annualResults.ranks.goals).toBe(2);
  await page.goto(`${BASE}/estadisticas.php?year=2026&court_id=0`);
  await expect(page.locator('body')).not.toContainText('Warning:');
  await expect(page.locator('body')).not.toContainText('Fatal error:');
  // The collapsible list can be closed automatically on narrow viewports.
  const rows = page.locator('.stats-scorers-grid .stats-compact-grid-row');
  const actual = await rows.evaluateAll(nodes => nodes.map(node => ({ name: node.dataset.playerName, goals: Number(node.children[2].textContent) })));
  for (const [name, goals] of Object.entries(expected)) {
    expect(actual.find(player => player.name === name)?.goals, name).toBe(goals);
  }
  await page.goto(`${BASE}/estadisticas.php?year=2025&court_id=0`);
  await expect(page.locator('body')).not.toContainText('Fatal error:');
});
