// 해금 사다리: 단계 0은 처음부터 열린 것, 그 뒤는 단계마다 새로 열리는 id. 돌파한 관의 누적 수가 단계를 올린다(기록은 src/ui/records.js).
// 의존: 특수 기물 · 각인을 가리키거나 만들어 내는 것은 그 대상과 같은 단계거나 뒤(test/unlocks.test.js가 잰다).
export const UNLOCK_KINDS = ['maxims', 'pieces', 'souls', 'engravings', 'josekis'];

export const UNLOCK_TIERS = [
  { // 0: 기본 기물만으로 뜻이 서는 것
    maxims: [
      'pawn_march', 'low_stance', 'light_step', 'first_move', 'close_call', 'chivalry',
      'wall_breaker', 'long_road', 'edge', 'diagonal', 'checkerboard', 'quick_change', 'collector_forms',
      'payback', 'lucky_coin', 'sacrifice', 'coronation', 'promotion_road', 'queen_hunt',
      'combo', 'loner', 'reply_master', 'counter_book', 'welcome', 'reinforce_hunt', 'ambusher', 'long_diagonal',
    ],
    pieces: [],
    souls: ['hunger', 'hunter', 'reaper', 'homing'],
    engravings: ['gold', 'ivory', 'glass', 'bronze'],
    josekis: ['highway', 'stepping', 'river', 'torch', 'blitz', 'long_think', 'pact'],
  },
  { maxims: ['disguise', 'youngest'], pieces: ['S'], souls: [], engravings: ['feather'], josekis: ['archery'] },
  { maxims: ['mate_hunter', 'empty_bag'], pieces: [], souls: ['retro'], engravings: ['iron'], josekis: [] },
  { maxims: ['cavalry_charge', 'mad_horse'], pieces: ['L'], souls: [], engravings: [], josekis: ['desert'] },
  { maxims: ['shadow_reading', 'farmer', 'full_board'], pieces: [], souls: [], engravings: [], josekis: ['trap'] },
  { maxims: ['center'], pieces: ['E'], souls: [], engravings: ['amber'], josekis: ['mitre'] },
  { maxims: ['eldest', 'nobility'], pieces: [], souls: ['ripple'], engravings: [], josekis: ['gates'] },
  { maxims: ['rook_lift', 'no_regrets'], pieces: ['O'], souls: [], engravings: [], josekis: ['battery'] },
  { maxims: ['thrift', 'second_wind', 'promotion_feast'], pieces: [], souls: ['echo'], engravings: ['coral'], josekis: [] },
  { maxims: ['blacksmith', 'encircle'], pieces: ['T'], souls: [], engravings: ['ebony'], josekis: ['rampart'] },
  { maxims: ['vault', 'kings_step'], pieces: [], souls: ['spring'], engravings: [], josekis: ['martyr_vow'] },
  { maxims: ['specialty', 'ivory_tower'], pieces: ['V'], souls: [], engravings: [], josekis: ['meadow'] },
  { maxims: ['back_rank_dream', 'promotion_rush'], pieces: [], souls: ['relay'], engravings: ['silver'], josekis: [] },
  { maxims: ['homecoming', 'second_thought'], pieces: ['W'], souls: ['duel'], engravings: [], josekis: ['gloom'] },
  { maxims: ['small_bag', 'bare_board', 'last_square'], pieces: [], souls: [], engravings: [], josekis: ['first_mover'] },
  { maxims: ['gambler', 'soul_collector'], pieces: ['M'], souls: [], engravings: ['jade'], josekis: ['knight_oath'] },
  { maxims: ['kings_neck', 'reversal', 'all_in'], pieces: [], souls: ['martyr'], engravings: [], josekis: ['highlander'] },
  { maxims: ['steadfast', 'last_move'], pieces: ['D'], souls: ['absorb'], engravings: [], josekis: ['captive'] },
  { maxims: ['long_chain', 'collector'], pieces: [], souls: ['shade'], engravings: ['marble'], josekis: ['gomoku'] },
  { maxims: ['memory', 'whim'], pieces: ['Z'], souls: ['crown', 'transcend'], engravings: [], josekis: [] },
  { maxims: ['asceticism', 'pilgrimage'], pieces: [], souls: ['inherit'], engravings: [], josekis: ['throne', 'clone'] },
];
export const MAX_TIER = UNLOCK_TIERS.length - 1;

const clampTier = (tier) => Math.max(0, Math.min(MAX_TIER, Math.floor(Number(tier) || 0)));
// 그 단계까지 열린 id 묶음(판 상태 run.unlocked에 그대로 들어가는 꼴)
export function unlockedAt(tier) {
  const out = Object.fromEntries(UNLOCK_KINDS.map((k) => [k, []]));
  for (let i = 0; i <= clampTier(tier); i++) for (const k of UNLOCK_KINDS) out[k].push(...UNLOCK_TIERS[i][k]);
  return out;
}
// 그 id가 열리는 단계(사다리에 없으면 -1)
export function tierOf(kind, id) {
  return UNLOCK_TIERS.findIndex((t) => t[kind].includes(id));
}

// 단계 n이 열리는 누적 돌파 관 수(UNLOCK_GATES[0] = 0)
export const UNLOCK_GATES = [0, 2, 5, 8, 12, 16, 20, 25, 30, 35, 41, 47, 53, 60, 67, 74, 82, 90, 98, 107, 116];
// 누적 관 수로 갈 수 있는 가장 높은 단계
export function tierForGates(gates) {
  let t = 0;
  while (t < MAX_TIER && gates >= UNLOCK_GATES[t + 1]) t++;
  return t;
}
// 판에서 돌파한 관 수: 이기면 여덟(끝없는 대국은 실제 돌파한 관), 지면 도달한 관 앞까지
export function gatesOfRun(run) {
  const past = Math.max(0, (run.ante || 1) - 1);
  return run.phase === 'won' ? 8 : run.endless ? Math.max(8, past) : past;
}
// 판이 끝날 때: 관 수는 그대로 쌓고, 단계는 문턱을 넘었어도 한 판에 하나만(canOpen이 거짓이면 이 판은 이미 하나 열었다)
export function advanceUnlock(tier, gates, add, canOpen = true) {
  const total = Math.max(0, Math.floor(gates || 0)) + Math.max(0, Math.floor(add || 0));
  const from = clampTier(tier);
  const opened = canOpen && from < tierForGates(total) ? from + 1 : null;
  return { tier: opened ?? from, gates: total, opened };
}
// 지금 자리: next(다음 단계 | null) · left(다음까지 남은 관, 0이면 다음 판이 끝날 때 열린다) · p(다음 칸까지 온 몫 0 ~ 1)
export function unlockProgress(tier, gates) {
  const t = clampTier(tier), g = Math.max(0, Math.floor(gates || 0));
  if (t >= MAX_TIER) return { tier: t, gates: g, next: null, left: 0, p: 1 };
  const a = UNLOCK_GATES[t], b = UNLOCK_GATES[t + 1];
  return { tier: t, gates: g, next: t + 1, left: Math.max(0, b - g), p: Math.max(0, Math.min(1, (g - a) / (b - a))) };
}
