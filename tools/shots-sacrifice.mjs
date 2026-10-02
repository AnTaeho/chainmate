// 희생 2부(CHM-43) 스크린샷: 바친 직후(!? · 바친 기물 줄) · 처음 안내 · 기보 표가 있는 카드(!? 왼쪽 위) + 「+N」 ·
// 탁월수 순간(!! · 빛살 · 배수 칸 ×N) · 움직임 줄이기 · 기록 화면 · 수업 ⑥ · 영어 손 줄(「Sacrifice」 단추)을 1배 · 3배로 찍는다.
//   node tools/shots-sacrifice.mjs [--out docs/shots/sacrifice] [--scale 1,3]
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/sacrifice'));
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
  // 화면 멈추기(window.__hold): 정한 순간(탁월수 「!!」가 뜬 지 0.3초)에 그리기를 멈춰 그 장면을 찍는다
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

// 1관 대국: 시안 A1과 같은 손(폰 · 나이트 · 폰 · 비숍) · 주머니 맨 앞 나이트 · h7 킹. 비숍을 바친다
async function sacrificed(s, { coach = false, chart = 0, offered = [], calm = false } = {}) {
  const { ev, settle, click, away, idle } = s;
  await settle(300);
  await ev(({ coach, chart, offered, calm }) => {
    const a = window.__app;
    a.settings.coach = coach; a.settings.calm = calm;
    if (coach) a.records.coachSeen = Object.fromEntries(['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden'].map((k) => [k, true]));
    a.nextSeed = 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    a.run.charts.N = chart;
    a.cmd({ type: 'play' }); a.go('battle', { events: [] });
    const b = a.run.battle;
    const sq = (n) => (Number(n[1]) - 1) * 8 + 'abcdefgh'.indexOf(n[0]);
    b.board = Array(64).fill(null);
    for (const [n, t] of Object.entries({ h7: 'K', c7: 'B', d7: 'P', g6: 'P', d5: 'P', e5: 'P', e4: 'P', e3: 'N' })) b.board[sq(n)] = { t, id: 700 + sq(n) };
    b.incoming = []; b.incomingNext = [];
    b.hand = ['P', 'N', 'P', 'B'].map((t, i) => ({ t, id: 900 + i, eng: null }));
    b.bag = [{ t: 'N', id: 950, eng: null }, ...b.bag];
    b.offered = offered.map((t, i) => ({ t, id: 980 + i, eng: null }));
    b.discardsLeft = Math.max(1, b.rules.discards - offered.length);
    b.target = 150;
    a.screen.banner = null;
    a.screen.sync();
  }, { coach, chart, offered, calm });
  await settle(200);
  await click('hand:3'); await click('btn:discard'); await idle();
  await away(); await settle(coach ? 900 : 500);
}

for (const sc of SCALES) {
  // 1 바친 직후
  { const s = await session(sc); await sacrificed(s); await s.shot('1-sacrificed'); await s.context.close(); }
  // 2 처음 안내(「!?」 카드를 가리킨다)
  { const s = await session(sc); await sacrificed(s, { coach: true }); await s.shot('2-hint'); await s.context.close(); }
  // 3 기보 표가 있는 나이트: 「!?」는 왼쪽 위 · 바친 기물 셋이면 「+N」
  { const s = await session(sc); await sacrificed(s, { chart: 2, offered: ['Q', 'R'] }); await s.shot('3-chart-more'); await s.context.close(); }
  // 4 탁월수 순간: 새로 뽑은 나이트로 메이트 줄을 끝까지 두고, 「!!」가 뜬 지 0.3초에 멈춰 찍는다(움직임 줄이기는 딱지만)
  for (const calm of [false, true]) {
    const s = await session(sc);
    await sacrificed(s, { calm });
    const plan = await s.ev(async () => {
      const { bestMove } = await import('/src/sim/solver.js');
      const b = window.__app.run.battle, i = b.hand.findIndex((p) => p.id === 950);
      const d = bestMove(b, { handIndices: [i], preferMate: true });
      return { hand: i, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)), mate: !!d.mate };
    });
    if (!plan.mate) throw new Error('탁월수 장면: 새로 뽑은 나이트의 메이트 줄이 없다');
    await s.ev(() => {
      const a = window.__app, f = a.frame.bind(a);
      a.frame = (t) => { f(t); if (a.fx.list.some((e) => e.brilliant && e.t >= 0.3)) window.__hold = true; };
    });
    await s.click(`hand:${plan.hand}`); await s.click(`sq:${plan.sq}`); await s.idle();
    for (const sq of plan.line) {
      await s.click(`sq:${sq}`);
      await s.page.waitForFunction(() => window.__hold || !window.__app.screen.busy, null, { timeout: 30000, polling: 100 });
      if (await s.ev(() => window.__hold)) break;
    }
    await s.page.waitForFunction(() => window.__hold, null, { timeout: 15000, polling: 100 });
    await s.shot(calm ? '4b-brilliant-calm' : '4-brilliant');
    await s.context.close();
  }
  // 5 기록 화면: 탁월수 수 · 가장 큰 탁월수(비숍 · 폰을 바쳐 ×4)
  {
    const s = await session(sc);
    await s.settle(300);
    await s.ev(() => {
      const a = window.__app, r = a.records;
      Object.assign(r, { runs: 14, wins: 5, bestAnte: 8, mates: 9, legends: 1, brilliants: 3, bestBrilliant: { score: 18240, weight: 3, pieces: ['B', 'P'], ante: 4 } });
      r.bestMove = { score: 24800, steps: ['N', 'R', 'B', 'Q', 'Q', 'R', 'N', 'K'], ante: 6 };
      a.go('records');
    });
    await s.settle(400); await s.shot('5-records'); await s.context.close();
  }
  // 6 수업 ⑥ 손과 희생: 폰을 바친 뒤 — 새로 뽑은 나이트에 「!?」, 할 일 한 줄
  {
    const s = await session(sc);
    await s.settle(300);
    await s.ev(() => { const a = window.__app; a.settings.coach = false; a.go('lesson', { index: 5, phase: 'play' }); });
    await s.settle(400);
    await s.click('hand:0'); await s.click('btn:discard'); await s.idle(); await s.away(); await s.settle(500);
    await s.shot('6-lesson6'); await s.context.close();
  }
  // 7 영어 손 줄: 전술 둘 + 다시 놓기 + 「Sacrifice」 단추(아이콘 없이 글에 맞춘 폭), 바친 직후
  {
    const s = await session(sc, 'en');
    await sacrificed(s);
    await s.ev(() => { const a = window.__app; a.run.consumables = [{ kind: 'tactic', id: 'freeze' }, { kind: 'tactic', id: 'reload' }]; });
    await s.settle(300); await s.shot('7-hand-row'); await s.context.close();
  }
}
await browser.close(); srv.close();
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
