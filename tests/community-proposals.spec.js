const {test,expect}=require('@playwright/test');
const {execFileSync}=require('node:child_process');
const {mkdirSync}=require('node:fs');
async function captureMobile(page, stage) {
 if(!process.env.UI_REVIEW)return;
 mkdirSync('dist/ui-review',{recursive:true});
 await page.locator('.app-toast').last().waitFor({state:'hidden'});
 await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
 const original=page.viewportSize();
 for(const width of [320,390]) {
  await page.setViewportSize({width,height:844});
  await page.screenshot({path:`dist/ui-review/${stage}-${width}.png`});
 }
 if(original)await page.setViewportSize(original);
}
const fixture=(action,id)=>execFileSync('php',['tests/sorteo-workflow-fixture.php',action,...(id?[String(id)]:[])],{encoding:'utf8'}).trim();
test('anonymous community proposals, public changeable votes, admin close and publication',async({page,browser})=>{
 test.setTimeout(120000);const id=Number(fixture('create'));let context;
 try{
  await page.goto(`http://127.0.0.1:8000/login.php?next=${encodeURIComponent(`sorteo_legacy_csv.php?match_id=${id}`)}`);
  await page.getByRole('button',{name:'Administrador',exact:true}).click();await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD||'Goodfellas2026');await page.getByRole('button',{name:'Entrar como admin',exact:true}).click();
  const admin=await page.locator('[data-react-island="sorteo_legacy_page"]').evaluate(n=>JSON.parse(n.dataset.payload));
  const keepers=admin.players.filter(p=>p.posicion.split('/').includes('ARQ')).slice(0,2).map(p=>p.id);
  expect((await(await page.request.post('http://127.0.0.1:8000/guardar_separaciones.php',{data:{match_id:id,csrf:admin.potsCsrf,separated_pairs:[],goalkeeper_ids:keepers}})).json()).ok).toBe(true);
  const url=await page.getByLabel('Enlace de invitación',{exact:true}).inputValue();
  context=await browser.newContext();const guest=await context.newPage();guest.setDefaultTimeout(10000);guest.setDefaultNavigationTimeout(10000);await guest.goto(url);
  const payload=await guest.locator('[data-react-island="sorteo_legacy_page"]').evaluate(n=>JSON.parse(n.dataset.payload));
  const identityDialog=guest.getByRole('dialog',{name:'Que jugador sos',exact:true});await expect(identityDialog).toBeVisible();await captureMobile(guest,'01-invitation-identity');await identityDialog.getByLabel('Buscar jugador').fill('zzzznonexistent');await expect(identityDialog.getByRole('status')).toContainText('No hay jugadores');await identityDialog.getByLabel('Buscar jugador').fill(payload.communityPlayers[0].name);await identityDialog.getByLabel('Que jugador sos',{exact:true}).selectOption(String(payload.communityPlayers[0].id));await identityDialog.getByRole('button',{name:'Continuar',exact:true}).click();await expect(identityDialog).not.toBeVisible();await guest.locator('#generateTeamsButton').click();await expect(guest.locator('[data-sorteo-team-card]')).toHaveCount(2,{timeout:90000});
  await guest.getByRole('button',{name:'Postular mi formación',exact:true}).first().click();
  const dialog=guest.getByRole('dialog',{name:'Postular mi formación',exact:true});
  await captureMobile(guest,'02-submit-formation');const author=payload.communityPlayers[0];await dialog.getByLabel('Nombre del postulante').selectOption(String(author.id));
  await dialog.getByRole('button',{name:'Enviar mi propuesta',exact:true}).click();await expect(dialog.getByRole('status')).toContainText('Propuesta recibida');
  await page.goto(`http://127.0.0.1:8000/votacion_formaciones.php?match_id=${id}`);
  const votingUrl=await page.getByLabel('Enlace de votacion').inputValue();expect(new URL(votingUrl).searchParams.get('code')).toMatch(/^\d{4}$/);
  const rows=await guest.locator('[data-sorteo-team-card]').evaluateAll(cards=>cards.map(c=>({color_name:c.querySelector('select').value,players:Array.from(c.querySelectorAll('[data-sorteo-drag-player]')).map(p=>({id:Number(p.dataset.playerKey),assigned_position:p.dataset.assignedPosition}))})));
  const submit=(authorId,teams=rows)=>guest.request.post('http://127.0.0.1:8000/postular_formacion.php',{data:{csrf:payload.communityCsrf,match_id:id,player_id:authorId,invite:new URL(url).searchParams.get('invite'),teams,separated_pairs:[]}});
  expect((await(await submit(author.id)).json()).ok).toBe(true);
  expect((await(await submit(payload.communityPlayers[1].id)).json()).ok).toBe(true);
  if(process.env.UI_REVIEW){for(const player of payload.communityPlayers.slice(2,4))expect((await(await submit(player.id)).json()).ok).toBe(true);}
  await page.reload();await expect(page.locator('[data-proposal]')).toHaveCount(process.env.UI_REVIEW?4:2);
  await page.goto('http://127.0.0.1:8000/index.php');const homeRow=page.locator('.community-admin-row').filter({has:page.locator(`a[href="votacion_formaciones.php?match_id=${id}"]`)});await expect(homeRow.getByRole('button',{name:'Iniciar votacion',exact:true})).toBeVisible();await expect(homeRow).toContainText('Recibiendo propuestas');await homeRow.scrollIntoViewIfNeeded();await captureMobile(page,'03-admin-home');await homeRow.getByRole('button',{name:'Iniciar votacion',exact:true}).click();
  const rejected=await submit(author.id);expect(rejected.status()).toBe(422);
  await guest.goto(votingUrl);const voterDialog=guest.getByRole('dialog',{name:'Que jugador sos',exact:true});await expect(voterDialog).toBeVisible();await captureMobile(guest,'04-voter-identity');await voterDialog.getByLabel('Buscar jugador').fill('zzzznonexistent');await expect(voterDialog.locator('[data-player-empty]')).toBeVisible();await voterDialog.getByLabel('Buscar jugador').fill(payload.communityPlayers.find(p=>Number(p.id)===Number(keepers[0])).name);await voterDialog.getByLabel('Que jugador sos',{exact:true}).selectOption(String(keepers[0]));await guest.getByRole('button',{name:'Identificarme',exact:true}).click();
  await expect(voterDialog).not.toBeVisible();await expect(guest.locator('.community-myself')).toBeVisible();await guest.evaluate(()=>scrollTo(0,0));await captureMobile(guest,'05-ballot-top');const cards=guest.locator('[data-proposal]');await cards.first().getByRole('button',{name:'Votar esta propuesta',exact:true}).click();await expect(guest.locator('[data-votes-total]')).toHaveText('1');
  await guest.locator('[data-proposal]').nth(1).getByRole('button',{name:'Votar esta propuesta',exact:true}).click();await expect(guest.locator('[data-votes-total]')).toHaveText('1');
  await expect(guest.locator('[data-proposal]').nth(1).locator('[data-count]')).toHaveText('1');
  const name=payload.communityPlayers.find(p=>Number(p.id)===Number(keepers[0])).name;await expect(guest.locator('[data-proposal]').nth(1).locator('[data-voters]')).toContainText(name);
  await guest.locator('[data-proposal]').nth(1).scrollIntoViewIfNeeded();await captureMobile(guest,'06-ballot-voted');await expect(guest.locator('.community-highlight')).toHaveCount(process.env.UI_REVIEW?4:2);await expect(guest.locator('.community-status [data-jump-count]').nth(1)).toHaveText('1');await guest.locator('[data-proposal]').first().locator('summary').click();await expect(guest.locator('[data-proposal]').first().locator('.is-current-player')).toBeVisible();await captureMobile(guest,'07-pitch');
  for(const width of [320,390,1440]){await guest.setViewportSize({width,height:844});expect(await guest.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await guest.locator('[data-proposal]').last().scrollIntoViewIfNeeded();await expect(guest.locator('[data-community-state]')).toBeInViewport();await expect(guest.locator('.community-jump')).toBeInViewport();}
  await page.goto('http://127.0.0.1:8000/index.php');await homeRow.getByRole('button',{name:'Finalizar votacion',exact:true}).click();
  await guest.reload();await captureMobile(guest,'08-closed');await expect(guest.getByRole('button',{name:'Votar esta propuesta',exact:true})).toHaveCount(0);
  await page.goto(`http://127.0.0.1:8000/votacion_formaciones.php?match_id=${id}`);await page.getByRole('button',{name:'Publicar esta propuesta',exact:true}).click();await expect(page.locator('[data-community-state]')).toHaveText('Propuesta ganadora publicada');
  const result=JSON.parse(fixture('inspect',id));expect(result.teams).toHaveLength(2);expect(result.match.status).toBe('sorteado');expect(result.match.teams_published_at).toBeTruthy();
 }finally{try{if(context)await context.close();}finally{fixture('delete',id);}}
});
