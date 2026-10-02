// 화면 맞춤 스크린샷(CHM-28): 기기를 흉내 내어 창 전체를 찍는다(게임 캔버스 밖의 가장자리까지).
//   node tools/shots-mobile.mjs [--prefix before|after] [--out docs/shots/mobile] [--only 기기이름] [--engine webkit|chromium]
//                               [--scenes title,battle,shop,pause,pack,legend,chest,result] [--no-touch] [--root 다른 게임 폴더]
// --only iphone17 은 아이폰 17(402×874, dpr 3) 흉내다(CHM-52): 브라우저 창은 화면 전체(그릴 수 있는 곳)로 잡고, 페이지가 읽는 보이는 창
// (innerHeight · visualViewport.height)을 emu.vis로 줄이고, 안전 영역(#safe padding)과 navigator.standalone을 덮어쓴다.
// 사람 그림(IMG_5075)의 홈 화면 세로는 보이는 창 812 · 화면 874 · 위 섬 62 · 아래 홈 막대 34. 사파리 주소창 높이는 기기에서 재지 못해 어림값이다
// 기기마다 타이틀 · 대국 · 상점 · 멈춤 · 전설 · 상자 · 결과를 찍고, 캔버스 크기(CSS · 뒷면)를 표로 적는다. 폰 세로는 화면을 90도 돌려 그린다(스크린샷도 세로 그대로).
// 전설 · 상자는 금빛 번쩍임 한가운데(-flash)와 가라앉은 뒤를 따로 찍는다(여백 판도 같이 밝아지나). 번쩍임은 update를 멈춰 세운다.
// 타이틀은 여백 판 장면을 칠한 시간(ms, padStats.sceneMs)을 표에 적는다.
// 터치가 있는 기기는 page.touchscreen.tap으로 「새 판」 → 대본 대국 첫 수(나이트 떨구기 → 룩 → 퀸)까지 눌러 본다. 돌려 그린 폰 세로는 돌린 축으로 누른다(src/ui/fit.js toClient).
// 폰 · 태블릿은 webkit(없으면 chromium 기기 흉내), 데스크톱은 chromium.
// Playwright는 저장소 의존성에 넣지 않는다(NPM_CONFIG_PREFIX 전역).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
// --root: 다른 판(고치기 전 코드를 풀어 둔 폴더)을 같은 도구로 찍는다
const ROOT = path.resolve(opt('--root', path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
const PREFIX = opt('--prefix', 'after');
const OUT = path.resolve(opt('--out', path.join(ROOT, 'docs/shots/mobile')));
const ONLY = opt('--only', null);
const ENGINE = opt('--engine', null);
const SCENES = new Set(opt('--scenes', 'title,battle,shop,pause,legend,chest,result').split(','));
const TOUCH = !args.includes('--no-touch');

// 이름 · 창(CSS) · dpr · 터치 · 엔진
const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_IPHONE26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const UA_IPAD = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DEVICES = [
  { name: 'iphone15-portrait', w: 393, h: 659, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  // 홈 화면에서 세로로 열었을 때(iOS는 manifest의 가로를 따르지 않는다)
  { name: 'iphone15-portrait-home', w: 393, h: 852, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  { name: 'iphone15-landscape', w: 734, h: 343, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  // 홈 화면에 추가해 전체 화면으로 열었을 때(주소창 없음)
  { name: 'iphone15-fullscreen', w: 852, h: 393, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE },
  // 아이폰 17(CHM-52). emu.vis = 페이지가 읽는 보이는 창 높이, emu.inset = 안전 영역, emu.standalone = 홈 화면 앱
  { name: 'iphone17-home-portrait', w: 402, h: 874, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE26, emu: { vis: 812, standalone: true, inset: { top: 62, right: 0, bottom: 34, left: 0 } } },
  { name: 'iphone17-safari-portrait-bar-collapsed', w: 402, h: 874, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE26, emu: { vis: 812, inset: { top: 62, right: 0, bottom: 34, left: 0 } } },
  { name: 'iphone17-safari-portrait-bar-expanded', w: 402, h: 874, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE26, emu: { vis: 740, inset: { top: 62, right: 0, bottom: 34, left: 0 } } },
  { name: 'iphone17-safari-landscape-bar-collapsed', w: 874, h: 402, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE26, emu: { vis: 402, inset: { top: 0, right: 62, bottom: 21, left: 62 } } },
  { name: 'iphone17-safari-landscape-bar-expanded', w: 874, h: 402, dpr: 3, touch: true, engine: 'webkit', ua: UA_IPHONE26, emu: { vis: 352, inset: { top: 0, right: 62, bottom: 21, left: 62 } } },
  { name: 'ipad-portrait', w: 810, h: 1080, dpr: 2, touch: true, engine: 'webkit', ua: UA_IPAD },
  { name: 'ipad-landscape', w: 1080, h: 810, dpr: 2, touch: true, engine: 'webkit', ua: UA_IPAD },
  { name: 'mac-1920x960', w: 1920, h: 960, dpr: 2, touch: false, engine: 'chromium' },
  // 사람이 보낸 맥 사파리 전체 화면(1440×810이 뜬 창) — 맥북 에어 13형 기본 해상도
  { name: 'mac-1470x956', w: 1470, h: 956, dpr: 2, touch: false, engine: 'chromium' },
  { name: 'desktop-1280x720', w: 1280, h: 720, dpr: 1, touch: false, engine: 'chromium' },
];

async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, ok));
const port = srv.address().port;
const pw = await loadPlaywright();
const browsers = {};
async function browserFor(engine) {
  if (ENGINE) engine = ENGINE;
  if (!browsers[engine]) {
    try { browsers[engine] = await pw[engine].launch(); } catch (e) {
      if (engine === 'chromium') throw e;
      console.log(`${engine}를 못 열어 chromium 기기 흉내로 찍는다: ${String(e).split('\n')[0]}`);
      return browserFor('chromium');
    }
  }
  return browsers[engine];
}
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const table = [];

async function session(d, { fresh = false } = {}) {
  const browser = await browserFor(d.engine);
  const context = await browser.newContext({
    viewport: { width: d.w, height: d.h }, deviceScaleFactor: d.dpr, hasTouch: d.touch,
    // webkit은 isMobile을 모른다
    ...(d.touch && browser.browserType().name() === 'chromium' ? { isMobile: true } : {}),
    ...(d.ua ? { userAgent: d.ua } : {}),
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${d.name}: ${String(e)}`));
  await page.addInitScript((fresh) => { if (!fresh) window.__autoDraft = true; }, fresh);
  if (d.emu) await page.addInitScript((emu) => {
    // 보이는 창을 줄인다(화면은 그대로 — 그 아래 띠에도 그림이 그려진다). 안전 영역은 #safe padding으로(env()는 흉내 낼 수 없다)
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => emu.vis });
    if (window.VisualViewport) Object.defineProperty(VisualViewport.prototype, 'height', { configurable: true, get: () => emu.vis });
    if (document.documentElement) Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, get: () => emu.vis });
    Object.defineProperty(navigator, 'standalone', { configurable: true, get: () => !!emu.standalone });
    const i = emu.inset;
    const css = `#safe{padding:${i.top}px ${i.right}px ${i.bottom}px ${i.left}px !important}`;
    document.addEventListener('readystatechange', () => {
      if (document.getElementById('emu-safe')) return;
      const st = document.createElement('style'); st.id = 'emu-safe'; st.textContent = css; (document.head || document.documentElement).appendChild(st);
    });
  }, d.emu);
  await page.goto(`http://localhost:${port}/index.html`);
  await page.waitForFunction(() => window.__app && window.__app.screen);
  if (!fresh) await page.evaluate(() => { localStorage.clear(); window.__app.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); window.__app.settings.coach = false; });
  else await page.evaluate(() => localStorage.clear());
  await page.waitForTimeout(400); // 크기 다시 고르기(늦춘 resize)가 끝나게
  return { context, page, ev: (fn, arg) => page.evaluate(fn, arg), settle: (ms) => page.waitForTimeout(ms) };
}

async function shotsFor(d) {
  const { context, page, ev, settle } = await session(d);
  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${d.name}-${name}.png`) });
    console.log('찍음', `${PREFIX}-${d.name}-${name}`);
  };
  const size = await ev(() => {
    const c = document.getElementById('screen');
    const r = c.getBoundingClientRect();
    const f = window.__fit;
    // 돌려 그리면 보이는 사각형은 세로로 서 있다 — 표에는 게임 가로 × 세로로 적는다
    const rot = !!(f && f.rot);
    const st = document.getElementById('stage').getBoundingClientRect();
    return { cssW: Math.round((rot ? r.height : r.width) * 100) / 100, cssH: Math.round((rot ? r.width : r.height) * 100) / 100, left: r.left, top: r.top, right: r.right, bottom: r.bottom, stage: `${Math.round(st.width)}×${Math.round(st.height)}`, back: `${c.width}×${c.height}`, rot, k: f && f.k, scale: window.__app.scale };
  });
  table.push({ name: d.name, view: `${d.w}×${d.h}`, dpr: d.dpr, ...size });
  const want = (n) => SCENES.has(n);
  // 타이틀(여백 판 장면을 칠한 시간도 잰다)
  if (want('title')) {
    await ev(() => { window.__app.go('title'); });
    await settle(1200);
    await shot('title');
    const ms = await ev(async () => (await import('/src/render/backdrop.js')).padStats.sceneMs);
    table[table.length - 1].sceneMs = Math.round(ms * 10) / 10;
  }
  // 대국(판 11, 첫 대국)
  if (want('battle')) {
    await ev(() => { const a = window.__app; a.newRun({ seed: 11 }); a.cmd({ type: 'play' }); a.go('battle', { events: [] }); });
    await settle(2600);
    await shot('battle');
  }
  // 상점: 봇이 대국을 끝까지 두고 첫 상점에서 멈춘다
  if (want('shop') || want('pause')) {
    await ev(async () => {
      const { playRun } = await import('/tools/shopbot.mjs');
      const a = window.__app;
      a.newRun({ seed: 11 });
      playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
      a.run.money = 30; a.fx.clear(); a.goPhase();
    });
    await settle(900);
    if (want('shop')) await shot('shop');
    // 멈춤 단추(≡) 누르는 구역: 도트 × 도트 하나의 CSS 크기 = 실제 화면 pt(손가락으로 한 번 누른 뒤)
    await ev(() => { window.__app.touch = true; });
    await settle(100);
    table[table.length - 1].pause = await ev(() => { const r = window.__app.ui.regions.find((x) => x.id === 'btn:pause'); const c = window.__fit.css; return r ? `${r.w}×${r.h}도트 = ${Math.round(r.w * c)}×${Math.round(r.h * c)}pt` : '-'; });
    // 멈춤 덮개(판 밖 가장자리도 같이 어두워지나)
    if (want('pause')) {
      await ev(() => window.__app.openOverlay('pause'));
      await settle(300);
      await shot('pause');
      await ev(() => window.__app.closeOverlay());
    }
  }
  // 꾸러미 + 멈춤(사람 그림 IMG_5075와 같은 장면): 첫 상점의 첫 꾸러미를 열고 멈춤 덮개
  if (want('pack')) {
    await ev(async () => {
      const { playRun } = await import('/tools/shopbot.mjs');
      const a = window.__app;
      a.newRun({ seed: 11 });
      playRun(a.run, 'none', { stopAt: (r) => r.phase === 'shop' });
      a.run.money = 30; a.fx.clear(); a.goPhase();
    });
    await settle(600);
    await ev(() => { const a = window.__app; const r = a.ui.regions.find((x) => x.id.startsWith('shop:pack:')); if (r) { a.ui.previewId = r.id; r.onClick(r); } });
    await settle(1800);
    await ev(() => window.__app.openOverlay('pause'));
    await settle(300);
    await shot('pack-pause');
    await ev(() => window.__app.closeOverlay());
  }
  // 전설 완성: 금빛 번쩍임 한가운데(멈춰 세움) → 끝 장면
  if (want('legend')) {
    await ev(() => { const a = window.__app; a.newRun({ seed: 11 }); a.shakeT = 0; a.shakeAmt = 0; a.go('legend', { legend: 'century' }); const s = a.screen; s.update = () => {}; s.t = 0.15; });
    await settle(300);
    await shot('legend-flash');
    await ev(() => { const a = window.__app; a.go('legend', { legend: 'century' }); const s = a.screen; s.t = s.tDone + 1; });
    await settle(600);
    await shot('legend');
  }
  // 마스터의 상자: 다섯 칸 → 번쩍임 한가운데(멈춰 세움) → 가라앉은 뒤
  if (want('chest')) {
    const chest = { count: 5, tier: 'rare', cells: [{ lit: true, item: { kind: 'money', money: 2 } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: true, item: { kind: 'engrave', piece: 'P', pieceId: 1, eng: 'ivory' } }, { lit: true, item: { kind: 'chart', form: 'Q' } }, { lit: true, item: { kind: 'money', money: 3 } }] };
    await ev((chest) => { const a = window.__app; a.newRun({ seed: 11 }); a.go('chest', { chest }); const s = a.screen; s.t = 99; s.update(0); s.update = () => {}; s.flash = 0.6; a.shakeT = 0; a.shakeAmt = 0; }, chest);
    await settle(300);
    await shot('chest-flash');
    await ev(() => { const a = window.__app; const s = a.screen; s.flash = 0; });
    await settle(300);
    await shot('chest');
  }
  // 결과: 진 판(마지막 대국 · 최고 한 수 판)
  if (want('result')) {
    await ev(() => {
      const a = window.__app;
      a.newRun({ seed: 11 });
      const r = a.run;
      r.log.push({ ante: 3, blind: 1, kind: 'practice', score: 1840, target: 2400, best: 960 });
      r.bestReplay = { board: Array(64).fill(null), drop: { sq: 27, piece: 'N' }, caps: [{ from: 27, to: 44, form: 'N', after: 'B' }], score: 960, reason: 'end' };
      r.phase = 'lost';
      a.go('result');
    });
    await settle(900);
    await shot('result');
  }
  await context.close();
}

// 터치로 새 판 → 대본 대국 첫 수. 걸음 번호가 5(첫 수 끝 — 「점수」 설명)에 닿으면 된 것
async function touchFlow(d) {
  const { context, page, ev, settle } = await session(d, { fresh: true });
  const rot = await ev(() => !!(window.__fit && window.__fit.rot));
  const toXY = (id) => ev(async (id) => {
    const q = window.__app.ui.regions.find((x) => x.id === id);
    if (!q) return null;
    const { toClient } = await import('/src/ui/fit.js');
    const b = document.getElementById('screen').getBoundingClientRect();
    return toClient(q.x + q.w / 2, q.y + Math.min(q.h / 2, 16), b, !!window.__fit.rot);
  }, id);
  const tap = async (id) => { const p = await toXY(id); if (!p) throw new Error(`no region ${id}`); await page.touchscreen.tap(p[0], p[1]); await settle(120); };
  const ready = () => page.waitForFunction(() => { const a = window.__app, g = a.guide; return !g || (!a.overlay && !(g.hold && g.hold(a)) && a.hintRect); }, null, { timeout: 30000 });
  const log = [];
  try {
    await settle(300);
    await tap('title:new');
    for (let guard = 0; guard < 16; guard++) {
      await ready();
      const st = await ev(() => { const a = window.__app, g = a.guide; if (!g) return null; const s = g.steps[g.i]; return { i: g.i, ok: !!s.ok, target: typeof s.target === 'function' ? s.target(a) : s.target }; });
      if (!st || st.i >= 5) { log.push(st ? `걸음 ${st.i}` : '길 없음'); break; }
      const id = st.ok ? 'guide:ok' : st.target;
      await tap(id);
      // 손가락은 먹기 · 떨구기를 한 번 누르면 미리 보기, 한 번 더 누르면 둔다
      let after = await ev(() => window.__app.guide && window.__app.guide.i);
      if (after === st.i) { await tap(id); after = await ev(() => window.__app.guide && window.__app.guide.i); log.push(`${st.i}:${id}×2`); } else log.push(`${st.i}:${id}`);
    }
    await settle(1500);
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${d.name}-touch-first-move.png`) });
  } catch (e) { log.push(`막힘 ${String(e).split('\n')[0]}`); }
  const i = await ev(() => window.__app.guide && window.__app.guide.i);
  // 돌려 그린 폰은 가로로 들어 본다: 판 상태(화면 · 걸음 · 손)가 그대로이고 돌리기가 풀려야 한다
  let flip = '';
  if (rot && !d.emu) {
    const before = await ev(() => { const a = window.__app; return JSON.stringify({ s: a.screen && a.screen.constructor.name, i: a.guide && a.guide.i, b: a.screen && a.screen.bRef && a.screen.bRef.board, h: a.screen && a.screen.bRef && a.screen.bRef.hand }); });
    await page.setViewportSize({ width: d.h, height: d.w });
    await settle(800);
    const after = await ev(() => { const a = window.__app; return { st: JSON.stringify({ s: a.screen && a.screen.constructor.name, i: a.guide && a.guide.i, b: a.screen && a.screen.bRef && a.screen.bRef.board, h: a.screen && a.screen.bRef && a.screen.bRef.hand }), rot: window.__fit.rot, k: window.__fit.k, tf: document.getElementById('stage').style.transform }; });
    await page.screenshot({ path: path.join(OUT, `${PREFIX}-${d.name}-flip-landscape.png`) });
    flip = ` · 가로로 들면 돌리기 ${after.rot ? '그대로(틀림)' : '풀림'} K ${after.k} transform「${after.tf}」 판 상태 ${after.st === before ? '그대로' : '바뀜(틀림)'}`;
  }
  await context.close();
  return { name: d.name, result: `${i >= 5 ? `첫 수 끝(걸음 ${i})` : `멈춤(걸음 ${i})`}${rot ? ' · 돌려 그림' : ''}${flip}`, log: log.join(' → ') };
}

const touchResults = [];
for (const d of DEVICES) {
  if (ONLY && !d.name.includes(ONLY)) continue;
  await shotsFor(d);
  if (d.touch && TOUCH) touchResults.push(await touchFlow(d));
}
for (const b of Object.values(browsers)) await b.close();
srv.close();
console.log('\n기기 | 창 | dpr | K | 캔버스 CSS | 뒷면 | 캔버스 창 자리(왼·위–오른·아래) | 틀(여백 판) | 돌려 그림 | 타이틀 여백 장면 ms | 멈춤 구역');
for (const r of table) console.log(`${r.name} | ${r.view} | ${r.dpr} | ${r.k} | ${r.cssW}×${r.cssH} | ${r.back} | ${r.left},${r.top}–${r.right},${r.bottom} | ${r.stage} | ${r.rot ? '예' : '아니오'} | ${r.sceneMs ?? '-'} | ${r.pause ?? '-'}`);
console.log('\n터치 흐름');
for (const r of touchResults) console.log(`${r.name}: ${r.result}${r.log ? ` (${r.log})` : ''}`);
if (errors.length) { console.log('오류', errors.length); for (const e of errors.slice(0, 5)) console.log(e); process.exitCode = 1; }
