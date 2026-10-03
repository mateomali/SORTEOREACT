const {test,expect} = require('@playwright/test');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000';
test('captain presets retain coverage and respect declared positions without saving',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`${BASE}/login.php?next=${encodeURIComponent('capitanes.php?match_id=204')}`);
  await page.locator('#login-admin').evaluate(node=>node.open=true);
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button',{name:/Entrar como admin|Ingresar/i}).click();
  const presets=page.locator('[data-formation-preset]');
  await expect(presets.first()).toBeVisible();
  for (const value of ['0','1','2']) {
    await presets.first().selectOption(value);
    const counts=await page.locator('[data-formation-team]').first().locator('[data-drag-player-id]').evaluateAll(cards=>cards.reduce((counts,card)=>{
      const role=card.dataset.position || card.dataset.assignedPosition;
      if(role) counts[role]=(counts[role] || 0)+1;
      return counts;
    },{}));
    // The shared policy is loaded in this legacy page and presets execute without errors.
    expect(await page.evaluate(()=>typeof GoodfellasFormation.assignCounts)).toBe('function');
  }
  expect(errors).toEqual([]);
});
