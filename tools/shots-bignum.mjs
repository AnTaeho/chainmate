// 큰 수 전후 스크린샷(CHM-10: 끝없는 대국 9관의 13자리 곱이 값 × 배수 칸을 넘던 것). 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-bignum.mjs [--prefix before|after] [--out docs/shots/bignum] [--only 이름]
// 찍는 것(영어는 이름 앞에 en-):
//   battle-burst   값 × 배수 칸이 터지며 곱(13자리)을 보이는 순간 — smoke seed 3이 걸린 장면
//   battle-head    머리 칸 목표 · 점수 16자리 · 흘러가는 수
//   select         관 선택 카드의 15자리 목표(33관)
//   result         결과 상자의 마지막 대국 · 모자란 점수 · 최고 한 수(15자리)
//   records        기록의 최고 한 수(15자리)
//   reward         보상 상자의 점수 줄(15자리)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(HERE, opt('--out', 'docs/shots/bignum'));
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
// 끝없는 대국 판 하나(관 ANTE)
const RUN = (ante) => `localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.closeOverlay(); a.nextSeed = 11; a.newRun(); const r = a.run; if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.endless = true; r.ante = ${ante}; r.blind = 0;`;
const BATTLE = `a.cmd({ type: 'play' }); a.go('battle', { events: [] });`;
// 대국을 세운 뒤 보이는 수를 바꾼다(sync가 다시 읽지 않게 연출이 없는 때)
const scenes = [
  ['battle-burst', `${RUN(29)} ${BATTLE}`, 2800, `const v = window.__app.screen.view; v.score = 6184890789926; v.target = 1300000000000; v.gather = { p: 1, value: 1234567, mult: 1392871, score: 1719572936961, burst: true };`],
  ['battle-head', `${RUN(36)} ${BATTLE}`, 2800, `const v = window.__app.screen.view; v.score = 9876543210987654; v.target = 999999999999999; v.count = { from: 0, to: 999999999999999, p: 0.3 };`],
  ['select', `${RUN(33)} r.phase = 'select'; a.goPhase();`, 800, null],
  ['result', `${RUN(36)} r.log.push({ ante: 36, blind: 0, kind: 'practice', score: 333333333333333, target: 999999999999999, best: 444444444444444 });
    r.bestReplay = { board: Array(64).fill(null), drop: { sq: 27, piece: 'N' }, caps: [{ from: 27, to: 44, form: 'N', after: 'B' }], score: 444444444444444, reason: 'end' }; r.phase = 'lost'; a.go('result');`, 800, null],
  ['records', `const a = window.__app; a.records.bestMove = { score: 999999999999999, steps: ['P', 'N', 'B', 'R', 'Q', 'N', 'B', 'R', 'Q'], ante: 36 }; a.go('records');`, 400, null],
  ['reward', `${RUN(36)} r.last = { score: 999999999999999, target: 620000000000000, overflow: 1, reason: 'score' }; a.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 0, overflow: 1, earned: 1, total: 7 }, events: [] });`, 2200, null],
];
for (const lang of ['ko', 'en']) {
  await boot(lang);
  for (const [name, src, wait, after] of scenes) {
    const file = `${lang === 'en' ? 'en-' : ''}${name}`;
    if (ONLY && !file.includes(ONLY)) continue;
    await ev(() => window.__app.pointer('move', -10, -10));
    try { await ev(new Function(src)); } catch (e) { console.log('건너뜀', file, String(e).slice(0, 80)); continue; }
    await settle(wait);
    if (after) { await ev(new Function(after)); await settle(50); }
    await shot(file);
  }
}
console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
