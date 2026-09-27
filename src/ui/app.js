// 앱: 화면 전환 · 판 상태 · 저장 · 입력 · 프레임. DOM을 모른다(main.js가 캔버스와 입력을 넘긴다).
import { createRun, applyRun } from '../sim/run.js';
import { PAL } from '../render/palette.js';
import { context } from '../render/surface.js';
import { W, H, text, box, rect } from '../render/gfx.js';
import { UI, tooltip } from './ui.js';
import { miniShard } from './parts.js';
import { setLang } from './lang.js';
import { Fx } from './anim.js';
import { makeStore, loadSettings, KEYS } from './save.js';
import { loadRecords, observe, finishRun, finishEndless, noteMove, dailySeed, today } from './records.js';
import { SCREENS } from './screens/index.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export function createApp({ canvas, storage = null, now = () => 0, reducedMotion = false, audio = null, seed = null }) {
  const ctx = context(canvas);
  const store = makeStore(storage);
  const app = {
    canvas, ctx, store, audio,
    ui: new UI(),
    settings: loadSettings(store),
    reducedMotion,
    run: null,
    screen: null,
    overlay: null,
    fx: new Fx(),
    toasts: [],
    time: 0,
    last: null,
    visited: new Set(),
    stats: { frames: 0, drawMs: [], maxDrawMs: 0, errors: 0 },
    shakeAmt: 0, shakeT: 0,
    flowQueue: [],
    nextSeed: seed,
  };

  app.speed = () => app.settings.speed || 1;
  app.records = loadRecords(store);
  setLang(app.settings.lang);
  app.fresh = [];   // 이번 판에 새로 채운 도감 칸
  app.saveRecords = () => store.set(KEYS.records, app.records);
  app.noteMove = (score, steps) => {
    if (!app.run) return false;
    const best = noteMove(app.records, score, steps, app.run.ante);
    if (best) app.saveRecords();
    return best;
  };
  // 판이 끝나면 한 번: 기록 · 해금. 결과 화면이 부른다.
  app.finishRun = () => {
    const run = app.run;
    if (run && run.endless && run.phase === 'lost' && !run.endlessRecorded) {
      run.endlessRecorded = true;
      const deeper = finishEndless(app.records, run);
      app.saveRecords();
      return { ...(run.recordedOut || { unlocked: [], dan: null }), fresh: app.fresh.length, endless: run.ante, deeper };
    }
    if (!run || run.recorded) return run && run.recordedOut;
    const out = finishRun(app.records, run, { daily: run.daily || null });
    out.fresh = app.fresh.length;
    run.recorded = true;
    run.recordedOut = out;
    app.saveRecords();
    return out;
  };

  app.go = (name, args = {}) => {
    const S = SCREENS[name];
    if (!S) throw new Error(`no screen ${name}`);
    if (app.screen && app.screen.onLeave) app.screen.onLeave();
    app.screen = new S(app, args);
    app.screen.name = name;
    app.visited.add(name);
    app.ui.press = null;
    app.ui.drag = null;
  };
  app.openOverlay = (name, args = {}) => {
    app.overlay = new SCREENS[name](app, args);
    app.overlay.name = name;
    app.visited.add(name);
  };
  app.closeOverlay = () => { app.overlay = null; };

  // ── 판
  app.hasSave = () => !!store.get(KEYS.run);
  app.newRun = (opts = {}) => {
    const daily = opts.daily ? today() : null;
    const seed = daily ? dailySeed(daily) : opts.seed ?? app.nextSeed ?? ((Math.floor(now() * 7919) ^ Date.now()) >>> 0) % 2147483647;
    app.nextSeed = null;
    app.run = createRun({ seed, opening: daily ? 'standard' : opts.opening, dan: daily ? 0 : opts.dan || 0 });
    if (daily) app.run.daily = daily;
    app.fresh = [];
    observe(app.records, app.run, [], app.fresh);
    app.save();
    app.goPhase();
  };
  app.continueRun = () => {
    const run = store.get(KEYS.run);
    if (!run) return false;
    app.run = run;
    app.goPhase();
    return true;
  };
  app.save = () => {
    const r = app.run;
    if (!r) return;
    if (r.phase === 'lost' || r.phase === 'won') store.del(KEYS.run);
    else store.set(KEYS.run, r);
  };
  app.saveSettings = () => store.set(KEYS.settings, app.settings);
  // 명령 하나(봇과 같은 명령). 이벤트를 돌려준다.
  app.cmd = (cmd) => {
    const ev = applyRun(app.run, cmd);
    app.save();
    const before = app.fresh.length;
    observe(app.records, app.run, ev, app.fresh);
    if (app.fresh.length !== before || ev.some((e) => e.type === 'win' || e.type === 'grade' || e.type === 'legend')) app.saveRecords();
    if (app.onCommand) app.onCommand(cmd, ev);
    return ev;
  };
  // 판의 국면에 맞는 화면으로
  app.goPhase = () => {
    const ph = app.run ? app.run.phase : null;
    if (!ph) return app.go('title');
    if (ph === 'select') return app.go('select');
    if (ph === 'battle') return app.go('battle');
    if (ph === 'shop') return app.go('shop');
    if (ph === 'pack') return app.go('pack');
    if (ph === 'won' || ph === 'lost') return app.go('result');
    return app.go('title');
  };
  // 대국이 끝난 뒤의 막간: [화면, 인자] 차례. 다 보면 국면 화면으로.
  app.flow = (list) => { app.flowQueue = list.slice(); app.next(); };
  app.next = () => {
    const n = app.flowQueue.shift();
    if (n) app.go(n[0], n[1] || {});
    else app.goPhase();
  };
  app.toTitle = () => { app.overlay = null; app.run = null; app.fx.clear(); app.go('title'); };

  // ── 효과
  app.shake = (px, dur = 0.25) => {
    if (!app.settings.shake || app.reducedMotion) return;
    app.shakeAmt = Math.max(app.shakeAmt, px);
    app.shakeT = Math.max(app.shakeT, dur);
  };
  app.hitstop = (sec) => { if (!app.reducedMotion) app.hitstopT = Math.max(app.hitstopT || 0, sec / app.speed()); };
  // 명국 조각이 (x0, y0)에서 조각 띠(x1, y1)로 날아간다
  app.flyShard = (x0, y0, x1, y1) => {
    app.fx.add({
      life: 0.9, layer: 1,
      draw: (c, e) => {
        const k = Math.min(1, e.t / 0.75);
        const q = k * k * (3 - 2 * k);
        const x = x0 + (x1 - x0) * q, y = y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * 40;
        for (let i = 1; i <= 4; i++) { const qq = Math.max(0, q - i * 0.04); c.globalAlpha = 0.5 - i * 0.1; rect(c, x0 + (x1 - x0) * qq, y0 + (y1 - y0) * qq - Math.sin(qq * Math.PI) * 40 + 2, 2, 2, PAL.goldHi); }
        c.globalAlpha = k >= 1 ? Math.max(0, 1 - (e.t - 0.75) / 0.15) : 1;
        miniShard(c, Math.round(x) - 2, Math.round(y) - 2);
        if (k >= 1) { const r = (e.t - 0.75) * 60; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rect(c, x1 + Math.cos(a) * r, y1 + Math.sin(a) * r, 1, 1, PAL.goldHi); } }
        c.globalAlpha = 1;
      },
    });
  };
  app.toast = (msg, col = PAL.ink, dur = 2.2) => {
    app.toasts.push({ msg, col, t: 0, life: dur });
    if (app.toasts.length > 3) app.toasts.shift();
  };
  app.sfx = (name, arg) => { if (app.audio) app.audio.play(name, arg); };

  // ── 입력(게임 좌표)
  app.pointer = (type, x, y, button = 0) => {
    if (app.audio) app.audio.unlock();
    const t0 = now();
    if (type === 'move') app.ui.move(x, y);
    else if (type === 'down') {
      if (button === 2) { app.key('Escape'); return; }
      app.ui.down(x, y);
      const s = app.overlay || app.screen;
      if (s && s.pointerDown) s.pointerDown(x, y);
    } else if (type === 'up') {
      if (button === 2) return;
      app.ui.up(x, y);
    }
    app.lastInputMs = now() - t0;
    app.stats.maxInputMs = Math.max(app.stats.maxInputMs || 0, app.lastInputMs);
    if (!app.stats.inputMs) app.stats.inputMs = [];
    if (type !== 'move' && app.stats.inputMs.length < 20000) app.stats.inputMs.push(app.lastInputMs);
  };
  app.key = (k) => {
    if (app.audio) app.audio.unlock();
    const s = app.overlay || app.screen;
    if (s && s.key) s.key(k);
  };

  // ── 프레임
  app.update = (dt) => {
    dt = Math.min(dt, 0.1);
    app.time += dt;
    app.ui.time = app.time;
    const sp = app.speed();
    for (const t of app.toasts) t.t += dt;
    app.toasts = app.toasts.filter((t) => t.t < t.life);
    // 멈칫(히트스톱): 짧게 모든 연출이 선다
    if (app.hitstopT > 0) { app.hitstopT -= dt; if (app.audio) app.audio.update(dt, app); return; }
    app.fx.update(dt * sp);
    if (app.shakeT > 0) { app.shakeT -= dt; if (app.shakeT <= 0) app.shakeAmt = 0; }
    if (app.overlay && app.overlay.update) app.overlay.update(dt);
    else if (app.screen && app.screen.update) app.screen.update(dt);
    if (app.audio) app.audio.update(dt, app);
  };

  app.draw = () => {
    const ui = app.ui;
    ui.begin();
    ctx.save();
    if (app.shakeAmt > 0) {
      const a = Math.round(app.shakeAmt * Math.min(1, app.shakeT * 6));
      ctx.translate(Math.round((Math.random() * 2 - 1) * a), Math.round((Math.random() * 2 - 1) * a));
    }
    rect(ctx, -8, -8, W + 16, H + 16, PAL.felt);
    if (app.screen) app.screen.draw(ctx, ui);
    app.fx.draw(ctx, 1);
    ctx.restore();
    if (app.overlay) {
      // 밑 화면의 구역은 막는다
      ui.regions = [];
      ctx.globalAlpha = 0.72;
      rect(ctx, 0, 0, W, H, PAL.shadow);
      ctx.globalAlpha = 1;
      app.overlay.draw(ctx, ui);
    }
    // 알림
    app.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 8, (t.life - t.t) * 4);
      ctx.globalAlpha = Math.max(0, a);
      const w = Math.min(300, 16 + t.msg.length * 12);
      const x = Math.floor((W - w) / 2), y = 6 + i * 20;
      box(ctx, x, y, w, 17, PAL.feltDk, t.col);
      text(ctx, t.msg, W / 2, y + 2, t.col, { align: 'center', bold: true });
      ctx.globalAlpha = 1;
    });
    ui.end();
    // 말풍선
    const h = ui.hover;
    if (h && h.tip && !ui.drag) {
      const tip = typeof h.tip === 'function' ? h.tip() : h.tip;
      // tipAt: 말풍선을 둘 빈자리(옆 카드를 가리지 않게). 없으면 구역 오른쪽(넘치면 왼쪽)
      const at = h.tipAt || { x: h.x + h.w + 4 > W - (tip.w || 150) ? h.x - (tip.w || 150) - 4 : h.x + h.w + 4, y: h.y };
      if (tip) tooltip(ctx, at.x, at.y, tip.lines, { title: tip.title, w: tip.w || 150, scale: app.settings.big ? 2 : 1 });
    }
  };

  app.frame = (t) => {
    const dt = app.last == null ? 1 / 60 : (t - app.last) / 1000;
    app.last = t;
    const t0 = now();
    try {
      app.update(dt);
      app.draw();
    } catch (e) {
      app.stats.errors++;
      if (app.onError) app.onError(e);
      else throw e;
    }
    const ms = now() - t0;
    app.stats.frames++;
    app.stats.maxDrawMs = Math.max(app.stats.maxDrawMs, ms);
    if (app.stats.drawMs.length < 20000) app.stats.drawMs.push(ms);
  };

  app.clone = clone;
  app.go('title');
  return app;
}
