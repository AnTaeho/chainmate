// 첫 수업 열: 기초 넷 · 대국 넷 · 판 둘. 손으로 짠 고정 판(시드 무관), 규칙은 실제 sim(createBattle + 판 넣기) 그대로.
// 수업마다 시범(흐린 손가락이 한 번 둔다 → 판이 처음으로) → 내 차례(지금 누를 곳만 빛나고, 오른쪽에 할 일 한 줄).
//   hand    손(처음 쥔 기물들) · bag 주머니(바꾸면 여기서 쥔다) · board 적 { 칸: 종류 } · incoming 증원 그림자 [{ sq, t }]
//   target  목표 · moves 수 · discards 희생
//   steps   걸음: { pick: 손 칸 } 손에서 들기 · { drop: 칸 } 떨구기 · { cap: 칸 } 먹기 · { discard: true } 희생 단추
//           say  그 걸음에서 보일 한 줄(할 일). 걸음마다 없으면 앞 걸음의 한 줄이 이어진다
//   preview 먹기 전 미리 보기(수업 2부터) · bigFlip 첫 갈아입기를 크게 · shop 수업용 상점(판 수업 ②)
import { createBattle } from '../sim/battle.js';
import { boardFrom, parseSq } from '../sim/board.js';

export const LESSON_GROUPS = [
  { id: 'basic', name: '기초' },
  { id: 'battle', name: '대국' },
  { id: 'run', name: '판' },
];

export const LESSONS = [
  // ── 기초
  { id: 'drop', group: 'basic', title: '떨구고 먹는다', target: 10, hand: ['N'], board: { e5: 'P' },
    steps: [
      { pick: 0, say: '손의 나이트를 누른다' },
      { drop: 'd3', say: '빛나는 칸에 떨군다. 먹을 적이 닿는 칸만 빛난다' },
      { cap: 'e5', say: '흔들리는 적을 눌러 먹는다' },
    ] },
  { id: 'become', group: 'basic', title: '먹으면 그 기물로 바뀐다', target: 160, hand: ['N'], board: { d4: 'R', d8: 'B' }, preview: true, bigFlip: true,
    steps: [
      { pick: 0, say: '나이트를 든다' },
      { drop: 'c2', say: '떨군다' },
      { cap: 'd4', say: '룩을 먹으면 내 기물이 룩이 된다' },
      { cap: 'd8', say: '이제 룩처럼 곧게 미끄러져 먹는다' },
    ] },
  { id: 'chain', group: 'basic', title: '이을수록 곱해진다', target: 800, hand: ['N'], board: { d5: 'Q', d2: 'B', h6: 'R', h2: 'B' }, preview: true,
    steps: [
      { pick: 0, say: '나이트를 든다' },
      { drop: 'e7', say: '떨군다' },
      { cap: 'd5', say: '먹을 때마다 흰 칸의 값이 더해지고, 금빛 칸의 배수가 1씩 는다' },
      { cap: 'd2' },
      { cap: 'h6', say: '점수 = 값 × 배수. 길게 이을수록 커진다' },
      { cap: 'h2' },
    ] },
  { id: 'guard', group: 'basic', title: '지키는 적부터', target: 160, hand: ['N'], board: { d5: 'R', f7: 'B' }, preview: true,
    demo: [{ pick: 0 }, { drop: 'c3' }, { cap: 'd5', say: '룩을 먼저 먹으면 비숍이 그 칸을 지킨다. 룩 모습으로는 비숍을 못 먹어 끊긴다' }],
    steps: [
      { pick: 0, say: '나이트를 든다' },
      { drop: null, say: '비숍을 먹을 수 있는 칸에 떨군다' },
      { cap: 'f7', say: '룩을 지키는 비숍부터 먹는다' },
      { cap: 'd5', say: '지키던 비숍이 없으니 룩을 먹어도 끊기지 않는다' },
    ] },
  // ── 대국
  { id: 'target', group: 'battle', title: '목표와 수', target: 60, moves: 2, hand: ['N', 'B'], board: { e5: 'P', h8: 'R' },
    steps: [
      { pick: 0, say: '판 위 막대가 목표. 닿으면 이긴다. 왼쪽 금빛 구슬이 남은 수다' },
      { drop: 'd3' },
      { cap: 'e5', say: '폰을 먹으면 첫 수가 끝나고 수 구슬 하나가 꺼진다' },
      { pick: 0, say: '남은 수로 목표를 채운다: 비숍을 든다' },
      { drop: 'c3' },
      { cap: 'h8', say: '룩을 먹으면 목표에 닿는다' },
    ] },
  { id: 'redraw', group: 'battle', title: '손과 희생', target: 90, moves: 1, discards: 1, hand: ['P', 'P', 'P', 'P'], bag: ['N'], board: { h8: 'Q' },
    steps: [
      { pick: 0, say: '폰은 떨굴 곳이 없다. 바칠 폰을 누른다' },
      { discard: true, say: '희생하면 새로 뽑는다. 바친 폰은 이번 대국에 돌아오지 않는다' },
      { pick: 3, say: '새로 뽑은 나이트를 든다. 이것으로 곧바로 메이트하면 탁월수' },
      { drop: 'g6' },
      { cap: 'h8', say: '퀸을 먹는다' },
    ] },
  { id: 'reinforce', group: 'battle', title: '증원', target: 60, moves: 2, hand: ['N', 'N'], board: { e5: 'P' }, incoming: [{ sq: 'c6', t: 'R' }],
    steps: [
      { pick: 0, say: '▼ 그림자는 증원. 이 수가 끝나면 그 칸에 적이 들어온다' },
      { drop: 'd3' },
      { cap: 'e5', say: '폰을 먹는다. 수가 끝나면 증원이 떨어진다' },
      { pick: 0, say: '들어온 룩을 먹으러 간다' },
      { drop: 'a5' },
      { cap: 'c6' },
    ] },
  { id: 'mate', group: 'battle', title: '체크메이트', target: 99999, hand: ['N'], board: { e7: 'K', a7: 'R', h1: 'P' }, preview: true,
    steps: [
      { pick: 0, say: '킹은 지키는 적이 있으면 못 먹는다. 지금은 룩이 지킨다' },
      { drop: 'b5', say: '지키는 룩을 먹을 수 있는 칸에 떨군다' },
      { cap: 'a7', say: '지키던 룩을 먹으면 내가 룩이 된다' },
      { cap: 'e7', say: '지키는 적이 없는 킹을 먹으면 체크메이트. 점수와 상관없이 이긴다' },
    ] },
  // ── 판
  { id: 'fairy', group: 'run', title: '체스 밖의 행마', target: 80, hand: ['O'], board: { d4: 'P', d7: 'R', h7: 'B' }, preview: true,
    steps: [
      { pick: 0, say: '포는 특수 기물. 기물 하나를 넘어서 먹는다' },
      { drop: 'd1', say: '폰을 받침으로 넘을 수 있는 칸에 떨군다' },
      { cap: 'd7', say: '폰을 넘어 룩을 먹는다' },
      { cap: 'h7', say: '룩이 되었으니 곧게 미끄러져 비숍까지' },
    ] },
  { id: 'shop', group: 'run', title: '상점과 시너지', shop: true },
];

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((L) => [L.id, L]));

export function lessonBattle(L) {
  const b = createBattle({ seed: 1, ante: 1, kind: 'practice', bag: L.hand.map((t) => ({ t })), target: L.target, rules: { moves: L.moves || 1, discards: L.discards || 0, reinforce: 0, easyStart: false, reboards: 0 }, golden: false });
  b.board = boardFrom(L.board);
  b.hand = L.hand.map((t, i) => ({ t, id: i + 1, eng: null }));
  b.bag = (L.bag || []).map((t, i) => ({ t, id: 50 + i, eng: null }));
  b.deckSize = b.hand.length + b.bag.length;
  b.movesLeft = b.rules.moves;
  b.discardsLeft = b.rules.discards;
  b.incoming = (L.incoming || []).map((r) => ({ sq: parseSq(r.sq), t: r.t }));
  b.incomingNext = [];
  b.fairyFree = false; delete b.fairyKinds;
  b.lesson = L.id;
  return b;
}

// 칸 이름을 칸 번호로
export const lessonSq = (s) => (s == null ? null : parseSq(s));
