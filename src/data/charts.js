// 기보(행성 카드): 모습 6종. 쓰면 그 모습의 레벨이 1 오른다.
// 그 모습으로 먹을 때마다 값 += a×레벨, 연쇄 += b×레벨(scoring.js의 'charts' 조정자가 계산).
// 킹 모습은 없다(킹을 먹으면 외통으로 끝난다).
export const CHARTS = {
  P: { form: 'P', name: '폰의 기보', a: 10, b: 1 },
  N: { form: 'N', name: '나이트의 기보', a: 15, b: 1 },
  B: { form: 'B', name: '비숍의 기보', a: 15, b: 1 },
  R: { form: 'R', name: '룩의 기보', a: 20, b: 1 },
  Q: { form: 'Q', name: '퀸의 기보', a: 25, b: 2 },
};
export const CHART_FORMS = Object.keys(CHARTS);
export const CHART_PRICE = 3;

// 'charts' 조정자에 넘길 표
export const CHART_TABLE = Object.fromEntries(CHART_FORMS.map((f) => [f, { a: CHARTS[f].a, b: CHARTS[f].b }]));

export const chartText = (f) => `${{ P: '폰', N: '나이트', B: '비숍', R: '룩', Q: '퀸' }[f]} 모습으로 먹을 때마다 값 +${CHARTS[f].a} · 연쇄 +${CHARTS[f].b}`;
