// 점화(CHM-67, docs/design-notes/ignite.md): 판에서 처음 사슬 8 이상 또는 넘침 ×10이 나온 사슬을 run.ignite에 남기고 사건 하나를 낸다.
// 판당 한 번 · 대본 대국 · 수업 · scratch 판에서는 없다 · JSON 왕복(사슬 가운데 · 옛 저장).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, applyRun, migrateRun, igniteKey, syncBoards, IGNITE } from '../src/sim/run.js';
import { apply as applyBattle, createBattle } from '../src/sim/battle.js';
import { stepBattle } from '../tools/bot.mjs';
import { plantChain8 } from './helpers/run.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
// 명령들을 넣고 사건을 모은다
const feed = (run, cmds) => cmds.flatMap((c) => applyRun(run, c));
const ignites = (ev) => ev.filter((e) => e.type === 'ignite');
// 첫 대국을 열고 사슬 8 판을 깐다
function chainRun(opts = {}) {
  const run = createRun({ seed: 1, draft: false, ...opts });
  applyRun(run, { type: 'play' });
  return { run, cmds: plantChain8(run.battle) };
}
// ante관 첫 대국을 연다(판 보기를 그 관으로 다시 짓는다)
function openAt(ante) {
  const run = createRun({ seed: 1, draft: false });
  run.ante = ante; run.boards = null; syncBoards(run);
  applyRun(run, { type: 'play' });
  return run;
}
// 지금 대국의 목표를 1로 두고 봇이 한 수(사슬 하나)를 둔다 — 그 사슬이 목표 ×10을 넘긴다
function overflowMove(run) {
  run.battle.target = 1;
  const ev = [];
  const moves = run.battle.movesUsed;
  while (run.phase === 'battle' && run.battle.movesUsed === moves) stepBattle(run.battle, (c) => { const e = applyRun(run, c); ev.push(...e); return e; }, {});
  return ev;
}

test('사슬 8: 그 사슬의 길 · 모습 · 값 · 배수 · 점수를 남기고 사건 하나를 낸다', () => {
  const { run, cmds } = chainRun();
  const ev = feed(run, cmds);
  const ig = run.ignite;
  assert.ok(ig, '점화가 남았다');
  assert.equal(ig.by, 'chain');
  assert.deepEqual([ig.ante, ig.blind, ig.log], [1, 0, 0]);
  assert.equal(ig.captures, 8);
  assert.equal(ig.score, ig.value * ig.mult);
  const h = run.battle.history.at(-1);
  assert.deepEqual([ig.captures, ig.value, ig.mult, ig.score, ig.drop], [h.captures, h.value, h.mult, h.score, h.sq]);
  // 길: 먹은 차례대로 여덟 · 칸은 먹은 적 칸 · 옮겨 가며 먹으면 앞 먹기의 선 칸에서 · 궁수 모습은 제자리 쏘기
  assert.equal(ig.path.length, 8);
  assert.equal(ig.path[0].from, ig.drop);
  for (let i = 1; i < 8; i++) assert.equal(ig.path[i].from, ig.path[i - 1].at, `먹기 ${i + 1}`);
  const shot = ig.path.filter((p) => p.stay);
  assert.ok(shot.length >= 1 && shot.every((p) => p.form === 'S' && p.at === p.from), '제자리 쏘기 표시');
  // 거쳐 간 모습: 떨군 모습부터 마지막 모습까지 먹기 수 + 1
  assert.equal(ig.steps.length, 9);
  assert.equal(ig.steps[0], ig.path[0].form);
  const evs = ignites(ev);
  assert.equal(evs.length, 1);
  const { type, ...rest } = evs[0];
  assert.deepEqual(rest, ig);
  assert.deepEqual(igniteKey(run), { at: 1, by: 'chain' });
});

test('넘침 ×10: 3관부터 그 대국에서 목표 ×10을 넘긴 사슬을 남긴다', () => {
  assert.equal(IGNITE.overflowFrom, 3);
  const run = openAt(3);
  const ev = overflowMove(run);
  const ig = run.ignite;
  assert.ok(ev.some((e) => e.type === 'overflow' && e.tier === 10), '이 수가 ×10을 넘겼다');
  assert.ok(ig && ig.by === 'overflow', `계기 ${ig && ig.by}`);
  assert.ok(ig.captures < 8);
  const row = run.log.at(-1);
  assert.deepEqual([ig.ante, ig.blind, ig.log], [3, row.blind, run.log.length - 1]);
  assert.equal(ig.score, row.score, '대국의 유일한 사슬');
  assert.equal(ignites(ev).length, 1);
  assert.equal(ig.path.length, ig.captures);
});

test('넘침 ×10: 1 · 2관에서는 점화가 아니다(사슬 8은 관과 상관없이 점화)', () => {
  for (const ante of [1, 2]) {
    const run = openAt(ante);
    const ev = overflowMove(run);
    assert.ok(ev.some((e) => e.type === 'overflow' && e.tier === 10), `${ante}관: 이 수가 ×10을 넘겼다`);
    assert.ok(run.log.at(-1).best > 0 && !run.log.at(-1).grades['★★★'] && !run.log.at(-1).grades['∞'], `${ante}관: 사슬 8이 아니다`);
    assert.equal(ignites(ev).length, 0, `${ante}관`);
    assert.equal(run.ignite, undefined, `${ante}관`);
  }
});

test('판당 한 번: 다음 대국의 사슬 8은 남긴 점화를 바꾸지 않는다', () => {
  const run = openAt(3);
  overflowMove(run);
  const first = clone(run.ignite);
  assert.equal(run.phase, 'shop');
  applyRun(run, { type: 'leave' });
  applyRun(run, { type: 'play' });
  const ev = feed(run, plantChain8(run.battle));
  assert.equal(run.battle.history.at(-1).captures, 8);
  assert.equal(ignites(ev).length, 0);
  assert.deepEqual(run.ignite, first);
});

test('대본 대국 · scratch 판 · 수업(대국 규칙만)에서는 점화가 없다', () => {
  const scripted = chainRun({ script: true });
  assert.ok(scripted.run.battle.script, '대본 대국');
  assert.equal(ignites(feed(scripted.run, scripted.cmds)).length, 0);
  assert.equal(scripted.run.ignite, undefined);

  const run = createRun({ seed: 1, draft: false });
  run.scratch = true;
  applyRun(run, { type: 'play' });
  assert.equal(ignites(feed(run, plantChain8(run.battle))).length, 0);
  assert.equal(run.ignite, undefined);

  // 수업 · 복기 다시 두기는 대국 규칙(battle.js apply)만 돌린다 — 판(런)이 없다
  const b = createBattle({ seed: 3, ante: 1, kind: 'practice' });
  const ev = plantChain8(b).flatMap((c) => applyBattle(b, c));
  assert.equal(b.history.at(-1).captures, 8);
  assert.equal(ignites(ev).length, 0);
});

test('JSON 왕복: 사슬 가운데 저장해도 · 점화 칸이 없는 옛 저장도 같은 점화를 남긴다', () => {
  const plain = chainRun();
  feed(plain.run, plain.cmds);

  const { run, cmds } = chainRun();
  delete run.ignite; // 옛 저장: 칸 자체가 없다
  feed(run, cmds.slice(0, 4));
  let saved = migrateRun(clone(run));
  assert.ok(saved.battle.chain && !saved.battle.chain.done, '사슬 가운데');
  assert.ok(!('ignite' in saved));
  feed(saved, cmds.slice(4));
  assert.deepEqual(saved.ignite, plain.run.ignite);
  saved = clone(saved);
  assert.deepEqual(saved.ignite, plain.run.ignite, '남긴 점화도 왕복');
});
