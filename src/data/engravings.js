// 각인(강화): 떨군 기물에 붙는다. 명세는 기물의 eng = { id }.
// breakChance: 사슬을 푼 뒤 그 확률로 깨져 주머니에서 사라진다(판정은 battle.js의 endMove, 풀이기는 모른다).
import { defineModifier } from '../sim/scoring.js';

export const ENGRAVINGS = [];
function engraving(id, name, text, rarity, def) {
  ENGRAVINGS.push({ id, name, text, rarity });
  defineModifier(id, { kind: 'engraving', ...def });
}

engraving('gold', '금', '이 기물로 사슬을 풀면 상금 +2', 'common', {
  onChainEnd(ctx) { ctx.addMoney(2); },
});
engraving('ivory', '상아', '사슬 값 +30', 'common', {
  onChainEnd(ctx) { ctx.addValue(30); },
});
engraving('ebony', '흑단', '사슬 연쇄 ×1.5', 'uncommon', {
  onChainEnd(ctx) { ctx.mulMult(1.5); },
});
engraving('glass', '유리', '사슬 연쇄 ×2 · 네 번에 한 번 깨진다', 'common', {
  breakChance: 0.25,
  onChainEnd(ctx) { ctx.mulMult(2); },
});
engraving('silver', '은', '첫 먹기는 끊기지 않는다', 'uncommon', {
  onCut(ctx) { if (ctx.chain.captures.length === 1) ctx.cancelCut(); },
});
engraving('feather', '깃', '노려지는 칸에도 떨군다', 'common', {
  onDropCheck(ctx) { ctx.event.allow.attacked = true; },
});

export const ENGRAVING_BY_ID = Object.fromEntries(ENGRAVINGS.map((e) => [e.id, e]));
export const ENGRAVING_PRICE = 3;
