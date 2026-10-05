// 판(런) 시험 도우미: 대국을 봇(tools/bot.mjs stepBattle)으로 끝까지 두기 · 첫 대국을 이겨 첫 상점에 서기
import assert from 'node:assert/strict';
import { createRun, applyRun } from '../../src/sim/run.js';
import { stepBattle } from '../../tools/bot.mjs';
import { createBattle, refreshHints } from '../../src/sim/battle.js';
import { markFairy } from '../../src/sim/chain.js';
import { bestMove, lineCommands } from '../../src/sim/solver.js';

// apply: 명령을 넣는 길(기본 applyRun — 사건을 따로 받아 보려면 감싼 것을 준다)
export function finishBattle(run, apply = (c) => applyRun(run, c)) {
  while (run.phase === 'battle') stepBattle(run.battle, apply, {});
  return run;
}

export function shopRun(seed = 1) {
  const run = createRun({ draft: false, seed });
  applyRun(run, { type: 'play' });
  finishBattle(run);
  assert.equal(run.phase, 'shop');
  return run;
}

// 건너뛰기(CHM-58 ②): 꾸러미 · 금빛 꾸러미 패는 건너뛴 뒤 꾸러미가 열린다 — 넘겨 닫고 다음 대국 앞에 선다
export function skipBlind(run) {
  const ev = applyRun(run, { type: 'skip' });
  if (run.phase === 'pack') ev.push(...applyRun(run, { type: 'skipPack' }));
  return ev;
}

// 다음 상점까지: 지금 대국을 두고 목표를 0으로(이김) 또는 닿을 수 없게(짐 — 시계가 남으면 상점은 열린다) 해서 끝낸다
export function playToShop(run, { lose = false } = {}) {
  applyRun(run, { type: 'play' });
  run.battle.target = lose ? 1e12 : 0;
  finishBattle(run);
  assert.equal(run.phase, 'shop');
  return run;
}

// 점화(CHM-67): 지금 대국의 판 · 손 · 주머니를 사슬 8이 나는 자연 판(createBattle seed 46 · 5관 정식 — 풀이기 최선 사슬 8, 메이트 없음)으로
// 갈아 끼우고 목표를 닿을 수 없게 둔다. 돌려주는 값: 그 사슬의 명령(떨구기 + 먹기 여덟). 판을 갈아 끼웠으니 이형 표시 · 판 표시를 다시 잰다
export function plantChain8(b) {
  const cb = createBattle({ seed: 46, ante: 5, kind: 'official', bag: ['P', 'P', 'P', 'N', 'N', 'B', 'R', 'Q'] });
  for (const k of ['board', 'hand', 'bag']) b[k] = JSON.parse(JSON.stringify(cb[k]));
  b.nextId = Math.max(b.nextId, cb.nextId);
  markFairy(b); refreshHints(b);
  b.target = 1e12;
  const d = bestMove(b, { preferMate: false });
  assert.ok(d && d.line.length === 8 && !d.mate, '사슬 8 판');
  return [{ type: 'drop', handIndex: d.handIndex, sq: d.sq }, ...lineCommands(d.line)];
}
