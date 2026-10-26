// 안개 판의 봇(D-6, tools/bot.mjs): 봇은 사람처럼 안개 속 적(드러나지 않은 칸)을 모른다 — 그 적을 노리는 줄을 세우지 않고,
// 사슬은 잡을 때마다 드러난 칸으로 다시 풀어 끝까지 둔다(실제 규칙으로 둘 수 있는 명령만)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/data/maxims.js';
import '../src/data/masters.js';
import { createBattle, apply, isHidden } from '../src/sim/battle.js';
import { decideBattle, stepBattle } from '../tools/bot.mjs';

function fogBattle(seed, target = 400) {
  const b = createBattle({ seed, target, mods: [{ id: 'fog' }] }); // 마스터 「안개」(위 다섯 줄)
  assert.equal(b.rules.fog, 5);
  return b;
}

test('안개 판: 봇의 줄은 안개 속 칸을 잡지 않는다', () => {
  let lines = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const b = fogBattle(seed, 30); // 목표가 낮아 다시 놓지 않고 둔다
    const d = decideBattle(b);
    if (!d || !d.play) continue;
    lines++;
    for (const x of d.play.line) if (typeof x === 'number') assert.ok(!isHidden(b, x), `seed ${seed}: 안개 속 ${x}를 노린다`);
  }
  assert.ok(lines >= 6, `둔 판 ${lines}`);
});

test('안개 판: 봇이 대국을 끝까지 둔다(한 걸음씩 다시 풀어도 명령은 모두 규칙대로)', () => {
  for (let seed = 1; seed <= 8; seed++) {
    const b = fogBattle(seed);
    for (let i = 0; i < 60 && b.status === 'play'; i++) if (!stepBattle(b, (c) => apply(b, c))) break;
    assert.ok(['won', 'lost'].includes(b.status), `seed ${seed}: ${b.status}`);
  }
});
