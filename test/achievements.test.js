// 업적(src/data/achievements.js · src/ui/achievements.js) · 도장(records.openingDan · josekiDan)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, ACHIEVEMENT_BY_ID } from '../src/data/achievements.js';
import { checkAchievements, noteFeats, formsOf, achvHave } from '../src/ui/achievements.js';
import { emptyRecords, loadRecords, finishRun, stampRun } from '../src/ui/records.js';
import { mergeRecords, RULES } from '../src/ui/merge.js';
import { MASTERS } from '../src/data/masters.js';
import { LEGENDS } from '../src/data/legends.js';
import { FAMILIES } from '../src/data/families.js';
import { OPENINGS } from '../src/data/openings.js';
import { KEYS, makeStore } from '../src/ui/save.js';
import { missing } from '../src/ui/lang.js';
import { installDom } from './helpers/dom.js';
import { stepBattle } from '../tools/bot.mjs';

const fresh = () => emptyRecords();
const all = (keys, v = true) => Object.fromEntries(keys.map((k) => [k, v]));
// 업적마다 [닿기 바로 앞, 닿음] — 앞에서는 받지 않고 닿으면 받는다
const CASES = {
  combo3: [(r) => r, (r) => { r.grades['★'] = 1; }],
  combo5: [(r) => { r.grades['★'] = 4; }, (r) => { r.grades['★★'] = 1; }],
  combo8: [(r) => { r.grades['★★'] = 9; }, (r) => { r.grades['★★★'] = 1; }],
  combo12: [(r) => { r.grades['★★★'] = 9; }, (r) => { r.grades['∞'] = 1; }],
  forms3: [(r) => { r.feats.forms = 2; }, (r) => { r.feats.forms = 3; }],
  forms5: [(r) => { r.feats.forms = 4; }, (r) => { r.feats.forms = 5; }],
  forms6: [(r) => { r.feats.forms = 5; }, (r) => { r.feats.forms = 6; }],
  replies3: [(r) => { r.feats.replies = 2; }, (r) => { r.feats.replies = 3; }],
  unbroken: [(r) => r, (r) => { r.feats.unbroken = 1; }],
  promote1: [(r) => r, (r) => { r.feats.promos = 1; }],
  promote2: [(r) => { r.feats.promos = 1; }, (r) => { r.feats.promos = 2; }],
  mate1: [(r) => r, (r) => { r.mates = 1; }],
  mateFirst: [(r) => { r.mates = 3; }, (r) => { r.feats.firstMate = 1; }],
  mate25: [(r) => { r.mates = 24; }, (r) => { r.mates = 25; }],
  brilliant1: [(r) => r, (r) => { r.brilliants = 1; }],
  brilliant5: [(r) => { r.brilliants = 4; }, (r) => { r.brilliants = 5; }],
  score10k: [(r) => { r.feats.score = 9999; }, (r) => { r.bestMove = { score: 10000, steps: [] }; }],
  score1m: [(r) => { r.feats.score = 999999; }, (r) => { r.feats.score = 1e6; }],
  score100m: [(r) => { r.feats.score = 1e8 - 1; }, (r) => { r.feats.score = 1e8; }],
  overflow10: [(r) => { r.feats.overflow = 5; }, (r) => { r.feats.overflow = 10; }],
  hall1: [(r) => { r.bestAnte = 1; }, (r) => { r.bestAnte = 2; }],
  hall4: [(r) => { r.bestAnte = 4; }, (r) => { r.bestAnte = 5; }],
  master1: [(r) => r, (r) => { r.mastersBeaten.fog = true; }],
  master8: [(r) => { r.mastersBeaten = all(MASTERS.slice(1).map((m) => m.id)); }, (r) => { r.mastersBeaten = all(MASTERS.map((m) => m.id)); }],
  chest5: [(r) => { r.feats.chest = 3; }, (r) => { r.feats.chest = 5; }],
  runWin: [(r) => { r.bestAnte = 8; }, (r) => { r.wins = 1; }],
  dan4: [(r) => { r.danWins = { 0: 3, 3: 1 }; }, (r) => { r.danWins = { 5: 1 }; }],
  dan8: [(r) => { r.danWins = { 7: 2 }; }, (r) => { r.danWins = { 8: 1 }; }],
  openings5: [(r) => { r.openingDan = { standard: 0, london: 2, sicilian: 0, queens_gambit: 1 }; }, (r) => { r.openingDan = all(Object.keys(OPENINGS), 0); }],
  endless12: [(r) => { r.bestEndless = 11; }, (r) => { r.bestEndless = 12; }],
  daily: [(r) => { r.daily = { date: '2026-10-25', won: false, runs: 2 }; }, (r) => { r.feats.daily = 1; }],
  legend1: [(r) => r, (r) => { r.legends = 1; }],
  legend5: [(r) => { r.codex.legendsDone = all(LEGENDS.slice(1).map((l) => l.id)); }, (r) => { r.codex.legendsDone = all(LEGENDS.map((l) => l.id)); }],
  synergy1: [(r) => { r.synergyTop = { leap: 4, line: 4 }; }, (r) => { r.synergyTop = { diag: 5 }; }],
  synergyAll: [(r) => { r.synergyTop = all(FAMILIES.slice(1).map((f) => f.id), 9); }, (r) => { r.synergyTop = all(FAMILIES.map((f) => f.id), 5); }],
  kingTake: [(r) => r, (r) => { r.feats.kingTook = 1; }],
  pawnRun: [(r) => { r.feats.pawnRun = 4; }, (r) => { r.feats.pawnRun = 5; }],
  gomoku: [(r) => r, (r) => { r.feats.gomoku = 1; }],
};

test('업적: 30~40개 · id가 겹치지 않는다 · 숨은 것은 2~3 · 모두 판정 사례가 있다', () => {
  assert.ok(ACHIEVEMENTS.length >= 30 && ACHIEVEMENTS.length <= 40, `${ACHIEVEMENTS.length}`);
  assert.equal(new Set(ACHIEVEMENTS.map((a) => a.id)).size, ACHIEVEMENTS.length);
  const secret = ACHIEVEMENTS.filter((a) => a.secret).length;
  assert.ok(secret >= 2 && secret <= 3);
  assert.deepEqual(ACHIEVEMENTS.map((a) => a.id).filter((id) => !CASES[id]), [], '사례 없는 업적');
  assert.deepEqual(Object.keys(CASES).filter((id) => !ACHIEVEMENT_BY_ID[id]), [], '없는 업적의 사례');
});

test('업적: 빈 기록에서는 아무것도 받지 않는다', () => {
  const r = fresh();
  assert.deepEqual(checkAchievements(r), []);
  assert.deepEqual(r.achv, {});
});

test('업적: 하나씩 — 닿기 바로 앞에서는 받지 않고, 닿으면 받는다 · 다시 받지 않는다', () => {
  for (const [id, [below, at]] of Object.entries(CASES)) {
    const r = fresh();
    below(r);
    assert.ok(!checkAchievements(r).includes(id), `${id}: 닿기 전에 받았다`);
    at(r);
    assert.ok(checkAchievements(r).includes(id), `${id}: 닿았는데 못 받았다`);
    assert.equal(r.achv[id], true);
    assert.ok(!checkAchievements(r).includes(id), `${id}: 두 번 받았다`);
  }
});

test('업적: 쌓는 업적의 「N/M」은 닿을 값을 넘지 않는다', () => {
  const r = fresh();
  r.mates = 40; r.mastersBeaten = { fog: true, mirror: true, nope: false };
  assert.equal(achvHave(ACHIEVEMENT_BY_ID.mate25, r), 25);
  assert.equal(achvHave(ACHIEVEMENT_BY_ID.master8, r), 2);
});

test('업적 글: 이름은 명사형 한 줄 · 조건은 「~다」 · 영어가 모두 있다', () => {
  for (const a of ACHIEVEMENTS) {
    assert.match(a.text, /다$/, a.id);
    assert.ok(!/[.…]$/.test(a.name), a.id);
  }
  assert.deepEqual(missing([...ACHIEVEMENTS.map((a) => a.name), ...ACHIEVEMENTS.map((a) => a.text), '전적', '업적', '업적 · 전술', '이긴 가장 높은 레이팅 1600']), []);
});

// 사슬 요약(chainSummary 꼴)이 끝에 붙은 대국
const battleWith = (h) => ({ history: [{ piece: 'P', took: '', caps: '', captures: 0, transforms: 0, promotions: 0, forced: 0, score: 0, reason: 'blocked', move: 1, ...h }] });

test('사건 → 기록 칸: 한 콤보의 모습 · 프로모션 · 응수 · 첫 수 메이트 · 킹 모습 · 폰만 · 점수', () => {
  const r = fresh();
  // 폰 → 나이트 → 비숍 → 룩 → 퀸(넷을 잡아 다섯 모습), 프로모션 둘, 응수 셋, 첫 수 메이트
  const h = { piece: 'P', took: 'PNBR', caps: 'NBRK', captures: 4, promotions: 2, forced: 3, score: 1234, reason: 'mate', move: 0 };
  noteFeats(r, null, [{ type: 'end', score: 1234 }], battleWith(h));
  assert.deepEqual([r.feats.forms, r.feats.promos, r.feats.replies, r.feats.firstMate, r.feats.score], [4, 2, 3, 1, 1234]);
  // 사슬 상태가 있으면 그 모습 목록(c.forms)을 쓴다
  noteFeats(r, null, [{ type: 'end', score: 1234 }], battleWith(h), { done: true, forms: ['P', 'N', 'B', 'R', 'Q'] });
  assert.equal(r.feats.forms, 5);
  // 둘째 수 메이트는 첫 수 메이트가 아니다 · 킹 모습으로 잡음 · 폰 모습으로만 다섯
  noteFeats(r, null, [{ type: 'end', score: 50 }], battleWith({ took: 'QK', caps: 'KP', captures: 2, score: 50, reason: 'mate', move: 1 }));
  assert.deepEqual([r.feats.firstMate, r.feats.kingTook], [2, 1], '첫 수 메이트는 앞의 두 번만');
  noteFeats(r, null, [{ type: 'end', score: 60 }], battleWith({ took: 'PPPPP', caps: 'PPPPP', captures: 5, score: 60 }));
  assert.equal(r.feats.pawnRun, 5);
  // 끝난 사슬의 줄이 아니면(점수가 다르면) 사슬 칸은 건드리지 않는다 · 점수 최고는 남긴다
  noteFeats(r, null, [{ type: 'end', score: 99 }], battleWith({ took: 'PNBRQK', score: 1 }));
  assert.equal(r.feats.forms, 5);
  assert.equal(r.feats.score, 1234);
  assert.equal(formsOf({ piece: 'P', took: 'PN', caps: 'NB' }), 3);
});

test('사건 → 기록 칸: 끊김 잇기 · 넘침 · 상자 · 오목 · 마스터전 승리 · 시너지', () => {
  const r = fresh();
  noteFeats(r, null, [{ type: 'cutIgnored' }, { type: 'overflow', tier: 5 }, { type: 'overflow', tier: 10 }, { type: 'chest', count: 3 }]);
  noteFeats(r, null, [{ type: 'chest', count: 5 }, { type: 'win', reason: 'gomoku' }]);
  assert.deepEqual([r.feats.unbroken, r.feats.overflow, r.feats.chest, r.feats.gomoku], [1, 10, 5, 1]);
  // 마스터전 승리는 판의 대국 줄(run.last)로 — 진 마스터전 · 연습 대국은 세지 않는다
  const run = { deck: [], maxims: [], last: { kind: 'master', master: 'fog', won: true } };
  noteFeats(r, run, [{ type: 'win', reason: 'score' }]);
  noteFeats(r, { ...run, last: { kind: 'master', master: 'mirror', won: false } }, [{ type: 'lose', reason: 'moves' }]);
  noteFeats(r, { ...run, last: { kind: 'practice', master: null, won: true } }, [{ type: 'win', reason: 'score' }]);
  assert.deepEqual(r.mastersBeaten, { fog: true });
  // 시너지: 격언 다섯이 모두 기사면 기사 5
  noteFeats(r, { deck: [], maxims: ['chivalry', 'first_move', 'close_call', 'cavalry_charge', 'specialty'].map((id) => ({ id })) }, []);
  assert.equal(r.synergyTop.leap, 5);
  assert.ok(checkAchievements(r).includes('synergy1'));
});

test('도장: 이긴 판의 오프닝 · 레퍼토리에 가장 높은 단(0도 남는다) · 진 판은 남기지 않는다 · 오늘의 대국 승리', () => {
  const r = fresh();
  const run = (o) => ({ phase: 'won', ante: 8, blind: 2, dan: 0, opening: 'london', josekis: ['highway', 'river'], ...o });
  finishRun(r, run({ phase: 'lost', dan: 5 }));
  assert.deepEqual([r.openingDan, r.josekiDan], [{}, {}]);
  finishRun(r, run({}));
  assert.deepEqual([r.openingDan, r.josekiDan], [{ london: 0 }, { highway: 0, river: 0 }]);
  finishRun(r, run({ dan: 3, josekis: ['river'] }));
  finishRun(r, run({ dan: 1, josekis: ['highway'] }));
  assert.deepEqual([r.openingDan, r.josekiDan], [{ london: 3 }, { highway: 1, river: 3 }]);
  assert.equal(r.feats.daily || 0, 0);
  finishRun(r, run({ opening: 'standard' }), { daily: '2026-10-25' });
  assert.equal(r.feats.daily, 1);
  stampRun(r, { dan: 2, opening: 'standard', josekis: [] });
  assert.equal(r.openingDan.standard, 2);
});

test('기기 합치기: 업적은 합집합 · 기록 칸은 큰 쪽 · 도장은 높은 단(단 0도 남는다)', () => {
  for (const k of ['achv', 'feats', 'mastersBeaten', 'synergyTop', 'openingDan', 'josekiDan']) assert.ok(RULES[k], k);
  const a = { ...fresh(), achv: { combo3: true }, feats: { forms: 4, score: 10 }, mastersBeaten: { fog: true }, synergyTop: { leap: 3 }, openingDan: { standard: 0, london: 4 }, josekiDan: { river: 2 } };
  const b = { ...fresh(), achv: { mate1: true }, feats: { forms: 2, score: 99, chest: 5 }, mastersBeaten: { mirror: true }, synergyTop: { leap: 5, diag: 1 }, openingDan: { london: 1 }, josekiDan: {} };
  const m = mergeRecords(a, b);
  assert.deepEqual(m.achv, { combo3: true, mate1: true });
  assert.deepEqual(m.feats, { forms: 4, score: 99, chest: 5 });
  assert.deepEqual(m.mastersBeaten, { fog: true, mirror: true });
  assert.deepEqual(m.synergyTop, { leap: 5, diag: 1 });
  assert.deepEqual(m.openingDan, { standard: 0, london: 4 });
  assert.deepEqual(m.josekiDan, { river: 2 });
  assert.deepEqual(mergeRecords(b, a), m, '교환');
  assert.deepEqual(mergeRecords(m, m), m, '같은 것');
});

test('저장 왕복: 업적 · 기록 칸 · 도장이 그대로 · 옛 기록에는 빈 칸이 생긴다', () => {
  const mem = new Map();
  const store = makeStore({ getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) });
  const r = { ...fresh(), achv: { combo3: true }, feats: { forms: 5 }, mastersBeaten: { fog: true }, synergyTop: { leap: 2 }, openingDan: { standard: 0 }, josekiDan: { river: 8 } };
  store.set(KEYS.records, r);
  const back = loadRecords(store);
  for (const k of ['achv', 'feats', 'mastersBeaten', 'synergyTop', 'openingDan', 'josekiDan']) assert.deepEqual(back[k], r[k], k);
  store.set(KEYS.records, { v: 1, runs: 3 });
  const old = loadRecords(store);
  for (const k of ['achv', 'feats', 'mastersBeaten', 'synergyTop', 'openingDan', 'josekiDan']) assert.deepEqual(old[k], {}, k);
});

// 앱: 진짜 판을 봇으로 두어 업적이 받히고, 알림은 대국 연출이 끝난 뒤에 줄을 서서 뜬다
let dom, createApp;
before(async () => { dom = await installDom(); ({ createApp } = await import('../src/ui/app.js')); });
after(() => { delete globalThis.document; delete globalThis.window; });

function makeApp(records = { v: 1, lessonsDone: true, tutorialAsked: true, coachSeen: { bigText: true, telemetry: true, rankName: true } }) {
  for (const k of [...dom.store.keys()]) dom.store.delete(k);
  dom.store.set(KEYS.records, JSON.stringify(records));
  dom.store.set(KEYS.settings, JSON.stringify({ volume: 0, music: 0, telemetry: false }));
  return createApp({ canvas: dom.document.createElement('canvas'), storage: dom.window.localStorage });
}

test('앱: 이 판본 전 기록으로 닿은 업적은 켤 때 알림 없이 받는다', () => {
  const app = makeApp({ v: 1, runs: 4, mates: 2, grades: { '★': 3 }, lessonsDone: true, tutorialAsked: true });
  assert.ok(app.records.achv.mate1 && app.records.achv.combo3);
  assert.equal(app.achvQueue.length, 0);
  assert.ok(JSON.parse(dom.store.get(KEYS.records)).achv.mate1, '받은 것을 저장한다');
});

test('앱: 판을 두면 업적이 받히고 · 알림은 대국이 바쁘지 않을 때 금빛으로 하나씩', () => {
  const app = makeApp();
  app.nextSeed = 7; app.newRun();
  for (let guard = 0; guard < 3000 && app.run.phase !== 'lost' && app.run.phase !== 'won' && !(app.records.bestAnte >= 2); guard++) {
    const ph = app.run.phase;
    if (ph === 'draft') app.cmd({ type: 'joseki', index: 0 });
    else if (ph === 'select') app.cmd({ type: 'play' });
    else if (ph === 'battle') { for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), {})) break; }
    else if (ph === 'shop') app.cmd({ type: 'leave' });
    else if (ph === 'pack') app.cmd({ type: 'skipPack' });
  }
  assert.ok(app.records.feats.score > 0, '한 수 점수를 적었다');
  assert.ok(app.records.achv.hall1, '1관 돌파');
  const queued = app.achvQueue.slice();
  assert.ok(queued.includes('hall1'));
  // 바쁜 대국 화면에서는 뜨지 않는다
  app.screen = { busy: true, draw() {}, name: 'battle' };
  app.update(1);
  assert.equal(app.toasts.filter((t) => t.achv).length, 0);
  app.screen = { busy: false, draw() {}, name: 'shop' };
  app.update(0.01);
  assert.equal(app.toasts.filter((t) => t.achv).length, 1);
  assert.match(app.toasts.at(-1).msg, /^업적 · /);
  app.update(0.3);
  assert.equal(app.toasts.filter((t) => t.achv).length, 1, '사이를 둔다');
  // 어느 화면에서든 한 번에 하나: 앞 알림(3초)이 사라진 뒤에 다음
  for (let i = 0; i < queued.length * 40; i++) { app.update(0.1); assert.ok(app.toasts.filter((t) => t.achv).length <= 1, '한 번에 하나'); } // 한 프레임은 0.1초까지
  assert.equal(app.achvQueue.length, 0);
});

test('앱: 알림이 셋을 넘어도 업적 알림은 버리지 않는다 · 덮개 화면은 상자를 피한다 · 도전 띠 대국은 수를 두면 걷는다', () => {
  const app = makeApp();
  app.toasts.length = 0; app.achvQueue.length = 0;
  app.screen = { busy: false, draw() {}, name: 'shop' };
  app.achvQueue.push('combo3');
  app.update(0.01);
  for (let i = 0; i < 5; i++) app.toast(`알림 ${i}`);
  assert.equal(app.toasts.length, 3);
  assert.equal(app.toasts.filter((t) => t.achv).length, 1, '업적 알림이 남는다');
  // 덮개 화면: 상자 위 빈 줄이 있으면 다른 알림이 사라진 뒤에 상자 위에, 좁으면 왼쪽 빈 칸, 그것도 없으면 기다린다
  app.toasts.length = 0; app.achvQueue.push('mate1'); app.achvAt = 0;
  app.screen = { busy: false, draw() {}, name: 'reward', coverBox: () => ({ x: 120, y: 38, w: 240, h: 194 }) };
  app.toast('도전을 이뤘어요');
  app.update(0.01);
  assert.equal(app.toasts.filter((t) => t.achv).length, 0, '위 가운데 알림이 있는 동안 기다린다');
  for (let i = 0; i < 30 && !app.toasts.some((t) => t.achv); i++) app.update(0.1);
  app.draw();
  const r = app.toastRects.at(-1);
  assert.ok(r.y + r.h + 2 <= 38 && r.y >= 4, `상자 위 ${JSON.stringify(r)}`);
  app.toasts.length = 0; app.achvQueue.push('combo8'); app.achvAt = 0;
  app.screen.coverBox = () => ({ x: 10, y: 10, w: 460, h: 250 });
  for (let i = 0; i < 10; i++) app.update(0.1);
  assert.equal(app.toasts.filter((t) => t.achv).length, 0, '자리가 없으면 기다린다');
  app.achvQueue.length = 0;
  // 도전 띠 자리(achvSpot drop): 화면이 바빠지면 업적 알림을 걷는다
  app.toasts.length = 0; app.achvAt = 0; app.achvQueue.push('forms5');
  const scr = { busy: false, draw() {}, name: 'battle', achvSpot: () => ({ cx: 240, w: 232, y: 1, hold: false, drop: scr.busy }) };
  app.screen = scr;
  app.update(0.01);
  assert.equal(app.toasts.filter((t) => t.achv).length, 1);
  scr.busy = true;
  app.update(0.01);
  assert.equal(app.toasts.filter((t) => t.achv).length, 0, '수를 두면 걷힌다');
});
