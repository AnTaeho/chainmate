// 하이라이트 카드(CHM-73) 시험 · 스크린샷용 끝난 판: 주머니 기물 · 격언 수를 정해 채운다(시험 · tools/shots-highlight.mjs · smoke가 같이 쓴다)
import { createRun } from '../../src/sim/run.js';
import { MAXIMS } from '../../src/data/maxims.js';
import { JOSEKIS } from '../../src/data/josekis.js';
import { ENGRAVINGS } from '../../src/data/engravings.js';
import { SOULS } from '../../src/data/souls.js';

const BAG = ['S', 'Q', 'E', 'V', 'N', 'R', 'M', 'B', 'T', 'O', 'P', 'Z', 'L', 'W', 'D'];
const EDITIONS = [null, null, 'obsidian', null, 'foil', null, 'rainbow', null];

// maxims: 수 또는 id 목록. old: 옛 저장(최고 한 수에 captures가 없다)
export function finishedRun({ deck = 8, maxims = 6, josekis = 3, won = true, ante = won ? 8 : 5, endless = false, chain = 15, score = 47318700, old = false, seed = 7 } = {}) {
  const run = createRun({ seed });
  run.phase = won ? 'won' : 'lost';
  run.ante = ante; run.blind = won ? 2 : 1; run.endless = endless; run.money = 23;
  run.deck = Array.from({ length: deck }, (_, i) => ({
    id: 100 + i, t: BAG[i % BAG.length], edition: null,
    eng: i % 3 === 1 ? { id: ENGRAVINGS[i % ENGRAVINGS.length].id } : null,
    ...(i % 4 === 2 ? { soul: SOULS[i % SOULS.length].id, awake: i % 8 === 2 } : {}),
  }));
  const pool = MAXIMS.filter((m) => m.rarity !== 'legendary');
  const ids = Array.isArray(maxims) ? maxims : Array.from({ length: maxims }, (_, i) => pool[(i * 7) % pool.length].id);
  run.maxims = ids.map((id, i) => ({ uid: i + 1, id, data: {}, edition: EDITIONS[i % EDITIONS.length], paid: 4 }));
  run.josekis = (Array.isArray(josekis) ? josekis : JOSEKIS.slice(0, josekis).map((j) => j.id));
  run.charts = { ...run.charts, Q: 5, R: 3 };
  run.log = [{ ante, blind: run.blind, kind: won ? 'master' : 'official', target: won ? 2200000 : 61600, score: won ? score : 48200, best: score, won }];
  // 최고 한 수: 룩이 a1에서 떨어져 첫 줄 · h줄을 따라 먹는다
  const path = [1, 2, 3, 4, 5, 6, 7, 15, 23, 31, 39, 47, 55, 63, 62, 61, 60, 59, 58, 57].slice(0, Math.max(1, Math.min(20, chain)));
  const board = Array(64).fill(null);
  path.forEach((sq, i) => { board[sq] = { t: 'PNBRQ'[i % 5], id: 300 + i, born: -1 }; });
  const caps = path.map((sq, i) => ({ from: i ? path[i - 1] : 0, to: sq, at: sq, piece: board[sq].t, form: 'R', after: 'R' }));
  run.bestReplay = { board, drop: { sq: 0, piece: 'R' }, caps, ante, score, reason: 'end', ...(old ? {} : { captures: chain }) };
  return run;
}
