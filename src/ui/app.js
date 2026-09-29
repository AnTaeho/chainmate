// 앱: 화면 전환 · 판 상태 · 저장 · 입력 · 프레임. DOM을 모른다(main.js가 캔버스와 입력을 넘긴다).
import { logBegin, layerUp, openBox, closeBox } from '../render/layoutlog.js';
import { feltCanvas } from '../render/texture.js';
import { LOOK } from '../render/look.js';
import { flowLayer } from '../render/light.js';
import { factionFor } from '../sim/run.js';
import { FACTION_BY_ID } from '../data/factions.js';
import { createRun, applyRun, migrateRun } from '../sim/run.js';
import { PAL } from '../render/palette.js';
import { W, H, text, box, rect, lift, fine } from '../render/gfx.js';
import { UI, tooltip, bigTooltip, tipHeight, tipTexts } from './ui.js';
import { miniShard } from './parts.js';
import { setLang } from './lang.js';
import { termsIn, keyList, keyHeight, drawKeyBox } from './glossary.js';
import { placeNotes, noteMode, noteWidth, NOTE_GAP } from './placement.js';
import { familyCounts, THRESHOLDS, levelOf } from '../data/families.js';
import { Fx } from './anim.js';
import { makeStore, loadSettings, KEYS } from './save.js';
import { loadRecords, observe, finishRun, finishEndless, noteMove, dailySeed, today } from './records.js';
import { SCREENS } from './screens/index.js';
import { coachDown, updateGuide, drawCoach } from './coach.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export function createApp({ canvas, storage = null, now = () => 0, reducedMotion = false, audio = null, seed = null }) {
  // 화면 캔버스는 읽지 않는다(willReadFrequently 없이 — 큰 배율에서도 GPU로 그린다)
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const store = makeStore(storage);
  const app = {
    canvas, ctx, store, audio,
    ui: new UI(),
    settings: loadSettings(store),
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

  // 움직임 줄이기: 기기 설정(OS) 또는 게임 설정 「움직임 줄이기」(settings.calm)
  Object.defineProperty(app, 'reducedMotion', { get: () => !!reducedMotion || !!app.settings.calm, enumerable: true });
  LOOK.calm = app.reducedMotion;
  // 뒷면 캔버스 배율(main.js fit이 정한다). 캔버스 크기를 바꾸면 그리기 상태가 풀리므로 draw마다 setTransform
  app.scale = 1;
  app.setScale = (n) => {
    n = Math.max(1, Math.floor(n) || 1);
    app.scale = n; LOOK.n = n;
    if (canvas.width !== W * n) canvas.width = W * n;
    if (canvas.height !== H * n) canvas.height = H * n;
  };
  // 흐르는 배경에 섞을 세력 빛깔(판이 없으면 없음)
  let tintKey = null, tintCol = null;
  app.tint = () => {
    const r = app.run;
    if (!r || !r.factions || r.scratch) return null;
    const k = `${r.seed}:${r.ante}`;
    if (k !== tintKey) { tintKey = k; const fa = FACTION_BY_ID[factionFor(r, r.ante)]; tintCol = fa ? fa.hue : null; }
    return tintCol;
  };
  // 여백 판(main.js · src/render/backdrop.js)이 칠할 것: 화면이 제 장면을 그리면 그 장면(surroundScene — 창 전체로 이어 그린다), 아니면 펠트 · 흐름.
  // flash: 화면 전체 번쩍임(전설 · 상자, surroundFlash). dim: 덮개(0.72) · 따라 하는 길(0.45)이 화면을 어둡게 한 만큼
  app.coachDim = 0;
  app.surround = () => {
    const s = app.screen;
    return { time: app.time, tint: app.tint(), scene: s && s.surroundScene ? s.surroundScene() : null, flash: s && s.surroundFlash ? s.surroundFlash() : null, dim: app.overlay ? 0.72 : app.coachDim || 0 };
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
    app.ui.previewId = null; // 손가락으로 한 번 누른 카드는 화면을 옮기면 잊는다(다음 화면의 같은 구역이 곧바로 눌리지 않게)
  };
  app.openOverlay = (name, args = {}) => {
    app.overlay = new SCREENS[name](app, args);
    app.overlay.name = name;
    app.visited.add(name);
  };
  app.closeOverlay = () => { app.overlay = null; };

  // ── 판
  app.hasSave = () => !!store.get(KEYS.run);
  // opts.script: 첫 대국을 킹과 두는 대본 대국으로(CHM-22) — 관 선택을 건너뛰고 곧바로 대국
  app.newRun = (opts = {}) => {
    const daily = opts.daily ? today() : null;
    const seed = daily ? dailySeed(daily) : opts.seed ?? app.nextSeed ?? ((Math.floor(now() * 7919) ^ Date.now()) >>> 0) % 2147483647;
    app.nextSeed = null;
    const script = !!opts.script && !daily;
    app.run = createRun({ seed, opening: daily ? 'standard' : opts.opening, dan: daily ? 0 : opts.dan || 0, script });
    if (script) { app.records.kingDone = true; app.records.kingAgain = false; app.saveRecords(); }
    if (daily) app.run.daily = daily;
    app.fresh = [];
    observe(app.records, app.run, [], app.fresh);
    // 스크린샷 · 영상 도구(window.__autoDraft): 정석 첫째를 곧바로 골라 예전 흐름으로
    if (globalThis.__autoDraft && app.run.phase === 'draft') applyRun(app.run, { type: 'joseki', index: 0 });
    app.save();
    if (app.run.script && app.run.phase === 'select') { const ev = app.cmd({ type: 'play' }); app.go('battle', { events: ev }); return; }
    app.goPhase();
  };
  // 다음 새 판을 킹과 두나: 처음 켠 사람(판 · 수업 기록이 없다) · 설정 「킹과 다시 두기」
  app.wantsScript = () => !!app.records.kingAgain || (!app.records.kingDone && !app.records.runs && !app.records.lessonsDone);
  app.continueRun = () => {
    const run = store.get(KEYS.run);
    if (!run) return false;
    app.run = migrateRun(run); // 세력 전의 저장(명인 차례)은 세력으로 옮긴다
    app.goPhase();
    return true;
  };
  app.save = () => {
    const r = app.run;
    if (!r || r.scratch) return;   // 수업용 판은 남기지 않는다
    if (r.phase === 'lost' || r.phase === 'won') store.del(KEYS.run);
    else store.set(KEYS.run, r);
  };
  app.saveSettings = () => store.set(KEYS.settings, app.settings);
  // 명령 하나(봇과 같은 명령). 이벤트를 돌려준다.
  app.cmd = (cmd) => {
    const ev = applyRun(app.run, cmd);
    app.save();
    if (app.run.scratch) { if (app.onCommand) app.onCommand(cmd, ev); return ev; }
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
    if (ph === 'draft') return app.go('draft');
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
  // 따라 하는 길도 닫는다(수업 ⑩의 길은 화면이 아니라 판에 걸려 있어 화면을 떠나도 남는다)
  app.toTitle = () => { app.overlay = null; app.guide = null; app.run = null; app.fx.clear(); app.go('title'); };

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
        miniShard(c, x - 2, y - 2);
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
      // 오른쪽 누르기: 판 위 표시(칸 · 화살표)만. 멈춤 · 내려놓기는 Esc 키로만(판이 없는 화면에서는 아무 일도 없다)
      if (button === 2) { app.ui.move(x, y); const s = app.overlay || app.screen; if (s && s.rightDown) s.rightDown(x, y); return; }
      // 처음 안내: 떠 있는 안내는 사라지고, 따라 하는 길이면 가리키는 곳만 눌린다
      app.ui.touch = !!app.touch; // 손가락이면 끌기 거리가 넓다(ui.move)
      if (!coachDown(app, x, y)) { app.ui.move(x, y); return; }
      app.ui.down(x, y);
      const s = app.overlay || app.screen;
      if (s && s.pointerDown) s.pointerDown(x, y);
    } else if (type === 'up') {
      if (button === 2) { app.ui.move(x, y); const s = app.overlay || app.screen; if (s && s.rightUp) s.rightUp(x, y); return; }
      app.ui.touch = !!app.touch;
      app.ui.up(x, y);
    }
    app.lastInputMs = now() - t0;
    app.stats.maxInputMs = Math.max(app.stats.maxInputMs || 0, app.lastInputMs);
    if (!app.stats.inputMs) app.stats.inputMs = [];
    if (type !== 'move' && app.stats.inputMs.length < 20000) app.stats.inputMs.push(app.lastInputMs);
  };
  app.key = (k) => {
    if (app.audio) app.audio.unlock();
    // 따라 하는 길(대본 대국 · 수업 ⑩) 중에도 Esc는 늘 멈춤을 연다 — 화면의 Esc(고른 손 내려놓기 · 꾸러미 넘기기)는 길을 어긋나게 하니 거치지 않는다.
    // 멈춤을 닫으면 길은 그 걸음에서 이어진다. 다른 키는 길 중에 받지 않는다(덮개 — 멈춤 · 설정 · 행마 보기 — 는 받는다)
    if (app.guide && !app.overlay) { if (k === 'Escape') app.openOverlay('pause'); return; }
    const s = app.overlay || app.screen;
    if (s && s.key) s.key(k);
  };

  // ── 프레임
  app.update = (dt) => {
    dt = Math.min(dt, 0.1);
    app.time += dt;
    LOOK.calm = app.reducedMotion;
    if (app.clockFx) { app.clockFx.t += dt; if (app.clockFx.t > 2.4) app.clockFx = null; } // 시계 칸을 잃는 깜빡임(common.js clockPips)
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
    updateGuide(app, dt);
    if (app.audio) app.audio.update(dt, app);
  };

  app.draw = () => {
    const ui = app.ui;
    ui.begin();
    logBegin();
    ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (app.shakeAmt > 0) {
      const a = Math.round(app.shakeAmt * Math.min(1, app.shakeT * 6));
      ctx.translate(Math.round((Math.random() * 2 - 1) * a), Math.round((Math.random() * 2 - 1) * a));
    }
    ctx.drawImage(feltCanvas(W + 16, H + 16), -8, -8);
    flowLayer(ctx, app.time, app.tint(), -8, -8, W + 16, H + 16);
    if (app.screen) app.screen.draw(ctx, ui);
    // 연출(떠오르는 수 · 날아가는 조각)은 칸을 넘나든다 — 글 넘침은 재지 않는다
    openBox('fx', 0, 0, W, H, 0, { loose: true, name: '연출' });
    // 연출은 움직이는 것이라 소수점 자리에(떠오르는 수 · 튀는 불티 · 날아가는 조각 — 3배 화면에서 계단 없이)
    fine(() => app.fx.draw(ctx, 1));
    closeBox();
    ctx.restore();
    if (app.overlay) {
      // 밑 화면의 구역은 막는다
      ui.regions = [];
      layerUp();
      ctx.globalAlpha = 0.72;
      rect(ctx, 0, 0, W, H, PAL.shadow);
      ctx.globalAlpha = 1;
      app.overlay.draw(ctx, ui);
    }
    // 알림(화면 위에 잠깐 뜬다)
    openBox('fx', 0, 0, W, H, 0, { loose: true, name: '알림' });
    app.toasts.forEach((t, i) => {
      const a = Math.min(1, t.t * 8, (t.life - t.t) * 4);
      ctx.globalAlpha = Math.max(0, a);
      const w = Math.min(300, 16 + t.msg.length * 12);
      const x = Math.floor((W - w) / 2), y = 6 + i * 20;
      box(ctx, x, y, w, 17, PAL.feltDk, t.col);
      text(ctx, t.msg, W / 2, y + 2, t.col, { align: 'center', bold: true });
      ctx.globalAlpha = 1;
    });
    closeBox();
    if (!app.overlay) drawCoach(ctx, app);
    else { app.hintNow = null; app.hintShown = null; app.coachDim = 0; }
    ui.end();
    // 말풍선 + 낱말 상자: 한 묶음(말풍선 → 상자, 같은 폭)을 화면의 설명 자리 규칙대로(placement.js)
    app.keyBoxes = [];
    app.tipRect = null;
    app.noteStack = null;
    const h = ui.hover;
    if (ui.drag || (app.guide && !app.overlay)) return; // 따라 하는 길 중에는 말풍선을 띄우지 않는다(덮개 — 행마 보기 — 는 띄운다)
    const mx = ui.mouse.x, my = ui.mouse.y;
    const span = ui.termSpans.find((q) => mx >= q.x && my >= q.y && mx < q.x + q.w && my < q.y + q.h);
    const hot = span ? span.id : null;
    const tip = h && h.tip ? (typeof h.tip === 'function' ? h.tip() : h.tip) : null;
    const keys = h && h.keys ? (typeof h.keys === 'function' ? h.keys() : h.keys) : null;
    // 큰 글자 설정: 말풍선 하나를 화면 아래 가운데에(상자 없음)
    if (app.settings.big) { if (tip) app.tipRect = bigTooltip(ctx, tip); return; }
    let ids = [], anchor = null;
    if (tip || keys) {
      // 카드 글(keys) 다음에 말풍선 글. 가리킨 것이 곧 그 낱말이면(시너지 칩: noKeys) 말풍선 하나만
      if (!h.noKeys) ids = keyList(termsIn([...(keys || []), ...(tip ? tipTexts(tip) : [])]).filter((id) => !(tip && tip.term === id)), hot);
      anchor = h.anchor || { x: h.x, y: h.y, w: h.w, h: h.h };
    } else if (span) {
      // 카드 밖의 글(수업 할 일 줄 등): 가리킨 낱말 하나만
      ids = [span.id];
      anchor = { x: span.x, y: span.y, w: span.w, h: span.h };
    }
    if (!tip && !ids.length) return;
    const mode = noteMode(app.overlay || app.screen);
    const w = noteWidth(mode);
    const hs = [...(tip ? [tipHeight(tip, w)] : []), ...ids.map((id) => keyHeight(id, w))];
    // 덮으면 안 되는 것: 누를 수 있는 다른 구역(가리킨 것 · 그 안의 것은 빼고)
    const inAnchor = (r) => r.x >= anchor.x && r.y >= anchor.y && r.x + r.w <= anchor.x + anchor.w && r.y + r.h <= anchor.y + anchor.h;
    const avoid = ui.regions.filter((r) => r !== h && r.onClick && r.enabled && !inAnchor(r));
    const lay = placeNotes(mode, anchor, hs, { W, H, avoid });
    if (!lay) return;
    let y = lay.y, k = 0;
    const rects = [];
    // 묶음 받침: 상자 사이 틈까지 한 번에 깔아 뒤 판넬이 새지 않고 한 묶음으로 읽히게
    lift(ctx, lay.x, lay.y, lay.w, hs.slice(0, lay.n).reduce((u, v) => u + v, 0) + NOTE_GAP * Math.max(0, lay.n - 1));
    if (tip) { app.tipRect = tooltip(ctx, lay.x, y, tip, lay.w); rects.push(app.tipRect); y += app.tipRect.h + NOTE_GAP; k++; }
    // 시너지 상자: 지금 모은 수(「5/6」)를 낱말 옆에
    const counts = app.run && ids.some((id) => id.startsWith('fam_')) ? familyCounts(app.run) : null;
    const famNote = (id) => { if (!counts || !id.startsWith('fam_')) return null; const n = counts[id.slice(4)] || 0, next = THRESHOLDS[levelOf(n)]; return next ? `${n}/${next}` : `${n}`; };
    for (const id of ids) {
      if (k >= lay.n) break;
      const r = drawKeyBox(ctx, id, lay.x, y, lay.w, id === hot, famNote(id));
      app.keyBoxes.push(r); rects.push(r);
      y += r.h + NOTE_GAP; k++;
    }
    app.noteStack = { mode, anchor, id: h ? h.id : null, rects, side: lay.side, squeezed: !!lay.squeezed, dropped: hs.length - lay.n };
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
  // 처음 켠 사람도 타이틀에서 시작한다: 「새 판」이 곧바로 킹과 두는 대본 대국(수업 열은 타이틀 「수업」에서)
  app.go('title');
  return app;
}
