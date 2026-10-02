// 세력 여덟(docs/design-notes/factions.md): 관 하나가 한 세력의 땅이다. 그 관의 세 대국(연습 · 정식 · 명인)이 모두 그 세력과 둔다.
// 세력마다 네 가지가 다르다.
//   주력 적  mix     관별 적 무게(setup.js enemyWeights)에 곱하는 수. fairy 키는 이형 전부에 곱한다
//   고유 적  unique  1관부터 조금씩 섞이는 이형(무게는 관마다 는다, setup.js UNIQUE)
//   버릇     habit   그 관의 모든 대국에 붙는 규칙 하나. 조정자 `faction:<id>`(kind faction)가 대국 규칙 깃발을 세운다
//   우두머리 boss    명인 대국의 규칙. 옛 명인 여덟(masters.js)을 그대로 옮겼다 — 조정자 id가 같아 옛 저장이 그대로 읽힌다
// 규칙 코드는 세력 id를 모른다: 깃발(rules.mix · unique · pawnSides · reinforceMix · walls · wallRow · fog · reinforceBonus · lookahead
// · traitMult · traitFrom · guardsBonus)만 본다.
import { defineModifier } from '../sim/scoring.js';
import { MASTER_BY_ID } from './masters.js';

export const FACTIONS = [];
function faction(id, f) {
  FACTIONS.push({ id, ...f });
  const { mix, unique, habit } = f;
  defineModifier(`faction:${id}`, {
    kind: 'faction',
    onBattleStart(ctx) {
      const r = ctx.rules;
      if (mix) r.mix = { ...mix };
      if (unique) r.unique = { ...unique };
      habit.apply(r);
    },
  });
}

// 이형 무게(setup.js FAIRY_ENEMY_W)와 같은 비. 용병단의 고유 적은 이형 아무거나
const ANY_FAIRY = { Z: 0.08, L: 0.3, O: 0.3, S: 0.3, W: 0.15, T: 0.15, E: 0.3, V: 0.3, M: 0.15, D: 0.15 };

faction('peasants', {
  name: '농민군', crest: 'sickle', hue: '#8fae4a',
  mix: { P: 1.3, N: 1.1, B: 0.5, R: 0.4, Q: 0.4 }, unique: { S: 1 },
  habit: { text: '적 폰이 옆 칸도 지킨다', apply(r) { r.pawnSides = true; } },
  boss: 'heavy_hand',
});
faction('cavalry', {
  name: '기병대', crest: 'horseshoe', hue: '#c07a3a',
  mix: { P: 0.9, N: 2.8, B: 0.6, R: 0.6, Q: 0.6 }, unique: { L: 1.6 },
  habit: { text: '증원이 모두 나이트 무리로 온다', apply(r) { r.reinforceMix = { N: 4, L: 2 }; } },
  boss: 'mirror',
});
faction('abbey', {
  name: '수도원', crest: 'lantern', hue: '#d8c070',
  mix: { P: 0.8, N: 0.6, B: 3.5, R: 0.6, Q: 0.8 }, unique: { E: 1 },
  habit: { text: '돌기둥 셋~다섯이 늘 선다', apply(r) { r.walls = [3, 5]; } },
  boss: 'silence',
});
faction('fortress', {
  name: '성채', crest: 'tower', hue: '#9aa4b0',
  mix: { P: 0.8, N: 0.6, B: 0.6, R: 1.8, Q: 0.5 }, unique: { T: 0.3, O: 1 },
  habit: { text: '성벽 한 줄이 판을 가른다 · 문은 하나', apply(r) { r.wallRow = { ranks: [3] }; } },
  boss: 'iron_wall',
});
faction('hunters', {
  name: '숲 사냥꾼', crest: 'bow', hue: '#4f9a5a',
  mix: { P: 0.5, N: 1.2, B: 0.6, R: 0.5, Q: 0.5 }, unique: { S: 6, D: 2.5 },
  habit: { text: '위 두 줄은 숲이다 · 닿으면 걷힌다', apply(r) { r.fog = Math.max(r.fog || 0, 2); } },
  boss: 'fog',
});
faction('heralds', {
  name: '전령단', crest: 'horn', hue: '#5a8ec8',
  mix: { P: 0.4, N: 0.8, B: 1, R: 0.4, Q: 0.3 }, unique: { V: 6 },
  habit: { text: '증원 +1 · 두 수 앞까지 보인다', apply(r) { r.reinforceBonus = (r.reinforceBonus || 0) + 1; r.lookahead = Math.max(r.lookahead || 1, 2); } },
  boss: 'hourglass',
});
faction('mercs', {
  name: '용병단', crest: 'coin', hue: '#e0b040',
  mix: { P: 0.8, fairy: 2 }, unique: ANY_FAIRY,
  habit: { text: '적 특성이 두 배로 붙는다', apply(r) { r.traitMult = 2; r.traitFrom = 2; } },
  boss: 'grudge',
});
faction('royal', {
  name: '왕궁 근위', crest: 'crown', hue: '#b04a6a',
  mix: { P: 1.3, N: 0.6, B: 0.6, R: 0.9, Q: 1.7 }, unique: { Z: 0.3, T: 0.6 },
  habit: { text: '킹을 지키는 적 +1', apply(r) { r.guardsBonus = (r.guardsBonus || 0) + 1; } },
  boss: 'grandmaster',
});

export const FACTION_BY_ID = Object.fromEntries(FACTIONS.map((f) => [f.id, f]));
export const FIRST_FACTION = 'peasants';
export const FINAL_FACTION = 'royal';
// 2~7관에 섞는 여섯
export const MIDDLE_FACTIONS = FACTIONS.map((f) => f.id).filter((id) => id !== FIRST_FACTION && id !== FINAL_FACTION);
// 우두머리(명인 id) → 세력. 옛 저장(run.masters)을 세력으로 옮길 때 쓴다
export const FACTION_OF_BOSS = Object.fromEntries(FACTIONS.map((f) => [f.boss, f.id]));
export const bossOf = (id) => (FACTION_BY_ID[id] ? MASTER_BY_ID[FACTION_BY_ID[id].boss] : null);
