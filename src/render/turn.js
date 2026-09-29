// 세로 안내 그림(docs/design-notes/layout.md 「화면 맞춤」): 32×32 도트 휴대폰이 세로로 섰다가 옆으로 눕는다.
// 캔버스는 32×32 그대로, CSS가 정수 기기 화소 배로 늘린다(image-rendering: pixelated). 움직임 줄이기면 누운 그림에 멈춘다.
import { PAL } from './palette.js';

const S = 32;
const BODY = PAL.card, EDGE = PAL.frameDk || '#3a2a1a', GLASS = PAL.felt, GOLD = PAL.gold, HI = PAL.goldHi;

function phone(g, x, y, w, h, flat) {
  g.fillStyle = EDGE; g.fillRect(x, y, w, h);
  g.fillStyle = BODY; g.fillRect(x + 1, y + 1, w - 2, h - 2);
  g.fillStyle = GLASS; g.fillRect(x + 2, y + 2, w - 4, h - 4);
  // 화면 속 작은 판(누우면 가로로 넓게)
  const bw = flat ? 8 : 6, bx = x + Math.floor((w - bw) / 2), by = y + Math.floor((h - bw) / 2);
  for (let j = 0; j < bw; j++) for (let i = 0; i < bw; i++) { g.fillStyle = (i + j) % 2 ? '#a4744a' : '#e2cda2'; g.fillRect(bx + i, by + j, 1, 1); }
}

// 돌리는 화살표: 오른쪽 위에서 시계 방향으로 도는 금빛 호
function arrow(g, on) {
  if (!on) return;
  g.fillStyle = GOLD;
  const arc = [[20, 2], [21, 2], [22, 2], [23, 3], [24, 3], [25, 4], [26, 5], [26, 6], [27, 7], [27, 8], [27, 9]];
  for (const [x, y] of arc) g.fillRect(x, y, 1, 1);
  g.fillStyle = HI;
  for (const [x, y] of [[25, 9], [26, 10], [27, 11], [28, 10], [29, 9], [26, 9], [28, 9]]) g.fillRect(x, y, 1, 1);
}

export function drawTurn(cv, t, calm) {
  if (cv.width !== S) cv.width = S;
  if (cv.height !== S) cv.height = S;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, S, S);
  // 0 ~ 1.1초: 세로, 1.1 ~ 1.4: 화살표, 1.4 ~ 2.6: 누움
  const p = calm ? 2 : t % 2.6;
  if (p < 1.4) { phone(g, 10, 5, 12, 22, false); arrow(g, p > 0.5 && Math.floor(p * 6) % 2 === 0 || p > 1.1); }
  else { phone(g, 5, 10, 22, 12, true); if (calm) arrow(g, true); }
}
