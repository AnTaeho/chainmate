// 판 보기(CHM-61, docs/design-notes/agency.md E): 관 선택에서 보인 판 = 두기를 눌러 여는 판.
import test from 'node:test';
import assert from 'node:assert/strict';
import { skipBlind } from './helpers/run.js';
import { createRun, applyRun, migrateRun, syncBoards, previewBattle, battleOpts, layoutFor, blindInfo, ANTES } from '../src/sim/run.js';
import { createBattle, battleLayout, isHidden, visibleIncoming, hasLegalDrop } from '../src/sim/battle.js';
import { dailySeed } from '../src/ui/records.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
// 화면이 보는 것: 판(적 · 벽 · 보석 · 금빛 · 특성 · 횃불) · 증원 예고 · 안개
const look = (b) => ({ board: b.board, incoming: visibleIncoming(b), hidden: b.board.map((_, sq) => isHidden(b, sq)), rules: b.rules, nextId: b.nextId });
// 관 선택 자리를 만든다(관 · 대국 칸을 옮겨 놓고 판을 다시 짓는다)
function at(run, ante, blind) {
  run.ante = ante; run.blind = blind; run.phase = 'select'; run.boards = null; run.shop = null;
  syncBoards(run);
  return run;
}
function playAndCompare(run, msg) {
  const pv = previewBattle(run);
  applyRun(run, { type: 'play' });
  assert.deepEqual(look(run.battle), look(pv), msg);
  // 손만 빼면 대국 상태 전부가 같다(손은 미리 보이지 않을 뿐 같은 시드로 섞인다)
  assert.deepEqual(clone(run.battle), clone(pv), msg);
}

test('판 보기: 지어 둔 판으로 연 대국 = 판을 그 자리에서 지어 연 대국(같은 입력)', () => {
  for (const seed of [1, 2, 3, 7, 11]) for (const ante of [1, 3, 5, 8]) for (const blind of [0, 1, 2]) {
    const run = at(createRun({ seed, draft: false }), ante, blind);
    const { opts } = battleOpts(run);
    const plain = createBattle(opts);
    const laid = createBattle({ ...opts, layout: battleLayout(opts) });
    assert.deepEqual(clone(laid), clone(plain), `seed ${seed} · ${ante}관 · ${blind}`);
  }
});

test('판 보기: 미리 본 판 = 대국 시작 판(시드 · 세력 · 단 · 대국 종류)', () => {
  for (const dan of [0, 4, 8]) for (const seed of [1, 5, 9, 13]) for (let ante = 1; ante <= ANTES; ante++) for (const blind of [0, 1, 2]) {
    const run = at(createRun({ seed, dan, draft: false }), ante, blind);
    playAndCompare(run, `단 ${dan} · seed ${seed} · ${ante}관(${blindInfo(run).faction}) · ${blind}`);
  }
});

test('판 보기: 숲 사냥꾼(안개) 판은 안개 칸이 미리 보기에도 가려진다', () => {
  let seen = 0;
  for (let seed = 1; seed <= 40 && seen < 6; seed++) {
    const run = createRun({ seed, draft: false });
    const ante = run.factions.indexOf('hunters') + 1;
    if (ante < 1) continue;
    for (const blind of [0, 1, 2]) {
      const r = at(clone(run), ante, blind);
      const pv = previewBattle(r);
      assert.ok(pv.rules.fog >= 2);
      assert.ok(pv.board.some((_, sq) => isHidden(pv, sq)));
      playAndCompare(r, `seed ${seed} · ${ante}관 숲 · ${blind}`);
      seen++;
    }
  }
  assert.ok(seen >= 6);
});

test('판 보기: 관 선택에서 껐다 켜도(저장 왕복) 같은 판', () => {
  for (const seed of [2, 4, 6, 8]) {
    const run = at(createRun({ seed, draft: false }), 3, 0);
    const before = [0, 1, 2].map((i) => look(previewBattle(run, i)));
    const back = migrateRun(clone(run));
    assert.deepEqual(back.boards, run.boards);
    assert.deepEqual([0, 1, 2].map((i) => look(previewBattle(back, i))), before);
    playAndCompare(back, `seed ${seed}`);
  }
});

test('판 보기: 지은 뒤 주머니 · 기보가 바뀌어도 판은 그대로(손만 새 주머니로)', () => {
  for (const seed of [1, 3, 5, 7, 9, 11]) {
    const run = at(createRun({ seed, draft: false }), 4, 0);
    const want = [1, 2].map((i) => clone(previewBattle(run, i).board));
    // 상점에서 산 것 · 건너뛰기 패의 기보와 같은 변화
    run.deck.push({ id: 99, t: 'N', eng: null, edition: null }, { id: 98, t: 'R', eng: null, edition: null });
    run.charts.N += 2; run.charts.R += 1;
    syncBoards(run);
    assert.deepEqual([1, 2].map((i) => clone(previewBattle(run, i).board)), want, `seed ${seed}`);
    run.blind = 1; syncBoards(run);
    playAndCompare(run, `seed ${seed} 정식`);
  }
});

test('판 보기: 판 짓기가 읽는 규칙이 바뀌면(메이트 사냥꾼) 다시 지은 판이 보이고 그 판으로 둔다', () => {
  const run = at(createRun({ seed: 3, draft: false }), 5, 0);
  const g0 = run.boards[1].gen;
  run.maxims.push({ uid: run.nextUid++, id: 'mate_hunter', data: {}, edition: null, paid: 0 });
  syncBoards(run);
  assert.notEqual(run.boards[1].gen, g0);
  run.blind = 1; syncBoards(run);
  playAndCompare(run, '메이트 사냥꾼 뒤 정식');
});

test('판 보기: 건너뛴 뒤 다음 대국은 건너뛰기 전에 보인 그 판', () => {
  let n = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const run = at(createRun({ seed, draft: false }), 2 + (seed % 5), 0);
    const want = [1, 2].map((i) => look(previewBattle(run, i)));
    skipBlind(run);
    assert.equal(run.blind, 1);
    assert.deepEqual(look(previewBattle(run)), want[0], `seed ${seed}`);
    assert.deepEqual(look(previewBattle(run, 2)), want[1], `seed ${seed}`);
    if (blindInfo(run, run.ante, 0).tag.kind === 'chart') n++;
    playAndCompare(run, `seed ${seed} 건너뛴 뒤`);
  }
  assert.ok(n > 0, '기보 패를 받은 건너뛰기도 하나는 잰다');
});

test('판 보기: 8관 마스터전을 다시 두면 새 판을 짓고 그 판을 보인다', () => {
  const run = at(createRun({ seed: 5, draft: false }), 8, 2);
  const first = clone(run.boards[2]);
  run.retry = 1; syncBoards(run);
  assert.notEqual(run.boards[2].seed, first.seed);
  playAndCompare(run, '다시 두기');
});

test('판 보기: 끝없는 대국 · 오늘의 대국', () => {
  const run = at(createRun({ seed: 21, draft: false }), 10, 0);
  run.endless = true; syncBoards(run);
  for (const blind of [0, 1, 2]) { const r = clone(run); r.blind = blind; syncBoards(r); playAndCompare(r, `끝없는 ${blind}`); }
  const daily = createRun({ seed: dailySeed('2026-10-03'), opening: 'standard' });
  applyRun(daily, { type: 'joseki', index: 0 });
  assert.equal(daily.phase, 'select');
  assert.ok(daily.boards[0] && daily.boards[1] && daily.boards[2]);
  playAndCompare(daily, '오늘의 대국 1관 연습');
});

test('판 보기: 판(런) 흐름 그대로 — 관 선택에 설 때마다 남은 대국판이 지어져 있다', () => {
  const run = createRun({ seed: 17, draft: false });
  assert.equal(run.phase, 'select');
  assert.deepEqual(run.boards.map((x) => !!x), [true, true, true]);
  skipBlind(run);
  assert.deepEqual(run.boards.map((x) => !!x), [false, true, true]);
  // 지어 둔 것을 쓰는지: 판 칸 하나를 몰래 바꾸면 그 판으로 연다
  run.boards[1].board[60] = { t: 'X', id: 9999, born: -1 };
  assert.equal(layoutFor(run).board[60].t, 'X');
  applyRun(run, { type: 'play' });
  assert.equal(run.battle.board[60].t, 'X');
});

test('판 보기: 대본 대국 1관 연습은 미리 보기가 없고 정해 둔 판', () => {
  const run = createRun({ seed: 3, script: true });
  assert.equal(run.boards[0], null);
  assert.equal(previewBattle(run, 0), null);
  assert.ok(run.boards[1]);
});

test('판 보기: 미리 지은 판에서도 시작 손이 떨굴 곳을 갖는다(여러 판)', () => {
  let n = 0, stuck = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const run = at(createRun({ seed, draft: false }), 1 + (seed % 8), 0);
    // 지은 뒤 주머니가 크게 바뀐 경우
    run.deck = run.deck.filter((p) => p.t !== 'P').concat([{ id: 90, t: 'Q', eng: null, edition: null }]);
    for (const blind of [0, 1, 2]) { const b = previewBattle(run, blind); n++; if (!hasLegalDrop(b)) stuck++; }
  }
  assert.equal(stuck, 0, `${stuck}/${n}`);
});
