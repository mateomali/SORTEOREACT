const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const userDataDir = path.resolve('.tmp/chrome-mobile-audit');
const outDir = path.resolve('.tmp/mobile-audit');
const port = 9223;
const widths = [320, 360, 390, 430, 480];
const pages = ['index.php', 'jugadores.php', 'encuentros.php', 'capitanes.php', 'finalizar_partido.php', 'estadisticas.php'];

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }
async function getJson(url){ const res = await fetch(url); return res.json(); }

class CDP {
  constructor(wsUrl){ this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.ws.onmessage = e => { const msg = JSON.parse(e.data); if (msg.id && this.pending.has(msg.id)) { const {resolve,reject} = this.pending.get(msg.id); this.pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); } }; }
  async open(){ await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; }); }
  send(method, params={}){ const id = ++this.id; this.ws.send(JSON.stringify({id, method, params})); return new Promise((resolve,reject)=>this.pending.set(id,{resolve,reject})); }
  close(){ this.ws.close(); }
}

async function waitLoad(cdp){
  await sleep(700);
}

async function main(){
  await fs.rm(userDataDir, {recursive:true, force:true});
  await fs.rm(outDir, {recursive:true, force:true});
  await fs.mkdir(outDir, {recursive:true});
  const chrome = spawn(chromePath, [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`, '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', 'about:blank'], {stdio:'ignore'});
  try {
    let version;
    for (let i=0; i<40; i++) { try { version = await getJson(`http://127.0.0.1:${port}/json/version`); break; } catch { await sleep(250); } }
    if (!version) throw new Error('Chrome CDP did not start');
    const targets = await getJson(`http://127.0.0.1:${port}/json`);
    const tabInfo = targets.find(t => t.type === 'page') || targets[0];
    const cdp = new CDP(tabInfo.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Page.navigate', {url:'http://127.0.0.1:8000/login.php'});
    await waitLoad(cdp);
    await cdp.send('Runtime.evaluate', {awaitPromise:true, expression:`fetch('/login.php',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'password=Goodfellas2026&next=index.php',credentials:'include'}).then(r=>r.text()).then(()=>true)`});
    const report = [];
    for (const width of widths) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 3, mobile: true});
      for (const page of pages) {
        const url = `http://127.0.0.1:8000/${page}`;
        await cdp.send('Page.navigate', {url});
        await waitLoad(cdp);
        const evalResult = await cdp.send('Runtime.evaluate', {returnByValue:true, expression:`(() => {
          const vw = window.innerWidth;
          const doc = document.documentElement;
          const body = document.body;
          const offenders = [];
          const nodes = Array.from(document.body.querySelectorAll('*'));
          for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            if (r.right > vw + 1 || r.left < -1) {
              offenders.push({tag: el.tagName.toLowerCase(), cls: el.className && String(el.className).slice(0,80), text: (el.innerText||el.textContent||'').trim().replace(/\s+/g,' ').slice(0,80), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width)});
            }
          }
          return {width: vw, page: location.pathname.split('/').pop(), scrollWidth: doc.scrollWidth, bodyScrollWidth: body.scrollWidth, overflow: doc.scrollWidth > vw + 1 || body.scrollWidth > vw + 1, offenders: offenders.slice(0,12)};
        })()`});
        const data = evalResult.result.value;
        report.push(data);
        if (data.overflow || data.offenders.length) {
          const screenshot = await cdp.send('Page.captureScreenshot', {format:'png', captureBeyondViewport:false});
          await fs.writeFile(path.join(outDir, `${width}-${page}.png`), Buffer.from(screenshot.data, 'base64'));
        }
      }
    }
    await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report.filter(r => r.overflow || r.offenders.length), null, 2));
    cdp.close();
  } finally {
    chrome.kill();
  }
}
main().catch(e => { console.error(e); process.exit(1); });
