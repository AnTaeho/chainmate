// 계정 끝에서 끝까지 확인(CHM-72): 로컬 vercel dev(또는 배포)에 실제 요청을 보내 진짜 DB의 SQL까지 본다.
//   node tools/account-e2e.mjs <주소> [--keep]      예: vercel dev --listen 3210 뒤 node tools/account-e2e.mjs http://localhost:3210
// 가입 · 규칙 · 중복 → 열쇠 머리말 길(옛 꼴은 거절) → 들어오기(새 열쇠 · 성적 합침) · 실패 · 아이디 잠금 · 전체 잠금 · 다른 계정 → 비번 바꾸기 두 길 → 나가기 → 지우기(모든 표에서 사라짐).
// 만든 플레이어는 곧바로 test 표시를 하고(.env.local의 직접 연결) 끝나면(실패해도) 지운다. 전체 한도 줄은 손댄 만큼 되돌리고, 아이디 한도 줄은 제 손으로 지운다.
// 열쇠 · 비번은 찍지 않는다. 열쇠는 Authorization 머리말로만 보낸다(옛 꼴이 거절되는지 볼 때만 주소 · 본문에).
import { hashKey, LIMITS } from '../api/_lib/service.js';
import { usernameId, SCRYPT } from '../api/_lib/auth.js';
import { emptyRecords } from '../src/ui/records.js';
import { direct, cleanupTests, cleanupLine } from './db-migrate.mjs';

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:/.test(a)) || '').replace(/\/$/, '');
const KEEP = args.includes('--keep');
if (!BASE) { console.error('주소를 준다: node tools/account-e2e.mjs <주소>'); process.exit(2); }
const sql = direct();
const one = async (text, params = []) => (await sql.query(text, params))[0] || null;

let calls = 0, failed = 0;
// key: 머리말로 보낸다. 돌려주는 것: { status, body, ms }
async function call(method, p, body = null, key = null) {
  calls++;
  const t = process.hrtime.bigint();
  const res = await fetch(BASE + p, { method, headers: { ...(body != null ? { 'Content-Type': 'application/json' } : {}), ...(key ? { Authorization: `Bearer ${key}` } : {}) }, ...(body != null ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch { /* JSON 아님 */ }
  return { status: res.status, body: j, ms: Number(process.hrtime.bigint() - t) / 1e6, headers: res.headers };
}
const check = (name, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const E = (r, status, error) => r.status === status && r.body && r.body.error === error;
const idOf = async (key) => { const r = await one('select player_id::text as id from player_keys where key_hash = $1', [hashKey(key)]); return r ? r.id : null; };
const mark = async (key) => { const hit = await sql.query('update players set test = true where id = (select player_id from player_keys where key_hash = $1) returning id', [hashKey(key)]); if (hit.length !== 1) throw new Error('만든 플레이어가 DB에 없다(다른 DB를 보고 있나?)'); };
async function newPlayer() {
  const r = await call('POST', '/api/player', {});
  if (r.status !== 200) throw new Error(`플레이어 만들기 실패 ${r.status} ${JSON.stringify(r.body && r.body.error)}`);
  await mark(r.body.key);
  return r.body;
}
const rnd = () => [...crypto.getRandomValues(new Uint8Array(5))].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 9);
const users = [];
const user = () => { const u = `e2e_${rnd()}`; users.push(u); return u; };
const PW = `Aa-${rnd()}-${rnd()}`, PW2 = `Bb-${rnd()}-${rnd()}`, WRONG = `Zz-${rnd()}-${rnd()}`;
const blob = (runs) => ({ v: 1, records: { ...emptyRecords(), runs }, run: null, runAt: 0, settings: { lang: 'ko', coach: true, replay: true }, setAt: 0 });
const DAY = '2001-01-01'; // 성적 합침을 볼 날짜(아무도 두지 않은 옛 날)
const putScore = (id, ante, at) => sql.query(`insert into daily_scores (player_id, date, ante, blind, won, score_total, battles, moves, ignite, build, submitted_at)
  values ($1::bigint, $2::date, $3, 0, false, $4, 1, 1, null, 'e2e', $5::timestamptz)`, [id, DAY, ante, ante * 100, at]);
// 전체 한도 줄(who 0): 손대기 전 값을 적어 두었다가 되돌린다
const allBuckets = () => { const k = Math.floor(Date.now() / LIMITS.loginAllSpan); const h = (d) => new Date(Date.now() + d).toISOString().slice(0, 13); return [['loginall', `login:${k}`], ['loginall', `login:${k + 1}`], ['signupall', h(0)], ['signupall', h(3600000)]]; };
const before = new Map();
async function noteAll() { for (const [kind, b] of allBuckets()) { const k = `${kind}|${b}`; if (!before.has(k)) { const r = await one('select n from link_limits where kind = $1 and who = 0 and bucket = $2', [kind, b]); before.set(k, r ? r.n : null); } } }
async function restoreAll() {
  for (const [k, n] of before) {
    const [kind, b] = k.split('|');
    if (n == null) await sql.query('delete from link_limits where kind = $1 and who = 0 and bucket = $2', [kind, b]);
    else await sql.query('update link_limits set n = $3 where kind = $1 and who = 0 and bucket = $2', [kind, b, n]);
  }
}
async function cleanup() {
  await restoreAll();
  // 이 도구가 만든 아이디의 한도 줄(who = 아이디의 번호)
  const ids = [...users, 'e2e_ghost_user'].map(usernameId);
  await sql.query("delete from link_limits where kind in ('login', 'loginlock') and who = any($1::bigint[])", [ids]);
  const r = await cleanupTests(sql);
  const stray = await one("select count(*)::int as n from accounts where username like 'e2e\\_%'");
  const lim = await one("select count(*)::int as n from link_limits where kind in ('login', 'loginlock') and who = any($1::bigint[])", [ids]);
  console.log(`${cleanupLine(r)} · e2e 계정 ${stray.n} · e2e 아이디 한도 줄 ${lim.n}`);
  const full = await one("select count(*)::int as n from link_limits where who = 0 and ((kind = 'loginall' and n >= $1) or (kind = 'signupall' and n >= $2))", [LIMITS.loginAllFails, LIMITS.signupAll]);
  if (full.n) console.log(`  한도까지 찬 전체 줄 ${full.n}`);
  if (Object.values(r.left).some(Boolean) || stray.n || lim.n || full.n) throw new Error('시험 자료가 남았다');
}

try {
  console.log(`대상: ${BASE}`);
  await cleanup();
  await noteAll();
  const hello = await call('GET', '/api/hello');
  check('GET /api/hello', hello.status === 200 && !!(hello.body && hello.body.build), `build ${hello.body && hello.body.build}`);

  // ── 가입
  const a = await newPlayer(), b = await newPlayer(), c = await newPlayer();
  const aid = await idOf(a.key), bid = await idOf(b.key);
  const U = user();
  check('계정 없음: GET /api/account → username null · 기기 1', JSON.stringify((await call('GET', '/api/account', null, a.key)).body) === '{"username":null,"devices":1}');
  check('짧은 아이디 400 bad_username', E(await call('POST', '/api/account/signup', { username: 'ab', password: PW }, a.key), 400, 'bad_username'));
  check('예약어 400 bad_username', E(await call('POST', '/api/account/signup', { username: 'admin', password: PW }, a.key), 400, 'bad_username'));
  check('흔한 비번 400 weak_password', E(await call('POST', '/api/account/signup', { username: U, password: 'password123' }, a.key), 400, 'weak_password'));
  check('아이디와 같은 비번 400 weak_password', E(await call('POST', '/api/account/signup', { username: U, password: U }, a.key), 400, 'weak_password'));
  const s1 = await call('POST', '/api/account/signup', { username: U.toUpperCase(), password: PW }, a.key);
  check('가입 200 — 아이디는 소문자로', s1.status === 200 && s1.body.username === U, `${s1.status} · ${Math.round(s1.ms)}ms`);
  const row = await one('select player_id::text as id, pw_hash, username from accounts where username = $1', [U]);
  check('DB: 계정이 지금 플레이어에 붙었다 · 비번은 scrypt 해시 글', !!row && row.id === aid && new RegExp(`^scrypt\\$${SCRYPT.N}\\$8\\$1\\$[A-Za-z0-9+/=]{24}\\$[A-Za-z0-9+/=]{44}$`).test(row.pw_hash) && !row.pw_hash.includes(PW), row ? row.pw_hash.split('$').slice(0, 4).join('$') : '없음');
  check('GET /api/account → 아이디 · 기기 1', JSON.stringify((await call('GET', '/api/account', null, a.key)).body) === JSON.stringify({ username: U, devices: 1 }));
  check('이미 계정이 있는 기기 409 has_account', E(await call('POST', '/api/account/signup', { username: user(), password: PW }, a.key), 409, 'has_account'));
  check('이미 있는 아이디 409 taken(대소문자 무시)', E(await call('POST', '/api/account/signup', { username: U.toUpperCase(), password: PW }, b.key), 409, 'taken'));
  check('본문 한도 413', (await call('POST', '/api/account/signup', { username: U, password: 'x'.repeat(LIMITS.account) }, b.key)).status === 413);
  check('열쇠 없이 400 · 모르는 열쇠 401', (await call('POST', '/api/account/signup', { username: U, password: PW })).status === 400 && E(await call('GET', '/api/account', null, 'f'.repeat(64)), 401, 'unknown_key'));

  // ── 열쇠 머리말 길 · 옛 꼴(주소 · 본문의 key)은 열쇠 없는 요청으로 본다
  const p1 = await call('PUT', '/api/save', { baseRev: 0, blob: blob(7) }, a.key);
  check('머리말: PUT /api/save', p1.status === 200 && p1.body.rev === 1);
  const g1 = await call('GET', '/api/save', null, a.key), g2 = await call('GET', `/api/save?key=${a.key}`);
  check('머리말: GET /api/save · 옛 꼴 GET /api/save?key= 는 400', g1.status === 200 && g1.body.rev === 1 && g1.body.blob.records.runs === 7 && E(g2, 400, 'bad_request'));
  check('주소의 key는 버리고 머리말만 본다', (await call('GET', `/api/save?key=${a.key}`, null, b.key)).body.rev === 0);
  const pl = await call('POST', '/api/player', {}, a.key);
  check('머리말: POST /api/player(새로 만들지 않고 읽는다)', pl.status === 200 && pl.body.key === a.key && pl.body.a === a.a);
  const o1 = await call('PUT', '/api/save', { key: a.key, baseRev: 1, blob: blob(8) }), o2 = await call('POST', '/api/link/devices', { key: a.key }), o3 = await call('GET', `/api/account?key=${a.key}`);
  check('옛 꼴(본문의 key) PUT /api/save · POST /api/link/devices · 주소의 key GET /api/account 는 400', E(o1, 400, 'bad_request') && E(o2, 400, 'bad_request') && E(o3, 400, 'bad_request') && (await call('GET', '/api/save', null, a.key)).body.rev === 1);
  const o4 = await call('GET', `/api/daily/board?date=${DAY}&key=${a.key}`);
  check('옛 꼴 GET /api/daily/board?key= 는 구경으로 답한다', o4.status === 200 && o4.body.me === null);
  const bd = await call('GET', `/api/daily/board?date=${DAY}`, null, a.key);
  check('머리말: GET /api/daily/board', bd.status === 200 && Array.isArray(bd.body.rows));
  const pre = await fetch(`${BASE}/api/account`, { method: 'OPTIONS' });
  check('OPTIONS: 허용 머리말에 Authorization', /Authorization/i.test(pre.headers.get('access-control-allow-headers') || ''), pre.headers.get('access-control-allow-headers') || '');
  check('꼴이 틀린 머리말 400', (await fetch(`${BASE}/api/account`, { headers: { Authorization: 'Bearer nope' } })).status === 400);

  // ── 들어오기
  await putScore(aid, 3, '2001-01-01T03:00:00Z'); await putScore(bid, 5, '2001-01-01T01:00:00Z');
  const w1 = await call('POST', '/api/account/login', { username: U, password: WRONG }, b.key);
  const w2 = await call('POST', '/api/account/login', { username: 'e2e_ghost_user', password: WRONG }, b.key);
  check('틀린 비번 · 없는 아이디가 같은 401 bad_login', E(w1, 401, 'bad_login') && JSON.stringify(w1.body) === JSON.stringify(w2.body), `있는 아이디 ${Math.round(w1.ms)}ms · 없는 아이디 ${Math.round(w2.ms)}ms`);
  const w3 = await call('POST', '/api/account/login', { username: 'e2e_ghost_user', password: WRONG }, c.key), w4 = await call('POST', '/api/account/login', { username: U, password: WRONG }, c.key);
  console.log(`  · 걸린 시간(둘째 판): 없는 아이디 ${Math.round(w3.ms)}ms · 있는 아이디 ${Math.round(w4.ms)}ms`);
  const l1 = await call('POST', '/api/account/login', { username: U, password: PW }, b.key);
  const kb = l1.body && l1.body.key;
  check('들어오기 200 — 새 열쇠 · 계정의 이름 · 기기 2', l1.status === 200 && /^[0-9a-f]{64}$/.test(kb || '') && kb !== b.key && l1.body.a === a.a && l1.body.n === a.n && l1.body.devices === 2 && l1.body.username === U, `${l1.status} · ${Math.round(l1.ms)}ms`);
  check('새 열쇠 = 계정의 플레이어 · 옛 열쇠 401 · 옛 플레이어 없음', (await idOf(kb)) === aid && E(await call('GET', '/api/account', null, b.key), 401, 'unknown_key') && (await one('select count(*)::int as n from players where id = $1::bigint', [bid])).n === 0);
  const sc = await one("select ante, to_char(submitted_at at time zone 'UTC', 'HH24') as h from daily_scores where player_id = $1::bigint and date = $2::date", [aid, DAY]);
  check('성적은 더 좋은 쪽 · 낸 시각 그대로', !!sc && sc.ante === 5 && sc.h === '01', sc ? `${sc.ante}관 ${sc.h}시` : '없음');
  check('계정의 저장을 새 열쇠로 읽는다', (await call('GET', '/api/save', null, kb)).body.blob.records.runs === 7);
  const again = await call('POST', '/api/account/login', { username: U, password: PW }, a.key);
  check('이미 이 계정의 기기에서 다시 들어오면 열쇠 그대로', again.status === 200 && again.body.key === a.key && again.body.devices === 2 && (await idOf(a.key)) === aid);

  // ── 다른 계정 · 코드 넣기 막기
  const U2 = user();
  check('다른 기기의 가입', (await call('POST', '/api/account/signup', { username: U2, password: PW2 }, c.key)).status === 200);
  check('계정이 붙은 기기는 다른 아이디로 못 들어온다(409 other_account)', E(await call('POST', '/api/account/login', { username: U, password: PW }, c.key), 409, 'other_account'));
  const code = (await call('POST', '/api/link/code', {}, a.key)).body.code;
  check('계정이 붙은 기기는 남의 코드를 못 넣는다(409 has_account) — 계정이 지워지지 않는다', E(await call('POST', '/api/link/redeem', { code }, c.key), 409, 'has_account') && (await one('select count(*)::int as n from accounts where username = $1', [U2])).n === 1);

  // ── 잠금: 아이디당 15분에 5번
  const d = await newPlayer();
  let miss = 0;
  for (let i = 0; i < LIMITS.loginFails; i++) if (E(await call('POST', '/api/account/login', { username: U2, password: WRONG }, d.key), 401, 'bad_login')) miss++;
  const lk = await call('POST', '/api/account/login', { username: U2, password: PW2 }, d.key);
  check(`틀린 비번 ${LIMITS.loginFails}번 뒤에는 맞는 비번도 429 locked(몇 초 뒤)`, miss === LIMITS.loginFails && E(lk, 429, 'locked') && lk.body.retryAfter > 800 && lk.body.retryAfter <= 901, `retryAfter ${lk.body && lk.body.retryAfter}`);
  check('들어와 있는 기기는 잠겨도 그대로 쓴다', (await call('GET', '/api/account', null, c.key)).body.username === U2);
  await sql.query("update link_limits set n = 1 where kind = 'loginlock' and who = $1::bigint", [usernameId(U2)]);
  const ul = await call('POST', '/api/account/login', { username: U2, password: PW2 }, d.key);
  check('잠금이 풀리면 들어온다', ul.status === 200 && ul.body.devices === 2, `${ul.status}`);
  const kd = ul.body.key;
  // 전체 잠금: 센 수를 한도까지 올려 두고 맞는 비번을 넣어 본다
  const e = await newPlayer();
  // 창이 그사이 넘어갔을 수 있다 — 손대기 직전에 지금 창의 값을 다시 적어 둔다(되돌리지 못한 잠금 줄을 남기지 않게)
  await restoreAll(); await noteAll();
  for (const [kind, bk] of allBuckets().filter(([k]) => k === 'loginall')) await sql.query('insert into link_limits (kind, who, bucket, n) values ($1, 0, $2, $3) on conflict (kind, who, bucket) do update set n = excluded.n', [kind, bk, LIMITS.loginAllFails]);
  check(`모두 합쳐 10분에 ${LIMITS.loginAllFails}번 틀리면 잠근다(429 locked)`, E(await call('POST', '/api/account/login', { username: U, password: PW }, e.key), 429, 'locked'));
  await restoreAll(); await noteAll();
  for (const [kind, bk] of allBuckets().filter(([k]) => k === 'signupall')) await sql.query('insert into link_limits (kind, who, bucket, n) values ($1, 0, $2, $3) on conflict (kind, who, bucket) do update set n = excluded.n', [kind, bk, LIMITS.signupAll]);
  check(`가입은 모두 합쳐 한 시간 ${LIMITS.signupAll}번(429 signup_limit)`, E(await call('POST', '/api/account/signup', { username: user(), password: PW }, e.key), 429, 'signup_limit'));
  await restoreAll();

  // ── 비번 바꾸기
  check('틀린 지금 비번 401', E(await call('POST', '/api/account/password', { current: WRONG, next: PW2 }, kb), 401, 'bad_login'));
  check('약한 새 비번 400', E(await call('POST', '/api/account/password', { current: PW, next: 'qwerty123' }, kb), 400, 'weak_password'));
  const cp = await call('POST', '/api/account/password', { current: PW, next: PW2 }, kb);
  check('지금 비번 + 새 비번 200', cp.status === 200 && cp.body.reset === false, `${Math.round(cp.ms)}ms`);
  check('옛 비번은 401 · 새 비번은 200', E(await call('POST', '/api/account/login', { username: U, password: PW }, e.key), 401, 'bad_login') && (await call('POST', '/api/account/login', { username: U, password: PW2 }, a.key)).status === 200);
  let resets = 0, lastReset = null;
  for (let i = 0; i < LIMITS.pwResets + 1; i++) { lastReset = await call('POST', '/api/account/password', { next: `${PW}-${i}` }, a.key); if (lastReset.status === 200 && lastReset.body.reset === true) resets++; }
  check(`지금 비번 없이 새로 정하기: 들어와 있는 기기에서 하루 ${LIMITS.pwResets}번(그 뒤 429 reset_limit)`, resets === LIMITS.pwResets && E(lastReset, 429, 'reset_limit'));
  check('계정이 없는 기기는 못 정한다(400 no_account)', E(await call('POST', '/api/account/password', { next: PW }, e.key), 400, 'no_account'));
  const FINAL = `${PW}-${LIMITS.pwResets - 1}`;

  // ── 나가기
  const out = await call('POST', '/api/account/logout', {}, kb);
  check('나가기 200 — 새 열쇠', out.status === 200 && /^[0-9a-f]{64}$/.test(out.body.key || '') && out.body.key !== kb && out.body.devices === 1);
  await mark(out.body.key);
  const nid = await idOf(out.body.key);
  check('새 빈 플레이어: 저장 없음 · 계정 없음 · 옛 열쇠 401', nid !== aid && (await call('GET', '/api/save', null, out.body.key)).body.rev === 0 && (await call('GET', '/api/account', null, out.body.key)).body.username === null && E(await call('GET', '/api/account', null, kb), 401, 'unknown_key'));
  check('계정 쪽은 그대로: 기기 1 · 저장 · 성적', (await call('GET', '/api/account', null, a.key)).body.devices === 1 && (await call('GET', '/api/save', null, a.key)).body.blob.records.runs === 7 && (await one('select count(*)::int as n from daily_scores where player_id = $1::bigint', [aid])).n === 1);
  check('계정이 없는 기기는 나갈 것이 없다(400 no_account)', E(await call('POST', '/api/account/logout', {}, out.body.key), 400, 'no_account'));
  // 마지막 기기도 나간 뒤(열쇠 0) 다시 들어온다
  const out2 = await call('POST', '/api/account/logout', {}, a.key);
  await mark(out2.body.key);
  check('마지막 기기가 나가도 계정은 남는다 · 옛 열쇠는 죽는다', out2.status === 200 && (await one('select count(*)::int as n from player_keys where player_id = $1::bigint', [aid])).n === 0 && E(await call('POST', '/api/player', {}, a.key), 401, 'unknown_key'));
  const back = await call('POST', '/api/account/login', { username: U, password: FINAL }, out2.body.key);
  check('다시 들어오면 같은 플레이어 · 같은 저장', back.status === 200 && (await idOf(back.body.key)) === aid && (await call('GET', '/api/save', null, back.body.key)).body.blob.records.runs === 7);

  // ── 지우기
  check('틀린 비번으로는 못 지운다(401)', E(await call('POST', '/api/account/delete', { password: WRONG }, back.body.key), 401, 'bad_login') && (await one('select count(*)::int as n from accounts where username = $1', [U])).n === 1);
  const del = await call('POST', '/api/account/delete', { password: FINAL }, back.body.key);
  check('지우기 200 — 새 열쇠', del.status === 200 && /^[0-9a-f]{64}$/.test(del.body.key || '') && del.body.key !== back.body.key);
  await mark(del.body.key);
  const gone = await one(`select (select count(*)::int from accounts where username = $2) as accounts, (select count(*)::int from players where id = $1::bigint) as players,
    (select count(*)::int from player_keys where player_id = $1::bigint) as keys, (select count(*)::int from daily_scores where player_id = $1::bigint) as scores,
    (select count(*)::int from daily_logs where player_id = $1::bigint) as logs, (select count(*)::int from saves where player_id = $1::bigint) as saves,
    (select count(*)::int from link_codes where player_id = $1::bigint) as codes, (select count(*)::int from link_limits where who = $1::bigint and kind not in ('login', 'loginlock')) as limits`, [aid, U]);
  check('DB: 계정 · 플레이어 · 열쇠 · 성적 · 명령 줄 · 저장 · 코드 · 한도 줄이 모두 0', Object.values(gone).every((n) => n === 0), JSON.stringify(gone));
  check('지운 뒤: 옛 열쇠 401 · 그 아이디로 못 들어온다 · 이 기기는 새 빈 플레이어', E(await call('GET', '/api/account', null, back.body.key), 401, 'unknown_key') && E(await call('POST', '/api/account/login', { username: U, password: FINAL }, e.key), 401, 'bad_login') && (await call('GET', '/api/account', null, del.body.key)).body.username === null);
  check('지운 아이디는 다시 쓸 수 있다', (await call('POST', '/api/account/signup', { username: U, password: PW }, e.key)).status === 200);
  check('다른 계정은 그대로', (await call('GET', '/api/account', null, kd)).body.username === U2);
  console.log(`요청 ${calls}번`);
} catch (e) {
  failed++;
  console.error(`중단: ${e.message}`);
} finally {
  if (KEEP) console.log('--keep: 시험 자료를 남겼다(node tools/account-e2e.mjs <주소>를 다시 돌리면 처음에 지운다)');
  else await cleanup().catch((e) => { failed++; console.error(`정리 실패: ${e.message}`); });
}
console.log(failed ? 'ACCOUNT E2E FAIL' : 'ACCOUNT E2E OK');
process.exit(failed ? 1 : 0);
