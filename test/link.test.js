// 기기 잇기 · 클라우드 저장 서버 로직(CHM-71, api/_lib/service.js · http.js): 코드 발급 · 무효 · 만료 · 한도 · 전체 잠금, 코드를 넣은 뒤 열쇠 둘이 같은 플레이어,
// 순위 성적 합침(낸 차례 그대로), 떼기, 저장 rev 충돌 · 꼴 · 한도. DB는 기억 저장소 — 진짜 SQL은 tools/link-e2e.mjs가 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService, LIMITS, hashKey, hashCode, blobOk } from '../api/_lib/service.js';
import { route } from '../api/_lib/http.js';
import { memStore } from './helpers/memstore.js';
import { emptyRecords } from '../src/ui/records.js';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const DATE = '2026-10-08', YEST = '2026-10-07';
function setup() {
  const store = memStore();
  const clock = { ms: NOW };
  let k = 0, c = 0;
  const codes = [];
  const svc = createService({ store, build: 'b1', now: () => clock.ms, newKey: () => (++k).toString(16).padStart(64, '0'), newCode: () => { const code = codes.length ? codes.shift() : String(10000000 + ++c); return code; } });
  const player = async () => (await svc.player({})).body;
  return { store, svc, clock, codes, player };
}
const E = (status, error, more = {}) => ({ status, body: { error, ...more } });
const score = (ante, blind = 0, won = false, total = ante * 100) => ({ ante, blind, won, score_total: total, battles: ante, moves: ante * 3, ignite: null });
const blob = (more = {}) => ({ v: 1, records: { ...emptyRecords(), runs: 1 }, run: null, runAt: 0, ...more });

test('코드 받기: 숫자 여덟 자리 · 10분 · DB에는 해시만 · 새로 받으면 앞의 코드는 무효 · 하루 10번', async () => {
  const { svc, store, player, clock } = setup();
  const a = await player(), b = await player();
  const r = await svc.linkCode({ key: a.key });
  assert.equal(r.status, 200);
  assert.match(r.body.code, /^\d{8}$/);
  assert.deepEqual([r.body.expiresAt, r.body.ttl], [NOW + LIMITS.codeTtl, 600000]);
  assert.deepEqual([...store.codes.keys()], [hashCode(r.body.code)]);
  assert.ok(!JSON.stringify([...store.codes]).includes(r.body.code), '코드 원문은 남지 않는다');
  const r2 = await svc.linkCode({ key: a.key });
  assert.notEqual(r2.body.code, r.body.code);
  assert.equal(store.codes.size, 1, '앞의 코드는 지워진다');
  assert.deepEqual(await svc.linkRedeem({ key: b.key, code: r.body.code }), E(404, 'bad_code'));
  for (let i = 2; i < LIMITS.codes; i++) assert.equal((await svc.linkCode({ key: a.key })).status, 200);
  assert.deepEqual(await svc.linkCode({ key: a.key }), E(429, 'code_limit'));
  assert.equal((await svc.linkCode({ key: b.key })).status, 200, '한도는 플레이어마다');
  clock.ms += 86400000;
  assert.equal((await svc.linkCode({ key: a.key })).status, 200, '날이 바뀌면 다시 된다');
  assert.deepEqual(await svc.linkCode({ key: 'f'.repeat(64) }), E(401, 'unknown_key'));
  assert.deepEqual(await svc.linkCode({}), E(400, 'bad_request'));
});

test('코드 받기: 살아 있는 남의 코드와 겹치면 다른 숫자를 뽑는다', async () => {
  const { svc, player, codes } = setup();
  const a = await player(), b = await player();
  codes.push('11112222', '11112222', '33334444');
  assert.equal((await svc.linkCode({ key: a.key })).body.code, '11112222');
  assert.equal((await svc.linkCode({ key: b.key })).body.code, '33334444');
});

test('코드 넣기: 넣은 기기가 코드를 낸 플레이어가 된다 — 새 열쇠 · 같은 이름 · 열쇠 둘 · 옛 플레이어와 옛 열쇠는 사라진다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player();
  assert.deepEqual((await svc.linkDevices({ key: a.key })).body, { devices: 1 });
  const { code } = (await svc.linkCode({ key: a.key })).body;
  const r = await svc.linkRedeem({ key: b.key, code });
  assert.equal(r.status, 200);
  assert.match(r.body.key, /^[0-9a-f]{64}$/);
  assert.ok(r.body.key !== a.key && r.body.key !== b.key, '서버는 A의 열쇠 원문을 모른다 — B에게 새 열쇠를 붙인다');
  assert.deepEqual([r.body.a, r.body.n, r.body.devices], [a.a, a.n, 2]);
  assert.equal(store.players.length, 1);
  assert.deepEqual([...store.keys.keys()].sort(), [hashKey(a.key), hashKey(r.body.key)].sort());
  assert.ok(!JSON.stringify([...store.keys]).includes(r.body.key), 'DB에는 해시만');
  const pa = (await svc.player({ key: a.key })).body, pb = (await svc.player({ key: r.body.key })).body;
  assert.deepEqual([pa.a, pa.n], [pb.a, pb.n]);
  assert.deepEqual(await svc.player({ key: b.key }), E(401, 'unknown_key'));
  assert.deepEqual((await svc.linkDevices({ key: r.body.key })).body, { devices: 2 });
  // 한 번만 쓸 수 있다
  const c = await player();
  assert.deepEqual(await svc.linkRedeem({ key: c.key, code }), E(404, 'bad_code'));
  // 이름을 다시 지으면 두 기기에서 같이 바뀐다
  const re = (await svc.player({ key: r.body.key, reroll: true })).body;
  assert.deepEqual([(await svc.player({ key: a.key })).body.a, (await svc.player({ key: a.key })).body.n], [re.a, re.n]);
});

test('코드 넣기: 틀린 코드 404 · 시간 지남 410 · 자기 코드 400 · 꼴 400 · 모르는 열쇠 401', async () => {
  const { svc, player, clock, store } = setup();
  const a = await player(), b = await player();
  const { code } = (await svc.linkCode({ key: a.key })).body;
  assert.deepEqual(await svc.linkRedeem({ key: a.key, code }), E(400, 'self'));
  assert.deepEqual(await svc.linkRedeem({ key: b.key, code: '00000000' }), E(404, 'bad_code'));
  for (const bad of [{ key: b.key }, { key: b.key, code: 12345678 }, { key: b.key, code: '1234567' }, { key: b.key, code: '1234 5678' }, { key: 'x', code }, {}]) assert.deepEqual(await svc.linkRedeem(bad), E(400, 'bad_request'), JSON.stringify(bad));
  assert.deepEqual(await svc.linkRedeem({ key: 'f'.repeat(64), code }), E(401, 'unknown_key'));
  clock.ms += LIMITS.codeTtl - 1;
  assert.equal(store.players.length, 2);
  clock.ms += 1;
  assert.deepEqual(await svc.linkRedeem({ key: b.key, code }), E(410, 'expired'));
  assert.equal(store.players.length, 2, '시간이 지난 코드로는 아무것도 합치지 않는다');
  // 틀린 것으로 세는 것은 둘(없는 코드 · 지난 코드)뿐 — 자기 코드 · 꼴 · 모르는 열쇠는 세지 않는다
  assert.equal(await store.peek('redeem', store.keys.get(hashKey(b.key)), new Date(clock.ms).toISOString().slice(0, 13)), 2);
});

test('코드 넣기 한도: 열쇠마다 한 시간에 10번 틀리면 429 · 모두 합쳐 10분에 500번 틀리면 그 10분 동안 잠근다', async () => {
  const { svc, player, clock, store } = setup();
  const a = await player(), b = await player();
  for (let i = 0; i < LIMITS.redeemFails; i++) assert.deepEqual(await svc.linkRedeem({ key: b.key, code: '00000000' }), E(404, 'bad_code'));
  const { code } = (await svc.linkCode({ key: a.key })).body;
  assert.deepEqual(await svc.linkRedeem({ key: b.key, code }), E(429, 'redeem_limit'), '맞는 코드도 한도 안에서는 받지 않는다');
  clock.ms += 3600000;
  assert.deepEqual(await svc.linkRedeem({ key: b.key, code }), E(410, 'expired'));
  // 전체 잠금: 여러 열쇠가 합쳐 500번
  clock.ms = Math.ceil((clock.ms + 1) / LIMITS.lockSpan) * LIMITS.lockSpan; // 새 10분 창의 처음
  const many = [];
  for (let i = 0; i < LIMITS.lockFails / LIMITS.redeemFails; i++) many.push(await player());
  for (const p of many) for (let i = 0; i < LIMITS.redeemFails; i++) assert.equal((await svc.linkRedeem({ key: p.key, code: '00000000' })).status, 404);
  const c = await player(), fresh = (await svc.linkCode({ key: a.key })).body.code;
  assert.deepEqual(await svc.linkRedeem({ key: c.key, code: fresh }), E(429, 'locked'));
  assert.equal(store.players.length, 2 + many.length + 1, '잠긴 동안에는 맞는 코드도 합치지 않는다');
  clock.ms += LIMITS.lockSpan;
  assert.equal((await svc.linkRedeem({ key: c.key, code: (await svc.linkCode({ key: a.key })).body.code })).status, 200, '다음 10분에는 풀린다');
});

test('코드 넣기: 순위 성적을 날짜마다 더 좋은 것으로 합친다 — 낸 차례와 명령 줄도 따라온다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player(), other = await player();
  const id = (p) => store.keys.get(hashKey(p.key));
  await store.putScore(id(b), DATE, score(5), 'b1', '["b-today"]');        // B가 먼저 냈다
  await store.putScore(id(other), DATE, score(5), 'b1', '["other"]');      // 같은 성적을 남이 그다음에
  await store.putScore(id(a), DATE, score(3), 'b1', '["a-today"]');        // A의 오늘은 더 나쁘다
  await store.putScore(id(a), YEST, score(7), 'b1', '["a-yest"]');         // A의 어제는 더 좋다
  await store.putScore(id(b), YEST, score(2), 'b1', '["b-yest"]');
  await store.putScore(id(b), '2026-10-06', score(1), 'b1', '["b-only"]'); // B에만 있는 날
  const aid = id(a), bid = id(b);
  const { code } = (await svc.linkCode({ key: a.key })).body;
  const r = await svc.linkRedeem({ key: b.key, code });
  assert.equal(r.status, 200);
  const mine = (date) => store.scores.find((s) => s.pid === Number(aid) && s.date === date);
  assert.deepEqual([mine(DATE).ante, mine(YEST).ante, mine('2026-10-06').ante], [5, 7, 1]);
  assert.deepEqual([store.logs.get(`${aid}:${DATE}`), store.logs.get(`${aid}:${YEST}`), store.logs.get(`${aid}:2026-10-06`)], ['["b-today"]', '["a-yest"]', '["b-only"]']);
  assert.ok(!store.scores.some((s) => s.pid === Number(bid)) && ![...store.logs.keys()].some((k) => k.startsWith(`${bid}:`)), '옛 플레이어의 것은 남지 않는다');
  // 같은 성적이면 먼저 낸 사람이 위 — 합친 뒤에도 B가 냈던 차례 그대로
  const board = (await svc.board({ date: DATE, key: r.body.key })).body;
  assert.deepEqual([board.total, board.me.rank, board.me.ante], [2, 1, 5]);
  assert.deepEqual((await svc.board({ date: DATE, key: a.key })).body.me, board.me, '두 열쇠가 같은 줄을 본다');
});

test('코드 넣기: 넣은 쪽에 이어져 있던 다른 기기도 함께 옮겨 온다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player(), b2 = await player();
  // b2 기기를 b에 잇는다
  const k2 = (await svc.linkRedeem({ key: b2.key, code: (await svc.linkCode({ key: b.key })).body.code })).body.key;
  assert.deepEqual((await svc.linkDevices({ key: b.key })).body, { devices: 2 });
  // b2 기기가 a의 코드를 넣는다 — b도 a로 온다
  const r = await svc.linkRedeem({ key: k2, code: (await svc.linkCode({ key: a.key })).body.code });
  assert.equal(r.body.devices, 3);
  assert.equal(store.players.length, 1);
  for (const key of [a.key, b.key, r.body.key]) assert.deepEqual([(await svc.player({ key })).body.a, (await svc.player({ key })).body.n], [a.a, a.n]);
  assert.deepEqual(await svc.player({ key: k2 }), E(401, 'unknown_key'));
});

test('이 기기 떼기: 이 열쇠만 새 플레이어로 — 이름 · 저장 덩이 사본을 들고, 순위 성적은 남은 쪽에. 혼자인 열쇠는 400', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player();
  assert.deepEqual(await svc.linkUnlink({ key: a.key }), E(400, 'not_linked'));
  const kb = (await svc.linkRedeem({ key: b.key, code: (await svc.linkCode({ key: a.key })).body.code })).body.key;
  const aid = store.keys.get(hashKey(a.key));
  await store.putScore(aid, DATE, score(4), 'b1', '[]');
  assert.equal((await svc.savePut({ key: a.key, baseRev: 0, blob: blob({ runAt: 7 }) })).body.rev, 1);
  assert.equal((await svc.savePut({ key: kb, baseRev: 1, blob: blob({ runAt: 9 }) })).body.rev, 2);
  // 코드를 낸 쪽(a)이 떼어도 된다
  const r = await svc.linkUnlink({ key: a.key });
  assert.deepEqual(r, { status: 200, body: { key: a.key, a: a.a, n: a.n, rerolls: LIMITS.rerolls, devices: 1 } });
  assert.equal(store.players.length, 2);
  const nid = store.keys.get(hashKey(a.key));
  assert.notEqual(nid, aid);
  assert.equal(store.keys.get(hashKey(kb)), aid);
  assert.deepEqual([(await svc.linkDevices({ key: a.key })).body.devices, (await svc.linkDevices({ key: kb })).body.devices], [1, 1]);
  const mine = (await svc.saveGet({ key: a.key })).body, theirs = (await svc.saveGet({ key: kb })).body;
  assert.deepEqual([mine.rev, mine.blob.runAt, theirs.rev, theirs.blob.runAt], [1, 9, 2, 9], '저장 덩이 사본(rev는 1부터)');
  assert.equal((await svc.board({ date: DATE, key: a.key })).body.me, null, '순위 성적은 남은 쪽에 둔다');
  assert.equal((await svc.board({ date: DATE, key: kb })).body.me.ante, 4);
  assert.deepEqual(await svc.linkUnlink({ key: kb }), E(400, 'not_linked'));
  assert.deepEqual(await svc.linkUnlink({ key: 'f'.repeat(64) }), E(401, 'unknown_key'));
});

test('저장: 없으면 rev 0 · 올리면 rev가 오르고 · baseRev가 어긋나면 409와 서버 덩이 · 이어진 두 열쇠가 같은 덩이를 본다', async () => {
  const { svc, player, clock } = setup();
  const a = await player(), b = await player();
  assert.deepEqual(await svc.saveGet({ key: a.key }), { status: 200, body: { rev: 0 } });
  const b1 = blob({ runAt: 1 });
  assert.deepEqual(await svc.savePut({ key: a.key, baseRev: 0, blob: b1 }), { status: 200, body: { rev: 1, updatedAt: NOW } });
  assert.deepEqual((await svc.saveGet({ key: a.key })).body, { rev: 1, updatedAt: NOW, blob: b1 });
  clock.ms += 5000;
  const b2 = blob({ runAt: 2, run: { seed: 3, phase: 'shop', updatedAt: 2 }, settings: { lang: 'en', coach: true }, setAt: 2 });
  assert.equal((await svc.savePut({ key: a.key, baseRev: 1, blob: b2 })).body.rev, 2);
  // 낡은 baseRev · 없는 저장에 baseRev > 0
  assert.deepEqual(await svc.savePut({ key: a.key, baseRev: 1, blob: b1 }), E(409, 'conflict', { rev: 2, updatedAt: NOW + 5000, blob: b2 }));
  assert.deepEqual(await svc.savePut({ key: a.key, baseRev: 0, blob: b1 }), E(409, 'conflict', { rev: 2, updatedAt: NOW + 5000, blob: b2 }));
  assert.deepEqual(await svc.savePut({ key: b.key, baseRev: 3, blob: b1 }), E(409, 'conflict', { rev: 0 }));
  assert.deepEqual((await svc.saveGet({ key: a.key })).body.blob, b2, '어긋난 올리기는 아무것도 바꾸지 않는다');
  const kb = (await svc.linkRedeem({ key: b.key, code: (await svc.linkCode({ key: a.key })).body.code })).body.key;
  assert.deepEqual((await svc.saveGet({ key: kb })).body.blob, b2);
  assert.equal((await svc.savePut({ key: kb, baseRev: 2, blob: b1 })).body.rev, 3);
  assert.equal((await svc.saveGet({ key: a.key })).body.rev, 3);
  assert.deepEqual(await svc.saveGet({ key: 'f'.repeat(64) }), E(401, 'unknown_key'));
  assert.deepEqual(await svc.saveGet({}), E(400, 'bad_request'));
});

test('저장: 덩이의 꼴(최상위 열쇠 · 타입 · 깊이)만 본다 · 200KB를 넘으면 413 · 하루 500번', async () => {
  const { svc, player, clock } = setup();
  const a = await player();
  const deepObj = (n) => { let o = {}; for (let i = 0; i < n; i++) o = { o }; return o; };
  const bad = [null, [], 'x', {}, { v: 2, records: {}, run: null }, { v: 1, records: [], run: null }, { v: 1, records: {} }, { v: 1, records: {}, run: [] }, { v: 1, records: {}, run: null, extra: 1 },
    { v: 1, records: {}, run: null, runAt: 'now' }, { v: 1, records: {}, run: null, runAt: -1 }, { v: 1, records: {}, run: null, settings: [] }, { v: 1, records: {}, run: null, settings: { a: {} } },
    { v: 1, records: {}, run: null, settings: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i, 1])) }, { v: 1, records: deepObj(LIMITS.saveDepth), run: null }];
  for (const b of bad) { assert.equal(blobOk(b), false, JSON.stringify(b).slice(0, 60)); assert.deepEqual(await svc.savePut({ key: a.key, baseRev: 0, blob: b }), E(400, 'bad_blob')); }
  for (const body of [{ key: a.key, blob: blob() }, { key: a.key, baseRev: -1, blob: blob() }, { key: a.key, baseRev: 1.5, blob: blob() }, { key: 'x', baseRev: 0, blob: blob() }]) assert.deepEqual(await svc.savePut(body), E(400, 'bad_request'));
  // 내용은 믿지도 읽지도 않는다(그 사람 자신의 저장)
  assert.ok(blobOk({ v: 1, records: { runs: 'many', anything: [1, 2, { x: null }] }, run: { whatever: true }, runAt: 5, settings: { lang: 'xx' }, setAt: 0 }));
  assert.ok(blobOk({ v: 1, records: deepObj(LIMITS.saveDepth - 2), run: null }));
  assert.deepEqual(await svc.savePut({ key: a.key, baseRev: 0, blob: blob({ run: { pad: 'x'.repeat(LIMITS.save) } }) }), E(413, 'too_large'));
  assert.deepEqual(await svc.savePut({ key: 'f'.repeat(64), baseRev: 0, blob: blob() }), E(401, 'unknown_key'));
  let rev = 0;
  for (let i = 0; i < LIMITS.saves; i++) { const r = await svc.savePut({ key: a.key, baseRev: rev, blob: blob({ runAt: i }) }); assert.equal(r.status, 200); rev = r.body.rev; }
  assert.deepEqual(await svc.savePut({ key: a.key, baseRev: rev, blob: blob() }), E(429, 'save_limit'));
  clock.ms += 86400000;
  assert.equal((await svc.savePut({ key: a.key, baseRev: rev, blob: blob() })).status, 200);
});

test('함수: PUT도 JSON 본문만 받고, 저장 길은 본문 200KB에서 끊는다', async () => {
  const seen = [];
  const fake = async () => ({ savePut: async (b) => { seen.push(b); return { status: 200, body: { rev: 1 } }; } });
  const { PUT, OPTIONS } = route('PUT', (s, b) => s.savePut(b), fake, { limit: LIMITS.save, allow: 'GET, PUT' });
  const req = (body, headers = {}) => new Request('https://x.test/api/save', { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body });
  const ok = await PUT(req(JSON.stringify({ key: 'k', baseRev: 0, blob: {} })));
  assert.deepEqual([ok.status, await ok.json(), seen.length], [200, { rev: 1 }, 1]);
  assert.equal((await PUT(req(JSON.stringify({ pad: 'x'.repeat(LIMITS.save) })))).status, 413);
  assert.equal((await PUT(req('{}', { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await PUT(req('{}', { origin: 'https://evil.example' }))).status, 403);
  assert.equal(seen.length, 1);
  const o = await OPTIONS(new Request('https://x.test/api/save', { method: 'OPTIONS' }));
  assert.equal(o.headers.get('access-control-allow-methods'), 'GET, PUT, OPTIONS');
  assert.equal(LIMITS.save, 200 * 1024);
});
