// 각인(강화): 떨군 기물에 붙는다. 명세는 기물의 eng = { id }.
// breakChance: 사슬을 푼 뒤 그 확률로 깨져 주머니에서 사라진다(판정은 battle.js의 endMove, 풀이기는 모른다).
import { defineModifier } from '../sim/scoring.js';

export const ENGRAVINGS = [];
function engraving(id, name, text, rarity, def) {
  ENGRAVINGS.push({ id, name, text, rarity });
  defineModifier(id, { kind: 'engraving', ...def });
}

engraving('gold', '금', '사슬이 끝나면 상금 +2', 'common', {
  onChainEnd(ctx) { ctx.addMoney(2); },
});
engraving('ivory', '상아', '값 +30', 'common', {
  onChainEnd(ctx) { ctx.addValue(30); },
});
engraving('ebony', '흑단', '배수 ×1.5', 'uncommon', {
  onChainEnd(ctx) { ctx.mulMult(1.5); },
});
engraving('glass', '유리', '배수 ×2 · 넷에 한 번 깨진다', 'common', {
  breakChance: 0.25,
  onChainEnd(ctx) { ctx.mulMult(2); },
});
engraving('silver', '은', '첫 먹기에선 끊기지 않는다', 'uncommon', {
  onCut(ctx) { if (ctx.chain.captures.length === 1) ctx.cancelCut(); },
});
engraving('feather', '깃', '지켜진 칸에도 떨굴 수 있다', 'common', {
  onDropCheck(ctx) { ctx.event.allow.attacked = true; },
});

export const ENGRAVING_BY_ID = Object.fromEntries(ENGRAVINGS.map((e) => [e.id, e]));
export const ENGRAVING_PRICE = 3;
