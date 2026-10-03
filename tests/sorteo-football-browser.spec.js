const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const source = fs.readFileSync('src/pages/SorteoLegacyPageIsland.jsx','utf8');
const helpers = source.slice(0,source.indexOf('function iconPath('))
  .replace(/^import .*;\r?\n/gm,'')
  .replace(/function TeamRadar\([\s\S]*?(?=const LINE_STRENGTH_BALANCE_WEIGHTS)/,'');

test('2, 3 and 4 teams keep real goalkeepers, natural positions and a responsive search',async({page})=>{
  await page.goto('http://127.0.0.1:8000/');
  await page.addScriptTag({content:helpers});
  const results=await page.evaluate(async()=>{
    const report=[];
    for(const n of [2,3,4]) {
      let id=0;
      const players=['ARQ','DEF','DEF','MED','MED','DEL','DEL'].flatMap((position,line)=>Array.from({length:n},(_,i)=>normalizePlayer({
        id:++id,positions:position,overall:3.3 + (i%2)*0.4 + (line%2)*0.3,regularity:3.5,rhythm:3+(i%2),
      },id)));
      let frames=0;let active=true;let last=performance.now();let maxFrameGap=0;
      const tick=()=>{if(!active)return;const now=performance.now();maxFrameGap=Math.max(maxFrameGap,now-last);last=now;frames++;requestAnimationFrame(tick);};
      requestAnimationFrame(tick);
      const started=performance.now();
      const draw=await generateBalancedTeams(players,n,0.7,{}, {},new Set(),{yieldToUi:createGenerationClock()});
      active=false;
      if(!draw)throw new Error(`No draw for ${n} teams`);
      const assignments=draw.teams.map(team=>buildTeamAssignment(team));
      report.push({teams:n,players:players.length,ms:Math.round(performance.now()-started),frames,maxFrameGap,
        valid:draw.evaluation.valid,counts:assignments.map(a=>Object.values(a).filter(pos=>pos==='ARQ').length),
        realKeepers:draw.teams.map((team,index)=>team.filter(p=>p.posicion==='ARQ'&&assignments[index][p.id]==='ARQ').length),
        gaps:Object.fromEntries(Object.entries(draw.evaluation.lineBalance.details).map(([line,value])=>[line,value.gap])),
        totalGap:draw.evaluation.totalBalance});
    }
    return report;
  });
  for(const result of results) {
    expect(result.valid).toBe(true);
    expect(result.counts).toEqual(Array(result.teams).fill(1));
    expect(result.realKeepers).toEqual(Array(result.teams).fill(1));
    expect(result.maxFrameGap).toBeLessThan(500);
    expect(result.ms).toBeLessThan(10000);
  }
  fs.writeFileSync('.tmp/sorteo-football-browser-results.json',JSON.stringify(results,null,2));
  console.log('FOOTBALL-BROWSER',JSON.stringify(results));
});
