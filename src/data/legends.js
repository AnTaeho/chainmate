// 불멸의 기보: 명국 다섯, 명국마다 조각 셋(HOOKS 「불멸의 기보」). 셋이 한 판에 모이면 전설 격언이 된다.
//   first — 첫 조각. source에 적힌 곳(상점 진열 · 기물/기보/각인 꾸러미)에서 낮은 확률로 나온다(shop.js).
//   feat  — 둘째 조각. 재현(feat)을 해내면 확정. 첫 조각을 가진 판에서만 조건이 드러나고 판정된다.
//   gold  — 셋째 조각. 금빛 적을 먹으면 첫 조각을 가진 명국 하나의 금빛 조각이 나온다.
// 재현 판정 check(h): h = 끝난 사슬 요약(chain.js chainSummary — caps 먹은 종류 문자열 · cuts · mates · promotions · captures · move).
// 전설 격언은 rarity 'legendary', 상점에는 나오지 않고 격언 칸 수와 따로 들어온다(6번째 칸).
import { defineModifier } from '../sim/scoring.js';

export const LEGENDS = [];
const count = (str, ch) => [...str].filter((x) => x === ch).length;

function legend(id, fields, def) {
  LEGENDS.push({ id, rarity: 'legendary', ...fields });
  defineModifier(id, { kind: 'maxim', ...def });
}

legend('immortal', {
  name: '불멸의 대국', year: 1851, story: '앤더슨이 룩 둘 · 비숍 · 퀸을 버리고 이겼다',
  text: '끊겨도 사슬이 이어진다 · 끊길 때마다 배수 ×2', verb: '끊김',
  feat: '한 사슬에서 끊기지 않고 룩 둘을 먹는다', source: 'display',
  check: (h) => h.cuts === 0 && count(h.caps, 'R') >= 2,
}, {
  onCut(ctx) { ctx.cancelCut(); ctx.mulMult(2); },
});

// 외통 뒤 판을 다시 채우는 것은 사슬당 세 번까지(넷째 외통은 대국을 끝낸다) — 풀이기가 끝없이 파고들지 않게.
export const OPERA_REFILLS = 3;
legend('opera', {
  name: '오페라 대국', year: 1858, story: '모피가 오페라 관람석에서 17수 만에 이겼다',
  text: '지켜진 킹도 먹는다 · 체크메이트하면 적이 다시 차고 사슬이 이어진다', verb: '체크메이트',
  feat: '대국 첫 수에 체크메이트', source: 'display',
  check: (h) => h.move === 0 && h.mates > 0,
}, {
  // 킹 수비(셋 · 넷)를 그대로 두면 외통이 대국당 3~5%라 이 전설이 거의 듣지 않았다(첫 손 최선 수 평균 ×1.0).
  onBattleStart(ctx) { ctx.rules.openKings = true; },
  onMate(ctx) { if (ctx.chain.refills < OPERA_REFILLS) ctx.keepGoing(); },
});

legend('century', {
  name: '세기의 대국', year: 1956, story: '열세 살 피셔의 퀸 희생',
  text: '퀸 모습으로 먹을 때마다: 사슬 끝 배수 ×1.5', verb: '갈아입기',
  feat: '퀸을 먹고 곧바로 퀸을 또 먹는다', source: 'chart',
  check: (h) => h.caps.includes('QQ'),
}, {
  onChainEnd(ctx) {
    const n = ctx.chain.captures.filter((c) => c.form === 'Q').length;
    if (n) ctx.mulMult(1.5 ** n);
  },
});

legend('evergreen', {
  name: '상록의 대국', year: 1852, story: '끝없이 이어지는 공격',
  text: '사슬이 멈추면 한 번, 그 모습으로 다시 떨궈 잇는다', verb: '떨구기',
  feat: '한 사슬에 여덟을 먹는다', source: 'engraving',
  check: (h) => h.captures >= 8,
}, {
  onChainStop(ctx) { ctx.redrop(); },
});

legend('eight_pawns', {
  name: '폰 여덟의 행진', year: null, story: '여덟 폰이 모두 프로모션한 전설',
  text: '폰으로 시작: 여섯째 줄에서 프로모션 · 프로모션마다 배수 ×3', verb: '프로모션',
  feat: '한 사슬에서 두 번 프로모션한다', source: 'piece',
  check: (h) => h.promotions >= 2,
}, {
  onDrop(ctx) { if (ctx.chain.dropType === 'P') ctx.flags.promoteFrom = 5; },
  onPromote(ctx) { if (ctx.chain.dropType === 'P') ctx.mulMult(3); },
});

export const LEGEND_BY_ID = Object.fromEntries(LEGENDS.map((l) => [l.id, l]));
export const FRAGMENT_PARTS = ['first', 'feat', 'gold'];
