// 앱: 화면 전환 · 판 상태 · 저장 · 입력 · 프레임. DOM을 모른다(main.js가 캔버스와 입력을 넘긴다).
import { logBegin, layerUp, openBox, closeBox } from '../render/layoutlog.js';
import { feltCanvas } from '../render/texture.js';
import { LOOK } from '../render/look.js';
import { flowLayer } from '../render/light.js';
import { factionFor } from '../sim/run.js';
import { FACTION_BY_ID } from '../data/factions.js';
import { createRun, applyRun, migrateRun } from '../sim/run.js';
import { createDailyRun } from '../sim/daily.js';
import { PAL } from '../render/palette.js';
import { W, H, text, box, rect, lift, fine, measure } from '../render/gfx.js';
import { wrap } from '../render/text.js';
import { LINE, BTN_S, LIST_GAP, inkY } from './frame.js';
import { UI, tooltip, bigTooltip, tipHeight, tipTexts, fingerDots } from './ui.js';
import { miniShard } from './parts.js';
import { setLang } from './lang.js';
import { termsIn, keyList, keyHeight, drawKeyBox } from './glossary.js';
import { placeNotes, noteMode, noteWidth, NOTE_GAP } from './placement.js';
import { familyCounts, THRESHOLDS, levelOf } from '../data/families.js';
import { Fx } from './anim.js';
import { makeStore, loadSettings, KEYS } from './save.js';
import { loadRecords, observe, finishRun, finishEndless, noteMove, dailySeed, today } from './records.js';
import { newTrack, trackBefore, trackCommand, runRow } from '../sim/runlog.js';
import { keepRow, exportText } from './runlog.js';
import { telBefore, commandEvents, runStartProps, runEndProps } from './telemetry.js';
import { createRank } from './rank.js';
import { VERSION, COMMIT } from '../version.js';
import { SCREENS } from './screens/index.js';
import { coachDown, updateGuide, drawCoach, coachPlan } from './coach.js';
import { foldSide } from './fold.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// track(name, props): 기록 보내기(CHM-63, src/ui/telemetry.js) — main.js가 넘긴다. 없으면 아무것도 보내지 않는다(Node 시험 · 도구)
// rank: 순위(CHM-70, src/ui/rank.js createRank) — main.js가 넘긴다. 없으면 닿지 못하는 순위(한 번도 부르지 않는다)
// platform: 'web' | 'app'(Tauri). share(name, text) · download(name, text) · copyText(text): 기록 내보내기(main.js가 DOM으로 넘긴다, 없으면 못 내보낸다)
export function createApp({ canvas, storage = null, now = () => 0, reducedMotion = false, audio = null, seed = null, platform = 'web', share = null, download = null, copyText = null, track = null, rank = null, today: dayNow = today }) {
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
  // 사람 판 기록(CHM-50): 판마다 run.track에 세고, 판이 끝나면 한 줄을 KEYS.runs에 남긴다. 수업 · 대본 대국 · scratch 판은 남기지 않는다
  app.appInfo = { version: VERSION, commit: COMMIT, platform };
  // 기록 보내기(CHM-63): scratch 판 위에서는 always(수업 진행 · 설정)만 나간다. 판 사건은 app.cmd가 표(commandEvents)로 옮긴다
  const onceSeen = new Set();
  app.track = (name, props = {}, { always = false } = {}) => {
    if (!track || (!always && app.run && app.run.scratch)) return;
    try { track(name, props); } catch { /* 게임은 모른다 */ }
  };
  // 판마다 첫 번만(판 보기 큰 판)
  app.trackOnce = (name, props = {}) => {
    const k = `${app.run ? app.run.seed : ''}:${name}`;
    if (onceSeen.has(k)) return;
    onceSeen.add(k);
    app.track(name, props);
  };
  // 설정 「기록 보내기」: 끄는 순간 마지막으로 한 번 알리고 곧바로 보낸다
  app.setTelemetry = (on) => {
    if (!on && track && track.off) { try { track.off(); } catch { /* 그대로 */ } }
    app.settings.telemetry = !!on;
    app.saveSettings();
    if (on) app.track('setting_change', { key: 'telemetry', value: true }, { always: true });
  };
  // 순위(CHM-70): 오늘의 대국 판이 끝나면 넣은 명령 줄을 낸다(서버가 다시 두어 성적을 셈한다). 옛 저장(cmds 없음) · 끝없는 대국의 끝은 내지 않는다
  app.rank = rank || createRank();
  app.submitDaily = (run) => {
    if (!run || run.scratch || run.endless || !run.daily || !Array.isArray(run.cmds)) return null;
    return app.rank.submit(run.daily, clone(run.cmds));
  };
  app.keepRun = (run, end) => {
    if (!run || run.scratch || !run.track) return -1;
    const row = runRow(run, run.track, { end, endedAt: new Date().toISOString() });
    run.track.kept = row.id;
    // 같은 끝은 한 번만 보낸다(복기가 끝난 판의 줄을 갈아 끼울 때 또 부른다)
    if (run.track.told !== row.end) { run.track.told = row.end; app.track('run_end', runEndProps(row), { always: true }); }
    return keepRow(store, row);
  };
  // 설정 「기록 내보내기」: 손가락 기기는 공유 시트, 그 밖은 파일로 받고, 둘 다 없거나 안 되면 글을 클립보드로
  // 누른 그 순간 안에서 부른다(공유 시트 · 클립보드는 누름이 있어야 열린다 — share는 맨 먼저, 앞에 await 없이).
  // 돌려주는 값: 'none' | 'file' | 'copy' | 'fail', 공유 시트 · 복사는 Promise('share' | 'cancel' | 'copy' | 'fail'). 공유를 그만두면 알림 없이 'cancel'
  app.exportRuns = () => {
    const { n, name, text: body } = exportText(store, { app: app.appInfo });
    if (!n) { app.toast('아직 끝낸 판이 없다', PAL.ink); return 'none'; }
    const failed = () => { app.toast('내보내지 못했다', PAL.red); return 'fail'; };
    const copy = () => {
      if (!copyText) return failed();
      return copyText(body).then((ok) => { if (!ok) return failed(); app.toast(`판 ${n}개를 복사했다`, PAL.gold); return 'copy'; });
    };
    const sent = share ? share(name, body) : null;
    if (sent) {
      return sent.then((r) => {
        if (r === 'shared') { app.toast(`판 ${n}개를 내보냈다`, PAL.gold); return 'share'; }
        if (r === 'cancel') return 'cancel';
        return copy();
      });
    }
    if (download && download(name, body)) { app.toast(`판 ${n}개를 내보냈다`, PAL.gold); return 'file'; }
    return copy();
  };
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
  // 오늘 날짜(YYYY-MM-DD): 오늘의 대국 시드 · 기록 화면의 오늘 줄이 이것을 쓴다. 게임은 진짜 달력, 연기 시험은 고정 날짜를 넣는다
  app.today = () => dayNow();

  // ── 판
  app.hasSave = () => !!store.get(KEYS.run);
  // opts.script: 첫 대국을 킹과 두는 대본 대국으로(CHM-22) — 관 선택을 건너뛰고 곧바로 대국
  app.newRun = (opts = {}) => {
    const daily = opts.daily ? app.today() : null;
    const seed = daily ? dailySeed(daily) : opts.seed ?? app.nextSeed ?? ((Math.floor(now() * 7919) ^ Date.now()) >>> 0) % 2147483647;
    app.nextSeed = null;
    // 끝나지 않은 판을 새 판으로 덮어쓴다: 「그만둠」으로 남긴다(이긴 뒤 끝없는 대국이면 그 판 줄을 갈아 끼운다)
    const old = app.run && !app.run.scratch ? app.run : store.get(KEYS.run);
    if (old && old.track && !old.scratch && old.phase !== 'won' && old.phase !== 'lost') app.keepRun(old, old.endless ? 'endless' : 'quit');
    const script = !!opts.script && !daily;
    // 오늘의 대국 판은 서버와 같은 함수로 만든다(src/sim/daily.js — 넣은 명령을 run.cmds에 남겨 순위에 낸다, CHM-70)
    app.run = daily ? createDailyRun(daily) : createRun({ seed, opening: opts.opening, dan: opts.dan || 0, script });
    if (script) { app.records.kingDone = true; app.records.kingAgain = false; app.saveRecords(); }
    app.run.track = newTrack({ startedAt: Date.now(), app: app.appInfo });
    app.fresh = [];
    app.tutStep = -1;
    app.track('run_start', runStartProps(app.run, { script }));
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
    const run = app.run;
    // 사람 판 기록: 옛 저장에서 이어 둔 판은 여기서 세기 시작한다
    if (!run.scratch && !run.track) run.track = newTrack({ startedAt: null, app: app.appInfo });
    const prev = run.scratch ? null : trackBefore(run);
    const tb = track && !run.scratch ? telBefore(run) : null;
    const ev = applyRun(run, cmd);
    if (tb) for (const [name, props] of commandEvents(run, cmd, ev, tb)) app.track(name, props);
    if (prev) {
      trackCommand(run.track, run, cmd, ev, prev);
      if ((run.phase === 'won' || run.phase === 'lost') && prev.phase !== run.phase) {
        app.keepRun(run, run.phase === 'won' ? 'won' : run.endless ? 'endless' : 'lost');
        // 끝난 판의 저장은 바로 아래 save()가 지운다 — 명령 줄은 여기서 챙겨 낸다
        app.submitDaily(run);
      }
    }
    app.save();
    if (run.scratch) { if (app.onCommand) app.onCommand(cmd, ev); return ev; }
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
    // 판 시간(사람 판 기록): 판이 살아 있는 동안 흐른 실제 초(화면이 숨으면 프레임이 멈춰 세지 않는다)
    { const r = app.run; if (r && r.track && !r.scratch && r.phase !== 'won' && r.phase !== 'lost') r.track.sec += dt; }
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
    // 첫 판 대본 대국의 걸음(기록 보내기): 새로 닿은 걸음마다 한 번
    { const g = app.guide, r = app.run; if (g && r && !r.scratch && r.battle && r.battle.script && g.i > (app.tutStep ?? -1)) { app.tutStep = g.i; app.track('tutorial_step', { step: g.i }); } }
    if (app.audio) app.audio.update(dt, app);
  };

  app.draw = () => {
    const ui = app.ui;
    ui.begin();
    ui.finger = fingerDots(app);
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
    foldUnder(ctx);
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
    // 알림(화면 위에 잠깐 뜬다). 화면이 자리를 정하면(toastSpot — 대국은 판 아래쪽, CHM-48) 그 칸 폭 안에서 낱말 단위로 줄을 바꾸고
    // 아래에서 위로 쌓는다. 그 자리의 알림은 뜨지 않는 상자로 적어 smoke 「글 넘침」이 목표 막대와 겹침을 잰다. 다른 화면은 위 가운데
    const spot = !app.overlay && app.screen && app.screen.toastSpot ? app.screen.toastSpot() : null;
    app.toastRects = [];
    if (spot) {
      // 새 알림이 아래(자리 밑변)에, 오래된 것이 위로. 윗변(spot.top)을 넘는 오래된 것은 그리지 않는다
      let bottom = spot.bottom;
      [...app.toasts].reverse().forEach((t) => {
        const lines = wrap(t.msg, spot.w - 16, true);
        const w = Math.min(spot.w, Math.max(...lines.map((l) => measure(l, true))) + 16), h = BTN_S + (lines.length - 1) * LINE;
        const x = Math.round(spot.cx - w / 2), y = bottom - h;
        if (spot.top != null && y < spot.top) { bottom = -Infinity; return; }
        bottom = y - LIST_GAP;
        app.toastRects.push({ x, y, w, h });
        ctx.globalAlpha = Math.max(0, Math.min(1, t.t * 8, (t.life - t.t) * 4));
        openBox('edge', x, y, w, h, 1, { name: '알림' });
        box(ctx, x, y, w, h, PAL.feltDk, t.col);
        lines.forEach((l, k) => text(ctx, l, spot.cx, inkY(y, BTN_S) + k * LINE, t.col, { align: 'center', bold: true }));
        closeBox();
        ctx.globalAlpha = 1;
      });
    } else {
      openBox('fx', 0, 0, W, H, 0, { loose: true, name: '알림' });
      app.toasts.forEach((t, i) => {
        const a = Math.min(1, t.t * 8, (t.life - t.t) * 4);
        ctx.globalAlpha = Math.max(0, a);
        const w = Math.min(300, 16 + t.msg.length * 12);
        const x = Math.floor((W - w) / 2), y = 6 + i * 20;
        app.toastRects.push({ x, y, w, h: 17 });
        box(ctx, x, y, w, 17, PAL.feltDk, t.col);
        text(ctx, t.msg, W / 2, y + 2, t.col, { align: 'center', bold: true });
        ctx.globalAlpha = 1;
      });
      closeBox();
    }
    if (!app.overlay) drawCoach(ctx, app);
    else { app.hintNow = null; app.hintShown = null; app.coachDim = 0; }
    ui.end();
    // 말풍선 + 낱말 상자: 한 묶음(말풍선 → 상자, 같은 폭)을 화면의 설명 자리 규칙대로(placement.js)
    app.keyBoxes = [];
    app.tipRect = null;
    app.noteStack = null;
    if (app.settings.big) { const h = ui.hover, tip = h && h.tip && !ui.drag && !(app.guide && !app.overlay) ? (typeof h.tip === 'function' ? h.tip() : h.tip) : null; if (tip) app.tipRect = bigTooltip(ctx, tip); return; }
    const plan = planNotes();
    if (!plan) return;
    const { lay, hs, tip, ids, hot, clip, mode, anchor, h } = plan;
    let y = lay.y, k = 0;
    const rects = [];
    // 묶음 받침: 상자 사이 틈까지 한 번에 깔아 뒤 판넬이 새지 않고 한 묶음으로 읽히게
    lift(ctx, lay.x, lay.y, lay.w, plan.total);
    if (tip) { app.tipRect = tooltip(ctx, lay.x, y, tip, lay.w, clip); rects.push(app.tipRect); y += app.tipRect.h + NOTE_GAP; k++; }
    // 시너지 상자: 지금 모은 수(「5/6」)를 낱말 옆에
    const counts = app.run && ids.some((id) => id.startsWith('fam_')) ? familyCounts(app.run) : null;
    const famNote = (id) => { if (!counts || !id.startsWith('fam_')) return null; const n = counts[id.slice(4)] || 0, next = THRESHOLDS[levelOf(n)]; return next ? `${n}/${next}` : `${n}`; };
    for (const id of ids) {
      if (k >= lay.n) break;
      const r = drawKeyBox(ctx, id, lay.x, y, lay.w, id === hot, famNote(id), k ? Infinity : clip);
      app.keyBoxes.push(r); rects.push(r);
      y += r.h + NOTE_GAP; k++;
    }
    app.noteStack = { mode, anchor, id: h ? h.id : null, rects, side: lay.side, cut: rects.some((r) => r.cut), lean: !!(app.tipRect && app.tipRect.lean), full: plan.full, clip, dropped: hs.length - lay.n };
  };

  // 설명 묶음의 자리(그리기 전에 잰다): 가리킨 것 · 말풍선 · 낱말 상자 · placement.js 자리. 띄울 것이 없으면 null.
  // 화면을 그린 바로 뒤(접기 — fold.js)와 맨 위(그리기)에서 같은 셈을 쓴다
  function planNotes() {
    const ui = app.ui;
    const h = ui.hover;
    if (ui.drag || (app.guide && !app.overlay)) return null; // 따라 하는 길 중에는 말풍선을 띄우지 않는다(덮개 — 행마 보기 — 는 띄운다)
    const mx = ui.mouse.x, my = ui.mouse.y;
    const span = ui.termSpans.find((q) => mx >= q.x && my >= q.y && mx < q.x + q.w && my < q.y + q.h);
    const hot = span ? span.id : null;
    const tip = h && h.tip ? (typeof h.tip === 'function' ? h.tip() : h.tip) : null;
    const keys = h && h.keys ? (typeof h.keys === 'function' ? h.keys() : h.keys) : null;
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
    if (!tip && !ids.length) return null;
    const mode = noteMode(app.overlay || app.screen);
    const w = noteWidth(mode);
    const hs = [...(tip ? [tipHeight(tip, w)] : []), ...ids.map((id) => keyHeight(id, w))];
    // 덮으면 안 되는 것: 누를 수 있는 다른 구역(가리킨 것 · 그 안의 것은 빼고)
    const inAnchor = (r) => r.x >= anchor.x && r.y >= anchor.y && r.x + r.w <= anchor.x + anchor.w && r.y + r.h <= anchor.y + anchor.h;
    const avoid = ui.regions.filter((r) => r !== h && r.onClick && r.enabled && !inAnchor(r));
    // 덮지 않으면 좋은 것(판 밖 틀): 다른 카드 · 칸(말풍선이 뜨는 구역) · 꺼진 단추
    const soft = mode === 'below' ? ui.regions.filter((r) => r !== h && (r.tip || r.keys || (r.onClick && !r.enabled)) && !inAnchor(r)) : [];
    let lay = placeNotes(mode, anchor, hs, { W, H, avoid, soft });
    if (!lay) return null;
    // 말풍선 하나도 그 자리에 다 안 들어가면 자리의 높이로 자른다(「…」로 마친다) — 잘린 높이로 다시 놓는다
    let clip = Infinity;
    const full = hs[0];
    if (lay.clip != null) { clip = lay.clip; hs[0] = tip ? tipHeight(tip, w, clip) : keyHeight(ids[0], w, clip); lay = placeNotes(mode, anchor, hs.slice(0, 1), { W, H, avoid, soft }); }
    const total = hs.slice(0, lay.n).reduce((u, v) => u + v, 0) + NOTE_GAP * Math.max(0, lay.n - 1);
    return { lay, hs, tip, ids, hot, clip, mode, anchor, h, total, full };
  }
  // 설명 자리 접기(fold.js): 판 틀에서 묶음 · 처음 안내가 걸친 왼쪽 칸 판넬의 속을 비운다. 화면을 그린 바로 뒤에 부른다
  function foldUnder(ctx) {
    if (app.overlay || !app.screen || noteMode(app.screen) !== 'side') return;
    const ui = app.ui;
    // 가리킨 것을 이번 프레임 구역으로 다시 잡는다(화면이 막 바뀐 프레임에 지난 화면의 구역 · 말풍선을 쓰지 않게 — end()와 같은 값)
    ui.hover = ui.hitIn(ui.regions, ui.mouse.x, ui.mouse.y);
    const ground = (r) => { ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.drawImage(feltCanvas(W + 16, H + 16), -8, -8); flowLayer(ctx, app.time, app.tint(), -8, -8, W + 16, H + 16); ctx.restore(); };
    const c = coachPlan(app);
    if (c && c.rect) foldSide(ctx, ui.side, c.rect, c.r, ground);
    if (app.settings.big) return;
    const p = planNotes();
    if (p) foldSide(ctx, ui.side, { x: p.lay.x, y: p.lay.y, w: p.lay.w, h: p.total }, p.anchor, ground);
  }

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
