// 순위 끝에서 끝까지 확인(CHM-70): 배포(또는 로컬 vercel dev)에 실제 요청을 보내 플레이어 만들기 · 제출 · 순위표 · 다시 짓기 · 거절을 본다.
//   node tools/daily-e2e.mjs <주소> [--vercel] [--keep]      예: node tools/daily-e2e.mjs https://chainmate-xxxx.vercel.app --vercel
//   node tools/daily-e2e.mjs --cleanup                        시험 플레이어만 지운다
// --vercel: 배포 보호가 걸린 미리 보기 배포는 `vercel curl`로 부른다(로그인한 CLI가 통과시켜 준다). 없으면 fetch.
// 미리 보기 배포도 프로덕션과 같은 DB를 쓴다 — 만든 플레이어는 곧바로 test 표시를 하고(.env.local의 직접 연결), 끝나면(실패해도) 지운다.
// 열쇠 · 비밀 값은 찍지 않는다.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDailyRun } from '../src/sim/daily.js';
import { nameText } from '../src/data/names.js';
import { summarize } from '../api/_lib/verify.js';
import { hashKey, utcDate, LIMITS } from '../api/_lib/service.js';
import { playRun } from './shopbot.mjs';
import { direct } from './db-migrate.mjs';

const args = process.argv.slice(2);
const BASE = (args.find((a) => /^https?:/.test(a)) || '').replace(/\/$/, '');
const VERCEL = args.includes('--vercel'), KEEP = args.includes('--keep'), ONLY_CLEAN = args.includes('--cleanup');
const sql = direct();

async function cleanup() {
  const gone = await sql.query('delete from players where test returning id');
  const [left] = await sql.query(`select (select count(*)::int from players where test) as players,
    (select count(*)::int from daily_scores s join players p on p.id = s.player_id where p.test) as scores,
    (select count(*)::int from daily_logs l join players p on p.id = l.player_id where p.test) as logs`);
  const [all] = await sql.query('select (select count(*)::int from players) as players, (select count(*)::int from daily_scores) as scores, (select count(*)::int from daily_logs) as logs');
  console.log(`정리: 시험 플레이어 ${gone.length}명 지움 · 남은 시험 자료 플레이어 ${left.players} · 성적 ${left.scores} · 명령 줄 ${left.logs} · DB 전체 플레이어 ${all.players} · 성적 ${all.scores} · 명령 줄 ${all.logs}`);
  if (left.players || left.scores || left.logs) throw new Error('시험 자료가 남았다');
}
if (ONLY_CLEAN) { await cleanup(); process.exit(0); }
if (!BASE) { console.error('주소를 준다: node tools/daily-e2e.mjs <주소> [--vercel]'); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chm-e2e-'));
let calls = 0;
// 돌려주는 것: { status, body(JSON 또는 null) }
async function call(method, p, body = null, headers = {}) {
  calls++;
  const h = { ...(body != null ? { 'Content-Type': 'application/json' } : {}), ...headers };
  const data = body == null ? null : typeof body === 'string' ? body : JSON.stringify(body);
  if (!VERCEL) {
    const res = await fetch(BASE + p, { method, headers: h, body: data });
    const text = await res.text();
    let j = null; try { j = JSON.parse(text); } catch { /* JSON 아님 */ }
    return { status: res.status, body: j };
  }
  const curl = ['-s', '-X', method, '-w', '\n%{http_code}'];
  for (const [k, v] of Object.entries(h)) curl.push('-H', `${k}: ${v}`);
  if (data != null) { const f = path.join(tmp, `body-${calls}.json`); fs.writeFileSync(f, data); curl.push('--data-binary', `@${f}`); }
  const out = execFileSync('vercel', ['curl', p, '--deployment', BASE, '--scope', 'paper-cut', '--', ...curl], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 24 });
  const cut = out.lastIndexOf('\n');
  let j = null; try { j = JSON.parse(out.slice(0, cut)); } catch { /* JSON 아님 */ }
  return { status: Number(out.slice(cut + 1)), body: j };
}

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const nm = (p) => `「${nameText(p.a, p.n, 'ko')}」(${nameText(p.a, p.n, 'en')})`;
async function newPlayer() {
  const r = await call('POST', '/api/player', {});
  if (r.status !== 200) throw new Error(`플레이어 만들기 실패 ${r.status} ${JSON.stringify(r.body)}`);
  const hit = await sql.query('update players set test = true where key_hash = $1 returning id', [hashKey(r.body.key)]);
  if (hit.length !== 1) throw new Error('만든 플레이어가 DB에 없다(다른 DB를 보고 있나?)');
  return r.body;
}

try {
  console.log(`대상: ${BASE}${VERCEL ? ' (vercel curl)' : ''}`);
  await cleanup(); // 앞선 시험이 남긴 것부터
  const DATE = utcDate(Date.now());

  const hello = await call('GET', '/api/hello');
  const build = hello.body && hello.body.build;
  check('GET /api/hello → { build }', hello.status === 200 && typeof build === 'string' && build.length > 0, `build ${build}`);
  check('배포 식별자가 dev가 아니다(배포에서만)', /localhost|127\.0\.0\.1/.test(BASE) || build !== 'dev', String(build));

  // 봇이 오늘의 대국을 두 번 둔다(약한 판 · 나은 판) — 서버가 같은 성적을 내는지 본다
  const logs = ['none', 'random'].map((policy) => { const run = createDailyRun(DATE); playRun(run, policy); return { policy, cmds: JSON.parse(JSON.stringify(run.cmds)), want: summarize(run) }; });
  const key = (w) => [w.ante, w.blind, w.won ? 1 : 0, w.score_total];
  logs.sort((x, y) => { const a = key(x.want), b = key(y.want); for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
  const [weak, strong] = logs;
  const same = (best, w) => !!best && best.ante === w.ante && best.blind === w.blind && best.won === w.won && best.score === w.score_total && best.battles === w.battles && best.moves === w.moves && best.ignite === w.ignite;
  const show = (w) => `${w.ante}관 ${w.blind + 1}번째 대국 · 점수 합 ${w.score_total ?? w.score}`;

  const before = await call('GET', `/api/daily/board?date=${DATE}`);
  check('GET /api/daily/board (구경, 열쇠 없이)', before.status === 200 && Array.isArray(before.body.rows) && before.body.me === null, `${DATE} · ${before.body && before.body.total}명`);
  const empty = before.body.total === 0;

  const me = await newPlayer();
  check('POST /api/player → 새 플레이어', /^[0-9a-f]{64}$/.test(me.key) && !!nameText(me.a, me.n), `${nm(me)} · 다시 짓기 ${me.rerolls}번 남음`);
  const again = await call('POST', '/api/player', { key: me.key });
  check('같은 열쇠로 물으면 같은 이름', again.status === 200 && again.body.a === me.a && again.body.n === me.n);

  const s1 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: weak.cmds });
  check(`제출(봇 ${weak.policy} 판, 명령 ${weak.cmds.length}개) → 서버 셈 = 봇 판`, s1.status === 200 && s1.body.ok && s1.body.improved === true && same(s1.body.best, weak.want), `${s1.status} ${s1.body && s1.body.best ? show(s1.body.best) : JSON.stringify(s1.body)} · ${s1.body && s1.body.rank}등/${s1.body && s1.body.total}명`);
  const s2 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: strong.cmds });
  check(`더 좋은 판(봇 ${strong.policy}, 명령 ${strong.cmds.length}개) → 갈아 끼움`, s2.status === 200 && s2.body.improved === true && same(s2.body.best, strong.want), `${s2.body && s2.body.best ? show(s2.body.best) : JSON.stringify(s2.body)}`);
  const s3 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: strong.cmds });
  check('같은 줄을 다시 제출 → improved: false', s3.status === 200 && s3.body.improved === false && same(s3.body.best, strong.want));
  const s4 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: weak.cmds });
  check('더 나쁜 판을 제출 → 그대로', s4.status === 200 && s4.body.improved === false && same(s4.body.best, strong.want));
  check(empty ? '순위 1등으로 보인다(빈 순위표였다)' : '순위가 매겨진다', empty ? s3.body.rank === 1 && s3.body.total === 1 : s3.body.rank >= 1, `${s3.body.rank}등/${s3.body.total}명`);

  // 거절
  const forged = strong.cmds.map((c) => ({ ...c }));
  const di = forged.findIndex((c) => c.type === 'drop');
  forged[di].handIndex = 30; // 손에 없는 기물을 떨군다
  const f1 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: forged });
  check('조작한 줄(없는 기물 떨구기) → 422', f1.status === 422 && f1.body.error === 'bad_cmd' && f1.body.at === di, `${f1.status} ${JSON.stringify(f1.body)}`);
  const f2 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: [...strong.cmds.slice(0, 3), { type: 'buy', slot: 0 }] });
  check('조작한 줄(상점 밖에서 사기) → 422', f2.status === 422 && f2.body.error === 'bad_cmd', JSON.stringify(f2.body));
  const f3 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: strong.cmds.slice(0, 10) });
  check('진행 중인 줄 → 422 unfinished', f3.status === 422 && f3.body.error === 'unfinished', JSON.stringify(f3.body));
  const f4 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: strong.cmds, score: 1e15, won: true });
  check('점수를 지어 보내도 서버 셈만 쓴다', f4.status === 200 && same(f4.body.best, strong.want));
  const f5 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build: 'old-build', cmds: strong.cmds });
  check('배포가 다르면 409 { stale: true }', f5.status === 409 && f5.body.stale === true, JSON.stringify(f5.body));
  const f6 = await call('POST', '/api/daily/submit', { key: me.key, date: '2020-01-01', build, cmds: strong.cmds });
  check('날짜가 ±1일 밖이면 422 bad_date', f6.status === 422 && f6.body.error === 'bad_date', JSON.stringify(f6.body));
  const f7 = await call('POST', '/api/daily/submit', { key: 'f'.repeat(64), date: DATE, build, cmds: strong.cmds });
  check('모르는 열쇠 → 401', f7.status === 401 && f7.body.error === 'unknown_key', JSON.stringify(f7.body));
  const f8 = await call('POST', '/api/player', '{nope');
  check('깨진 JSON → 400', f8.status === 400 && f8.body.error === 'bad_json', JSON.stringify(f8.body));
  const f9 = await call('POST', '/api/player', '{}', { 'Content-Type': 'text/plain' });
  check('JSON이 아닌 본문 → 415', f9.status === 415, JSON.stringify(f9.body));
  const f10 = await call('GET', '/api/hello', null, { Origin: 'https://evil.example' });
  check('다른 출처 → 403', f10.status === 403 && f10.body.error === 'bad_origin', JSON.stringify(f10.body));
  const f11 = await call('POST', '/api/daily/submit', { key: me.key, date: DATE, build, cmds: [], pad: 'x'.repeat(LIMITS.body) });
  check('본문 256KB 넘으면 413', f11.status === 413, `${f11.status} ${JSON.stringify(f11.body)}`);

  // 다시 짓기
  const r1 = await call('POST', '/api/player', { key: me.key, reroll: true });
  check('다시 짓기 → 이름이 바뀐다', r1.status === 200 && (r1.body.a !== me.a || r1.body.n !== me.n) && r1.body.rerolls === me.rerolls - 1, `${nm(me)} → ${r1.body ? nm(r1.body) : ''} · ${r1.body && r1.body.rerolls}번 남음`);

  // 쪽 넘김: 열한 명이 더 낸다(약한 판) — 내가 그 위
  const others = [];
  for (let i = 0; i < LIMITS.page + 1; i++) {
    const p = await newPlayer();
    const r = await call('POST', '/api/daily/submit', { key: p.key, date: DATE, build, cmds: weak.cmds });
    if (r.status !== 200) throw new Error(`제출 실패 ${r.status} ${JSON.stringify(r.body)}`);
    others.push({ ...p, rank: r.body.rank });
  }
  const total = before.body.total + 1 + others.length;
  const b1 = await call('GET', `/api/daily/board?date=${DATE}&page=1&key=${me.key}`);
  check('순위표 1쪽: 10줄 · 쪽 수 · 내 줄 · 내 위아래', b1.status === 200 && b1.body.rows.length === LIMITS.page && b1.body.total === total && b1.body.pages === Math.ceil(total / LIMITS.page)
    && b1.body.me && b1.body.me.a === r1.body.a && b1.body.me.n === r1.body.n && b1.body.me.score === strong.want.score_total && b1.body.around.some((r) => r.rank === b1.body.me.rank),
    `${b1.body.total}명 · ${b1.body.pages}쪽 · 나 ${b1.body.me && b1.body.me.rank}등 · 위아래 ${b1.body.around.map((r) => r.rank).join(' ')}`);
  if (empty) check('내가 1등, 순위표 첫 줄이 나', b1.body.me.rank === 1 && b1.body.rows[0].a === r1.body.a && b1.body.rows[0].n === r1.body.n && b1.body.rows[0].score === strong.want.score_total);
  const b2 = await call('GET', `/api/daily/board?date=${DATE}&page=2`);
  check('순위표 2쪽: 이어지는 등수', b2.status === 200 && b2.body.rows.length === Math.min(LIMITS.page, total - LIMITS.page) && b2.body.rows[0].rank === LIMITS.page + 1 && b2.body.me === null, `${b2.body.rows.map((r) => r.rank).join(' ')}`);
  const ranks = [...b1.body.rows, ...b2.body.rows].map((r) => r.rank);
  check('등수가 1부터 빠짐없이 이어진다', ranks.every((r, i) => r === i + 1), ranks.join(' '));
  const last = others.at(-1);
  const b3 = await call('GET', `/api/daily/board?date=${DATE}&key=${last.key}`);
  check('같은 성적은 먼저 낸 사람이 위(마지막에 낸 사람이 맨 아래)', b3.body.me && b3.body.me.rank === Math.max(...others.map((o) => o.rank)) && b3.body.around.length >= 3, `${b3.body.me && b3.body.me.rank}등 · 위아래 ${b3.body.around.map((r) => r.rank).join(' ')}`);
  const y = utcDate(Date.now() - 86400000);
  const b4 = await call('GET', `/api/daily/board?date=${y}&key=${me.key}`);
  check('어제 순위표도 준다(내 기록은 없다)', b4.status === 200 && b4.body.date === y && b4.body.me === null, `${y} · ${b4.body.total}명`);
  const b5 = await call('GET', '/api/daily/board?date=nope');
  check('틀린 날짜 → 400', b5.status === 400, JSON.stringify(b5.body));
  console.log(`요청 ${calls}번`);
} catch (e) {
  failed++;
  console.error(`중단: ${e.message}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
  if (KEEP) console.log('--keep: 시험 자료를 남겼다(node tools/daily-e2e.mjs --cleanup)');
  else await cleanup().catch((e) => { failed++; console.error(`정리 실패: ${e.message}`); });
}
console.log(failed ? `E2E FAIL (${failed})` : 'E2E OK');
process.exit(failed ? 1 : 0);
