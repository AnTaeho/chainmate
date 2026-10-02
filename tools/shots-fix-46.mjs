// CHM-46 전후 스크린샷: 잘린 글 보류(CLIP_HELD)를 고친 곳. 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-fix-46.mjs [--prefix before|after] [--out docs/shots/fix-46] [--only 이름]
// 찍는 것(영어는 이름 앞에 en-):
//   codex-maxims · codex-pieces · codex-legends   도감 격자(모두 본 기록) — 칸 이름 두 줄
//   master-hunters · master-cavalry               마스터전 머리 칸(사냥꾼 두령 · 기병대장)
//   pack-engraving · pack-engraving3              각인 꾸러미 머리 칸 · 짜임 칸 「발판」(레퍼토리 둘 · 셋)
//   codex-legend-done · codex-legend-done2        다 모은 명경기 칸 말풍선(둘째 줄 · 첫 줄 왼쪽 칸)
//   lessons                                       수업 고르기
//   bignum-tip                                    대국 목표 1,000,000,000,000 말풍선
//   legend-tip                                    격언 칸 「세기의 대국」 말풍선(영어 Thirteen-year-old)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/fix-46'));
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
    // 도감: 모두 본 기록(격언 · 혼 · 세력 · 명경기 조각 · 판본)
    const { MAXIMS } = await import('/src/data/maxims.js');
    const { SOULS } = await import('/src/data/souls.js');
    const { FACTIONS } = await import('/src/data/factions.js');
    const { LEGENDS } = await import('/src/data/legends.js');
    const { EDITIONS } = await import('/src/data/editions.js');
    const c = a.records.codex;
    for (const m of MAXIMS) c.maxims[m.id] = true;
    c.souls = Object.fromEntries(SOULS.map((s) => [s.id, true]));
    c.factions = Object.fromEntries(FACTIONS.map((f) => [f.id, true]));
    for (const l of LEGENDS) c.legends[l.id] = 2;
    for (const e of EDITIONS) c.editions[e.id] = true;
    a.saveRecords();
  });
}
// 판 시드 21, 세력 f의 관 · 대국 차례 blind(2 = 마스터전)로 관 선택에 둔다
const RUN = (f, blind) => `localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.closeOverlay(); a.newRun({ seed: 21 }); const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.ante = r.factions.indexOf('${f}') + 1; r.blind = ${blind}; r.phase = 'select'; r.shop = null; r.draft = null; r.drafted = [1, 3, 5]; r.money = 12; a.toasts = [];`;
const BATTLE = `const e0 = a.cmd({ type: 'play' }); a.go('battle', { events: e0 });`;
const HOVER = (id) => `const q = window.__app.ui.regions.find((g) => g.id === '${id}'); if (q) window.__app.pointer('move', q.x + Math.min(8, q.w / 2), q.y + Math.min(6, q.h / 2));`;
const scenes = [
  ['codex-maxims', `const a = window.__app; a.closeOverlay(); a.run = null; a.go('codex'); a.screen.tab = 'maxims';`, 400, null],
  ['codex-pieces', `const a = window.__app; a.closeOverlay(); a.run = null; a.go('codex'); a.screen.tab = 'pieces';`, 400, null],
  ['codex-legends', `const a = window.__app; a.closeOverlay(); a.run = null; a.go('codex'); a.screen.tab = 'legends';`, 400, null],
  ['master-hunters', `${RUN('hunters', 2)} ${BATTLE}`, 2800, null],
  ['master-cavalry', `${RUN('cavalry', 2)} ${BATTLE}`, 2800, null],
  ['pack-engraving', `${RUN('peasants', 0)} r.josekis = ['stepping', ...(r.josekis || []).filter((j) => j !== 'stepping')].slice(0, 2);
    return import('/src/sim/shop.js').then(async (S) => { const { createRng, fork } = await import('/src/sim/rng.js');
      r.shop = { rng: fork(createRng(3), 'shot'), display: [], packs: [], rerolls: 0, promoted: false, removed: false, ante: r.ante, blind: r.blind };
      r.pack = { kind: 'engraving', options: S.rollPackOptions(r, 'engraving') }; r.phase = 'pack'; a.go('pack'); });`, 800, null],
  ['pack-engraving3', `${RUN('peasants', 0)} r.josekis = ['stepping', ...(r.josekis || []).filter((j) => j !== 'stepping'), 'rampart', 'highway'].filter((v, k, a) => a.indexOf(v) === k).slice(0, 3);
    return import('/src/sim/shop.js').then(async (S) => { const { createRng, fork } = await import('/src/sim/rng.js');
      r.shop = { rng: fork(createRng(3), 'shot'), display: [], packs: [], rerolls: 0, promoted: false, removed: false, ante: r.ante, blind: r.blind };
      r.pack = { kind: 'engraving', options: S.rollPackOptions(r, 'engraving') }; r.phase = 'pack'; a.go('pack'); });`, 800, null],
  ['codex-legend-done', `const a = window.__app; a.closeOverlay(); a.run = null; const c = a.records.codex; c.legendsDone = Object.fromEntries(Object.keys(c.legends).map((k) => [k, true])); a.go('codex'); a.screen.tab = 'legends';`, 400, HOVER('codex:evergreen')],
  ['codex-legend-done2', `const a = window.__app; a.closeOverlay(); a.run = null; a.go('codex'); a.screen.tab = 'legends';`, 400, HOVER('codex:immortal')],
  ['lessons', `const a = window.__app; a.closeOverlay(); a.run = null; a.go('lessons');`, 400, null],
  ['bignum-tip', `${RUN('peasants', 0)} ${BATTLE}`, 2800, `const s = window.__app.screen; s.b.target = 1e12; s.sync && s.sync(); ${HOVER('goal')}`],
  ['legend-tip', `${RUN('peasants', 0)} r.maxims.unshift({ id: 'century' }); ${BATTLE}`, 2800, `const q = window.__app.ui.regions.find((g) => /^maxim:/.test(g.id)); if (q) window.__app.pointer('move', q.x + 8, q.y + 6);`],
];
for (const lang of ['ko', 'en']) {
  await boot(lang);
  for (const [name, src, wait, after] of scenes) {
    const file = `${lang === 'en' ? 'en-' : ''}${name}`;
    if (ONLY && !file.includes(ONLY)) continue;
    await ev(() => window.__app.pointer('move', -10, -10));
    try { await ev(new Function(src)); } catch (e) { console.log('건너뜀', file, String(e).slice(0, 120)); continue; }
    await settle(wait);
    if (after) { await ev(new Function(after)); await settle(400); }
    await shot(file);
  }
}
console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
