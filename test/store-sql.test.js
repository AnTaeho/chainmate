// api/_lib/store.js의 진짜 SQL을 메모리 Postgres(PGlite)에 db/schema.sql을 올려 돌린다(C-5). 망 · 비밀 열쇠 없이 돈다.
// int8은 Neon 드라이버처럼 글로 받는다(PGlite 기본은 수라 id 견줌이 프로덕션과 달라진다).
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createStore } from '../api/_lib/store.js';
import { createService, LIMITS } from '../api/_lib/service.js';
import { usernameId } from '../api/_lib/auth.js';
import { RULES_VERSION } from '../src/sim/rules.js';
import { memStore } from './helpers/memstore.js';
import { emptyRecords } from '../src/ui/records.js';

const DATE = '2026-10-08', YEST = '2026-10-07';
const NOW = Date.parse('2026-10-08T12:00:00Z');
const TABLES = 'players, daily_scores, daily_logs, player_keys, link_codes, link_limits, saves, accounts';
let db, store;
const q = async (text, params = []) => (await db.query(text, params)).rows;
const score = (ante, blind = 0, won = false, total = ante * 100) => ({ ante, blind, won, score_total: total, battles: ante, moves: ante * 3, ignite: null });

before(async () => {
  db = new PGlite({ parsers: { 20: (x) => x } });
  await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8')); // 여러 번 돌려도 안전하다
  store = createStore(async (text, params) => (await db.query(text, params)).rows);
});
after(async () => { await db.close(); });
beforeEach(async () => { await db.exec(`truncate ${TABLES} restart identity cascade`); });

test('플레이어: 만들기 · 열쇠로 찾기 · 다시 짓기 하루 한도 · 제출 하루 한도', async () => {
  const p = await store.createPlayer('k1', 3, 4);
  assert.deepEqual(p, { id: '1', a: 3, n: 4 });
  assert.deepEqual(await store.getPlayer('k1', DATE), { id: '1', a: 3, n: 4, rerolls: 0 });
  assert.equal(await store.getPlayer('nope', DATE), null);
  assert.deepEqual(await store.reroll('1', 5, 6, DATE, 2), { a: 5, n: 6, rerolls: 1 });
  assert.deepEqual(await store.reroll('1', 7, 8, DATE, 2), { a: 7, n: 8, rerolls: 2 });
  assert.equal(await store.reroll('1', 9, 9, DATE, 2), null, '한도');
  assert.deepEqual(await store.getPlayer('k1', DATE), { id: '1', a: 7, n: 8, rerolls: 2 });
  assert.equal((await store.getPlayer('k1', '2026-10-09')).rerolls, 0, '다음 날은 0');
  assert.deepEqual(await store.reroll('1', 1, 1, '2026-10-09', 2), { a: 1, n: 1, rerolls: 1 });
  assert.deepEqual([await store.bumpSubmit('1', DATE, 2), await store.bumpSubmit('1', DATE, 2), await store.bumpSubmit('1', DATE, 2)], [true, true, false]);
  assert.equal(await store.bumpSubmit('1', '2026-10-09', 2), true, '다음 날은 새로');
  assert.equal(await store.keyCount('1'), 1);
});

test('순위: 좋아질 때만 갈아 끼우기 · 명령 줄 · 자리 · 순위표 쪽 · 내 위아래 — 기억 저장소와 같은 답', async () => {
  const mem = memStore();
  const both = async (fn) => { const a = await fn(store), b = await fn(mem); assert.deepEqual(a, b); return a; };
  for (let i = 1; i <= 6; i++) await both((s) => s.createPlayer(`k${i}`, i, i));
  assert.equal(await both((s) => s.putScore('1', DATE, score(3), 'b1', '[1]')), true);
  assert.equal(await both((s) => s.putScore('1', DATE, score(2), 'b1', '[2]')), false, '나쁜 기록은 그대로');
  assert.equal(await both((s) => s.putScore('1', DATE, score(3), 'b1', '[3]')), false, '같은 기록도 그대로');
  assert.equal(await both((s) => s.putScore('1', DATE, score(3, 1), 'b2', '[4]')), true);
  assert.deepEqual(await q('select cmds, build from daily_logs l join daily_scores s using (player_id, date)'), [{ cmds: '[4]', build: 'b2' }]);
  await both((s) => s.putScore('2', DATE, score(5), 'b1', '[]'));
  await both((s) => s.putScore('3', DATE, score(3, 1, false, 50), 'b1', '[]'));
  await both((s) => s.putScore('4', DATE, score(8, 2, true, 9e7), 'b1', '[]'));
  await both((s) => s.putScore('5', DATE, score(3, 1), 'b1', '[]')); // 1과 같다 → 먼저 낸 1이 위
  await both((s) => s.putScore('6', YEST, score(8), 'b1', '[]'));
  const st = await both((s) => s.standing('1', DATE));
  assert.deepEqual(st, { best: { ante: 3, blind: 1, won: false, score: 300, battles: 3, moves: 9, ignite: null }, rank: 3, total: 5 });
  assert.deepEqual(await both((s) => s.standing('6', DATE)), { best: null, rank: null, total: 5 });
  const b = await both((s) => s.board(DATE, 0, 2, '5', 1));
  assert.deepEqual(b.rows.map((r) => [r.rank, r.a]), [[1, 4], [2, 2]]);
  assert.deepEqual(b.me, { rank: 4, a: 5, n: 5, ante: 3, blind: 1, won: false, score: 300 });
  assert.deepEqual(b.around.map((r) => r.a), [1, 5, 3]);
  assert.deepEqual(await both((s) => s.board(DATE, 4, 10)), { total: 5, rows: [{ rank: 5, a: 3, n: 3, ante: 3, blind: 1, won: false, score: 50 }], me: null, around: [] });
  assert.deepEqual((await both((s) => s.board(DATE, 0, 10, '6'))).me, null, '그날 기록이 없으면 me 없음');
});

test('한도 표: 세기 · 한도에서 멈춤 · 들여다보기 · 값 적기 · 청소', async () => {
  assert.deepEqual([await store.bump('code', '1', DATE, 2), await store.bump('code', '1', DATE, 2), await store.bump('code', '1', DATE, 2)], [1, 2, null]);
  assert.equal(await store.bump('code', '2', DATE, 2), 1, '사람마다');
  assert.deepEqual([await store.peek('code', '1', DATE), await store.peek('code', '9', DATE)], [2, 0]);
  const uid = usernameId('taeho_an');
  await store.setMark('loginlock', uid, 'until', 123456789);
  assert.equal(await store.peek('loginlock', uid, 'until'), 123456789, '아이디 해시(60비트)도 bigint에 든다');
  await store.setMark('loginlock', uid, 'until', 0);
  assert.equal(await store.peek('loginlock', uid, 'until'), 0);
  await store.createPlayer('k1', 1, 1);
  await store.putCode('1', 'old', NOW - 3 * 86400000);
  await q("update link_limits set at = now() - interval '3 days' where kind = 'code' and who = 2");
  await store.sweep();
  assert.deepEqual(await q('select kind, who from link_limits order by kind, who'), [{ kind: 'code', who: '1' }, { kind: 'loginlock', who: uid }]);
  assert.equal((await q('select count(*)::int as n from link_codes'))[0].n, 0, '하루 넘게 지난 코드는 지운다');
});

test('옮기기 코드: 해시 하나 · 앞 코드 무효 · 만료 ms 왕복 · 한 번만 쓰기', async () => {
  await store.createPlayer('k1', 1, 1); await store.createPlayer('k2', 2, 2);
  const at = Date.now(), exp = at + 600000 + 123; // 청소가 실제 now()로 지우므로 지금 기준 · ms 끝자리까지 왕복
  assert.equal(await store.putCode('1', 'h1', exp), true);
  assert.equal(await store.putCode('1', 'h2', exp), true);
  assert.equal(await store.findCode('h1'), null, '앞 코드는 지운다');
  assert.equal(await store.putCode('2', 'h2', exp), false, '같은 해시가 살아 있으면 거짓');
  assert.deepEqual(await store.findCode('h2'), { playerId: '1', expires: exp, used: false });
  assert.equal(await store.claimCode('h2', exp), false, '만료 시각이면 못 쓴다');
  assert.equal(await store.claimCode('h2', at), true);
  assert.equal(await store.claimCode('h2', at), false, '한 번만');
  assert.equal((await store.findCode('h2')).used, true);
});

test('합치기(absorb): 날짜마다 더 좋은 성적 · 낸 시각 그대로 · 그 명령 줄 · 새 열쇠 · 다른 기기 열쇠 옮김 · 옛 열쇠와 from은 지움', async () => {
  await store.createPlayer('from-old', 1, 1); await store.createPlayer('to', 2, 2);
  await q("insert into player_keys (key_hash, player_id) values ('from-other', 1)");
  await store.putScore('1', DATE, score(5), 'b1', '[from-today]');
  await store.putScore('1', YEST, score(2), 'b1', '[from-yest]');
  await store.putScore('2', YEST, score(4), 'b1', '[to-yest]');
  await q("update daily_scores set submitted_at = '2026-10-08T01:02:03Z' where player_id = 1 and date = $1", [DATE]);
  await store.putSave('1', 0, '{"from":1}', NOW);
  await store.absorb('1', '2', 'from-old', 'new');
  assert.deepEqual(await q('select player_id, date::text, ante, submitted_at = $1::timestamptz as kept from daily_scores order by date', ['2026-10-08T01:02:03Z']),
    [{ player_id: '2', date: YEST, ante: 4, kept: false }, { player_id: '2', date: DATE, ante: 5, kept: true }]);
  assert.deepEqual(await q('select date::text, cmds from daily_logs order by date'), [{ date: YEST, cmds: '[to-yest]' }, { date: DATE, cmds: '[from-today]' }]);
  assert.deepEqual(await q('select key_hash, player_id from player_keys order by key_hash'), [{ key_hash: 'from-other', player_id: '2' }, { key_hash: 'new', player_id: '2' }, { key_hash: 'to', player_id: '2' }]);
  assert.deepEqual(await q('select id from players'), [{ id: '2' }]);
  assert.equal(await store.getSave('1'), null, 'from의 저장은 cascade로 지워진다');
  assert.equal(await store.keyCount('2'), 3);
});

test('떼기(splitKey) · 저장 rev · 열쇠 지우기', async () => {
  await store.createPlayer('k1', 3, 4);
  await q("insert into player_keys (key_hash, player_id) values ('k2', 1)");
  assert.equal(await store.getSave('1'), null);
  assert.equal(await store.putSave('1', 1, '{}', NOW), null, '없는 저장에 rev 1은 어긋난다');
  assert.equal(await store.putSave('1', 0, '{"r":1}', NOW), 1);
  assert.equal(await store.putSave('1', 0, '{"r":9}', NOW), null, '이미 있으면 0은 어긋난다');
  assert.equal(await store.putSave('1', 1, '{"r":2}', NOW + 5), 2);
  assert.equal(await store.putSave('1', 1, '{"r":3}', NOW + 6), null, '옛 rev');
  assert.deepEqual(await store.getSave('1'), { rev: 2, blob: '{"r":2}', updatedAt: NOW + 5 });
  const id = await store.splitKey('k2', '1');
  assert.equal(id, '2');
  assert.deepEqual(await store.getPlayer('k2', DATE), { id: '2', a: 3, n: 4, rerolls: 0 });
  assert.deepEqual(await store.getSave('2'), { rev: 1, blob: '{"r":2}', updatedAt: NOW + 5 }, '저장 사본은 rev 1');
  assert.deepEqual([await store.keyCount('1'), await store.keyCount('2')], [1, 1]);
  await store.dropKey('k2');
  assert.equal(await store.getPlayer('k2', DATE), null);
  assert.equal(await store.keyCount('2'), 0);
});

test('계정: 만들기(아이디 · 플레이어 하나씩) · 찾기 · 비번 바꾸기 · 플레이어 지우기(딸린 것 · 한도 줄, 로그인 잠금 줄은 남김)', async () => {
  await store.createPlayer('k1', 1, 1); await store.createPlayer('k2', 2, 2);
  assert.equal(await store.createAccount('1', 'taeho_an', 'h1'), true);
  assert.equal(await store.createAccount('2', 'taeho_an', 'h2'), false, '같은 아이디');
  assert.equal(await store.createAccount('1', 'other', 'h3'), false, '플레이어에 계정이 이미 있다');
  assert.deepEqual(await store.findAccount('taeho_an'), { playerId: '1', username: 'taeho_an', hash: 'h1' });
  assert.equal(await store.findAccount('nobody'), null);
  assert.deepEqual(await store.accountOfPlayer('1'), { username: 'taeho_an', hash: 'h1' });
  assert.equal(await store.accountOfPlayer('2'), null);
  await store.setPassword('1', 'h9', NOW);
  assert.deepEqual(await q('select pw_hash, pw_changed_at = to_timestamp($1::double precision / 1000) as at from accounts', [NOW]), [{ pw_hash: 'h9', at: true }]);
  await store.putScore('1', DATE, score(3), 'b1', '[]');
  await store.putSave('1', 0, '{}', NOW);
  await store.putCode('1', 'c1', NOW + 600000);
  const uid = usernameId('taeho_an');
  await store.bump('save', '1', DATE, 10); await store.bump('loginkey', '1', DATE, 10); await store.bump('code', '2', DATE, 10);
  await store.setMark('login', '1', 'fail:1', 2); await store.setMark('loginlock', uid, 'until', 5);
  await store.deletePlayer('1');
  for (const t of ['daily_scores', 'daily_logs', 'player_keys', 'link_codes', 'saves', 'accounts']) {
    assert.equal((await q(`select count(*)::int as n from ${t} where player_id = 1`))[0].n, 0, t);
  }
  assert.deepEqual(await q('select kind, who from link_limits order by kind'), [{ kind: 'code', who: '2' }, { kind: 'login', who: '1' }, { kind: 'loginlock', who: uid }]);
  assert.deepEqual(await q('select id from players'), [{ id: '2' }]);
});

test('서비스를 진짜 SQL 위에서: 플레이어 → 제출 · 순위표 → 코드로 잇기 → 저장 → 가입 · 로그인 · 나가기 · 비번 · 지우기', async () => {
  const clock = { ms: NOW };
  let k = 0, c = 0;
  const svc = createService({ store, build: 'b1', now: () => clock.ms, newKey: () => (++k).toString(16).padStart(64, '0'), newCode: () => String(10000000 + ++c), scryptN: 16, rand: () => 0.5 });
  const A = (await svc.player({})).body, B = (await svc.player({})).body;
  assert.equal((await svc.player({ key: A.key, reroll: true })).body.rerolls, LIMITS.rerolls - 1);
  const fx = JSON.parse(readFileSync(new URL('./fixtures/daily-2026-10-08-smart.json', import.meta.url), 'utf8'));
  const sub = await svc.submit({ key: B.key, date: DATE, rules: RULES_VERSION, cmds: fx.cmds });
  assert.equal(sub.status, 200, JSON.stringify(sub.body));
  assert.deepEqual([sub.body.rank, sub.body.total, sub.body.improved, sub.body.best.ante], [1, 1, true, fx.want.ante]);
  const brd = await svc.board({ date: DATE, key: B.key });
  assert.deepEqual([brd.status, brd.body.total, brd.body.me.rank, brd.body.rows.length], [200, 1, 1, 1]);
  // B의 기기를 A에 잇는다: B의 성적이 A로 옮겨진다
  const code = (await svc.linkCode({ key: A.key })).body.code;
  const red = await svc.linkRedeem({ key: B.key, code });
  assert.equal(red.status, 200, JSON.stringify(red.body));
  assert.equal(red.body.devices, 2);
  assert.equal((await svc.linkRedeem({ key: B.key, code })).status, 401, '옛 열쇠는 지워졌다');
  assert.equal((await svc.board({ date: DATE, key: A.key })).body.me.rank, 1, '성적이 A로 옮겨졌다');
  const blob = { v: 1, records: { ...emptyRecords(), runs: 2 }, run: null, runAt: 0 };
  assert.deepEqual((await svc.savePut({ key: A.key, baseRev: 0, blob })).body, { rev: 1, updatedAt: NOW });
  assert.equal((await svc.savePut({ key: red.body.key, baseRev: 0, blob })).body.error, 'conflict');
  assert.deepEqual((await svc.saveGet({ key: red.body.key })).body, { rev: 1, updatedAt: NOW, blob });
  assert.equal((await svc.linkUnlink({ key: red.body.key })).status, 200);
  assert.equal((await svc.linkDevices({ key: A.key })).body.devices, 1);
  // 계정
  assert.deepEqual((await svc.accountSignup({ key: A.key, username: 'Taeho_An', password: 'moonlit-rook-42' })).body, { username: 'taeho_an' });
  assert.equal((await svc.accountSignup({ key: red.body.key, username: 'taeho_an', password: 'moonlit-rook-42' })).body.error, 'taken');
  assert.equal((await svc.accountLogin({ key: red.body.key, username: 'taeho_an', password: 'wrong-pass-99' })).status, 401);
  const login = await svc.accountLogin({ key: red.body.key, username: 'taeho_an', password: 'moonlit-rook-42' });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  assert.deepEqual([login.body.devices, (await svc.accountGet({ key: login.body.key })).body.username], [2, 'taeho_an']);
  const out = await svc.accountLogout({ key: login.body.key });
  assert.deepEqual([out.status, out.body.devices], [200, 1]);
  assert.equal((await svc.accountPassword({ key: A.key, next: 'second-knight-77' })).body.reset, true);
  assert.equal((await svc.accountPassword({ key: A.key, current: 'second-knight-77', next: 'third-bishop-55' })).status, 200);
  const del = await svc.accountDelete({ key: A.key, password: 'third-bishop-55' });
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal((await svc.player({ key: A.key })).status, 401, '지운 플레이어의 열쇠는 모른다');
  assert.equal((await q('select count(*)::int as n from accounts'))[0].n, 0);
  assert.equal((await q('select count(*)::int as n from daily_scores'))[0].n, 0);
});
