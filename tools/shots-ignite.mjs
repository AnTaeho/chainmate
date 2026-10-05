// 점화 의식(CHM-67, docs/design-notes/ignite.md · layout.md 20절) — 구현한 화면 스크린샷(시안 draft*는 같은 자리에 남아 있다).
//   NPM_CONFIG_PREFIX=<playwright 있는 곳> node tools/shots-ignite.mjs [--scale 1,3]   → docs/shots/ignite/after-*.png
//   길 긋기 · 카드(한국어 · 영어) · 뒤에 남은 불씨(대국 · 가리킴 · 상점) · 움직임 줄이기 · 사슬 끝의 값 몫(「+N」 · 「+10」 겹침 고친 뒤)
// 장면: 5관 정식 대국, 자연 판(createBattle seed 46 · 5관)에서 풀이기가 찾은 사슬 8을 칸 누르기로 둔다. 판을 갈아 끼우니 markFairy · refreshHints를 다시 돌린다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, 'docs/shots/ignite');
const SCALES = opt('--scale', '1,3').split(',').map(Number);
const SEEDS = [46, 51, 19, 61];

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok)); // 빈 포트(8123은 건드리지 않는다)
const port = srv.address().port;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SEEN = ['family', 'joseki', 'tactic', 'incoming', 'trait', 'things', 'fairy', 'golden', 'brilliant', 'clock', 'shop', 'next', 'master', 'preview', 'pack', 'maxim', 'scroll', 'bag', 'reroll', 'promote', 'maximSell', 'crack', 'hold'];

async function session(sc, lang, calm = false) {
  const context = await browser.newContext({ viewport: { width: 480 * sc, height: 270 * sc }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(({ lang, calm }) => {
    localStorage.clear();
    const st = {};
    if (lang !== 'ko') st.lang = lang;
    if (calm) st.calm = true;
    if (Object.keys(st).length) localStorage.setItem('chainmate.settings.v1', JSON.stringify(st));
    window.__hold = false; window.__want = null;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf((t) => (window.__hold ? window.requestAnimationFrame(cb) : cb(t)));
  }, { lang, calm });
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  await page.waitForTimeout(300);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev((SEEN) => {
    const a = window.__app;
    a.settings.coach = false;
    a.records.kingDone = true;
    const factions = ['peasants', 'cavalry', 'abbey', 'fortress', 'hunters', 'heralds', 'mercs', 'royal'];
    a.records.coachSeen = Object.fromEntries([...SEEN, ...factions.map((f) => `faction_${f}`)].map((k) => [k, true]));
    // 정한 순간에 그리기를 멈춘다(window.__want가 참이 되는 프레임)
    const f = a.frame.bind(a);
    a.frame = (t) => { f(t); if (window.__want && window.__want(a)) { window.__want = null; window.__hold = true; } };
  }, SEEN);
  const toXY = async (gx, gy) => { const b = await page.locator('#screen').boundingBox(); return [b.x + ((gx + 0.5) * b.width) / 480, b.y + ((gy + 0.5) * b.height) / 270]; };
  const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  const hover = async (id) => { const r = await region(id); if (!r) throw new Error(`구역 없음 ${id}`); const [x, y] = await toXY(r.x + r.w / 2, r.y + r.h / 2); await page.mouse.move(x, y); await page.waitForTimeout(400); };
  const away = async () => { const [x, y] = await toXY(300, 266); await page.mouse.move(x, y); };
  const tag = `${lang === 'ko' ? '' : `-${lang}`}${sc === 1 ? '' : `@${sc}x`}`;
  const shot = async (name) => { const b = await page.locator('#screen').boundingBox(); await page.screenshot({ path: path.join(OUT, `${name}${tag}.png`), clip: b }); console.log('찍음', `${name}${tag}`); };
  const holdUntil = async (fnSrc) => { await ev((src) => { window.__want = new Function('a', `return (${src})`); }, fnSrc); };
  const waitHold = async () => { try { await page.waitForFunction(() => window.__hold, null, { timeout: 20000, polling: 50 }); } catch (err) { console.log('상태', await ev(() => { const a = window.__app, s = a.screen, b = a.run.battle; return { scr: s.name, busy: s.busy, combo: s.combo && s.combo.t, ig: !!a.run.ignite, st: b && b.status, phase: a.run.phase }; })); throw err; } };
  const release = () => ev(() => { window.__hold = false; });
  const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 30000, polling: 100 });
  return { page, context, ev, hover, away, shot, holdUntil, waitHold, release, idle };
}

// 5관 정식 대국을 열고 자연 판으로 갈아 끼운 뒤, 풀이기로 사슬 8~10(메이트 없음)을 찾는다
async function battle(s) {
  for (const seed of SEEDS) {
    const plan = await s.ev(async (seed) => {
      const a = window.__app;
      const { syncBoards } = await import('/src/sim/run.js');
      const { createBattle, refreshHints } = await import('/src/sim/battle.js');
      const { bestMove } = await import('/src/sim/solver.js');
      const { markFairy } = await import('/src/sim/chain.js');
      a.nextSeed = 5; a.newRun();
      if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
      const r = a.run;
      r.ante = 5; r.blind = 1; r.boards = null; r.money = 14;
      syncBoards(r);
      a.cmd({ type: 'play' }); a.go('battle', { events: [] });
      const b = r.battle;
      const cb = createBattle({ seed, ante: 5, kind: 'official', bag: ['P', 'P', 'P', 'N', 'N', 'B', 'R', 'Q'] });
      b.board = JSON.parse(JSON.stringify(cb.board));
      b.hand = JSON.parse(JSON.stringify(cb.hand));
      b.bag = JSON.parse(JSON.stringify(cb.bag));
      b.incoming = JSON.parse(JSON.stringify(cb.incoming || []));
      b.incomingNext = cb.incomingNext ? JSON.parse(JSON.stringify(cb.incomingNext)) : null;
      b.nextId = Math.max(b.nextId, cb.nextId);
      markFairy(b); refreshHints(b); // 판을 갈아 끼웠으니 이형 표시 · 판 표시를 다시 잰다
      const d = bestMove(b, { preferMate: false });
      if (!d || d.line.length < 8 || d.mate) return { ok: false, len: d ? d.line.length : 0 };
      // 목표: 사슬 점수의 1.4배쯤(사슬 뒤에도 대국이 이어지게 — 넘침 글이 없게)
      b.target = Math.ceil((b.score + d.score) * 1.4 / 100) * 100;
      a.screen.banner = null;
      a.screen.sync();
      return { ok: true, hand: d.handIndex, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)), score: d.score, target: b.target };
    }, seed);
    if (plan.ok) { console.log('판 시드', seed, plan); await s.page.waitForTimeout(300); return plan; }
    console.log('판 시드', seed, '사슬', plan.len, '— 다음');
  }
  throw new Error('사슬 8 판을 못 찾았다');
}

// 사슬을 칸 누르기(화면 clickSq — 사람이 칸을 누른 것과 같은 길)로 둔다. 마지막 칸 누르기 전에 멈출 조건을 건다
async function playChain(s, plan, wantSrc) {
  await s.ev((i) => window.__app.screen.toggle(i), plan.hand);
  await s.ev((sq) => window.__app.screen.clickSq(sq), plan.sq); await s.idle();
  for (let i = 0; i < plan.line.length; i++) {
    if (i === plan.line.length - 1 && wantSrc) await s.holdUntil(wantSrc);
    await s.ev((sq) => window.__app.screen.clickSq(sq), plan.line[i]);
    if (i < plan.line.length - 1) await s.idle();
  }
}

// 대국을 봇으로 끝내고 상점으로(남는 불씨가 판 밖 틀 왼쪽 칸에 보이는지)
async function toShop(s) {
  await s.ev(async () => {
    const a = window.__app;
    const { stepBattle } = await import('/tools/bot.mjs');
    a.run.battle.target = 1;
    for (let k = 0; k < 40 && a.run.phase === 'battle'; k++) if (!stepBattle(a.run.battle, (c) => a.cmd(c))) break;
    a.toasts.length = 0;
    a.go('shop');
  });
  await s.page.waitForTimeout(500);
  await s.away();
  await s.page.waitForTimeout(300);
}

async function main(sc, lang = 'ko') {
  const s = await session(sc, lang);
  const plan = await battle(s);
  await s.away();
  // 사슬 끝: 마지막 먹기의 값 몫(「+10」)이 아직 떠 있을 때 — 머리 칸 아랫변 · 점수 줄과 떨어져 있다
  await playChain(s, plan, lang === 'ko' ? "a.screen.seq.cur && a.screen.seq.cur.label === 'end'" : 'a.screen.combo && a.screen.combo.t >= 1.6');
  await s.waitHold();
  if (lang === 'ko') {
    await s.shot('after-pop');
    await s.holdUntil('a.screen.combo && a.screen.combo.t >= 0.55'); await s.release(); await s.waitHold();
    console.log('점화 기록', JSON.stringify(await s.ev(() => window.__app.run.ignite)));
    await s.shot('after-path');
    await s.holdUntil('a.screen.combo && a.screen.combo.t >= 1.6'); await s.release(); await s.waitHold();
  }
  await s.shot('after-card');
  await s.release();
  if (lang !== 'ko') { await s.context.close(); return; }
  await s.page.waitForTimeout(200);
  await s.page.mouse.down(); await s.page.mouse.up(); // 탭하면 닫힌다
  await s.idle(); await s.away(); await s.page.waitForTimeout(800); await s.shot('after-battle');
  await s.hover('ignite:mark'); await s.shot('after-tip'); await s.away();
  await toShop(s); await s.shot('after-shop');
  await s.hover('ignite:mark'); await s.shot('after-shop-tip');
  await s.context.close();
}
// 움직임 줄이기: 길과 카드가 처음 프레임부터 다 보인다
async function calm(sc) {
  const s = await session(sc, 'ko', true);
  const plan = await battle(s);
  await s.away();
  await playChain(s, plan, 'a.screen.combo && a.screen.combo.t > 0');
  await s.waitHold(); await s.shot('after-calm'); await s.release();
  await s.context.close();
}

try {
  for (const sc of SCALES) { await main(sc); await calm(sc); }
  if (SCALES.includes(3)) await main(3, 'en');
} finally {
  await browser.close(); srv.close();
}
if (errors.length) { console.log('오류', errors.slice(0, 5)); process.exit(1); }
