// 해금 솔기: 뽑는 자리마다 여기를 거쳐 잠긴 것을 뺀다. 단계 → 열린 목록은 src/data/unlocks.js.
// run.unlocked = { maxims, pieces, souls, engravings, josekis }(열린 id). 없으면 전부 열림(옛 저장 · 오늘의 대국 · 기본 하네스).
import { isFairy } from '../data/pieces.js';

const idOf = (x) => (typeof x === 'string' ? x : Array.isArray(x) ? x[0] : x.id);
const fairyOnly = (kind, id) => kind === 'pieces' && !isFairy(id); // 체스 기물은 늘 열려 있다

// list(id · [id, 무게] · { id })에서 열린 것만, 차례는 그대로. 잠금이 없으면 list를 그대로 돌려준다
export function openPool(run, kind, list) {
  const open = run && run.unlocked && run.unlocked[kind];
  if (!open) return list;
  return list.filter((x) => { const id = idOf(x); return fairyOnly(kind, id) || open.includes(id); });
}
// 대국은 판을 모른다: 열린 특수 기물은 대국 규칙 깃발 rules.pieces로 받아 무게 표 [종류, 무게]를 거른다
export function openTypes(rules, pairs) {
  const open = rules && rules.pieces;
  if (!open) return pairs;
  return pairs.filter(([t]) => !isFairy(t) || open.includes(t));
}
