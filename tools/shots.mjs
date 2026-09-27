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
const idle = () => page.waitForFunction(() => { const s = window.__app.screen; return !((s.name === 'battle' || s.name === 'lesson') && s.busy); }, null, { timeout: 20000 });
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
// 이형 아홉을 체스 여섯과 나란히(1배에서 갈리나): 흰 · 검은 · 금빛, 밝은 칸과 어두운 칸
await ev(async () => {
  const { spriteCanvas } = await import('/src/render/sprites.js');
  const c = document.getElementById('screen');
  window.__app.draw = () => {
    const g = c.getContext('2d');
    g.fillStyle = '#0e1513'; g.fillRect(0, 0, 480, 270);
    ['P', 'N', 'B', 'R', 'Q', 'K', 'A', 'C', 'Z', 'L', 'H', 'G', 'O', 'S', 'W'].forEach((t, i) => ['w', 'b', 'g'].forEach((side, row) => [0, 1].forEach((k) => {
      const x = 8 + i * 31, y = 30 + (row * 2 + k) * 34;
      g.fillStyle = (i + k) % 2 ? '#a4744a' : '#e2cda2'; g.fillRect(x, y, 28, 28);
      g.drawImage(spriteCanvas(t, side), x + 6, y + 3);
    })));
  };
});
await settle(200);
await shot('00-fairies');
// 명인 초상 여덟(2배)
await ev(async () => {
  const { portraitCanvas, PORTRAIT_IDS } = await import('/src/render/portraits.js');
  const c = document.getElementById('screen');
  window.__app.draw = () => {
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1b2b27'; g.fillRect(0, 0, 480, 270);
    PORTRAIT_IDS.forEach((id, i) => g.drawImage(portraitCanvas(id), 20 + (i % 4) * 116, 20 + Math.floor(i / 4) * 120, 96, 96));
  };
});
await settle(200);
await shot('00-portraits');
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen);
await ev(() => { window.__app.settings.speed = 2; });
await settle(900);
await shot('01-title');

// 응수가 걸린 순간(노림수 빗금): seed 3 첫 대국 최선 수의 첫 먹기 뒤
await ev(() => { localStorage.clear(); const a = window.__app; a.newRun({ seed: 3 }); a.cmd({ type: 'play' }); a.go('battle', { events: [] }); });
await settle(2600);
const plan3 = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
  return { hand: d.handIndex, sq: d.sq, line: d.line };
});
await clickId(`hand:${plan3.hand}`);
await clickId(`sq:${plan3.sq}`);
await idle();
await clickId(`sq:${plan3.line[0]}`);
await idle();
await settle(90);
await shot('05b-battle-forced');
// 노림수 칸에 올리면 말풍선
const atk = await ev(() => { const s = window.__app.screen; return s.view.chain.forced.find((q) => s.clickable().list.includes(q)); });
await hoverId(`sq:${atk}`);
await settle(120);
await shot('27-forced-tip');
await hoverId(`sq:${plan3.line[1]}`);
await settle(120);
await shot('20-preview-reply');
// 사슬이 끝나면 증원이 위에서 떨어져 들어온다(한가운데 한 장). 한 수로 이기지 않게 목표를 올려 둔다
await ev(() => { localStorage.clear(); const a = window.__app; a.newRun({ seed: 3 }); a.cmd({ type: 'play' }); a.run.battle.target = 99999; a.go('battle', { events: [] }); });
await settle(2600);
const plan4 = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
  return { hand: d.handIndex, sq: d.sq, line: d.line };
});
await clickId(`hand:${plan4.hand}`);
await clickId(`sq:${plan4.sq}`);
for (const q of plan4.line) { await idle(); await clickId(`sq:${q}`); }
await page.waitForFunction(() => { const s = window.__app.screen; return s.falls && [...s.falls.values()].some((t) => t > 0.07); }, null, { timeout: 8000, polling: 'raf' }).catch(() => {});
await shot('27d-reinforce-fall');
// 명인 규칙 글이 카드와 띠에 들어가는지: 가장 긴 글(안개)
await ev(() => { localStorage.clear(); const a = window.__app; a.newRun({ seed: 3 }); a.run.masters[0] = 'fog'; a.goPhase(); });
await settle(200);
await shot('02b-select-fog');
await ev(() => { const a = window.__app; a.cmd({ type: 'skip' }); a.cmd({ type: 'skip' }); a.goPhase(); });
await settle(200);
await clickId('select:play');
await settle(600);
await shot('02c-fog-banner');
// 명인 대국 들어가기(초상이 들어오는 띠)
await ev(() => { localStorage.clear(); const a = window.__app; a.newRun({ seed: 3 }); a.cmd({ type: 'skip' }); a.cmd({ type: 'skip' }); a.goPhase(); });
await settle(100);
await clickId('select:play');
await settle(450);
await shot('02-master-banner');
await ev(() => { localStorage.clear(); window.__app.newRun({ seed: 7 }); });
await settle(200);
await shot('02-select');
// 판의 길(8관 왕관)에 올리면 말풍선
await hoverId('select:path');
await settle(120);
await shot('27c-select-path-tip');
await clickId('select:play');
await settle(2400);
await shot('03-battle');
// 증원 그림자에 올리면 말풍선
const gsq = await ev(() => { const b = window.__app.run.battle; const r = b.incoming.find((x) => !b.board[x.sq]); return r ? r.sq : null; });
if (gsq != null) { await hoverId(`sq:${gsq}`); await settle(120); await shot('27b-incoming-tip'); }
// 가장 좋은 수를 찾아 기물을 들고, 한 칸씩 먹는다
const plan = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
  return { hand: d.handIndex, sq: d.sq, line: d.line };
});
await clickId(`hand:${plan.hand}`);
await settle(300);
await shot('04-battle-lift');
await hoverId(`sq:${plan.sq}`);
await settle(120);
await shot('20-preview-drop');
await clickId(`sq:${plan.sq}`);
await idle();
await hoverId(`sq:${plan.line[0]}`);
await settle(150);
await shot('20-preview');
for (let i = 0; i < plan.line.length - 1; i++) {
  await clickId(`sq:${plan.line[i]}`);
  // 모습이 바뀐 순간: 새 이름이 떠오르고 한 박자 멈춘다
  if (i === 0) { await page.waitForFunction(() => { const c = window.__app.screen.seq.cur; return c && c.label === 'hold'; }, null, { timeout: 5000 }).catch(() => {}); await shot('26-chain-name'); }
  await idle();
}
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
// 넘친 목표 도장은 제목 옆(보상 줄을 덮지 않게)
await ev(() => { const l = window.__app.screen.last; l.overflowWas = l.overflow; l.overflow = 10; });
await settle(60);
await shot('07b-reward-overflow');
await ev(() => { const l = window.__app.screen.last; l.overflow = l.overflowWas; delete l.overflowWas; });
await clickId('next');
await settle(300);
await ev(() => { const r = window.__app.run; r.money = 30; });
await settle(100);
await shot('08-shop');
await hoverId('shop:buy:0');
await shot('09-shop-tip');
await ev(() => { const r = window.__app.run; if (r.shop.packs[0].sold) r.shop.packs[0].sold = false; });
await clickId('shop:pack:0');
await settle(160);
await shot('10a-pack-seal');
await settle(1100);
await shot('10-pack');
await ev(() => { window.__app.go('chest', { chest: { count: 3, tier: 'uncommon', cells: [{ lit: false, item: null }, { lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'engrave', piece: 'P', pieceId: 1, eng: 'ivory' } }, { lit: false, item: null }] } }); });
await settle(300);
await shot('11-chest-spin');
await settle(2600);
await shot('12-chest');
await ev(() => { window.__app.settings.speed = 1; window.__app.go('legend', { legend: 'immortal' }); });
await settle(1500);
await shot('13-legend-replay');
await settle(1900);
await shot('13-legend');
await ev(() => { window.__app.go('legend', { legend: 'eight_pawns' }); });
await settle(3800);
await shot('13-legend-pawns');
await ev(() => { window.__app.settings.speed = 2; });
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
// 평가 불빛 · 점수 불꽃(목표 ×5)
await ev(() => { const s = window.__app.screen; s.glow = { mark: '!!!', fade: 0 }; s.stamp = { mark: '!!!', t: 0.3, life: 1.1, col: '#df5a45' }; s.view.score = s.view.target * 6; });
await page.mouse.move(1, 1);
await settle(500);
await shot('17-battle-fire');
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

// 판 밖: 판 준비 · 도감 · 기록(기록을 조금 채워서)
await ev(() => {
  const a = window.__app;
  const r = a.records;
  r.runs = 7; r.wins = 1; r.bestAnte = 8; r.mates = 3; r.legends = 1; r.grades = { '!!!': 2 };
  r.unlocked = { openings: ['standard', 'london', 'queens_gambit'], dan: 2 };
  r.bestMove = { score: 48210, steps: ['N', 'B', 'R', 'Q', 'P', 'Q', 'R', 'K'], ante: 6 };
  for (const id of ['quick_change', 'first_move', 'whim', 'wall_breaker', 'sacrifice', 'edge', 'center', 'chivalry', 'payback', 'coronation']) r.codex.maxims[id] = true;
  for (const id of ['fog', 'mirror', 'grandmaster']) r.codex.masters[id] = true;
  r.codex.legends = { immortal: 3, century: 1 }; r.codex.legendsDone = { immortal: true };
  r.codex.editions = { foil: true, rainbow: true };
  a.go('setup');
});
await settle(200);
await shot('19-setup');
await ev(() => window.__app.go('codex'));
await settle(100);
await hoverId('codex:whim');
await shot('20-codex');
await clickId('codex:tab:legends');
await hoverId('codex:immortal');
await shot('21-codex-legends');
await ev(() => window.__app.go('records'));
await settle(100);
await shot('22-records');
await ev(() => window.__app.go('title'));
await settle(300);
await shot('01-title');

// 첫 수업 넷: 1 시범 손가락 · 2 미리 보기가 처음 나오는 내 차례 · 3 넷을 이은 끝(「!」 · 막대) · 4 시범의 끊김
const inLesson = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 20000 });
await ev(() => window.__app.go('lesson', { index: 0 }));
await inLesson(() => { const s = window.__app.screen; return s.demo && s.demo.i === 1 && s.demo.stage === 'move' && s.demo.t > 0.4; });
await shot('21-lesson-1');
await ev(() => window.__app.go('lesson', { index: 1, phase: 'play' }));
await settle(200);
await clickId('hand:0');
await clickId('sq:10');
await idle();
await hoverId('sq:27');
await settle(200);
await shot('21-lesson-2');
await ev(() => window.__app.go('lesson', { index: 2, phase: 'play' }));
await settle(200);
await clickId('hand:0');
await clickId('sq:52');
for (const sq of [35, 11, 47]) { await idle(); await clickId(`sq:${sq}`); }
await idle();
await clickId('sq:15');
await inLesson(() => { const v = window.__app.screen.view; return v.gather && v.gather.burst; });
await settle(90);
await shot('21-lesson-3');
await ev(() => window.__app.go('lesson', { index: 3 }));
await inLesson(() => { const v = window.__app.screen.view; return v.cut && v.cut.p > 0.5; });
await shot('21-lesson-4');

// 끝없는 대국의 관 선택(판의 길 대신 「끝없는 대국 N관」)
await ev(() => { localStorage.removeItem('chainmate.run.v1'); const a = window.__app; a.newRun({ seed: 7 }); a.run.endless = true; a.run.ante = 9; a.goPhase(); });
await settle(200);
await shot('02e-select-endless');

// 타이틀 시연: 흐린 판에서 풀이기가 사슬을 두는 중
await ev(() => window.__app.go('title'));
await page.waitForFunction(() => { const c = window.__app.screen.demo.view.chain; return c && c.path.length >= 4 && !window.__app.screen.demo.view.mover; }, null, { timeout: 30000 });
await shot('22-title-demo');

// 각인 여섯이 손 · 판 · 상점에: 주머니 기물에 각인을 새기고 대국을 연다
await ev(() => {
  const a = window.__app;
  localStorage.removeItem('chainmate.run.v1');
  a.newRun({ seed: 11 });
  const r = a.run;
  ['gold', 'silver', 'ivory', 'ebony', 'glass', 'feather'].forEach((id, i) => { r.deck[i + 2].eng = { id }; });
  r.charts.N = 3; r.charts.B = 5;
  a.cmd({ type: 'play' });
  const b = r.battle;
  b.hand = r.deck.slice(2, 6).map((p) => JSON.parse(JSON.stringify(p)));
  a.go('battle', { events: [] });
});
await settle(2400);
const plan5 = await ev(async () => {
  const { bestMove } = await import('/src/sim/solver.js');
  const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
  return d && { hand: d.handIndex, sq: d.sq, line: d.line };
});
if (plan5) {
  await clickId(`hand:${plan5.hand}`);
  await clickId(`sq:${plan5.sq}`);
  await idle();
  if (plan5.line.length > 1) { await clickId(`sq:${plan5.line[0]}`); await idle(); }
}
await page.mouse.move(1, 1);
await settle(150);
await shot('27-engravings-battle');
await ev(() => {
  const a = window.__app, r = a.run;
  r.money = 40;
  r.phase = 'shop';
  r.battle = null;
  r.shop = { rng: null, display: [{ kind: 'engraving', id: 'glass', price: 4 }, { kind: 'chart', form: 'N', price: 3 }], packs: [{ kind: 'engraving', price: 4 }, { kind: 'piece', price: 4 }], rerolls: 0, promoted: false, removed: false };
  r.consumables = [{ kind: 'engraving', id: 'feather' }, { kind: 'engraving', id: 'ebony' }];
  a.go('shop');
});
await settle(300);
await shot('27-engravings-shop');
// 기보 단계 넷(0 · 1~2 · 3~4 · 5~), 각인과 겹친 모습
await ev(async () => {
  const { spriteCanvas, tierSparkle } = await import('/src/render/sprites.js');
  const c = document.getElementById('screen');
  window.__app.draw = () => {
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#1b2b27'; g.fillRect(0, 0, 480, 270);
    ['P', 'N', 'B', 'R', 'Q', 'K'].forEach((t, i) => [0, 1, 2, 3].forEach((tier, row) => {
      const x = 20 + i * 34, y = 16 + row * 34;
      g.fillStyle = (i + row) % 2 ? '#a4744a' : '#e2cda2'; g.fillRect(x, y, 28, 28);
      g.drawImage(spriteCanvas(t, 'w', null, tier), x + 6, y + 3);
      if (tier === 3) tierSparkle(g, x + 6, y + 3);
    }));
    ['gold', 'silver', 'ivory', 'ebony', 'glass', 'feather'].forEach((eng, i) => [0, 3].forEach((tier, row) => {
      const x = 240 + i * 34, y = 16 + row * 34;
      g.fillStyle = (i + row) % 2 ? '#a4744a' : '#e2cda2'; g.fillRect(x, y, 28, 28);
      g.drawImage(spriteCanvas('N', 'w', eng, tier), x + 6, y + 3);
      if (tier === 3) tierSparkle(g, x + 6, y + 3);
    }));
    [0, 3].forEach((tier, i) => { g.drawImage(spriteCanvas('N', 'w', null, tier), 250 + i * 80, 100, 64, 88); g.drawImage(spriteCanvas('Q', 'w', null, tier), 290 + i * 80, 196, 32, 44); });
  };
});
await settle(200);
await shot('28-tiers');
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen);

// 영어 화면 셋(대국 · 상점 · 판 준비)
await ev(() => { const a = window.__app; a.settings.lang = 'en'; a.saveSettings(); });
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen);
await settle(300);
await shot('23-en-title');
await ev(() => { const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.newRun({ seed: 7 }); a.cmd({ type: 'play' }); a.go('battle', { events: [] }); });
await settle(2600);
await hoverId('hand:0');
await shot('24-en-battle');
await ev(() => { const a = window.__app; a.go('setup'); });
await settle(200);
await shot('25-en-setup');
await ev(() => window.__app.go('lesson', { index: 1, phase: 'play' }));
await settle(200);
await shot('25b-en-lesson');
await ev(() => { const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.newRun({ seed: 7 }); a.run.ante = 3; a.goPhase(); });
await settle(200);
await shot('25c-en-select');
await ev(() => { const a = window.__app; a.settings.lang = 'ko'; a.saveSettings(); });

console.log(errors.length ? `페이지 오류 ${errors.length}\n${errors.join('\n')}` : '페이지 오류 0');
await browser.close();
srv.close();
