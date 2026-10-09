// 순위의 조작 막기(CHM-70, api/_lib/verify.js): 서버가 명령 줄을 다시 두어 낸 성적이 그 판을 둔 쪽의 성적과 같은가,
// 고친 · 뺀 · 지어낸 명령을 거절하는가, 우승 뒤 끝없는 대국을 빼는가, 진행 중 판을 거절하는가, 명령 기록이 저장 왕복에 안전한가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRun, createRun } from '../src/sim/run.js';
import { createDailyRun, dailySeed, DAILY } from '../src/sim/daily.js';
import { dailySeed as uiSeed } from '../src/ui/records.js';
import { playRun } from '../tools/shopbot.mjs';
import { finishBattle } from './helpers/run.js';
import { verifyDaily, replayRun, summarize, cleanCmd, VerifyError, LIMITS } from '../api/_lib/verify.js';
import { rankKey, compareRank, better } from '../api/_lib/rank.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const code = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof VerifyError, String(e)); return e.code; } return null; };
// 봇이 오늘의 대국 판을 끝까지 둔다. 돌려주는 것: { run, cmds(JSON 왕복한 것 — 서버가 받는 꼴), want }
const played = new Map();
function botDaily(date, policy) {
  const k = `${date}:${policy}`;
  if (!played.has(k)) {
    const run = createDailyRun(date);
    playRun(run, policy);
    played.set(k, { run, cmds: clone(run.cmds), want: summarize(run) });
  }
  return played.get(k);
}
const DATES = [['2026-10-08', 'smart'], ['2026-10-09', 'random'], ['2026-12-31', 'none']];

test('오늘의 대국 판: 화면과 서버가 같은 판을 만든다(시드 · 스탠다드 · 단 0), 명령 줄이 빈 채로 시작', () => {
  const run = createDailyRun('2026-10-08');
  assert.equal(uiSeed, dailySeed);
  assert.equal(run.seed, dailySeed('2026-10-08'));
  assert.equal(run.daily, '2026-10-08');
  assert.deepEqual(run.cmds, []);
  const plain = createRun({ seed: dailySeed('2026-10-08'), ...DAILY });
  const { daily, cmds, ...rest } = run;
  assert.deepEqual(rest, plain);
  assert.notEqual(dailySeed('2026-10-08'), dailySeed('2026-10-09'));
});

test('명령 기록: 성공한 명령만 차례대로 남고, 거절된 명령은 남지 않으며, 보통 판에는 기록이 없다', () => {
  const run = createDailyRun('2026-10-08');
  assert.throws(() => applyRun(run, { type: 'leave' }));
  assert.deepEqual(run.cmds, []);
  const cmd = { type: 'joseki', index: 0 };
  applyRun(run, cmd);
  cmd.index = 9; // 넣은 뒤에 고쳐도 기록은 그대로
  assert.deepEqual(run.cmds, [{ type: 'joseki', index: 0 }]);
  const plain = createRun({ seed: 3 });
  applyRun(plain, { type: 'joseki', index: 0 });
  assert.equal('cmds' in plain, false);
});

for (const [date, policy] of DATES) {
  test(`다시 두기: 봇(${policy})이 둔 ${date} 판 = 서버 셈(관 · 대국 · 승패 · 점수 합 · 대국 수 · 수 · 점화)`, () => {
    const { run, cmds, want } = botDaily(date, policy);
    assert.ok(run.phase === 'lost' || run.phase === 'won');
    assert.ok(cmds.length > 20 && cmds.length < LIMITS.cmds);
    const t0 = performance.now();
    const got = verifyDaily(date, cmds);
    const ms = performance.now() - t0;
    assert.deepEqual(got, { ...want, used: cmds.length });
    assert.equal(got.score_total, run.log.reduce((a, x) => a + (x.score || 0), 0));
    assert.ok(got.score_total > 0);
    assert.ok(ms < 5000, `다시 두기 ${Math.round(ms)}ms`);
    console.log(`  다시 두기 ${date} ${policy}: 명령 ${cmds.length}개 · ${JSON.stringify(cmds).length}바이트 · ${Math.round(ms)}ms`);
  });
}

test('명령 기록은 저장 왕복(JSON)에 안전하다: 판 중간에 저장하고 이어 두어도 서버 셈이 같다', () => {
  const { cmds, want } = botDaily('2026-10-09', 'random');
  const half = Math.floor(cmds.length / 2);
  const a = createDailyRun('2026-10-09');
  for (const c of cmds.slice(0, half)) applyRun(a, c);
  const b = clone(a); // 저장했다가 다시 읽은 판
  for (const c of cmds.slice(half)) applyRun(b, c);
  assert.deepEqual(b.cmds, cmds);
  assert.deepEqual(summarize(b), want);
  assert.deepEqual(verifyDaily('2026-10-09', clone(b.cmds)), { ...want, used: cmds.length });
});

test('다른 날짜의 명령 줄 · 명령을 고치거나 뺀 줄은 거절되거나 더 좋지 않은 다른 결과가 된다', () => {
  const { cmds, want } = botDaily('2026-10-08', 'smart');
  assert.ok(['bad_cmd', 'unfinished'].includes(code(() => verifyDaily('2026-10-10', cmds))));
  let rejected = 0, same = 0, n = 0;
  const step = Math.max(1, Math.floor(cmds.length / 40));
  for (let i = 0; i < cmds.length; i += step) {
    for (const forged of [cmds.filter((_, k) => k !== i), cmds.map((c, k) => (k === i && 'sq' in c ? { ...c, sq: (c.sq + 1) % 64 } : c))]) {
      if (JSON.stringify(forged) === JSON.stringify(cmds)) continue;
      n++;
      let got = null;
      const c = code(() => { got = verifyDaily('2026-10-08', forged); });
      if (c) { assert.ok(['bad_cmd', 'unfinished'].includes(c)); rejected++; }
      else if (JSON.stringify({ ...got, used: 0 }) === JSON.stringify({ ...want, used: 0 })) same++;
    }
  }
  assert.ok(n >= 40);
  assert.ok(rejected > n / 2, `거절 ${rejected}/${n}`);
  assert.ok(same < n / 4, `같은 결과 ${same}/${n}`);
});

test('지어낸 명령은 규칙이 거절한다: 없는 기물 떨구기 · 돈 없이 사기 · 대국 밖의 먹기 · 모르는 명령', () => {
  const head = [{ type: 'joseki', index: 0 }, { type: 'play' }];
  const run = createDailyRun('2026-10-08');
  for (const c of head) applyRun(run, c);
  assert.equal(run.phase, 'battle');
  const at = (cmds) => { try { verifyDaily('2026-10-08', cmds); } catch (e) { return [e.code, e.at]; } return null; };
  assert.deepEqual(at([...head, { type: 'drop', handIndex: 40, sq: 0 }]), ['bad_cmd', 2]);       // 손에 없는 기물
  assert.deepEqual(at([...head, { type: 'capture', sq: 3 }]), ['bad_cmd', 2]);                  // 사슬도 없이 먹기
  assert.deepEqual(at([...head, { type: 'buy', slot: 0 }]), ['bad_cmd', 2]);                    // 대국 중에 사기
  assert.deepEqual(at([{ type: 'joseki', index: 0 }, { type: 'buy', slot: 0 }]), ['bad_cmd', 1]); // 상점 밖에서 사기
  assert.deepEqual(at([...head, { type: 'win' }]), ['bad_cmd', 2]);
  assert.deepEqual(at([{ type: 'endless' }]), ['bad_cmd', 0]);
  // 첫 상점에서 돈보다 비싼 것을 산다
  const { cmds } = botDaily('2026-12-31', 'none');
  const shop = createDailyRun('2026-12-31');
  let i = 0;
  while (shop.phase !== 'shop') applyRun(shop, cmds[i++]);
  shop.money = 0;
  const pricey = shop.shop.display.findIndex((it) => !it.sold && (it.price || 0) > 0);
  assert.ok(pricey >= 0);
  assert.throws(() => applyRun(shop, { type: 'buy', slot: pricey }));
  const fresh = createDailyRun('2026-12-31');
  for (const c of cmds.slice(0, i)) applyRun(fresh, c);
  const broke = [...cmds.slice(0, i)];
  for (let k = 0; k < 40; k++) broke.push({ type: 'reroll' }); // 돈이 떨어질 때까지 다시 뽑기
  assert.deepEqual(at(broke).slice(0, 1), ['bad_cmd']);
});

test('명령 꼴 거르기: 모르는 종류 · 딴 칸 · 문자열 번호 · 음수 · 소수 · 긴 배열은 규칙에 닿기 전에 버린다', () => {
  assert.deepEqual(cleanCmd({ type: 'drop', handIndex: 1, sq: 20 }), { type: 'drop', handIndex: 1, sq: 20 });
  assert.deepEqual(cleanCmd({ type: 'pick', index: 0 }), { type: 'pick', index: 0 });
  assert.deepEqual(cleanCmd({ type: 'pick', index: 0, target: null }), { type: 'pick', index: 0 });
  assert.deepEqual(cleanCmd({ type: 'promote', pieceId: 3, to: 'Q' }), { type: 'promote', pieceId: 3, to: 'Q' });
  assert.deepEqual(cleanCmd({ type: 'discard', handIndices: [0, 2] }), { type: 'discard', handIndices: [0, 2] });
  for (const bad of [null, 1, 'play', [], {}, { type: 1 }, { type: 'nope' }, { type: 'toString' }, { type: '__proto__' }, { type: 'play', extra: 1 },
    { type: 'joseki' }, { type: 'joseki', index: '0' }, { type: 'joseki', index: 'constructor' }, { type: 'joseki', index: -1 }, { type: 'joseki', index: 0.5 },
    { type: 'joseki', index: 1e9 }, { type: 'drop', handIndex: 0 }, { type: 'discard', handIndices: 0 }, { type: 'discard', handIndices: Array(17).fill(0) },
    { type: 'discard', handIndices: ['0'] }, { type: 'promote', pieceId: 1, to: 3 }, { type: 'promote', pieceId: 1, to: '__proto__x' }, { type: 'moveMaxim', from: 0 }]) {
    assert.equal(cleanCmd(bad), null, JSON.stringify(bad));
  }
  // 받은 객체를 그대로 쓰지 않는다(새 객체)
  const src = { type: 'discard', handIndices: [1] };
  const out = cleanCmd(src);
  assert.notEqual(out, src);
  assert.notEqual(out.handIndices, src.handIndices);
  // 화면 · 봇이 넣는 명령은 모두 꼴 거르기를 통과한다(거른 것 = 넣은 것)
  for (const [date, policy] of DATES) for (const c of botDaily(date, policy).cmds) assert.deepEqual(cleanCmd(c), c);
});

test('입력 꼴: 틀린 날짜 · 배열 아닌 명령 줄 · 5000개를 넘는 줄', () => {
  for (const d of ['2026-13-01', '2026-02-30', '20261008', '', null, 20261008, '2026-10-08T00:00:00Z']) assert.equal(code(() => verifyDaily(d, [])), 'bad_date', String(d));
  for (const c of [null, {}, 'x', 3]) assert.equal(code(() => verifyDaily('2026-10-08', c)), 'bad_cmds');
  assert.equal(code(() => verifyDaily('2026-10-08', Array(LIMITS.cmds + 1).fill({ type: 'play' }))), 'bad_cmds');
});

test('진행 중인 판(아직 안 끝남)은 거절한다', () => {
  const { cmds } = botDaily('2026-10-08', 'smart');
  assert.equal(code(() => verifyDaily('2026-10-08', [])), 'unfinished');
  assert.equal(code(() => verifyDaily('2026-10-08', cmds.slice(0, 1))), 'unfinished');
  assert.equal(code(() => verifyDaily('2026-10-08', cmds.slice(0, cmds.length - 1))), 'unfinished');
  // 진 뒤에 덧붙인 명령은 규칙이 거절한다
  assert.equal(code(() => verifyDaily('2026-10-08', [...cmds, { type: 'play' }])), 'bad_cmd');
});

test('8관 우승 뒤의 명령(끝없는 대국)은 보지 않고 우승 시점에서 끊는다', () => {
  // 8관 마스터전 앞에 세운 판(목표 1)에서 시작한다 — 다시 두기는 같은 출발 판의 복사본에
  const start = createDailyRun('2026-10-08');
  applyRun(start, { type: 'joseki', index: 0 });
  start.ante = 8; start.blind = 2;
  applyRun(start, { type: 'play' });
  start.battle.target = 1;
  start.cmds = [];
  const snap = clone(start);
  const run = clone(start);
  finishBattle(run);
  assert.equal(run.phase, 'won');
  const winCmds = clone(run.cmds);
  const want = summarize(run);
  assert.deepEqual([want.ante, want.blind, want.won], [8, 2, true]);
  // 끝없는 대국으로 이어 둔다: 화면의 판은 더 남기지 않는다
  applyRun(run, { type: 'endless' });
  applyRun(run, { type: 'leave' });
  assert.equal(run.ante, 9);
  assert.deepEqual(run.cmds, winCmds);
  // 클라이언트가 끝없는 대국 명령까지 보내도 우승 시점의 성적만 센다
  const sent = [...winCmds, { type: 'endless' }, { type: 'leave' }, { type: 'play' }, { type: 'nonsense' }];
  assert.deepEqual(replayRun(clone(snap), sent), { ...want, used: winCmds.length });
  assert.deepEqual(replayRun(clone(snap), winCmds), { ...want, used: winCmds.length });
  // 우승 전의 endless는 거절
  assert.equal(code(() => replayRun(clone(snap), [{ type: 'endless' }])), 'bad_cmd');
});

test('다시 두기는 명령 5000개(한도)에도 30초 안에 끝난다', () => {
  // 가장 비싼 꼴 가운데 하나: 봇 판의 첫 상점까지 간 뒤 떠났다 돌아오기를 한도까지 되풀이
  const { cmds } = botDaily('2026-12-31', 'none');
  const run = createDailyRun('2026-12-31');
  let i = 0;
  while (run.phase !== 'shop') applyRun(run, cmds[i++]);
  const long = cmds.slice(0, i);
  while (long.length + 2 <= LIMITS.cmds) long.push({ type: 'leave' }, { type: 'shop' });
  const t0 = performance.now();
  assert.equal(code(() => verifyDaily('2026-12-31', long)), 'unfinished');
  const ms = performance.now() - t0;
  console.log(`  다시 두기 한도 ${long.length}개: ${Math.round(ms)}ms`);
  assert.ok(ms < 30000, `${Math.round(ms)}ms`);
});

test('줄 세우기 열쇠: 도달한 관 → 대국 → 이겼는지 → 점수 합', () => {
  const r = (ante, blind, won, score_total) => ({ ante, blind, won, score_total });
  assert.deepEqual(rankKey(r(8, 2, true, 10)), [8, 2, 1, 10]);
  const list = [r(3, 1, false, 999999), r(8, 2, false, 5), r(8, 2, true, 1), r(4, 0, false, 1), r(8, 2, true, 7), r(3, 2, false, 0), r(3, 1, false, 5)];
  assert.deepEqual([...list].sort(compareRank), [r(8, 2, true, 7), r(8, 2, true, 1), r(8, 2, false, 5), r(4, 0, false, 1), r(3, 2, false, 0), r(3, 1, false, 999999), r(3, 1, false, 5)]);
  assert.equal(better(r(2, 0, false, 1), null), true);
  assert.equal(better(r(2, 0, false, 1), r(2, 0, false, 1)), false);
  assert.equal(better(r(2, 0, false, 2), r(2, 0, false, 1)), true);
  assert.equal(better(r(2, 0, false, 9), r(2, 1, false, 1)), false);
});
