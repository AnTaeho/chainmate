// 클라우드 저장 · 기기 잇기의 화면 쪽(CHM-71, src/ui/cloud.js · rank.js): 켤 때 당겨 합침, 올리기 묶기(15초), 409 뒤 합쳐 다시, 두는 중에는 진행 중인 판을 덮지 않음,
// 설정 몇 칸, 실패는 조용히, 로컬 서버 · 자동화 브라우저 0건, 열쇠가 기록 보내기 · 콘솔에 없음. 서버는 진짜 로직에 기억 저장소를 물린 가짜(helpers/fakeapi.js).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRank, PLAYER_KEY } from '../src/ui/rank.js';
import { createCloud, CLOUD_KEY, PUSH_GAP, KEEPALIVE_MAX, BLOB_MAX, SYNC_SETTINGS } from '../src/ui/cloud.js';
import { emptyRecords } from '../src/ui/records.js';
import { makeStore, KEYS, DEFAULT_SETTINGS } from '../src/ui/save.js';
import { getLang, setLang } from '../src/ui/lang.js';
import { nameText } from '../src/data/names.js';
import { LIMITS } from '../api/_lib/service.js';
import { stepBattle } from '../tools/bot.mjs';
import { fakeApi } from './helpers/fakeapi.js';
import { fakeStorage, HOST } from './helpers/telemetry.js';
import { installDom, tick } from './helpers/dom.js';

before(async () => { await installDom(); });
after(() => { delete globalThis.document; delete globalThis.window; setLang('ko'); });

const DATE = '2026-10-08';
const NOON = Date.parse(`${DATE}T12:00:00Z`);
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
const world = () => { const clock = { t: NOON }; return { clock, api: fakeApi({ now: () => clock.t }) }; };
// 기기 하나: 저장 · 순위 · 클라우드 저장 + 앱이 알려 주는 것만 가진 가짜 앱
function device({ api, clock }, opts = {}) {
  const storage = fakeStorage();
  const rank = createRank({ fetch: api.fetch, storage, host: HOST, today: () => DATE, now: () => clock.t, ...opts });
  const timers = new Map();
  let seq = 0;
  const cloud = createCloud({ rank, now: () => clock.t, setTimer: (fn, ms) => { timers.set(++seq, { fn, ms }); return seq; }, clearTimer: (id) => timers.delete(id) });
  const tracked = [];
  const app = { store: makeStore(storage), records: emptyRecords(), settings: { ...DEFAULT_SETTINGS }, run: null, today: () => DATE, track: (name, props) => tracked.push([name, props]) };
  cloud.attach(app);
  // 걸린 타이머를 모두 울린다
  const ring = async () => { const list = [...timers.values()]; timers.clear(); for (const t of list) t.fn(); await settle(); };
  const saveRun = (run) => { if (run) app.store.set(KEYS.run, run); else { app.store.del(KEYS.run); cloud.noteRunEnd(); } };
  return { storage, rank, cloud, app, timers, tracked, ring, saveRun, key: () => JSON.parse(storage.getItem(PLAYER_KEY)).key, state: () => JSON.parse(storage.getItem(CLOUD_KEY) || 'null') };
}
const puts = (api) => api.named('/api/save').filter((c) => c.method === 'PUT');
const gets = (api) => api.named('/api/save').filter((c) => c.method === 'GET');
const saved = async (api, key) => (await (await api.fetch('/api/save', { headers: { Authorization: `Bearer ${key}` } })).json());
// 두 기기를 코드로 잇는다(B가 A의 코드를 넣는다)
async function link(a, b) {
  const c = await a.rank.linkCode();
  assert.equal(c.ok, true);
  const r = await b.rank.linkRedeem(c.code);
  assert.equal(r.ok, true);
  return r;
}

test('올리기: 열쇠는 처음 맞추는 때에 생기고, 15초에 한 번까지 묶어 올린다 — 달라진 것이 없으면 올리지 않는다', async () => {
  const w = world(), d = device(w);
  assert.equal(await d.cloud.open(), false);
  assert.equal(w.api.calls.length, 0, '열쇠가 없으면 켤 때 아무것도 부르지 않는다');
  d.app.records.runs = 3;
  d.cloud.touch(); d.cloud.touch(); d.cloud.touch();
  assert.deepEqual([...d.timers.values()].map((t) => t.ms), [0], '타이머는 하나');
  await d.ring();
  assert.equal(w.api.store.players.length, 1);
  assert.deepEqual(puts(w.api).map((c) => c.body.baseRev), [0]);
  const s1 = await saved(w.api, d.key());
  assert.deepEqual([s1.rev, s1.blob.v, s1.blob.records.runs, s1.blob.run, s1.blob.settings], [1, 1, 3, null, { lang: 'ko', coach: true, replay: true }]);
  assert.deepEqual(Object.keys(s1.blob).sort(), ['records', 'run', 'runAt', 'setAt', 'settings', 'v']);
  assert.deepEqual([d.state().rev, d.state().at], [1, NOON]);
  // 5초 뒤 또 달라졌다: 15초가 찰 때까지 미룬다
  w.clock.t += 5000;
  d.app.records.runs = 4;
  d.cloud.touch(); d.cloud.touch();
  assert.deepEqual([...d.timers.values()].map((t) => t.ms), [PUSH_GAP - 5000]);
  assert.equal(puts(w.api).length, 1);
  w.clock.t += PUSH_GAP - 5000;
  d.app.records.runs = 5; // 그 사이 달라진 것도 한 번에 간다
  await d.ring();
  assert.deepEqual(puts(w.api).map((c) => c.body.baseRev), [0, 1]);
  assert.equal((await saved(w.api, d.key())).blob.records.runs, 5);
  // 달라진 것이 없으면 다시 올리지 않는다
  w.clock.t += 60000;
  d.cloud.touch(); await d.ring();
  assert.equal(puts(w.api).length, 2);
  assert.equal(d.cloud.stats.pushed, 2);
});

test('켤 때: 당겨 와 합치고, 달라졌으면 올린다 — 같으면 올리지 않는다', async () => {
  const w = world(), a = device(w);
  a.app.records.runs = 9; a.app.records.codex.maxims = { m1: true, m2: true };
  a.cloud.touch(); await a.ring();
  // 같은 열쇠의 저장만 지워진 브라우저(열쇠는 살아 있다): 기록을 되찾는다
  const b = device(w);
  b.storage.setItem(PLAYER_KEY, a.storage.getItem(PLAYER_KEY));
  b.app.records.wins = 2; b.app.records.codex.maxims = { m3: true };
  assert.equal(await b.cloud.open(), true);
  assert.deepEqual([b.app.records.runs, b.app.records.wins, Object.keys(b.app.records.codex.maxims).sort()], [9, 2, ['m1', 'm2', 'm3']]);
  assert.deepEqual(JSON.parse(b.storage.getItem(KEYS.records)).runs, 9, '합친 기록이 저장에 남는다');
  assert.deepEqual([gets(w.api).length, puts(w.api).length], [1, 2], '달라졌으니 한 번 올린다');
  const s = await saved(w.api, a.key());
  const asked = gets(w.api).length;
  assert.deepEqual([s.rev, s.blob.records.wins, Object.keys(s.blob.records.codex.maxims).length], [2, 2, 3]);
  // 다시 켜면: 같으니 당기기만
  const c = device(w);
  c.storage.setItem(PLAYER_KEY, a.storage.getItem(PLAYER_KEY));
  c.storage.setItem(KEYS.records, b.storage.getItem(KEYS.records));
  Object.assign(c.app.records, JSON.parse(b.storage.getItem(KEYS.records)));
  assert.equal(await c.cloud.open(), true);
  assert.deepEqual([gets(w.api).length - asked, puts(w.api).length], [1, 2]);
  assert.deepEqual([c.cloud.stats.pulled, c.cloud.stats.pushed], [1, 0]);
});

test('잇기: 코드를 넣은 기기가 같은 이름이 되고, 두 기기의 기록이 합쳐져 양쪽에 보인다 — 합쳐서 늘어난 것을 안다', async () => {
  const w = world(), a = device(w), b = device(w);
  a.app.records.runs = 12; a.app.records.bestAnte = 6; a.app.records.codex.maxims = { m1: true, m2: true, m3: true }; a.app.records.unlocked.openings = ['standard', 'london'];
  a.cloud.touch(); await a.ring();
  b.app.records.runs = 2; b.app.records.mates = 5; b.app.records.codex.maxims = { m9: true };
  const r = await link(a, b);
  assert.equal(r.devices, 2);
  assert.equal(r.name, a.rank.player().name);
  assert.equal(b.rank.player().name, a.rank.player().name, '같은 이름');
  assert.notEqual(b.key(), a.key(), '열쇠는 기기마다 따로');
  assert.equal(w.api.store.players.length, 1);
  const got = await b.cloud.join();
  assert.deepEqual(got, { ok: true, gain: { codex: 3, openings: 1, runs: 10, ante: 6 } });
  assert.deepEqual([b.app.records.runs, b.app.records.mates, Object.keys(b.app.records.codex.maxims).length], [12, 5, 4]);
  // A 쪽: 코드가 쓰인 것을 알고(기기 수) 당겨 오면 B의 것이 보인다
  assert.equal(await a.rank.devices(), 2);
  const mine = await a.cloud.join();
  assert.deepEqual(mine.gain, { codex: 1, openings: 0, runs: 0, ante: 0 });
  assert.deepEqual([a.app.records.runs, a.app.records.mates], [12, 5]);
  assert.deepEqual((await saved(w.api, a.key())).blob.records, (await saved(w.api, b.key())).blob.records);
  // 틀린 코드 · 자기 코드 · 지난 코드
  const c = device(w);
  assert.deepEqual(await c.rank.linkRedeem('00000000'), { ok: false, why: 'bad' });
  const mineCode = await a.rank.linkCode();
  assert.deepEqual(await b.rank.linkRedeem(mineCode.code), { ok: false, why: 'self' });
  w.clock.t += LIMITS.codeTtl;
  assert.deepEqual(await c.rank.linkRedeem(mineCode.code), { ok: false, why: 'expired' });
  w.api.mode = 'fail';
  assert.deepEqual(await c.rank.linkRedeem('12345678'), { ok: false, why: 'unreached' });
  assert.deepEqual(await a.rank.linkCode(), { ok: false, why: 'unreached' });
  assert.equal(await a.rank.devices(), null);
});

test('409: 다른 기기가 먼저 올렸으면 서버 것을 합쳐 한 번 더 올린다', async () => {
  const w = world(), a = device(w), b = device(w);
  a.cloud.touch(); await a.ring();
  await link(a, b); await b.cloud.join();
  // A가 먼저 올린다(rev 2 → 3). B는 낡은 rev로 올린다
  w.clock.t += 20000;
  a.app.records.runs = 7; a.app.records.codex.souls = { s1: true };
  a.cloud.touch(); await a.ring();
  b.app.records.wins = 3; b.app.records.codex.souls = { s2: true };
  const before = puts(w.api).length;
  b.cloud.touch(); await b.ring();
  const mine = puts(w.api).slice(before);
  assert.equal(mine.length, 2, '409 뒤 한 번 더');
  assert.ok(mine[1].body.baseRev > mine[0].body.baseRev);
  assert.deepEqual([b.cloud.stats.conflict, b.app.records.runs, b.app.records.wins], [1, 7, 3]);
  const s = (await saved(w.api, a.key())).blob.records;
  assert.deepEqual([s.runs, s.wins, Object.keys(s.codex.souls).sort()], [7, 3, ['s1', 's2']]);
  assert.equal(b.state().rev, (await saved(w.api, b.key())).rev);
});

test('진행 중인 판: 저장한 때가 늦은 쪽이 이긴다 · 끝난 쪽이 더 늦으면 지운다 · 두는 중에는 덮지 않고 첫 화면으로 돌아올 때 반영한다', async () => {
  const w = world(), a = device(w), b = device(w);
  a.cloud.touch(); await a.ring();
  await link(a, b); await b.cloud.join();
  const runAt = (t, more = {}) => ({ seed: 7, phase: 'shop', ante: 3, updatedAt: t, ...more });
  // A가 판을 두다 올린다 → B는 켤 때 그 판을 받는다(「이어 하기」)
  w.clock.t += 20000;
  a.saveRun(runAt(w.clock.t)); a.cloud.touch(); await a.ring();
  assert.equal(b.app.store.get(KEYS.run), null);
  await b.cloud.open();
  assert.deepEqual(b.app.store.get(KEYS.run), runAt(w.clock.t));
  // B가 더 두고 올린다 → A가 두는 중이면 덮지 않는다
  w.clock.t += 20000;
  const later = runAt(w.clock.t, { ante: 4 });
  b.saveRun(later); b.cloud.touch(); await b.ring();
  a.app.run = a.app.store.get(KEYS.run);
  const mine = JSON.stringify(a.app.run);
  await a.cloud.pull();
  assert.equal(JSON.stringify(a.app.store.get(KEYS.run)), mine, '두는 중에는 그대로');
  // 첫 화면으로 돌아오면 반영한다
  a.app.run = null; a.cloud.settle();
  assert.deepEqual(a.app.store.get(KEYS.run), later);
  // 두는 중에 받았어도, 그 뒤 이 기기가 더 두었으면 이 기기 것이 남는다
  w.clock.t += 20000;
  b.saveRun(runAt(w.clock.t, { ante: 5 })); b.cloud.touch(); await b.ring();
  a.app.run = a.app.store.get(KEYS.run);
  await a.cloud.pull();
  w.clock.t += 1000;
  const newer = runAt(w.clock.t, { ante: 6 });
  a.saveRun(newer);
  a.app.run = null; a.cloud.settle();
  assert.deepEqual(a.app.store.get(KEYS.run), newer);
  // 수업 판(scratch) · 끝난 판은 두는 중이 아니다
  a.app.run = { scratch: true, phase: 'battle' };
  w.clock.t += 20000;
  a.cloud.touch(); await a.ring();
  // B에서 판이 끝났다(더 늦다) → A의 저장도 지워진다
  w.clock.t += 20000;
  await b.cloud.pull();
  assert.deepEqual(b.app.store.get(KEYS.run), newer);
  w.clock.t += 1000;
  b.saveRun(null); b.cloud.touch(); await b.ring();
  assert.equal((await saved(w.api, a.key())).blob.run, null);
  await a.cloud.pull();
  assert.equal(a.app.store.get(KEYS.run), null, '끝난 판은 되살아나지 않는다');
  // 낡은 판이 서버에 있어도 이 기기의 더 늦은 끝을 이기지 못한다
  const c = device(w);
  c.storage.setItem(PLAYER_KEY, a.storage.getItem(PLAYER_KEY));
  c.saveRun(runAt(NOON - 5000));
  await c.cloud.open();
  assert.equal(c.app.store.get(KEYS.run), null);
});

test('설정: 언어 · 처음 안내 · 복기만 옮긴다(늦게 바꾼 쪽) — 소리 · 연출 속도 · 기록 보내기는 기기마다', async () => {
  assert.deepEqual(Object.keys(SYNC_SETTINGS), ['lang', 'coach', 'replay']);
  const w = world(), a = device(w), b = device(w);
  a.cloud.noteSettings(); b.cloud.noteSettings();
  a.cloud.touch(); await a.ring();
  await link(a, b); await b.cloud.join();
  assert.equal(b.app.settings.lang, 'ko');
  w.clock.t += 20000;
  Object.assign(a.app.settings, { lang: 'en', replay: false, volume: 0.1, speed: 4, telemetry: false });
  a.cloud.noteSettings(); a.cloud.touch(); await a.ring();
  Object.assign(b.app.settings, { volume: 0.9, speed: 2 });
  await b.cloud.open();
  assert.deepEqual([b.app.settings.lang, b.app.settings.replay, b.app.settings.coach], ['en', false, true]);
  assert.deepEqual([b.app.settings.volume, b.app.settings.speed, b.app.settings.telemetry], [0.9, 2, true], '기기 취향 · 동의는 그대로');
  assert.equal(getLang(), 'en');
  assert.equal(JSON.parse(b.storage.getItem(KEYS.settings)).lang, 'en');
  // 받은 값이 이상하면 쓰지 않는다
  const st = (await saved(w.api, a.key()));
  await w.api.fetch('/api/save', { method: 'PUT', headers: { Authorization: `Bearer ${a.key()}` }, body: JSON.stringify({ baseRev: st.rev, blob: { ...st.blob, settings: { lang: 'xx', coach: 'no', replay: true }, setAt: w.clock.t + 99 } }) });
  await b.cloud.pull();
  assert.deepEqual([b.app.settings.lang, b.app.settings.coach, b.app.settings.replay], ['en', true, true]);
  setLang('ko');
});

test('실패는 조용히: 닿지 못하면 다음 때 다시 올린다 · 화면이 가려질 때는 keepalive로 한 번(열쇠가 없으면 만들지 않는다)', async () => {
  const w = world(), d = device(w);
  d.app.records.runs = 1;
  assert.equal(await d.cloud.hidden(), false);
  d.cloud.mark();
  assert.equal(await d.cloud.hidden(), false);
  assert.equal(w.api.calls.length, 0, '열쇠가 없으면 가려질 때 아무것도 부르지 않는다');
  d.cloud.touch(); await d.ring();
  w.api.mode = 'fail';
  w.clock.t += 20000;
  d.app.records.runs = 2; d.cloud.touch(); await d.ring();
  assert.equal(d.cloud.stats.pushed, 1);
  assert.equal(d.tracked.length, 0, '실패해도 아무것도 알리지 않는다');
  w.api.mode = 'ok';
  w.clock.t += 20000;
  d.cloud.touch(); await d.ring();
  assert.equal((await saved(w.api, d.key())).blob.records.runs, 2);
  // 가려질 때: 달라진 것이 있을 때만, keepalive로
  assert.equal(await d.cloud.hidden(), false);
  d.app.records.runs = 3; d.cloud.mark();
  d.cloud.touch();
  assert.equal(await d.cloud.hidden(), true);
  assert.equal(d.timers.size, 0, '걸어 둔 올리기는 거둔다');
  assert.deepEqual([puts(w.api).at(-1).keepalive, puts(w.api).at(-1).body.blob.records.runs], [true, 3]);
  // 64KiB를 넘는 덩이는 keepalive로 나가지 않는다 — 보통 길로 보낸다. 한도를 넘으면 판의 세기(track)를 빼고, 그래도 넘으면 올리지 않는다
  d.saveRun({ seed: 1, phase: 'shop', updatedAt: w.clock.t, pad: 'x'.repeat(KEEPALIVE_MAX) });
  d.cloud.mark();
  assert.equal(await d.cloud.hidden(), true);
  assert.equal(puts(w.api).at(-1).keepalive, false);
  d.saveRun({ seed: 1, phase: 'shop', updatedAt: w.clock.t + 1, track: { pad: 'x'.repeat(BLOB_MAX) } });
  w.clock.t += 20000; d.cloud.touch(); await d.ring();
  assert.deepEqual([puts(w.api).at(-1).body.blob.run.seed, 'track' in puts(w.api).at(-1).body.blob.run], [1, false]);
  const n = puts(w.api).length;
  d.saveRun({ seed: 1, phase: 'shop', updatedAt: w.clock.t + 2, pad: 'x'.repeat(BLOB_MAX) });
  w.clock.t += 20000; d.cloud.touch(); await d.ring();
  assert.deepEqual([puts(w.api).length, d.cloud.stats.skipped], [n, 1]);
});

test('이 기기 떼기: 열쇠는 그대로 새 플레이어가 되고, 그 뒤 올린 것은 남은 기기에 가지 않는다', async () => {
  const w = world(), a = device(w), b = device(w);
  a.app.records.runs = 4; a.cloud.touch(); await a.ring();
  await link(a, b); await b.cloud.join();
  assert.deepEqual(await device(w).rank.unlink(), { ok: false, why: 'unreached' }, '열쇠가 없는 기기');
  const kb = b.key();
  assert.deepEqual(await b.rank.unlink(), { ok: true });
  b.cloud.reset();
  assert.equal(b.key(), kb);
  assert.deepEqual([await a.rank.devices(), await b.rank.devices(), w.api.store.players.length], [1, 1, 2]);
  assert.deepEqual(await b.rank.unlink(), { ok: false, why: 'alone' });
  w.clock.t += 20000;
  b.app.records.runs = 50; b.cloud.touch(); await b.ring();
  assert.deepEqual([(await saved(w.api, b.key())).blob.records.runs, (await saved(w.api, a.key())).blob.records.runs], [50, 4]);
});

test('로컬 서버 · 자동화 브라우저 · fetch 없음: 한 건도 부르지 않고 저장에도 아무것도 안 쓴다', async () => {
  for (const opts of [{ host: 'localhost' }, { host: 'chainmate-git-x.vercel.app' }, { webdriver: true }, { fetch: null }]) {
    const w = world(), d = device(w, opts);
    assert.equal(d.cloud.on, false);
    d.app.records.runs = 5;
    await d.cloud.open();
    d.cloud.mark(); d.cloud.touch(); d.cloud.noteRunEnd(); d.cloud.noteSettings(); d.cloud.settle(); d.cloud.reset();
    await d.ring();
    await d.cloud.hidden(); await d.cloud.push(); await d.cloud.pull(); await d.cloud.join();
    assert.deepEqual(await d.rank.linkCode(), { ok: false, why: 'unreached' });
    assert.deepEqual(await d.rank.linkRedeem('12345678'), { ok: false, why: 'unreached' });
    assert.equal(await d.rank.devices(), null);
    assert.deepEqual(await d.rank.unlink(), { ok: false, why: 'unreached' });
    assert.equal(w.api.calls.length, 0, JSON.stringify(opts));
    assert.equal(d.timers.size, 0);
    assert.deepEqual([...d.storage.mem.keys()], [], '저장에 아무것도 쓰지 않는다');
    assert.deepEqual(d.cloud.status(), { at: 0, rev: 0 });
  }
});

test('열쇠 · 코드는 기록 보내기 · 콘솔 · 맞춤 상태 어디에도 없다 · save_sync는 하루 한 번 요약으로', async () => {
  const lines = [];
  const real = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  for (const k of Object.keys(real)) console[k] = (...x) => lines.push(x.map(String).join(' '));
  let a, b, w, code;
  try {
    w = world(); a = device(w); b = device(w);
    a.cloud.touch(); await a.ring();
    code = (await a.rank.linkCode()).code;
    b.app.records.runs = 1;
    await b.rank.linkRedeem(code); await b.cloud.join();
    await b.rank.linkRedeem('00000000');
    w.api.mode = 'fail';
    w.clock.t += 20000; b.app.records.runs = 2; b.cloud.touch(); await b.ring();
    await b.rank.unlink();
    w.api.mode = 'ok';
  } finally { Object.assign(console, real); }
  assert.deepEqual(lines, []);
  for (const d of [a, b]) {
    const all = JSON.stringify([d.tracked, d.state(), d.cloud.status(), d.rank.player()]);
    assert.ok(!all.includes(d.key()) && !all.includes(code));
  }
  assert.deepEqual(Object.keys(b.state()).sort(), ['at', 'rev', 'runAt', 'setAt', 'snap', 'sum']);
  // 그날에는 보내지 않고, 날이 바뀐 뒤 처음 맞출 때 지난 날의 수를 한 번 보낸다
  assert.deepEqual(b.tracked, []);
  assert.deepEqual(b.state().sum, { date: DATE, pulled: 1, pushed: 1, conflict: 0 });
  b.app.today = () => '2026-10-09';
  await b.cloud.open();
  assert.deepEqual(b.tracked, [['save_sync', { pulled: 1, pushed: 1, conflict: 0 }]]);
  await b.cloud.open(); await b.cloud.pull();
  assert.equal(b.tracked.length, 1);
});

// ── 앱에 물려서
async function liveApp({ api, storage = null }) {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { boot } = await import('../src/main.js');
  const d = makeFakeDom();
  const tel = [], timers = [];
  const w = d.window;
  if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  w.location = { hostname: HOST };
  w.fetch = (url, init) => { if (String(url).startsWith('/api/')) return api.fetch(url, init); tel.push(...JSON.parse(init.body).batch); return Promise.resolve({ ok: true, status: 200 }); };
  w.navigator = { sendBeacon: (url, body) => { tel.push(...JSON.parse(body).batch); return true; }, webdriver: false, userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' };
  w.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; w.clearTimeout = (id) => { timers[id - 1] = null; };
  const app = await boot({ window: w, document: d.document, today: () => DATE });
  app.records.kingDone = true; app.records.runs = 1;
  tick(app);
  await settle();
  // 올리기 타이머(15초 안쪽)만 울린다 — 기록 보내기 타이머는 그대로 둔다
  const ring = async () => { timers.forEach((t, i) => { if (t && t.ms <= PUSH_GAP && t.ms !== 10000) { timers[i] = null; t.fn(); } }); await settle(); };
  return { app, d, w, tel, ring, key: () => JSON.parse(w.localStorage.getItem(PLAYER_KEY)).key };
}
function playUntil(app, stop) {
  for (let guard = 0; guard < 5000 && app.run.phase !== 'lost' && app.run.phase !== 'won' && !stop(app.run); guard++) {
    const ph = app.run.phase;
    if (ph === 'draft') app.cmd({ type: 'joseki', index: 0 });
    else if (ph === 'select') app.cmd({ type: 'play' });
    else if (ph === 'battle') { for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), {})) break; }
    else if (ph === 'shop') app.cmd({ type: 'leave' });
    else if (ph === 'pack') app.cmd({ type: 'skipPack' });
  }
}

test('앱: 관 선택에 설 때 · 상점을 떠날 때 · 판이 끝날 때 올린다 — 판 저장에 저장한 때가 남고, 끝난 판은 서버에서도 비워진다', async () => {
  const { api } = world();
  const { app, w, ring, key } = await liveApp({ api });
  assert.deepEqual(api.calls.map((c) => c.path), ['/api/hello'], '켤 때는 배포 식별자만(열쇠가 아직 없다)');
  let touched = 0;
  const touch = app.cloud.touch;
  app.cloud.touch = () => { touched++; touch(); };
  const t0 = Date.now();
  app.newRun({ seed: 1000003 });
  assert.equal(touched, 0);
  app.cmd({ type: 'joseki', index: 0 });
  assert.deepEqual([app.run.phase, touched], ['select', 1], '관 선택에 섰다');
  const stored = () => JSON.parse(w.localStorage.getItem(KEYS.run));
  assert.ok(stored().updatedAt >= t0 && stored().updatedAt === app.run.updatedAt);
  await ring();
  assert.equal(api.store.players.length, 1, '처음 맞추는 때에 열쇠가 생긴다');
  const s1 = await saved(api, key());
  assert.deepEqual([s1.rev, s1.blob.run.seed, s1.blob.run.phase, s1.blob.runAt], [1, 1000003, 'select', stored().updatedAt]);
  // 대국 중의 명령은 맞추는 때가 아니다 — 다만 화면이 가려지면 그때의 판을 한 번 올린다
  app.cmd({ type: 'play' });
  assert.equal(await app.cloud.hidden(), true);
  const mid = await saved(api, key());
  assert.deepEqual([mid.rev, mid.blob.run.phase, mid.blob.runAt], [2, 'battle', app.run.updatedAt]);
  assert.equal(await app.cloud.hidden(), false, '달라진 것이 없으면 또 올리지 않는다');
  const n = touched;
  playUntil(app, (r) => r.phase !== 'battle');
  assert.ok(touched - n <= 1);
  playUntil(app, (r) => r.phase === 'shop');
  const m = touched;
  app.cmd({ type: 'leave' });
  assert.ok(touched > m, '상점을 떠났다');
  playUntil(app, () => false);
  const end = touched;
  assert.equal(w.localStorage.getItem(KEYS.run), null);
  app.goPhase(); tick(app, 3);
  assert.equal(app.screen.name, 'result');
  assert.ok(touched > end, '기록(판 수)이 적힌 뒤 한 번 더');
  w.setTimeout.now = true;
  await new Promise((r) => setTimeout(r, 5));
  app.cloud.touch = touch;
  // 15초가 지난 것처럼 곧바로 올린다
  await app.cloud.push();
  const s2 = await saved(api, key());
  assert.equal(s2.blob.run, null);
  assert.ok(s2.blob.runAt >= s1.blob.runAt);
  assert.equal(s2.blob.records.runs, app.records.runs);
  assert.ok(!('kingAgain' in s2.blob.records) && !('lastOpening' in s2.blob.records));
  assert.equal(app.toasts.length, 0, '맞추는 것은 화면에 드러나지 않는다');
  assert.equal(app.stats.errors, 0);
});

test('앱: 다른 기기의 더 늦은 판은 첫 화면의 「이어 하기」가 연다 — 대국 한가운데면 덮지 않고 첫 화면으로 돌아왔을 때', async () => {
  const { api } = world();
  const A = await liveApp({ api });
  A.app.newRun({ seed: 1000003 });
  A.app.cmd({ type: 'joseki', index: 0 });
  await A.ring();
  // B: 코드로 잇는다
  const B = await liveApp({ api });
  assert.equal(B.app.hasSave(), false);
  const code = await A.app.rank.linkCode();
  assert.equal((await B.app.rank.linkRedeem(code.code)).ok, true);
  await B.app.cloud.join();
  tick(B.app, 2);
  assert.equal(B.app.hasSave(), true);
  assert.ok(B.app.ui.regions.some((r) => r.id === 'title:continue'), '첫 화면에 「이어 하기」');
  assert.equal(B.app.continueRun(), true);
  assert.deepEqual([B.app.run.seed, B.app.run.phase, B.app.screen.name], [1000003, 'select', 'select']);
  assert.equal(B.app.rank.player().name, A.app.rank.player().name);
  // B가 대국을 열어 둔다 → 그 판이 올라간다. A는 그사이 대국 한가운데다
  A.app.continueRun();
  A.app.cmd({ type: 'play' });
  assert.equal(A.app.run.phase, 'battle');
  await new Promise((r) => setTimeout(r, 3));
  playUntil(B.app, (r) => r.phase === 'shop');
  B.app.cmd({ type: 'leave' });
  await B.app.cloud.push();
  const theirs = JSON.parse(B.w.localStorage.getItem(KEYS.run));
  assert.ok(theirs.updatedAt > JSON.parse(A.w.localStorage.getItem(KEYS.run)).updatedAt);
  const mine = A.w.localStorage.getItem(KEYS.run), live = A.app.run;
  await A.app.cloud.pull();
  tick(A.app, 2);
  assert.equal(A.w.localStorage.getItem(KEYS.run), mine, '대국 한가운데의 판은 그대로');
  assert.equal(A.app.run, live);
  assert.equal(A.app.screen.name, 'select');
  // 첫 화면으로 돌아오면 그 판이 「이어 하기」에
  A.app.toTitle(); tick(A.app, 2);
  assert.deepEqual(JSON.parse(A.w.localStorage.getItem(KEYS.run)), theirs);
  A.app.continueRun();
  assert.deepEqual([A.app.run.ante, A.app.run.blind, A.app.run.phase], [theirs.ante, theirs.blind, theirs.phase]);
  // 열쇠는 기록 보내기에 없다
  A.d.emit('pagehide'); B.d.emit('pagehide');
  await settle();
  const all = JSON.stringify([A.tel, B.tel]);
  assert.ok(!all.includes(A.key()) && !all.includes(B.key()) && !all.includes(code.code));
  assert.equal(nameText(1, 1), nameText(1, 1));
});

test('앱: 기기 잇기 화면으로 두 기기를 잇는다 — 코드 받기 → 숫자 넣기 → 확인 → 같은 이름 · 합쳐진 기록, 사건(link_code · link_redeem · link_unlink)에 열쇠 · 코드 · 이름이 없다', async () => {
  const { linkRedeemProps, saveSyncProps } = await import('../src/ui/telemetry.js');
  assert.deepEqual([linkRedeemProps({ ok: true, name: 'x', devices: 2 }), linkRedeemProps({ ok: false, why: 'expired' }), linkRedeemProps(null)], [{ ok: true, reason: null }, { ok: false, reason: 'expired' }, { ok: false, reason: 'unreached' }]);
  assert.deepEqual([saveSyncProps({ date: DATE, pulled: 2, pushed: 0, conflict: 1 }), saveSyncProps({ date: DATE, pulled: 0, pushed: 0, conflict: 0 }), saveSyncProps(null)], [{ pulled: 2, pushed: 0, conflict: 1 }, null, null]);
  const { api } = world();
  const A = await liveApp({ api }), B = await liveApp({ api });
  A.app.records.codex.maxims = { m1: true, m2: true }; A.app.records.runs = 6; A.app.saveRecords();
  const click = (x, id) => { tick(x.app, 1); const r = x.app.ui.regions.find((q) => q.id === id); assert.ok(r && r.enabled, id); r.onClick(); };
  // A: 설정 → 기기 잇기 → 코드 받기
  // 설정의 「계정」 단추는 계정 화면을 연다(CHM-72) — 탭 「기기 잇기」로 간다
  A.app.openOverlay('settings'); click(A, 'set:link');
  assert.equal(A.app.screen.name, 'account');
  click(A, 'acct:tab:link');
  assert.equal(A.app.screen.name, 'link');
  click(A, 'link:code'); await settle(); tick(A.app, 1);
  const code = A.app.screen.mine.code;
  assert.match(code, /^\d{8}$/);
  // B: 틀린 숫자 → 한 줄, 맞는 숫자 → 확인 → 이어졌다
  B.app.openOverlay('settings'); click(B, 'set:link'); click(B, 'acct:tab:link');
  for (const k of '00000000') B.app.key(k);
  B.app.key('Enter'); B.app.key('Enter'); await settle();
  assert.equal(B.app.screen.entry.fail, 'bad');
  for (const k of code) click(B, `link:key:${k}`);
  click(B, 'link:key:go'); click(B, 'link:yes'); await settle(24);
  const e = B.app.screen.entry;
  assert.deepEqual([e.phase, e.name, e.gain], ['done', A.app.rank.player().name, { codex: 2, openings: 0, runs: 5, ante: 0 }]);
  assert.equal(B.app.rank.player().name, A.app.rank.player().name);
  assert.deepEqual([B.app.records.runs, B.app.screen.devices], [6, 2]);
  // A: 띄워 둔 코드가 쓰인 것을 몇 초 안에 안다
  B.app.records.mates = 4; B.app.saveRecords(); await B.app.cloud.push();
  A.app.screen.update(5.1); await settle(24);
  assert.equal(A.app.screen.mine.phase, 'linked');
  A.app.screen.update(0.1); await settle(24);
  assert.equal(A.app.records.mates, 4, '그 기기의 기록을 당겨 왔다');
  assert.equal(A.app.screen.devices, 2);
  // B: 이 기기 떼기 → 확인
  click(B, 'link:unlink'); click(B, 'link:unlink:yes'); await settle();
  assert.deepEqual([B.app.screen.devices, api.store.players.length], [1, 2]);
  A.d.emit('pagehide'); B.d.emit('pagehide'); await settle();
  const names = (x) => x.tel.filter((q) => /^link_/.test(q.event)).map((q) => [q.event, q.properties.ok, q.properties.reason]);
  assert.deepEqual(names(A), [['link_code', undefined, undefined]]);
  assert.deepEqual(names(B), [['link_redeem', false, 'bad'], ['link_redeem', true, null], ['link_unlink', undefined, undefined]]);
  const all = JSON.stringify([A.tel, B.tel]);
  assert.ok(!all.includes(A.key()) && !all.includes(B.key()) && !all.includes(code) && !all.includes(A.app.rank.player().name));
  assert.equal(A.app.stats.errors + B.app.stats.errors, 0);
});
