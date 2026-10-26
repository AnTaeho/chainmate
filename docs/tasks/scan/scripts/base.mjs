// 손가락 · 마우스 견주기: 실제 WebKit(손가락 흉내)으로 화면마다 누를 수 있는 구역을 모두 눌러, 같은 게임 자리를 마우스로 누른 결과와 견준다.
//   node tools/touch-audit.mjs [--only title,shop,…] [--configs land-int,land-fill,port-int,port-fill] [--per 4] [--json out.json] [--no-drift] [--no-edge] [--engine webkit|chromium]
// 견주는 것(구역마다, 마우스 그림 네모 기준):
//   map    진짜 손가락 누름(page.touchscreen.tap)이 게임 좌표로 바르게 옮겨지나(±1 도트 — WebKit 손가락 좌표는 정수 CSS 화소)
//   steal  그림 안 자리(가운데 · 네 변 2 도트 안)를 손가락이 누르면 마우스와 다른 구역이 잡히나(손가락 구역 넓히기가 이웃을 덮는다)
//   tap    가운데 한 번 누름 뒤 상태(화면 · 덮개 · 판 · 고른 것 · 말풍선)가 마우스 누름과 같은가. 미리 보기 구역은 두 번째 누름을 마우스와 견준다
//   drift  누른 채 6 · 4 CSS 화소 밀었다 떼도 같은가(손가락은 떼며 미끄러진다)
//   near   손가락보다 작은 구역의 바로 바깥(2 도트 밖 빈 자리)을 눌러도 가운데 누름과 같은가
//   slip   그런 구역 가운데를 눌러 좁은 쪽으로 3 도트 밖(빈 자리)에서 떼도 같은가
//   tip    마우스로 가리키면 뜨는 말풍선 · 낱말 상자가 손가락 누름 뒤에도 뜨나
//   edge   누를 수 있는 단추가 창 끝에서 몇 CSS 화소인가(iOS 몸짓 띠 20 미만)
// 손가락은 #stage에 touchstart · touchmove · touchend를 직접 보낸다(WebKit은 Touch 생성자가 없다 — main.js가 읽는 칸만 담는다). 사이에 프레임을 돈다.
// 정적 파일 · /api(가짜 서버)는 스스로 띄운 서버(빈 포트)로 연다. Playwright는 저장소 의존성에 넣지 않는다 — PLAYWRIGHT(index.mjs 경로) · 'playwright' · 전역 순.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = '/Users/antaeho/workspace/projects/chainmate';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = opt('--only', null);
const PER = Number(opt('--per', 4)); // 같은 꼴 id(숫자만 다른 것)는 몇 개까지 누르나
const JSON_OUT = opt('--json', null);
const DRIFT = !args.includes('--no-drift');
const EDGE = !args.includes('--no-edge'); // near · slip(작은 구역 바깥 누름 · 밀려 뗌)
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
// 손가락 판: 아이폰 사파리 가로(734×343) · 세로(393×659, 돌려 그린다), 둘 다 dpr 3. edge만: 아이폰 17 사파리 가로(안전 영역 · 주소창 펼침)
const CONFIGS = {
  'land-int': { w: 734, h: 343, fit: 'int' },
  'land-fill': { w: 734, h: 343, fit: 'fill' },
  'port-int': { w: 393, h: 659, fit: 'int' },
  'port-fill': { w: 393, h: 659, fit: 'fill' },
  'i17-int': { w: 874, h: 402, fit: 'int', emu: { vis: 352, inset: { top: 0, right: 62, bottom: 21, left: 62 } }, edgeOnly: true },
  'i17-fill': { w: 874, h: 402, fit: 'fill', emu: { vis: 352, inset: { top: 0, right: 62, bottom: 21, left: 62 } }, edgeOnly: true },
};
const PICK = opt('--configs', Object.keys(CONFIGS).join(',')).split(',');

async function loadPlaywright() {
  if (process.env.PLAYWRIGHT) return import(process.env.PLAYWRIGHT);
  try { return await import('playwright'); } catch { /* 전역 */ }
  return import(path.join(execSync('npm root -g').toString().trim(), 'playwright', 'index.mjs'));
}

// ── 서버(정적 + 가짜 순위 서버)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const { fakeApi, seedBoard, demoRows } = await import('/Users/antaeho/workspace/projects/chainmate/test/helpers/fakeapi.js');
const TODAY = '2026-10-08';
const api = fakeApi({ build: 'touch-audit', now: () => Date.parse(`${TODAY}T12:00:00Z`), rand: (() => { let r = 7; return () => ((r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x80000000); })() });
await seedBoard(api, TODAY, demoRows(24));
const srv = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = await api.fetch(req.url, { method: req.method, headers: req.headers.authorization ? { Authorization: req.headers.authorization } : {}, body: chunks.length ? Buffer.concat(chunks).toString('utf8') : undefined });
    let body = '';
    try { body = JSON.stringify(await r.json()); } catch { res.writeHead(404); res.end(); return; }
    res.writeHead(r.status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(body);
    return;
  }
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const p = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => srv.listen(0, '127.0.0.1', 1024, ok));
const PORT = srv.address().port;

// ── 페이지 안: 루프를 잡고(프레임은 도구가 돈다), 상태 서명 · 구역 · 손가락 보내기
const INIT = () => {
  window.__CHAINMATE_NO_BOOT__ = true;
  window.requestAnimationFrame = (cb) => { window.__raf = cb; return 1; };
  window.__rng = () => ({ s: 77 });
  let T = 0;
  window.__step = (n = 1) => { for (let i = 0; i < n; i++) { T += 1000 / 60; const cb = window.__raf; window.__raf = null; if (cb) cb(T); } };
  window.__settle = (max = 900) => { const a = window.__app; for (let i = 0; i < max && a.screen && (a.screen.busy || a.screen.playing); i++) window.__step(1); };
  const h32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // 화면 상태: 정수 · 글 · 참거짓 칸만(시각 · 연출 소수는 뺀다), 앱 · 함수 · 큰 그림 캐시는 건너뛴다
  const SKIP = /^(app|t|time|idleT|age|anim|fx|cache|baked|art|sway|glow|shake|flash|bob|tick|last|wave|hold|nudge|blink|beat|seen|visited)$/i;
  const flat = (o, depth = 0) => {
    if (o == null || depth > 3) return '';
    if (typeof o !== 'object') return typeof o === 'number' ? (Number.isInteger(o) ? String(o) : '') : typeof o === 'function' ? '' : String(o);
    if (Array.isArray(o)) return `[${o.slice(0, 80).map((v) => flat(v, depth + 1)).join(',')}]`;
    if (o instanceof HTMLElement || o instanceof CanvasRenderingContext2D || (typeof OffscreenCanvas !== 'undefined' && o instanceof OffscreenCanvas) || o instanceof HTMLCanvasElement) return '';
    return `{${Object.keys(o).filter((k) => !SKIP.test(k) && !/T$|Time$|At$/.test(k)).map((k) => `${k}:${flat(o[k], depth + 1)}`).join(',')}}`;
  };
  window.__sig = () => {
    const a = window.__app, s = a.screen, ui = a.ui;
    const run = a.run ? h32(JSON.stringify({ ...a.run, track: null, shop: a.run.shop ? { ...a.run.shop, rng: null } : null })) : '-';
    return {
      scr: s && s.name, ov: a.overlay ? a.overlay.name : null, phase: a.run ? a.run.phase : null, money: a.run ? a.run.money : null, run,
      st: s ? h32(flat(s)) : '-', ovst: a.overlay ? h32(flat(a.overlay)) : '-',
      prev: ui.previewId, tapSq: s && s.tapSq != null ? s.tapSq : null,
      tip: a.tipRect ? 1 : 0, keys: (a.keyBoxes || []).length, toasts: a.toasts.length, guide: a.guide ? a.guide.i : null,
      hover: ui.hover ? ui.hover.id : null,
    };
  };
  window.__regions = () => window.__app.ui.regions.filter((q) => q.w > 0 && q.h > 0).map((q) => ({
    id: q.id, x: q.x, y: q.y, w: q.w, h: q.h, en: q.enabled !== false, click: !!q.onClick, tip: !!(q.tip || q.keys), drag: !!q.drag, preview: !!q.preview, passive: !!q.passive, shape: !!q.hit,
  }));
  window.__hits = (pts) => pts.map(([x, y]) => { const r = window.__app.ui.hitIn(window.__app.ui.regions, x, y); return r ? r.id : null; });
  // 게임 좌표 → 창 좌표(보이는 캔버스 네모, 돌렸으면 돌린 축)
  window.__client = (gx, gy) => { const r = window.__app.canvas.getBoundingClientRect(); return window.__toClient(gx, gy, r, !!(window.__fit && window.__fit.rot)); };
  // 손가락 하나(id 7)를 #stage에 보낸다. main.js가 읽는 칸(touches · changedTouches · identifier · clientX/Y · cancelable)만
  window.__touch = (type, gx, gy, dcx = 0, dcy = 0) => {
    const [cx, cy] = window.__client(gx, gy);
    const t = { identifier: 7, clientX: cx + dcx, clientY: cy + dcy };
    const e = new Event(type, { cancelable: true, bubbles: true });
    Object.defineProperty(e, 'touches', { value: type === 'touchend' ? [] : [t] });
    Object.defineProperty(e, 'changedTouches', { value: [t] });
    document.getElementById('stage').dispatchEvent(e);
  };
};

// 브라우저: WebKit이 없으면(클라우드 — 내려받기가 막힌 곳) 손가락을 흉내 내는 Chromium(hasTouch)으로. --engine으로 고를 수 있다
const pw = await loadPlaywright();
const ENGINE = opt('--engine', null);
let browser = null;
for (const e of ENGINE ? [ENGINE] : ['webkit', 'chromium']) {
  try { browser = await pw[e].launch(); console.log(`# 브라우저 ${e}`); break; } catch (err) { if (ENGINE) throw err; }
}

async function openPage(cfg, { touch }) {
  const ctx = await browser.newContext({ viewport: { width: cfg.w, height: cfg.h }, deviceScaleFactor: 3, hasTouch: touch, ...(touch ? { userAgent: UA } : {}) });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(INIT);
  if (cfg.emu) await page.addInitScript((emu) => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => emu.vis });
    if (window.VisualViewport) Object.defineProperty(VisualViewport.prototype, 'height', { configurable: true, get: () => emu.vis });
    const i = emu.inset;
    document.addEventListener('readystatechange', () => {
      if (document.getElementById('emu-safe')) return;
      const st = document.createElement('style'); st.id = 'emu-safe'; st.textContent = `#safe{padding:${i.top}px ${i.right}px ${i.bottom}px ${i.left}px !important}`; (document.head || document.documentElement).appendChild(st);
    });
  }, cfg.emu);
  await page.addInitScript(() => { localStorage.clear(); localStorage.setItem('chainmate.settings.v1', JSON.stringify({ volume: 0, music: 0, lang: 'ko', telemetry: false })); });
  // 여러 판을 함께 돌리면 첫 받기(모듈 · 글꼴)가 멈출 때가 있다 — 90초 안에 첫 그림이 없으면 다시 연다(세 번까지)
  for (let tries = 0; ; tries++) {
    await page.goto(`http://127.0.0.1:${PORT}/index.html?fit=${cfg.fit}`);
    await page.evaluate(async (today) => {
      const m = await import('/src/main.js');
      m.boot({ rankBase: '', today: () => today });
      window.__toClient = (await import('/src/ui/fit.js')).toClient;
    }, TODAY);
    try { await page.waitForFunction(() => window.__app && window.__raf, null, { timeout: 90000 }); break; } catch (e) { if (tries >= 2) throw e; console.log(`# 다시 연다(${cfg.w}×${cfg.h} ${cfg.fit})`); }
  }
  await page.waitForTimeout(300); // 늦춘 다시 맞추기
  await page.evaluate(() => {
    const a = window.__app;
    a.alwaysDraw = true;
    a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); a.records.tutorialAsked = true;
    if (a.overlay && a.overlay.name === 'welcome') a.closeOverlay();
    window.__set0 = JSON.stringify(a.settings);
    window.__step(5);
  });
  page.errors = errors;
  return page;
}

// ── 장면(drawcheck.mjs와 같은 꾸밈). 문자열로 넘겨 페이지 안에서 돈다
const NEW = (seed, after = '') => `(() => { const a = window.__app; a.toTitle(); a.overlay = null; a.nextSeed = ${seed}; a.newRun(); if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 }); ${after} })()`;
const SHOP = `(() => {
  const a = window.__app; a.toTitle(); a.nextSeed = 11; a.newRun();
  if (a.run.phase === 'draft') a.cmd({ type: 'joseki', index: 0 });
  const r = a.run;
  for (const [id, edition] of [['chivalry', null], ['quick_change', 'foil'], ['first_move', null], ['whim', 'rainbow']]) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition, paid: 5 });
  r.consumableSlots = 4; r.consumables = [{ kind: 'engraving', id: 'glass' }, { kind: 'soul', id: 'echo' }, { kind: 'evolve' }, { kind: 'tactic', id: 'freeze' }];
  r.money = 60; r.phase = 'shop';
  r.shop = { rng: window.__rng(), display: [{ kind: 'maxim', id: 'light_step', price: 5, sold: false }, { kind: 'piece', t: 'N', price: 6, sold: false, edition: 'pearl' }, { kind: 'soul', id: 'echo', price: 99, sold: false }], packs: [{ kind: 'engraving', price: 4, sold: false }, { kind: 'chart', price: 4, sold: false }], rerolls: 0, promoted: false, removed: false };
  a.go('shop');
})()`;
const BATTLE = NEW(11, `const r = a.run; for (const id of ['chivalry', 'quick_change', 'first_move', 'whim', 'sacrifice']) r.maxims.push({ uid: r.nextUid++, id, data: {}, edition: null, paid: 5 }); r.consumables = [{ kind: 'tactic', id: 'freeze' }]; r.ante = 3; r.blind = 0; a.cmd({ type: 'play' }); a.go('battle', { events: [] });`);
const SCENES = [
  { name: 'title', setup: `(() => { const a = window.__app; a.toTitle(); })()` },
  { name: 'welcome', setup: `(() => { const a = window.__app; localStorage.removeItem('chainmate.run.v1'); a.toTitle(); a.welcomeShut = false; a.records.tutorialAsked = false; a.records.runs = 0; a.records.lessonsDone = false; a.records.lessonsSeen = {}; a.records.coachSeen = { telemetry: true }; window.__step(2); })()`, after: `(() => { const a = window.__app; a.records.coachSeen = new Proxy({}, { get: () => true, has: () => true }); a.records.tutorialAsked = true; })()` },
  { name: 'settings', setup: `(() => { const a = window.__app; a.toTitle(); a.openOverlay('settings'); })()` },
  { name: 'lessons', setup: `(async () => { const a = window.__app; const { LESSONS } = await import('/src/ui/lessons.js'); a.toTitle(); a.records.lessonsSeen = Object.fromEntries(LESSONS.slice(0, 3).map((L) => [L.id, true])); a.go('lessons'); })()` },
  { name: 'lessons-end', setup: `(async () => { const a = window.__app; const { LESSONS } = await import('/src/ui/lessons.js'); a.toTitle(); a.records.lessonsSeen = Object.fromEntries(LESSONS.map((L) => [L.id, true])); a.go('lessons', { end: true }); })()` },
  { name: 'lesson', setup: `(() => { const a = window.__app; a.toTitle(); a.go('lesson', { index: 0, phase: 'play' }); })()`, frames: 90 },
  { name: 'setup', setup: `(() => { const a = window.__app; a.toTitle(); a.go('setup'); })()` },
  { name: 'draft', setup: `(() => { const a = window.__app; a.toTitle(); a.nextSeed = 21; a.newRun(); if (a.run.phase === 'draft') a.go('draft'); })()`, frames: 100 },
  { name: 'select', setup: NEW(10, `a.goPhase();`) },
  { name: 'battle', setup: BATTLE, frames: 40 },
  { name: 'battle-picked', setup: `(() => { ${BATTLE}; window.__step(30); window.__settle(); const a = window.__app; const r = a.ui.regions.find((q) => q.id === 'hand:0'); if (r && r.onClick) r.onClick(r); })()`, frames: 20 },
  { name: 'pause', setup: `(() => { ${BATTLE}; window.__step(20); window.__app.openOverlay('pause'); })()` },
  { name: 'moves', setup: `(() => { ${BATTLE}; window.__step(20); const a = window.__app; const r = a.ui.regions.find((q) => q.id === 'btn:moves'); if (r && r.onClick) r.onClick(r); })()`, frames: 30 },
  { name: 'shop', setup: SHOP, frames: 60 },
  { name: 'pack', setup: `(() => { ${SHOP}; window.__step(30); const a = window.__app; const r = a.ui.regions.find((q) => q.id === 'shop:pack:1'); if (r) { a.ui.previewId = r.id; r.onClick(r); } })()`, frames: 150 },
  { name: 'reward', setup: NEW(11, `a.run.last = { score: 5200, target: 3000, overflow: 1 }; a.go('reward', { reward: { base: 3, moves: 2, interest: 1, mate: 2, overflow: 0, earned: 1, total: 9 }, events: [] });`), frames: 200 },
  { name: 'chest', setup: NEW(11, `a.go('chest', { chest: { count: 3, cells: [{ lit: true, item: { kind: 'money', money: 2 } }, { lit: false }, { lit: true, item: { kind: 'piece', t: 'R' } }, { lit: true, item: { kind: 'chart', form: 'N' } }, { lit: false }] } });`), frames: 400 },
  { name: 'awaken', setup: NEW(11, `const p = a.run.deck[0]; p.soul = 'echo'; a.go('awaken', { awaken: { soul: 'echo', piece: p.t, pieceId: p.id, src: 'golden' } });`), frames: 200 },
  { name: 'legend', setup: NEW(11, `a.go('legend', { legend: 'immortal' });`), frames: 420 },
  { name: 'result', setup: NEW(11, `const r = a.run; r.ante = 3; r.log.push({ ante: 3, blind: 0, kind: 'practice', score: 1200, target: 3000, best: 800 }); r.phase = 'lost'; a.go('result');`), frames: 200 },
  { name: 'codex', setup: `(() => { const a = window.__app; a.toTitle(); a.go('codex'); })()`, frames: 30 },
  { name: 'codex-pieces', setup: `(() => { const a = window.__app; a.toTitle(); a.go('codex'); window.__step(3); const r = a.ui.regions.find((q) => q.id === 'codex:tab:pieces'); if (r) r.onClick(r); })()`, frames: 30 },
  { name: 'records', setup: `(() => { const a = window.__app; a.toTitle(); a.go('records'); })()`, frames: 30 },
  { name: 'records-achv', setup: `(() => { const a = window.__app; a.toTitle(); a.go('records', { tab: 'achv' }); })()`, frames: 30 },
  { name: 'unlocks', setup: `(() => { const a = window.__app; a.toTitle(); a.go('unlocks'); })()`, frames: 30 },
  { name: 'rank', setup: `(() => { const a = window.__app; a.toTitle(); a.go('rank'); })()`, net: true },
  { name: 'link', setup: `(() => { const a = window.__app; a.toTitle(); a.go('link'); })()`, net: true },
  { name: 'account', setup: `(() => { const a = window.__app; a.toTitle(); a.go('account'); })()`, net: true },
];

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
async function enter(page, sc) {
  // 설정은 장면마다 처음으로 되돌린다 — 앞 장면에서 누른 횟수(손가락은 미리 보기 · 밀기로 더 누른다)에 따라 언어 · 큰 글자가 갈리면 뒤 장면이 모두 다르게 보인다
  await page.evaluate(async () => {
    const a = window.__app; a.ui.move(-1, -1); a.ui.previewId = null; a.toasts = [];
    for (const k of Object.keys(a.settings)) delete a.settings[k];
    Object.assign(a.settings, JSON.parse(window.__set0));
    (await import('/src/ui/lang.js')).setLang(a.settings.lang);
  });
  await page.evaluate(sc.setup);
  await page.evaluate((n) => { window.__step(n); window.__settle(); window.__step(2); }, sc.frames || 20);
  // 망 답(가짜 서버)을 기다린다
  if (sc.net) for (let i = 0; i < 8; i++) { await sleep(40); await page.evaluate(() => window.__step(3)); }
  await page.evaluate(() => { window.__app.ui.move(-1, -1); window.__step(2); });
}
async function leave(page, sc) { if (sc.after) await page.evaluate(sc.after); }
