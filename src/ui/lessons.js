// 튜토리얼: 기초 셋 · 대국 셋 · 판 둘(docs/design-notes/tutorial.md). 손으로 짠 고정 판(시드 무관), 규칙은 실제 sim(createBattle + 판 넣기) 그대로.
// 수업마다 시범(흐린 손가락이 한 번 둔다 → 판이 처음으로) → 내 차례(지금 누를 곳만 빛나고, 오른쪽에서 킹이 할 일을 한 줄로 말한다).
//   hand    손(처음 쥔 기물들) · bag 덱(희생하면 여기서 뽑는다) · board 적 { 칸: 종류 } · incoming 증원 그림자 [{ sq, t }]
//   target  목표 · moves 수 · discards 희생
//   steps   걸음: { pick: 손 칸 } 손에서 들기 · { drop: 칸 } 놓기 · { cap: 칸 } 잡기 · { discard: true } 희생 단추 · { moves: true } 「행마」 단추
//           say  그 걸음에서 킹이 하는 말(반말 한 줄). 걸음마다 없으면 앞 걸음의 말이 이어진다
//   demo    시범을 걸음과 다르게(지키는 적: 한 번 끊겨 본다)
//   preview 잡기 전 미리 보기 · bigFlip 첫 갈아입기를 크게 · shop 수업용 상점(판 ②)
//   after   이기면 판 아래 알림으로 뜨는 한 줄
import { createBattle } from '../sim/battle.js';
import { boardFrom, parseSq } from '../sim/board.js';

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
  { id: 'chain', group: 'basic', title: '이을수록 곱해진다', target: 800, hand: ['N'], board: { d5: 'Q', d2: 'B', h6: 'R', h2: 'B' }, preview: true,
    steps: [
      { pick: 0, say: '나이트를 눌러 봐' },
      { drop: 'e7', say: '놓아 봐' },
      { cap: 'd5', say: '잡을 때마다 흰 칸의 값이 더해지고, 금빛 칸의 배수가 1씩 늘어' },
      { cap: 'd2' },
      { cap: 'h6', say: '점수는 값 × 배수야. 길게 이을수록 커져' },
      { cap: 'h2' },
    ] },
  { id: 'guard', group: 'basic', title: '지키는 적부터', target: 160, hand: ['N'], board: { d5: 'R', f7: 'B' }, preview: true,
    demo: [{ pick: 0 }, { drop: 'c3' }, { cap: 'd5', say: '룩부터 잡으면 비숍이 그 칸을 지켜. 룩 모습으로는 비숍을 못 잡아서 끊겨' }],
    steps: [
      { pick: 0, say: '이번엔 끊기지 않게 해 보자. 나이트를 눌러 봐' },
      { drop: null, say: '비숍을 잡을 수 있는 칸에 놓아 봐' },
      { cap: 'f7', say: '룩을 지키는 비숍부터 잡아' },
      { cap: 'd5', say: '지키던 비숍이 없으니 룩을 잡아도 안 끊겨' },
    ] },
  // ── 대국
  { id: 'reinforce', group: 'battle', title: '목표 · 수 · 증원', target: 60, moves: 2, hand: ['N', 'N'], board: { e5: 'P' }, incoming: [{ sq: 'c6', t: 'R' }],
    steps: [
      { pick: 0, say: '점수 아래 막대가 목표야. 다 채우면 이겨. 왼쪽 아래 금빛 구슬은 남은 수야' },
      { drop: 'd3', say: '▼ 그림자는 증원이야. 이 수가 끝나면 그 칸에 적이 들어와' },
      { cap: 'e5', say: '폰을 잡아 봐. 수가 끝나면 구슬 하나가 꺼져' },
      { pick: 0, say: '들어온 룩을 잡을 차례야. 나이트를 눌러 봐' },
      { drop: 'a5', say: '놓아 봐' },
      { cap: 'c6', say: '룩을 잡으면 목표가 다 차' },
    ] },
  { id: 'redraw', group: 'battle', title: '손과 희생', target: 90, moves: 1, discards: 1, hand: ['P', 'P', 'P', 'P'], bag: ['N'], board: { h8: 'Q' },
    steps: [
      { pick: 0, say: '폰은 놓을 곳이 없어. 희생할 폰을 눌러 봐' },
      { discard: true, say: '희생하면 새로 뽑아. 희생한 폰은 이번 대국에 안 돌아와' },
      { pick: 3, say: '새로 뽑은 나이트를 눌러 봐. 이걸로 곧바로 메이트하면 탁월수야' },
      { drop: 'g6' },
      { cap: 'h8', say: '퀸을 잡아' },
    ] },
  { id: 'mate', group: 'battle', title: '체크메이트', target: 99999, hand: ['N'], board: { e7: 'K', a7: 'R', h1: 'P' }, preview: true,
    after: '킹을 지키던 적을 둘 잡은 콤보로는 킹을 못 잡아요',
    steps: [
      { pick: 0, say: '킹은 지키는 적이 있으면 못 잡아. 지금은 룩이 지키고 있어' },
      { drop: 'b5', say: '킹을 지키는 룩을 잡을 수 있는 칸에 놓아 봐' },
      { cap: 'a7', say: '지키던 룩을 잡으면 내 기물이 룩이 돼' },
      { cap: 'e7', say: '지키는 적이 없는 킹을 잡으면 체크메이트. 점수와 상관없이 이겨' },
    ] },
  // ── 판
  { id: 'fairy', group: 'run', title: '체스 밖의 행마', target: 160, hand: ['S'], board: { d4: 'P', d5: 'R', h3: 'B' }, preview: true,
    after: '특수 기물은 관을 돌파하면 하나씩 열려요',
    steps: [
      { moves: true, say: '기물이 가는 길은 「행마」에서 볼 수 있어. 눌러 봐' },
      { pick: 0, say: '궁수는 특수 기물이야. 딱 두 칸 떨어진 적을 제자리에서 잡아' },
      { drop: 'd3', say: '룩에서 두 칸 떨어진 칸에 놓아 봐' },
      { cap: 'd5', say: '움직이지 말고 룩을 잡아' },
      { cap: 'h3', say: '룩이 됐으니 곧게 가서 비숍까지 잡아' },
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
