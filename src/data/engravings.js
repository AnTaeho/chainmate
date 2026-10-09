// 각인(강화): 떨군 기물에 붙는다. 명세는 기물의 eng = { id }.
// breakChance: 사슬을 푼 뒤 그 확률로 깨져 덱에서 사라진다(판정은 battle.js의 endMove, 풀이기는 모른다).
import { defineModifier } from '../sim/scoring.js';
import { PIECES } from './pieces.js';

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
engraving('glass', '유리', '배수 ×2 · 4번에 1번 깨진다', 'common', {
  breakChance: 0.25,
  onChainEnd(ctx) { ctx.mulMult(2); },
});
engraving('silver', '은', '첫 먹기에선 끊기지 않는다', 'uncommon', {
  onCut(ctx) { if (ctx.chain.captures.length === 1) ctx.cancelCut(); },
});
engraving('feather', '깃', '지켜진 칸에도 놓을 수 있다', 'common', {
  onDropCheck(ctx) { ctx.event.allow.attacked = true; },
});


// 밤샘 2: 여섯 더
engraving('bronze', '청동', '먹을 때마다 값 +5', 'common', {
  onCapture(ctx) { ctx.addValue(5); },
});
engraving('iron', '철', '끊길 때: 배수 +3', 'common', {
  onCut(ctx) { ctx.addMult(3); },
});
engraving('amber', '호박', '첫 먹기의 값 ×2', 'common', {
  onCapture(ctx) { if (ctx.event.index === 0) ctx.addValue(PIECES[ctx.event.piece] ? PIECES[ctx.event.piece].value : 0); },
});
engraving('jade', '비취', '대국 첫 사슬: 배수 ×2', 'uncommon', {
  onChainEnd(ctx) { if (!(ctx.t.movesUsed ?? 0)) ctx.mulMult(2); },
});
engraving('coral', '산호', '증원을 먹으면 상금 +1', 'common', {
  onCapture(ctx) { if (ctx.event.born >= 0) ctx.addMoney(1); },
});
engraving('marble', '대리석', '모습이 안 바뀐 먹기마다 배수 +2', 'uncommon', {
  onCapture(ctx) { if (ctx.event.piece === ctx.event.form) ctx.addMult(2); },
});

export const ENGRAVING_BY_ID = Object.fromEntries(ENGRAVINGS.map((e) => [e.id, e]));
export const ENGRAVING_PRICE = 3;
