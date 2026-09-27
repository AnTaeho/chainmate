// 화면 글. 세계의 말(DESIGN.md)만 쓴다. 격언 · 명인 · 각인 · 명국의 효과 글은 src/data의 text를 그대로 쓴다.
export const PIECE_NAME = { P: '폰', N: '나이트', B: '비숍', R: '룩', Q: '퀸', K: '킹' };
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
