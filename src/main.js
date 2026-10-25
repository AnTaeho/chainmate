// 브라우저 진입: 화면 맞춤(폰 세로면 돌려 그리기) · 여백 판 · 입력 · 루프. 화면과 흐름은 src/ui/app.js.
// 연기 시험(tools/smoke.mjs)은 가짜 window/document를 넘겨 boot()를 그대로 부른다 — 가짜에는 body · 여백 판 · 돌리는 틀 · visualViewport가 없다.
import { createApp } from './ui/app.js';
import { chooseFit, stageTransform, toGame as pointToGame } from './ui/fit.js';
import { drawPad, resetPad } from './render/backdrop.js';
import { createTelemetry } from './ui/telemetry.js';
import { createRank } from './ui/rank.js';
import { createCloud } from './ui/cloud.js';
import { createFields, keyboardLift } from './ui/textfield.js';
import { VERSION } from './version.js';
import { fontOf } from './render/type.js';

// 첫 화면 앞에서 글꼴 · 소리 모듈을 기다리는 가장 긴 시간(ms)
export const BOOT_WAIT = { fonts: 3000, audio: 4000 };
const WAITED = Symbol('waited');
export async function boot(env = {}) {
  const win = env.window || globalThis.window;
  // 저장소를 읽기만 해도 던지는 곳(쿠키 막음 · 샌드박스 iframe): 한 번만 읽고, 못 읽으면 저장 없이 돈다
  let storage = null;
  try { storage = win.localStorage || null; } catch { storage = null; }
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
  // 화면 맞춤 방식(layout.md 「화면 맞춤」): 'fill' 꽉 채움(소수 배율, fit.js chooseFit fill — 기본) · 'int' 정수 배율.
  // 주소 ?fit=fill|int가 설정(settings.fit)보다 앞선다. ?fitcap=N은 꽉 채움 뒷면 배율 상한(시험용)
  const query = (() => { try { return new URLSearchParams((win.location && win.location.search) || ''); } catch { return null; } })();
  const fitMode = () => (query && query.get('fit')) || (app && app.settings.fit) || 'fill';
  const fitCap = query && Number(query.get('fitcap')) > 0 ? Number(query.get('fitcap')) : undefined;
  // 글자 입력 칸(CHM-72, src/ui/textfield.js): 캔버스 위에 겹치는 아이디 · 비번 칸. 가짜 DOM에 body가 없으면 값만 드는 가짜가 된다
  const fields = createFields({ doc, win, canvas, rot: () => !!(fit && fit.rot), safeTop: () => { const i = inset(); return i ? i.top : 0; } });
  // 입력 칸에 초점이 있는 동안에는 창이 줄어도(폰 키보드) 화면을 다시 맞추지 않는다 — 키보드 위 좁은 띠에 맞추면 글이 읽히지 않는다.
  // 대신 칸이 키보드에 가리면 틀을 그만큼 올린다. 돌려 그린 화면은 칸을 위쪽에 바로 세운다(textfield.js lift)
  let lifted = 0;
  const liftStage = () => {
    let up = 0;
    const id = fields.focused(), vv = win.visualViewport;
    if (id && stage && vv && !(fit && fit.rot)) {
      const at = fields.rectOf(id);
      if (at) up = keyboardLift(at.top + lifted + at.height, vv.offsetTop + vv.height);
    }
    if (up === lifted) return;
    lifted = up;
    stage.style.top = up ? `${-up}px` : '';
    fields.layout();
  };
  function refit(force = false) {
    if (!force && fit && fields.focused()) { liftStage(); return; }
    const { vw, vh, full } = viewport();
    fit = chooseFit({ vw, vh, full, dpr: win.devicePixelRatio || 1, inset: inset(), coarse: coarse(), fill: fitMode() === 'fill', cap: fitCap });
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
    fields.layout();
  }
  refit();
  // 창 크기가 바뀌면 조금 기다렸다 한 번만 다시 고른다(주소창이 접히는 동안 배율이 오락가락하지 않게). 기기를 돌리면 곧바로 + 늦게 한 번 더
  let timer = null;
  const later = (ms = 120) => { if (timer) win.clearTimeout(timer); timer = win.setTimeout ? win.setTimeout(() => { timer = null; refit(); }, ms) : (refit(), null); };
  win.addEventListener('resize', () => later());
  win.addEventListener('orientationchange', () => { fields.blur(); refit(true); later(350); });
  // 초점이 풀리면 올린 틀을 내리고 그사이 바뀐 창에 다시 맞춘다
  fields.onFocus = (id) => { if (app) app.invalidate(); if (id) { liftStage(); return; } if (lifted) { lifted = 0; if (stage) stage.style.top = ''; } later(60); };
  if (win.visualViewport && win.visualViewport.addEventListener) win.visualViewport.addEventListener('scroll', () => { if (fields.focused()) liftStage(); });
  // 홈 화면 앱으로 돌아오거나 뒤로 가기로 다시 보일 때(주소창 · 창 크기가 그사이 바뀌었을 수 있다)
  win.addEventListener('pageshow', () => later(60));
  if (win.visualViewport && win.visualViewport.addEventListener) win.visualViewport.addEventListener('resize', () => later());

  // 글꼴 · 소리 모듈은 기다리되 끝없이 기다리지 않는다: 망이 멈추면 fonts.load · import가 몇 분씩 안 돌아와 첫 화면이 비었다.
  // 늦게 온 글꼴은 text.js가 글 캐시를 비우고(loadingdone) 여기서 한 번 다시 그린다. 늦게 온 소리는 그때 붙인다
  const within = (p, ms) => new Promise((ok) => {
    const set = win.setTimeout ? win.setTimeout.bind(win) : setTimeout, clear = win.clearTimeout ? win.clearTimeout.bind(win) : clearTimeout;
    const t = set(() => ok(WAITED), ms);
    p.then((v) => { clear(t); ok(v); });
  });
  const fontsP = (async () => {
    try { await Promise.all([doc.fonts.load(fontOf(false), '가A'), doc.fonts.load(fontOf(true), '가A')]); } catch { /* 글꼴이 없어도 돈다 */ }
  })();
  if ((await within(fontsP, BOOT_WAIT.fonts)) === WAITED) fontsP.then(() => { if (app) app.invalidate(); });

  const audioP = import('./audio/audio.js').then((mod) => mod.createAudio(win)).catch(() => null);
  let audio = await within(audioP, BOOT_WAIT.audio);
  if (audio === WAITED) {
    audio = null;
    audioP.then((a) => { if (a && app) { app.audio = a; a.apply(app.settings); } });
  }

  const reduced = media('(prefers-reduced-motion: reduce)');
  const now = () => (win.performance || globalThis.performance).now();
  // 앱(Tauri 2)은 __TAURI_INTERNALS__로 안다(withGlobalTauri가 꺼져 있어도 들어온다).
  const platform = win.__TAURI_INTERNALS__ ? 'app' : 'web';
  // 기록 내보내기(CHM-50 · CHM-54): 손가락 기기는 공유 시트(navigator.share, 파일 하나), 그 밖은 파일로 받기(Blob · <a download>), 둘 다 없으면 클립보드.
  // 공유 시트는 손가락 기기에서만 연다 — 데스크톱 크롬 · 사파리에도 share가 있지만 거기서는 받기가 낫다(CHM-50에서 확인한 길).
  // share(name, data, type, anywhere): 열 수 없으면 null, 열면 Promise<'shared' | 'cancel' | 'fail'>. 누른 그 순간 안에서 불러야 한다(앞에 await를 두지 않는다)
  // data: 글 또는 Blob(하이라이트 그림, CHM-73). anywhere: 손가락 기기가 아니어도 연다(그림은 맥 사파리의 공유 시트도 쓸모가 있다)
  const shareFiles = (name, data, type, anywhere) => {
    const nav = win.navigator;
    if ((!anywhere && !coarse()) || !nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function' || typeof win.File !== 'function') return null;
    try {
      const files = [new win.File([data], name, { type })];
      return nav.canShare({ files }) ? files : null;
    } catch { return null; }
  };
  const share = (name, data, type = 'application/json', anywhere = false) => {
    const files = shareFiles(name, data, type, anywhere);
    if (!files) return null;
    try {
      return Promise.resolve(win.navigator.share({ files })).then(() => 'shared', (e) => (e && e.name === 'AbortError' ? 'cancel' : 'fail'));
    } catch { return Promise.resolve('fail'); }
  };
  // 공유 시트를 열지 않고 열 수 있는지만 본다(「공유」 단추를 낼지)
  share.can = (name, data, type = 'application/json', anywhere = false) => !!shareFiles(name, data, type, anywhere);
  // 가짜 DOM에는 body · URL이 없어 못 받는다. 손가락 기기의 앱(iOS WKWebView)은 <a download>를 눌러도 예외 없이 아무 일도 없다(CHM-53) — 받았다고 하지 않고 클립보드로 넘긴다
  const download = (name, data, type = 'application/json') => {
    if (platform === 'app' && coarse()) return false;
    try {
      const U = win.URL;
      if (!doc.body || !U || !U.createObjectURL || !win.Blob) return false;
      const url = U.createObjectURL(new win.Blob([data], { type }));
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
    storage, host: (win.location && win.location.hostname) || '',
    platform: platform === 'app' ? (coarse() ? 'ios' : 'desktop') : 'web',
    webdriver: !!nav.webdriver, ua: nav.userAgent || '', version: VERSION,
    ...(typeof win.setTimeout === 'function' && typeof win.clearTimeout === 'function' ? { setTimer: (fn, ms) => win.setTimeout(fn, ms), clearTimer: (t) => win.clearTimeout(t) } : {}),
    enabled: () => !app || app.settings.telemetry !== false,
    context: () => (app ? { lang: app.settings.lang, dan: app.records.unlocked ? app.records.unlocked.dan : null, screen_w: win.innerWidth, screen_h: win.innerHeight, scale: app.scale, screen: (app.overlay || app.screen || {}).name || null } : {}),
  });
  const track = (name, props) => tel.track(name, props);
  track.off = () => tel.off();
  // 순위 · 저장의 답이 오면(본문까지 읽으면) 다음 프레임을 그린다 — 그릴 때만 그리는 화면도 받은 것을 곧바로 보인다
  const poke = () => { if (app) app.invalidate(); };
  const seenFetch = (url, init) => win.fetch(url, init).then((res) => {
    poke();
    for (const k of ['json', 'text']) { const f = res && res[k]; if (typeof f === 'function') res[k] = () => f.call(res).finally(poke); }
    return res;
  }, (e) => { poke(); throw e; });
  // 순위(CHM-70, src/ui/rank.js): 배포 주소 · 앱에서만, 자동화 브라우저가 아닐 때만 /api를 부른다(설정 「기록 보내기」와는 상관없다).
  // env.rankBase: 도구(연기 시험 · 스크린샷 · 실제 서버 확인)가 boot()에 주소 머리를 넘길 때만 — 게임은 주지 않는다
  const rank = createRank({
    fetch: typeof win.fetch === 'function' ? seenFetch : null,
    storage, host: (win.location && win.location.hostname) || '', platform, webdriver: !!nav.webdriver,
    today: env.today, lang: () => (app ? app.settings.lang : 'ko'), base: env.rankBase ?? null,
  });
  // 클라우드 저장(CHM-71, src/ui/cloud.js): 순위와 같은 조건에서만 돈다 — 켤 때 당겨 합치고, 판의 마디마다 · 화면이 가려질 때 올린다
  const cloud = createCloud({
    rank,
    ...(typeof win.setTimeout === 'function' && typeof win.clearTimeout === 'function' ? { setTimer: (fn, ms) => win.setTimeout(fn, ms), clearTimer: (t) => win.clearTimeout(t) } : {}),
  });
  // 새 탭으로 열기(개인정보 처리방침). 누른 그 순간 안에서 부른다
  const openPage = (url) => { try { if (typeof win.open === 'function') { win.open(url, '_blank', 'noopener'); return true; } } catch { /* 막혔다 */ } return false; };
  // 바뀐 것이 있을 때만 그린다(layout.md 「그릴 때만 그린다」). 자동화 브라우저(스크린샷 · 영상 도구)는 늘 그린다 — env.alwaysDraw로 바꾼다
  const alwaysDraw = env.alwaysDraw ?? !!(win.navigator && win.navigator.webdriver);
  app = createApp({ canvas, storage, now, reducedMotion: reduced, audio, platform, share, download, copyText, track, rank, cloud, fields, openPage, today: env.today, alwaysDraw });
  win.addEventListener('error', (e) => tel.error((e && e.error) || (e && e.message) || 'error'));
  win.addEventListener('unhandledrejection', (e) => tel.error((e && e.reason) || 'unhandledrejection'));
  // 화면이 숨거나 떠날 때 남은 것을 보낸다
  win.addEventListener('pagehide', () => { tel.flushNow(); cloud.hidden(); });
  // 숨으면 소리를 쉬고(돌던 때만), 다시 보이면 잇고 한 번 그린다
  if (doc.addEventListener) doc.addEventListener('visibilitychange', () => {
    const au = app.audio;
    if (doc.visibilityState === 'hidden') { tel.flushNow(); cloud.hidden(); if (au && au.suspend) au.suspend(); }
    else { if (au && au.resume) au.resume(); app.invalidate(); }
  });
  // GPU가 캔버스를 잃었다 되찾으면 빈 캔버스다
  if (canvas.addEventListener) canvas.addEventListener('contextrestored', () => app.invalidate());
  app.setScale(pendingScale);
  // 설정에서 화면 맞춤을 바꾸면 곧바로 다시 맞춘다
  app.refit = () => refit(true);
  refit();
  tel.open();
  rank.open();
  cloud.open();
  if (audio) audio.apply(app.settings);

  // 누른 자리 → 게임 좌표(보이는 캔버스 사각형 기준 — 확대 · DPR · 가장자리 여백과 상관없다). 돌려 그렸으면 돌린 축으로 되돌린다
  const toGame = (e) => pointToGame(e.clientX, e.clientY, canvas.getBoundingClientRect(), !!(fit && fit.rot));
  canvas.addEventListener('mousemove', (e) => { const [x, y] = toGame(e); app.pointer('move', x, y); });
  // 캔버스를 누르면 입력 칸의 초점을 푼다(mousedown을 막아 두어 저절로 풀리지 않는다)
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); fields.blur(); const [x, y] = toGame(e); app.pointer('down', x, y, e.button); });
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
    if (e.cancelable) e.preventDefault(); // 화면이 끌리는 중(입력 칸에 초점이 가며)에는 막을 수 없다 — 막으려 들면 크롬이 콘솔에 오류를 남긴다
    if (finger != null || e.touches.length > 1) return;
    fields.blur();
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
    // 입력 칸에 초점이 있는 동안 게임은 키를 받지 않는다(빈칸 · Enter · 방향키 · 단축키 모두). Esc는 초점만 푼다
    if (fields.owns(e.target) || fields.focused()) { if (e.key === 'Escape') { if (e.preventDefault) e.preventDefault(); fields.blur(); } return; }
    if (e.repeat) return;
    const k = e.key;
    if ([' ', 'Enter', 'Escape', 'Backspace', '1', '2', '3', '4', '5', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
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
