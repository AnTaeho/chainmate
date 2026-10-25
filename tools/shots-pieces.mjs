// 기물 디자인 비교 찍기(docs/tasks/handoff-pieces.md): python3 tools/serve.py <포트> 를 띄운 뒤
//   node tools/shots-pieces.mjs --port <포트> --tag before|cand-A|… [--style A] [--out <폴더>] [--only hd,iphone,n1,sheet]
// 장면: 붐비는 판(양편 체스 여섯 + 특수 기물 열) · 콤보 도중 · 도감 기물 탭 × 1280×720 dpr1 · 734×343 dpr3 · 480×270 dpr1, 기물 시트(N 1 · 2 · 3 · 4.25).
// --style은 window.__P3로 넘긴다(후보 그리기 스위치가 있을 때만 뜻이 있다)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PORT = Number(opt('--port', 8000));
const TAG = opt('--tag', 'before');
const STYLE = opt('--style', '');
const ONLY = opt('--only', '');
const OUT = path.resolve(opt('--out', 'docs/shots/pieces'));
async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const SIZES = { hd: [1280, 720, 1], iphone: [734, 343, 3], n1: [480, 270, 1] };

async function open([w, h, dpr], fill = false) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
  await page.addInitScript((s) => { window.__P3 = s; }, STYLE);
  await page.goto(`http://127.0.0.1:${PORT}/index.html${fill ? '?fit=fill' : ''}`);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', speed: 1 }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify({ v: 1, runs: 3, tutorialAsked: true, unlockTier: 9 }));
  });
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.screen, null, { timeout: 20000 });
  await page.evaluate(async () => {
    const a = window.__app;
    const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords();
  });
  return page;
}
async function toPage(page, x, y) {
  const b = await page.evaluate(() => { const c = document.getElementById('screen').getBoundingClientRect(); return [c.x, c.y, c.width, c.height]; });
  return [b[0] + (x * b[2]) / 480, b[1] + (y * b[3]) / 270];
}
async function regionXY(page, id) {
  const r = await page.evaluate((id) => { const q = window.__app.ui.regions.find((q) => q.id === id); return q ? [q.x + Math.floor(q.w / 2), q.y + Math.floor(q.h / 2)] : null; }, id);
  if (!r) return null;
  return toPage(page, r[0], r[1]);
}
const idle = (page) => page.waitForFunction(() => !window.__app.screen.busy && !window.__app.screen.banner && !window.__app.screen.intro, null, { timeout: 20000 }).catch(() => null);
async function click(page, id) { const p = await regionXY(page, id); if (!p) return false; await page.mouse.click(...p); await page.waitForTimeout(150); return true; }
async function hover(page, id) { const p = await regionXY(page, id); if (!p) return; await page.mouse.move(...p); await page.waitForTimeout(250); }

async function battle(page, { ante, faction = null, seed = 21 }) {
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
}
// 붐비는 판: 양편 체스 여섯 + 특수 기물 열
function crowd() {
  const a = window.__app, b = a.run.battle;
  for (let i = 0; i < 64; i++) b.board[i] = null;
  let id = 900;
  const E = [[60, 'K'], [59, 'Q'], [61, 'R'], [52, 'B'], [51, 'N'], [53, 'P'], [43, 'P'], [44, 'Z'], [45, 'V'], [32, 'L'], [47, 'O'], [34, 'W'], [38, 'M'], [49, 'S'], [63, 'T'], [56, 'D'], [54, 'E'], [42, 'P', true], [36, 'R'], [57, 'N']];
  for (const [s, t, gold] of E) b.board[s] = { t, id: id++, born: -1, ...(gold ? { gold: true } : {}) };
  const M = [[18, 'R'], [21, 'B'], [9, 'P'], [28, 'N'], [11, 'K'], [14, 'Q'], [23, 'Z'], [16, 'L'], [26, 'E'], [12, 'W'], [30, 'S'], [25, 'T'], [3, 'O'], [5, 'V'], [7, 'M'], [1, 'D'], [19, 'P']];
  for (const [s, t] of M) b.board[s] = { t, id: id++, born: -1, mine: true };
  a.screen.sync();
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, `${TAG}-${name}.png`) }); console.log('찍음', `${TAG}-${name}.png`); }

// 기물 시트: 16 모양 × 편(내 · 적 · 금 · 은 · 승급 · 각인 셋 · 기보 3), 배율 N마다 판 위 크기(22) + 판 밖 작은 상자(16×22 · 8×11)
async function sheet(page) {
  const urls = await page.evaluate(async () => {
    const P3 = await import('/src/render/pieces3.js');
    const shapes = ['P', 'N', 'B', 'R', 'Q', 'K', 'Z', 'L', 'O', 'S', 'W', 'T', 'E', 'V', 'M', 'D'];
    const rows = [['w', {}], ['b', {}], ['g', {}], ['s', {}], ['q', {}], ['w', { eng: 'glass' }], ['w', { eng: 'ebony' }], ['w', { eng: 'gold' }], ['w', { tier: 3 }]];
    const out = {};
    for (const N of [1, 2, 3, 4.25]) {
      const W = 16 * 26 + 8, H = rows.length * 30 + 4 + 2 * 26;
      const c = document.createElement('canvas'); c.width = Math.ceil(W * N); c.height = Math.ceil(H * N);
      const x = c.getContext('2d'); x.setTransform(N, 0, 0, N, 0, 0);
      x.fillStyle = '#1c2152'; x.fillRect(0, 0, W, H);
      // 체스판 칸 빛깔 바탕(밝은 · 어두운)
      rows.forEach(([side, o], r) => shapes.forEach((t, i) => {
        x.fillStyle = (i + r) % 2 ? '#efe6d2' : '#5d6a9a'; x.fillRect(4 + i * 26, 4 + r * 30, 26, 30);
        P3.piece3(x, t, side, 4 + i * 26 + 13, 4 + r * 30 + 24, o);
      }));
      const y0 = 4 + rows.length * 30;
      shapes.forEach((t, i) => { x.fillStyle = '#f7eedb'; x.fillRect(4 + i * 26, y0 + 2, 24, 24); P3.fitPiece(x, t, i % 2 ? 'b' : 'w', 4 + i * 26 + 4, y0 + 3, 16, 22); });
      shapes.forEach((t, i) => { x.fillStyle = '#262c5f'; x.fillRect(4 + i * 26, y0 + 28, 24, 24); P3.fitPiece(x, t, i % 2 ? 'b' : 'w', 4 + i * 26 + 4, y0 + 34, 8, 11); P3.fitPiece(x, t, i % 2 ? 'w' : 'b', 4 + i * 26 + 13, y0 + 34, 8, 11); });
      // 보기 좋게 정수 배로 키운다(화소 그대로)
      const z = Math.max(1, Math.round(4 / N));
      const big = document.createElement('canvas'); big.width = c.width * z; big.height = c.height * z;
      const g = big.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, big.width, big.height);
      out[N] = big.toDataURL('image/png');
    }
    return out;
  });
  for (const [N, u] of Object.entries(urls)) {
    const f = path.join(OUT, `${TAG}-sheet-N${N}.png`);
    fs.writeFileSync(f, Buffer.from(u.split(',')[1], 'base64'));
    console.log('찍음', path.basename(f));
  }
}

for (const [sz, dim] of Object.entries(SIZES)) {
  if (ONLY && !ONLY.split(',').includes(sz) && ONLY !== 'sheet') continue;
  if (ONLY === 'sheet') break;
  // 1) 붐비는 판 + 손 첫 카드 들기
  let page = await open(dim);
  await battle(page, { ante: 7 });
  await page.evaluate(crowd); await page.waitForTimeout(200);
  await click(page, 'hand:0');
  await page.mouse.move(1, 1); await page.waitForTimeout(250);
  await shot(page, `${sz}-crowded`);
  await page.close();
  // 2) 콤보 도중(콤보 칸이 찬 때)
  page = await open(dim);
  await battle(page, { faction: 'peasants' });
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
    for (let k = 0; k < 2; k++) {
      const caps = await page.evaluate(async () => { const { chainCaptures } = await import('/src/sim/chain.js'); const b = window.__app.run.battle; return b.status === 'chain' ? chainCaptures(b) : []; });
      if (!caps.length) break;
      await click(page, `sq:${caps[0]}`); await idle(page);
    }
    await page.waitForTimeout(400);
    await page.mouse.move(1, 1); await page.waitForTimeout(200);
    await shot(page, `${sz}-combo`);
  }
  await page.close();
  // 3) 도감 기물 탭
  page = await open(dim);
  await page.evaluate(() => { const a = window.__app; a.records.unlockTier = 9; a.records.movesSeen = Object.fromEntries('PNBRQKZLOSWTEVMD'.split('').map((k) => [k, true])); a.go('codex', { tab: 'pieces' }); });
  await page.waitForTimeout(500);
  await page.mouse.move(1, 1);
  await shot(page, `${sz}-codex`);
  await page.close();
}
if (!ONLY || ONLY.includes('sheet')) { const page = await open(SIZES.hd); await sheet(page); await page.close(); }
console.log('오류', errors.length, errors.slice(0, 5).join(' | '));
await browser.close();
