// 브라우저 진입: 캔버스 확대 · 입력 · 루프. 화면과 흐름은 src/ui/app.js.
// 연기 시험(tools/smoke.mjs)은 가짜 window/document를 넘겨 boot()를 그대로 부른다.
import { createApp } from './ui/app.js';

export async function boot(env = {}) {
  const win = env.window || globalThis.window;
  const doc = env.document || globalThis.document;
  const canvas = doc.getElementById('screen');
  const W = 480, H = 270;

  // 창에 맞춰 정수배 확대(작으면 비정수) + 레터박스. 장치 화소 기준으로 정수배를 잡는다.
  let app = null;
  function fit() {
    const dpr = win.devicePixelRatio || 1;
    const aw = win.innerWidth * dpr, ah = win.innerHeight * dpr;
    let s = Math.floor(Math.min(aw / W, ah / H));
    if (s < 1) s = Math.min(aw / W, ah / H);
    // 화면 글 12px가 몇 배로 보이나(CSS 화소). 작은 창에서 처음 안내가 큰 글자를 권한다
    if (app) app.pixelScale = s / dpr;
    canvas.style.width = `${(W * s) / dpr}px`;
    canvas.style.height = `${(H * s) / dpr}px`;
    // 뒷면 캔버스 배율 N(빛과 움직임): 장치 화소 배율 s를 나누는 1~4 중 가장 큰 것(없으면 min(s, 4)).
    // 480×270 좌표는 그대로이고, 움직이는 것만 1/N 칸에 선다. 남는 배율은 CSS가 네모 도트로 늘린다(image-rendering: pixelated)
    let n = 1;
    if (Number.isInteger(s) && s > 1) { n = Math.min(s, 4); for (let d = 4; d >= 2; d--) if (d <= s && s % d === 0) { n = d; break; } }
    if (app) app.setScale(n); else pendingScale = n;
  }
  let pendingScale = 1;
  fit();
  win.addEventListener('resize', fit);

  try {
    await Promise.all([doc.fonts.load('400 12px Galmuri11'), doc.fonts.load('700 12px Galmuri11')]);
  } catch { /* 글꼴이 없어도 돈다 */ }

  let audio = null;
  try {
    const mod = await import('./audio/audio.js');
    audio = mod.createAudio(win);
  } catch { audio = null; }

  const reduced = !!(win.matchMedia && win.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const now = () => (win.performance || globalThis.performance).now();
  app = createApp({ canvas, storage: win.localStorage, now, reducedMotion: reduced, audio });
  app.setScale(pendingScale);
  fit();
  if (audio) audio.apply(app.settings);

  // 마우스 → 게임 좌표(레터박스 · 확대 · DPR 포함: 보이는 캔버스 사각형 기준)
  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) * W) / r.width), Math.floor(((e.clientY - r.top) * H) / r.height)];
  };
  canvas.addEventListener('mousemove', (e) => { const [x, y] = toGame(e); app.pointer('move', x, y); });
  canvas.addEventListener('mousedown', (e) => { e.preventDefault(); const [x, y] = toGame(e); app.pointer('down', x, y, e.button); });
  win.addEventListener('mouseup', (e) => { const [x, y] = toGame(e); app.pointer('up', x, y, e.button); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); app.touch = true; const t = e.changedTouches[0]; const [x, y] = toGame(t); app.pointer('move', x, y); app.pointer('down', x, y); }, { passive: false });
  canvas.addEventListener('touchend', (e) => { e.preventDefault(); const t = e.changedTouches[0]; const [x, y] = toGame(t); app.pointer('up', x, y); }, { passive: false });
  win.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const k = e.key;
    if ([' ', 'Enter', 'Escape', '1', '2', '3', '4', '5', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(k)) e.preventDefault();
    app.key(k);
  });

  const loop = (t) => { app.frame(t); win.requestAnimationFrame(loop); };
  win.requestAnimationFrame(loop);
  win.__app = app;
  return app;
}

if (typeof document !== 'undefined' && !globalThis.__CHAINMATE_NO_BOOT__) boot();
