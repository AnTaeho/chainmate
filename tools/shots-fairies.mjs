// 특수 기물 그림 모음판(CHM-55): 새 다섯 · 남는 다섯 · 체스 여섯을 흰 · 검은 · 금빛 적, 각인 하나 · 기보 단계 하나 입힌 것까지
// 판 칸 위에 1배(뒷면 N 1 — 16×22 마스크)와 3배(N 3 — 32×44 마스크를 반 도트로)로 그린다. 아래 띠는 새 다섯과 바탕 기물(chart)을 두 배 크기로 나란히.
//   node tools/shots-fairies.mjs [--out docs/shots/fairies] [--scale 1,3]
// 그림만 그리는 장면이라 기물 목록은 여기서 직접 준다(data에 새 id가 없어도 된다).
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/fairies'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);

// 새 다섯 · 남는 다섯 · 체스 여섯
const GROUPS = [['T', 'E', 'V', 'M', 'D'], ['L', 'O', 'S', 'W', 'Z'], ['P', 'N', 'B', 'R', 'Q', 'K']];
// 두 배 띠: 새 기물과 그 바탕(chart)
const PAIRS = [['T', 'R'], ['E', 'B'], ['V', 'B'], ['M', 'N'], ['D', 'P']];
// 줄: [편, 각인, 기보 단계]
const ROWS = [['w', null, 0], ['b', null, 0], ['g', null, 0], ['w', 'jade', 0], ['w', null, 3]];

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);
for (const n of SCALES) {
  const url = await page.evaluate(async ({ n, GROUPS, PAIRS, ROWS }) => {
    const [gfx, { PAL }] = await Promise.all([import('/src/render/gfx.js'), import('/src/render/palette.js')]);
    const W = 480, H = 270, C = 28;
    const c = document.createElement('canvas'); c.width = W * n; c.height = H * n;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.setTransform(n, 0, 0, n, 0, 0);
    g.fillStyle = '#1c2a26'; g.fillRect(0, 0, W, H);
    // 판 칸 위: 열마다 기물 하나, 줄마다 편 · 각인 · 기보. 칸 빛깔은 체스판처럼 엇갈린다(같은 기물이 밝은 칸 · 어두운 칸 둘 다에)
    const cols = [];
    let x = 6;
    GROUPS.forEach((grp, gi) => { grp.forEach((t) => { cols.push([t, x]); x += C; }); x += gi < GROUPS.length - 1 ? 6 : 0; });
    ROWS.forEach(([side, eng, tier], r) => {
      const y = 6 + r * C;
      cols.forEach(([t, cx], i) => {
        g.fillStyle = (i + r) % 2 ? PAL.dark : PAL.light; g.fillRect(cx, y, C, C);
        gfx.sprite(g, t, side, cx + 6, y + 3, { eng, tier, time: null });
      });
    });
    // 두 배 띠: 새 기물 | 바탕 기물, 흰 줄 · 검은 줄
    const y0 = 6 + ROWS.length * C + 8, cw = 44;
    PAIRS.forEach(([a, b], i) => [a, b].forEach((t, k) => ['w', 'b'].forEach((side, r) => {
      const cx = 6 + i * (cw * 2 + 6) + k * cw, cy = y0 + r * 52;
      g.fillStyle = (k + r) % 2 ? PAL.dark : PAL.light; g.fillRect(cx, cy, cw, 52);
      gfx.sprite(g, t, side, cx + 6 + 8, cy + 4 + 44 - 22, { sx: 2, sy: 2 }); // 늘린 그림은 (x + (16 - 32) / 2, y + 22 - 44)에 선다
    })));
    return c.toDataURL('image/png');
  }, { n, GROUPS, PAIRS, ROWS });
  const tag = n === 1 ? '' : `@${n}x`;
  fs.writeFileSync(path.join(OUT, `sheet${tag}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('찍음', `sheet${tag}`);
}
await browser.close();
srv.close();
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
