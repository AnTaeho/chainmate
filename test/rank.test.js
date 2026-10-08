// 순위의 화면 쪽(CHM-70, src/ui/rank.js · docs/design-notes/leaderboard.md 「화면」): 열쇠 만들기 · 저장, 제출 조건, 새 배포(stale) · 망 실패 · 대기열,
// 순위표 캐시, 로컬 서버 · 자동화 브라우저에서 0건, 열쇠 · 이름이 로그 · 기록 보내기에 안 실리는가. 서버는 진짜 로직에 기억 저장소를 물린 가짜(helpers/fakeapi.js).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRank, PLAYER_KEY, QUEUE_KEY, CACHE_MS, RETRY_MS, shiftDate } from '../src/ui/rank.js';
import { rankSubmitProps } from '../src/ui/telemetry.js';
import { createDailyRun } from '../src/sim/daily.js';
import { nameText } from '../src/data/names.js';
import { summarize } from '../api/_lib/verify.js';
import { hashKey, LIMITS } from '../api/_lib/service.js';
import { playRun } from '../tools/shopbot.mjs';
import { stepBattle } from '../tools/bot.mjs';
import { fakeApi } from './helpers/fakeapi.js';
import { fakeStorage, HOST } from './helpers/telemetry.js';
import { installDom, tick } from './helpers/dom.js';
import { KEYS } from '../src/ui/save.js';

before(async () => { await installDom(); });
after(() => { delete globalThis.document; delete globalThis.window; });

const DATE = '2026-10-08';
const NOON = Date.parse(`${DATE}T12:00:00Z`);
const clone = (x) => JSON.parse(JSON.stringify(x));
// 봇이 둔 오늘의 대국 판(한 번만 둔다): { cmds, want }
const played = new Map();
function botDaily(date = DATE, policy = 'none') {
  const k = `${date}:${policy}`;
  if (!played.has(k)) { const run = createDailyRun(date); playRun(run, policy); played.set(k, { cmds: clone(run.cmds), want: summarize(run) }); }
  return played.get(k);
}
// 조건이 다 맞는 순위(배포 주소 · 자동화 아님). opts로 하나씩 어긋나게 한다
function fakeRank(opts = {}, shared = {}) {
  const clock = shared.clock || { t: NOON };
  const api = shared.api || fakeApi({ now: () => clock.t });
  const storage = shared.storage || fakeStorage();
  const rank = createRank({ fetch: api.fetch, storage, host: HOST, today: () => DATE, now: () => clock.t, ...opts });
  return { rank, api, storage, clock };
}
const stored = (storage, k = PLAYER_KEY) => JSON.parse(storage.getItem(k) || 'null');

test('열쇠: 처음 필요할 때 만들어 저장에 두고 다시 쓴다 — DB에는 해시만, 화면에는 이름만', async () => {
  const { rank, api, storage } = fakeRank();
  assert.equal(api.calls.length, 0, '만들기 전에는 아무것도 부르지 않는다');
  assert.equal(rank.player(), null);
  assert.equal(storage.getItem(PLAYER_KEY), null);
  const p = await rank.ensurePlayer();
  const s = stored(storage);
  assert.match(s.key, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(s).sort(), ['a', 'key', 'n']);
  assert.deepEqual([p.a, p.n, p.name, p.rerolls], [s.a, s.n, nameText(s.a, s.n, 'ko'), LIMITS.rerolls]);
  assert.ok(!('key' in p), '화면이 읽는 것에 열쇠는 없다');
  assert.equal(api.store.players.length, 1);
  assert.equal(api.store.players[0].keyHash, hashKey(s.key));
  assert.ok(!JSON.stringify(api.store.players).includes(s.key));
  // 또 불러도 새로 만들지 않는다
  await rank.ensurePlayer(); await rank.ensurePlayer();
  assert.deepEqual(api.named('/api/player').map((c) => c.body), [{}]);
  // 다음에 켜면: 저장의 열쇠로 한 번 물어 이름 · 남은 다시 짓기를 맞춘다
  const next = fakeRank({ lang: () => 'en' }, { api, storage });
  assert.equal(next.rank.player().name, nameText(s.a, s.n, 'en'), '서버에 묻기 전에도 저장의 이름을 보인다');
  assert.equal(next.rank.player().rerolls, null);
  await next.rank.ensurePlayer(); await next.rank.ensurePlayer();
  assert.deepEqual(api.named('/api/player').slice(1).map((c) => [c.body, c.auth]), [[{}, s.key]], '열쇠는 머리말로만(CHM-72)');
  assert.equal(next.rank.player().rerolls, LIMITS.rerolls);
  assert.equal(api.store.players.length, 1);
});

test('열쇠: 서버가 모르는 열쇠(401)면 새로 만든다 · 깨진 저장은 없는 것으로', async () => {
  const storage = fakeStorage();
  storage.setItem(PLAYER_KEY, JSON.stringify({ key: 'f'.repeat(64), a: 1, n: 2 }));
  const { rank, api } = fakeRank({}, { storage });
  assert.equal(rank.player().name, nameText(1, 2, 'ko'));
  await rank.ensurePlayer();
  const s = stored(storage);
  assert.notEqual(s.key, 'f'.repeat(64));
  assert.equal(api.store.players.length, 1);
  assert.equal(api.store.players[0].keyHash, hashKey(s.key));
  const broken = fakeStorage();
  broken.setItem(PLAYER_KEY, '{nope');
  const b = fakeRank({}, { storage: broken });
  assert.equal(b.rank.player(), null);
  await b.rank.ensurePlayer();
  assert.match(stored(broken).key, /^[0-9a-f]{64}$/);
});

test('다시 짓기: 이름이 바뀌어 저장에 남고 남은 횟수가 준다 · 한도를 넘으면 limit', async () => {
  const { rank, storage, api } = fakeRank();
  const p = await rank.ensurePlayer();
  const r = await rank.reroll();
  assert.equal(r.ok, true);
  const q = rank.player();
  assert.ok(q.a !== p.a || q.n !== p.n);
  assert.equal(r.name, q.name);
  assert.equal(q.rerolls, LIMITS.rerolls - 1);
  assert.deepEqual([stored(storage).a, stored(storage).n], [q.a, q.n]);
  for (let i = 1; i < LIMITS.rerolls; i++) assert.equal((await rank.reroll()).ok, true);
  assert.equal(rank.player().rerolls, 0);
  assert.deepEqual(await rank.reroll(), { ok: false, why: 'limit' });
  api.mode = 'fail';
  assert.deepEqual(await rank.reroll(), { ok: false, why: 'unreached' });
});

test('제출: 켤 때 받은 배포 식별자와 명령 줄을 내고, 서버가 다시 둔 등수와 내 둘레를 안다', async () => {
  const { rank, api, storage } = fakeRank();
  assert.equal(await rank.open(), true);
  assert.deepEqual(api.calls.map((c) => c.path), ['/api/hello']);
  assert.equal(rank.status(DATE).phase, 'none');
  const { cmds, want } = botDaily();
  const seen = [];
  rank.onResult = (date, st) => seen.push([date, st.phase]);
  const going = rank.submit(DATE, cmds);
  assert.equal(rank.status(DATE).phase, 'pending', '답이 오기 전에는 확인 중');
  const st = await going;
  assert.equal(st, rank.status(DATE));
  assert.deepEqual([st.phase, st.sent, st.improved, st.rank, st.total], ['ok', true, true, 1, 1]);
  assert.deepEqual([st.me.ante, st.me.blind, st.me.won, st.me.score], [want.ante, want.blind, want.won, want.score_total]);
  assert.deepEqual(st.around.map((r) => r.rank), [1]);
  assert.deepEqual(seen, [[DATE, 'ok']]);
  const sub = api.named('/api/daily/submit');
  assert.equal(sub.length, 1);
  assert.deepEqual(Object.keys(sub[0].body).sort(), ['build', 'cmds', 'date'], '열쇠는 본문에 없다(머리말로 — CHM-72)');
  assert.deepEqual([sub[0].body.build, sub[0].body.date, sub[0].auth], ['test-build', DATE, stored(storage).key]);
  assert.deepEqual(sub[0].body.cmds, cmds);
  assert.equal(storage.getItem(QUEUE_KEY), null);
  // 같은 줄을 또 내면 그대로(improved 거짓)
  const again = await rank.submit(DATE, cmds);
  assert.deepEqual([again.phase, again.improved, again.rank], ['ok', false, 1]);
  // 켤 때 hello가 실패했어도 낼 때 다시 받는다
  const late = fakeRank();
  late.api.mode = 'fail';
  assert.equal(await late.rank.open(), false);
  late.api.mode = 'ok';
  assert.equal((await late.rank.submit(DATE, cmds)).phase, 'ok');
});

test('제출: 저장의 열쇠를 서버가 모르면(401) 새로 만들어 한 번 더 낸다', async () => {
  const storage = fakeStorage();
  const first = fakeRank({}, { storage });
  await first.rank.ensurePlayer();
  // 서버 쪽 플레이어가 사라졌다(다른 DB)
  const { rank, api } = fakeRank({}, { storage });
  const st = await rank.submit(DATE, botDaily().cmds);
  assert.equal(st.phase, 'ok');
  assert.equal(api.store.players.length, 1);
  assert.equal(api.store.players[0].keyHash, hashKey(stored(storage).key));
});

test('새 배포(409 stale): 다시 보내지 않고 대기열에도 남기지 않는다 — 이 세션에서는 더 내지 않는다', async () => {
  const { rank, api, storage } = fakeRank();
  await rank.open();
  api.setBuild('next-build'); // 판을 두는 사이 새로 배포됐다
  const st = await rank.submit(DATE, botDaily().cmds);
  assert.equal(st.phase, 'stale');
  assert.equal(rank.stale(), true);
  assert.equal(api.named('/api/daily/submit').length, 1);
  assert.equal(storage.getItem(QUEUE_KEY), null);
  assert.equal(api.store.scores.length, 0);
  const n = api.calls.length;
  assert.equal((await rank.submit(DATE, botDaily().cmds)).phase, 'stale');
  assert.equal(await rank.retry(), null);
  assert.equal(api.calls.length, n, '그 뒤로는 한 건도 내지 않는다');
  assert.deepEqual(rankSubmitProps(st), { ok: false, improved: false, rank: null, total: null, stale: true });
});

test('망 실패: 한 건을 대기열에 남기고, 다음에 켤 때 한 번 더 보낸다 · 그날 것이 아니면 버린다', async () => {
  const { cmds } = botDaily();
  for (const mode of ['fail', 'html']) {
    const { rank, api, storage } = fakeRank();
    await rank.open();
    api.mode = mode;
    const st = await rank.submit(DATE, cmds);
    assert.equal(st.phase, 'unreached', mode);
    assert.deepEqual(stored(storage, QUEUE_KEY), { date: DATE, cmds });
    assert.equal(rank.queued(), DATE);
    assert.deepEqual(rankSubmitProps(st), { ok: false, improved: false, rank: null, total: null, stale: false });
    // 아직 끊겨 있으면 그대로 남는다
    assert.equal((await rank.retry()).phase, 'unreached');
    assert.equal(rank.queued(), DATE);
    // 다음에 켠다
    api.mode = 'ok';
    const next = fakeRank({}, { api, storage });
    await next.rank.open();
    assert.equal(next.rank.status(DATE).phase, 'ok');
    assert.equal(api.store.scores.length, 1);
    assert.equal(storage.getItem(QUEUE_KEY), null);
  }
  // 날이 바뀐 뒤에 켜면 버린다(한 건도 내지 않는다)
  const old = fakeRank();
  old.storage.setItem(QUEUE_KEY, JSON.stringify({ date: shiftDate(DATE, -1), cmds }));
  await old.rank.open();
  assert.equal(old.storage.getItem(QUEUE_KEY), null);
  assert.equal(old.api.named('/api/daily/submit').length, 0);
});

test('거절(422 · 429)은 조용히 버린다 — 대기열 없음, 앞서 낸 기록이 있으면 그 등수', async () => {
  const { rank, api, storage } = fakeRank();
  const { cmds } = botDaily();
  const bad = await rank.submit(DATE, cmds.slice(0, 10)); // 끝나지 않은 줄
  assert.equal(bad.phase, 'none');
  assert.equal(storage.getItem(QUEUE_KEY), null);
  assert.equal(rankSubmitProps(bad).ok, false);
  assert.equal((await rank.submit(DATE, cmds)).phase, 'ok');
  const forged = clone(cmds); forged[forged.findIndex((c) => c.type === 'drop')].handIndex = 30;
  const st = await rank.submit(DATE, forged);
  assert.deepEqual([st.phase, st.sent, st.improved, st.rank, st.total], ['ok', false, false, 1, 1]);
  assert.deepEqual(rankSubmitProps(st), { ok: false, improved: false, rank: null, total: null, stale: false });
  // 하루 제출 한도
  for (let i = api.store.players[0].sn; i < LIMITS.submits; i++) await rank.submit(DATE, cmds);
  const over = await rank.submit(DATE, cmds);
  assert.deepEqual([over.phase, over.sent, over.rank], ['ok', false, 1]);
  assert.equal(storage.getItem(QUEUE_KEY), null);
  assert.equal(api.store.scores.length, 1);
});

test('순위표: 같은 쪽은 30초 동안 다시 묻지 않는다 · 쪽 · 날짜마다 따로 · 낸 뒤에는 새로 묻는다', async () => {
  const { rank, api, clock } = fakeRank();
  const boards = () => api.named('/api/daily/board').length;
  const flush = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setImmediate(r)); };
  assert.deepEqual(rank.board(DATE, 1), { phase: 'loading', data: null });
  rank.board(DATE, 1); rank.board(DATE, 1);
  await flush();
  assert.equal(boards(), 1, '묻는 중에 또 그려도 한 번');
  const v = rank.board(DATE, 1);
  assert.equal(v.phase, 'ok');
  assert.deepEqual([v.data.total, v.data.page, v.data.pages, v.data.rows.length, v.data.me], [0, 1, 1, 0, null]);
  assert.ok(api.named('/api/daily/board')[0].auth, '내 줄을 받으려고 열쇠를 싣는다(순위 화면을 열 때 만든다)');
  assert.ok(api.calls.every((c) => !/[0-9a-f]{64}/.test(c.url) && !(c.body && c.body.key)), '열쇠는 주소 · 본문에 싣지 않는다(CHM-72)');
  clock.t += CACHE_MS - 1;
  rank.board(DATE, 1); await flush();
  assert.equal(boards(), 1);
  clock.t += 1;
  assert.equal(rank.board(DATE, 1).phase, 'ok', '다시 묻는 동안에도 앞의 것을 보인다');
  await flush();
  assert.equal(boards(), 2);
  rank.board(DATE, 2); rank.board(shiftDate(DATE, -1), 1); await flush();
  assert.equal(boards(), 4);
  assert.deepEqual(api.named('/api/daily/board').slice(2).map((c) => [c.query.date, c.query.page]), [[DATE, '2'], ['2026-10-07', '1']]);
  // 판을 내면 그날 쪽은 새로 묻는다(내 줄이 생겼다)
  await rank.submit(DATE, botDaily().cmds);
  const after = rank.board(DATE, 1);
  assert.equal(after.phase, 'ok');
  assert.equal(after.data.me.rank, 1);
  // 닿지 못하면: 한 줄 상태로 두고 5초 뒤에야 다시 묻는다
  const off = fakeRank();
  off.api.mode = 'fail';
  off.rank.board(DATE, 1); await flush();
  assert.equal(off.rank.board(DATE, 1).phase, 'unreached');
  const n = off.api.calls.length;
  off.rank.board(DATE, 1); await flush();
  assert.equal(off.api.calls.length, n);
  off.api.mode = 'ok'; off.clock.t += RETRY_MS;
  off.rank.board(DATE, 1); await flush();
  assert.equal(off.rank.board(DATE, 1).phase, 'ok');
});

test('로컬 서버 · 자동화 브라우저 · fetch 없음: 한 건도 부르지 않고 저장에도 아무것도 안 쓴다 — 화면에는 닿지 못함', async () => {
  const { cmds } = botDaily();
  for (const opts of [{ host: 'localhost' }, { host: '127.0.0.1' }, { host: 'chainmate-git-x.vercel.app' }, { webdriver: true }, { fetch: null }]) {
    const { rank, api, storage } = fakeRank(opts);
    assert.equal(rank.allowed, false, JSON.stringify(opts));
    assert.equal(await rank.open(), false);
    assert.equal(await rank.submit(DATE, cmds), null);
    assert.equal(await rank.ensurePlayer(), null);
    assert.deepEqual(await rank.reroll(), { ok: false, why: 'unreached' });
    assert.equal(await rank.retry(), null);
    assert.deepEqual(rank.board(DATE, 1), { phase: 'unreached', data: null });
    assert.equal(rank.status(DATE).phase, 'unreached');
    assert.equal(rank.player(), null);
    assert.equal(api.calls.length, 0, JSON.stringify(opts));
    assert.equal(rank.stats.requests, 0);
    assert.equal(storage.mem.size, 0);
  }
  // 저장에 열쇠가 있어도 닿지 못하는 곳에서는 이름을 보이지 않는다(설정 이름 줄도 없다)
  const s = fakeStorage();
  s.setItem(PLAYER_KEY, JSON.stringify({ key: 'a'.repeat(64), a: 0, n: 0 }));
  assert.equal(fakeRank({ host: 'localhost' }, { storage: s }).rank.player(), null);
  // 앱(Tauri)은 호스트와 상관없이 배포 주소를 부른다 · 도구가 준 base는 호스트 · webdriver 조건을 보지 않는다
  const urls = [];
  const spy = async (url) => { urls.push(url); throw new Error('net'); };
  await createRank({ fetch: spy, platform: 'app', host: 'tauri.localhost' }).open();
  await createRank({ fetch: spy, host: 'localhost', webdriver: true, base: 'http://localhost:3210' }).open();
  await createRank({ fetch: spy, host: HOST }).open();
  assert.deepEqual(urls, ['https://chainmate.papercut.kr/api/hello', 'http://localhost:3210/api/hello', '/api/hello']);
});

// ── 앱에 물려서: 오늘의 대국 판이 끝나는 순간 낸다
async function liveApp({ host = HOST, webdriver = false, storage = null } = {}) {
  const { makeFakeDom } = await import('../tools/fakedom.mjs');
  const { boot } = await import('../src/main.js');
  const d = makeFakeDom();
  const api = fakeApi({ now: () => NOON });
  const tel = [];
  const w = d.window;
  if (storage) for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, v);
  w.location = { hostname: host };
  w.fetch = (url, init) => {
    if (String(url).startsWith('/api/')) return api.fetch(url, init);
    tel.push(...JSON.parse(init.body).batch);
    return Promise.resolve({ ok: true, status: 200 });
  };
  w.navigator = { sendBeacon: (url, body) => { tel.push(...JSON.parse(body).batch); return true; }, webdriver, userAgent: 'Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36' };
  w.setTimeout = () => 0; w.clearTimeout = () => {};
  const app = await boot({ window: w, document: d.document, today: () => DATE });
  app.records.kingDone = true; app.records.runs = 1;
  tick(app);
  const events = () => { d.emit('pagehide'); return tel; };
  return { app, api, d, events };
}
const settle = async (n = 12) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
function playOut(app) {
  for (let guard = 0; guard < 5000 && app.run.phase !== 'lost' && app.run.phase !== 'won'; guard++) {
    const ph = app.run.phase;
    if (ph === 'draft') app.cmd({ type: 'joseki', index: 0 });
    else if (ph === 'select') app.cmd({ type: 'play' });
    else if (ph === 'battle') { for (let i = 0; i < 400 && app.run.phase === 'battle'; i++) if (!stepBattle(app.run.battle, (c) => app.cmd(c), {})) break; }
    else if (ph === 'shop') app.cmd({ type: 'leave' });
    else if (ph === 'pack') app.cmd({ type: 'skipPack' });
  }
}

test('앱: 오늘의 대국 판이 끝나면 넣은 명령 줄을 한 번 낸다 — 끝난 판의 저장은 지워져도 명령 줄은 나간다, 보통 판은 내지 않는다', async () => {
  const { app, api, d, events } = await liveApp();
  await settle();
  assert.deepEqual(api.calls.map((c) => c.path), ['/api/hello'], '켤 때 배포 식별자만 받는다');
  // 보통 판
  app.newRun({ seed: 1000003 });
  playOut(app);
  app.goPhase(); tick(app);
  await settle();
  assert.equal(api.named('/api/daily/submit').length, 0);
  assert.equal(api.store.players.length, 0, '순위가 필요하기 전에는 플레이어도 만들지 않는다');
  // 오늘의 대국
  app.newRun({ daily: true });
  assert.equal(app.run.daily, DATE);
  playOut(app);
  const cmds = clone(app.run.cmds), want = summarize(app.run);
  assert.equal(d.window.localStorage.getItem(KEYS.run), null, '끝난 판의 저장은 지워졌다');
  assert.equal(app.rank.status(DATE).phase, 'pending');
  app.goPhase(); tick(app);
  assert.equal(app.screen.name, 'result');
  await settle();
  const sub = api.named('/api/daily/submit');
  assert.equal(sub.length, 1);
  assert.deepEqual(sub[0].body.cmds, cmds);
  const st = app.rank.status(DATE);
  assert.deepEqual([st.phase, st.rank, st.total, st.me.score], ['ok', 1, 1, want.score_total]);
  tick(app);
  // 기록 보내기: rank_submit 한 번 — 등수만, 이름 · 열쇠는 없다
  const key = JSON.parse(d.window.localStorage.getItem(PLAYER_KEY)).key;
  const evs = events();
  const mine = evs.filter((e) => e.event === 'rank_submit');
  assert.equal(mine.length, 1);
  const p = mine[0].properties;
  assert.deepEqual([p.ok, p.improved, p.rank, p.total, p.stale], [true, true, 1, 1, false]);
  assert.ok(!JSON.stringify(evs).includes(key), '열쇠가 기록 보내기에 실리지 않는다');
  for (const e of evs.filter((x) => /^rank_|^name_/.test(x.event))) for (const k of Object.keys(e.properties)) assert.ok(!/^(key|name|a|n)$/.test(k), `${e.event}.${k}`);
});

test('앱: 내지 않는 판 — 수업(scratch) · 옛 저장(cmds 없음) · 끝없는 대국의 끝 · 보통 판', async () => {
  const { app, api } = await liveApp();
  await settle();
  const { cmds } = botDaily();
  assert.equal(app.submitDaily(null), null);
  assert.equal(app.submitDaily({ daily: DATE, cmds, scratch: true }), null);
  assert.equal(app.submitDaily({ daily: DATE }), null, '옛 저장');
  assert.equal(app.submitDaily({ daily: DATE, cmds, endless: true }), null);
  assert.equal(app.submitDaily({ daily: null, cmds }), null);
  await settle();
  assert.equal(api.named('/api/daily/submit').length, 0);
  assert.ok(app.submitDaily({ daily: DATE, cmds }) instanceof Promise);
  await settle();
  assert.equal(api.named('/api/daily/submit').length, 1);
});

test('앱: 로컬 서버 · 자동화 브라우저에서는 오늘의 대국을 끝내고 순위 화면을 열어도 /api로 0건 · 알림도 없다', async () => {
  for (const opts of [{ host: 'localhost' }, { webdriver: true }]) {
    const { app, api, d } = await liveApp(opts);
    app.newRun({ daily: true });
    playOut(app);
    app.goPhase(); tick(app, 4);
    assert.equal(app.screen.name, 'result');
    app.go('rank'); tick(app, 4);
    app.screen.setTab('yesterday'); tick(app, 4);
    app.openOverlay('settings'); tick(app, 4);
    await settle();
    assert.equal(api.calls.length, 0, JSON.stringify(opts));
    assert.equal(app.toasts.length, 0);
    assert.equal(app.stats.errors, 0);
    assert.equal(d.window.localStorage.getItem(PLAYER_KEY), null);
    assert.equal(d.window.localStorage.getItem(QUEUE_KEY), null);
  }
});

test('열쇠는 콘솔에도 찍히지 않는다(만들기 · 제출 · 실패 · 다시 짓기)', async () => {
  const lines = [];
  const real = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  for (const k of Object.keys(real)) console[k] = (...a) => lines.push(a.map(String).join(' '));
  let key;
  try {
    const { rank, api, storage } = fakeRank();
    await rank.open();
    await rank.submit(DATE, botDaily().cmds);
    await rank.reroll();
    api.mode = 'fail';
    await rank.submit(DATE, botDaily().cmds);
    await rank.reroll();
    key = stored(storage).key;
  } finally { Object.assign(console, real); }
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.deepEqual(lines, []);
});

test('기록 보내기 속성: 제출 결과에서 올랐나 · 등수만 뽑는다(이름 번호 · 열쇠 · 점수 없음)', () => {
  const st = { date: DATE, phase: 'ok', sent: true, improved: true, rank: 14, total: 312, me: { rank: 14, a: 3, n: 7, ante: 6, blind: 2, won: false, score: 233410 }, around: [] };
  assert.deepEqual(rankSubmitProps(st), { ok: true, improved: true, rank: 14, total: 312, stale: false });
  assert.equal(rankSubmitProps({ date: DATE, phase: 'pending' }), null);
  assert.equal(rankSubmitProps(null), null);
});
