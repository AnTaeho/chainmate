// 격언 · 전설 아이콘 12 × 12와 첫 화면 메뉴 아이콘(menu_*, CHM-49) · 자물쇠(CHM-73): 안 3 벡터 문양(emblems.js MOTIF)을
// (id, 배율 N)마다 한 번 굽고 붙인다. 크림 몸 + 잉크 테라 밝은 카드 · 어두운 칸 어디서나 읽힌다.
import { blitVec } from './vec.js';
import { MOTIF, drawMotif } from './emblems.js';

export const ICON_IDS = Object.keys(MOTIF);
export const ICON = 12;

export function drawIcon(ctx, id, x, y, alpha = 1) {
  if (!MOTIF[id]) return false;
  blitVec(ctx, `icon:${id}`, x, y, ICON, ICON, (g, n) => drawMotif(g, id, 0, 0, ICON, n), alpha);
  return true;
}
// 어두운 바탕 위 아이콘: 벡터 문양은 바탕을 가리지 않아 같은 그림(옛 이름을 그대로 둔다)
export const drawIconLight = (ctx, id, x, y) => drawIcon(ctx, id, x, y);
