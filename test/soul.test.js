// 깊이 C: 혼 여덟
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boardFrom, parseSq as S, attackers } from '../src/sim/board.js';
import { startChain, chainCaptures, chainCapture } from '../src/sim/chain.js';
import { SOULS, soulSpec, MARTYR } from '../src/data/souls.js';
import { createRun, applyRun } from '../src/sim/run.js';
import { createBattle, apply } from '../src/sim/battle.js';
import { familyCounts } from '../src/data/families.js';
import { bestMove } from '../src/sim/solver.js';

const T = (map) => ({ board: boardFrom(map), rules: {}, mods: [], chain: null });
const go = (map, type, sq, soul, caps = []) => { const t = T(map); startChain(t, { type, sq: S(sq), soul: soulSpec(soul) }); for (const c of caps) chainCapture(t, S(c)); return t; };

test('혼 여덟 · 가족이 있고 세기에 들어간다', () => {
  assert.equal(SOULS.length, 8);
  const n = familyCounts({ maxims: [], deck: [{ t: 'N', soul: 'hunger' }, { t: 'P', soul: 'hunter' }] });
  assert.equal(n.hunt, 2);
});

test('흡수: 모습은 그대로, 먹은 행마가 더해진다', () => {
  const t = go({ e6: 'B', g8: 'P' }, 'N', 'd4', 'absorb', ['e6']);
  assert.equal(t.chain.form, 'N');
  assert.ok(chainCaptures(t).includes(S('g8')));
});

test('메아리: 막히면 한 번 떨군 모습으로 돌아가 잇는다', () => {
  // N d4 → e6(B) … 비숍으로는 더 없고, 나이트로 돌아가 e6에서 d8을 먹는다
  const t = go({ e6: 'B', d8: 'P' }, 'N', 'd4', 'echo', ['e6']);
  assert.equal(t.chain.form, 'N');
  assert.deepEqual(chainCaptures(t), [S('d8')]);
});

test('초월: 먹힌 모습 대신 한 단계 위로', () => {
  const t = go({ e6: 'P', f4: 'P' }, 'N', 'd4', 'transcend', ['e6']);
  assert.equal(t.chain.form, 'B', '폰을 먹었지만 나이트 › 비숍');
});

test('굶주림: 먹을수록 값이 커진다', () => {
  const t = go({ e6: 'B', f7: 'P' }, 'N', 'd4', 'hunger', ['e6', 'f7']);
  assert.equal(t.chain.value, 30 + 10 + 10);
});

test('사냥꾼: 같은 종류를 잇달아 먹으면 연쇄 ×2', () => {
  const t = go({ e6: 'N', f8: 'N' }, 'N', 'd4', 'hunter', ['e6', 'f8']);
  assert.equal(t.chain.mult, (1 + 1) * 2);
});

test('순교자: 끊기면 둘레 적을 먹은 것으로', () => {
  const t = go({ e6: 'P', e8: 'R', d7: 'N' }, 'B', 'c4', 'martyr', ['e6']);
  assert.equal(t.chain.reason, 'cut');
  assert.equal(t.board[S('d7')], null);
});

test('순교자: 킹을 지키는 적은 남긴다', () => {
  // d7 나이트는 f8 킹을 지킨다 — 남고, f5 폰만 먹는다
  const t = go({ e6: 'P', e8: 'R', d7: 'N', f5: 'P', f8: 'K' }, 'B', 'c4', 'martyr', ['e6']);
  assert.equal(t.chain.reason, 'cut');
  assert.equal(t.board[S('d7')].t, 'N');
  assert.equal(t.board[S('f5')], null);
  assert.equal(t.board[S('f8')].t, 'K');
  assert.ok(attackers(t.board, S('f8')).includes(S('d7')), '킹은 여전히 지켜진다');
});

test('순교자: 내 기물이 막던 선의 수비수도 남긴다', () => {
  // e7 룩은 끊는 적이자, 내 기물(e6)이 내려가면 e2 킹을 지킨다
  const t = go({ e6: 'P', e7: 'R', f5: 'P', e2: 'K' }, 'B', 'c4', 'martyr', ['e6']);
  assert.equal(t.chain.reason, 'cut');
  assert.equal(t.board[S('e7')].t, 'R');
  assert.equal(t.board[S('f5')], null);
});

test('순교자: 값이 큰 적부터 둘까지만 · 같으면 칸 차례', () => {
  // 둘레: f6 룩 50 · d6 비숍 30 · d7 나이트 30 · f5 폰 10 → 룩과 d6 비숍(칸 번호가 d7보다 앞)
  const t = go({ e6: 'P', e8: 'R', d7: 'N', f5: 'P', d6: 'B', f6: 'R' }, 'B', 'c4', 'martyr', ['e6']);
  assert.equal(MARTYR.take, 2);
  assert.equal(t.chain.reason, 'cut');
  assert.equal(t.board[S('f6')], null);
  assert.equal(t.board[S('d6')], null);
  assert.equal(t.board[S('d7')].t, 'N');
  assert.equal(t.board[S('f5')].t, 'P');
  assert.equal(t.chain.value, 10 + 50 + 30);
  assert.equal(t.chain.mult, 1 + 2);
});

test('순교자: 벽은 먹지 않는다', () => {
  const t = go({ e6: 'P', e8: 'R', f5: 'X' }, 'B', 'c4', 'martyr', ['e6']);
  assert.equal(t.board[S('f5')].t, 'X');
});

test('왕관: 승급 칸이 두 줄 앞, 아마존이 된다', () => {
  const t = go({ c6: 'P' }, 'N', 'b4', 'crown', ['c6']);
  assert.equal(t.chain.form, 'Z');
  assert.equal(t.chain.promotions, 1);
});

test('그림자: 노림이 보지 못해 응수 없이 이어진다', () => {
  const t = go({ e6: 'P', e8: 'R', f3: 'B' }, 'B', 'c4', 'shade', ['e6']);
  assert.equal(t.chain.forced, null);
  assert.notEqual(t.chain.reason, 'cut');
});

test('그림자: 한 사슬에서 한 번만 무시한다 · 배수 그대로', () => {
  // c4 비숍 × e6(e8 룩이 지킴 — 무시) → 폰 모습 × d7(c8 비숍이 지킴 — 이번엔 응수) → 나이트로 c8에 못 닿아 끊김
  const t = go({ e6: 'P', e8: 'R', d7: 'N', c8: 'B' }, 'B', 'c4', 'shade', ['e6']);
  assert.equal(t.chain.forced, null);
  chainCapture(t, S('d7'));
  assert.equal(t.chain.reason, 'cut');
  assert.equal(t.chain.mult, 2, '사슬 끝에 배수를 깎지 않는다');
});

test('그림자: 지켜진 킹은 먹을 수 없다', () => {
  const open = go({ e6: 'K', b5: 'P' }, 'B', 'c4', 'shade');
  assert.ok(chainCaptures(open).includes(S('e6')), '지켜지지 않은 킹은 먹는다');
  const guarded = go({ e6: 'K', e8: 'R', b5: 'P' }, 'B', 'c4', 'shade');
  assert.ok(!chainCaptures(guarded).includes(S('e6')));
  // d5를 먹으면 킹이 노린다(무시) — 폰 모습으로 e6 킹은 e8 룩이 지키면 못 먹고, 없으면 먹는다
  const bare = go({ d5: 'P', e6: 'K' }, 'B', 'c4', 'shade', ['d5']);
  assert.ok(chainCaptures(bare).includes(S('e6')));
  const kept = go({ d5: 'P', e6: 'K', e8: 'R' }, 'B', 'c4', 'shade', ['d5']);
  assert.ok(!chainCaptures(kept).includes(S('e6')));
  assert.equal(kept.board[S('e6')].t, 'K');
});

test('혼 두루마리를 사서 기물에 깃들이고 대국에서 쓴다 · 저장 왕복', () => {
  const run = createRun({ seed: 3, draft: false });
  run.consumables.push({ kind: 'soul', id: 'hunger' });
  const pid = run.deck[5].id;
  applyRun(run, { type: 'use', index: 0, target: pid });
  assert.equal(run.deck[5].soul, 'hunger');
  applyRun(run, { type: 'play' });
  assert.ok(run.battle.bag.concat(run.battle.hand).some((p) => p.soul === 'hunger'));
  assert.deepEqual(JSON.parse(JSON.stringify(run)), run);
  const b = run.battle;
  const m = bestMove(b);
  assert.ok(m);
});

test('혼 기물로 대국이 결정적으로 돈다', () => {
  const play = () => {
    const b = createBattle({ seed: 8, bag: [{ t: 'N', soul: 'echo' }, { t: 'B', soul: 'transcend' }, { t: 'R', soul: 'absorb' }, { t: 'P', soul: 'crown' }, 'N', 'B', 'P', 'P'] });
    let s = '';
    for (let g = 0; g < 30 && b.status === 'play'; g++) {
      const m = bestMove(b);
      if (!m) break;
      s += JSON.stringify(apply(b, { type: 'drop', handIndex: m.handIndex, sq: m.sq }));
      for (const c of m.line) if (b.status === 'chain') s += JSON.stringify(apply(b, typeof c === 'number' ? { type: 'capture', sq: c } : c));
    }
    return s + b.score;
  };
  assert.equal(play(), play());
});
