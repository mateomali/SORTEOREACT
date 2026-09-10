import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const width = 409;
const height = 710;

const tiers = {
  bronze: {
    shell: ['#130b06', '#3b2011', '#8d552d', '#160e09'],
    glowA: '#ff9f43',
    glowB: '#6d2c10',
    trimA: '#f0bd6b',
    trimB: '#9a5523',
    trimC: '#ffe7a0',
    line: '#f0a65a',
    text: '#f5d77d',
    seed: 31,
  },
  silver: {
    shell: ['#0d1112', '#252b2c', '#7d8784', '#101415'],
    glowA: '#d9fff3',
    glowB: '#6b7c79',
    trimA: '#f4efe1',
    trimB: '#8a9692',
    trimC: '#ffffff',
    line: '#cdd8d5',
    text: '#f2efe0',
    seed: 43,
  },
  gold: {
    shell: ['#10150d', '#2f3108', '#b28a17', '#122014'],
    glowA: '#ffe16b',
    glowB: '#23a55d',
    trimA: '#fff0a7',
    trimB: '#b98316',
    trimC: '#fff9c7',
    line: '#ffd65b',
    text: '#f5d77d',
    seed: 59,
  },
  elite: {
    shell: ['#041b22', '#063f43', '#15786d', '#180f2f'],
    glowA: '#5ff2dc',
    glowB: '#8f5cff',
    trimA: '#f9dc82',
    trimB: '#29d9c8',
    trimC: '#fff2ac',
    line: '#61f0dd',
    text: '#f5d77d',
    seed: 71,
  },
};

const outerPath = [
  'M204.5 12',
  'C192 30 176 35 158 25',
  'C118 31 79 50 49 78',
  'C27 99 17 132 17 170',
  'L17 546',
  'C17 606 58 647 123 675',
  'L204.5 704',
  'L286 675',
  'C351 647 392 606 392 546',
  'L392 170',
  'C392 132 382 99 360 78',
  'C330 50 291 31 251 25',
  'C233 35 217 30 204.5 12',
  'Z',
].join(' ');

const rimPath = [
  'M204.5 29',
  'C193 43 177 47 160 38',
  'C124 44 91 60 61 88',
  'C43 106 34 134 34 170',
  'L34 542',
  'C34 594 70 631 132 657',
  'L204.5 684',
  'L277 657',
  'C339 631 375 594 375 542',
  'L375 170',
  'C375 134 366 106 348 88',
  'C318 60 285 44 249 38',
  'C232 47 216 43 204.5 29',
  'Z',
].join(' ');

const innerPath = [
  'M204.5 47',
  'C194 58 178 61 162 52',
  'C130 59 101 73 75 98',
  'C59 115 51 139 51 171',
  'L51 534',
  'C51 580 83 613 139 637',
  'L204.5 663',
  'L270 637',
  'C326 613 358 580 358 534',
  'L358 171',
  'C358 139 350 115 334 98',
  'C308 73 279 59 247 52',
  'C231 61 215 58 204.5 47',
  'Z',
].join(' ');

function polyline(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`).join(' ');
}

function makeSvg(tier, colors) {
  const [shell0, shell1, shell2, shell3] = colors.shell;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <clipPath id="innerClip"><path d="${innerPath}"/></clipPath>
    <clipPath id="rimClip"><path d="${rimPath}"/></clipPath>

    <linearGradient id="shell" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${shell0}"/>
      <stop offset=".35" stop-color="${shell1}"/>
      <stop offset=".62" stop-color="${shell2}"/>
      <stop offset="1" stop-color="${shell3}"/>
    </linearGradient>
    <linearGradient id="outerTrim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.trimC}"/>
      <stop offset=".16" stop-color="${colors.trimA}"/>
      <stop offset=".36" stop-color="${colors.trimB}"/>
      <stop offset=".58" stop-color="${colors.trimA}"/>
      <stop offset=".76" stop-color="${colors.trimC}"/>
      <stop offset="1" stop-color="${colors.trimB}"/>
    </linearGradient>
    <linearGradient id="innerTrim" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${colors.line}"/>
      <stop offset=".45" stop-color="${colors.glowA}"/>
      <stop offset="1" stop-color="${colors.trimA}"/>
    </linearGradient>
    <radialGradient id="topGlow" cx="58%" cy="9%" r="62%">
      <stop offset="0" stop-color="${colors.glowA}" stop-opacity=".70"/>
      <stop offset=".32" stop-color="${colors.glowA}" stop-opacity=".22"/>
      <stop offset=".72" stop-color="${colors.glowB}" stop-opacity=".10"/>
      <stop offset="1" stop-color="${colors.glowB}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="bottomGlow" cx="48%" cy="86%" r="52%">
      <stop offset="0" stop-color="${colors.glowB}" stop-opacity=".18"/>
      <stop offset=".54" stop-color="#000" stop-opacity=".10"/>
      <stop offset="1" stop-color="#000" stop-opacity=".48"/>
    </radialGradient>
    <linearGradient id="photoGlass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".20"/>
      <stop offset=".42" stop-color="#fff" stop-opacity=".045"/>
      <stop offset="1" stop-color="#000" stop-opacity=".08"/>
    </linearGradient>
    <linearGradient id="bottomPlate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity=".12"/>
      <stop offset=".55" stop-color="#000" stop-opacity=".26"/>
      <stop offset="1" stop-color="#000" stop-opacity=".02"/>
    </linearGradient>
    <pattern id="cutLines" width="27" height="27" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <path d="M0 0H1.25V27H0Z" fill="#fff" opacity=".09"/>
      <path d="M14 0H14.6V27H14Z" fill="#000" opacity=".12"/>
    </pattern>
    <pattern id="microGrid" width="54" height="54" patternUnits="userSpaceOnUse">
      <path d="M0 0H54M0 27H54M0 54H54M0 0V54M27 0V54M54 0V54" stroke="#fff" stroke-width=".7" opacity=".055"/>
    </pattern>
    <filter id="cardShadow" x="-20%" y="-15%" width="140%" height="140%">
      <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#04100d" flood-opacity=".30"/>
    </filter>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency=".74" numOctaves="4" seed="${colors.seed}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 .105"/>
      </feComponentTransfer>
    </filter>
  </defs>

  <g filter="url(#cardShadow)">
    <path d="${outerPath}" fill="url(#outerTrim)"/>
    <path d="${rimPath}" fill="#06120f" opacity=".94"/>
    <path d="${rimPath}" fill="url(#outerTrim)" opacity=".28"/>

    <g clip-path="url(#rimClip)">
      <path d="M28 82 C76 52 124 37 161 35 C178 48 195 47 204.5 33 C214 47 231 48 248 35 C289 40 333 57 377 91 L365 126 C318 91 280 75 245 69 C230 78 216 75 204.5 63 C193 75 179 78 164 69 C122 78 85 95 52 126 Z" fill="#fff" opacity=".14"/>
      <path d="M23 530 C72 608 129 650 204.5 681 C280 650 337 608 386 530 L386 621 L204.5 707 L23 621 Z" fill="#000" opacity=".18"/>
    </g>

    <path d="${innerPath}" fill="url(#shell)"/>
    <g clip-path="url(#innerClip)">
      <path d="${innerPath}" fill="url(#topGlow)"/>
      <path d="${innerPath}" fill="url(#bottomGlow)"/>
      <rect x="45" y="45" width="320" height="620" fill="url(#cutLines)" opacity=".78"/>
      <rect x="45" y="45" width="320" height="620" fill="url(#microGrid)" opacity=".9"/>
      <rect x="45" y="45" width="320" height="620" fill="#fff" filter="url(#grain)"/>

      <path d="${polyline([[69,116],[139,82],[214,74],[334,108],[359,158],[310,150],[245,122],[183,120],[107,148],[64,178]])}Z" fill="url(#photoGlass)" opacity=".88"/>
      <path d="${polyline([[57,182],[131,126],[210,101],[342,70],[358,90],[222,133],[137,166],[61,221]])}" fill="none" stroke="#fff" stroke-width="2.2" opacity=".22"/>
      <path d="${polyline([[58,235],[148,170],[236,140],[355,117]])}" fill="none" stroke="${colors.line}" stroke-width="1.1" opacity=".24"/>
      <path d="${polyline([[57,346],[352,346]])}" fill="none" stroke="${colors.trimA}" stroke-width="1.2" opacity=".22"/>
      <circle cx="204.5" cy="348" r="57" fill="none" stroke="#fff" stroke-width="1" opacity=".10"/>

      <path d="M71 430 H338 L354 470 V592 C314 617 266 636 204.5 657 C143 636 95 617 55 592 V470 Z" fill="url(#bottomPlate)" opacity=".86"/>
      <path d="M72 430 H337" stroke="${colors.trimA}" stroke-width="1.3" opacity=".31"/>
      <path d="M204.5 455 V608" stroke="${colors.trimA}" stroke-width="1" opacity=".24"/>
      <path d="M96 521 H185" stroke="#fff" stroke-width=".9" opacity=".075"/>
      <path d="M224 521 H313" stroke="#fff" stroke-width=".9" opacity=".075"/>

      <path d="M42 326 V540" stroke="${colors.line}" stroke-width="5" opacity=".28"/>
      <path d="M367 326 V540" stroke="${colors.line}" stroke-width="5" opacity=".28"/>
      <path d="M45 330 V538" stroke="#fff" stroke-width="1.2" opacity=".30"/>
      <path d="M364 330 V538" stroke="#fff" stroke-width="1.2" opacity=".30"/>

      <circle cx="72" cy="216" r="4.4" fill="${colors.trimA}" opacity=".42"/>
      <circle cx="337" cy="206" r="3.2" fill="#fff" opacity=".28"/>
      <circle cx="318" cy="585" r="2.4" fill="${colors.glowA}" opacity=".35"/>
      <path d="M176 640 L204.5 653 L233 640" fill="none" stroke="${colors.trimA}" stroke-width="2.2" opacity=".55"/>
    </g>

    <path d="${innerPath}" fill="none" stroke="url(#innerTrim)" stroke-width="4.2" filter="url(#glow)" opacity=".94"/>
    <path d="${innerPath}" fill="none" stroke="#fff7bd" stroke-width="1.25" opacity=".62"/>
    <path d="${rimPath}" fill="none" stroke="#000" stroke-width="2.3" opacity=".46"/>
    <path d="${outerPath}" fill="none" stroke="${colors.trimC}" stroke-width="1.2" opacity=".72"/>

    <path d="M159 37 C178 51 193 48 204.5 31 C216 48 231 51 250 37" fill="none" stroke="${colors.trimC}" stroke-width="3.2" opacity=".82"/>
    <path d="M169 43 C183 51 196 48 204.5 38 C213 48 226 51 240 43" fill="none" stroke="${colors.line}" stroke-width="2" opacity=".78"/>
  </g>
</svg>`;
}

await mkdir('assets/card-backgrounds', { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 1,
});

for (const [tier, colors] of Object.entries(tiers)) {
  const svg = makeSvg(tier, colors);
  const encoded = Buffer.from(svg).toString('base64');
  await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent"><img alt="" src="data:image/svg+xml;base64,${encoded}" width="${width}" height="${height}"></body></html>`);
  await page.screenshot({
    path: `assets/card-backgrounds/reference-${tier}.png`,
    clip: { x: 0, y: 0, width, height },
    omitBackground: true,
  });
}

await browser.close();
