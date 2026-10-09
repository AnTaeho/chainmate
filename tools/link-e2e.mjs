// 기기 잇기 · 클라우드 저장 끝에서 끝까지 확인(CHM-71): 로컬 vercel dev(또는 배포)에 실제 요청을 보내 진짜 DB의 SQL까지 본다.
//   node tools/link-e2e.mjs <주소> [--keep]      예: vercel dev --listen 3210 뒤 node tools/link-e2e.mjs http://localhost:3210
// 플레이어 둘 → 코드 → 넣기 → 같은 플레이어(성적 합침) → 저장 올리기 · 당기기 · 409 → 떼기 → 한도 · 잠금 · 지난 코드.
// 만든 플레이어는 곧바로 test 표시를 하고(.env.local의 직접 연결) 끝나면(실패해도) 지운다. 전체 잠금 줄은 손댄 만큼 되돌린다. 열쇠 · 코드는 찍지 않는다.
import { createDailyRun } from '../src/sim/daily.js';
import { summarize } from '../api/_lib/verify.js';
import { hashKey, hashCode, utcDate, LIMITS } from '../api/_lib/service.js';
import { emptyRecords } from '../src/ui/records.js';
import { playRun } from './shopbot.mjs';
import { direct, cleanupTests, cleanupLine } from './db-migrate.mjs';

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:/.test(a)) || '').replace(/\/$/, '');
const KEEP = args.includes('--keep');
if (!BASE) { console.error('주소를 준다: node tools/link-e2e.mjs <주소>'); process.exit(2); }
const sql = direct();
const one = async (text, params = []) => (await sql.query(text, params))[0] || null;

let calls = 0, failed = 0;
async function call(method, p, body = null) {
  calls++;
  const res = await fetch(BASE + p, { method, ...(body != null ? { headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) } : {}) });
  const text = await res.text();
  let j = null; try { j = JSON.parse(text); } catch { /* JSON 아님 */ }
  return { status: res.status, body: j };
}
const check = (name, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const idOf = async (key) => { const r = await one('select player_id::text as id from player_keys where key_hash = $1', [hashKey(key)]); return r ? r.id : null; };
// 그 열쇠의 플레이어에 test 표시
const mark = async (key) => { const hit = await sql.query('update players set test = true where id = (select player_id from player_keys where key_hash = $1) returning id', [hashKey(key)]); if (hit.length !== 1) throw new Error('만든 플레이어가 DB에 없다(다른 DB를 보고 있나?)'); };
async function newPlayer() {
  const r = await call('POST', '/api/player', {});
  if (r.status !== 200) throw new Error(`플레이어 만들기 실패 ${r.status} ${JSON.stringify(r.body)}`);
  await mark(r.body.key);
  return r.body;
}
const getCode = async (key) => { const r = await call('POST', '/api/link/code', { key }); if (r.status !== 200) throw new Error(`코드 받기 실패 ${r.status} ${JSON.stringify(r.body)}`); return r.body.code; };
const blob = (more = {}) => ({ v: 1, records: { ...emptyRecords(), runs: 1 }, run: null, runAt: 0, settings: { lang: 'ko', coach: true, replay: true }, setAt: 0, ...more });
const E = (r, status, error) => r.status === status && r.body && r.body.error === error;
// 전체 잠금 줄: 손대기 전 값을 적어 두었다가 되돌린다
const lockBuckets = () => { const k = Math.floor(Date.now() / LIMITS.lockSpan); return [`lock:${k}`, `lock:${k + 1}`]; };
const lockBefore = new Map();
async function noteLock() { for (const b of lockBuckets()) if (!lockBefore.has(b)) { const r = await one("select n from link_limits where kind = 'lock' and who = 0 and bucket = $1", [b]); lockBefore.set(b, r ? r.n : null); } }
async function restoreLock() {
  for (const [b, n] of lockBefore) {
    if (n == null) await sql.query("delete from link_limits where kind = 'lock' and who = 0 and bucket = $1", [b]);
    else await sql.query("update link_limits set n = $2 where kind = 'lock' and who = 0 and bucket = $1", [b, n]);
  }
}
async function cleanup() {
  await restoreLock();
  const r = await cleanupTests(sql);
  console.log(cleanupLine(r));
  if (Object.values(r.left).some(Boolean)) throw new Error('시험 자료가 남았다');
}

try {
  console.log(`대상: ${BASE}`);
  await cleanup();
  await noteLock();
  const DATE = utcDate(Date.now());
  const hello = await call('GET', '/api/hello');
  const build = hello.body && hello.body.build;
  check('GET /api/hello', hello.status === 200 && !!build, `build ${build}`);

  // ── 코드
  const a = await newPlayer(), b = await newPlayer();
  check('기기 수: 혼자면 1', (await call('POST', '/api/link/devices', { key: a.key })).body.devices === 1);
  const c1 = await call('POST', '/api/link/code', { key: a.key });
  check('코드 받기 → 숫자 여덟 자리 · 10분', c1.status === 200 && /^\d{8}$/.test(c1.body.code) && c1.body.ttl === LIMITS.codeTtl && Math.abs(c1.body.expiresAt - Date.now() - LIMITS.codeTtl) < 60000, `ttl ${c1.body && c1.body.ttl}`);
  const rows = await sql.query('select code_hash from link_codes where player_id = $1::bigint', [await idOf(a.key)]);
  check('DB에는 코드의 해시만(한 줄)', rows.length === 1 && rows[0].code_hash === hashCode(c1.body.code) && !rows[0].code_hash.includes(c1.body.code));
  const code2 = await getCode(a.key);
  check('새로 받으면 앞의 코드는 무효(404)', E(await call('POST', '/api/link/redeem', { key: b.key, code: c1.body.code }), 404, 'bad_code'));
  check('자기 코드를 자기가 넣으면 400 self', E(await call('POST', '/api/link/redeem', { key: a.key, code: code2 }), 400, 'self'));
  check('꼴이 틀린 코드 400', E(await call('POST', '/api/link/redeem', { key: b.key, code: '1234 5678' }), 400, 'bad_request'));

  // ── 성적: B가 오늘 약한 판을 먼저 냈다. A는 어제(서버 날짜 −1) 것만
  const logs = ['none', 'random'].map((policy) => { const run = createDailyRun(DATE); playRun(run, policy); return { cmds: JSON.parse(JSON.stringify(run.cmds)), want: summarize(run) }; });
  const sb = await call('POST', '/api/daily/submit', { key: b.key, date: DATE, build, cmds: logs[0].cmds });
  check('B가 오늘의 대국을 냈다', sb.status === 200 && sb.body.improved === true, `${sb.body && sb.body.rank}등/${sb.body && sb.body.total}명`);
  const bid = await idOf(b.key), aid = await idOf(a.key);
  const before = await one('select submitted_at::text as at, score_total from daily_scores where player_id = $1::bigint and date = $2::date', [bid, DATE]);

  // ── 넣기
  const r = await call('POST', '/api/link/redeem', { key: b.key, code: code2 });
  check('코드 넣기 → 새 열쇠 · 코드를 낸 쪽의 이름 · 기기 2대', r.status === 200 && /^[0-9a-f]{64}$/.test(r.body.key) && r.body.key !== a.key && r.body.key !== b.key && r.body.a === a.a && r.body.n === a.n && r.body.devices === 2, `${r.status} 기기 ${r.body && r.body.devices}대`);
  const kb = r.body.key;
  check('두 열쇠가 같은 플레이어(DB) · 옛 플레이어는 지워졌다', (await idOf(kb)) === aid && (await idOf(b.key)) === null && (await one('select count(*)::int as n from players where id = $1::bigint', [bid])).n === 0);
  check('옛 열쇠는 401', E(await call('POST', '/api/player', { key: b.key }), 401, 'unknown_key'));
  check('한 번 쓴 코드는 다시 못 쓴다(404)', E(await call('POST', '/api/link/redeem', { key: (await newPlayer()).key, code: code2 }), 404, 'bad_code'));
  const after = await one('select submitted_at::text as at, score_total from daily_scores where player_id = $1::bigint and date = $2::date', [aid, DATE]);
  check('성적이 합쳐졌다 — 낸 시각 그대로', !!after && after.at === before.at && after.score_total === before.score_total, `${before.at}`);
  check('명령 줄도 따라왔다', (await one('select count(*)::int as n from daily_logs where player_id = $1::bigint and date = $2::date', [aid, DATE])).n === 1);
  const ba = await call('GET', `/api/daily/board?date=${DATE}&key=${a.key}`), bb = await call('GET', `/api/daily/board?date=${DATE}&key=${kb}`);
  check('두 기기가 순위표에서 같은 줄을 본다', !!ba.body.me && JSON.stringify(ba.body.me) === JSON.stringify(bb.body.me), `${ba.body.me && ba.body.me.rank}등`);
  const re = await call('POST', '/api/player', { key: kb, reroll: true });
  const pa = await call('POST', '/api/player', { key: a.key });
  check('한쪽에서 이름을 다시 지으면 다른 쪽도 같은 이름', re.status === 200 && pa.body.a === re.body.a && pa.body.n === re.body.n);
  // 더 좋은 쪽이 남는다: C(더 좋은 판)의 코드를 D(약한 판)가 넣는다
  const c = await newPlayer(), d = await newPlayer();
  const [weak, strong] = logs[0].want.score_total <= logs[1].want.score_total ? logs : [logs[1], logs[0]];
  await call('POST', '/api/daily/submit', { key: c.key, date: DATE, build, cmds: strong.cmds });
  await call('POST', '/api/daily/submit', { key: d.key, date: DATE, build, cmds: weak.cmds });
  const cBefore = await one('select submitted_at::text as at, score_total from daily_scores where player_id = $1::bigint and date = $2::date', [await idOf(c.key), DATE]);
  const rd = await call('POST', '/api/link/redeem', { key: d.key, code: await getCode(c.key) });
  const cAfter = await one('select submitted_at::text as at, score_total from daily_scores where player_id = $1::bigint and date = $2::date', [await idOf(c.key), DATE]);
  check('같은 날 성적은 더 좋은 쪽이 남는다', rd.status === 200 && cAfter.score_total === cBefore.score_total && cAfter.at === cBefore.at, `점수 합 ${cAfter.score_total}`);

  // ── 저장
  check('저장이 없으면 rev 0', (await call('GET', `/api/save?key=${a.key}`)).body.rev === 0);
  const b1 = blob({ runAt: 1 }), b2 = blob({ runAt: 2, run: { seed: 7, phase: 'shop', updatedAt: 2 } });
  const p1 = await call('PUT', '/api/save', { key: a.key, baseRev: 0, blob: b1 });
  check('올리기 → rev 1', p1.status === 200 && p1.body.rev === 1);
  const g1 = await call('GET', `/api/save?key=${kb}`);
  check('이어진 다른 열쇠로 당기면 같은 덩이', g1.status === 200 && g1.body.rev === 1 && JSON.stringify(g1.body.blob) === JSON.stringify(b1) && g1.body.updatedAt > 0);
  const p2 = await call('PUT', '/api/save', { key: kb, baseRev: 1, blob: b2 });
  check('다른 기기가 올리면 rev 2', p2.status === 200 && p2.body.rev === 2);
  const p3 = await call('PUT', '/api/save', { key: a.key, baseRev: 1, blob: b1 });
  check('낡은 baseRev → 409 + 서버 덩이', p3.status === 409 && p3.body.error === 'conflict' && p3.body.rev === 2 && JSON.stringify(p3.body.blob) === JSON.stringify(b2));
  check('있는 저장에 baseRev 0 → 409', (await call('PUT', '/api/save', { key: a.key, baseRev: 0, blob: b1 })).status === 409);
  check('어긋난 올리기는 아무것도 바꾸지 않는다', JSON.stringify((await call('GET', `/api/save?key=${a.key}`)).body.blob) === JSON.stringify(b2));
  check('덩이 꼴이 틀리면 400 bad_blob', E(await call('PUT', '/api/save', { key: a.key, baseRev: 2, blob: { v: 1, records: {}, run: null, extra: 1 } }), 400, 'bad_blob'));
  const big = await call('PUT', '/api/save', { key: a.key, baseRev: 2, blob: blob({ run: { pad: 'x'.repeat(LIMITS.save) } }) });
  check('본문 200KB를 넘으면 413', big.status === 413, `${big.status}`);
  const near = blob({ run: { pad: 'x'.repeat(LIMITS.save - 4096) } });
  const p4 = await call('PUT', '/api/save', { key: a.key, baseRev: 2, blob: near });
  check('한도에 가까운 덩이(196KB)는 들어가고 그대로 나온다', p4.status === 200 && p4.body.rev === 3 && (await call('GET', `/api/save?key=${kb}`)).body.blob.run.pad.length === LIMITS.save - 4096);
  check('모르는 열쇠 401', E(await call('GET', `/api/save?key=${'f'.repeat(64)}`), 401, 'unknown_key') && E(await call('PUT', '/api/save', { key: 'f'.repeat(64), baseRev: 0, blob: b1 }), 401, 'unknown_key'));
  check('다른 출처 403', (await fetch(`${BASE}/api/save?key=${a.key}`, { headers: { Origin: 'https://evil.example' } })).status === 403);
  await call('PUT', '/api/save', { key: a.key, baseRev: 3, blob: b2 });
  // 하루 한도: 센 수를 한도까지 올려 두고 본다
  await sql.query("insert into link_limits (kind, who, bucket, n) values ('save', $1::bigint, $2, $3) on conflict (kind, who, bucket) do update set n = excluded.n", [aid, DATE, LIMITS.saves]);
  check(`하루 ${LIMITS.saves}번을 넘으면 429 save_limit`, E(await call('PUT', '/api/save', { key: a.key, baseRev: 4, blob: b1 }), 429, 'save_limit'));

  // ── 떼기
  const u = await call('POST', '/api/link/unlink', { key: kb });
  check('이 기기 떼기 → 같은 열쇠 · 같은 이름 · 기기 1대', u.status === 200 && u.body.key === kb && u.body.a === re.body.a && u.body.n === re.body.n && u.body.devices === 1, `${u.status} ${JSON.stringify(u.body && u.body.error)}`);
  await mark(kb);
  const nid = await idOf(kb);
  check('새 플레이어가 됐다(DB) · 남은 쪽도 1대', nid !== aid && nid !== null && (await call('POST', '/api/link/devices', { key: a.key })).body.devices === 1 && (await call('POST', '/api/link/devices', { key: kb })).body.devices === 1);
  const gs = await call('GET', `/api/save?key=${kb}`);
  check('저장 사본을 들고 간다(rev 1)', gs.body.rev === 1 && JSON.stringify(gs.body.blob) === JSON.stringify(b2));
  check('순위 성적은 남은 쪽에', (await call('GET', `/api/daily/board?date=${DATE}&key=${kb}`)).body.me === null && !!(await call('GET', `/api/daily/board?date=${DATE}&key=${a.key}`)).body.me);
  check('혼자인 열쇠를 떼면 400 not_linked', E(await call('POST', '/api/link/unlink', { key: kb }), 400, 'not_linked'));
  const p5 = await call('PUT', '/api/save', { key: kb, baseRev: 1, blob: b1 });
  check('뗀 뒤 올린 것은 남은 쪽에 가지 않는다', p5.status === 200 && JSON.stringify((await call('GET', `/api/save?key=${a.key}`)).body.blob) === JSON.stringify(b2));

  // ── 한도 · 잠금 · 지난 코드
  const e = await newPlayer();
  let miss = 0;
  for (let i = 0; i < LIMITS.redeemFails; i++) if (E(await call('POST', '/api/link/redeem', { key: e.key, code: '00000000' }), 404, 'bad_code')) miss++;
  const live = await getCode(c.key);
  check(`틀린 코드 ${LIMITS.redeemFails}번 뒤에는 맞는 코드도 429 redeem_limit`, miss === LIMITS.redeemFails && E(await call('POST', '/api/link/redeem', { key: e.key, code: live }), 429, 'redeem_limit'));
  const f = await newPlayer();
  await sql.query('update link_codes set expires_at = now() - interval \'1 second\' where code_hash = $1', [hashCode(live)]);
  check('시간이 지난 코드 410 expired', E(await call('POST', '/api/link/redeem', { key: f.key, code: live }), 410, 'expired'));
  let got = 0, last = null;
  for (let i = 0; i < LIMITS.codes + 1; i++) { last = await call('POST', '/api/link/code', { key: f.key }); if (last.status === 200) got++; }
  check(`코드 받기는 하루 ${LIMITS.codes}번(그 뒤 429 code_limit)`, got === LIMITS.codes && E(last, 429, 'code_limit'));
  // 전체 잠금: 센 수를 한도까지 올려 두고(이번 · 다음 10분 창) 맞는 코드를 넣어 본다
  const g = await newPlayer(), open = await getCode(a.key);
  for (const bk of lockBuckets()) await sql.query("insert into link_limits (kind, who, bucket, n) values ('lock', 0, $1, $2) on conflict (kind, who, bucket) do update set n = excluded.n", [bk, LIMITS.lockFails]);
  check(`모두 합쳐 10분에 ${LIMITS.lockFails}번 틀리면 잠근다(429 locked)`, E(await call('POST', '/api/link/redeem', { key: g.key, code: open }), 429, 'locked'));
  await restoreLock();
  const rg = await call('POST', '/api/link/redeem', { key: g.key, code: open });
  check('잠금이 풀리면 같은 코드로 이어진다', rg.status === 200 && rg.body.devices === 2, `${rg.status}`);

  console.log(`요청 ${calls}번`);
} catch (e) {
  failed++;
  console.error(`중단: ${e.message}`);
} finally {
  if (KEEP) console.log('--keep: 시험 자료를 남겼다(node tools/daily-e2e.mjs --cleanup)');
  else await cleanup().catch((e) => { failed++; console.error(`정리 실패: ${e.message}`); });
}
console.log(failed ? 'LINK E2E FAIL' : 'LINK E2E OK');
process.exit(failed ? 1 : 0);
