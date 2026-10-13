// 해금 사다리: 단계 0은 처음부터 열린 것, 그 뒤는 단계마다 새로 열리는 id. 판 밖 진행이 단계를 올린다(화면 · 기록 연결은 아직 없다).
// 의존: 특수 기물 · 각인을 가리키거나 만들어 내는 것은 그 대상과 같은 단계거나 뒤(test/unlocks.test.js가 잰다).
export const UNLOCK_KINDS = ['maxims', 'pieces', 'souls', 'engravings', 'josekis'];

export const UNLOCK_TIERS = [
  { // 0: 기본 기물만으로 뜻이 서는 것
    maxims: [
      'pawn_march', 'low_stance', 'farmer', 'light_step', 'first_move', 'close_call', 'chivalry',
      'wall_breaker', 'long_road', 'edge', 'diagonal', 'checkerboard', 'quick_change', 'collector_forms',
      'payback', 'lucky_coin', 'sacrifice', 'coronation', 'promotion_road', 'queen_hunt',
      'combo', 'loner', 'reply_master', 'counter_book', 'welcome', 'reinforce_hunt',
    ],
    pieces: [],
    souls: ['hunger', 'hunter', 'reaper', 'homing'],
    engravings: ['gold', 'ivory', 'glass', 'bronze'],
    josekis: ['highway', 'stepping', 'river', 'torch', 'blitz', 'long_think', 'pact'],
  },
  { maxims: ['disguise', 'youngest'], pieces: ['S'], souls: [], engravings: ['feather'], josekis: ['archery'] },
  { maxims: ['mate_hunter', 'empty_bag'], pieces: [], souls: ['retro'], engravings: ['iron'], josekis: [] },
  { maxims: ['cavalry_charge', 'mad_horse'], pieces: ['L'], souls: [], engravings: [], josekis: ['desert'] },
  { maxims: ['shadow_reading', 'ambusher', 'full_board'], pieces: [], souls: [], engravings: [], josekis: ['trap'] },
  { maxims: ['long_diagonal', 'center'], pieces: ['E'], souls: [], engravings: ['amber'], josekis: ['mitre'] },
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
