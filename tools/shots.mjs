// 화면별 스크린샷: 실제 브라우저(Playwright chromium)로 index.html을 열고 앱을 몰아 화면마다 PNG를 docs/shots/에 남긴다.
//   node tools/shots.mjs [--only battle] [--out docs/shots]
// 480×270 원본(<이름>.png)과 3배 확대(<이름>@3x.png). Playwright는 저장소 의존성에 넣지 않는다(전역 설치나 npx -y로).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/shots'));
const ONLY = opt('--only', null);

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  const g = execSync('npm root -g').toString().trim();
  return import(path.join(g, 'playwright', 'index.mjs'));
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json' };
function serve() {
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((ok) => srv.listen(0, () => ok(srv)));
}

const { chromium } = await loadPlaywright();
const srv = await serve();
const port = srv.address().port;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`http://localhost:${port}/index.html`);
await page.waitForFunction(() => window.__app && window.__app.screen);
fs.mkdirSync(OUT, { recursive: true });

// 앱을 몇 프레임 돌리고(연출 끝까지) 캔버스를 PNG로
const settle = (ms = 400) => page.waitForTimeout(ms);
async function shot(name) {
  if (ONLY && !name.includes(ONLY)) return;
  const urls = await page.evaluate(() => {
    const c = document.getElementById('screen');
    const big = document.createElement('canvas');
    big.width = c.width * 3; big.height = c.height * 3;
    const g = big.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(c, 0, 0, big.width, big.height);
    return [c.toDataURL('image/png'), big.toDataURL('image/png')];
  });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(urls[0].split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, `${name}@3x.png`), Buffer.from(urls[1].split(',')[1], 'base64'));
  console.log('찍음', name);
}
const ev = (fn, arg) => page.evaluate(fn, arg);
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !(s.name === 'battle' && s.busy); }, null, { timeout: 20000 });
// 게임 좌표를 누른다(캔버스 CSS 크기가 480×270이면 그대로)
async function clickAt(gx, gy) {
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + ((gx + 0.5) * box.width) / 480, box.y + ((gy + 0.5) * box.height) / 270);
  await page.mouse.down(); await page.mouse.up();
}
async function clickId(id) {
  const r = await ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  if (!r) throw new Error(`no region ${id}`);
  await clickAt(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2));
  await settle(60);
}
async function hoverId(id) {
  const r = await ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
  if (!r) return;
  const box = await page.locator('#screen').boundingBox();
  await page.mouse.move(box.x + r.x + r.w / 2, box.y + r.y + r.h / 2);
  await settle(80);
}

// 기물 12종 식별 시험(mockup의 시트): 흰 · 검은 · 금빛 기물을 밝은 칸과 어두운 칸에
await ev(async () => {
  const { spriteCanvas } = await import('/src/render/sprites.js');
  const c = document.getElementById('screen');
  const a = window.__app;
  a.go('title');
  a.draw = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#0e1513'; g.fillRect(0, 0, 480, 270);
    ['P', 'N', 'B', 'R', 'Q', 'K'].forEach((t, i) => ['w', 'b', 'g', 's', 'q'].forEach((side, row) => [0, 1].forEach((k) => {
      const x = 36 + (i * 2 + k) * 34, y = 40 + row * 34;
      g.fillStyle = k ? '#a4744a' : '#e2cda2'; g.fillRect(x, y, 28, 28);
      g.drawImage(spriteCanvas(t, side), x + 6, y + 3);
    })));
  };
});
await settle(200);
await shot('00-sprites');
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen);
await ev(() => { window.__app.settings.speed = 2; });
await settle(900);
await shot('01-title');

await ev(() => { localStorage.clear(); window.__app.newRun({ seed: 7 }); });
await settle(200);
await shot('02-select');
await clickId('select:play');
await settle(2400);
await shot('03-battle');
// 가장 좋은 수를 찾아 기물을 들고, 한 칸씩 먹는다
const plan = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
  return { hand: d.handIndex, sq: d.sq, line: d.line };
});
await clickId(`hand:${plan.hand}`);
await settle(300);
await shot('04-battle-lift');
await clickId(`sq:${plan.sq}`);
await idle();
for (let i = 0; i < plan.line.length - 1; i++) { await clickId(`sq:${plan.line[i]}`); await idle(); }
await settle(200);
await shot('05-battle-chain');
await hoverId('maxim:0');
await clickId(`sq:${plan.line[plan.line.length - 1]}`);
await page.waitForTimeout(260);
await shot('06-battle-end');
await idle();
// 대국을 끝까지(봇)
async function finishBattle() {
  for (let g = 0; g < 40; g++) {
    const name = await ev(() => window.__app.screen.name);
    if (name !== 'battle') return;
    await idle();
    const d = await ev(async () => {
      const { decideBattle } = await import('/tools/bot.mjs');
      const b = window.__app.run.battle;
      if (b && b.status === 'chain') {
        const { chainCaptures, chainRedrops } = await import('/src/sim/chain.js');
        const l = b.chain.awaiting ? chainRedrops(b) : chainCaptures(b);
        return { sqs: [l[0]] };
      }
      if (!b || b.status !== 'play') return null;
      const d = decideBattle(b);
      return d && (d.play ? { hand: d.play.handIndex, sq: d.play.sq, line: d.play.line } : { discard: d.discard });
    });
    if (!d) { await settle(100); continue; }
    if (d.sqs) { await clickId(`sq:${d.sqs[0]}`); await idle(); continue; }
    if (d.discard) { for (const i of d.discard) await clickId(`hand:${i}`); await clickId('btn:discard'); await idle(); continue; }
    await clickId(`hand:${d.hand}`); await clickId(`sq:${d.sq}`); await idle();
    for (const c of d.line) { if (typeof c !== 'number') { await clickId(`sq:${c.sq}`); await idle(); continue; } await clickId(`sq:${c}`); await idle(); }
  }
}
await finishBattle();
await settle(1500);
await shot('07-reward');
await clickId('next');
await settle(300);
await ev(() => { const r = window.__app.run; r.money = 30; });
await settle(100);
await shot('08-shop');
await hoverId('shop:buy:0');
await shot('09-shop-tip');
await ev(() => { const r = window.__app.run; if (r.shop.packs[0].sold) r.shop.packs[0].sold = false; });
await clickId('shop:pack:0');
await settle(1200);
await shot('10-pack');
await ev(() => { window.__app.go('chest', { chest: { count: 3, tier: 'uncommon', cells: [{ lit: false, item: null }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'engrave', piece: 'P', pieceId: 1, eng: 'ivory' } }, { lit: false, item: null }] } }); });
await settle(300);
await shot('11-chest-spin');
await settle(2600);
await shot('12-chest');
await ev(() => { window.__app.go('legend', { legend: 'immortal' }); });
await settle(1200);
await shot('13-legend');
await ev(() => { window.__app.openOverlay('pause'); });
await settle(100);
await shot('14-pause');
await ev(() => { window.__app.openOverlay('settings', { back: 'pause' }); });
await settle(100);
await shot('15-settings');
await ev(() => { const a = window.__app; a.closeOverlay(); a.run.phase = 'lost'; a.run.log.push({ ante: a.run.ante, blind: 1, kind: 'official', score: 740, target: 900, best: 420, won: false }); a.go('result'); });
await settle(200);
await shot('16-result');

// 짜임이 찬 판: 격언 다섯(판본 · 전설), 조각, 두루마리
await ev(() => {
  const a = window.__app;
  a.closeOverlay();
  localStorage.clear();
  a.newRun({ seed: 11 });
  const r = a.run;
  const add = (id, edition = null, legendary = false) => r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5, ...(legendary ? { legendary: true } : {}) });
  add('quick_change', 'foil'); add('first_move'); add('whim', 'rainbow'); add('wall_breaker'); add('sacrifice'); add('immortal', null, true);
  r.legends.push('immortal');
  r.fragments.century = { first: true, feat: false, gold: false };
  r.fragments.opera = { first: true, feat: true, gold: false };
  r.consumables.push({ kind: 'chart', form: 'Q' }, { kind: 'engraving', id: 'glass' });
  r.deck[0].eng = { id: 'glass' }; r.deck[4].eng = { id: 'ivory' }; r.deck[6].eng = { id: 'ebony' };
  r.money = 23;
  a.cmd({ type: 'play' });
  a.go('battle', { events: [] });
});
await settle(2400);
const plan2 = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
  return { hand: d.handIndex, sq: d.sq, line: d.line };
});
await clickId(`hand:${plan2.hand}`);
await clickId(`sq:${plan2.sq}`);
await idle();
for (let i = 0; i < Math.min(2, plan2.line.length - 1); i++) { await clickId(`sq:${plan2.line[i]}`); await idle(); }
await hoverId('frag:century');
await shot('17-battle-full');
await finishBattle();
await settle(1500);
for (let g = 0; g < 6; g++) {
  const n = await ev(() => window.__app.screen.name);
  if (n === 'shop' || n === 'result') break;
  const has = await ev(() => !!window.__app.ui.regions.find((x) => x.id === 'next'));
  if (has) await clickId('next');
  await settle(400);
}
if ((await ev(() => window.__app.screen.name)) === 'shop') {
  await hoverId('maxim:2');
  await shot('18-shop-full');
} else console.log('상점까지 못 갔다:', await ev(() => window.__app.screen.name));

console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
