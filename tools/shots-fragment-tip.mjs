// 명국 조각 말풍선(CHM-15: 「■ 첫 조각 □ 재현 □ 금빛」이 한 줄에 몰려 접히던 것) 전후 스크린샷. 1배와 3배(@3x).
//   node tools/shots-fragment-tip.mjs [--prefix before|after] [--out docs/shots/fragment-tip] [--only 이름]
// 찍는 것(영어는 이름 앞에 en-):
//   battle-opera    대국 왼쪽 칸 상금 줄의 오페라 대국 조각(첫 조각만 — 다음은 재현)
//   battle-century  세기의 대국 조각(첫 · 재현 — 다음은 금빛)
//   shop-card       상점 진열의 명국 조각 카드
//   pack-cell       금빛 꾸러미의 명국 조각 칸
//   codex           도감 명국 탭(불멸의 대국 — 완성)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/fragment-tip'));
const ONLY = opt('--only', null);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(HERE, u === '/' ? 'index.html' : u);
  if (!p.startsWith(HERE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
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
await page.addInitScript(() => { let a = 12345; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; });
await page.clock.install({ time: 0 });
await page.clock.pauseAt(1000);
const settle = (ms) => page.clock.runFor(ms);

const overflow = [];
async function shot(name) {
  for (const q of await ev(async () => (await import('/src/render/layoutlog.js')).checkLayout())) overflow.push(`${name}: ${q.msg}`);
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
  console.log('찍음', path.relative(HERE, `${base}.png`));
}

async function boot(lang) {
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await ev((lang) => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 2 }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
  }, lang);
  await page.reload();
  for (let i = 0; i < 200 && !(await ev(() => !!(window.__app && window.__app.screen))); i++) await settle(50);
  await ev(async () => {
    const a = window.__app;
    const { HINTS } = await import('/src/ui/coach.js');
    a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true]));
    a.saveRecords();
    (await import('/src/render/layoutlog.js')).LOG.on = true;
    window.__fill = (r) => {
      r.maxims = [];
      for (const [id, ed] of [['chivalry'], ['quick_change', 'foil'], ['first_move'], ['whim', 'rainbow'], ['sacrifice']]) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: ed || null, paid: 5 });
      r.josekis = ['gates', 'stepping'];
      r.deck.push({ id: 80, t: 'O', eng: null }, { id: 81, t: 'S', eng: null, soul: 'echo' }, { id: 82, t: 'L', eng: { id: 'glass' } });
      r.money = 23;
    };
  });
}
const hintOn = (ids) => ev(async (ids) => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); for (const id of ids) delete a.records.coachSeen[id]; }, ids);
const regions = () => ev(() => window.__app.ui.regions.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, tip: !!r.tip, keys: !!r.keys })));
async function moveTo(gx, gy) {
  const b = await page.locator('#screen').boundingBox();
  await page.mouse.move(b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270);
}
// 앞머리(또는 정확한 id)가 맞는 첫 구역을 가리킨다. test가 있으면 그 구역만
async function hover(prefix, test = null) {
  const r = (await regions()).find((q) => (q.id === prefix || q.id.startsWith(prefix)) && (q.tip || q.keys) && (!test || test(q)));
  if (!r) return false;
  await moveTo(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  await settle(120);
  return true;
}

const fresh = (seed, extra = '') => `localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.closeOverlay(); a.nextSeed = ${seed}; a.newRun(); const r = a.run; ${extra}`;
const frags = "r.fragments.opera = { first: true, feat: false, gold: false }; r.fragments.century = { first: true, feat: true, gold: false };";
const battleSrc = fresh(11, `if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); ${frags} r.ante = 5; r.blind = 0; a.cmd({ type: 'play' }); a.go('battle', { events: [] });`);
const shopSrc = fresh(11, `if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); ${frags} r.phase = 'shop'; r.shop = { display: [{ kind: 'fragment', legend: 'immortal', price: 4, sold: false }, { kind: 'piece', t: 'T', price: 6, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false }; a.goPhase();`);
const packSrc = fresh(11, `if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); r.phase = 'pack'; r.pack = { kind: 'golden', options: [{ kind: 'maxim', id: 'reinforce_hunt', edition: 'foil' }, { kind: 'maxim', id: 'light_step' }, { kind: 'maxim', id: 'first_move', edition: 'pearl' }, { kind: 'fragment', legend: 'eight_pawns' }] }; a.goPhase();`);
const codexSrc = "const a = window.__app; a.closeOverlay(); a.records.codex.legends = { immortal: 3, century: 1, opera: 1 }; a.records.codex.legendsDone = { immortal: true }; a.go('codex'); a.screen.tab = 'legends';";
const shopRng = async () => { await ev(async () => { const r = window.__app.run; if (r && r.shop && !r.shop.rng) { const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'tip'); } }); };
const scenes = [
  ['battle-opera', battleSrc, 2800, () => hover('frag:opera')],
  ['battle-century', battleSrc, 2800, () => hover('frag:century')],
  ['shop-card', shopSrc, 600, () => hover('shop:buy:0')],
  ['pack-cell', packSrc, 2000, () => hover('pack:pick:3')],
  ['codex', codexSrc, 400, () => hover('codex:century')],
  ['codex-done', codexSrc, 400, () => hover('codex:immortal')],
];
for (const lang of ['ko', 'en']) {
  await boot(lang);
  for (const [name, src, wait, act, hints] of scenes) {
    const file = `${lang === 'en' ? 'en-' : ''}${name}`;
    if (ONLY && !file.includes(ONLY)) continue;
    await moveTo(-1, -1);
    await hintOn(hints || []);
    try { await ev(new Function(src)); } catch (e) { console.log('건너뜀', file, String(e).slice(0, 120)); continue; }
    await shopRng();
    await settle(wait);
    if (act && !(await act())) { console.log('건너뜀', file, '가리킬 구역 없음', (await regions()).map((q) => q.id).join(' ')); continue; }
    await settle(150);
    await shot(file);
  }
}
console.log(`글 넘침 ${overflow.length}${overflow.length ? '\n  ' + overflow.join('\n  ') : ''}`);
console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
