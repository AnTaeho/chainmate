// 소개 영상 녹화(CHM-31): 실제 게임을 브라우저(Playwright chromium)로 열어 정해진 각본을 둔다(약 75초, 1440×810 · 30fps · 소리).
//   node tools/video.mjs [--out docs/media] [--ffmpeg 경로] [--frames docs/media/frames] [--silent]
// 결과: <out>/chainmate-play.mp4(H.264 · yuv420p · AAC), 장면 시각 <out>/chapters.md, 장면마다 1배 프레임 <frames>/NN-이름.png.
//   --first: 「처음 켠 사람의 첫 몇 분」은 tools/video-first.mjs로 넘긴다(벽시계 녹화, 960×540).
// 녹화 방식: 게임 루프(requestAnimationFrame → app.frame(t))를 도구가 잡고 1/30초씩 손으로 돌리며 화면을 한 장씩 찍는다.
//   벽시계와 상관없이 결정적이다(같은 시드 · 같은 걸음이면 같은 영상). 뷰포트 1440×810에서 게임이 뒷면 3배(N = 3)로 그린다 — 두 배 도트가 보이는 배율.
//   소리: 녹화하는 동안 app.audio 자리에 받아 적기만 하는 대역을 두고(효과음 이름 · 인수, 프레임마다 곡을 고르는 화면 상태),
//   끝난 뒤 같은 src/audio/audio.js를 OfflineAudioContext로 그 시각대로 다시 불러 소리 파일을 만들어 붙인다.
//   마우스 바늘은 게임이 그리지 않아서 페이지 위에 도트 화살표를 얹어 함께 찍는다.
// Playwright는 저장소 의존성에 넣지 않는다(전역 설치나 NPM_CONFIG_PREFIX). ffmpeg는 PATH · --ffmpeg · FFMPEG 순으로 찾는다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync, execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.includes('--first')) { await import('./video-first.mjs'); process.exit(0); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt('--out', 'docs/media'));
const FRAMES = path.resolve(ROOT, opt('--frames', path.join(path.relative(ROOT, OUT), 'frames')));
const SILENT = args.includes('--silent');
const W = 1440, H = 810, FPS = 30, RATE = 44100;
const SEED = 45;   // 첫 대국: 폰으로 둘을 먹는 짧은 사슬 → 일곱을 잇는 사슬(! · !!)이 나오는 판(풀이기로 찾음)

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
function findFfmpeg() {
  for (const c of [opt('--ffmpeg', null), process.env.FFMPEG, 'ffmpeg']) {
    if (!c) continue;
    try { if (execFileSync(c, ['-hide_banner', '-encoders'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().includes('libx264')) return c; } catch { /* 없음 */ }
  }
  return null;
}
const FF = findFfmpeg();
if (!FF) throw new Error('ffmpeg(libx264)가 없다 — 프레임을 영상으로 묶을 수 없다');

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const BASE = `http://localhost:${srv.address().port}`;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' ')));

// 게임 루프를 잡는다: requestAnimationFrame은 콜백을 맡아 두기만 하고, 도구가 frame()에서 T를 넘겨 부른다
await page.addInitScript(() => {
  window.__raf = null;
  window.requestAnimationFrame = (cb) => { window.__raf = cb; return 1; };
  window.__autoDraft = true;
  window.__T = 0;
});
await page.goto(`${BASE}/index.html`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('chainmate.settings.v1', JSON.stringify({ speed: 1 }));
  localStorage.setItem('chainmate.records.v1', JSON.stringify({ lessonsDone: true, kingDone: true, runs: 3 }));
});
await page.reload();
await page.waitForFunction(() => window.__app && window.__app.screen && window.__raf);
const ev = (fn, arg) => page.evaluate(fn, arg);
const fit = await ev(() => ({ n: window.__fit.n, w: document.getElementById('screen').width, h: document.getElementById('screen').height }));
if (fit.n !== 3 || fit.w !== 1440 || fit.h !== 810) throw new Error(`뒷면 배율이 3이 아니다: ${JSON.stringify(fit)}`);

// 처음 안내 · 알림은 끈다(영상은 흐름을 보여 주는 것 — 안내는 first-play.mp4가 맡는다). 소리는 받아 적는 대역으로
await ev(async () => {
  const a = window.__app;
  const { HINTS } = await import('/src/ui/coach.js');
  a.settings.coach = false;
  a.records.coachSeen = Object.fromEntries(Object.keys(HINTS).map((k) => [k, true]));
  a.saveRecords();
  const clean = (x) => { try { return x === undefined ? null : JSON.parse(JSON.stringify(x)); } catch { return null; } };
  window.__alog = { sfx: [], mus: [], settings: { volume: a.settings.volume ?? 0.6, music: a.settings.music ?? 0.5 } };
  const real = a.audio;
  a.audio = {
    ready: true,
    get music() { return { track: null, layers: 0 }; },
    unlock() {}, apply(s) { window.__alog.settings = { volume: s.volume ?? 0.6, music: s.music ?? 0.5 }; },
    play(name, arg) { window.__alog.sfx.push([window.__T, name, clean(arg)]); },
    // 곡 고르기(audio.js musicFor)가 읽는 것만: 화면 이름 · 마스터전인가 · 사슬 길이
    update(dt, app) {
      const s = app.screen;
      const chain = s && s.view && s.view.chain ? s.view.chain.path.length : 0;
      window.__alog.mus.push([window.__T, s ? s.name : null, s && s.b ? s.b.kind || null : null, chain]);
    },
    tracks: real ? real.tracks : [], names: real ? real.names : [],
  };
  // 마우스 바늘(도트 화살표, 3배)
  const rows = ['1', '11', '121', '1221', '12221', '122221', '1222221', '12222221', '122222221', '1222221111', '1221221', '121 1221', '11  1221', '1    1221', '     1221', '      11'];
  const rects = [];
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== ' ') rects.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${c === '1' ? '#14110f' : '#f4ecd8'}"/>`); }));
  const cur = document.createElement('div');
  cur.id = '__cur';
  cur.style.cssText = 'position:fixed;left:-100px;top:-100px;width:30px;height:48px;pointer-events:none;z-index:99999;';
  cur.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="48" viewBox="0 0 10 16" shape-rendering="crispEdges">${rects.join('')}</svg>`;
  document.body.appendChild(cur);
});

// ── 프레임 돌리기 · 찍기
fs.mkdirSync(OUT, { recursive: true });
const silentMp4 = path.join(OUT, '.chainmate-play-video.mp4');
const enc = spawn(FF, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-movflags', '+faststart', '-an', silentMp4], { stdio: ['pipe', 'inherit', 'inherit'] });
const encDone = new Promise((ok, no) => enc.on('close', (c) => (c === 0 ? ok() : no(new Error('ffmpeg ' + c)))));
let F = 0;
const tNow = () => F / FPS;
let cursor = [W * 0.97, H * 0.97];
async function frame() {
  F++;
  const st = await ev((T) => {
    window.__T = T / 1000;
    const cb = window.__raf; window.__raf = null;
    if (cb) cb(T);
    const s = window.__app.screen;
    return { name: s.name, busy: !!s.busy, banner: !!s.banner };
  }, (F * 1000) / FPS);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H }, type: 'png' });
  if (!enc.stdin.write(png)) await new Promise((ok) => enc.stdin.once('drain', ok));
  return st;
}
const hold = async (ms) => { for (let i = Math.max(1, Math.round((ms * FPS) / 1000)); i > 0; i--) await frame(); };
async function idle(maxMs = 20000) {
  for (let i = 0; i < (maxMs * FPS) / 1000; i++) {
    const st = await frame();
    if (!(st.name === 'battle' && (st.busy || st.banner))) return st;
  }
  throw new Error('연출이 끝나지 않는다');
}
const region = (id) => ev((id) => { const r = window.__app.ui.regions.find((x) => x.id === id); return r && { x: r.x, y: r.y, w: r.w, h: r.h }; }, id);
const toXY = (gx, gy) => [((gx + 0.5) * W) / 480, ((gy + 0.5) * H) / 270];
async function pointTo(x, y) {
  cursor = [x, y];
  await page.mouse.move(x, y);
  await ev(([x, y]) => { const c = document.getElementById('__cur'); c.style.left = `${x - 3}px`; c.style.top = `${y - 3}px`; }, [x, y]);
}
// 바늘을 부드럽게 옮긴다(프레임마다 한 걸음, 느려지며 닿는다)
async function glideTo(x, y, ms = 330) {
  const [x0, y0] = cursor, n = Math.max(2, Math.round((ms * FPS) / 1000));
  for (let i = 1; i <= n; i++) {
    const k = i / n, e = 1 - Math.pow(1 - k, 3);
    await pointTo(x0 + (x - x0) * e, y0 + (y - y0) * e);
    await frame();
  }
}
async function hover(id, ms = 300, glide = 330) {
  const r = await region(id);
  if (!r) throw new Error('구역이 없다: ' + id);
  const [x, y] = toXY(r.x + r.w / 2, r.y + Math.min(r.h / 2, 18));
  await glideTo(x, y, glide);
  await hold(ms);
}
async function click(id, ms = 250, glide = 330) {
  await hover(id, ms, glide);
  await page.mouse.down(); await frame(); await frame();
  await page.mouse.up(); await frame();
}
const park = () => glideTo(W * 0.97, H * 0.97, 300);

// ── 장면 기록
const chapters = [];
const shots = [];
const mark = (s) => { chapters.push([tNow(), s]); console.log(tNow().toFixed(1) + 's', s); };
// 장면 프레임: 지금 프레임 번호를 적어 두고 끝난 뒤 영상에서 1배로 뽑는다
const snap = (name) => { shots.push([name, F]); };

async function intro() {
  // 1 타이틀: 흐린 판에서 풀이기가 사슬을 둔다
  await pointTo(...cursor);
  mark('타이틀 시연');
  await hold(1800); snap('01-title'); await hold(1600);
  await click('title:new', 500, 500);

  // 2 첫 대국(1관 농민군): 관 선택 → 대국 띠 → 폰을 떨궈 둘을 먹는 짧은 사슬(미리 보기를 보며)
  await ev((seed) => { const a = window.__app; a.newRun({ seed }); }, SEED);
  mark('첫 대국 · 떨구고 먹으며 갈아입기');
  await hold(1400);
  await click('select:play', 400);
  await idle();
  await hold(500);
  const p1 = await ev(async () => {
    const { bestMove } = await import('/src/sim/solver.js');
    const d = bestMove(window.__app.run.battle, { handIndices: [1], preferMate: 'avoid' });
    return { hand: 1, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)) };
  });
  await click(`hand:${p1.hand}`, 500);
  await hover(`sq:${p1.sq}`, 1100);        // 떨굴 칸에 비친 모습
  await click(`sq:${p1.sq}`, 100, 120); await idle();
  for (let i = 0; i < p1.line.length; i++) {
    const sq = p1.line[i];
    await hover(`sq:${sq}`, 1000);         // 먹기 전 미리 보기: 지금 › 먹으면, 얻을 값 · 배수
    if (i === 0) snap('02-preview');
    await click(`sq:${sq}`, 80, 100); await idle();
  }
  snap('03-chain');
  await hold(900);

  // 3 큰 사슬: 일곱을 잇는 사슬 — 셋째 「!」 · 다섯째 「!!」 도장
  const p2 = await ev(async () => {
    const { bestMove } = await import('/src/sim/solver.js');
    const d = bestMove(window.__app.run.battle, { preferMate: 'avoid' });
    return { hand: d.handIndex, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)) };
  });
  if (p2.line.length < 5) throw new Error('큰 사슬이 안 나온다: ' + p2.line.length);
  mark('큰 사슬 · 사슬 평가 도장');
  await click(`hand:${p2.hand}`, 400);
  await hover(`sq:${p2.sq}`, 900);
  await click(`sq:${p2.sq}`, 80, 120); await idle();
  for (let i = 0; i < p2.line.length; i++) {
    await hover(`sq:${p2.line[i]}`, 500, 260);
    await click(`sq:${p2.line[i]}`, 60, 80);
    // 도장이 찍히는 순간(먹은 수 5 = 「!!」)
    if (i === 4) { await hold(330); snap('04-grade'); }
    await idle();
  }
  await park();
  for (let i = 0; i < 300 && (await ev(() => window.__app.screen.name)) === 'battle'; i++) await frame();
  await hold(2200);
  // 판을 맡겨 두고(보상 막간까지 본 뒤 상점에서 잇는다)
  await ev(() => { const a = window.__app; window.__saved = JSON.stringify(a.run); });

  // 4 희생 → 「!?」 → 새로 뽑은 나이트로 메이트 → 탁월수 「!!」(tools/video-brilliant.mjs와 같은 판)
  await ev(() => {
    const a = window.__app;
    a.flowQueue = [];
    a.nextSeed = 11; a.newRun();
    if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
    a.cmd({ type: 'play' }); a.go('battle', { events: [] });
    const b = a.run.battle;
    const sq = (n) => (Number(n[1]) - 1) * 8 + 'abcdefgh'.indexOf(n[0]);
    b.board = Array(64).fill(null);
    for (const [n, t] of Object.entries({ h7: 'K', c7: 'B', d7: 'P', g6: 'P', d5: 'P', e5: 'P', e4: 'P', e3: 'N' })) b.board[sq(n)] = { t, id: 700 + sq(n) };
    b.incoming = []; b.incomingNext = [];
    b.hand = ['P', 'N', 'P', 'B'].map((t, i) => ({ t, id: 900 + i, eng: null }));
    b.bag = [{ t: 'N', id: 950, eng: null }, ...b.bag];
    b.target = 150;
    a.screen.banner = null;
    a.screen.sync();
  });
  mark('희생 → !? → 메이트 → 탁월수 !!');
  await hold(900);
  await click('hand:3', 600);
  await hover('btn:discard', 700);
  snap('05-sacrifice');
  await click('btn:discard', 100, 100); await idle();
  await park(); await hold(500);
  snap('06-dubious');
  await hold(700);
  const p3 = await ev(async () => {
    const { bestMove } = await import('/src/sim/solver.js');
    const b = window.__app.run.battle, i = b.hand.findIndex((p) => p.id === 950);
    const d = bestMove(b, { handIndices: [i], preferMate: true });
    return { hand: i, sq: d.sq, line: d.line.map((c) => (typeof c === 'number' ? c : c.sq)), mate: !!d.mate };
  });
  if (!p3.mate) throw new Error('새로 뽑은 나이트의 메이트 줄이 없다');
  await click(`hand:${p3.hand}`, 450);
  await hover(`sq:${p3.sq}`, 700);
  await click(`sq:${p3.sq}`, 80, 100); await idle();
  for (let i = 0; i < p3.line.length; i++) {
    await hover(`sq:${p3.line[i]}`, 500, 260);
    await click(`sq:${p3.line[i]}`, 60, 80);
    if (i === p3.line.length - 1) { await hold(1100); snap('07-brilliant'); }
    await idle();
  }
  await park();
  await hold(1600);

  // 5 상점: 종류 딱지가 붙은 진열 → 격언 사기 → 꾸러미 열기
  await ev(() => { const a = window.__app; a.run = JSON.parse(window.__saved); a.flowQueue = []; a.run.money = Math.max(a.run.money, 14); a.toasts = []; a.goPhase(); });
  mark('상점 · 격언 사기 · 꾸러미');
  await hold(1500); snap('08-shop');
  const buy = await ev(async () => { const { canBuy } = await import('/src/sim/run.js'); const r = window.__app.run; return r.shop.display.findIndex((it) => it.kind === 'maxim' && canBuy(r, it)); });
  if (buy < 0) throw new Error('살 수 있는 격언이 없다');
  await hover(`shop:buy:${buy}`, 1500);
  await click(`shop:buy:${buy}`, 150, 100);
  // 마스터전 장면은 격언을 산 이 판에서 잇는다(꾸러미로 주머니가 바뀌면 첫 손이 달라져 사슬이 짧아진다)
  await ev(() => { window.__saved = JSON.stringify(window.__app.run); });
  await hold(1300);
  const pk = await ev(() => { const r = window.__app.run; return r.shop.packs.findIndex((p) => !p.sold && p.price > 0 && r.money >= p.price && p.kind === 'piece'); });
  if (pk < 0) throw new Error('열 꾸러미가 없다');
  await hover(`shop:pack:${pk}`, 1100);
  await click(`shop:pack:${pk}`, 150, 100);
  await park();
  await hold(1800); snap('09-pack');
  const pick = await ev(() => { const o = window.__app.run.pack.options; const k = o.findIndex((x) => x.kind !== 'engraving'); return k < 0 ? 0 : k; });
  await hover(`pack:pick:${pick}`, 1000);
  await click(`pack:pick:${pick}`, 150, 100);
  if (await region('target:ok')) { await click(`deck:${await ev(() => window.__app.run.deck[0].id)}`, 600); await click('target:ok', 400); }
  await hold(1300);
  if ((await ev(() => window.__app.screen.name)) === 'shop') { await click('shop:leave', 400); await hold(600); }

  // 6 관 선택(2관 마스터전): 세력 띠 · 문장 · 우두머리
  await ev(() => { const a = window.__app; a.run = JSON.parse(window.__saved); const r = a.run; r.ante = 2; r.blind = 2; r.phase = 'select'; r.shop = null; a.toasts = []; a.flowQueue = []; a.goPhase(); });
  await park();
  mark('관 선택 · 세력 띠와 문장');
  await hold(1400); snap('10-select');
  if (await region('faction')) await hover('faction', 1600);
  await hover('select:play', 700);

  // 7 마스터전 배너 → 우두머리 대국 한 수(풀이기의 최선 수)
  await click('select:play', 100, 100);
  mark('마스터전 · 우두머리 대국');
  await park();
  for (let i = 0; i < 45; i++) { const st = await frame(); if (i === 20) snap('11-master-banner'); if (!st.banner && i > 25) break; }
  await idle();
  await hold(700);
  const d = await ev(async () => {
    const { bestMove } = await import('/src/sim/solver.js');
    const b = window.__app.run.battle;
    const x = b && b.status === 'play' ? bestMove(b, {}) : null;
    return x ? { hand: x.handIndex, sq: x.sq, line: x.line.map((c) => (typeof c === 'number' ? c : c.sq)) } : { status: b && b.status, screen: window.__app.screen.name };
  });
  if (!d || d.hand == null) throw new Error('마스터전 첫 수가 없다 ' + JSON.stringify(d));
  console.log('  마스터전 수', JSON.stringify(d));
  await click(`hand:${d.hand}`, 450);
  await hover(`sq:${d.sq}`, 900);
  await click(`sq:${d.sq}`, 80, 100); await idle();
  // 사슬은 화면이 고를 수 있는 칸 중 풀이기가 고른 줄대로(없으면 화면이 내미는 첫 칸)
  for (let g = 0; g < 14; g++) {
    const next = await ev((line) => { const b = window.__app.run.battle; if (!b || b.status !== 'chain') return null; const l = window.__app.screen.clickable().list; if (!l.length) return null; const want = line && line.find((s) => l.includes(s)); return want ?? l[0]; }, d.line);
    if (next == null) break;
    await hover(`sq:${next}`, 500, 260);
    await click(`sq:${next}`, 60, 80);
    await idle();
  }
  await park();
  await hold(800); snap('12-master-move');
  await hold(1000);

  // 8 끝: 타이틀
  await ev(() => { const a = window.__app; a.flowQueue = []; a.go('title'); });
  mark('끝 · 타이틀');
  await hold(2600); snap('13-end');
  await hold(600);
}

await intro();
enc.stdin.end();
await encDone;
const duration = F / FPS;

// ── 소리: 받아 적은 걸음을 OfflineAudioContext로 다시 불러 만든다
const mp4 = path.join(OUT, 'chainmate-play.mp4');
let audioNote = '소리 없음(--silent)';
if (!SILENT) {
  const log = await ev(() => window.__alog);
  const ap = await browser.newPage();
  await ap.goto(`${BASE}/index.html`);
  const b64 = await ap.evaluate(async ({ log, seconds, RATE, GAIN }) => {
    const { createAudio } = await import('/src/audio/audio.js');
    const off = new OfflineAudioContext(2, Math.ceil(seconds * RATE), RATE);
    let VT = 0;
    // 곡 예약 · 효과음은 ctx.currentTime 기준이라, 시각을 걸음의 시각으로 바꿔 끼운 컨텍스트를 넘긴다(렌더 전에 모두 예약)
    const px = new Proxy(off, { get(t, k) { if (k === 'currentTime') return VT; if (k === 'state') return 'running'; const v = Reflect.get(t, k, t); return typeof v === 'function' ? v.bind(t) : v; } });
    const au = createAudio(window, { context: px });
    au.unlock(); au.apply(log.settings);
    const steps = [...log.mus.map((m) => [m[0], 0, m]), ...log.sfx.map((s) => [s[0], 1, s])].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    for (const [t, kind, x] of steps) {
      VT = t;
      if (kind === 0) {
        const fake = { screen: { name: x[1], b: x[2] ? { kind: x[2] } : null, view: x[3] ? { chain: { path: { length: x[3] } } } : null } };
        au.update(1 / 30, fake);
      } else au.play(x[1], x[2] ?? undefined);
    }
    const buf = await off.startRendering();
    // 16비트 WAV
    const n = buf.length, ch = 2, out = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const w = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); w(8, 'WAVE'); w(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true);
    out.setUint16(22, ch, true); out.setUint32(24, RATE, true); out.setUint32(28, RATE * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, n * ch * 2, true);
    const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
    for (let i = 0, o = 44; i < n; i++, o += 4) {
      out.setInt16(o, Math.max(-1, Math.min(1, L[i] * GAIN)) * 32767, true);
      out.setInt16(o + 2, Math.max(-1, Math.min(1, R[i] * GAIN)) * 32767, true);
    }
    const bytes = new Uint8Array(out.buffer);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }, { log, seconds: duration + 0.5, RATE, GAIN: 1 });
  await ap.close();
  const wav = path.join(OUT, '.chainmate-play.wav');
  fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
  execFileSync(FF, ['-y', '-loglevel', 'error', '-i', silentMp4, '-i', wav, '-af', 'loudnorm=I=-18:TP=-1.5:LRA=11', '-ar', String(RATE), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-t', duration.toFixed(3), '-movflags', '+faststart', mp4]);
  const vd = spawnSync(FF, ['-hide_banner', '-i', mp4, '-vn', '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' }).stderr || '';
  console.log('소리 크기', (vd.match(/(mean|max)_volume: [-\d.]+ dB/g) || []).join(' · '));
  fs.rmSync(wav, { force: true });
  audioNote = `소리: 효과음 ${log.sfx.length}번 · 곡은 화면 따라(OfflineAudioContext로 다시 합성, 크기는 loudnorm −18 LUFS)`;
} else {
  fs.copyFileSync(silentMp4, mp4);
}
fs.rmSync(silentMp4, { force: true });

// ── 장면 프레임(1배, 480×270): 영상에서 그 프레임을 뽑아 가장 가까운 이웃으로 줄인다
fs.mkdirSync(FRAMES, { recursive: true });
for (const [name, f] of shots) {
  execFileSync(FF, ['-y', '-loglevel', 'error', '-ss', ((f - 0.5) / FPS).toFixed(3), '-i', mp4, '-frames:v', '1', '-vf', 'scale=480:270:flags=neighbor', path.join(FRAMES, `${name}.png`)]);
}

await browser.close();
srv.close();
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const md = ['# 소개 영상 장면', '', `\`tools/video.mjs\`로 녹화(${W}×${H} · ${FPS}fps · 약 ${Math.round(duration)}초, 게임 시계를 프레임마다 손으로 돌려 찍었다 — 같은 시드면 같은 영상). 시각은 영상 시작부터.`,
  `장면마다 1배 프레임은 \`${path.relative(OUT, FRAMES)}/\`.`, '', '| 시각 | 장면 |', '|---|---|', ...chapters.map(([t, s]) => `| ${fmt(t)} | ${s} |`), ''];
fs.writeFileSync(path.join(OUT, 'chapters.md'), md.join('\n'));
console.log(path.relative(ROOT, mp4), (fs.statSync(mp4).size / 1e6).toFixed(2) + 'MB', `${duration.toFixed(1)}s · ${F}프레임`);
console.log(audioNote);
console.log(`페이지 오류 ${errors.length}${errors.length ? '\n' + errors.join('\n') : ''}`);
