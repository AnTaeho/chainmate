// 주사위(CHM-70 설정 「다시 짓기」 단추 그림): 7×7 자리를 꽉 채운 둥근 네모에 눈 다섯을 뚫는다(안 3 벡터, 단추 글 빛깔).
// (빛깔, 배율 N)마다 한 번 굽는다. N = 1은 눈을 1 화소 네모로 뚫는다(둥근 눈은 7 화소에서 번진다).
import { place } from './gfx.js';
import { bake, scaleOf, put } from './vec.js';

export const DICE = 7;
const PIPS = [[1.5, 1.5], [5.5, 1.5], [3.5, 3.5], [1.5, 5.5], [5.5, 5.5]];
export function diceCanvas(col, n = 1) {
  return bake(`dice:${col}`, DICE, DICE, n, (g) => {
    const r = 1.6;
    g.beginPath();
    g.moveTo(r, 0); g.lineTo(DICE - r, 0); g.quadraticCurveTo(DICE, 0, DICE, r); g.lineTo(DICE, DICE - r); g.quadraticCurveTo(DICE, DICE, DICE - r, DICE);
    g.lineTo(r, DICE); g.quadraticCurveTo(0, DICE, 0, DICE - r); g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0); g.closePath();
    g.fillStyle = col; g.fill();
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    for (const [x, y] of PIPS) {
      if (n === 1) g.fillRect(x - 0.5, y - 0.5, 1, 1);
      else { g.beginPath(); g.arc(x, y, 0.72, 0, Math.PI * 2); g.fill(); }
    }
    g.globalCompositeOperation = 'source-over';
  });
}
// button()의 icon 꼴: (ctx, x, y, 빛깔)
export function diceIcon(ctx, x, y, col) {
  const n = scaleOf(ctx);
  put(ctx, diceCanvas(col, n), n, place(x), place(y), DICE, DICE);
}
