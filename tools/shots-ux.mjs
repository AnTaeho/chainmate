// 처음 보는 사람의 길을 순서대로 찍는다(친절 손질 · docs/design-notes/ux-audit.md).
//   node tools/shots-ux.mjs [--prefix before|after] [--out docs/shots/ux]
// 첫 실행(기록 없음) → 첫 수업 → 1관 첫 대국 → 첫 상점 · 꾸러미 → 3관 정석 · 명인 → 4관 이후의 새 것들.
// 같은 이름 짝으로 before-… · after-…를 남겨 고치기 전 · 뒤를 견준다. Playwright는 저장소 의존성이 아니다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots/ux'));
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
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
fs.mkdirSync(OUT, { recursive: true });
const settle = (ms = 300) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let n = 0;
async function shot(name) {
  n++;
  const file = `${PREFIX}-${String(n).padStart(2, '0')}-${name}`;
  if (ONLY && !file.includes(ONLY)) return;
  const url = await ev(() => {
    const c = document.getElementById('screen');
    const big = document.createElement('canvas');
    big.width = c.width * 3; big.height = c.height * 3;
    const g = big.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(c, 0, 0, big.width, big.height);
    return big.toDataURL('image/png');
  });
  fs.writeFileSync(path.join(OUT, `${file}.png`), Buffer.from(url.split(',')[1], 'base64'));
  console.log('찍음', file);
}
async function clickAt(gx, gy) {
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + ((gx + 0.5) * box.width) / 480, box.y + ((gy + 0.5) * box.height) / 270);
  await page.mouse.down(); await page.mouse.up();
}
const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
async function clickId(id) {
  const r = await region(id);
  if (!r) throw new Error(`no region ${id} on ${await ev(() => window.__app.screen.name)}`);
  await clickAt(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  await settle(80);
}
async function hoverId(id) {
  const r = await region(id);
  if (!r) return false;
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + r.x + r.w / 2, box.y + r.y + r.h / 2);
  await settle(120);
  return true;
}
const screen = () => ev(() => window.__app.screen.name);
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !((s.name === 'battle' || s.name === 'lesson') && s.busy); }, null, { timeout: 30000 });

// ── 1. 처음 켠다(기록 · 설정 · 판 없음)
await page.goto(`http://localhost:${srv.address().port}/index.html`);
await ev(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen);
await ev(() => { window.__app.settings.speed = 2; });
await settle(1200);
await shot('first-launch');

// ── 2. 첫 수업: 수업마다 시범 한 장 · 내 차례 한 장
const lessons = await ev(async () => (await import('/src/ui/lessons.js')).LESSONS.map((L) => ({ shop: !!L.shop })));
for (let i = 0; i < lessons.length; i++) {
  if (lessons[i].shop) {
    // 수업 ⑩: 상점 길을 걸음마다 한 장
    await ev(async (i) => (await import('/src/ui/screens/lessons.js')).openLesson(window.__app, i, 'shots'), i);
    for (let k = 0; k < 8; k++) {
      await settle(900);
      const st = await ev(() => { const g = window.__app.guide; return g && g.steps[g.i] ? { target: g.steps[g.i].target, ok: !!g.steps[g.i].ok } : null; });
      if (!st) break;
      await shot(`lesson-${i + 1}-guide-${k + 1}`);
      await clickId(st.ok ? 'guide:ok' : st.target);
    }
    await ev(() => { const a = window.__app; a.guide = null; a.run = null; });
    continue;
  }
  await ev((i) => window.__app.go('lesson', { index: i, phase: 'demo' }), i);
  await page.waitForFunction(() => { const s = window.__app.screen; return s.demo && (s.si >= 2 || s.demo.done); }, null, { timeout: 30000 }).catch(() => {});
  await shot(`lesson-${i + 1}-demo`);
  await ev((i) => window.__app.go('lesson', { index: i, phase: 'play' }), i);
  await settle(500);
  await shot(`lesson-${i + 1}-play`);
}
await ev(() => { const a = window.__app; a.records.lessonsSeen = { drop: true, become: true, chain: true }; a.go('lessons'); });
await settle(300);
await shot('lesson-list');

// ── 3. 첫 판: 수업을 다 한 사람의 새 판
await ev(() => { const a = window.__app; a.records.lessonsDone = true; a.saveRecords(); a.nextSeed = 7; a.newRun(); });
await settle(1400);
await shot(`first-${await screen()}`);
if ((await screen()) === 'draft') {
  await hoverId('draft:0');
  await shot('draft-hover');
  await clickId('draft:0');
  await settle(1000);
}
await shot(`then-${await screen()}`);
if ((await screen()) === 'select') { await clickId('select:play'); await settle(2600); }
await shot('battle-first');
await hoverId('hand:0');
await shot('battle-hand-hover');

// 대국을 끝까지(봇)
async function finishBattle() {
  for (let g = 0; g < 60; g++) {
    if ((await screen()) !== 'battle') return;
    await idle();
    const d = await ev(async () => {
      const { decideBattle } = await import('/tools/bot.mjs');
      const b = window.__app.run && window.__app.run.battle;
      if (b && b.status === 'chain') {
        const { chainCaptures, chainRedrops } = await import('/src/sim/chain.js');
        const l = b.chain.awaiting ? chainRedrops(b) : chainCaptures(b);
        return { sqs: [l[0]], redrop: !!b.chain.awaiting };
      }
      if (!b || b.status !== 'play') return null;
      const d = decideBattle(b);
      return d && (d.play ? { hand: d.play.handIndex, sq: d.play.sq } : { discard: d.discard });
    });
    if (!d) { await settle(200); continue; }
    if (d.sqs) { await clickId(`sq:${d.sqs[0]}`); continue; }
    if (d.discard) { for (const i of d.discard) await clickId(`hand:${i}`); await clickId('btn:discard'); continue; }
    await clickId(`hand:${d.hand}`); await clickId(`sq:${d.sq}`);
  }
}
async function throughToShop() {
  for (let g = 0; g < 12; g++) {
    const s = await screen();
    if (s === 'shop' || s === 'draft' || s === 'select' || s === 'result') return s;
    if (s === 'battle') { await finishBattle(); continue; }
    const has = await region('next');
    if (has) await clickId('next'); else await settle(400);
  }
  return screen();
}
await finishBattle();
await settle(1200);
await shot(`after-battle-${await screen()}`);
await throughToShop();
await ev(() => { window.__app.run.money = 30; });
await settle(300);
await shot('shop-first');
await hoverId('shop:buy:0');
await shot('shop-hover-item');
// 꾸러미 하나(각인 꾸러미를 보이게 바꿔서)
await ev(() => { const r = window.__app.run; r.shop.packs[0] = { kind: 'engraving', price: 4, sold: false }; r.shop.packs[1] = { kind: 'chart', price: 4, sold: false }; });
await clickId('shop:pack:0');
await settle(1600);
await shot('pack-engraving');
await clickId('pack:pick:0');
await settle(300);
await shot('pack-engraving-target');
await ev(() => { const a = window.__app; a.cmd({ type: 'skipPack' }); a.goPhase(); });
await settle(300);
await clickId('shop:pack:1');
await settle(1600);
await shot('pack-chart');
await ev(() => { const a = window.__app; a.cmd({ type: 'skipPack' }); a.goPhase(); });
await settle(300);
// 두루마리 칸에 각인 · 혼 · 진화 · 묘수
await ev(() => { const r = window.__app.run; r.consumableSlots = 4; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }]; });
await settle(200);
await shot('shop-scrolls');

// ── 4. 3관: 정석 둘째 · 명인
await ev(() => { const a = window.__app, r = a.run; r.ante = 3; r.blind = 0; r.phase = 'select'; r.drafted = [1]; r.draft = null; });
await ev(async () => { const a = window.__app, r = a.run; const { JOSEKIS } = await import('/src/data/josekis.js'); r.draft = { ante: 3, options: JOSEKIS.filter((j) => j.tier !== 'silver').slice(0, 3).map((j) => j.id) }; r.phase = 'draft'; a.goPhase(); });
await settle(1400);
await shot('draft-ante3');
await ev(() => { const a = window.__app, r = a.run; r.draft = null; r.phase = 'select'; r.blind = 2; a.goPhase(); });
await settle(300);
await shot('select-master');

// ── 5. 5관 대국: 이형 적 · 특성 · 사물 · 가족 띠 · 정석 표
await ev(() => {
  const a = window.__app, r = a.run;
  r.ante = 5; r.blind = 0; r.phase = 'select'; r.josekis = ['gates', 'stepping'];
  r.maxims = [{ uid: 90, id: 'chivalry', data: {} }, { uid: 91, id: 'light_step', data: {} }, { uid: 92, id: 'mad_horse', data: {} }];
  r.deck.push({ id: 80, t: 'O', eng: null }, { id: 81, t: 'S', eng: null, soul: 'echo' });
  a.cmd({ type: 'play' });
  a.go('battle', { events: [] });
});
await settle(2600);
await shot('battle-ante5');
const tsq = await ev(() => { const b = window.__app.run.battle; const i = b.board.findIndex((c) => c && c.trait); return i; });
if (tsq >= 0) { await hoverId(`sq:${tsq}`); await shot('battle-trait-hover'); }
await hoverId('fam:leap');
await shot('battle-family-hover');

console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
