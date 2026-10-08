// 주사위(CHM-70 설정 「다시 짓기」 단추 그림): 7×7 자리. 1배는 DICE_ROWS, 두 배 화면은 반 칸 그림 DICE_HI(14×14 — DICE_ROWS를 Scale2x로 다듬은 것,
// tools/art-hi.mjs와 같은 방식. test/art-hi.test.js가 둘이 짝인지 잰다). 잉크 상자가 자리를 꽉 채운다(src/render/ink.js) — 단추 글 빛깔로 찍는다.
import { baked, hiFor } from './sprites.js';
import { place } from './gfx.js';

export const DICE = 7;
export const DICE_ROWS = ['.#####.', '#.###.#', '#######', '###.###', '#######', '#.###.#', '.#####.'];
export const DICE_HI = [
  '..##########..',
  '.############.',
  '##..######..##',
  '##..######..##',
  '##############',
  '##############',
  '######..######',
  '######..######',
  '##############',
  '##############',
  '##..######..##',
  '##..######..##',
  '.############.',
  '..##########..',
];
// button()의 icon 꼴: (ctx, x, y, 빛깔)
export function diceIcon(ctx, x, y, col) {
  const hi = hiFor(ctx);
  const c = baked(`dice:${hi ? 2 : 1}:${col}`, hi ? DICE_HI : DICE_ROWS, { '#': [col, 1] });
  ctx.drawImage(c, place(x), place(y), DICE, DICE);
}
