// 기물 종류. 규칙 코드는 id(P N B R Q K)만 보고 동작한다.
export const PIECES = {
  P: { id: 'P', value: 10, name: '폰' },
  N: { id: 'N', value: 30, name: '나이트' },
  B: { id: 'B', value: 30, name: '비숍' },
  R: { id: 'R', value: 50, name: '룩' },
  Q: { id: 'Q', value: 90, name: '퀸' },
  K: { id: 'K', value: 150, name: '킹' },
};
export const TYPES = ['P', 'N', 'B', 'R', 'Q', 'K'];
export const valueOf = (t) => PIECES[t].value;
