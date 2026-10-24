// 판 가장자리 좌표 글자(a~h · 1~8). 대국 판 · 판 테는 board3.js가 그린다.
import { tinyText } from './text.js';

// 좌표 글자 하나: 옛 3×5 도트 글자 상자 (x, y)의 가운데에 굵은 글꼴 글자(잉크 높이 6). 빛깔은 g.fillStyle
export function glyph(g, ch, x, y) {
  if (!/^[a-h1-8]$/.test(String(ch))) return;
  tinyText(g, ch, x + 1.5, y + 2.5, 6, g.fillStyle);
}
