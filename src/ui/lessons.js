// 튜토리얼: 기초 셋 · 대국 셋 · 판 하나(docs/design-notes/tutorial.md). 손으로 짠 고정 판(시드 무관), 규칙은 실제 sim(createBattle + 판 넣기)에 코어 판 대국 규칙(CORE.rules)을 켠 그대로.
// 수업마다 시범(흐린 손가락이 한 번 둔다 → 판이 처음으로) → 내 차례(지금 누를 곳만 빛나고, 오른쪽에서 킹이 할 일을 한 줄로 말한다).
//   hand    손(처음 쥔 기물들) · bag 덱(희생하면 여기서 뽑는다) · board 적 { 칸: 종류 } · incoming 첫 수 뒤 증원 그림자 [{ sq, t }]
//   target  목표 · moves 수 · discards 희생
//   steps   걸음: { pick: 손 칸 } 손에서 들기 · { drop: 칸 } 놓기 · { cap: 칸 } 잡기 · { discard: true } 희생 단추
//           say  그 걸음에서 킹이 하는 말(반말 한 줄). 걸음마다 없으면 앞 걸음의 말이 이어진다
//   demo    시범을 걸음과 다르게(지키는 적: 한 번 끊겨 본다)
//   preview 잡기 전 미리 보기 · bigFlip 첫 갈아입기를 크게 · shop 수업용 상점(판)
//   after   이기면 판 아래 알림으로 뜨는 한 줄
import { createBattle } from '../sim/battle.js';
import { boardFrom, parseSq } from '../sim/board.js';
import { CORE } from '../data/core.js';

export const LESSON_GROUPS = [
  { id: 'basic', name: '기초' },
  { id: 'battle', name: '대국' },
  { id: 'run', name: '판' },
];

export const LESSONS = [
  // ── 기초
  { id: 'become', group: 'basic', title: '잡으면 그 기물로 바뀐다', target: 160, hand: ['N'], board: { d4: 'R', d8: 'B' }, preview: true, bigFlip: true,
    steps: [
      { pick: 0, say: '손에 있는 나이트를 눌러 봐' },
      { drop: 'c2', say: '빛나는 칸에 놓아 봐. 적을 잡을 수 있는 칸만 빛나' },
      { cap: 'd4', say: '룩을 잡아 봐. 잡으면 내 기물이 룩이 돼' },
      { cap: 'd8', say: '이제 룩이야. 곧게 가서 비숍까지 잡아' },
    ] },
  // 두 수: 첫 콤보가 남긴 배수(1)에서 둘째 콤보가 시작한다(rules.streak)
  { id: 'streak', group: 'basic', title: '배수는 다음 수로 이어진다', target: 230, moves: 2, hand: ['N', 'N'], board: { d4: 'R', g6: 'Q' }, preview: true,
    steps: [
      { pick: 0, say: '나이트를 눌러 봐' },
      { drop: 'e2', say: '놓아 봐' },
      { cap: 'd4', say: '잡으면 흰 칸에 값이, 금빛 칸에 배수가 1 올라. 점수는 값 × 배수야' },
      { pick: 0, say: '콤보가 끝나도 배수 1이 남았지? 다음 콤보는 거기서 시작해. 나이트를 눌러 봐' },
      { drop: 'e7', say: '놓아 봐' },
      { cap: 'g6', say: '퀸을 잡으면 배수가 2야. 잡을수록 다음 수가 세져' },
    ] },
  { id: 'cut', group: 'basic', title: '지키는 적부터', target: 160, hand: ['N'], board: { d5: 'R', f7: 'B' }, preview: true,
    demo: [{ pick: 0, say: '먼저 보기만 해. 룩부터 잡으면 어떻게 될까?' }, { drop: 'c3' }, { cap: 'd5', say: '비숍이 룩 자리를 지켜서 끊겼어. 끊긴 콤보는 배수에 안 쌓여' }],
    steps: [
      { pick: 0, say: '이번엔 끊기지 않게 해 보자. 나이트를 눌러 봐' },
      { drop: null, say: '비숍을 잡을 수 있는 칸에 놓아 봐' },
      { cap: 'f7', say: '룩을 지키는 비숍부터 잡아' },
      { cap: 'd5', say: '지키던 비숍이 없으니 안 끊겨. 잡은 둘이 배수에 쌓여' },
    ] },
  // ── 대국
  // 두 수: 첫 수로 목표를 넘기고(목표 자리가 「다음 ×2」로) 남은 수를 둔다. 첫 수 뒤 증원(룩)이 들어와 뒤 수가 더 크다
  { id: 'playout', group: 'battle', title: '목표 · 수 · 증원', target: 30, moves: 2, hand: ['N', 'N'], board: { e5: 'B' }, incoming: [{ sq: 'c6', t: 'R' }],
    after: '목표를 넘긴 채 수를 다 두면 이겨요',
    steps: [
      { pick: 0, say: '대국은 수를 다 둘 때까지 이어져. 나이트를 눌러 봐' },
      { drop: 'd3', say: '▼ 그림자는 증원이야. 이 수가 끝나면 그 칸에 적이 들어와' },
      { cap: 'e5', say: '비숍을 잡으면 목표를 넘어' },
      { pick: 0, say: '넘겨도 남은 수는 둬. 목표 자리엔 다음 ×2가 떠. 나이트를 눌러 봐' },
      { drop: 'a5', say: '판은 수마다 차올라서 큰 콤보는 뒤 수에 와. 놓아 봐' },
      { cap: 'c6', say: '들어온 룩을 잡아. 더 넘길수록 상금이 붙어' },
    ] },
  { id: 'redraw', group: 'battle', title: '손과 희생', target: 90, discards: 1, hand: ['P', 'P', 'P', 'P'], bag: ['N'], board: { h8: 'Q' },
    steps: [
      { pick: 0, say: '폰은 놓을 곳이 없어. 희생할 폰을 눌러 봐' },
      { discard: true, say: '희생하면 새로 뽑아. 희생한 폰은 이번 대국에 안 돌아와' },
      { pick: 3, say: '새로 뽑은 나이트를 눌러 봐' },
      { drop: 'g6' },
      { cap: 'h8', say: '퀸을 잡아' },
    ] },
  // 수가 남아도 체크메이트면 곧바로 이긴다(수 둘 중 하나만 쓴다)
  { id: 'mate', group: 'battle', title: '체크메이트', target: 99999, moves: 2, hand: ['N'], board: { e7: 'K', a7: 'R', h1: 'P' }, preview: true,
    after: '킹은 지키는 적부터 치우고 잡아요',
    steps: [
      { pick: 0, say: '킹은 지키는 적이 있으면 못 잡아. 지금은 룩이 지키고 있어' },
      { drop: 'b5', say: '킹을 지키는 룩을 잡을 수 있는 칸에 놓아 봐' },
      { cap: 'a7', say: '지키던 룩을 잡으면 내 기물이 룩이 돼' },
      { cap: 'e7', say: '지키는 적이 없는 킹을 잡으면 체크메이트. 수가 남아도 곧바로 이겨' },
    ] },
  // ── 판
  { id: 'shop', group: 'run', title: '상점', shop: true },
];

export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((L) => [L.id, L]));

// 수업 대국: 코어 판 대국 규칙(CORE.rules)을 켠다. 판 · 증원은 수업이 손으로 짜니 증원 셈(reinforce · reinforceAdd)만 0으로 둔다
export function lessonBattle(L) {
  const rules = { ...CORE.rules, moves: L.moves || 1, discards: L.discards || 0, reinforce: 0, reinforceAdd: 0, easyStart: false };
  const b = createBattle({ seed: 1, ante: 1, kind: 'practice', bag: L.hand.map((t) => ({ t })), target: L.target, rules, golden: false });
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
