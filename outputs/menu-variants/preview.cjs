const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const palettes = [
  { id: 'claro', name: '1. Blanco y verde', note: 'La mas clara: lectura directa y buen contraste.', bg: '#ffffff', text: '#202723', group: '#e8eae8', groupText: '#202723', border: '#c1c7c2', active: '#14532d', activeText: '#ffffff', hover: '#edf5ef', muted: '#47534b', focus: '#166534', exit: '#9f2323', exitBg: '#fff1f1', header: '#102c20' },
  { id: 'grafito', name: '2. Grafito y lima', note: 'Recomendada: deportiva y con el destino activo muy visible.', bg: '#1c1c1e', text: '#f2f2f7', group: '#303033', groupText: '#f2f2f7', border: '#68686d', active: '#d9f99d', activeText: '#1c2810', hover: '#353538', muted: '#c1c1c6', focus: '#d9f99d', exit: '#ffb4ab', exitBg: '#342326', header: '#1c1c1e' },
  { id: 'marfil', name: '3. Marfil y bosque', note: 'Mas calida, con menos brillo que el blanco puro.', bg: '#faf8f5', text: '#292524', group: '#e9e3d9', groupText: '#292524', border: '#c2b6a6', active: '#214e39', activeText: '#ffffff', hover: '#eeeae2', muted: '#655d53', focus: '#214e39', exit: '#9c2a21', exitBg: '#faece7', header: '#243b2e' },
];
function css(p) { return `
html body .app-shell > header {background:${p.header}!important}
html body #mainNav{background:${p.bg}!important;color:${p.text}!important;border-color:${p.border}!important;gap:8px!important}
html body #mainNav > details{background:${p.bg}!important;border-color:${p.border}!important;border-radius:6px!important}
html body #mainNav > details > summary{background:${p.group}!important;color:${p.groupText}!important;min-height:48px!important;font-size:15px!important;font-weight:600!important;border-color:${p.border}!important;box-shadow:none!important}
html body #mainNav > details[open] > summary{background:${p.group}!important;border-bottom:1px solid ${p.border}!important}
html body #mainNav > details > summary > span:last-child{color:${p.groupText}!important}
html body #mainNav > details > div{background:${p.bg}!important}
html body #mainNav a{background:${p.bg}!important;color:${p.text}!important;min-height:46px!important;font-size:15px!important;font-weight:500!important;border-color:transparent!important;box-shadow:none!important}
html body #mainNav a:hover{background:${p.hover}!important;color:${p.text}!important}
html body #mainNav a.gf-nav-current{background:${p.active}!important;color:${p.activeText}!important;font-weight:700!important;border-color:${p.active}!important}
html body #mainNav a.gf-nav-current::after{content:'✓';margin-left:auto;padding-left:12px;font-weight:700}
html body #mainNav > a{border-bottom-color:${p.border}!important}
html body #mainNav a[href='logout.php']{background:${p.exitBg}!important;color:${p.exit}!important}
html body #mainNav :is(a,summary):focus-visible{outline:3px solid ${p.focus}!important;outline-offset:-3px!important}
html body #menuToggle{background:${p.bg}!important;color:${p.text}!important;border-color:${p.border}!important;min-height:44px!important;font-size:14px!important}
@media(min-width:761px){html body #mainNav{padding:8px!important;border-radius:6px!important}html body #mainNav > details > div{border:1px solid ${p.border}!important}html body #mainNav > details{border:0!important}html body #mainNav > a{border-bottom:0!important}}
`; }
function lum(hex) { const a = hex.match(/\w\w/g).map(v => parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return a[0]*.2126+a[1]*.7152+a[2]*.0722; }
function ratio(a,b){const x=lum(a.slice(1)),y=lum(b.slice(1));return Number(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2));}
(async()=>{
 const browser=await chromium.launch(); const page=await browser.newPage({viewport:{width:390,height:950}});
 await page.goto('http://127.0.0.1:8000/login.php');
 await page.getByRole('button',{name:'Administrador',exact:true}).click();
 await page.locator('#adminPassword').fill(process.env.GOODFELLAS_ADMIN_PASSWORD || 'Goodfellas2026');
 await Promise.all([page.waitForURL('**/editar_partidos.php'),page.getByRole('button',{name:'Entrar como admin',exact:true}).click()]);
 const measurements=[];
 for(const p of palettes){
   await page.setViewportSize({width:390,height:950});
   await page.goto('http://127.0.0.1:8000/jugadores2.php?tab=awards');
   await page.addStyleTag({content:css(p)});
   await page.locator('#menuToggle').click();
   await page.locator('#mainNav summary').filter({hasText:'Jugadores'}).click();
   await page.locator('#mainNav').evaluate(n=>n.scrollTop=0);
   await page.screenshot({path:path.join(dir,p.id+'-mobile.png')});
   const count=await page.locator('#mainNav a').count();
   await page.setViewportSize({width:1366,height:850});
   await page.screenshot({path:path.join(dir,p.id+'-desktop.png')});
   measurements.push({palette:p.name, normal:ratio(p.text,p.bg),group:ratio(p.groupText,p.group),active:ratio(p.activeText,p.active),exit:ratio(p.exit,p.exitBg),links:count});
   fs.writeFileSync(path.join(dir,p.id+'.css'),css(p));
 }
 fs.writeFileSync(path.join(dir,'contrast.json'),JSON.stringify(measurements,null,2));
 const figures=palettes.map(p=>`<figure><figcaption><h2>${p.name}</h2><p>${p.note}</p></figcaption><img src="${p.id}-mobile.png" alt="Menu real de Goodfellas con paleta ${p.name}"></figure>`).join('');
 fs.writeFileSync(path.join(dir,'comparacion.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Variantes del menu Goodfellas</title><style>body{font:16px system-ui;background:#edecea;color:#222;margin:0;padding:24px}h1{font-size:24px;margin:0 0 8px}p{margin:8px 0 20px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:1230px;margin:auto}figure{margin:0}h2{font-size:20px;margin:12px 0}figcaption p{font-size:14px;min-height:36px}img{width:100%;border:1px solid #bbb;border-radius:6px;display:block}a{color:#14532d}@media(max-width:760px){main{grid-template-columns:1fr}}</style><h1>Variantes del menu Goodfellas</h1><p>Mismo menu y opciones. Vista previa; no cambia la aplicacion.</p><main>${figures}</main></html>`);
 const gallery=await browser.newPage({viewport:{width:1240,height:1200}});
 await gallery.goto('file:///'+path.join(dir,'comparacion.html').replaceAll('\\','/'));
 await gallery.screenshot({path:path.join(dir,'comparacion.png'),fullPage:true});
 await browser.close(); console.log(JSON.stringify(measurements));
})().catch(e=>{console.error(e);process.exit(1)});
