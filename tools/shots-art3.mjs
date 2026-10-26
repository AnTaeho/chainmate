// 안 3 읽기 검사(CHM-77, docs/design-notes/art3.md): 마름모 판 · 벡터 기물이 폰 1배 · 2배 · 3배에서 읽히는지 찍는다.
//   python3 tools/serve.py <포트> 를 띄운 뒤  node tools/shots-art3.mjs --port <포트> --out <폴더> [--view diamond|shallow|flat]
// 장면: normal(seed 21 · 1관 농민군 연습, 손 첫 카드를 들고 놓을 칸을 가리킴) · crowded(7관, 킹 둘레에 지키는 적 여덟) ·
//   capture(콤보 도중 — 첫 잡기 뒤 다음 적을 가리켜 미리 보기 수가 뜬 때). 창 480×270(N 1) · 960×540(N 2) · 1440×810(N 3)
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright } from './_lib/browser.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(opt('--port', 8000));
const OUT = path.resolve(opt('--out', 'docs/shots/art3'));
const VIEW = opt('--view', 'diamond');
const SIZES = (opt('--sizes', '480x270,960x540,1440x810')).split(',').map((s) => s.split('x').map(Number));

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];

async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', speed: 1 }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ v: 1, runs: 3, tutorialAsked: true }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.screen, null, { timeout: 20000 });
  await page.evaluate(async (view) => {
    const a = window.__app;
    const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords();
    (await import('/src/render/board3.js')).setView(view);
  }, VIEW);
  return page;
}
// 게임 좌표 → 창 좌표
async function toPage(page, x, y) {
  const b = await page.evaluate(() => { const c = document.getElementById('screen').getBoundingClientRect(); return [c.x, c.y, c.width, c.height]; });
  return [b[0] + (x * b[2]) / 480, b[1] + (y * b[3]) / 270];
}
async function regionXY(page, id) {
  const r = await page.evaluate((id) => { const q = window.__app.ui.regions.find((q) => q.id === id); return q ? [q.x + Math.floor(q.w / 2), q.y + Math.floor(q.h / 2)] : null; }, id);
  if (!r) throw new Error(`no region ${id}`);
  return toPage(page, r[0], r[1]);
}
const idle = (page) => page.waitForFunction(() => !window.__app.screen.busy && !window.__app.screen.banner && !window.__app.screen.intro, null, { timeout: 20000 }).catch(() => null);
async function click(page, id) { const [x, y] = await regionXY(page, id); await page.mouse.click(x, y); await page.waitForTimeout(120); }
async function hover(page, id) { const [x, y] = await regionXY(page, id); await page.mouse.move(x, y); await page.waitForTimeout(250); }

async function battle(page, { ante, faction = null, seed = 21, setup = null }) {
  await page.evaluate(({ ante, faction, seed }) => {
    const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.newRun({ seed });
    const r = a.run;
    if (r.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    r.ante = faction ? r.factions.indexOf(faction) + 1 : ante; r.blind = 0; r.phase = 'select'; r.shop = null; r.draft = null; r.drafted = [1, 3, 5]; r.money = 12;
    a.toasts = []; a.goPhase();
    const e0 = a.cmd({ type: 'play' }); a.go('battle', { events: e0 });
  }, { ante, faction, seed });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(600);
  await idle(page);
  if (setup) { await page.evaluate(setup); await page.waitForTimeout(100); }
}
async function shot(page, name) {
  await page.mouse.move(...(await page.evaluate(() => [1, 1])));
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('찍음', file);
}

// 7관 대국의 킹 둘레를 지키는 적 여덟로 채운다(그리기 검사용 — 규칙 명령 밖에서 판만 바꾼다)
function crowd() {
  const a = window.__app, b = a.run.battle;
  const kings = b.board.map((c, i) => (c && !c.mine && c.t === 'K' ? i : -1)).filter((i) => i >= 0);
  let K = kings[0];
  if (K == null) { K = 51; b.board[K] = { t: 'K', id: 990, born: -1 }; }
  // 킹을 판 가운데 위쪽(e7)으로 옮기고 둘레 여덟 칸에 섞인 적
  const at = 52;
  if (K !== at) { b.board[at] = b.board[K]; b.board[K] = null; }
  const ring = [43, 44, 45, 51, 53, 59, 60, 61], kinds = ['P', 'B', 'P', 'R', 'N', 'Q', 'P', 'B'];
  let id = 900;
  ring.forEach((s, i) => { b.board[s] = { t: kinds[i], id: id++, born: -1, ...(i === 2 ? { gold: true } : {}) }; });
  // 앞쪽에 몇 더(룩 · 비숍 선이 보이게)
  [[18, 'R'], [21, 'B'], [26, 'P'], [36, 'N'], [9, 'P']].forEach(([s, t]) => { if (!b.board[s]) b.board[s] = { t, id: id++, born: -1 }; });
  a.screen.sync();
}

for (const [w, h] of SIZES) {
  const tag = `${VIEW}-${w}x${h}`;
  // 1) 보통 대국: 손 첫 카드를 들고, 놓을 칸 하나를 가리킨다
  let page = await open(w, h);
  await battle(page, { faction: 'peasants' });
  await click(page, 'hand:0');
  const drop = await page.evaluate(() => window.__app.screen.clickable().list);
  if (drop.length) await hover(page, `sq:${drop[Math.floor(drop.length / 2)]}`);
  await page.screenshot({ path: path.join(OUT, `${tag}-normal.png`) });
  console.log('찍음', `${tag}-normal.png`);
  // 3) 콤보 도중: 다음 적이 있는 떨굴 칸에 떨구고 한 번 잡은 뒤, 다음 적을 가리켜 미리 보기를 띄운다
  const plan = await page.evaluate(async () => {
    const a = window.__app, b = a.run.battle;
    const { previewDrop } = await import('/src/sim/solver.js');
    const { dropSquaresFor } = await import('/src/sim/battle.js');
    let best = null;
    b.hand.forEach((p, i) => { for (const sq of dropSquaresFor(b, p)) { const pv = previewDrop(b, i, sq); if (pv && pv.next && pv.next.length && (!best || pv.next.length > best.n)) best = { i, sq, n: pv.next.length }; } });
    return best;
  });
  if (plan) {
    await click(page, `hand:${plan.i}`);
    if (!(await page.evaluate((i) => window.__app.screen.sel.includes(i), plan.i))) await click(page, `hand:${plan.i}`);
    await click(page, `sq:${plan.sq}`);
    await idle(page);
    const caps = await page.evaluate(async () => { const { chainCaptures } = await import('/src/sim/chain.js'); return chainCaptures(window.__app.run.battle); });
    if (caps.length) { await click(page, `sq:${caps[0]}`); await idle(page); }
    const caps2 = await page.evaluate(async () => { const { chainCaptures } = await import('/src/sim/chain.js'); const b = window.__app.run.battle; return b.status === 'chain' ? chainCaptures(b) : []; });
    if (caps2.length) await hover(page, `sq:${caps2[0]}`);
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT, `${tag}-capture.png`) });
    console.log('찍음', `${tag}-capture.png`, 'drop', plan, 'caps', caps.length, 'next', caps2.length);
  }
  await page.close();
  // 2) 붐비는 늦은 판
  page = await open(w, h);
  await battle(page, { ante: 7, seed: 21, setup: crowd });
  await click(page, 'hand:0');
  const d2 = await page.evaluate(() => window.__app.screen.clickable().list);
  if (d2.length) await hover(page, `sq:${d2[0]}`);
  await page.screenshot({ path: path.join(OUT, `${tag}-crowded.png`) });
  console.log('찍음', `${tag}-crowded.png`);
  await page.close();
}
console.log('오류', errors.length, errors.slice(0, 5).join(' | '));
await browser.close();
