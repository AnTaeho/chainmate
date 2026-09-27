// 화면 글. 세계의 말(DESIGN.md)만 쓴다. 격언 · 명인 · 각인 · 명국의 효과 글은 src/data의 text를 그대로 쓴다.
export const PIECE_NAME = { P: '폰', N: '나이트', B: '비숍', R: '룩', Q: '퀸', K: '킹', A: '대주교', C: '재상', Z: '아마존', L: '낙타', H: '야간기사', G: '메뚜기', O: '포', S: '궁수', W: '유령' };
// 이형 행마 한 줄(말풍선 · 도감)
export const PIECE_MOVE = {
  A: '비숍 + 나이트로 먹는다', C: '룩 + 나이트로 먹는다', Z: '퀸 + 나이트로 먹는다', L: '세 칸 · 한 칸으로 뛴다(늘 같은 색 칸)',
  H: '나이트 도약을 같은 쪽으로 거듭한다', G: '첫 기물을 넘어 바로 뒤 칸을 먹는다', O: '가로 · 세로로 하나를 넘어 그 너머 첫 기물을 먹는다',
  S: '두 칸 떨어진 적을 제자리에서 쏜다', W: '가로 · 세로로 막힘 없이 미끄러진다',
};
// 받침에 맞는 조사를 붙인다. pair = '이/가' · '을/를' · '은/는' · '과/와' · '으로/로'(ㄹ 받침은 「로」).
export function josa(word, pair) {
  const [withB, without] = pair.split('/');
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return word + without;
  const jong = c % 28;
  if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? without : withB);
  return word + (jong ? withB : without);
}
export const KIND_NAME = { practice: '연습 대국', official: '정식 대국', master: '명인 대국' };
export const KIND_SHORT = { practice: '연습', official: '정식', master: '명인' };
export const PACK_NAME = { piece: '기물 꾸러미', chart: '기보 꾸러미', engraving: '각인 꾸러미', golden: '금빛 꾸러미' };
export const PART_NAME = { first: '첫 조각', feat: '재현 조각', gold: '금빛 조각' };
export const END_REASON = { moves: '수를 다 썼다', stuck: '떨굴 곳이 없다', mate: '외통', score: '목표 달성' };
export const money = (n) => `$${n}`;
export const anteName = (a) => `${a}관`;
