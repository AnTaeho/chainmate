// 계정 서버 로직(CHM-72, api/_lib/service.js · auth.js · http.js): 가입 · 중복 · 규칙, 로그인(새 열쇠가 같은 플레이어 · 옛 플레이어 성적 합침) · 실패 · 잠금 · 전체 잠금 · 다른 계정 막기,
// 나가기(빈 플레이어 · 계정 쪽 기록 그대로), 비번 바꾸기 두 길, 지우기(모든 표에서 사라짐), 해시 꼴 · 가짜 견줌, 열쇠 머리말 길 · 옛 주소 길.
// DB는 기억 저장소 — 진짜 SQL은 tools/account-e2e.mjs가 본다. 해시의 N은 작게 준다(진짜 값은 따로 한 번 잰다).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService, LIMITS, hashKey } from '../api/_lib/service.js';
import { SCRYPT, RESERVED, COMMON, cleanUsername, passwordOk, hashPassword, verifyPassword, usernameId } from '../api/_lib/auth.js';
import { route, bearer } from '../api/_lib/http.js';
import { memStore } from './helpers/memstore.js';
import { emptyRecords } from '../src/ui/records.js';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const DATE = '2026-10-08';
const PW = 'moonlit-rook-42', PW2 = 'second-knight-77';
function setup() {
  const store = memStore();
  const clock = { ms: NOW };
  let k = 0;
  const svc = createService({ store, build: 'b1', now: () => clock.ms, newKey: () => (++k).toString(16).padStart(64, '0'), scryptN: 16 });
  const player = async () => (await svc.player({})).body;
  return { store, svc, clock, player };
}
const E = (status, error, more = {}) => ({ status, body: { error, ...more } });
const score = (ante, total = ante * 100) => ({ ante, blind: 0, won: false, score_total: total, battles: ante, moves: ante * 3, ignite: null });
const blob = (runs) => ({ v: 1, records: { ...emptyRecords(), runs }, run: null, runAt: 0 });
const idOf = async (store, key) => (await store.getPlayer(hashKey(key), DATE)).id;

test('아이디 · 비번 규칙: 소문자 · 숫자 · _ 3~20자 · 예약어 · 8~72자 · 흔한 비번 · 아이디와 같은 비번', () => {
  assert.equal(cleanUsername('Taeho_An'), 'taeho_an', '대문자는 소문자로');
  assert.equal(cleanUsername('  abc  '), 'abc');
  for (const bad of ['ab', 'a'.repeat(21), 'tae ho', '태호', 'a-b', 'a.b', 'admin', 'ROOT', 'chainmate', '', null, 12345]) assert.equal(cleanUsername(bad), null, String(bad));
  assert.equal(cleanUsername('a'.repeat(20)), 'a'.repeat(20));
  assert.ok(RESERVED.has('admin') && RESERVED.has('root') && RESERVED.has('chainmate'));
  assert.ok(passwordOk(PW, 'taeho_an'));
  assert.ok(!passwordOk('short12', 'x'), '7자');
  assert.ok(passwordOk('x'.repeat(72)) && !passwordOk('x'.repeat(73)));
  for (const c of ['password', '12345678', 'qwerty123', 'PASSWORD', 'Qwerty123']) assert.ok(!passwordOk(c, 'x'), c);
  assert.ok(COMMON.size >= 50, `흔한 비번 ${COMMON.size}`);
  assert.ok(!passwordOk('taeho_an_long', 'Taeho_An_Long'), '아이디와 같은 비번');
  assert.ok(!passwordOk(null) && !passwordOk(12345678));
});

test('비번 해시: scrypt$N$r$p$salt$hash 꼴 · N 2^15 이상 · salt 16바이트 무작위 · 견줌', async () => {
  assert.ok(SCRYPT.N >= 1 << 15 && SCRYPT.r === 8 && SCRYPT.p === 1 && SCRYPT.salt === 16);
  const h = await hashPassword(PW), h2 = await hashPassword(PW);
  const m = h.split('$');
  assert.deepEqual(m.slice(0, 4), ['scrypt', String(SCRYPT.N), '8', '1']);
  assert.equal(Buffer.from(m[4], 'base64').length, 16);
  assert.equal(Buffer.from(m[5], 'base64').length, 32);
  assert.notEqual(h, h2, 'salt가 달라 같은 비번도 다른 글');
  assert.ok(!h.includes(PW));
  assert.equal(await verifyPassword(PW, h), true);
  assert.equal(await verifyPassword(`${PW}x`, h), false);
  for (const bad of ['', 'scrypt$1$8$1$aa$bb', 'plain', null, `bcrypt$${m.slice(1).join('$')}`, `scrypt$3$8$1$${m[4]}$${m[5]}`]) assert.equal(await verifyPassword(PW, bad), false, String(bad));
});

test('가입: 지금 플레이어에 붙는다(기록 그대로) · 소문자로 저장 · 중복 · 규칙 · 이미 계정 · 한도', async () => {
  const { svc, store, player, clock } = setup();
  const a = await player(), b = await player();
  const aid = await idOf(store, a.key);
  await store.putScore(aid, DATE, score(4), 'b1', '[]');
  await svc.savePut({ key: a.key, baseRev: 0, blob: blob(7) });
  assert.deepEqual(await svc.accountGet({ key: a.key }), { status: 200, body: { username: null, devices: 1 } });
  assert.deepEqual(await svc.accountSignup({ key: a.key, username: 'Taeho_An', password: PW }), { status: 200, body: { username: 'taeho_an' } });
  assert.deepEqual(await svc.accountGet({ key: a.key }), { status: 200, body: { username: 'taeho_an', devices: 1 } });
  assert.equal(await idOf(store, a.key), aid, '같은 플레이어');
  assert.equal(store.scores.length, 1);
  assert.equal(JSON.parse((await store.getSave(aid)).blob).records.runs, 7);
  const acc = store.accounts.get('taeho_an');
  assert.match(acc.hash, /^scrypt\$\d+\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(!JSON.stringify([...store.accounts]).includes(PW), '비번 원문은 남지 않는다');
  // 이미 계정 · 중복(대소문자 무시) · 규칙
  assert.deepEqual(await svc.accountSignup({ key: a.key, username: 'other_name', password: PW }), E(409, 'has_account'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'TAEHO_AN', password: PW }), E(409, 'taken'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'ab', password: PW }), E(400, 'bad_username'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'admin', password: PW }), E(400, 'bad_username'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'bobby', password: 'password' }), E(400, 'weak_password'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'bobby_long', password: 'bobby_long' }), E(400, 'weak_password'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'bobby', password: 'short' }), E(400, 'weak_password'));
  assert.deepEqual(await svc.accountSignup({ key: b.key, username: 'bobby' }), E(400, 'bad_request'));
  assert.deepEqual(await svc.accountSignup({ key: 'f'.repeat(64), username: 'bobby', password: PW }), E(401, 'unknown_key'));
  assert.equal(store.accounts.size, 1);
  // 열쇠 한도: 하루 3번(만든 것만 센다 — 이미 있는 아이디는 전체 한도에만)
  for (let i = 0; i < LIMITS.signups; i++) {
    assert.equal((await svc.accountSignup({ key: b.key, username: `bobby_${i}`, password: PW })).status, 200);
    store.accounts.delete(`bobby_${i}`);
  }
  const lim = await svc.accountSignup({ key: b.key, username: 'bobby_9', password: PW });
  assert.deepEqual([lim.status, lim.body.error], [429, 'signup_limit']);
  assert.ok(lim.body.retryAfter > 0);
  clock.ms += 86400000;
  assert.equal((await svc.accountSignup({ key: b.key, username: 'bobby_9', password: PW })).status, 200);
  // 전체 한도: 한 시간 500번
  const c = await player();
  store.limits.set(`signupall:0:${new Date(clock.ms).toISOString().slice(0, 13)}`, LIMITS.signupAll);
  assert.equal((await svc.accountSignup({ key: c.key, username: 'carol', password: PW })).status, 429);
});

test('들어오기: 새 열쇠가 계정의 플레이어에 붙는다 · 옛 플레이어 성적은 합친 뒤 지운다 · 이름은 계정의 것', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player();
  const aid = await idOf(store, a.key), bid = await idOf(store, b.key);
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  await store.putScore(aid, DATE, score(3), 'b1', '["a"]');
  await store.putScore(bid, DATE, score(5), 'b1', '["b"]');
  await store.putScore(bid, '2026-10-07', score(2), 'b1', '["y"]');
  await svc.savePut({ key: a.key, baseRev: 0, blob: blob(9) });
  const r = await svc.accountLogin({ key: b.key, username: 'Taeho_An', password: PW });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['a', 'devices', 'key', 'n', 'rerolls', 'username']);
  assert.notEqual(r.body.key, b.key, '새 열쇠');
  assert.match(r.body.key, /^[0-9a-f]{64}$/);
  assert.deepEqual([r.body.a, r.body.n, r.body.devices, r.body.username], [a.a, a.n, 2, 'taeho_an']);
  assert.equal(await idOf(store, r.body.key), aid, '새 열쇠 = 계정의 플레이어');
  assert.equal(await store.getPlayer(hashKey(b.key), DATE), null, '옛 열쇠는 사라진다');
  assert.ok(!store.players.some((p) => p.id === bid), '옛 플레이어는 지워진다');
  // 성적: 날짜마다 더 좋은 것
  const mine = store.scores.filter((s) => s.pid === Number(aid)).sort((x, y) => x.date.localeCompare(y.date));
  assert.deepEqual(mine.map((s) => [s.date, s.ante]), [['2026-10-07', 2], [DATE, 5]]);
  assert.equal(store.logs.get(`${aid}:${DATE}`), '["b"]');
  // 저장은 계정의 것 그대로(화면이 당겨 합친다)
  assert.equal((await svc.saveGet({ key: r.body.key })).body.blob.records.runs, 9);
  // 이미 이 계정의 기기에서 다시 들어오면: 열쇠 그대로 · 아무것도 지워지지 않는다
  const again = await svc.accountLogin({ key: a.key, username: 'taeho_an', password: PW });
  assert.deepEqual([again.status, again.body.key, again.body.devices], [200, a.key, 2]);
  assert.equal(store.accounts.size, 1);
  assert.equal(await idOf(store, a.key), aid);
});

test('들어오기 실패: 틀린 비번 · 없는 아이디 · 규칙 밖 아이디가 모두 같은 401 · 없는 아이디에도 해시 견줌을 한다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player();
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  const bad = E(401, 'bad_login');
  assert.deepEqual(await svc.accountLogin({ key: b.key, username: 'taeho_an', password: 'wrong-password' }), bad);
  assert.deepEqual(await svc.accountLogin({ key: b.key, username: 'nobody_here', password: PW }), bad);
  assert.deepEqual(await svc.accountLogin({ key: b.key, username: '한글 아이디', password: PW }), bad);
  assert.deepEqual(await svc.accountLogin({ key: b.key, username: 'taeho_an' }), E(400, 'bad_request'));
  assert.deepEqual(await svc.accountLogin({ key: 'f'.repeat(64), username: 'taeho_an', password: PW }), E(401, 'unknown_key'));
  assert.ok(await store.getPlayer(hashKey(b.key), DATE), '실패하면 이 기기는 그대로');
  // 없는 아이디도 같은 한도 줄을 센다(잠금으로 아이디가 있는지 새지 않게)
  assert.equal(await store.peek('login', usernameId('nobody_here'), `fail:${Math.floor(NOW / LIMITS.loginSpan)}`), 1);
  assert.equal(await store.peek('login', usernameId('taeho_an'), `fail:${Math.floor(NOW / LIMITS.loginSpan)}`), 1);
  // 가짜 견줌: 없는 아이디도 진짜 N으로 해시 한 번 값의 시간을 쓴다
  const real = createService({ store: memStore(), now: () => NOW });
  const p = (await real.player({})).body;
  await real.accountSignup({ key: p.key, username: 'real_user', password: PW });
  const time = async (username) => { const t = process.hrtime.bigint(); await real.accountLogin({ key: p.key, username, password: 'wrong-password' }); return Number(process.hrtime.bigint() - t) / 1e6; };
  await time('ghost_user'); // 가짜 해시를 처음 만드는 값은 뺀다
  const miss = await time('ghost_user'), hit = await time('real_user');
  // p는 real_user의 기기라 ghost_user는 other_account로 끝난다 — 다른 기기로 잰다
  const q = (await real.player({})).body;
  const t0 = process.hrtime.bigint(); const r1 = await real.accountLogin({ key: q.key, username: 'ghost_user', password: 'wrong-password' }); const tMiss = Number(process.hrtime.bigint() - t0) / 1e6;
  const t1 = process.hrtime.bigint(); const r2 = await real.accountLogin({ key: q.key, username: 'real_user', password: 'wrong-password' }); const tHit = Number(process.hrtime.bigint() - t1) / 1e6;
  assert.deepEqual([r1, r2], [bad, bad]);
  assert.ok(miss >= 0 && hit >= 0);
  assert.ok(tMiss > tHit * 0.4 && tMiss < tHit * 2.5 && tMiss > 5, `없는 아이디 ${tMiss.toFixed(1)}ms · 있는 아이디 ${tHit.toFixed(1)}ms`);
});

test('잠금: 아이디당 15분에 5번 틀리면 15분 잠금(맞는 비번도 429) · 열쇠당 한 시간 20번 · 전체 10분 1000번', async () => {
  const { svc, store, player, clock } = setup();
  const a = await player(), b = await player();
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  for (let i = 0; i < LIMITS.loginFails; i++) assert.equal((await svc.accountLogin({ key: b.key, username: 'taeho_an', password: 'wrong-password' })).status, 401);
  const locked = await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW });
  assert.deepEqual([locked.status, locked.body.error], [429, 'locked']);
  assert.ok(locked.body.retryAfter > 14 * 60 && locked.body.retryAfter <= 16 * 60, `retryAfter ${locked.body.retryAfter}`);
  // 없는 아이디도 똑같이 잠긴다
  for (let i = 0; i < LIMITS.loginFails; i++) await svc.accountLogin({ key: b.key, username: 'ghost_user', password: 'wrong-password' });
  assert.equal((await svc.accountLogin({ key: b.key, username: 'ghost_user', password: PW })).body.error, 'locked');
  // 다른 아이디는 잠기지 않는다 · 이미 들어와 있는 기기는 그대로 쓴다
  assert.equal((await svc.accountLogin({ key: b.key, username: 'someone_else', password: PW })).status, 401);
  assert.equal((await svc.accountGet({ key: a.key })).status, 200);
  clock.ms += 14 * 60 * 1000;
  assert.equal((await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW })).status, 429);
  clock.ms += 2 * 60 * 1000 + 1;
  const ok = await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW });
  assert.equal(ok.status, 200, '15분이 지나면 풀린다');
  // 맞게 들어오면 틀린 수를 되돌린다
  assert.equal(await store.peek('login', usernameId('taeho_an'), `fail:${Math.floor(clock.ms / LIMITS.loginSpan)}`), 0);

  // 열쇠당 한 시간 20번
  const c = await player();
  for (let i = 0; i < LIMITS.keyLoginFails; i++) assert.equal((await svc.accountLogin({ key: c.key, username: `name_${i}`, password: 'wrong-password' })).status, 401);
  const kl = await svc.accountLogin({ key: c.key, username: 'taeho_an', password: PW });
  assert.deepEqual([kl.status, kl.body.error], [429, 'login_limit']);
  clock.ms += 3600000;
  assert.equal((await svc.accountLogin({ key: c.key, username: 'taeho_an', password: PW })).status, 200);

  // 전체 잠금
  const d = await player();
  store.limits.set(`loginall:0:login:${Math.floor(clock.ms / LIMITS.loginAllSpan)}`, LIMITS.loginAllFails);
  const all = await svc.accountLogin({ key: d.key, username: 'taeho_an', password: PW });
  assert.deepEqual([all.status, all.body.error], [429, 'locked']);
  clock.ms += LIMITS.loginAllSpan;
  assert.equal((await svc.accountLogin({ key: d.key, username: 'taeho_an', password: PW })).status, 200);
});

test('다른 계정 막기: 계정이 붙은 기기는 다른 아이디로 들어오지 못한다 · 코드 넣기도 막는다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player();
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  await svc.accountSignup({ key: b.key, username: 'bobby', password: PW2 });
  assert.deepEqual(await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW }), E(409, 'other_account'));
  assert.deepEqual(await svc.accountLogin({ key: b.key, username: 'nobody_here', password: PW }), E(409, 'other_account'), '아이디가 있는지와 상관없이 같은 답');
  assert.equal(store.accounts.size, 2);
  assert.ok(await store.getPlayer(hashKey(b.key), DATE));
  // 계정이 붙은 기기가 남의 코드를 넣으면 제 계정이 지워질 뻔한다 — 막는다
  const code = (await svc.linkCode({ key: a.key })).body.code;
  assert.deepEqual(await svc.linkRedeem({ key: b.key, code }), E(409, 'has_account'));
  assert.equal(store.accounts.size, 2);
  // 계정이 없는 기기는 계정 쪽 코드를 넣어 붙을 수 있다
  const c = await player();
  const code2 = (await svc.linkCode({ key: a.key })).body.code;
  const r = await svc.linkRedeem({ key: c.key, code: code2 });
  assert.equal(r.status, 200);
  assert.deepEqual((await svc.accountGet({ key: r.body.key })).body, { username: 'taeho_an', devices: 2 });
});

test('나가기: 이 기기는 새 빈 플레이어(새 열쇠 · 새 이름 · 저장 없음) · 계정 쪽 기록은 그대로 · 옛 열쇠는 죽는다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player();
  const aid = await idOf(store, a.key);
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  await store.putScore(aid, DATE, score(6), 'b1', '[]');
  await svc.savePut({ key: a.key, baseRev: 0, blob: blob(11) });
  const kb = (await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW })).body.key;
  const out = await svc.accountLogout({ key: kb });
  assert.equal(out.status, 200);
  assert.deepEqual(Object.keys(out.body).sort(), ['a', 'devices', 'key', 'n', 'rerolls']);
  assert.notEqual(out.body.key, kb);
  const nid = await idOf(store, out.body.key);
  assert.notEqual(nid, aid);
  assert.deepEqual((await svc.saveGet({ key: out.body.key })).body, { rev: 0 }, '기록 사본을 들고 가지 않는다');
  assert.deepEqual((await svc.accountGet({ key: out.body.key })).body, { username: null, devices: 1 });
  assert.deepEqual(await svc.accountGet({ key: kb }), E(401, 'unknown_key'), '옛 열쇠는 죽는다');
  // 계정 쪽은 그대로
  assert.deepEqual((await svc.accountGet({ key: a.key })).body, { username: 'taeho_an', devices: 1 });
  assert.equal((await svc.saveGet({ key: a.key })).body.blob.records.runs, 11);
  assert.equal(store.scores.filter((s) => s.pid === Number(aid)).length, 1);
  // 마지막 기기가 나가도 계정은 남는다(열쇠 0) — 다시 들어올 수 있다
  const out2 = await svc.accountLogout({ key: a.key });
  assert.equal(out2.status, 200);
  assert.equal(await store.keyCount(aid), 0);
  assert.deepEqual(await svc.accountGet({ key: a.key }), E(401, 'unknown_key'));
  const back = await svc.accountLogin({ key: out2.body.key, username: 'taeho_an', password: PW });
  assert.equal(back.status, 200);
  assert.equal(await idOf(store, back.body.key), aid);
  assert.equal((await svc.saveGet({ key: back.body.key })).body.blob.records.runs, 11);
  // 계정이 없는 기기는 나갈 것이 없다
  const c = await player();
  assert.deepEqual(await svc.accountLogout({ key: c.key }), E(400, 'no_account'));
});

test('비번 바꾸기: 지금 비번 + 새 비번 · 지금 비번 없이(들어와 있는 기기 — 하루 3번) · 규칙 · 틀린 지금 비번', async () => {
  const { svc, store, player, clock } = setup();
  const a = await player(), b = await player(), c = await player();
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  const h0 = store.accounts.get('taeho_an').hash;
  assert.deepEqual(await svc.accountPassword({ key: a.key, current: 'wrong-password', next: PW2 }), E(401, 'bad_login'));
  assert.deepEqual(await svc.accountPassword({ key: a.key, current: PW, next: 'password' }), E(400, 'weak_password'));
  assert.deepEqual(await svc.accountPassword({ key: a.key, current: PW, next: 'taeho_an' }), E(400, 'weak_password'));
  assert.deepEqual(await svc.accountPassword({ key: a.key, current: PW }), E(400, 'bad_request'));
  assert.deepEqual(await svc.accountPassword({ key: b.key, next: PW2 }), E(400, 'no_account'), '계정의 기기가 아니면 못 정한다');
  assert.equal(store.accounts.get('taeho_an').hash, h0);
  assert.deepEqual(await svc.accountPassword({ key: a.key, current: PW, next: PW2 }), { status: 200, body: { ok: true, reset: false } });
  assert.notEqual(store.accounts.get('taeho_an').hash, h0);
  assert.equal(store.accounts.get('taeho_an').changed, NOW);
  assert.equal((await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW })).status, 401, '옛 비번은 안 된다');
  const kb = (await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW2 })).body.key;
  // 지금 비번 없이: 이어진 기기 어디서든 · 하루 3번
  for (let i = 0; i < LIMITS.pwResets; i++) assert.deepEqual(await svc.accountPassword({ key: kb, next: `reset-pass-${i}!` }), { status: 200, body: { ok: true, reset: true } });
  const lim = await svc.accountPassword({ key: kb, next: 'reset-pass-9!' });
  assert.deepEqual([lim.status, lim.body.error], [429, 'reset_limit']);
  assert.equal((await svc.accountPassword({ key: kb, next: 'weak' })).body.error, 'weak_password', '약한 비번은 한도를 쓰지 않는다');
  assert.equal((await svc.accountPassword({ key: kb, current: 'reset-pass-2!', next: PW })).status, 200, '지금 비번을 알면 한도와 상관없다');
  clock.ms += 86400000;
  assert.equal((await svc.accountPassword({ key: kb, next: 'next-day-pass' })).status, 200);
  assert.equal((await svc.accountLogin({ key: c.key, username: 'taeho_an', password: 'next-day-pass' })).status, 200);
});

test('지우기: 비번을 요구한다 · 계정 · 플레이어 · 열쇠 · 성적 · 명령 줄 · 저장이 모두 사라진다 · 이 기기는 새 빈 플레이어 · 아이디는 다시 쓸 수 있다', async () => {
  const { svc, store, player } = setup();
  const a = await player(), b = await player(), other = await player();
  const aid = await idOf(store, a.key), oid = await idOf(store, other.key);
  await svc.accountSignup({ key: a.key, username: 'taeho_an', password: PW });
  await store.putScore(aid, DATE, score(6), 'b1', '["x"]');
  await store.putScore(oid, DATE, score(2), 'b1', '["o"]');
  await svc.savePut({ key: a.key, baseRev: 0, blob: blob(11) });
  await svc.linkCode({ key: a.key });
  const kb = (await svc.accountLogin({ key: b.key, username: 'taeho_an', password: PW })).body.key;
  assert.deepEqual(await svc.accountDelete({ key: kb, password: 'wrong-password' }), E(401, 'bad_login'));
  assert.deepEqual(await svc.accountDelete({ key: kb }), E(400, 'bad_request'));
  assert.deepEqual(await svc.accountDelete({ key: other.key, password: PW }), E(400, 'no_account'));
  assert.equal(store.accounts.size, 1);
  const r = await svc.accountDelete({ key: kb, password: PW });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.body).sort(), ['a', 'devices', 'key', 'n', 'rerolls']);
  assert.equal(store.accounts.size, 0);
  assert.ok(!store.players.some((p) => p.id === aid));
  assert.deepEqual([...store.keys.values()].filter((v) => v === aid), []);
  assert.deepEqual(store.scores.map((s) => s.pid), [Number(oid)], '남의 성적은 그대로');
  assert.deepEqual([...store.logs.keys()], [`${oid}:${DATE}`]);
  assert.equal(store.saves.has(aid), false);
  assert.equal([...store.codes.values()].filter((c) => c.playerId === aid).length, 0);
  assert.deepEqual([...store.limits.keys()].filter((k) => k.split(':')[1] === aid), []);
  // 계정에 이어져 있던 다른 기기의 열쇠도 죽는다
  assert.deepEqual(await svc.accountGet({ key: a.key }), E(401, 'unknown_key'));
  assert.deepEqual((await svc.accountGet({ key: r.body.key })).body, { username: null, devices: 1 });
  assert.deepEqual((await svc.saveGet({ key: r.body.key })).body, { rev: 0 });
  assert.equal((await svc.accountLogin({ key: other.key, username: 'taeho_an', password: PW })).status, 401);
  assert.equal((await svc.accountSignup({ key: other.key, username: 'taeho_an', password: PW2 })).status, 200, '지운 아이디는 다시 쓸 수 있다');
});

test('열쇠 머리말: Authorization: Bearer만 받는다 · 옛 꼴(본문 · 주소의 key)은 버린다 · CORS 허용 머리말 · 계정 길 본문 한도', async () => {
  const { svc, store, player } = setup();
  const fake = async () => svc;
  const a = await player(), b = await player();
  const req = (method, url, { key = null, body = null, headers = {} } = {}) => new Request(`http://x${url}`, { method, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.equal(bearer(req('GET', '/api/save')), null);
  assert.equal(bearer(req('GET', '/api/save', { key: a.key })), a.key);
  assert.equal(bearer(req('GET', '/api/save', { headers: { authorization: 'Basic abc' } })), '');
  const save = route('GET', (s, q) => s.saveGet(q), fake), board = route('GET', (s, q) => s.board(q), fake);
  const signup = route('POST', (s, body) => s.accountSignup(body), fake, { limit: LIMITS.account });
  const acct = route('GET', (s, q) => s.accountGet(q), fake);
  // 머리말 길
  assert.equal((await save.GET(req('GET', '/api/save', { key: a.key }))).status, 200);
  assert.equal((await board.GET(req('GET', `/api/daily/board?date=${DATE}`, { key: a.key }))).status, 200);
  const made = await signup.POST(req('POST', '/api/account/signup', { key: a.key, body: { username: 'taeho_an', password: PW } }));
  assert.deepEqual([made.status, await made.json()], [200, { username: 'taeho_an' }]);
  assert.deepEqual(await (await acct.GET(req('GET', '/api/account', { key: a.key }))).json(), { username: 'taeho_an', devices: 1 });
  // 옛 꼴(주소 · 본문의 key)은 버린다: 열쇠가 드는 길은 400, 순위표는 구경, 플레이어 길은 새 플레이어
  const old = await save.GET(req('GET', `/api/save?key=${a.key}`));
  assert.deepEqual([old.status, await old.json()], [400, { error: 'bad_request' }]);
  assert.equal((await acct.GET(req('GET', `/api/account?key=${b.key}`))).status, 400);
  await store.putScore(store.keys.get(hashKey(a.key)), DATE, { ante: 3, blind: 1, won: false, score_total: 900, battles: 5, moves: 20, ignite: null }, 'b1', '[]');
  assert.equal((await (await board.GET(req('GET', `/api/daily/board?date=${DATE}`, { key: a.key }))).json()).me.rank, 1);
  const watch = await board.GET(req('GET', `/api/daily/board?date=${DATE}&key=${a.key}`));
  assert.deepEqual([watch.status, (await watch.json()).me], [200, null]);
  const oldSignup = await signup.POST(req('POST', '/api/account/signup', { body: { key: b.key, username: 'other_one', password: PW } }));
  assert.equal(oldSignup.status, 400);
  const playerRoute = route('POST', (s, body) => s.player(body), fake);
  const fresh = await (await playerRoute.POST(req('POST', '/api/player', { body: { key: a.key } }))).json();
  assert.notEqual(fresh.key, a.key, '본문의 key는 버려져 새 플레이어가 된다');
  assert.equal((await (await playerRoute.POST(req('POST', '/api/player', { key: a.key, body: { key: b.key } }))).json()).key, a.key);
  // 둘 다 있으면 머리말만 본다
  assert.deepEqual(await (await acct.GET(req('GET', `/api/account?key=${b.key}`, { key: a.key }))).json(), { username: 'taeho_an', devices: 1 });
  // 꼴이 틀린 머리말 · 없는 열쇠
  assert.equal((await acct.GET(req('GET', '/api/account', { headers: { authorization: 'Bearer nope' } }))).status, 400);
  assert.equal((await acct.GET(req('GET', '/api/account', { key: 'f'.repeat(64) }))).status, 401);
  assert.equal((await acct.GET(req('GET', '/api/account'))).status, 400);
  // CORS: 허용 머리말에 Authorization
  const pre = await acct.OPTIONS(req('OPTIONS', '/api/account'));
  assert.match(pre.headers.get('access-control-allow-headers'), /Authorization/);
  // 본문 한도(계정 길 4KB) · 오류 답에 아이디 · 비번이 실리지 않는다
  const big = await signup.POST(req('POST', '/api/account/signup', { key: b.key, body: { username: 'bobby', password: 'x'.repeat(5000) } }));
  assert.equal(big.status, 413);
  const weak = await signup.POST(req('POST', '/api/account/signup', { key: b.key, body: { username: 'bobby_secret', password: 'password' } }));
  const text = JSON.stringify(await weak.json());
  assert.equal(text, '{"error":"weak_password"}');
});

test('로그: 서버 오류가 나도 아이디 · 비번이 콘솔에 찍히지 않는다', async () => {
  const { svc, player } = setup();
  const a = await player();
  const lines = [], old = console.error;
  console.error = (...x) => lines.push(x.map((v) => (v && v.stack) || String(v)).join(' '));
  try {
    const boom = route('POST', async (s, body) => { await s.accountSignup(body); throw new Error('db down'); }, async () => svc, { limit: LIMITS.account });
    const res = await boom.POST(new Request('http://x/api/account/signup', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${a.key}` }, body: JSON.stringify({ username: 'loud_name', password: 'loud-secret-99' }) }));
    assert.deepEqual([res.status, await res.json()], [500, { error: 'server' }]);
  } finally { console.error = old; }
  const all = lines.join('\n');
  assert.ok(lines.length === 1 && !all.includes('loud_name') && !all.includes('loud-secret-99') && !all.includes(a.key), all);
});
