// CHM-68 뒤 전설 화면 고침 스크린샷: 격언을 많이 들고 전설을 완성한 장면. 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-fix-legend.mjs [--prefix after] [--out docs/shots/fix-legend] [--only 이름]
// 찍는 것(영어는 이름 앞에 en-):
//   legend-8      smoke가 만난 판: 격언 다섯 + 전설 셋을 들고 「세기의 대국」 완성(두 줄)
//   legend-max    칸이 끝까지 찬 판: 격언 칸 5 + 흑요 10 + 다른 전설 넷(19, 네 줄)
//   legend-tip    legend-max에서 아이콘만 남은 칸을 가리킨 말풍선
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/fix-legend'));
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
    a.saveRecords();
  });
}
// 판 시드 21에 격언을 쥐여 주고 「세기의 대국」 전설 화면으로. plain: 보통 격언 수, obsidian: 그중 흑요 판본 수, legends: 쥔 다른 전설
const LEGEND = (plain, obsidian, legends) => `localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.closeOverlay(); a.newRun({ seed: 21 }); const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  return import('/src/data/maxims.js').then(({ MAXIMS }) => {
    const pool = MAXIMS.filter((m) => m.rarity !== 'legendary');
    r.maxims = pool.slice(3, 3 + ${plain}).map((m, i) => ({ uid: r.nextUid++, id: m.id, data: {}, edition: i < ${obsidian} ? 'obsidian' : null, paid: 5 }));
    for (const id of ${JSON.stringify(legends)}) { r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 0, legendary: true }); r.legends.push(id); }
    r.maxims.push({ uid: r.nextUid++, id: 'century', data: {}, edition: null, paid: 0, legendary: true }); r.legends.push('century');
    a.toasts = []; a.flow([['legend', { legend: 'century' }]]);
  });`;
const HOVER = (id) => `const q = window.__app.ui.regions.find((g) => g.id === '${id}'); if (q) window.__app.pointer('move', q.x + Math.min(8, q.w / 2), q.y + Math.min(6, q.h / 2));`;
const MAX = LEGEND(15, 10, ['immortal', 'opera', 'evergreen', 'eight_pawns']);
const scenes = [
  ['legend-8', LEGEND(5, 0, ['evergreen', 'opera', 'immortal']), 9000, null],
  ['legend-max', MAX, 9000, null],
  ['legend-tip', MAX, 9000, HOVER('legend:maxim:6')],
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
