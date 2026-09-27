// 격언 판본(HOOKS 「등급과 빛깔」). 같은 격언의 드문 빛깔. 명세는 격언의 edition = id.
// 은박 · 자개 · 무지개는 그 격언 바로 뒤(같은 자리)에서 사슬 끝에 한 번 더 듣는 조정자로 켜진다(run.js battleMods).
// 흑요는 점수에 손대지 않고 격언 칸을 하나 늘린다(slots).
// price: 격언 값에 더하는 상금(팔 때는 산 값의 절반이라 판본 값도 반이 돌아온다). weight: 판본이 붙을 때 무엇이 붙나.
import { defineModifier } from '../sim/scoring.js';

export const EDITIONS = [
  { id: 'foil', name: '은박', text: '배수 +5', price: 2, weight: 45 },
  { id: 'pearl', name: '자개', text: '값 +50', price: 3, weight: 30 },
  { id: 'rainbow', name: '무지개', text: '배수 ×1.5', price: 5, weight: 15 },
  { id: 'obsidian', name: '흑요', text: '격언 칸 +1', price: 5, weight: 10, slots: 1 },
];
export const EDITION_BY_ID = Object.fromEntries(EDITIONS.map((e) => [e.id, e]));

defineModifier('edition:foil', { kind: 'maxim', onChainEnd(ctx) { ctx.addMult(5); } });
defineModifier('edition:pearl', { kind: 'maxim', onChainEnd(ctx) { ctx.addValue(50); } });
defineModifier('edition:rainbow', { kind: 'maxim', onChainEnd(ctx) { ctx.mulMult(1.5); } });

// 격언 명세 m에 붙는 판본 조정자 명세(없으면 null). of = 그 격언의 uid(명인 「침묵」이 같이 끈다).
export function editionSpec(m) {
  if (!m.edition || EDITION_BY_ID[m.edition].slots) return null;
  const id = `edition:${m.edition}`;
  return { id, of: m.uid ?? null, kind: 'maxim' };
}
export const editionSlots = (m) => (m.edition ? EDITION_BY_ID[m.edition].slots || 0 : 0);
