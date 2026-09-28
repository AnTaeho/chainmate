// 판 위 사물 「문」 스크린샷(정석 「판의 문」). 1배(<이름>.png)와 3배(<이름>@3x.png).
//   node tools/shots-gate.mjs [--prefix before|after] [--out docs/shots/gate] [--patch 파일.js]
// 찍는 것:
//   <prefix>-1-gates   빈 문 하나 · 적이 선 문 하나. 곁에 벽 · 보석 · 금빛 발판 · 고속도로 줄 · 증원 그림자 · 판 위 표시(초록)
//   <prefix>-2-mine    사슬 중 내 기물이 문 위에 선 때(문으로 나온 순간)
//   <prefix>-3-news    대국 시작 띠의 「새로」 줄(처음 보는 판 위 사물: 발판 · 문 · 고속도로)
// --patch: 화면 모듈을 불러온 뒤 페이지에서 돌릴 스크립트(시안 비교용, 저장소 밖 파일)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/gate'));
const PATCH = opt('--patch', null);
const VARIANT = opt('--variant', null); // 시안 번호(패치가 window.__gateV로 읽는다)

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
await ev(() => {
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', speed: 1 }));
  localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
});
await page.reload();
await until(() => window.__app && window.__app.screen);
await ev(async () => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords(); });
if (PATCH) await ev(async (v) => { window.__gateV = Number(v); await import('/__patch.js'); }, VARIANT);

// 판: 문 e5(빈) · c3(적 나이트가 섰다). 곁에 벽 d5 · 보석 f4 · 발판 f5 · 고속도로 g줄 · 표시 d4 · 증원 그림자는 대국이 정한 대로
const SQ = (n) => (Number(n[1]) - 1) * 8 + (n.charCodeAt(0) - 97);
const setup = (sq) => {
  const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed: 21 });
  const r = a.run;
  if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  r.josekis = ['gates', 'stepping', 'highway'];
  const e0 = a.cmd({ type: 'play' });
  const b = r.battle;
  b.rules.gates = [sq.e5, sq.c3];
  b.rules.steps = [sq.f5, sq.b7, sq.h2];
  b.rules.highways = [6];
  for (const s of [sq.e5, sq.c3, sq.d5, sq.f4, sq.f5, sq.d4]) b.board[s] = null;
  b.board[sq.c3] = { t: 'N', id: 901, born: -1 };
  b.board[sq.d5] = { t: 'X', id: 902, born: -1 };
  b.board[sq.f4] = { t: 'J', id: 903, born: -1 };
  a.go('battle', { events: e0 });
  a.screen.marks.squares.add(sq.d4);
};
const SQS = { e5: SQ('e5'), c3: SQ('c3'), d5: SQ('d5'), f4: SQ('f4'), f5: SQ('f5'), b7: SQ('b7'), h2: SQ('h2'), d4: SQ('d4') };
// 처음 보는 사물은 대국 시작 띠에 「새로」로 뜬다: 먼저 띠를 찍고, 띠가 걷힌 판을 찍는다
await ev(setup, SQS);
await page.mouse.move(1, 1);
await wait(900);
await shot('3-news');
await wait(1700);
await until(() => !window.__app.screen.busy && !window.__app.screen.banner);
await page.mouse.move(1, 1);
await wait(200);
await shot('1-gates');

// 내 기물이 문 위에: 사슬 중인 화면 상태만 꾸민다(e5 문 위 비숍 · 길 표시)
await ev((sq) => {
  const s = window.__app.screen, v = s.view;
  v.board[sq.e5] = { t: 'B', mine: true };
  v.chain = { sq: sq.e5, form: 'B', path: [sq.c3 - 2, sq.e5], forms: ['B'], steps: ['B'], value: 30, mult: 1, captures: [], shots: [] };
  s.busy = true;
}, { e5: SQ('e5'), c3: SQ('c3') });
await wait(200);
await shot('2-mine');

console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
