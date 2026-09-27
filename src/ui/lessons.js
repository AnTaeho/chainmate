// 첫 수업 네 판: 손으로 짠 고정 판(시드 무관). 규칙은 실제 sim(createBattle + 판 넣기) 그대로.
//   hand   손에 쥔 기물(하나)
//   board  적 배치 { 칸: 종류 }
//   target 목표(이 판의 길로 두면 딱 닿는다)
//   demo   시범 길: [떨굴 칸, 먹을 칸…]. 끝나면 판이 처음으로 돌아간다
//   path   내 차례의 길: [떨굴 칸(null이면 첫 먹이를 먹을 수 있는 칸 아무 데나), 먹을 칸…]
//   drops  떨굴 칸을 좁힌다(없으면 path[1]을 먹을 수 있는 칸 전부)
//   preview 먹기 전 미리 보기를 켠다(수업 2부터)
import { createBattle, dropSquaresFor } from '../sim/battle.js';
import { previewDrop } from '../sim/solver.js';
import { boardFrom, parseSq } from '../sim/board.js';

export const LESSONS = [
  { id: 'drop', title: '떨구고 먹는다', hand: 'N', board: { e5: 'P' }, target: 10, demo: ['d3', 'e5'], path: [null, 'e5'], preview: false },
  { id: 'become', title: '잡으면 그것이 된다', hand: 'N', board: { d4: 'R', d8: 'B' }, target: 160, demo: ['c2', 'd4', 'd8'], path: [null, 'd4', 'd8'], preview: true, bigFlip: true },
  { id: 'chain', title: '이을수록 곱해진다', hand: 'N', board: { d5: 'Q', d2: 'B', h6: 'R', h2: 'B' }, target: 800, demo: ['e7', 'd5', 'd2', 'h6', 'h2'], path: ['e7', 'd5', 'd2', 'h6', 'h2'], preview: true },
  { id: 'guard', title: '노리는 놈부터', hand: 'N', board: { d5: 'R', f7: 'B' }, target: 160, demo: ['c3', 'd5'], path: [null, 'f7', 'd5'], preview: true },
];

export function lessonBattle(L) {
  const b = createBattle({ seed: 1, ante: 1, kind: 'practice', bag: [{ t: L.hand }], target: L.target, rules: { moves: 1, discards: 0, reinforce: 0, easyStart: false }, golden: false });
  b.board = boardFrom(L.board);
  b.hand = [{ t: L.hand, id: 1, eng: null }];
  b.bag = [];
  b.incoming = []; b.incomingNext = [];
  b.lesson = L.id;
  return b;
}

// 길을 칸 번호로
export const lessonSq = (s) => (s == null ? null : parseSq(s));

// 내 차례에 떨굴 수 있는 칸: 규칙상 떨굴 칸 중 첫 먹이를 먹을 수 있는 칸(path[0]이 있으면 그 칸만)
export function lessonDrops(b, L) {
  const first = lessonSq(L.path[1]);
  const legal = dropSquaresFor(b, b.hand[0]);
  const pick = L.path[0] ? [lessonSq(L.path[0])] : legal;
  return pick.filter((sq) => legal.includes(sq) && previewDrop(b, 0, sq).next.includes(first));
}
