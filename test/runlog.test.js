// 사람 판 기록(CHM-50): 요약이 판 하네스 dump와 같은 열쇠 · 같은 값을 내는가, 200개 자르기, 수업 · 대본 · scratch 빼기, 그만둔 판, 저장 왕복.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, applyRun } from '../src/sim/run.js';
import { newTrack, trackBefore, trackCommand, runRow, addRow, RUNLOG_MAX } from '../src/sim/runlog.js';
import { playRun } from '../tools/shopbot.mjs';
import { stepBattle } from '../tools/bot.mjs';
import { makeStore, KEYS } from '../src/ui/save.js';
import { loadRuns, keepRow, exportText } from '../src/ui/runlog.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// 봇만 내는 열쇠: sac = 봇이 희생을 고를 때 잰 속값(CHM-51) — 사람 판에는 없다
const BOT_ONLY = ['sac'];
const dumpKeys = () => Object.keys(dump).filter((k) => !BOT_ONLY.includes(k));
const HUMAN_ONLY = ['human', 'id', 'end', 'dan', 'opening', 'daily', 'endless', 'startedAt', 'endedAt', 'sec', 'battles', 'sacrifices', 'brilliants', 'lostAt', 'buys', 'script', 'app'];

// 하네스 판 하나(--policy none · seed 1 → 판 seed 1000003)
let dump;
before(() => {
  const out = join(mkdtempSync(join(tmpdir(), 'runlog-')), 'dump.json');
  execFileSync(process.execPath, ['tools/run.mjs', '--runs', '1', '--policy', 'none', '--seed', '1', '--workers', '1', '--quiet', '--dump', out], { cwd: ROOT, stdio: 'ignore' });
  dump = JSON.parse(readFileSync(out, 'utf8')).runs[0];
});

test('요약은 하네스 dump의 판별 열쇠를 모두 같은 값으로 낸다(봇이 센 것을 넘기면)', () => {
  const run = createRun({ seed: dump.seed, dan: 0, draft: true });
  const { bought, editions, legendAt, seen } = playRun(run, 'none');
  const row = runRow(run, { ...newTrack(), bought, editions, legendAt, seen }, { end: 'lost' });
  for (const k of dumpKeys()) assert.deepStrictEqual(row[k], dump[k], k);
  // 사람 판에만 있는 열쇠는 dump 열쇠와 겹치지 않는다
  for (const k of HUMAN_ONLY) assert.ok(!(k in dump), k);
  assert.deepEqual(Object.keys(row).sort(), [...dumpKeys(), ...HUMAN_ONLY].sort());
});

// 화면이 세는 길(trackCommand)로 같은 판을 다시 둔다: shopbot playRun 'none'과 같은 차례
function playTracked(run, track) {
  const act = (cmd) => { const b = trackBefore(run); const ev = applyRun(run, cmd); trackCommand(track, run, cmd, ev, b); return ev; };
  for (let guard = 0; guard < 5000; guard++) {
    if (run.phase === 'lost' || run.phase === 'won') break;
    if (run.phase === 'draft') act({ type: 'joseki', index: 0 });
    else if (run.phase === 'select') act({ type: 'play' });
    else if (run.phase === 'battle') { if (!stepBattle(run.battle, act, {})) throw new Error('stuck'); }
    else if (run.phase === 'shop') act({ type: 'leave' });
    else if (run.phase === 'pack') act({ type: 'skipPack' });
  }
  return run;
}

test('화면이 명령마다 센 것(trackCommand)도 하네스와 같은 값이다', () => {
  const run = createRun({ seed: dump.seed, dan: 0, draft: true });
  const track = newTrack({ startedAt: 1 });
  playTracked(run, track);
  const row = runRow(run, track);
  for (const k of dumpKeys()) assert.deepStrictEqual(row[k], dump[k], k);
  assert.equal(row.end, 'lost');
  assert.equal(row.battles, row.log.filter((x) => !x.skipped).length);
  assert.equal(row.lostAt.length, row.log.filter((x) => !x.skipped && !x.won).length);
  assert.ok(row.lostAt.every((x) => x.target > 0 && x.pct === Math.round((1000 * x.score) / x.target) / 10));
});

test('산 것: 격언은 bought · editions, 모든 산 것은 buys(꾸러미에서 고른 것은 pack)', () => {
  const run = createRun({ seed: 5, draft: false });
  run.phase = 'shop'; run.money = 99;
  run.shop = { ...(run.shop || {}), display: [{ kind: 'maxim', id: 'chivalry', price: 5, sold: false, edition: 'foil' }, { kind: 'piece', t: 'R', price: 4, sold: false }], packs: [], rerolls: 0, ante: 1, blind: 0 };
  const track = newTrack();
  const act = (cmd) => { const b = trackBefore(run); const ev = applyRun(run, cmd); trackCommand(track, run, cmd, ev, b); };
  act({ type: 'buy', slot: 0 });
  act({ type: 'buy', slot: 1 });
  assert.deepEqual(track.bought, ['chivalry']);
  assert.deepEqual(track.editions, ['foil']);
  assert.deepEqual(track.buys.map((x) => [x.k, x.id, x.$]), [['maxim', 'chivalry', 5], ['piece', 'R', 4]]);
});

test('기록은 200판까지, 오래된 것부터 버리고 같은 id는 갈아 끼운다', () => {
  let list = [];
  for (let i = 0; i < RUNLOG_MAX + 5; i++) list = addRow(list, { id: `r${i}`, seed: i });
  assert.equal(list.length, 200);
  assert.equal(list[0].id, 'r5');
  assert.equal(list.at(-1).id, 'r204');
  list = addRow(list, { id: 'r100', seed: 'again' });
  assert.equal(list.length, 200);
  assert.equal(list.filter((r) => r.id === 'r100').length, 1);
  assert.equal(list.at(-1).seed, 'again');
});

test('저장 왕복: 남긴 판을 그대로 읽고, 내보낸 JSON에도 그대로 있다 · 꽉 차면 오래된 판을 덜어 쓴다', () => {
  const mem = new Map();
  const store = makeStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) });
  const track = newTrack({ startedAt: 7, app: { version: '0.1.0', commit: null, platform: 'web' } });
  const row = runRow(playTracked(createRun({ seed: dump.seed }), track), track, { end: 'lost' });
  assert.equal(keepRow(store, row), 1);
  assert.deepStrictEqual(loadRuns(store), [JSON.parse(JSON.stringify(row))]);
  const ex = exportText(store, { app: { version: '0.1.0' }, now: new Date('2026-10-02T12:34:00Z') });
  assert.equal(ex.n, 1);
  assert.equal(ex.name, 'chainmate-runs-20261002-1234.json');
  const back = JSON.parse(ex.text);
  assert.equal(back.kind, 'chainmate-runs');
  assert.deepStrictEqual(back.runs, loadRuns(store));
  // 꽉 찬 저장소: 글이 limit를 넘으면 setItem이 던진다
  const limit = JSON.stringify({ v: 1, runs: Array(6).fill(row) }).length + 10;
  const tight = new Map();
  const small = makeStore({ getItem: (k) => tight.get(k) ?? null, setItem: (k, v) => { if (String(v).length > limit) throw new Error('QuotaExceeded'); tight.set(k, String(v)); }, removeItem: (k) => tight.delete(k) });
  let n = 0;
  for (let i = 0; i < 10; i++) n = keepRow(small, { ...row, id: `x${i}` });
  assert.ok(n > 0 && n <= 6, `남은 판 ${n}`);
  assert.equal(loadRuns(small).at(-1).id, 'x9', '새 판은 남는다');
});

// ── 앱: 판이 끝나면 한 줄, 그만둔 판 · 대본 대국 · 수업 판
let dom, boot;
before(async () => {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  dom = makeFakeDom();
  globalThis.document = dom.document; globalThis.window = dom.window;
  const { setCanvasFactory } = await import('../src/render/surface.js');
  setCanvasFactory(() => dom.document.createElement('canvas'));
  ({ boot } = await import('../src/main.js'));
});
after(() => { delete globalThis.document; delete globalThis.window; });
const tick = (app, n = 2) => { for (let i = 0; i < n; i++) app.frame((app.last || 0) + 16); };
const fresh = async () => { for (const k of [...dom.store.keys()]) dom.store.delete(k); const app = await boot({ window: dom.window, document: dom.document }); tick(app); return app; };
const rows = (app) => loadRuns(app.store);
// 대국 하나를 봇으로 끝까지(앱 명령으로)
const finishBattle = (app) => { for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), {})) break; };

test('앱: 판이 끝나면(짐) 한 줄, 판 시간과 앱 판이 함께', async () => {
  const app = await fresh();
  app.records.kingDone = true; app.records.runs = 1;
  app.newRun({ seed: dump.seed });
  for (let i = 0; i < 30; i++) app.frame((app.last || 0) + 50); // 1.5초쯤
  const act = (cmd) => app.cmd(cmd);
  for (let guard = 0; guard < 5000 && app.run.phase !== 'lost' && app.run.phase !== 'won'; guard++) {
    const ph = app.run.phase;
    if (ph === 'draft') act({ type: 'joseki', index: 0 });
    else if (ph === 'select') act({ type: 'play' });
    else if (ph === 'battle') finishBattle(app);
    else if (ph === 'shop') act({ type: 'leave' });
    else if (ph === 'pack') act({ type: 'skipPack' });
  }
  const list = rows(app);
  assert.equal(list.length, 1);
  const r = list[0];
  assert.equal(r.end, 'lost');
  for (const k of dumpKeys()) assert.deepStrictEqual(r[k], dump[k], k); // 하네스 판과 같은 씨앗 · 같은 수 → 같은 값
  assert.ok(r.sec >= 1, `판 시간 ${r.sec}`);
  assert.equal(r.app.platform, 'web');
  assert.equal(r.app.version, '0.1.0');
  // 결과 화면이 다시 불러도 늘지 않는다
  app.goPhase(); tick(app);
  assert.equal(rows(app).length, 1);
});

test('앱: 새 판으로 덮어쓴 판은 「그만둠」 · 대본 대국 줄은 빠진다', async () => {
  const app = await fresh();
  app.screen.items().find(([id]) => id === 'title:new')[2](); // 처음 켬: 킹과 두는 대본 대국
  tick(app);
  assert.equal(app.run.battle.script, 'king');
  finishBattle(app);
  assert.equal(app.run.log.length, 1);
  assert.deepEqual(app.run.track.script, [0]);
  // 이어서 다음 대국 하나를 둔다
  for (let g = 0; g < 50 && app.run.phase !== 'battle'; g++) {
    const ph = app.run.phase;
    if (ph === 'draft') app.cmd({ type: 'joseki', index: 0 });
    else if (ph === 'select') app.cmd({ type: 'play' });
    else if (ph === 'shop') app.cmd({ type: 'leave' });
    else if (ph === 'pack') app.cmd({ type: 'skipPack' });
  }
  finishBattle(app);
  const seed = app.run.seed;
  app.toTitle(); tick(app);
  assert.equal(rows(app).length, 0, '타이틀로 나가기만 해서는 남기지 않는다');
  app.newRun({ seed: 99 });
  const list = rows(app);
  assert.equal(list.length, 1);
  assert.equal(list[0].end, 'quit');
  assert.equal(list[0].seed, seed);
  assert.equal(list[0].won, false);
  assert.equal(list[0].script, 1);
  assert.equal(list[0].log.length, 1, '대본 대국 줄은 빠지고 그 뒤 대국만');
  assert.equal(list[0].battles, 1);
});

test('앱: 수업 판(scratch)은 남기지 않고, 그 뒤 새 판도 「그만둠」을 만들지 않는다', async () => {
  const app = await fresh();
  const { startLessonShop } = await import('../src/ui/screens/lessons.js');
  startLessonShop(app, 9);
  assert.ok(app.run.scratch);
  app.cmd({ type: 'buy', slot: 0 });
  assert.equal(app.run.track, undefined);
  app.newRun({ seed: 5 });
  assert.equal(rows(app).length, 0);
  assert.equal(dom.store.get(KEYS.runs), undefined);
});

test('앱: 설정 「기록 내보내기」 — 판이 없으면 알림만, 받을 길이 없으면 「내보내지 못했다」', async () => {
  const app = await fresh();
  app.openOverlay('settings'); tick(app);
  const btn = app.ui.regions.find((r) => r.id === 'set:export');
  assert.ok(btn, '단추가 있다');
  assert.equal(btn.onClick(), 'none');
  assert.equal(app.toasts.at(-1).msg, '아직 끝낸 판이 없다');
  keepRow(app.store, { id: 'a', seed: 1 });
  assert.equal(await btn.onClick(), 'fail'); // 가짜 DOM: 파일 · 클립보드가 없다
  assert.equal(app.toasts.at(-1).msg, '내보내지 못했다');
});
