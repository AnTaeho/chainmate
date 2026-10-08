// 브라우저 진입: 화면 맞춤(폰 세로면 돌려 그리기) · 여백 판 · 입력 · 루프. 화면과 흐름은 src/ui/app.js.
// 연기 시험(tools/smoke.mjs)은 가짜 window/document를 넘겨 boot()를 그대로 부른다 — 가짜에는 body · 여백 판 · 돌리는 틀 · visualViewport가 없다.
import { createApp } from './ui/app.js';
import { chooseFit, stageTransform, toGame as pointToGame } from './ui/fit.js';
import { drawPad, resetPad } from './render/backdrop.js';
import { createTelemetry } from './ui/telemetry.js';
import { VERSION } from './version.js';

export async function boot(env = {}) {
  const win = env.window || globalThis.window;
  const doc = env.document || globalThis.document;
  const canvas = doc.getElementById('screen');
  // 가짜 DOM의 getElementById는 무엇을 물어도 게임 캔버스를 준다 — 다른 것이면 쓰지 않는다
  const own = (id) => { const el = doc.getElementById(id); return el && el !== canvas ? el : null; };
  const pad = own('pad'), stage = own('stage'), safe = own('safe');
  const media = (q) => { try { return !!(win.matchMedia && win.matchMedia(q).matches); } catch { return false; } };
  const coarse = () => media('(pointer: coarse)') || (win.navigator && win.navigator.maxTouchPoints > 0 && !media('(pointer: fine)'));

  // 보이는 창: 주소창이 접히고 펴질 때도 보이는 만큼(visualViewport). 손가락으로 확대한 동안(scale ≠ 1)은 창 크기를 쓴다
  const visible = () => {
    const vv = win.visualViewport;
    if (vv && Math.abs(vv.scale - 1) < 0.01 && vv.width > 0) return [vv.width, vv.height];
    return [win.innerWidth, win.innerHeight];
  };
  // 그릴 수 있는 창 전체(여백 판 · 틀이 덮는 크기, CHM-52): 아이폰은 보이는 창이 화면보다 짧게 잡혀도 그 아래 띠에 그림이 그려진다.
  // 창 · visualViewport · 문서 · 100lvh 재기 중 가장 큰 것
  let probe = null;
  if (doc.body && doc.createElement) {
    try {
      probe = doc.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position:fixed;left:0;top:0;width:100lvw;height:100lvh;visibility:hidden;pointer-events:none';
      doc.body.appendChild(probe);
    } catch { probe = null; }
  }
  const scr = () => {
    const s = win.screen;
    if (!s || !(s.width > 0)) return null;
    const lo = Math.min(s.width, s.height), hi = Math.max(s.width, s.height);
    return win.innerWidth > win.innerHeight ? [hi, lo] : [lo, hi];
  };
  // 홈 화면 앱(iOS navigator.standalone)은 주소창이 없다 — 창이 화면과 폭이 같고 높이만 조금(안전 영역 하나쯤) 짧으면 화면 전체가 보이는 창이다.
  // iOS 26 홈 화면 앱은 innerHeight가 화면보다 위 안전 영역(62)만큼 짧게 잡혀 아래 띠가 비었다(CHM-52). 아이패드 나눠 보기처럼 창이 작으면 쓰지 않는다
  const standaloneScreen = (w, h) => {
    if (!(win.navigator && win.navigator.standalone === true)) return null;
    const s = scr();
    if (!s) return null;
    const [sw, sh] = s;
    const ok = (a, b, c, d) => Math.abs(a - b) < 2 && c - d >= 0 && c - d <= 120;
    return ok(sw, w, sh, h) || ok(sh, h, sw, w) ? s : null;
  };
  const viewport = () => {
    let [vw, vh] = visible();
    let fw = Math.max(vw, win.innerWidth || 0), fh = Math.max(vh, win.innerHeight || 0);
    const de = doc.documentElement;
    if (de && de.clientWidth > 0) { fw = Math.max(fw, de.clientWidth); fh = Math.max(fh, de.clientHeight); }
    if (probe && probe.offsetWidth > 0) { fw = Math.max(fw, probe.offsetWidth); fh = Math.max(fh, probe.offsetHeight); }
    const st = standaloneScreen(vw, vh);
    if (st) { [vw, vh] = st; fw = Math.max(fw, vw); fh = Math.max(fh, vh); }
    return { vw, vh, full: { width: fw, height: fh } };
  };
  // 안전 영역(노치 · 홈 막대): #safe의 padding이 env(safe-area-inset-*)
  const inset = () => {
    if (!safe || !win.getComputedStyle) return null;
    const cs = win.getComputedStyle(safe);
    return { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0, top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  };

  let app = null, fit = null, pendingScale = 1;
  function refit() {
    const { vw, vh, full } = viewport();
    fit = chooseFit({ vw, vh, full, dpr: win.devicePixelRatio || 1, inset: inset(), coarse: coarse() });
    // 화면 글 12px가 몇 배로 보이나(CSS 화소). 작은 창에서 처음 안내가 큰 글자를 권한다
    if (app) { app.pixelScale = fit.css; app.coarse = coarse(); }
    const c = fit.canvas;
    canvas.style.width = `${c.width}px`;
    canvas.style.height = `${c.height}px`;
    canvas.style.left = `${c.left}px`;
    canvas.style.top = `${c.top}px`;
    if (pad) {
      const p = fit.pad;
      pad.style.width = `${p.width}px`; pad.style.height = `${p.height}px`;
      pad.style.left = `${p.left}px`; pad.style.top = `${p.top}px`;
      resetPad();
    }
    // 폰 세로: 캔버스 · 여백 판이 든 틀을 시계 방향 90도 돌린다(틀 크기 = 창의 가로 · 세로를 바꾼 것). 가로로 돌아오면 틀을 풀어 둔다.
    // 틀은 그릴 수 있는 창 전체(full)를 덮는다 — 캔버스는 그 안의 보이는 창에 앉는다
    if (stage) {
      stage.style.width = `${fit.frame.width}px`;
      stage.style.height = `${fit.frame.height}px`;
      stage.style.transform = fit.rot ? stageTransform(fit.frame.height) : '';
    }
    if (doc.body && doc.body.classList) doc.body.classList.toggle('rot', fit.rot);
    win.__fit = fit;
    // 뒷면 캔버스 배율 N(빛과 움직임, src/ui/fit.js backScale). 480×270 좌표는 그대로, 움직이는 것만 1/N 칸에 선다
    if (app) app.setScale(fit.n); else pendingScale = fit.n;
  }
  refit();
  // 창 크기가 바뀌면 조금 기다렸다 한 번만 다시 고른다(주소창이 접히는 동안 배율이 오락가락하지 않게). 기기를 돌리면 곧바로 + 늦게 한 번 더
  let timer = null;
  const later = (ms = 120) => { if (timer) win.clearTimeout(timer); timer = win.setTimeout ? win.setTimeout(() => { timer = null; refit(); }, ms) : (refit(), null); };
  win.addEventListener('resize', () => later());
  win.addEventListener('orientationchange', () => { refit(); later(350); });
  // 홈 화면 앱으로 돌아오거나 뒤로 가기로 다시 보일 때(주소창 · 창 크기가 그사이 바뀌었을 수 있다)
  win.addEventListener('pageshow', () => later(60));
  if (win.visualViewport && win.visualViewport.addEventListener) win.visualViewport.addEventListener('resize', () => later());

  try {
    await Promise.all([doc.fonts.load('400 12px Galmuri11'), doc.fonts.load('700 12px Galmuri11')]);
  } catch { /* 글꼴이 없어도 돈다 */ }

  let audio = null;
  try {
    const mod = await import('./audio/audio.js');
    audio = mod.createAudio(win);
  } catch { audio = null; }

  const reduced = media('(prefers-reduced-motion: reduce)');
  const now = () => (win.performance || globalThis.performance).now();
  // 앱(Tauri 2)은 __TAURI_INTERNALS__로 안다(withGlobalTauri가 꺼져 있어도 들어온다).
  const platform = win.__TAURI_INTERNALS__ ? 'app' : 'web';
  // 기록 내보내기(CHM-50 · CHM-54): 손가락 기기는 공유 시트(navigator.share, 파일 하나), 그 밖은 파일로 받기(Blob · <a download>), 둘 다 없으면 클립보드.
  // 공유 시트는 손가락 기기에서만 연다 — 데스크톱 크롬 · 사파리에도 share가 있지만 거기서는 받기가 낫다(CHM-50에서 확인한 길).
  // share(name, text): 열 수 없으면 null, 열면 Promise<'shared' | 'cancel' | 'fail'>. 누른 그 순간 안에서 불러야 한다(앞에 await를 두지 않는다)
  const share = (name, text) => {
    const nav = win.navigator;
    if (!coarse() || !nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || typeof win.File !== 'function') return null;
    let files;
    try {
      files = [new win.File([text], name, { type: 'application/json' })];
      if (!nav.canShare({ files })) return null;
    } catch { return null; }
    try {
      return Promise.resolve(nav.share({ files })).then(() => 'shared', (e) => (e && e.name === 'AbortError' ? 'cancel' : 'fail'));
    } catch { return Promise.resolve('fail'); }
  };
  // 가짜 DOM에는 body · URL이 없어 못 받는다. 손가락 기기의 앱(iOS WKWebView)은 <a download>를 눌러도 예외 없이 아무 일도 없다(CHM-53) — 받았다고 하지 않고 클립보드로 넘긴다
  const download = (name, text) => {
    if (platform === 'app' && coarse()) return false;
    try {
      const U = win.URL;
      if (!doc.body || !U || !U.createObjectURL || !win.Blob) return false;
      const url = U.createObjectURL(new win.Blob([text], { type: 'application/json' }));
      const a = doc.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      doc.body.appendChild(a); a.click(); a.remove();
      win.setTimeout(() => U.revokeObjectURL(url), 30000);
      return true;
    } catch { return false; }
  };
  const copyText = (text) => {
    try { return win.navigator.clipboard.writeText(text).then(() => true, () => false); } catch { return Promise.resolve(false); }
  };
  // 기록 보내기(CHM-63, src/ui/telemetry.js): 배포 주소 · 앱에서만, 자동화 브라우저가 아닐 때만, 설정이 켜져 있을 때만 나간다
  const nav = win.navigator || {};
  const tel = createTelemetry({
    fetch: typeof win.fetch === 'function' ? (url, init) => win.fetch(url, init) : null,
    beacon: typeof nav.sendBeacon === 'function' ? (url, body) => nav.sendBeacon(url, body) : null,
    storage: win.localStorage, host: (win.location && win.location.hostname) || '',
    platform: platform === 'app' ? (coarse() ? 'ios' : 'desktop') : 'web',
    webdriver: !!nav.webdriver, ua: nav.userAgent || '', version: VERSION,
    ...(typeof win.setTimeout === 'function' && typeof win.clearTimeout === 'function' ? { setTimer: (fn, ms) => win.setTimeout(fn, ms), clearTimer: (t) => win.clearTimeout(t) } : {}),
    enabled: () => !app || app.settings.telemetry !== false,
    context: () => (app ? { lang: app.settings.lang, dan: app.records.unlocked ? app.records.unlocked.dan : null, screen_w: win.innerWidth, screen_h: win.innerHeight, scale: app.scale, screen: (app.overlay || app.screen || {}).name || null } : {}),
  });
  const track = (name, props) => tel.track(name, props);
  track.off = () => tel.off();
  app = createApp({ canvas, storage: win.localStorage, now, reducedMotion: reduced, audio, platform, share, download, copyText, track, today: env.today });
  win.addEventListener('error', (e) => tel.error((e && e.error) || (e && e.message) || 'error'));
  win.addEventListener('unhandledrejection', (e) => tel.error((e && e.reason) || 'unhandledrejection'));
  // 화면이 숨거나 떠날 때 남은 것을 보낸다
  win.addEventListener('pagehide', () => tel.flushNow());
  if (doc.addEventListener) doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') tel.flushNow(); });
  app.setScale(pendingScale);
  refit();
  tel.open();
  if (audio) audio.apply(app.settings);

  // 누른 자리 → 게임 좌표(보이는 캔버스 사각형 기준 — 확대 · DPR · 가장자리 여백과 상관없다). 돌려 그렸으면 돌린 축으로 되돌린다
  const toGame = (e) => pointToGame(e.clientX, e.clientY, canvas.getBoundingClientRect(), !!(fit && fit.rot));
  canvas.addEventListener('mousemove', (e) => { const [x, y] = toGame(e); app.pointer('move', x, y); });
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); const [x, y] = toGame(e); app.pointer('down', x, y, e.button); });
  win.addEventListener('mouseup', (e) => { const [x, y] = toGame(e); app.pointer('up', x, y, e.button); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // 손가락: 한 손가락만 받는다(두 손가락은 확대 몸짓이라 무시). 오른쪽 누르기(판 위 표시)는 손가락에는 없다
  // 진짜 가로 고정(CHM-52): 첫 누름(touchend — 전체 화면은 누름을 뗄 때만 허락된다)에 전체 화면 → 방향 잠금을 한 번 해 본다.
  // 되는 곳은 안드로이드 크롬뿐이다. 아이폰 사파리는 둘 다 없어 돌려 그리기로 남는다. 실패하면 조용히 그대로
  let lockTried = false;
  const landscapeLock = () => {
    if (lockTried) return;
    lockTried = true;
    try {
      const so = win.screen && win.screen.orientation, de = doc.documentElement;
      if (!so || typeof so.lock !== 'function' || !de || typeof de.requestFullscreen !== 'function') return;
      if (!(fit && fit.rot) || doc.fullscreenElement) return; // 돌려 그리는 폰 세로일 때만
      de.requestFullscreen({ navigationUI: 'hide' }).then(() => so.lock('landscape')).catch(() => {});
    } catch { /* 그대로 돌려 그린다 */ }
  };
  // 손가락은 틀(#stage — 캔버스와 가장자리 여백 판) 전체에서 받는다: 화면 끝의 작은 단추(멈춤 ≡)는 누르는 구역이 캔버스 밖 여백까지 넓다(CHM-52).
  // 자리는 캔버스 사각형 기준이라 여백을 누르면 게임 밖 좌표(0 미만 · 480 이상)가 되고, 거기 구역이 없으면 아무 일도 없다
  const touchEl = stage || canvas;
  let finger = null;
  touchEl.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (finger != null || e.touches.length > 1) return;
    app.touch = true;
    const t = e.changedTouches[0];
    finger = t.identifier;
    const [x, y] = toGame(t); app.pointer('move', x, y); app.pointer('down', x, y);
  }, { passive: false });
  const own1 = (e) => { for (const t of e.changedTouches) if (t.identifier === finger) return t; return null; };
  touchEl.addEventListener('touchmove', (e) => { e.preventDefault(); const t = own1(e); if (!t) return; const [x, y] = toGame(t); app.pointer('move', x, y); }, { passive: false });
  touchEl.addEventListener('touchend', (e) => { e.preventDefault(); const t = own1(e); if (!t) return; finger = null; const [x, y] = toGame(t); app.pointer('up', x, y); landscapeLock(); }, { passive: false });
  // 끊긴 손가락(전화 · 알림): 아무것도 누르지 않은 것으로
  touchEl.addEventListener('touchcancel', () => { if (finger == null) return; finger = null; app.pointer('up', -1, -1); app.pointer('move', -1, -1); });
  // 캔버스 밖(여백 판)에서도 화면이 끌려가거나 확대되지 않게
  if (doc.addEventListener) {
    const stop = (e) => { if (e.cancelable) e.preventDefault(); };
    doc.addEventListener('touchmove', stop, { passive: false });
    doc.addEventListener('gesturestart', stop, { passive: false });
    doc.addEventListener('gesturechange', stop, { passive: false });
    doc.addEventListener('dblclick', stop, { passive: false });
  }
  win.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if ([' ', 'Enter', 'Escape', '1', '2', '3', '4', '5', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    app.key(k);
  });

  const loop = (t) => {
    app.frame(t);
    if (pad) drawPad(pad, fit.pad, app.surround());
    win.requestAnimationFrame(loop);
  };
  win.requestAnimationFrame(loop);
  win.__app = app;
  return app;
}

if (typeof document !== 'undefined' && !globalThis.__CHAINMATE_NO_BOOT__) boot();
