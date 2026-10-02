// 화면 글. 세계의 말(DESIGN.md)만 쓴다. 격언 · 명인 · 각인 · 명국의 효과 글은 src/data의 text를 그대로 쓴다.
export const PIECE_NAME = { P: '폰', N: '나이트', B: '비숍', R: '룩', Q: '퀸', K: '킹', Z: '아마존', L: '낙타', O: '포', S: '궁수', W: '유령', T: '꺾쇠', E: '물수제비', V: '까마귀', M: '광대', D: '화약병', X: '벽', J: '보석' };
// 행마 한 줄(말풍선 · 도감 · 상점 카드). 옆에 작은 행마 그림이 붙는다(parts.js moveDiagram).
// 두 문장까지, 짧게 — 그림이 설명의 주인이다(docs/design-notes/voice.md 「문장」).
export const PIECE_MOVE = {
  P: '대각선 앞 한 칸의 적을 먹는다', N: 'L자로 뛰어 먹는다. 사이의 기물은 넘는다',
  B: '대각선으로 미끄러져 먹는다', R: '가로 · 세로로 미끄러져 먹는다',
  Q: '여덟 방향으로 미끄러져 먹는다', K: '둘레 여덟 칸을 지킨다. 지키는 적이 없을 때만 먹힌다',
  Z: '퀸처럼 미끄러지거나 나이트처럼 뛰어 먹는다',
  L: 'L자를 길게, 세 칸 · 한 칸으로 뛰어 먹는다',
  O: '기물 하나를 넘어서 먹는다',
  S: '두 칸 떨어진 적을 쏜다. 움직이지 않는다',
  W: '룩처럼 가로 · 세로로 가며, 기물을 뚫고 지나간다',
  T: '룩처럼 가다가 빈칸에서 한 번 직각으로 꺾어 먹는다',
  E: '비숍처럼 가다가 판 끝에서 한 번 튕겨 먹는다',
  V: '대각선으로 붙은 적을 넘어 먹고, 그 너머 빈칸에 앉는다',
  M: '적을 그 적의 행마로만 먹는다',
  D: '둘레 한 칸을 먹는다. 둘레의 적도 터지고 사슬은 끝난다',
  X: '먹을 수 없는 돌. 포는 넘는다', J: '먹으면 상금 +2. 모습은 안 바뀐다',
};
// 체스 밖 행마(특수 기물)만: 말풍선을 늘 붙이던 곳이 쓴다
export const FAIRY_MOVE = (t) => (PIECE_MOVE[t] && !'PNBRQK'.includes(t) ? PIECE_MOVE[t] : null);
// 받침에 맞는 조사를 붙인다. pair = '이/가' · '을/를' · '은/는' · '과/와' · '으로/로'(ㄹ 받침은 「로」).
export function josa(word, pair) {
  const [withB, without] = pair.split('/');
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  if (c < 0 || c > 11171) return word + without;
  const jong = c % 28;
  if (pair === '으로/로') return word + (jong === 0 || jong === 8 ? without : withB);
  return word + (jong ? withB : without);
}
export const KIND_NAME = { practice: '연습 대국', official: '정식 대국', master: '마스터전' };
export const KIND_SHORT = { practice: '연습', official: '정식', master: '마스터' };
export const PACK_NAME = { piece: '기물 꾸러미', chart: '기보 꾸러미', engraving: '각인 꾸러미', golden: '금빛 꾸러미' };
export const PART_NAME = { first: '첫 조각', feat: '재현 조각', gold: '금빛 조각' };
// 명국 첫 조각이 나오는 곳(legends.js source)
export const FRAG_SOURCE = { display: '상점 진열', piece: '기물 꾸러미', chart: '기보 꾸러미', engraving: '각인 꾸러미' };
export const END_REASON = { moves: '수를 다 썼다', stuck: '떨굴 곳이 없다', mate: '체크메이트', score: '목표 달성' };
export const money = (n) => `$${n}`;
export const anteName = (a) => `${a}관`;
