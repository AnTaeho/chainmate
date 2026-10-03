// 판 보기(CHM-61) 스크린샷: 관 선택 카드 셋의 작은 판 · 가리키면 왼쪽 칸에 큰 판 · 숲 사냥꾼(안개) · 영어.
//   NPM_CONFIG_PREFIX=… node tools/shots-preview.mjs [--out docs/shots/board-preview] [--scale 1,3]
// 시안 draft1~3-*(칸 4 · 글 옆 / 칸 5 · 글 옆 / 칸 5 · 글 아래 한 줄)은 고르기 전 코드의 globalThis.__PREVIEW_DRAFT로 찍었다(layout.md 17절).
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/board-preview'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
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
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'next', 'master'];

async function session(sc, lang) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => {
    localStorage.clear();
    if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang }));
  }, lang);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = '';
  const suf = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${tag}${name}${suf}.png`), clip: box });
    console.log('찍음', `${tag}${name}${suf}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function hover(id) { const r = await region(id); if (!r) throw new Error(`no region ${id}`); const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y); await settle(500); }
  const away = async () => { const [x, y] = await toXY(300, 266); await page.mouse.move(x, y); };
  return { page, context, ev, settle, shot, hover, away, region };
}

// 관 선택을 연다: seed의 판에서 ante관(세력 forest면 숲 사냥꾼 관)으로 옮긴다. coach: 판 보기 처음 안내만 남긴다
async function select(s, { seed = 4, ante = 3, faction = null, coach = false, blind = 0 } = {}) {
  await s.settle(300);
  await s.ev(async ({ seed, ante, faction, coach, blind, SEEN }) => {
    const a = window.__app;
    const { syncBoards } = await import('/src/sim/run.js');
    a.settings.coach = coach;
    const factions = ['peasants', 'cavalry', 'abbey', 'fortress', 'hunters', 'heralds', 'mercs', 'royal'];
    a.records.coachSeen = Object.fromEntries([...SEEN, ...factions.map((f) => `faction_${f}`), ...(coach ? [] : ['preview'])].map((k) => [k, true]));
    a.nextSeed = seed; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const r = a.run;
    r.ante = faction ? r.factions.indexOf(faction) + 1 : ante; r.blind = blind; r.boards = null; r.money = 12;
    syncBoards(r);
    a.go('select');
  }, { seed, ante, faction, coach, blind, SEEN });
  await s.settle(400);
}

for (const sc of SCALES) {
  // 1 관 선택(세 카드)
  { const s = await session(sc, 'ko'); await select(s); await s.away(); await s.settle(200); await s.shot('1-select'); await s.context.close(); }
  // 2 크게 보기(정식 카드를 가리킴)
  { const s = await session(sc, 'ko'); await select(s); await s.hover('select:board:1'); await s.shot('2-big'); await s.context.close(); }
  // 3 숲 사냥꾼(안개)
  { const s = await session(sc, 'ko'); await select(s, { faction: 'hunters' }); await s.away(); await s.settle(200); await s.shot('3-fog'); await s.hover('select:board:0'); await s.shot('3b-fog-big'); await s.context.close(); }
  // 4 영어
  { const s = await session(sc, 'en'); await select(s, { ante: 6 }); await s.away(); await s.settle(200); await s.shot('4-select'); await s.hover('select:board:2'); await s.shot('4b-big'); await s.context.close(); }
  // 5 처음 안내
  { const s = await session(sc, 'ko'); await select(s, { coach: true }); await s.away(); await s.settle(900); await s.shot('5-hint'); await s.context.close(); }
  // 6 8관(마스터전 카드가 가장 긴 때) · 건너뛴 뒤
  { const s = await session(sc, 'ko'); await select(s, { ante: 8, blind: 1 }); await s.away(); await s.settle(200); await s.shot('6-ante8'); await s.context.close(); }
  { const s = await session(sc, 'en'); await select(s, { ante: 8 }); await s.away(); await s.settle(200); await s.shot('6b-ante8'); await s.hover('select:board:2'); await s.shot('6c-ante8-big'); await s.context.close(); }
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
