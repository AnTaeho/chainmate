// 글꼴 단계(docs/design-notes/art3.md 4절): 굵은 글 = Black Han Sans(없는 기호는 보통 글꼴로), 보통 글 = Chainmate Sans KR(IBM Plex Sans KR Medium을 줄여 이름을 바꾼 것 — assets/fonts/README.txt). 둘 다 논리 12px.
// ink: 기준 글자 「가A」의 잉크가 기준선 위 · 아래로 가는 길이(논리 px, 크로미움에서 잰 값 — tools/fontwidths.mjs가 찍는다). 브라우저가 못 잴 때만 쓴다
export const INK_H = 11; // 글자 띠: text()의 y부터 11줄. 기준 글자의 잉크를 이 띠 가운데에 놓는다
export const FACE = {
  regular: { family: '"Chainmate Sans KR"', weight: 500, px: 12, ink: [9.26, 1.25] },
  bold: { family: '"Black Han Sans", "Chainmate Sans KR"', weight: 400, px: 12, ink: [9.12, 0] },
};
export const faceOf = (bold) => (bold ? FACE.bold : FACE.regular);
export const fontOf = (bold, px = faceOf(bold).px) => { const f = faceOf(bold); return `${f.weight} ${px}px ${f.family}`; };
