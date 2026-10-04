// 판(런) 시험 도우미: 대국을 봇(tools/bot.mjs stepBattle)으로 끝까지 두기 · 첫 대국을 이겨 첫 상점에 서기
import assert from 'node:assert/strict';
import { createRun, applyRun } from '../../src/sim/run.js';
import { stepBattle } from '../../tools/bot.mjs';

export function finishBattle(run) {
  while (run.phase === 'battle') stepBattle(run.battle, (c) => applyRun(run, c), {});
  return run;
}

export function shopRun(seed = 1) {
  const run = createRun({ draft: false, seed });
  applyRun(run, { type: 'play' });
  finishBattle(run);
  assert.equal(run.phase, 'shop');
  return run;
}
