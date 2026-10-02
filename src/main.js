// 브라우저 진입: 화면 맞춤(폰 세로면 돌려 그리기) · 여백 판 · 입력 · 루프. 화면과 흐름은 src/ui/app.js.
// 연기 시험(tools/smoke.mjs)은 가짜 window/document를 넘겨 boot()를 그대로 부른다 — 가짜에는 body · 여백 판 · 돌리는 틀 · visualViewport가 없다.
import { createApp } from './ui/app.js';
import { chooseFit, stageTransform, toGame as pointToGame } from './ui/fit.js';
import { drawPad, resetPad } from './render/backdrop.js';

export async function boot(env = {}) {
  const win = env.window || globalThis.window;
  const doc = env.document || globalThis.document;
  const canvas = doc.getElementById('screen');
  // 가짜 DOM의 getElementById는 무엇을 물어도 게임 캔버스를 준다 — 다른 것이면 쓰지 않는다
  const own = (id) => { const el = doc.getElementById(id); return el && el !== canvas ? el : null; };
  const pad = own('pad'), stage = own('stage'), safe = own('safe');
  const media = (q) => { try { return !!(win.matchMedia && win.matchMedia(q).matches); } catch { return false; } };
  const coarse = () => media('(pointer: coarse)') || (win.navigator && win.navigator.maxTouchPoints > 0 && !media('(pointer: fine)'));

  // 창 크기: 주소창이 접히고 펴질 때도 보이는 만큼(visualViewport). 손가락으로 확대한 동안(scale ≠ 1)은 창 크기를 쓴다
  const viewport = () => {
    const vv = win.visualViewport;
    if (vv && Math.abs(vv.scale - 1) < 0.01 && vv.width > 0) return [vv.width, vv.height];
    return [win.innerWidth, win.innerHeight];
  };
  // 안전 영역(노치 · 홈 막대): #safe의 padding이 env(safe-area-inset-*)
  const inset = () => {
    if (!safe || !win.getComputedStyle) return null;
    const cs = win.getComputedStyle(safe);
    return { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0, top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
  };

  let app = null, fit = null, pendingScale = 1;
  function refit() {
    const [vw, vh] = viewport();
    fit = chooseFit({ vw, vh, dpr: win.devicePixelRatio || 1, inset: inset(), coarse: coarse() });
    // 화면 글 12px가 몇 배로 보이나(CSS 화소). 작은 창에서 처음 안내가 큰 글자를 권한다
    if (app) app.pixelScale = fit.css;
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
    // 폰 세로: 캔버스 · 여백 판이 든 틀을 시계 방향 90도 돌린다(틀 크기 = 창의 가로 · 세로를 바꾼 것). 가로로 돌아오면 틀을 풀어 둔다
    if (stage) {
      stage.style.width = `${fit.frame.width}px`;
      stage.style.height = `${fit.frame.height}px`;
      stage.style.transform = fit.rot ? stageTransform(vw) : '';
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
  // 기록 내보내기(CHM-50): 파일로 받기(Blob · <a download>) · 클립보드. 가짜 DOM에는 body · URL이 없어 못 받는다.
  // 앱(Tauri 2)은 __TAURI_INTERNALS__로 안다(withGlobalTauri가 꺼져 있어도 들어온다).
  const platform = win.__TAURI_INTERNALS__ ? 'app' : 'web';
  const download = (name, text) => {
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
  app = createApp({ canvas, storage: win.localStorage, now, reducedMotion: reduced, audio, platform, download, copyText });
  app.setScale(pendingScale);
  refit();
  if (audio) audio.apply(app.settings);

  // 누른 자리 → 게임 좌표(보이는 캔버스 사각형 기준 — 확대 · DPR · 가장자리 여백과 상관없다). 돌려 그렸으면 돌린 축으로 되돌린다
  const toGame = (e) => pointToGame(e.clientX, e.clientY, canvas.getBoundingClientRect(), !!(fit && fit.rot));
  canvas.addEventListener('mousemove', (e) => { const [x, y] = toGame(e); app.pointer('move', x, y); });
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); const [x, y] = toGame(e); app.pointer('down', x, y, e.button); });
  win.addEventListener('mouseup', (e) => { const [x, y] = toGame(e); app.pointer('up', x, y, e.button); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  // 손가락: 한 손가락만 받는다(두 손가락은 확대 몸짓이라 무시). 오른쪽 누르기(판 위 표시)는 손가락에는 없다
  let finger = null;
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (finger != null || e.touches.length > 1) return;
    app.touch = true;
    const t = e.changedTouches[0];
    finger = t.identifier;
    const [x, y] = toGame(t); app.pointer('move', x, y); app.pointer('down', x, y);
  }, { passive: false });
  const own1 = (e) => { for (const t of e.changedTouches) if (t.identifier === finger) return t; return null; };
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); const t = own1(e); if (!t) return; const [x, y] = toGame(t); app.pointer('move', x, y); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); const t = own1(e); if (!t) return; finger = null; const [x, y] = toGame(t); app.pointer('up', x, y); }, { passive: false });
  // 끊긴 손가락(전화 · 알림): 아무것도 누르지 않은 것으로
  canvas.addEventListener('touchcancel', () => { if (finger == null) return; finger = null; app.pointer('up', -1, -1); app.pointer('move', -1, -1); });
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
