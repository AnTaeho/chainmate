// 코어 판 캡처 묶음(CHM-79): 실제 코어 판을 봇으로 두며 장면마다 3배(1440 × 810)로 찍는다. 프레임은 도구가 넘긴다(연출 순간을 잡으려고).
//   node tools/shots-core.mjs [--out <폴더>] [--lang ko,en] [--seed 7]
// 장면(한국어): 관 선택(연습 · 마스터) · 대국 시작 · 미리 보기(놓기 전 값 × 배수) · 콤보 중 · 콤보 끝 배수 쌓임 · 끊김 · 목표 넘긴 뒤 이어 두기 ·
//   대국 승리(보상 상자가 열리는 순간) · 보상 · 상점 · 팩 · 마스터전 등장 · 마스터전 시작 · 상자 · 다음 관 · 5관 관 선택(기보 칸) · 5관 대국(격언 다섯 · 기보) · 판 패배 결과.
//   영어는 관 선택 · 대국 시작 · 콤보 중 · 쌓임 · 이어 온 배수
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveRoot } from './_lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs/shots/core')));
const LANGS = opt('--lang', 'ko,en').split(',');
const SEED = Number(opt('--seed', '7'));
const W = 1440, H = 810; // 480 × 270의 3배

const srv = await serveRoot(ROOT);
const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const errors = [];
fs.mkdirSync(OUT, { recursive: true });
const RECORDS = { v: 1, runs: 3, wins: 0, bestAnte: 2, tutorialAsked: true, lessonsDone: true };

let page = null, T = 0;
const ev = (fn, arg) => page.evaluate(fn, arg);
async function open(lang) {
  if (page) await page.close();
  page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));
  // 게임 루프를 잡는다: requestAnimationFrame은 콜백을 맡아 두기만 하고 frame()이 시각을 넘겨 부른다
  await page.addInitScript(() => { window.__raf = null; window.requestAnimationFrame = (cb) => { window.__raf = cb; return 1; }; });
  await page.goto(`http://localhost:${srv.address().port}/index.html`);
  await page.evaluate(([rec, lang]) => {
    localStorage.clear();
    localStorage.setItem('chainmate.settings.v1', JSON.stringify({ lang, speed: 1, volume: 0, music: 0 }));
    localStorage.setItem('chainmate.records.v1', JSON.stringify(rec));
  }, [RECORDS, lang]);
  await page.reload();
  await page.waitForFunction(() => window.__app && window.__app.screen && window.__raf, null, { timeout: 20000 });
  T = 0;
  // 처음 안내 · 업적 알림은 끈다(장면을 가리지 않게 — 안내는 smoke가 잰다)
  await ev(async () => {
    const a = window.__app; const { HINTS } = await import('/src/ui/coach.js');
    a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true]));
    a.saveRecords();
    a.achieve = () => [];
  });
}
async function frame(n = 1) {
  for (let i = 0; i < n; i++) {
    T += 1000 / 60;
    await ev((t) => { const a = window.__app; a.achvQueue.length = 0; a.toasts = a.toasts.filter((x) => !x.achv); const cb = window.__raf; window.__raf = null; if (cb) cb(t); }, T);
  }
}
const state = () => ev(() => { const a = window.__app, s = a.screen; return { name: a.overlay ? a.overlay.name : s && s.name, busy: !!(s && s.busy), banner: !!(s && s.banner), intro: !!(s && s.intro), phase: a.run && a.run.phase }; });
// 대국 연출이 끝날 때까지(띠 · 등장 · 연출)
async function idle(max = 900) {
  for (let i = 0; i < max; i++) {
    const s = await state();
    if (!(s.name === 'battle' && (s.busy || s.banner || s.intro))) return s;
    await frame(2);
  }
  throw new Error('연출이 끝나지 않는다');
}
// 날아다니는 연출 · 알림이 다 걷힐 때까지
const settle = async () => { await idle(); for (let i = 0; i < 120; i++) { const q = await ev(() => { const a = window.__app; return a.fx.list.length + a.toasts.length; }); if (!q) return; await frame(4); } };
async function shot(name, { move = true } = {}) {
  if (move) await page.mouse.move(1, 1);
  await frame(1);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('찍음', file);
}
const toXY = (gx, gy) => [((gx + 0.5) * W) / 480, ((gy + 0.5) * H) / 270];
const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
async function hover(id) {
  const r = await region(id);
  if (!r) throw new Error('구역이 없다: ' + id);
  const [x, y] = toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 14));
  await page.mouse.move(x, y);
  await frame(3);
}
// 봇의 다음 결정(놓기 + 잡기들) · 끊김으로 끝나는 줄(cut) · 끊기지 않고 둘 이상 잡는 줄(keep)
const plan = (kind = 'bot') => ev(async (kind) => {
  const { stepBattle } = await import('/tools/bot.mjs');
  const { apply, dropSquaresFor } = await import('/src/sim/battle.js');
  const { cloneBattle } = await import('/src/sim/replay.js');
  const { chainCaptures } = await import('/src/sim/chain.js');
  const b = window.__app.run.battle;
  if (kind !== 'bot') {
    const ok = (h) => (kind === 'cut' ? h.reason === 'cut' && h.captures >= 1 : h.reason !== 'cut' && h.captures >= 2);
    let nodes = 0, found = null;
    const dfs = (u, cmds) => {
      if (found || nodes++ > 6000) return;
      if (u.status !== 'chain') { const h = u.history[u.history.length - 1]; if (h && ok(h)) found = cmds; return; }
      for (const sq of chainCaptures(u)) { const v = cloneBattle(u); apply(v, { type: 'capture', sq }); dfs(v, [...cmds, { type: 'capture', sq }]); if (found) return; }
    };
    for (let i = 0; i < b.hand.length && !found; i++) for (const sq of dropSquaresFor(b, b.hand[i])) {
      const u = cloneBattle(b); const c = { type: 'drop', handIndex: i, sq }; apply(u, c); dfs(u, [c]); if (found) break;
    }
    return found;
  }
  const u = cloneBattle(b), cmds = [];
  stepBattle(u, (c) => { cmds.push(c); return apply(u, c); }, {});
  return cmds;
}, kind);
const send = async (c) => { await ev((c) => window.__app.screen.send(c), c); };
async function playCmds(cmds) { for (const c of cmds) { await send(c); await idle(); } }
// 마지막 명령을 보낸 뒤 이어 온 배수가 바뀌는 순간(쌓임 · 끊김)을 찍는다
async function playMoment(cmds, name) {
  await playCmds(cmds.slice(0, -1));
  const t0 = await ev(() => (window.__app.screen.streakFx ? window.__app.screen.streakFx.t : -1));
  await send(cmds[cmds.length - 1]);
  for (let i = 0; i < 600; i++) { if (await ev((t0) => { const f = window.__app.screen.streakFx; return !!(f && f.t !== t0); }, t0)) break; await frame(1); }
  await frame(8);
  await shot(name);
  await idle();
}
// 대국이 끝날 때까지 봇이 둔다. stop()이 참이면 멈춘다. win: 이기는 순간(「대국 승리」 걸음)을 찍을 이름
async function playBattle({ stop = null, win = null } = {}) {
  for (let g = 0; g < 60; g++) {
    const s = await state();
    if (s.name !== 'battle' || s.phase !== 'battle') return;
    if (stop && (await stop())) return;
    const cmds = await plan();
    if (!cmds.length) return;
    if (!win) { await playCmds(cmds); continue; }
    await playCmds(cmds.slice(0, -1));
    await send(cmds[cmds.length - 1]);
    // 이긴 순간: 「대국 승리」 걸음은 긴 수 뒤쪽에서 한 프레임보다 짧아져(pace) 곧바로 보상 상자로 넘어간다 — 상자가 열리고 색종이가 떨어지는 순간을 찍는다
    let won = false;
    for (let i = 0; i < 900; i++) {
      const st = await state();
      if (st.name === 'reward') { won = true; break; }
      if (st.name !== 'battle' || !st.busy) break;
      await frame(1);
    }
    if (won) { await frame(12); await shot(win); win = null; return; }
    await idle();
  }
}
// 막간(보상 · 상자)을 넘긴다
async function nextFlow() {
  const from = (await state()).name;
  for (let i = 0; i < 6 && (await state()).name === from; i++) { await ev(() => { const a = window.__app; if (a.screen && a.screen.next) a.screen.next(); else a.goPhase(); }); await frame(30); }
}
const leaveShop = () => ev(() => { const a = window.__app; if (a.run.phase === 'shop') { a.cmd({ type: 'leave' }); a.goPhase(); } });
const toBattle = async () => { await ev(() => window.__app.screen.play()); await idle(); await settle(); };
// 판을 봇으로 민다(화면 없이 — 장면을 세울 때만): stop 식이 참이 되는 국면에서 멈추고 그 화면으로
const fastForward = (policy, stop) => ev(async ([policy, stop]) => {
  const { playRun } = await import('/tools/shopbot.mjs');
  const a = window.__app;
  playRun(a.run, policy, { stopAt: new Function('r', `return ${stop}`) });
  a.save(); a.goPhase();
}, [policy, stop]);

for (const lang of LANGS) {
  const L = (k) => `${k}-${lang}`;
  await open(lang);
  await ev((seed) => window.__app.newRun({ seed }), SEED);
  await frame(30);
  await shot(L('01-select-practice'));
  await toBattle();
  await shot(L('02-battle-start'));
  // 첫 수: 끊기지 않고 둘 이상 잡는 줄 — 콤보 중(다음 적을 겨눈 미리 보기) → 끝나 배수가 쌓이는 순간
  const keep = (await plan('keep')) || (await plan());
  await playCmds(keep.slice(0, 2));
  if (keep[2]) { await hover(`sq:${keep[2].sq}`); await shot(L('04-combo'), { move: false }); await page.mouse.move(1, 1); }
  await playMoment(keep.length > 2 ? keep.slice(2) : keep.slice(-1), L('05-streak-up'));
  await settle();
  if (lang !== 'ko') { await shot(L('05b-battle-carried')); continue; }
  // 놓기 전 미리 보기: 이어 온 배수가 든 배수 칸 · 놓을 칸의 첫 먹이
  const cmds = await plan();
  if (cmds[0] && cmds[0].type === 'drop') {
    await ev((i) => window.__app.screen.toggle(i), cmds[0].handIndex);
    await frame(3);
    await hover(`sq:${cmds[0].sq}`);
    await shot(L('03-preview'), { move: false });
    await ev((i) => window.__app.screen.toggle(i), cmds[0].handIndex);
    await page.mouse.move(1, 1);
  }
  // 끊김: 끊김으로 끝나는 줄이 있으면 그 순간
  const cut = await plan('cut');
  if (cut) await playMoment(cut, L('06-cut'));
  // 목표를 넘긴 뒤 이어 두는 중
  await playBattle({ stop: () => ev(() => { const b = window.__app.run.battle; return !!b && b.score >= b.target && b.movesLeft > 0; }) });
  await settle();
  await shot(L('07-past-target'));
  await playBattle({ win: L('08-battle-won') });
  await frame(90);
  await shot(L('09-reward'));
  await nextFlow();
  await frame(20);
  // 팩을 먼저 연다(상금이 남을 때) → 고르고 상점으로, 그다음 격언 · 기보 · 기물을 산다
  const pk = await ev(() => { const a = window.__app, run = a.run; const i = run.shop.packs.findIndex((p) => !p.sold && p.price <= run.money); if (i < 0) return false; a.screen.act({ type: 'buyPack', slot: i }, 'pack'); return true; });
  if (pk) { await frame(100); await shot(L('11-pack')); await ev(() => { const a = window.__app; a.cmd({ type: 'pick', index: 0 }); a.goPhase(); }); await frame(20); }
  await ev(() => {
    const a = window.__app, run = a.run;
    for (const kind of ['chart', 'maxim', 'piece']) {
      const i = run.shop.display.findIndex((it) => it && !it.sold && it.kind === kind && it.price <= run.money);
      if (i >= 0) try { a.screen.act({ type: 'buy', slot: i }, 'coin'); } catch { /* 칸이 찼다 */ }
    }
  });
  await settle();
  await shot(L('10-shop'));
  await leaveShop(); await frame(10);
  await toBattle(); await playBattle(); await frame(30); await nextFlow(); await frame(10); await leaveShop(); await frame(30);
  await shot(L('12-select-master'));
  await ev(() => window.__app.screen.play());
  await frame(50);
  await shot(L('13a-master-intro'));
  for (let i = 0; i < 300 && (await state()).intro; i++) await frame(2);
  await frame(20);
  await shot(L('13b-master-start'));
  await idle();
  await playBattle();
  for (let i = 0; i < 4; i++) { const s = await state(); if (s.name === 'chest' || s.name === 'shop' || s.name === 'select') break; await nextFlow(); }
  if ((await state()).name === 'chest') { await frame(240); await shot(L('14-chest')); await nextFlow(); }
  await frame(10); await leaveShop(); await frame(30);
  await shot(L('15-select-next-hall'));
  // 5관쯤의 대국(격언 다섯 · 기보): 봇이 판을 민 뒤 그 관의 첫 대국
  await fastForward('smart', "r.ante >= 5 && r.phase === 'select' || r.phase === 'lost'");
  await frame(10);
  if ((await state()).name === 'select') { await shot(L('16a-select-hall5')); await toBattle(); await shot(L('16b-hall5-battle')); }
  // 판 패배 결과: 상점을 그냥 떠나는 봇으로 판이 끝날 때까지
  await fastForward('none', "r.phase === 'lost'");
  await frame(150);
  await shot(L('17-result-lost'));
}

await page.close();
await browser.close();
srv.close();
if (errors.length) { console.log('페이지 오류:'); for (const e of errors) console.log(' ', e); process.exitCode = 1; }
