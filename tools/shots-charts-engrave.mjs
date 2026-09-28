// 기보가 보이는 곳 · 각인 덮어쓰기 확인 스크린샷(docs/tasks/backlog.md 5 · 6). 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-charts-engrave.mjs [--prefix before|after] [--lang ko|en] [--out docs/shots/charts-engrave]
// 찍는 것:
//   <prefix>-<lang>-1-hand-tiers   기보 단계가 다른 손(폰 1 · 나이트 2 · 비숍 3 · 룩 5)이 있는 대국
//   <prefix>-<lang>-2-chain-chart  기보가 붙은 모습으로 먹은 순간(값 · 배수가 튀는 때)
//   <prefix>-<lang>-3-chart-grow   상점에서 기보 두루마리를 써서 나이트가 한 단계 자라는 순간(2 → 3, 동 → 은)
//   <prefix>-<lang>-3b-chart-tick  단계가 그대로인 기보(3 → 4)
//   <prefix>-<lang>-4-engrave-over 금 각인이 있는 기물에 유리 각인을 고른 때(유리가 이미 있는 나이트는 흐리다)
//   <prefix>-<lang>-4b-soul-over   혼이 있는 기물에 다른 혼을 고른 때
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const LANG = opt('--lang', 'ko');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/charts-engrave'));

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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
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
  const base = path.join(OUT, `${PREFIX}-${LANG}-${name}`);
  fs.writeFileSync(`${base}.png`, Buffer.from(urls[0].split(',')[1], 'base64'));
  fs.writeFileSync(`${base}@3x.png`, Buffer.from(urls[1].split(',')[1], 'base64'));
  console.log('찍음', path.relative(ROOT, `${base}.png`));
}
async function clickId(id) {
  const r = await ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  if (!r) throw new Error(`no region ${id}`);
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + ((r.x + r.w / 2) * box.width) / 480, box.y + ((r.y + r.h / 2) * box.height) / 270);
  await page.mouse.down(); await page.mouse.up();
  await wait(40);
}
const away = () => page.mouse.move(1, 1);

await page.goto(`http://localhost:${srv.address().port}/index.html`);
await ev((lang) => {
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 1 }));
  localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
}, LANG);
await page.reload();
await until(() => window.__app && window.__app.screen);
await ev(async () => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords(); });

// ── 1 · 2: 기보가 붙은 대국. 사슬 둘 이상이 나오는 판을 찾는다
let plan = null;
for (let seed = 11; seed < 60 && !plan; seed++) {
  await ev((sd) => {
    const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: sd });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    Object.assign(r.charts, { P: 1, N: 2, B: 3, R: 5, Q: 4 });
    const e0 = a.cmd({ type: 'play' });
    const b = r.battle;
    // 손: 폰 · 나이트 · 비숍 · 룩(단계 1 · 1 · 2 · 3)
    const want = ['P', 'N', 'B', 'R'];
    b.hand = want.map((t, i) => ({ id: 900 + i, t, eng: null, edition: null }));
    // 조정자에 바뀐 기보 수준을 넣는다(대국을 연 뒤에 바꿨다)
    const spec = b.mods.find((m) => m.id === 'charts');
    if (spec) spec.data.levels = { ...r.charts };
    a.go('battle', { events: e0 });
  }, seed);
  await wait(2600);
  await until(() => !window.__app.screen.busy && !window.__app.screen.banner);
  const p = await ev(async () => { const { bestMove } = await import('/src/sim/solver.js'); const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' }); return d && { hand: d.handIndex, sq: d.sq, line: d.line }; });
  if (p && p.line.length >= 2 && p.line.every((x) => typeof x === 'number')) plan = p;
}
if (!plan) throw new Error('사슬 둘 이상인 판을 못 찾았다');
await away(); await wait(200);
await shot('1-hand-tiers');
await clickId(`hand:${plan.hand}`); await clickId(`sq:${plan.sq}`);
await until(() => !window.__app.screen.busy);
const v0 = await ev(() => window.__app.screen.view.chain.value);
await clickId(`sq:${plan.line[0]}`);
await until((v) => { const c = window.__app.screen.view.chain; return c && c.value !== v; }, v0);
await away();
await wait(140);
await shot('2-chain-chart');
await until(() => !window.__app.screen.busy);

// ── 3: 상점에서 기보 두루마리(나이트 2 → 3, 동 → 은) · 3b: 3 → 4(단계 그대로)
async function shopScene(setup) {
  await ev((src) => {
    const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 11 });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    r.phase = 'shop'; r.battle = null; r.money = 20;
    r.shop = { rng: null, display: [{ kind: 'maxim', id: 'chivalry', edition: null, price: 5 }, { kind: 'piece', t: 'N', price: 4 }], packs: [{ kind: 'engraving', price: 4 }, { kind: 'chart', price: 4 }], rerolls: 0, promoted: false, removed: false };
    r.deck.push({ id: 70, t: 'N', eng: null, edition: null }, { id: 71, t: 'N', eng: { id: 'gold' }, edition: null }, { id: 72, t: 'B', eng: { id: 'gold' }, edition: null, soul: 'echo' });
    new Function('r', src)(r);
    a.toasts = [];
    a.go('shop');
  }, setup);
  await wait(300);
}
await shopScene("r.charts.N = 2; r.consumables = [{ kind: 'chart', form: 'N' }];");
await clickId('cons:0'); await away(); await wait(260);
await shot('3-chart-grow');
await shopScene("r.charts.N = 3; r.consumables = [{ kind: 'chart', form: 'N' }];");
await clickId('cons:0'); await away(); await wait(260);
await shot('3b-chart-tick');

// ── 4: 금 각인이 있는 나이트(71)에 유리 각인 · 4b: 혼(메아리)이 있는 비숍(72)에 다른 혼
await shopScene("r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'transcend' }]; r.deck.find((p) => p.id === 70).eng = { id: 'glass' };");
await clickId('cons:0'); await clickId('deck:71'); await away(); await wait(200);
await shot('4-engrave-over');
await clickId('cons:1'); await clickId('deck:72'); await away(); await wait(200);
await shot('4b-soul-over');

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
