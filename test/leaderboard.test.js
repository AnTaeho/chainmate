// 순위 서버 로직(CHM-70, api/_lib/service.js · http.js): 플레이어 만들기 · 다시 짓기 한도 · 제출의 처리 차례(열쇠 → 배포 → 날짜 → 한도 → 다시 두기)
// · 좋은 기록만 갈아 끼우기 · 순위표 쪽 넘김 · 내 위아래 · 출처 확인 · JSON 읽기. DB는 기억 저장소(test/helpers/memstore.js) — 진짜 SQL은 tools/daily-e2e.mjs가 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createService, LIMITS, hashKey, utcDate } from '../api/_lib/service.js';
import { route, routes, originOk, readJson } from '../api/_lib/http.js';
import { memStore } from './helpers/memstore.js';
import { createDailyRun } from '../src/sim/daily.js';
import { NAME_COUNT } from '../src/data/names.js';
import { playRun } from '../tools/shopbot.mjs';
import { summarize } from '../api/_lib/verify.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const NOW = Date.parse('2026-10-08T12:00:00Z');
function setup({ build = 'b1' } = {}) {
  const store = memStore();
  const clock = { ms: NOW };
  let k = 0;
  const svc = createService({ store, build, now: () => clock.ms, newKey: () => (++k).toString(16).padStart(64, '0') });
  return { store, svc, clock };
}
const logs = new Map();
function botLog(date, policy = 'none') {
  const key = `${date}:${policy}`;
  if (!logs.has(key)) { const run = createDailyRun(date); playRun(run, policy); logs.set(key, { cmds: clone(run.cmds), want: summarize(run) }); }
  return logs.get(key);
}
const DATE = '2026-10-08';

test('hello: 배포 식별자', async () => {
  const { svc } = setup({ build: 'dpl_x' });
  assert.deepEqual(await svc.hello(), { status: 200, body: { build: 'dpl_x' } });
});

test('플레이어: 새로 만들면 열쇠 · 이름 번호를 주고 DB에는 해시만 남는다, 열쇠로 다시 물으면 같은 이름', async () => {
  const { svc, store } = setup();
  const r = await svc.player({});
  assert.equal(r.status, 200);
  assert.match(r.body.key, /^[0-9a-f]{64}$/);
  assert.ok(Number.isInteger(r.body.a) && r.body.a >= 0 && r.body.a < NAME_COUNT.a);
  assert.ok(Number.isInteger(r.body.n) && r.body.n >= 0 && r.body.n < NAME_COUNT.n);
  assert.equal(r.body.rerolls, LIMITS.rerolls);
  assert.equal(store.players.length, 1);
  assert.equal(store.keys.get(hashKey(r.body.key)), store.players[0].id);
  assert.ok(!JSON.stringify([...store.keys]).includes(r.body.key));
  assert.ok(!JSON.stringify(store.players).includes(r.body.key));
  const again = await svc.player({ key: r.body.key });
  assert.deepEqual(again.body, r.body);
  assert.deepEqual(await svc.player({ key: 'f'.repeat(64) }), { status: 401, body: { error: 'unknown_key' } });
  for (const bad of [{ key: 'abc' }, { key: 5 }, { key: 'G'.repeat(64) }, { reroll: true }, { key: r.body.key, reroll: 'yes' }]) {
    assert.deepEqual(await svc.player(bad), { status: 400, body: { error: 'bad_request' } }, JSON.stringify(bad));
  }
});

test('플레이어 만들기 한도: 모두 합쳐 한 시간 2000명 — 넘으면 429 player_limit + retryAfter, 있는 열쇠로 읽기 · 다시 짓기는 그대로, 다음 시간에 다시 된다', async () => {
  const { svc, store, clock } = setup();
  assert.equal(LIMITS.playersAll, 2000);
  const first = (await svc.player({})).body;
  const hour = new Date(clock.ms).toISOString().slice(0, 13);
  assert.equal(store.limits.get(`playerall:0:${hour}`), 1, '만든 수를 전체 줄(who 0)에 센다');
  await svc.player({ key: first.key });
  assert.equal(store.limits.get(`playerall:0:${hour}`), 1, '읽기는 세지 않는다');
  store.limits.set(`playerall:0:${hour}`, LIMITS.playersAll - 1);
  assert.equal((await svc.player({})).status, 200, '2000번째까지 된다');
  clock.ms += 20 * 60000;
  const over = await svc.player({});
  assert.deepEqual(over, { status: 429, body: { error: 'player_limit', retryAfter: 40 * 60 } });
  assert.equal(store.players.length, 2, '넘은 요청은 플레이어를 만들지 않는다');
  assert.equal((await svc.player({ key: first.key })).status, 200);
  assert.equal((await svc.player({ key: first.key, reroll: true })).status, 200);
  clock.ms += 40 * 60000;
  assert.equal((await svc.player({})).status, 200, '다음 시간 창');
});

test('다시 짓기: 이름이 바뀌고, 하루 20번 뒤에는 429, 날이 바뀌면 다시 된다', async () => {
  const { svc, clock } = setup();
  const p = (await svc.player({})).body;
  let last = p;
  for (let i = 1; i <= LIMITS.rerolls; i++) {
    const r = await svc.player({ key: p.key, reroll: true });
    assert.equal(r.status, 200);
    assert.ok(r.body.a !== last.a || r.body.n !== last.n, '이름이 바뀐다');
    assert.equal(r.body.rerolls, LIMITS.rerolls - i);
    last = r.body;
  }
  assert.deepEqual(await svc.player({ key: p.key, reroll: true }), { status: 429, body: { error: 'reroll_limit' } });
  assert.equal((await svc.player({ key: p.key })).body.rerolls, 0);
  clock.ms += 86400000;
  assert.equal((await svc.player({ key: p.key })).body.rerolls, LIMITS.rerolls);
  assert.equal((await svc.player({ key: p.key, reroll: true })).status, 200);
});

test('제출: 서버가 다시 둔 성적이 오르고, 같은 줄을 또 내면 improved가 거짓, 더 좋은 판만 갈아 끼운다', async () => {
  const { svc, store } = setup();
  const p = (await svc.player({})).body;
  const weak = botLog(DATE, 'none'), strong = botLog(DATE, 'random');
  const first = await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds: weak.cmds });
  assert.equal(first.status, 200);
  const best = (w) => ({ ante: w.ante, blind: w.blind, won: w.won, score: w.score_total, battles: w.battles, moves: w.moves, ignite: w.ignite });
  assert.deepEqual(first.body, { ok: true, best: best(weak.want), rank: 1, total: 1, improved: true });
  assert.equal(store.logs.get('1:2026-10-08'), JSON.stringify(weak.cmds));
  const same = await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds: weak.cmds });
  assert.deepEqual(same.body, { ...first.body, improved: false });
  // 두 판 가운데 줄 세우기에서 위인 쪽이 남는다
  const [hi, lo] = [weak, strong].sort((x, y) => (y.want.ante - x.want.ante) || (y.want.blind - x.want.blind) || (y.want.score_total - x.want.score_total));
  assert.notDeepEqual(best(hi.want), best(lo.want));
  for (const log of [strong, weak, strong]) {
    const r = await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds: log.cmds });
    assert.deepEqual(r.body.best, best(hi.want));
    assert.equal(r.body.total, 1);
  }
  assert.equal(store.scores.length, 1);
  assert.equal(store.logs.get('1:2026-10-08'), JSON.stringify(hi.cmds));
});

test('제출: 클라이언트가 말한 점수는 받지 않는다(딴 칸은 무시), 조작한 줄 · 진행 중인 줄은 422', async () => {
  const { svc, store } = setup();
  const p = (await svc.player({})).body;
  const { cmds, want } = botLog(DATE);
  const forged = cmds.filter((_, i) => i !== 1);
  const bad = await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds: forged });
  assert.equal(bad.status, 422);
  assert.ok(['bad_cmd', 'unfinished'].includes(bad.body.error));
  assert.deepEqual(await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds: cmds.slice(0, 5) }), { status: 422, body: { error: 'unfinished', at: 5 } });
  assert.deepEqual(await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds: [{ type: 'joseki', index: 0 }, { type: 'buy', slot: 0 }] }), { status: 422, body: { error: 'bad_cmd', at: 1 } });
  assert.equal(store.scores.length, 0);
  const r = await svc.submit({ key: p.key, date: DATE, build: 'b1', cmds, score: 1e15, ante: 8, won: true, score_total: 1e15 });
  assert.equal(r.body.best.score, want.score_total);
  assert.equal(r.body.best.won, false);
});

test('제출의 처리 차례: 꼴 400 → 모르는 열쇠 401 → 배포가 다르면 409 stale → 날짜 ±1일 밖 422 → 하루 30번 뒤 429', async () => {
  const { svc, clock, store } = setup();
  const p = (await svc.player({})).body;
  const { cmds } = botLog(DATE);
  const ok = { key: p.key, date: DATE, build: 'b1', cmds };
  for (const bad of [null, {}, { ...ok, key: 'x' }, { ...ok, cmds: 'no' }, { ...ok, build: 3 }, { ...ok, build: 'x'.repeat(101) }]) {
    assert.deepEqual(await svc.submit(bad), { status: 400, body: { error: 'bad_request' } });
  }
  assert.deepEqual(await svc.submit({ ...ok, cmds: Array(LIMITS.cmds + 1).fill({ type: 'play' }) }), { status: 413, body: { error: 'too_many_cmds' } });
  assert.deepEqual(await svc.submit({ ...ok, key: 'e'.repeat(64), build: 'old' }), { status: 401, body: { error: 'unknown_key' } });
  assert.deepEqual(await svc.submit({ ...ok, build: 'old', date: '1999-01-01' }), { status: 409, body: { error: 'stale', stale: true, build: 'b1' } });
  for (const d of ['2026-10-06', '2026-10-10', '2026-1-1', 'today', null]) assert.deepEqual(await svc.submit({ ...ok, date: d }), { status: 422, body: { error: 'bad_date' } }, String(d));
  // 여기까지는 하루 한도를 쓰지 않았다
  assert.equal(store.players[0].sn, 0);
  // 어제 · 내일 날짜는 받는다(시간대) — 그날의 판으로 다시 두니 오늘 판의 줄은 맞지 않는다
  for (const d of ['2026-10-07', '2026-10-09']) assert.equal((await svc.submit({ ...ok, date: d })).status, 422);
  assert.equal(store.players[0].sn, 2);
  for (let i = 2; i < LIMITS.submits; i++) assert.equal((await svc.submit(ok)).status, 200);
  assert.deepEqual(await svc.submit(ok), { status: 429, body: { error: 'submit_limit' } });
  // 조작한 줄도 한도를 쓴다(다시 두기 앞에서 센다), 날이 바뀌면(UTC) 다시 받는다
  clock.ms += 86400000;
  assert.equal(utcDate(clock.ms), '2026-10-09');
  assert.equal((await svc.submit(ok)).status, 200);
});

test('순위표: 10줄씩 쪽 넘김, 줄 세우기(관 → 대국 → 승패 → 점수 합 → 먼저 낸 사람), 내 줄과 위아래 둘씩, 구경은 열쇠 없이', async () => {
  const { svc, store } = setup();
  // 23명: 저장소에 성적을 바로 넣는다(다시 두기는 위 시험이 본다)
  const keys = [];
  for (let i = 0; i < 23; i++) {
    const p = (await svc.player({})).body;
    keys.push(p.key);
    const id = String(i + 1);
    await store.putScore(id, DATE, { ante: 1 + (i % 4), blind: i % 3, won: false, score_total: 1000 - i * 7, battles: 3, moves: 9, ignite: null }, 'b1', '[]');
  }
  await store.putScore('5', DATE, { ante: 8, blind: 2, won: true, score_total: 5, battles: 24, moves: 60, ignite: 4 }, 'b1', '[]');
  await store.putScore('6', DATE, { ante: 8, blind: 2, won: false, score_total: 9e9, battles: 24, moves: 60, ignite: 4 }, 'b1', '[]');
  await store.putScore('7', '2026-10-07', { ante: 2, blind: 0, won: false, score_total: 50, battles: 3, moves: 9, ignite: null }, 'b1', '[]');
  const p1 = (await svc.board({ date: DATE })).body;
  assert.deepEqual([p1.date, p1.total, p1.page, p1.pages, p1.rows.length, p1.me, p1.around], [DATE, 23, 1, 3, 10, null, []]);
  assert.deepEqual(Object.keys(p1.rows[0]), ['rank', 'a', 'n', 'ante', 'blind', 'won', 'score']);
  assert.deepEqual([p1.rows[0].rank, p1.rows[0].won, p1.rows[0].score], [1, true, 5]);      // 8관 우승이 맨 위(점수 합이 작아도)
  assert.deepEqual([p1.rows[1].rank, p1.rows[1].won, p1.rows[1].score], [2, false, 9e9]);
  const all = [];
  for (const page of ['1', '2', '3']) all.push(...(await svc.board({ date: DATE, page })).body.rows);
  assert.deepEqual(all.map((r) => r.rank), Array.from({ length: 23 }, (_, i) => i + 1));
  for (let i = 1; i < all.length; i++) {
    const x = all[i - 1], y = all[i];
    const kx = [x.ante, x.blind, x.won ? 1 : 0, x.score], ky = [y.ante, y.blind, y.won ? 1 : 0, y.score];
    const d = kx.map((v, k) => v - ky[k]).find((v) => v !== 0) ?? 0;
    assert.ok(d >= 0, `${i}등과 ${i + 1}등의 차례`);
  }
  assert.equal((await svc.board({ date: DATE, page: '3' })).body.rows.length, 3);
  assert.deepEqual((await svc.board({ date: DATE, page: '9' })).body.rows, []);
  // 내 줄 · 위아래
  const mine = (await svc.board({ date: DATE, page: '1', key: keys[4] })).body;
  assert.equal(mine.me.rank, 1);
  assert.deepEqual(mine.around.map((r) => r.rank), [1, 2, 3]);
  let mid = null;
  for (const k of keys) { const b = (await svc.board({ date: DATE, key: k })).body; if (b.me.rank === 12) mid = b; if (b.me.rank === 23) assert.deepEqual(b.around.map((r) => r.rank), [21, 22, 23]); }
  assert.deepEqual(mid.around.map((r) => r.rank), [mid.me.rank - 2, mid.me.rank - 1, mid.me.rank, mid.me.rank + 1, mid.me.rank + 2]);
  assert.deepEqual(mid.around[2], mid.me);
  // 다른 날 · 기록 없는 사람 · 모르는 열쇠는 구경
  const y = (await svc.board({ date: '2026-10-07', key: keys[0] })).body;
  assert.deepEqual([y.total, y.rows.length, y.me, y.around], [1, 1, null, []]);
  assert.equal((await svc.board({ date: DATE, key: 'e'.repeat(64) })).body.me, null);
  assert.equal((await svc.board({})).body.date, DATE);
  assert.deepEqual([(await svc.board({ date: '2020-01-01' })).body.total, (await svc.board({ date: '2020-01-01' })).body.pages], [0, 1]);
  for (const bad of [{ date: 'x' }, { date: '2026-10-10' }, { page: '0' }, { page: '-1' }, { page: 'a' }, { key: 'zz' }]) assert.equal((await svc.board(bad)).status, 400, JSON.stringify(bad));
  // 응답에 열쇠 · 해시 · 플레이어 번호가 없다
  const text = JSON.stringify([p1, mine, mid]);
  for (const k of keys) { assert.ok(!text.includes(k)); assert.ok(!text.includes(hashKey(k))); }
});

// ── HTTP 껍데기
const req = (url, { method = 'GET', headers = {}, body = undefined } = {}) => new Request(url, { method, headers, body });
const fake = () => {
  const { svc } = setup({ build: 'dpl_t' });
  return svc;
};

test('출처: Origin이 없거나 같은 호스트면 받고, 다른 출처는 403(허용 목록에 있으면 CORS 머리와 함께)', async () => {
  assert.equal(originOk(req('https://chainmate.papercut.kr/api/hello')).ok, true);
  assert.equal(originOk(req('https://chainmate.papercut.kr/api/hello', { headers: { origin: 'https://chainmate.papercut.kr' } })).ok, true);
  assert.equal(originOk(req('https://x.vercel.app/api/hello', { headers: { origin: 'https://x.vercel.app' } })).ok, true);
  assert.equal(originOk(req('https://chainmate.papercut.kr/api/hello', { headers: { origin: 'https://evil.example' } })).ok, false);
  assert.equal(originOk(req('https://chainmate.papercut.kr/api/hello', { headers: { origin: 'null' } })).ok, false);
  assert.deepEqual(originOk(req('https://chainmate.papercut.kr/api/hello', { headers: { origin: 'tauri://localhost' } }), ['tauri://localhost']),
    { ok: true, cors: { 'Access-Control-Allow-Origin': 'tauri://localhost', Vary: 'Origin' } });
  const h = route('GET', (s) => s.hello(), fake);
  // 앱(Tauri) 출처 둘은 받는다: 답과 사전 요청에 그 출처를 돌려주고, 열쇠 머리말을 허용한다. 닮은 출처는 막는다
  for (const origin of ['tauri://localhost', 'http://tauri.localhost']) {
    const got = await h.GET(req('https://chainmate.papercut.kr/api/hello', { headers: { origin } }));
    assert.deepEqual([got.status, got.headers.get('access-control-allow-origin'), got.headers.get('vary')], [200, origin, 'Origin'], origin);
    const pre = await h.OPTIONS(req('https://chainmate.papercut.kr/api/hello', { method: 'OPTIONS', headers: { origin } }));
    assert.deepEqual([pre.status, pre.headers.get('access-control-allow-origin')], [204, origin], origin);
    assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
  }
  for (const origin of ['https://tauri.localhost', 'tauri://localhost.evil.example', 'http://tauri.localhost:8080', 'http://127.0.0.1:1430']) {
    assert.equal(originOk(req('https://chainmate.papercut.kr/api/hello', { headers: { origin } })).ok, false, origin);
  }
  const res = await h.GET(req('https://chainmate.papercut.kr/api/hello', { headers: { origin: 'https://evil.example' } }));
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'bad_origin' });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  assert.equal((await h.OPTIONS(req('https://a.b/api/hello', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await h.OPTIONS(req('https://a.b/api/hello', { method: 'OPTIONS', headers: { origin: 'https://a.b' } }))).status, 204);
});

test('함수: GET은 주소의 물음을, POST는 JSON 본문만 받는다 — JSON 아님 415 · 깨진 JSON 400 · 256KB 넘으면 413', async () => {
  const hello = route('GET', (s) => s.hello(), fake);
  const ok = await hello.GET(req('https://a.b/api/hello'));
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('content-type'), /^application\/json/);
  assert.equal(ok.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await ok.json(), { build: 'dpl_t' });
  const board = route('GET', (s, q) => s.board(q), fake);
  assert.deepEqual((await (await board.GET(req('https://a.b/api/daily/board?date=2026-10-08&page=2'))).json()).page, 2);
  assert.equal((await board.GET(req('https://a.b/api/daily/board?page=x'))).status, 400);
  const player = route('POST', (s, b) => s.player(b), fake);
  const post = (body, type = 'application/json') => player.POST(req('https://a.b/api/player', { method: 'POST', headers: type ? { 'content-type': type } : {}, body }));
  assert.equal((await post('{}')).status, 200);
  assert.equal((await post('{}', 'application/json; charset=utf-8')).status, 200);
  assert.deepEqual([(await post('{}', 'text/plain')).status, (await post('a=1', 'application/x-www-form-urlencoded')).status], [415, 415]);
  assert.deepEqual(await (await post('{nope')).json(), { error: 'bad_json' });
  for (const b of ['[]', '1', 'null', '"x"']) assert.deepEqual(await (await post(b)).json(), { error: 'bad_request' });
  const big = await post(JSON.stringify({ pad: 'x'.repeat(LIMITS.body) }));
  assert.equal(big.status, 413);
  assert.deepEqual(await big.json(), { error: 'too_large' });
  assert.deepEqual(await readJson(req('https://a.b/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' })), { body: { a: 1 } });
});

test('함수: 안에서 난 오류는 500 { error: server }뿐 — 내부 메시지를 싣지 않는다', async () => {
  const boom = route('GET', () => { throw new Error('connection string postgres://secret'); }, fake);
  const keep = console.error;
  const seen = [];
  console.error = (...a) => seen.push(a);
  let res;
  try { res = await boom.GET(req('https://a.b/api/hello')); } finally { console.error = keep; }
  assert.equal(res.status, 500);
  assert.equal(await res.text(), '{"error":"server"}');
  assert.equal(seen.length, 1);
});

test('함수: 길 표(routes)는 주소의 마지막 조각으로 고른다 — 모르는 조각 404 not_found · 다른 출처 403 · 한도와 OPTIONS는 route와 같다', async () => {
  const seen = [];
  const h = routes('POST', { one: (s, b) => { seen.push(['one', b]); return { status: 200, body: { hit: 'one' } }; }, two: (s, b) => { seen.push(['two', b]); return { status: 200, body: { hit: 'two' } }; } }, fake, { limit: 64 });
  const post = (path, body = '{}', headers = {}) => h.POST(req(`https://a.b${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body }));
  assert.deepEqual(Object.keys(h).sort(), ['OPTIONS', 'POST']);
  assert.deepEqual(await (await post('/api/x/one', '{"a":1}')).json(), { hit: 'one' });
  assert.deepEqual(await (await post('/api/x/two?action=one', '{}', { authorization: `Bearer ${'a'.repeat(64)}` })).json(), { hit: 'two' });
  assert.deepEqual(seen, [['one', { a: 1 }], ['two', { key: 'a'.repeat(64) }]], '주소의 물음은 입력에 섞이지 않는다');
  for (const path of ['/api/x/nope', '/api/x', '/api/x/toString', '/api/x/constructor']) {
    const miss = await post(path);
    assert.deepEqual([miss.status, await miss.json()], [404, { error: 'not_found' }], path);
  }
  assert.equal((await post('/api/x/nope', '{}', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/x/one', '{}', { origin: 'https://evil.example' })).status, 403);
  assert.equal((await post('/api/x/one', JSON.stringify({ pad: 'x'.repeat(64) }))).status, 413);
  assert.equal((await post('/api/x/one', '{}', { 'content-type': 'text/plain' })).status, 415);
  const pre = await h.OPTIONS(req('https://a.b/api/x/one', { method: 'OPTIONS', headers: { origin: 'https://a.b' } }));
  assert.deepEqual([pre.status, pre.headers.get('access-control-allow-methods')], [204, 'POST, OPTIONS']);
  assert.equal(seen.length, 2);
});

test('배포: api/ 아래 함수 파일(_lib 밖 .js)은 12개까지 — Vercel Hobby 요금제의 배포당 한도', () => {
  const root = new URL('../api/', import.meta.url);
  const files = fs.readdirSync(root, { recursive: true }).map(String).filter((f) => f.endsWith('.js') && !f.split(/[\\/]/).includes('_lib'));
  assert.ok(files.length > 0 && files.length <= 12, `함수 ${files.length}개: ${files.sort().join(', ')}`);
});

test('옛 칸 걷기(tools/db-migrate.mjs oldKeyColumn): 기본은 not null만 풀고, --drop-old-key는 칸을 지운다 — 옛 칸이 있는 DB · 푼 DB · 없는 DB 모두 두 번 돌려 같다', async () => {
  const { oldKeyColumn, OLD_KEY_LINE } = await import('../tools/db-migrate.mjs');
  // 가짜 DB: players.key_hash 칸의 상태만 안다
  const fakeDb = (col) => {
    const db = { col, ran: [] };
    db.sql = async (text) => {
      if (/information_schema\.columns/.test(text)) return db.col ? [{ is_nullable: db.col.nullable ? 'YES' : 'NO' }] : [];
      db.ran.push(text);
      if (/alter column key_hash drop not null/.test(text)) db.col.nullable = true;
      else if (/drop column if exists key_hash/.test(text)) db.col = null;
      else throw new Error(`모르는 문장: ${text}`);
      return [];
    };
    return db;
  };
  const old = fakeDb({ nullable: false });
  assert.equal(await oldKeyColumn(old.sql), 'loose');
  assert.deepEqual(old.ran, ['alter table players alter column key_hash drop not null']);
  assert.equal(await oldKeyColumn(old.sql), 'loose');
  assert.equal(old.ran.length, 1, '두 번째에는 아무것도 하지 않는다');
  assert.equal(await oldKeyColumn(old.sql, { drop: true }), 'dropped');
  assert.equal(old.col, null);
  assert.equal(await oldKeyColumn(old.sql, { drop: true }), 'gone');
  assert.equal(await oldKeyColumn(old.sql), 'gone');
  assert.equal(old.ran.length, 2, '칸이 없는 DB에는 아무것도 하지 않는다');
  assert.deepEqual(Object.keys(OLD_KEY_LINE).sort(), ['dropped', 'gone', 'loose']);
  // 코드 · 스키마가 옛 칸을 더는 가리키지 않는다
  const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
  assert.ok(!/create table if not exists players \([^;]*key_hash/.test(schema), 'schema.sql의 players에 key_hash가 없다');
  const storeText = fs.readFileSync(new URL('../api/_lib/store.js', import.meta.url), 'utf8');
  assert.ok(!/into players \(key_hash|players set key_hash|from players where key_hash/.test(storeText), 'store.js가 옛 칸을 읽거나 쓰지 않는다');
});
