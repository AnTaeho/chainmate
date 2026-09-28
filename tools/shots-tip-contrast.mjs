// 설명 묶음이 뒤 판넬과 섞이던 것(CHM-14) 전후 스크린샷. 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-tip-contrast.mjs [--prefix before|after] [--out docs/shots/tip-contrast] [--only 이름]
// 찍는 것(영어는 이름 앞에 en-). 모두 판 틀(설명 자리 = 왼쪽 칸)이라 묶음이 왼쪽 칸 판넬 위에 뜬다:
//   shop-fam      상점 왼쪽 칸 시너지 줄(사냥)을 가리킨 모습 — 사람이 보낸 장면
//   shop-card     상점 진열 카드(말풍선 + 낱말 상자)
//   select-fam    관 선택 왼쪽 칸 시너지 줄
//   battle-box    대국 왼쪽 칸 사슬 상자(말풍선이 그 바로 아래)
//   battle-more   대국 오른쪽 시너지 띠의 「+N」 말풍선
//   battle-sq     대국 판 윗줄 칸(기물 말풍선)
//   pack-card     꾸러미 카드(말풍선 + 낱말 상자)
//   hint-family   처음 안내(시너지)
// 시안(cand1~3-shop-card)은 고르던 때 한 번 찍은 것: 1 상아 낱말 상자 + 받침(정함) · 2 짙은 상아 · 3 어두운 바탕 + 밝은 테
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/tip-contrast'));
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
const stock = "r.shop = { display: [{ kind: 'maxim', id: 'reinforce_hunt', price: 5, sold: false }, { kind: 'piece', t: 'C', price: 6, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };";
const shopSrc = (extra = '') => fresh(11, `if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); r.phase = 'shop'; ${stock} ${extra} a.goPhase();`);
const selectSrc = fresh(7, "if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); a.goPhase();");
const battleSrc = fresh(11, "if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); window.__fill(r); r.ante = 5; r.blind = 0; a.cmd({ type: 'play' }); a.go('battle', { events: [] });");
const packSrc = shopSrc("r.phase = 'pack'; r.pack = { kind: 'golden', options: [{ kind: 'maxim', id: 'reinforce_hunt', edition: 'foil' }, { kind: 'maxim', id: 'light_step' }, { kind: 'fragment', legend: 'immortal' }] };");
const shopRng = async () => { await ev(async () => { const r = window.__app.run; if (r.shop && !r.shop.rng) { const { createRng, fork } = await import('/src/sim/rng.js'); r.shop.rng = fork(createRng(3), 'tip'); } }); };

const scenes = [
  ['shop-fam', shopSrc(), 600, () => hover('fam:hunt').then((ok) => ok || hover('fam:'))],
  ['shop-card', shopSrc(), 600, () => hover('shop:buy:0')],
  ['select-fam', selectSrc, 800, () => hover('fam:')],
  ['battle-box', battleSrc, 2800, () => hover('box:links')],
  ['battle-more', battleSrc, 2800, () => hover('fam:more').then((ok) => ok || hover('fam:', (q) => q.x > 300))],
  ['battle-sq', battleSrc, 2800, async () => { for (const q of await regions()) if (q.id.startsWith('sq:') && q.tip && q.y < 80) { await moveTo(q.x + 10, q.y + 10); await settle(120); return true; } return false; }],
  ['pack-card', packSrc, 1800, () => hover('pack:pick:0')],
  ['hint-family', shopSrc(), 800, null, ['family']],
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
