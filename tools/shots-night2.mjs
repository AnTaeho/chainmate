// 밤샘 2 스크린샷: 시계 · 다시 놓기 · 새 판 위 사물(함정 · 강 · 횃불). 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-night2.mjs [--prefix after] [--out docs/shots/night2] [--lang ko|en] [--variant n]
// 찍는 것:
//   <prefix>-1-battle   첫 수 전 대국(시계 · 다시 놓기 단추 · 함정 · 강 · 횃불 적)
//   <prefix>-2-lost     진 대국 뒤 시계 한 칸을 잃는 순간
//   <prefix>-3-select   관 선택(시계)
//   <prefix>-4-shop     상점: 새 격언 · 새 혼 · 새 각인 기물(역습 · 매복 시너지 칩)
//   <prefix>-5-pack     각인 꾸러미: 새 각인 셋 · <prefix>-6-pack 나머지 셋
//   <prefix>-7-draft    정석 고르기: 새 정석 셋
// --variant: 시안 번호(화면이 window.__n2v로 읽는다 — 시안을 고른 뒤에는 쓰지 않는다)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/night2'));
const LANG = opt('--lang', 'ko');
const PATCH = opt('--patch', null);
const VARIANT = opt('--variant', null);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__patch.js' && PATCH) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(fs.readFileSync(PATCH)); return; }
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
fs.mkdirSync(OUT, { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 20000 });
const wait = (ms) => page.waitForTimeout(ms);

async function shot(name) {
  const urls = await ev(() => {
    const c = document.getElementById('screen');
    const big = document.createElement('canvas');
    big.width = c.width * 3; big.height = c.height * 3;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(c, 0, 0, big.width, big.height);
    return [c.toDataURL('image/png'), big.toDataURL('image/png')];
  });
  const base = path.join(OUT, `${PREFIX}-${name}`);
  fs.writeFileSync(`${base}.png`, Buffer.from(urls[0].split(',')[1], 'base64'));
  fs.writeFileSync(`${base}@3x.png`, Buffer.from(urls[1].split(',')[1], 'base64'));
  console.log('찍음', path.relative(ROOT, `${base}.png`));
}

await page.goto(`http://localhost:${srv.address().port}/index.html`);
await ev((LANG) => {
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: LANG, speed: 1 }));
  localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
}, LANG);
await page.reload();
await until(() => window.__app && window.__app.screen);
await ev(async () => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords(); });
if (VARIANT) await ev((v) => { window.__n2v = Number(v); }, VARIANT);
if (PATCH) await ev(async () => { await import('/__patch.js'); });


const SQ = (n) => (Number(n[1]) - 1) * 8 + (n.charCodeAt(0) - 97);
// 대국: 판 시드 21, 정석 함정 · 강 · 횃불을 쥐고 첫 수 전. 시계는 셋 중 하나를 잃은 채(2/3)
await ev(() => {
  const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 21 });
  const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.josekis = ['trap', 'river', 'torch'];
  r.clock = 2;
  const e0 = a.cmd({ type: 'play' });
  a.go('battle', { events: e0 });
});
await page.mouse.move(1, 1);
await wait(900);
await until(() => !window.__app.screen.busy && !window.__app.screen.banner, null);
await wait(300);
await shot('1-battle');
// 진 대국: 수를 하나 남기고 목표를 멀리 둔 채 봇 한 수 → 시계를 잃는 순간
await ev(async () => {
  const a = window.__app, b = a.run.battle;
  b.movesLeft = 1; b.target = 1e9;
  const { bestMove, lineCommands } = await import('/src/sim/solver.js');
  const m = bestMove(b);
  a.screen.fast = true;
  const s = a.screen;
  s.clickSq && null;
  const ev = [];
  ev.push(...a.cmd({ type: 'drop', handIndex: m.handIndex, sq: m.sq }));
  for (const c of lineCommands(m.line)) ev.push(...a.cmd(c));
  s.play && s.play(ev);
});
await wait(2500);
await shot('2-lost');
await wait(2500);
await shot('3-select');

// 상점 · 꾸러미 · 정석: 새것
async function runScene(src) {
  await ev((src) => {
    const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 11 });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    r.battle = null; r.money = 20;
    r.maxims = ['reversal', 'kings_step', 'ambusher', 'lucky_coin', 'checkerboard'].map((id, i) => ({ uid: 50 + i, id, data: {}, edition: null, paid: 4 }));
    r.deck.push({ id: 70, t: 'N', eng: { id: 'bronze' }, edition: null }, { id: 71, t: 'B', eng: { id: 'jade' }, edition: null, soul: 'relay' }, { id: 72, t: 'R', eng: { id: 'marble' }, edition: null, soul: 'ripple' }, { id: 73, t: 'P', eng: { id: 'coral' }, edition: null });
    a.toasts = [];
    new Function('r', 'a', src)(r, a);
  }, src);
  await wait(1800);
  await page.mouse.move(1, 1);
  await wait(100);
}
await runScene("r.phase = 'shop'; r.shop = { rng: null, display: [{ kind: 'maxim', id: 'cavalry_charge', edition: null, price: 4 }, { kind: 'soul', id: 'reaper', price: 4 }], packs: [{ kind: 'engraving', price: 4 }, { kind: 'chart', price: 4 }], rerolls: 0, promoted: false, removed: false }; a.go('shop');");
await shot('4-shop');
await runScene("r.phase = 'pack'; r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; r.pack = { kind: 'engraving', options: [{ kind: 'engraving', id: 'bronze' }, { kind: 'engraving', id: 'amber' }, { kind: 'engraving', id: 'jade' }] }; a.go('pack');");
await shot('5-pack');
await runScene("r.phase = 'pack'; r.shop = { rng: null, display: [], packs: [], rerolls: 0, promoted: false, removed: false }; r.pack = { kind: 'engraving', options: [{ kind: 'engraving', id: 'iron' }, { kind: 'engraving', id: 'coral' }, { kind: 'engraving', id: 'marble' }] }; a.go('pack');");
await shot('6-pack');
await runScene("r.phase = 'draft'; r.draft = { ante: 3, options: ['trap', 'torch', 'first_mover'] }; a.go('draft');");
await shot('7-draft');

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
