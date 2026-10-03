// 복기(CHM-59) 스크린샷: 갈림길 카드(판 위 「?」 · 「!」) · 처음 안내 · 다시 두기(수마다 재생, 왼쪽 칸 견주기) · 길 없음 · 영어 카드 · 영어 다시 두기.
//   node tools/shots-replay.mjs [--out docs/shots/replay] [--scale 3]
// 장면: 1관 대국에서 수 둘 · 목표 = 봇의 두 수 점수 합. 첫 수에 일부러 낮은 떨구기를 두고 둘째 수는 최선 → 진다.
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/replay'));
const SCALES = opt('--scale', '3').split(',').map(Number);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png' };
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
const timing = [];

async function session(sc, lang = 'ko') {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((lang) => { localStorage.clear(); if (lang !== 'ko') localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang })); }, lang);
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
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !((s.name === 'battle' || s.name === 'review') && (s.busy || s.playing)); }, null, { timeout: 30000, polling: 100 });
  return { page, context, ev, settle, shot, click, away, idle };
}

// 진 대국 하나를 둔다: path면 첫 수에 일부러 낮은 떨구기(둘째 수는 최선) · none이면 닿을 수 없는 목표. 갈림길 카드가 뜰 때까지 기다린다
async function lose(s, { kind = 'path', coach = false } = {}) {
  const { ev, settle, click, idle, page } = s;
  await settle(300);
  const plan = await ev(async ({ kind, coach }) => {
    const { bestMove } = await import('/src/sim/solver.js');
    const { apply } = await import('/src/sim/battle.js');
    const a = window.__app;
    a.settings.coach = coach;
    a.records.coachSeen = Object.fromEntries(['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop'].map((k) => [k, true]));
    for (let seed = 11; seed < 80; seed++) {
      a.nextSeed = seed; a.newRun();
      if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      a.cmd({ type: 'play' }); a.go('battle', { events: [] });
      const b = a.run.battle;
      b.rules = { ...b.rules, reboards: 0 }; // 다시 놓기 단추 없이
      const line = (m) => m.line.map((c) => (typeof c === 'number' ? c : c.sq));
      if (kind === 'none') {
        b.movesLeft = 1; b.discardsLeft = 0; b.target = 1e9;
        const m = bestMove(b);
        if (!m || m.mate) continue;
        a.screen.banner = null; a.screen.sync();
        return { moves: [{ hand: m.handIndex, sq: m.sq, line: line(m) }] };
      }
      // 첫 수: 최선보다 낮은 떨구기(메이트 아님) · 둘째 수: 그 뒤 최선. 목표 = 첫 수 최선 + 그 뒤 최선(봇이면 닿는다)
      const collect = [];
      const m1 = bestMove(b, { collect, preferMate: false });
      const w = m1 && !m1.mate && collect.filter((c) => !c.mate && c.score < m1.score && c.score > 0).sort((x, y) => y.score - x.score)[0];
      if (!w) continue;
      const t = JSON.parse(JSON.stringify(b)); t.target = null;
      apply(t, { type: 'drop', handIndex: m1.handIndex, sq: m1.sq }); for (const c of m1.line) apply(t, typeof c === 'number' ? { type: 'capture', sq: c } : c);
      if (t.status !== 'play') continue;
      const m2 = bestMove(t, { preferMate: false });
      const u = JSON.parse(JSON.stringify(b)); u.target = null;
      apply(u, { type: 'drop', handIndex: w.handIndex, sq: w.sq }); for (const c of w.line) apply(u, typeof c === 'number' ? { type: 'capture', sq: c } : c);
      if (u.status !== 'play') continue;
      const w2 = bestMove(u, { preferMate: false });
      if (!m2 || !w2 || w2.mate || u.score + w2.score >= t.score + m2.score) continue;
      b.movesLeft = 2; b.discardsLeft = 0; b.target = t.score + m2.score;
      a.screen.banner = null; a.screen.sync();
      return { moves: [{ hand: w.handIndex, sq: w.sq, line: line(w) }, { hand: w2.handIndex, sq: w2.sq, line: line(w2) }] };
    }
    return null;
  }, { kind, coach });
  if (!plan) throw new Error(`${kind} 장면을 못 찾았다`);
  await settle(300);
  for (const m of plan.moves) {
    await click(`hand:${m.hand}`); await click(`sq:${m.sq}`); await idle();
    for (const sq of m.line) { await click(`sq:${sq}`); await idle(); }
  }
  const t0 = Date.now();
  await page.waitForFunction(() => { const s = window.__app.screen; return s.name === 'battle' && s.rv && s.rv.phase === 'card'; }, null, { timeout: 30000, polling: 50 });
  timing.push(Date.now() - t0);
  await s.away(); await settle(coach ? 900 : 400);
  return s.ev(() => { const r = window.__app.screen.rv.res; return { kind: r.kind, at: r.at, n: r.best ? r.best.length : 0, nodes: r.nodes }; });
}

for (const sc of SCALES) {
  // 1 갈림길 카드
  { const s = await session(sc); const r = await lose(s); console.log('카드', JSON.stringify(r)); await s.shot('1-card'); await s.context.close(); }
  // 2 처음 안내(카드의 「다시 두기」를 가리킨다)
  { const s = await session(sc); await lose(s, { coach: true }); await s.shot('2-hint'); await s.context.close(); }
  // 3 다시 두기: 첫 수를 둔 뒤(1/n) · 끝까지 둔 뒤(이김)
  {
    const s = await session(sc);
    await lose(s);
    await s.click('btn:replay'); await s.settle(400); await s.away(); await s.settle(200);
    await s.shot('3-replay-start');
    await s.click('btn:forward'); await s.idle(); await s.away(); await s.settle(300);
    await s.shot('4-replay-step');
    for (let k = 0; k < 6; k++) { if (await s.ev(() => window.__app.screen.i >= window.__app.screen.n)) break; await s.click('btn:forward'); await s.idle(); }
    await s.away(); await s.settle(200);
    await s.shot('5-replay-won');
    await s.context.close();
  }
  // 6 길 없음
  { const s = await session(sc); const r = await lose(s, { kind: 'none' }); console.log('길 없음', JSON.stringify(r)); await s.shot('6-none'); await s.context.close(); }
  // 7 영어: 카드 · 다시 두기
  {
    const s = await session(sc, 'en');
    await lose(s); await s.shot('7-card');
    await s.click('btn:replay'); await s.settle(300); await s.click('btn:forward'); await s.idle(); await s.away(); await s.settle(300);
    await s.shot('8-replay');
    await s.context.close();
  }
}
await browser.close(); srv.close();
console.log(`카드가 뜨기까지(진 뒤 연출이 끝난 때부터, 브라우저) ms: ${timing.join(' ')}`);
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
