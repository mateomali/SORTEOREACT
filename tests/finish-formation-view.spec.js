const {test,expect}=require('@playwright/test');
const BASE=process.env.BASE_URL || 'http://127.0.0.1:8000';
test('formations exclude goals and awards; finish retains them', async ({page}) => {
  await page.goto(`${BASE}/login.php?next=finalizar_partido.php%3Fmatch_id%3D184%26edit_formations%3D1`);
  await page.getByRole('button',{name:'Administrador',exact:true}).click();
  await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
  await page.getByRole('button',{name:"Entrar como admin",exact:true}).click();
  await page.goto(`${BASE}/finalizar_partido.php?match_id=184&edit_formations=1`);
  await expect(page.locator('#formaciones')).toBeVisible();
  await expect(page.locator('#finish-score-form')).toHaveCount(0);
  await expect(page.locator('#valoraciones')).toHaveCount(0);
  await page.goto(`${BASE}/finalizar_partido.php?match_id=184`);
  await expect(page.locator('#finish-score-form')).toHaveCount(1);
  await expect(page.locator('#valoraciones')).toHaveCount(1);
  await expect(page.getByRole('button',{name:'Finalizar fecha',exact:true})).toBeDisabled();
  const rejected=await page.request.post(`${BASE}/finalizar_partido.php`,{form:{action:'save_score',match_id:'184',ajax:'1'}});
  expect(rejected.status()).toBe(422);
  expect((await rejected.json()).message).toContain('publica');
});
