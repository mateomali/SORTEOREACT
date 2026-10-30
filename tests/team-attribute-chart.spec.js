const { test, expect } = require('@playwright/test');

test('team attribute charts preserve values across all shared summary layouts', async ({page}) => {
  await page.goto('http://127.0.0.1:8000/assets/team-attributes.css');
  await page.setContent(`<link rel="stylesheet" href="http://127.0.0.1:8000/assets/team-attributes.css">
    <main style="max-width:480px;padding:12px;font-family:sans-serif;background:white">
      <div class="team-characteristics-stats"><span>Solidez 3.4</span><span>Velocidad 4.5</span></div>
      <div class="sorteo-team-stats"><div><span>Equipo 3.7</span></div></div>
      <div class="sorteo-team-stats"><span>Arquero 3.7</span></div>
      <div class="totals-breakdown"><span>Mentalidad 3.6</span></div>
    </main>`);
  await page.addScriptTag({url:'http://127.0.0.1:8000/assets/team-attributes.js'});
  await expect(page.getByRole('meter')).toHaveCount(5);
  await expect(page.getByRole('meter',{name:'Solidez',exact:true})).toHaveAttribute('aria-valuenow','3.4');
  await expect(page.getByRole('meter',{name:'Velocidad',exact:true})).toHaveCSS('--attribute-width','75%');
  await page.getByRole('meter',{name:'Solidez',exact:true}).evaluate(node=>{node.textContent='Solidez 4.2';});
  await expect(page.getByRole('meter',{name:'Solidez',exact:true})).toHaveAttribute('aria-valuenow','4.2');
  await page.locator('.totals-breakdown').evaluate(node=>node.innerHTML='<span>Pase/Visión 3.7</span>');
  await expect(page.getByRole('meter',{name:'Pase/Visión',exact:true})).toHaveAttribute('aria-valuenow','3.7');
  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'.tmp/team-attribute-chart.png'});
});
