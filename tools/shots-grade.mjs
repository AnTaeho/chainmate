// CHM-47 스크린샷: 사슬 평가 별 셋(★ 하양 · ★★ 금 · ★★★ 빨강 — 판 오른쪽 위 도장) · 탁월수 뒤 명경기 조각 알림 ·
// 기록 화면(옛 「!!!」 기록을 별로 옮긴 신의 한 수, 영어도)을 1배 · 3배로 찍는다.
// CHM-48: 하양 ★ 빛 번짐이 가장 밝은 순간(1-star1-peak) · 재현 조각 알림(6-feat-fragment — 대국 화면에서 뜨는지)을 더했다.
//   node tools/shots-grade.mjs [--out docs/shots/grade] [--scale 1,3]
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/grade'));
const SCALES = opt('--scale', '1,3').split(',').map(Number);

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
const port = srv.address().port;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

async function session(sc, lang = 'ko') {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  // 화면 멈추기(window.__hold): 정한 순간(별 도장이 찍힌 지 0.3초 · 조각 알림이 뜬 지 0.15초)에 그리기를 멈춰 그 장면을 찍는다
  await page.addInitScript((lang) => {
    localStorage.clear();
    if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang }));
    window.__hold = false;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => (window.__hold ? window.requestAnimationFrame(cb) : cb(t)));
  }, lang);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const settle = (ms) => page.waitForTimeout(ms);
  const tag = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
  async function shot(name) {
    const box = await page.locator('#screen').boundingBox();
    await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: box });
    console.log('찍음', `${name}${tag}`);
  }
  async function region(id) { return ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id); }
  async function toXY(gx, gy) { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; }
  async function click(id) {
    const r = await region(id);
    if (!r) throw new Error(`no region ${id}`);
    const [x, y] = await toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 16));
    await page.mouse.move(x, y); await settle(60);
    await page.mouse.down(); await page.mouse.up(); await settle(30);
  }
  const away = async () => { const [x, y] = await toXY(300, 266); await page.mouse.move(x, y); };
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !((s.name === 'battle' || s.name === 'lesson') && s.busy); }, null, { timeout: 30000, polling: 100 });
  return { page, context, ev, settle, shot, click, away, idle };
}

// 1관 대국 판을 연다(희생 시안과 같은 판: h7 킹 · 손 폰 · 나이트 · 폰 · 비숍 · 주머니 맨 앞 나이트)
async function battle(s) {
  const { ev, settle } = s;
  await settle(300);
  await ev(() => {
    const a = window.__app;
    a.settings.coach = false;
    a.nextSeed = 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    a.cmd({ type: 'play' }); a.go('battle', { events: [] });
    const b = a.run.battle;
    const sq = (n) => (Number(n[1]) - 1) * 8 + 'abcdefgh'.indexOf(n[0]);
    b.board = Array(64).fill(null);
    for (const [n, t] of Object.entries({ h7: 'K', c7: 'B', d7: 'P', g6: 'P', d5: 'P', e5: 'P', e4: 'P', e3: 'N' })) b.board[sq(n)] = { t, id: 700 + sq(n) };
    b.incoming = []; b.incomingNext = [];
    b.hand = ['P', 'N', 'P', 'B'].map((t, i) => ({ t, id: 900 + i, eng: null }));
    b.bag = [{ t: 'N', id: 950, eng: null }, ...b.bag];
    b.target = 150;
    a.screen.banner = null;
    a.screen.sync();
  });
  await settle(200);
}

for (const sc of SCALES) {
  // 1~3 사슬 평가 별: 실제 도장(gradeStamp — 같은 자리 · 흔들림 · 소리 · 테두리 불빛)을 찍고 0.3초에 멈춘다
  for (const [i, mark] of [[1, '★'], [2, '★★'], [3, '★★★']]) {
    const s = await session(sc);
    await battle(s);
    await s.away();
    await s.ev((mark) => {
      const a = window.__app, f = a.frame.bind(a);
      a.frame = (t) => { f(t); if (a.screen.stamp && a.screen.stamp.t >= 0.3) window.__hold = true; };
      a.screen.gradeStamp({ type: 'grade', mark });
    }, mark);
    await s.page.waitForFunction(() => window.__hold, null, { timeout: 15000, polling: 50 });
    await s.shot(`${i}-star${i}`);
    await s.context.close();
  }
  // 1-peak 하양 ★: 빛 번짐이 가장 밝은 순간(찍힌 지 0.05초 — 도장이 크게 찍히는 0.15초 안, CHM-48)
  {
    const s = await session(sc);
    await battle(s);
    await s.away();
    await s.ev(() => {
      const a = window.__app, f = a.frame.bind(a);
      a.frame = (t) => { f(t); if (a.screen.stamp && a.screen.stamp.t >= 0.05) window.__hold = true; };
      a.screen.gradeStamp({ type: 'grade', mark: '★' });
    });
    await s.page.waitForFunction(() => window.__hold, null, { timeout: 15000, polling: 50 });
    await s.shot('1-star1-peak');
    await s.context.close();
  }
  // 4 탁월수 뒤 조각: 비숍을 바치고 새로 뽑은 나이트로 메이트 줄을 끝까지 둔다 → 「!!」 다음 조각 얻음 알림이 뜬 지 0.15초(조각이 왼쪽 칸으로 나는 중)에 멈춘다
  // 6 재현 조각(CHM-48): 같은 수를 오페라 대국 첫 조각을 가진 채 둔다(대국 첫 수 체크메이트 = 재현) → 「재현 조각」 알림이 뜬 지 0.15초
  for (const [name, part, have] of [['4-brilliant-fragment', '첫 조각', null], ['6-feat-fragment', '재현 조각', 'opera']]) {
    const s = await session(sc);
    await battle(s);
    if (have) await s.ev((id) => { window.__app.run.fragments[id] = { first: true, feat: false, gold: false }; }, have);
    await s.click('hand:3'); await s.click('btn:discard'); await s.idle(); await s.away(); await s.settle(300);
    const plan = await s.ev(async () => {
      const { bestMove } = await import('/src/sim/solver.js');
      const b = window.__app.run.battle, i = b.hand.findIndex((p) => p.id === 950);
      const d = bestMove(b, { handIndices: [i], preferMate: true });
      return { hand: i, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)), mate: !!d.mate };
    });
    if (!plan.mate) throw new Error('탁월수 장면: 새로 뽑은 나이트의 메이트 줄이 없다');
    await s.ev((part) => {
      const a = window.__app, f = a.frame.bind(a);
      a.frame = (t) => { f(t); if (a.toasts.some((x) => x.msg.endsWith(part) && x.t >= 0.15)) window.__hold = true; };
    }, part);
    await s.click(`hand:${plan.hand}`); await s.click(`sq:${plan.sq}`); await s.idle();
    for (const sq of plan.line) {
      await s.click(`sq:${sq}`);
      await s.page.waitForFunction(() => window.__hold || !window.__app.screen.busy, null, { timeout: 30000, polling: 100 });
      if (await s.ev(() => window.__hold)) break;
    }
    await s.page.waitForFunction(() => window.__hold, null, { timeout: 15000, polling: 100 });
    const got = await s.ev(() => Object.entries(window.__app.run.fragments).filter(([, f]) => f.first).map(([k]) => k));
    console.log(name, '조각', got, '화면', await s.ev(() => window.__app.screen.name));
    await s.shot(name);
    await s.context.close();
  }
  // 5 기록 화면: 신의 한 수(★★★) · 탁월수 !! — 옛 기록(「!!!」 열쇠)을 불러와 별로 옮긴 것을 보인다
  for (const lang of ['ko', 'en']) {
    const s = await session(sc, lang);
    await s.settle(300);
    await s.ev(async () => {
      const { loadRecords } = await import('/src/ui/records.js');
      const a = window.__app;
      const old = { ...a.records, runs: 14, wins: 5, bestAnte: 8, mates: 9, legends: 1, brilliants: 3, grades: { '!': 30, '!!': 12, '!!!': 2 } };
      a.records = loadRecords({ get: () => JSON.parse(JSON.stringify(old)) });
      a.go('records');
    });
    await s.settle(400); await s.shot('5-records'); await s.context.close();
  }
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
