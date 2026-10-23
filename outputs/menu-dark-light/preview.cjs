const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;
const palettes = [{"id": "grafito-blanco", "name": "1. Grafito y blanco", "note": "La mas nitida y neutral.", "bg": "#202322", "field": "#ffffff", "text": "#202723", "group": "#353b38", "groupText": "#ffffff", "border": "#69736d", "active": "#d9f99d", "activeText": "#203014", "hover": "#edf3ed", "muted": "#4a564e", "focus": "#237343", "exit": "#9f2323", "exitBg": "#fff1f1", "header": "#202322"}, {"id": "bosque-marfil", "name": "2. Bosque y marfil", "note": "Recomendada: conserva la identidad de Goodfellas.", "bg": "#102c20", "field": "#faf8f1", "text": "#203329", "group": "#204735", "groupText": "#ffffff", "border": "#61806c", "active": "#dcebcf", "activeText": "#173c25", "hover": "#eaeedf", "muted": "#405c49", "focus": "#237343", "exit": "#9f2323", "exitBg": "#fff1ed", "header": "#102c20"}, {"id": "cafe-arena", "name": "3. Cafe y arena", "note": "Mas calida, con seleccion en dorado suave.", "bg": "#29231f", "field": "#faf5ed", "text": "#30271f", "group": "#453a30", "groupText": "#fff9ef", "border": "#877563", "active": "#efd59b", "activeText": "#392909", "hover": "#ede5d8", "muted": "#625443", "focus": "#87591f", "exit": "#9f2323", "exitBg": "#fff1ed", "header": "#29231f"}];
function css(p) { return `
html body .app-shell > header {background:${p.header}!important}
html body #mainNav{background:${p.bg}!important;color:${p.text}!important;border-color:${p.border}!important;gap:8px!important}
html body #mainNav > details{background:${p.bg}!important;border-color:${p.border}!important;border-radius:6px!important}
html body #mainNav > details > summary{background:${p.group}!important;color:${p.groupText}!important;min-height:48px!important;font-size:15px!important;font-weight:600!important;border-color:${p.border}!important;box-shadow:none!important}
html body #mainNav > details[open] > summary{background:${p.group}!important;border-bottom:1px solid ${p.border}!important}
html body #mainNav > details > summary > span:last-child{color:${p.groupText}!important}
html body #mainNav > details > div{background:${p.field}!important}
html body #mainNav a{background:${p.field}!important;color:${p.text}!important;min-height:46px!important;font-size:15px!important;font-weight:500!important;border-color:transparent!important;box-shadow:none!important}
html body #mainNav a:hover{background:${p.hover}!important;color:${p.text}!important}
html body #mainNav a.gf-nav-current{background:${p.active}!important;color:${p.activeText}!important;font-weight:700!important;border-color:${p.active}!important}
html body #mainNav a.gf-nav-current::after{content:'✓';margin-left:auto;padding-left:12px;font-weight:700}
html body #mainNav > a{border-bottom-color:${p.border}!important}
html body #mainNav a[href='logout.php']{background:${p.exitBg}!important;color:${p.exit}!important}
html body #mainNav :is(a,summary):focus-visible{outline:3px solid ${p.focus}!important;outline-offset:-3px!important}
html body #menuToggle{background:${p.field}!important;color:${p.text}!important;border-color:${p.border}!important;min-height:44px!important;font-size:14px!important}
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
   measurements.push({palette:p.name, normal:ratio(p.text,p.field),group:ratio(p.groupText,p.group),active:ratio(p.activeText,p.active),exit:ratio(p.exit,p.exitBg),links:count});
   fs.writeFileSync(path.join(dir,p.id+'.css'),css(p));
 }
 fs.writeFileSync(path.join(dir,'contrast.json'),JSON.stringify(measurements,null,2));
 const figures=palettes.map(p=>`<figure><figcaption><h2>${p.name}</h2><p>${p.note}</p></figcaption><img src="${p.id}-mobile.png" alt="Menu real de Goodfellas con paleta ${p.name}"></figure>`).join('');
 fs.writeFileSync(path.join(dir,'comparacion.html'),`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Menu oscuro con opciones claras</title><style>body{font:16px system-ui;background:#edecea;color:#222;margin:0;padding:24px}h1{font-size:24px;margin:0 0 8px}p{margin:8px 0 20px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:1230px;margin:auto}figure{margin:0}h2{font-size:20px;margin:12px 0}figcaption p{font-size:14px;min-height:36px}img{width:100%;border:1px solid #bbb;border-radius:6px;display:block}a{color:#14532d}@media(max-width:760px){main{grid-template-columns:1fr}}</style><h1>Menu oscuro con opciones claras</h1><p>Tres variantes sobre el menu real. Vista previa; no cambia la aplicacion.</p><main>${figures}</main></html>`);
 const gallery=await browser.newPage({viewport:{width:1240,height:1200}});
 await gallery.goto('file:///'+path.join(dir,'comparacion.html').replaceAll('\\','/'));
 await gallery.screenshot({path:path.join(dir,'comparacion.png'),fullPage:true});
 await browser.close(); console.log(JSON.stringify(measurements));
})().catch(e=>{console.error(e);process.exit(1)});
