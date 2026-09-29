// 세력 스크린샷: 세력마다 관 선택 · 대국 첫 화면. 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-factions.mjs [--prefix after] [--out docs/shots/factions] [--lang ko|en] [--factions id,id|all] [--variant n] [--extra]
// 찍는 것(세력마다): <prefix>-<세력>-select(그 세력의 관 · 연습 대국 앞) · <prefix>-<세력>-battle(연습 대국 첫 수 전)
//   --extra: 명인 대국 첫 화면(<prefix>-<세력>-master) · 도감 세력 탭(<prefix>-codex) · 처음 안내(<prefix>-hint)
// 관: 농민군 1관 · 왕궁 근위 8관 · 나머지는 2~7관 중 판의 차례대로. --variant: 시안 번호(화면이 window.__fv로 읽는다 — 고른 뒤에는 쓰지 않는다)
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
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/factions'));
const VARIANT = opt('--variant', null);
const EXTRA = args.includes('--extra');
const ALL = ['peasants', 'cavalry', 'abbey', 'fortress', 'hunters', 'heralds', 'mercs', 'royal'];
const FS = opt('--factions', 'all') === 'all' ? ALL : opt('--factions').split(',');
const TAG = LANG === 'en' ? 'en-' : '';

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
page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
fs.mkdirSync(OUT, { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn, arg, o = {}) => page.waitForFunction(fn, arg, { timeout: 20000, ...o });
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
  const base = path.join(OUT, `${PREFIX}-${TAG}${name}`);
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
const seeAll = () => ev(async () => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords(); });
await seeAll();
if (VARIANT) await ev((v) => { window.__fv = Number(v); }, VARIANT);

// 세력 f의 관(1 · 8 고정, 나머지는 그 판에서 f가 선 관)으로 판을 옮긴다. 판 시드 21, 정석은 첫째
const setup = (f, blind) => ev(([f, blind]) => {
  const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 21 });
  const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const ante = r.factions.indexOf(f) + 1;
  r.ante = ante; r.blind = blind; r.phase = 'select'; r.shop = null; r.draft = null; r.drafted = [1, 3, 5];
  r.money = 12;
  a.toasts = [];
}, [f, blind]);

// 문장 여덟: 1배 · 2배 한 줄씩(짙은 판넬 위) — <prefix>-crests.png(1배) · @3x
{
  const urls = await ev(async (ALL) => {
    const { drawCrest } = await import('/src/render/crests.js');
    const c = document.createElement('canvas'); c.width = 8 * 30 + 8; c.height = 12 + 24 + 20;
    const g = c.getContext('2d');
    g.fillStyle = '#1c2a26'; g.fillRect(0, 0, c.width, c.height);
    ALL.forEach((id, i) => { drawCrest(g, id, 8 + i * 30, 4); drawCrest(g, id, 4 + i * 30, 22, { scale: 2 }); });
    const big = document.createElement('canvas'); big.width = c.width * 3; big.height = c.height * 3;
    const b = big.getContext('2d'); b.imageSmoothingEnabled = false; b.drawImage(c, 0, 0, big.width, big.height);
    return [c.toDataURL('image/png'), big.toDataURL('image/png')];
  }, ALL);
  const base = path.join(OUT, `${PREFIX}-crests`);
  fs.writeFileSync(`${base}.png`, Buffer.from(urls[0].split(',')[1], 'base64'));
  fs.writeFileSync(`${base}@3x.png`, Buffer.from(urls[1].split(',')[1], 'base64'));
  console.log('찍음', path.relative(ROOT, `${base}.png`));
}

for (const f of FS) {
  await setup(f, 0);
  await ev(() => window.__app.goPhase());
  await page.mouse.move(1, 1);
  await wait(700);
  await shot(`${f}-select`);
  await ev(() => { const a = window.__app; const e0 = a.cmd({ type: 'play' }); a.go('battle', { events: e0 }); });
  await page.mouse.move(1, 1);
  await wait(900);
  await until(() => !window.__app.screen.busy && !window.__app.screen.banner, null).catch(() => null);
  await wait(300);
  await shot(`${f}-battle`);
  if (EXTRA) {
    await setup(f, 2);
    await ev(() => { const a = window.__app; const e0 = a.cmd({ type: 'play' }); a.go('battle', { events: e0 }); });
    await page.mouse.move(1, 1);
    await wait(900);
    await until(() => !window.__app.screen.busy && !window.__app.screen.banner, null).catch(() => null);
    await wait(300);
    await shot(`${f}-master`);
  }
}
if (EXTRA) {
  // 처음 안내: 새 세력을 처음 만나는 관 선택
  await ev(() => { const a = window.__app; a.records.coachSeen = {}; a.saveRecords(); });
  await setup(FS[1] || FS[0], 0);
  await ev(() => window.__app.goPhase());
  await page.mouse.move(1, 1);
  await wait(900);
  await shot('hint');
  await seeAll();
  // 도감 세력 탭: 셋을 만났다
  await ev(() => { const a = window.__app; a.closeOverlay(); a.run = null; const c = a.records.codex; c.factions = { peasants: true, cavalry: true, fortress: true }; a.go('codex'); a.screen.tab = 'factions'; });
  await page.mouse.move(1, 1);
  await wait(500);
  await shot('codex');
  const hover = await ev(() => { const r = window.__app.ui.regions.find((q) => q.id === 'codex:cavalry'); return r ? [r.x + 4, r.y + 4] : null; });
  if (hover) { await page.mouse.move(hover[0], hover[1]); await wait(400); await shot('codex-tip'); }
}

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
