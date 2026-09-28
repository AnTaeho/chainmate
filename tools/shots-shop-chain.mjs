// 관 선택 ↔ 상점 · 사슬 도중 목표를 넘기는 장면 스크린샷 + 잰 값(docs/tasks/shop-chain.md A · B).
//   node tools/shots-shop-chain.mjs [--prefix before|after] [--out docs/shots/shop-chain] [--seed 3] [--only select|chain]
// A: <prefix>-0-select-shop(첫 대국을 이기고 상점을 떠난 관 선택) · <prefix>-0-shop-back(「상점」을 눌러 돌아간 상점)
// 판을 하나 열어 봇(solver)의 가장 긴 사슬을 고른 뒤, 첫 먹기 뒤 이 사슬 몫이 목표를 넘도록 목표를 낮춘다.
// 찍는 것: <prefix>-1-chain-cross(목표를 넘긴 순간) · <prefix>-2-chain-more(넘긴 뒤 한 번 더 먹은 모습) · <prefix>-3-chain-end(사슬이 끝난 뒤)
// 잰 것(표준 출력): 넘긴 순간 누를 수 있는 칸 수 · 연출 중인가 · 대국 상태 · 끝난 뒤 이겼나 · 끝나고 둘 수 있는 수가 남았나
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/shop-chain'));
const SEED0 = Number(opt('--seed', 3));
const ONLY = opt('--only', null);

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
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
fs.mkdirSync(OUT, { recursive: true });
const ev = (fn, arg) => page.evaluate(fn, arg);
const until = (fn) => page.waitForFunction(fn, null, { timeout: 20000 });

function encodePng(rgba, w, h) {
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc32 = (buf) => { let c = 0xffffffff; for (const x of buf) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, o = y * (w * 3 + 1) + 1 + x * 3; raw[o] = rgba[i]; raw[o + 1] = rgba[i + 1]; raw[o + 2] = rgba[i + 2]; }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
async function shot(name) {
  const b64 = await ev(() => { const c = document.getElementById('screen'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = ''; for (let i = 0; i < d.length; i += 8192) s += String.fromCharCode.apply(null, d.subarray(i, i + 8192)); return btoa(s); });
  const file = path.join(OUT, `${PREFIX}-${name}.png`);
  fs.writeFileSync(file, encodePng(Buffer.from(b64, 'base64'), 480, 270));
  return path.relative(ROOT, file);
}
const regions = () => ev(() => window.__app.ui.regions.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h })));
async function clickId(id) {
  const r = (await regions()).find((q) => q.id === id);
  if (!r) throw new Error(`no region ${id}`);
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + ((r.x + r.w / 2) * box.width) / 480, box.y + ((r.y + r.h / 2) * box.height) / 270);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(60);
}
const state = () => ev(() => {
  const a = window.__app, s = a.screen, b = a.run && a.run.battle;
  const t = s.clickable ? s.clickable() : { list: [] };
  return { screen: s.name, busy: !!s.busy, status: b ? b.status : null, phase: a.run.phase, clickable: t.list.length, kind: t.kind, score: b ? b.score : null, target: b ? b.target : null, live: s.view && s.view.chain ? Math.floor(s.view.chain.value * s.view.chain.mult) : 0 };
});

await page.goto(`http://localhost:${srv.address().port}/index.html`);
await ev(() => {
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang: 'ko', speed: 1 }));
  localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, runs: 3 }));
});
await page.reload();
await until(() => window.__app && window.__app.screen);
await ev(async () => { const a = window.__app; const { HINTS } = await import('/src/ui/coach.js'); a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true])); a.saveRecords(); });

// ── A: 첫 대국을 봇으로 이기고 상점을 떠난 관 선택 → 「상점」
if (ONLY !== 'chain') {
  await ev(async () => {
    const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.nextSeed = 7; a.newRun();
    const { stepBattle } = await import('/tools/bot.mjs');
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    a.cmd({ type: 'play' });
    while (a.run.phase === 'battle') stepBattle(a.run.battle, (c) => a.cmd(c), {});
    if (a.run.phase !== 'shop') throw new Error(`상점 대신 ${a.run.phase}`);
    a.cmd({ type: 'leave' }); a.goPhase();
  });
  await page.waitForTimeout(500);
  const hasBtn = (await regions()).some((r) => r.id === 'select:shop');
  const f0 = await shot('0-select-shop');
  if (hasBtn) { await clickId('select:shop'); await page.waitForTimeout(500); }
  const f1 = await shot('0-shop-back');
  console.log(`관 선택 「상점」 단추 ${hasBtn ? '있음' : '없음'} → ${f0} · 누른 뒤 화면 ${await ev(() => window.__app.screen.name)} → ${f1}`);
}
if (ONLY === 'select') { await browser.close(); srv.close(); process.exit(0); }

// ── B: 사슬 셋 이상이 나오는 판을 찾는다
let plan = null, seed = SEED0;
for (; seed < SEED0 + 40 && !plan; seed++) {
  await ev((sd) => {
    const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.closeOverlay(); a.nextSeed = sd; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    const ev0 = a.cmd({ type: 'play' }); a.go('battle', { events: ev0 });
  }, seed);
  await page.waitForTimeout(2600);
  await until(() => !window.__app.screen.busy && !window.__app.screen.banner);
  const p = await ev(async () => { const { bestMove } = await import('/src/sim/solver.js'); const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' }); return d && { hand: d.handIndex, sq: d.sq, line: d.line }; });
  if (p && p.line.length >= 3 && p.line.every((x) => typeof x === 'number')) plan = p;
}
if (!plan) throw new Error('사슬 셋 이상인 판을 못 찾았다');
console.log(`판 seed ${seed - 1} · 사슬 ${plan.line.length}번 먹기`);

await clickId(`hand:${plan.hand}`); await clickId(`sq:${plan.sq}`);
await until(() => !window.__app.screen.busy);
await clickId(`sq:${plan.line[0]}`);
await until(() => !window.__app.screen.busy);
// 첫 먹기 뒤 이 사슬 몫(값 × 배수)이 목표를 넘도록 목표를 낮춘다(규칙 · 화면 둘 다)
await ev(() => { const s = window.__app.screen, c = s.view.chain, L = Math.floor(c.value * c.mult); const t = Math.max(1, Math.floor(L * 0.9)); window.__app.run.battle.target = t; s.view.target = t; });
await page.waitForTimeout(250);
const cross = await state();
const f1 = await shot('1-chain-cross');
await clickId(`sq:${plan.line[1]}`);
await until(() => !window.__app.screen.busy);
await page.waitForTimeout(250);
const more = await state();
const f2 = await shot('2-chain-more');
for (const sq of plan.line.slice(2)) {
  const st = await state();
  if (st.status !== 'chain') break;
  await clickId(`sq:${sq}`);
  await until(() => !window.__app.screen.busy || window.__app.screen.name !== 'battle');
}
await page.waitForTimeout(400);
const end = await state();
const f3 = await shot('3-chain-end');
console.log(`넘긴 순간: 목표 ${cross.target} · 사슬 몫 ${cross.live} · 대국 ${cross.status} · 연출 중 ${cross.busy} · 누를 칸 ${cross.clickable}(${cross.kind}) → ${f1}`);
console.log(`한 번 더 먹은 뒤: 대국 ${more.status} · 사슬 몫 ${more.live} · 누를 칸 ${more.clickable} → ${f2}`);
console.log(`사슬이 끝난 뒤: 화면 ${end.screen} · 판 ${end.phase} · 대국 ${end.status} · 점수 ${end.score} → ${f3}`);
console.log(`예외 ${errors.length}${errors.length ? ` ${errors.join(' | ')}` : ''}`);
await browser.close();
srv.close();
