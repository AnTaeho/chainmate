// 판(런): 8관 × (연습 · 정식 · 명인), 보상, 상점, 꾸러미, 끝없는 대국.
// 상태는 순수 객체(JSON 왕복 안전). 바꾸는 길은 applyRun(run, cmd) 하나뿐, 둘 수 있는 명령은 legalRunCommands(run).
// 대국은 run.battle에 들어 있고 대국 명령(drop · capture · discard)은 그대로 넘긴다.
//
// 국면(run.phase)과 명령
//   draft   1 · 3 · 5관의 첫 대국 앞(깊이 E). joseki(셋 중 하나, 건너뛸 수 없다)
//   select  다음 대국 앞.   play | skip(연습 · 정식만) | use | moveMaxim | shop(떠나온 상점으로 돌아가기)
//   battle  대국 중.        drop | capture | discard | unscript(대본 대국을 건너뛰어 평범한 대국으로)
//   shop    대국을 이긴 뒤(진 뒤에도 시계가 남으면 — 보상 없이). buy | buyPack | reroll | sell | use | promote | remove | moveMaxim | leave
//   pack    꾸러미를 연 뒤. pick | skipPack
//   won     8관 명인을 이김. endless
//   lost    끝.
import { createRng, fork, int, next, shuffle } from './rng.js';
import { boardFilter } from './tuning.js';
import { parseSq } from './board.js';
import { SCRIPT } from '../data/tutorial.js';
import { createBattle, apply as applyBattle, legalCommands as battleCommands, BASE_REWARD, GOLDEN, DEFAULT_RULES, refreshHints } from './battle.js';
import { getModifier } from './scoring.js';
import { SHOP, PROMOTE, rollDisplay, rollPacks, rollPackOptions, rerollCost, weighted, rollEdition, maximPrice, fragmentMult, rollSoul } from './shop.js';
import { gradeOf, markFairy } from './chain.js';
import { MAXIM_BY_ID } from '../data/maxims.js';
import { CHART_TABLE, CHART_FORMS } from '../data/charts.js';
import { ENGRAVING_BY_ID } from '../data/engravings.js';
import { FACTIONS, FACTION_BY_ID, FIRST_FACTION, FINAL_FACTION, MIDDLE_FACTIONS, FACTION_OF_BOSS } from '../data/factions.js';
import { OPENINGS, DEFAULT_OPENING } from '../data/openings.js';
import { EDITION_BY_ID, editionSpec, editionSlots } from '../data/editions.js';
import { LEGENDS, LEGEND_BY_ID } from '../data/legends.js';
import { familyCounts, familyMods } from '../data/families.js';
import { JOSEKIS, JOSEKI_BY_ID, DRAFT_ANTES, DRAFT_TIERS } from '../data/josekis.js';
import { useTactic, evolveTo } from '../data/tactics.js';
import { TRAIT_CHANCE } from '../data/traits.js';
import { FAIRIES } from '../data/pieces.js';

// ── 수치
// 관별 목표 기준. 대국 목표 = B[관] × 종류 배율. tools/run.mjs(smart 봇)로 맞춤:
//   1관은 격언 없이도 넘는다(100%), 2~4관에서 첫 격언 · 기보를 못 모은 판이 떨어져 4관 도달 80%대,
//   5~7관은 관마다 ×2.3~2.5 — 격언의 곱(×배수)과 기보 레벨이 붙은 짜임이라야 따라간다.
//   8관은 명인 「대가」(기보 무시)가 벽이라 8관 연습 · 정식만 보고 잡았다(보고서 참고).
// 깊이 층(이형 · 가족 · 정석 · 혼 …) 뒤 다시 맞춤(보고서 docs/reports/depth.md): 옛 곡선 그대로면 smart 봇 판 승률 89.7%(30판).
//   2관 ×1.17 · 3관 ×2.5 · 4관 ×2.5 · 5관 ×3.8 · 6관 ×6.9 · 7관 ×5.8 · 8관 ×5.7 + 킹 수비 5관 다섯 · 6관부터 여섯 → 20.0%(30판).
// 밤샘 2(시계 · 다시 놓기 · 나쁜 판 거르기 · 가짓수 뒤) 다시 맞춤: 옛 곡선이면 smart 50%(40판) — 4관 ×1.23 · 5관 ×1.5 · 6관 ×1.5 · 7관 ×1.55 · 8관 ×1.53 → 40%(docs/reports/night2.md)
// CHM-20: 진 뒤 상점을 열고, 대국 하나의 체감 운을 줄이려고 4~8관 인상 폭을 절반쯤으로 — 옛 곡선 대비 ×1.12 · 1.25 · 1.25 · 1.27 · 1.32
//   (targetFor가 유효 숫자 둘로 반올림해 연습 목표로는 ×1.15 · 1.26 · 1.27 · 1.29 · 1.29). 8관 1080000은 smart 52%(50판)라
//   명인(대가) 목표만 한 칸(2.2M → 2.3M) 올리는 1125000으로 — smart 50.0%(50판) · 단 8 10.0%(30판), docs/reports/night2.md 「CHM-20 손질」
export const B = [150, 700, 5000, 14500, 62500, 275000, 535000, 1125000];
export const KIND_MULT = { practice: 1, official: 1.5, master: 2 };
export const KINDS = ['practice', 'official', 'master'];
export const ANTES = 8;
export const ENDLESS_GROWTH = 2.2; // 9관부터 관마다 목표 ×
export const REWARD = {
  // 연습 3 · 정식 4 · 명인 2. 명인은 2a의 5에서 명인의 상자 몫만큼 뺐다: 상자 기댓값 ≈ 1.5칸 × 상금 2~3어치 ≈ 3.6이라
  // 2 + 3.6 ≈ 2a의 5. 3으로 두면 판 봇 승률 24%(300판), 상자를 얹고 5 그대로면 34%(80판) — 보고서 2b.
  base: { ...BASE_REWARD, master: 2 },
  perMove: 1,          // 남은 수 하나당
  interestStep: 5,     // 가진 상금 5당 1
  interestMax: 5,
  mate: 3,             // 외통으로 이기면
  overflow: { 5: 1, 10: 2 }, // 목표를 ×5 · ×10 넘기면 덤. ×2부터 주면(이긴 대국의 절반) 판 봇 승률이 10%p 넘게 올라 작게 묶었다
};
// 명인의 상자(명인 대국을 이기면): 몇 개가 나오나(무게, HOOKS 1 흔함 · 3 드묾 · 5 ~3%)와 한 칸에 무엇이 드나.
export const CHEST = {
  counts: [[1, 77], [3, 20], [5, 3]],
  // 판본은 넣지 않는다: 가진 격언에 곧바로 붙어(은박 배수 +5) 상자 하나가 판 봇 승률을 10%p 넘게 올렸다(보고서 2b).
  items: [['money', 60], ['chart', 30], ['engrave', 10], ['fairy', 6]],
  money: 2,     // 상금 칸 하나
  cells: 5,     // 릴 칸 수. 나온 개수만큼 가운데부터 불이 켜진다(1: 가운데 · 3: 가운데 셋 · 5: 전부)
};
export const RUN_DEFAULTS = { money: 4, maximSlots: 5, consumableSlots: 2 };
// 시계(밤샘 2 D1): 판의 목숨. 대국을 지면 한 칸을 잃고 다음 대국으로 간다(그 대국의 보상 · 명인의 상자는 없고, 상점은 연다 — CHM-20).
// 마지막 칸을 잃으면(시간을 다 쓰면) 판이 끝난다 — 시계 1은 옛 규칙(한 번 지면 끝)과 같다.
// 8관 명인(대가)에서 지고 칸이 남으면 그 대국을 새 판으로 다시 둔다.
export const CLOCK = { start: 3 };
// 건너뛰기 패(대국마다 정해진 하나). step 2b에서 늘린다.
export const TAGS = [
  { kind: 'money', amount: 5 },
  { kind: 'chart' },          // 정해진 모습의 기보 한 장을 곧바로 쓴다
];

const clone = (x) => JSON.parse(JSON.stringify(x));
const root = (run) => createRng(run.seed);

// 단(난이도, 판 밖): 한 판을 이기면 다음 단이 열린다. 단 k는 1..k번 규칙을 모두 켠다(단 0 = 기본, 규칙 없음).
export const DANS = [
  { n: 1, text: '증원 +1' },
  { n: 2, text: '상점 값 +1' },
  { n: 3, text: '상자 다섯 칸 · 첫 조각이 반' },
  { n: 4, text: '시계 −1' },
  { n: 5, text: '목표 ×1.1' },
  { n: 6, text: '버리기 −1' },
  { n: 7, text: '시계 −1' },
  { n: 8, text: '대가 목표 ×1.25' },
];
// 밤샘 2: 시계가 들어오며 다시 짰다. 시계 3 → 4단 2 → 7단 1(한 번 지면 끝, 옛 규칙과 같다).
// 옛 표(목표 ×1.25 · 수 −1 · 대가 ×1.5 …)에 시계 1을 얹으면 8단 smart 3~7%(30판)라, 목표 ×1.1 · 대가 ×1.25로 누그러뜨리고 수 −1을 뺐다 → 10%.
// 단 0에 시계 1만 걸면 16.7%(30판) — 8단은 옛 단 0(17.5%)보다 조금 어렵다
export function danRules(dan) {
  return {
    reinforce: dan >= 1 ? 1 : 0, price: dan >= 2 ? 1 : 0, chestFive: dan >= 3 ? 0.5 : 1, fragment: dan >= 3 ? 0.5 : 1, clock: dan >= 7 ? -2 : dan >= 4 ? -1 : 0,
    target: dan >= 5 ? 1.1 : 1, discards: dan >= 6 ? -1 : 0, moves: 0, finalTarget: dan >= 8 ? 1.25 : 1,
  };
}

export function targetFor(ante, kind, mult = 1) {
  const base = ante <= ANTES ? B[ante - 1] : B[ANTES - 1] * ENDLESS_GROWTH ** (ante - ANTES);
  const raw = base * KIND_MULT[kind] * mult;
  // 보기 좋게: 유효 숫자 둘
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(raw)) - 1);
  return Math.round(raw / mag) * mag;
}

// 관의 세력(docs/design-notes/factions.md): 1관 농민군 · 8관 왕궁 근위 고정, 2~7관은 판 시드로 섞은 여섯. 끝없는 대국은 관마다 아무 세력
export function factionFor(run, ante) {
  if (ante <= ANTES) return run.factions[ante - 1];
  const r = fork(root(run), `faction:${ante}`);
  return FACTIONS[int(r, FACTIONS.length)].id;
}
const masterFor = (run, ante) => FACTION_BY_ID[factionFor(run, ante)].boss;
// 판의 세력 순서: [농민군, 섞은 여섯, 왕궁 근위]
export function factionOrder(seed) {
  const r = fork(createRng(seed), 'factions');
  return [FIRST_FACTION, ...shuffle(r, [...MIDDLE_FACTIONS]), FINAL_FACTION];
}
// 옛 저장(세력 전, run.masters = 관마다 명인 id): 명인을 우두머리로 둔 세력으로 옮긴다. 싸울 명인 차례가 그대로 남는다.
export function migrateRun(run) {
  if (!run || run.factions) return run;
  run.factions = Array.isArray(run.masters) && run.masters.length === ANTES && run.masters.every((id) => FACTION_OF_BOSS[id])
    ? run.masters.map((id) => FACTION_OF_BOSS[id])
    : factionOrder(run.seed ?? 1);
  delete run.masters;
  return run;
}

function tagFor(run, ante, blind) {
  const r = fork(root(run), `tag:${ante}:${blind}`);
  const tag = { ...TAGS[int(r, TAGS.length)] };
  if (tag.kind === 'chart') tag.form = CHART_FORMS[int(r, CHART_FORMS.length)];
  return tag;
}

// 지금(또는 다음) 대국의 정보: 종류 · 목표 · 세력 · 명인(세력의 우두머리) · 건너뛰기 패
export function blindInfo(run, ante = run.ante, blind = run.blind) {
  const kind = KINDS[blind];
  const faction = factionFor(run, ante);
  const master = kind === 'master' ? masterFor(run, ante) : null;
  const st = run.stake;
  // 단 8 「대가 목표 ×1.25」: 왕궁 근위의 우두머리 대국
  const mult = (st ? st.target * (master && faction === FINAL_FACTION ? st.finalTarget : 1) : 1) * josekiTargetMult(run);
  return {
    ante, blind, kind,
    target: targetFor(ante, kind, mult),
    faction,
    master,
    tag: kind === 'master' ? null : tagFor(run, ante, blind),
  };
}

// draft: false면 정석 드래프트 없이(깊이 E 이전 규칙 — 시험 · 하네스 비교용)
// script: 첫 대국(1관 연습)을 대본 대국으로(CHM-22, 기본 오프닝 · 단 0만). 레퍼토리 고르기는 그 대국 뒤로 미룬다 —
//   레퍼토리가 판 위 사물 · 목표 · 주머니를 바꾸면 정해 둔 판이 어긋나서
export function createRun({ seed = 1, opening = DEFAULT_OPENING, dan = 0, draft = true, script = false } = {}) {
  const op = OPENINGS[opening];
  if (!op) throw new Error(`unknown opening ${opening}`);
  const conf = { ...RUN_DEFAULTS, ...op.run };
  const rules = clone(op.rules);
  const stake = dan > 0 ? danRules(dan) : null;
  if (stake) {
    if (stake.discards) rules.discards = (rules.discards ?? DEFAULT_RULES.discards) + stake.discards;
    if (stake.moves) rules.moves = (rules.moves ?? DEFAULT_RULES.moves) + stake.moves;
    if (stake.reinforce) rules.reinforceBonus = stake.reinforce;
  }
  const run = {
    v: 1,
    seed, opening, dan, stake,
    rules,
    ante: 1, blind: 0,
    phase: 'select',
    endless: false,
    money: conf.money,
    clock: Math.max(0, CLOCK.start + (stake ? stake.clock : 0)),
    clockMax: Math.max(0, CLOCK.start + (stake ? stake.clock : 0)),
    deck: op.bag.map((t, i) => ({ id: i + 1, t, eng: null, edition: null })),
    nextPieceId: op.bag.length + 1,
    maxims: [],               // [{ uid, id, data, edition, paid }] 왼쪽부터
    josekis: [],              // 고른 정석 id(깊이 E)
    draft: null,              // { ante, options: [id…] } 정석을 고르는 중
    maximSlots: conf.maximSlots,
    consumables: [],          // [{ kind: 'chart', form } | { kind: 'engraving', id }]
    consumableSlots: conf.consumableSlots,
    charts: Object.fromEntries(CHART_FORMS.map((f) => [f, 0])),
    factions: factionOrder(seed), // 관마다 세력 id(1관 농민군 · 8관 왕궁 근위)
    fragments: {},            // { [명국 id]: { first, feat, gold } } — 불멸의 기보 조각
    legends: [],              // 완성한 명국 id(전설 격언은 maxims에 legendary: true로, 격언 칸 수와 따로)
    nextUid: 1,
    battle: null,
    shop: null,
    pack: null,
    last: null,               // 마지막 대국 결과와 보상 내역(화면용)
    log: [],                  // 대국마다 한 줄(하네스 · 결과 화면용)
  };
  if (!draft) run.noDraft = true;
  if (script && opening === DEFAULT_OPENING && !dan) { run.script = SCRIPT.id; run.draftLate = run.ante; }
  openDraft(run);
  return run;
}

// ── 정석 드래프트(깊이 E): 1 · 3 · 5관의 첫 대국 앞에 셋 중 하나
function openDraft(run) {
  if (run.noDraft || run.endless || run.script || !DRAFT_ANTES.includes(run.ante) || (run.drafted || []).includes(run.ante)) return;
  // 대본 대국 뒤로 미룬 레퍼토리 고르기(draftLate)는 그 관의 다음 대국 앞에서
  if (run.blind !== 0 && run.draftLate !== run.ante) return;
  const r = fork(root(run), `draft:${run.ante}`);
  const pool = JOSEKIS.filter((j) => !run.josekis.includes(j.id));
  const options = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const tier = weighted(r, DRAFT_TIERS[run.ante]);
    let cand = pool.filter((j) => j.tier === tier);
    if (!cand.length) cand = pool;
    const j = cand[int(r, cand.length)];
    options.push(j.id);
    pool.splice(pool.indexOf(j), 1);
  }
  run.draft = { ante: run.ante, options };
  run.phase = 'draft';
}
// 정석이 바꾸는 목표 배율(「하이랜더」)
export function josekiTargetMult(run) {
  let k = 1;
  for (const id of run.josekis || []) { const j = JOSEKI_BY_ID[id]; if (j && j.targetMult) k *= j.targetMult(run); }
  return k;
}

// ── 대국 만들기
// 대국에 켜질 조정자: 세력의 버릇 → 명인 → 기보 → 격언(왼쪽부터). build = { charts, maxims } (판 자체거나 봇이 그려 본 변형)
export function battleMods(build, master = null, faction = null) {
  const mods = [];
  if (faction) mods.push({ id: `faction:${faction}` });
  if (master) mods.push({ id: master });
  mods.push({ id: 'charts', data: { table: CHART_TABLE, levels: { ...build.charts } } });
  // 가족(깊이 B): 문턱을 넘은 가족마다 하나(정석 「복제」면 가장 많이 모은 가족의 문턱이 하나 낮다)
  const counts = familyCounts(build);
  let dropFor = null;
  if ((build.josekis || []).includes('clone')) { const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]; if (top && top[1] > 0) dropFor = top[0]; }
  mods.push(...familyMods(counts, dropFor));
  // 정석(깊이 E)
  for (const id of build.josekis || []) mods.push({ id: `joseki:${id}` });
  // onBuild: 짜임에서 셀 값(격언 「혼 수집가」 · 「금욕」). 격언 칸 빈자리는 판의 칸 수로(봇의 그려 보기는 기본 칸)
  const room = maximCapacity({ maximSlots: build.maximSlots ?? RUN_DEFAULTS.maximSlots, maxims: build.maxims }) - build.maxims.filter((m) => !m.legendary).length;
  const view = { deck: build.deck || [], maximFree: Math.max(0, room) };
  for (const m of build.maxims) {
    const spec = { id: m.id, uid: m.uid, data: clone(m.data || {}) };
    const def = getModifier(m.id);
    if (def && def.onBuild) def.onBuild(spec, view);
    mods.push(spec);
    const ed = editionSpec(m);
    if (ed) mods.push(ed);
  }
  return mods;
}

// 대국 시드: 8관 명인을 시계를 써서 다시 둘 때는 몇째 다시 두기인지를 붙인다
export const battleSeed = (run, ante = run.ante, blind = run.blind) =>
  fork(root(run), `battle:${ante}:${blind}${run.retry ? `:${run.retry}` : ''}`).s;
function startBattle(run) {
  const info = blindInfo(run);
  // 대본 대국: 1관 연습 하나만. 판 조정(거르기 · 다시 놓기)은 끄고 정해 둔 판을 깐다(세력 버릇 · 기보는 평소대로 켜진다)
  const scripted = !!run.script && run.ante === 1 && run.blind === 0 && info.kind === 'practice';
  run.battle = createBattle({
    seed: battleSeed(run), ante: run.ante, kind: info.kind, target: info.target,
    bag: run.deck.map((p) => ({ t: p.t, id: p.id, eng: p.eng, ...(p.soul ? { soul: p.soul } : {}) })),
    rules: scripted ? { ...run.rules, reboards: 0 } : run.rules, mods: battleMods(run, info.master, info.faction),
    goldenChance: awaitingGold(run) ? GOLDEN.calling : GOLDEN.chance,
    golden: scripted ? false : null,
    filter: run.scratch || scripted ? 0 : boardFilter(), // 판 조정(tuning.js) — 나쁜 판 거르기
  });
  if (scripted) layScript(run.battle, SCRIPT);
  run.phase = 'battle';
}

// 대본 판을 깐다: 적 · 손 · 주머니(판의 주머니에서 종류로 골라 같은 id) · 수마다 증원 · 목표
export function layScript(b, sc) {
  let id = 1;
  b.board = new Array(64).fill(null);
  for (const [name, t] of Object.entries(sc.board)) b.board[parseSq(name)] = { t, id: id++, born: -1 };
  b.nextId = Math.max(b.nextId, id);
  const pool = [...b.hand, ...b.bag];
  const take = (t) => { const i = pool.findIndex((p) => p.t === t); if (i < 0) throw new Error(`script needs ${t}`); return pool.splice(i, 1)[0]; };
  b.hand = sc.hand.map(take);
  b.bag = [...sc.bag.map(take), ...pool];
  b.target = sc.target;
  b.script = sc.id;
  b.plan = sc.plan.map((list) => list.map((r) => ({ sq: parseSq(r.sq), t: r.t })));
  // 대국이 판을 바꿀 때마다 부르는 차례와 같게: 증원 예고 → 이형 적 표시 → 화면용 표시
  b.incoming = b.plan.shift() || [];
  b.incomingNext = b.plan[0] || [];
  markFairy(b);
  refreshHints(b);
}

function runEvent(run, ev) {
  for (const m of run.maxims) {
    const def = getModifier(m.id);
    if (def && def.onRunEvent) def.onRunEvent(m, ev);
  }
}

function interest(money) {
  return Math.min(REWARD.interestMax, Math.floor(Math.max(0, money) / REWARD.interestStep));
}

function endBattle(run, events) {
  const b = run.battle;
  const info = blindInfo(run);
  const best = b.history.reduce((a, h) => Math.max(a, h.score), 0);
  const won = b.status === 'won';
  if (b.script) run.script = null; // 대본 대국은 한 번(뒤로 미룬 레퍼토리 고르기가 다음 대국 앞에 열린다)
  // 깨진 기물(유리)은 주머니에서 빠진다
  if (b.shattered.length) run.deck = run.deck.filter((p) => !b.shattered.includes(p.id));
  // 정석 「결사」: 첫 사슬을 푼 기물은 판에서 사라진다(주머니 여섯은 남긴다) · 「왕좌」: 승급한 폰은 퀸으로
  for (const id of b.exiled || []) if (run.deck.length > SHOP.deckMin) { run.deck = run.deck.filter((p) => p.id !== id); events.push({ type: 'exile', pieceId: id }); }
  // 적 특성 「배신자」: 먹은 배신자가 내 주머니로(주머니가 너무 커지지 않게 열넷까지)
  for (const t of b.traitors || []) if (run.deck.length < TRAIT_CHANCE.traitorDeckMax) addPiece(run, t, events);
  for (const id of b.crowned || []) { const p = run.deck.find((x) => x.id === id); if (p && p.t === 'P') { p.t = 'Q'; events.push({ type: 'evolve', pieceId: id, from: 'P', to: 'Q' }); } }
  // 혼 「계승」: 사슬이 끝난 모습으로(여러 번이면 마지막)
  for (const { id, to } of b.becomes || []) { const p = run.deck.find((x) => x.id === id); if (p && p.t !== to) { events.push({ type: 'evolve', pieceId: id, from: p.t, to }); p.t = to; } }
  const grades = {};
  for (const h of b.history) { const g = gradeOf(h.captures); if (g) grades[g.mark] = (grades[g.mark] || 0) + 1; }
  // 하네스용: 사슬에서 입은 모습(먹은 종류, 킹 · 보석 빼고)의 수 — 세력마다 퍼즐 모양이 다른지 보는 지표
  const worn = {};
  for (const h of b.history) for (const t of h.caps || '') if (t !== 'K' && t !== 'J') worn[t] = (worn[t] || 0) + 1;
  const row = {
    ante: run.ante, blind: run.blind, kind: info.kind, faction: info.faction, master: info.master, target: b.target ?? info.target,
    score: b.score, won, reason: b.result.reason, moves: b.movesUsed, best,
    goldenSeen: b.board.some((c) => c && c.gold) || b.golden > 0, golden: b.golden, overflow: b.overflow, grades,
    // 하네스용: 이 대국 때 주머니에 있던 혼 · 외통을 낸 사슬의 혼
    souls: [...new Set(run.deck.filter((p) => p.soul).map((p) => p.soul))],
    mateSoul: b.result.reason === 'mate' ? (b.history.at(-1) || {}).soul || null : null,
    discarded: b.discarded,
    reboards: b.reboards || 0,
    worn,
  };
  run.log.push(row);
  if (!won) {
    run.last = { ...row, reward: null };
    // 시계 한 칸을 잃는다. 남은 칸이 있으면 다음 대국으로(8관 명인은 같은 대국을 새 판으로), 다 쓰면 판이 끝난다
    if (run.clock != null && run.clock > 0) {
      run.clock--;
      row.clockLost = true;
      run.last.clockLost = true;
      events.push({ type: 'clockLost', clock: run.clock, ante: run.ante, blind: run.blind });
    }
    // CHM-20: 진 대국 뒤에도 상점은 연다(보상 · 명인의 상자는 없다) — 지면 덱을 보강할 기회까지 사라져 연쇄로 무너졌다.
    // 8관 명인은 떠나면 같은 대국 앞으로 돌아온다(stay).
    if (run.clock > 0) {
      run.battle = null;
      const stay = run.ante === ANTES && info.kind === 'master' && !run.endless;
      if (stay) run.retry = (run.retry || 0) + 1;
      openShop(run);
      if (stay) run.shop.stay = true;
      return;
    }
    run.phase = 'lost';
    events.push({ type: 'runLost', ante: run.ante, blind: run.blind });
    return;
  }
  const mate = b.result.reason === 'mate';
  const reward = {
    base: REWARD.base[info.kind],
    moves: REWARD.perMove * b.movesLeft,
    interest: interest(run.money),
    mate: mate ? REWARD.mate : 0,
    overflow: REWARD.overflow[b.overflow] || 0,
    earned: b.money,
  };
  reward.total = reward.base + reward.moves + reward.interest + reward.mate + reward.overflow + reward.earned;
  run.money += reward.total;
  run.last = { ...row, reward };
  events.push({ type: 'reward', ...reward });
  runEvent(run, { type: 'battleWon', reason: b.result.reason, kind: info.kind });
  run.battle = null;
  if (info.kind === 'master') row.chest = openChest(run, events);
  const goldenPack = b.golden > 0 ? goldenReward(run, b.golden, events) : null;
  if (run.ante === ANTES && info.kind === 'master' && !run.endless) {
    run.phase = 'won';
    events.push({ type: 'runWon' });
    return;
  }
  openShop(run);
  if (goldenPack) {
    run.shop.goldenFragment = goldenPack.fragment;
    run.shop.packs.push({ kind: 'golden', price: 0, sold: false });
    events.push({ type: 'goldenPack', fragment: goldenPack.fragment });
  }
}

// ── 불멸의 기보
export const legendInfo = (id) => LEGEND_BY_ID[id];
const fragOf = (run, id) => run.fragments[id] || (run.fragments[id] = { first: false, feat: false, gold: false });

// 조각 하나를 준다. 셋이 모이면 전설 격언이 칸 수와 따로 들어온다.
function grantFragment(run, id, part, events) {
  const f = fragOf(run, id);
  if (f[part]) return false;
  f[part] = true;
  events.push({ type: 'fragment', legend: id, part, have: { ...f } });
  if (f.first && f.feat && f.gold && !run.legends.includes(id)) {
    run.legends.push(id);
    const m = { uid: run.nextUid++, id, data: {}, edition: null, paid: 0, legendary: true };
    run.maxims.push(m);
    events.push({ type: 'legend', legend: id, uid: m.uid });
  }
  return true;
}

// 첫 조각과 재현을 모아 금빛 조각만 남은 명국이 있나(그동안 금빛 적이 자주 나온다: GOLDEN.calling)
export const awaitingGold = (run) => LEGENDS.some((l) => { const f = run.fragments[l.id]; return f && f.first && f.feat && !f.gold; });

// 재현: 끝난 사슬 요약 h로 첫 조각을 가진 명국의 둘째 조각을 판정한다.
function checkFeats(run, h, events) {
  for (const l of LEGENDS) {
    const f = run.fragments[l.id];
    if (f && f.first && !f.feat && l.check(h)) grantFragment(run, l.id, 'feat', events);
  }
}

// 금빛 적을 먹고 이긴 대국 뒤: 재현까지 해낸 명국 하나의 셋째(금빛) 조각 — 조각은 첫 → 재현 → 금빛 차례로만 모인다
// (HOOKS 「가진 조각 중 하나의 다음 조각」). 첫 조각이 하나도 없으면 금빛 꾸러미에 첫 조각이 끼어 나올 기회.
// 돌려주는 값 { fragment: 꾸러미에 첫 조각이 드나 }
function goldenReward(run, n, events) {
  const r = fork(root(run), `golden:${run.ante}:${run.blind}`);
  let fragment = false;
  for (let i = 0; i < n; i++) {
    const ready = LEGENDS.filter((l) => { const f = run.fragments[l.id]; return f && f.first && f.feat && !f.gold; });
    if (ready.length) grantFragment(run, ready[int(r, ready.length)].id, 'gold', events);
    else if (!LEGENDS.some((l) => run.fragments[l.id] && run.fragments[l.id].first) && next(r) < SHOP.goldenFragmentChance * fragmentMult(run)) fragment = true;
  }
  return { fragment };
}

// ── 명인의 상자. 결과는 판 시드와 관으로 정해진다(릴은 화면의 몫: 이벤트에 칸마다 무엇이 멈추는지 다 싣는다).
function openChest(run, events) {
  const r = fork(root(run), `chest:${run.ante}`);
  const count = weighted(r, chestCounts(run));
  const items = [];
  for (let i = 0; i < count; i++) items.push(chestItem(run, r, items));
  const lit = litCells(count);
  let k = 0;
  const cells = Array.from({ length: CHEST.cells }, (_, i) => (lit.includes(i) ? { lit: true, item: items[k++] } : { lit: false, item: null }));
  events.push({ type: 'chest', count, tier: count >= 5 ? 'rare' : count >= 3 ? 'uncommon' : 'common', cells, items: clone(items) });
  for (const it of items) applyChestItem(run, it, events);
  return count;
}
// 단 5부터 다섯 칸 무게가 반(덜어 낸 몫은 한 칸으로)
export function chestCounts(run) {
  const f = run.stake ? run.stake.chestFive : 1;
  if (f === 1) return CHEST.counts;
  const five = CHEST.counts.find(([n]) => n === 5)[1];
  return CHEST.counts.map(([n, w]) => [n, n === 5 ? w * f : n === 1 ? w + five * (1 - f) : w]);
}
const litCells = (n) => { const mid = (CHEST.cells - 1) / 2, h = (n - 1) / 2; return Array.from({ length: n }, (_, i) => mid - h + i); };

// 칸 하나를 굴려 구체적인 물건으로 정한다. 앞 칸(prev)이 고른 격언 · 기물은 다시 고르지 않는다.
function chestItem(run, r, prev) {
  const kind = weighted(r, CHEST.items);
  if (kind === 'edition') {
    const pool = run.maxims.filter((m) => !m.legendary && !m.edition && !prev.some((x) => x.uid === m.uid));
    if (pool.length) {
      const m = pool[int(r, pool.length)];
      return { kind: 'edition', uid: m.uid, id: m.id, edition: rollEdition(r) };
    }
  }
  if (kind === 'engrave') {
    const pool = run.deck.filter((p) => !p.eng && !prev.some((x) => x.pieceId === p.id));
    if (pool.length) {
      const p = pool[int(r, pool.length)];
      const ids = Object.keys(ENGRAVING_BY_ID);
      return { kind: 'engrave', pieceId: p.id, piece: p.t, eng: ids[int(r, ids.length)] };
    }
  }
  if (kind === 'fairy') return { kind: 'piece', t: weighted(r, SHOP.fairyWeights) };
  if (kind === 'money') return { kind: 'money', money: CHEST.money };
  return { kind: 'chart', form: CHART_FORMS[int(r, CHART_FORMS.length)] };
}

function applyChestItem(run, it, events) {
  if (it.kind === 'chart') useChart(run, it.form, events);
  else if (it.kind === 'money') { run.money += it.money; events.push({ type: 'money', src: 'chest', money: it.money }); }
  else if (it.kind === 'engrave') engrave(run, it.pieceId, it.eng, events);
  else if (it.kind === 'piece') addPiece(run, it.t, events);
  else if (it.kind === 'edition') {
    const m = run.maxims.find((x) => x.uid === it.uid);
    m.edition = it.edition;
    m.paid = (m.paid || 0) + EDITION_BY_ID[it.edition].price;
    events.push({ type: 'edition', uid: m.uid, id: m.id, edition: it.edition });
  }
}

// ── 상점
function openShop(run) {
  run.shop = {
    ante: run.ante, blind: run.blind, // 이 상점이 열린 대국 자리(떠났다 돌아오면 여기로 되돌린다)
    rng: fork(root(run), `shop:${run.ante}:${run.blind}${run.retry ? `:${run.retry}` : ''}`),
    display: [], packs: [], rerolls: 0, promoted: false, removed: false,
  };
  rollDisplay(run);
  rollPacks(run);
  run.phase = 'shop';
}

// 다음 대국 앞으로. 상점은 지우지 않는다: 관 선택에서 떠나온 상점으로 돌아갈 수 있게(명령 shop). 두기 · 건너뛰기가 지운다.
function advance(run) {
  if (run.shop && run.shop.ante == null) { run.shop.ante = run.ante; run.shop.blind = run.blind; } // 옛 저장 · 수업(자리 없는 상점)
  run.pack = null;
  run.retry = 0;
  if (run.blind < 2) run.blind++;
  else { run.blind = 0; run.ante++; }
  run.phase = 'select';
  openDraft(run);
}

function useChart(run, form, events) {
  run.charts[form]++;
  events.push({ type: 'chart', form, level: run.charts[form] });
  runEvent(run, { type: 'chartUsed', form });
}

function engrave(run, pieceId, id, events) {
  const p = run.deck.find((x) => x.id === pieceId);
  if (!p) throw new Error(`no piece ${pieceId}`);
  p.eng = { id };
  events.push({ type: 'engrave', piece: p.t, pieceId, eng: id });
}

// 도박 물건(깊이 G): 수상한 물약 = 주머니의 아무 기물에 아무 혼 또는 각인 · 룰렛 = 아무 기물(킹 빼고)을 아무 이형으로
function gamble(run, id, slot, events) {
  const r = fork(root(run), `gamble:${run.ante}:${run.blind}:${run.shop.rerolls}:${slot}`);
  const p = run.deck[int(r, run.deck.length)];
  if (id === 'potion') {
    if (next(r) < 0.5) { const s = rollSoul(r); p.soul = s; events.push({ type: 'gamble', id, pieceId: p.id, piece: p.t, soul: s }); }
    else { const ids = Object.keys(ENGRAVING_BY_ID); const e = ids[int(r, ids.length)]; p.eng = { id: e }; events.push({ type: 'gamble', id, pieceId: p.id, piece: p.t, eng: e }); }
  } else {
    const to = FAIRIES[int(r, FAIRIES.length)];
    events.push({ type: 'gamble', id, pieceId: p.id, from: p.t, to });
    p.t = to;
  }
}

// 혼 새기기(깊이 C): 기물 하나에 혼 하나(있으면 바뀐다)
function ensoul(run, pieceId, id, events) {
  const p = run.deck.find((x) => x.id === pieceId);
  if (!p) throw new Error(`no piece ${pieceId}`);
  p.soul = id;
  events.push({ type: 'ensoul', piece: p.t, pieceId, soul: id });
}

function addPiece(run, t, events, soul = null) {
  const p = { id: run.nextPieceId++, t, eng: null, edition: null, ...(soul ? { soul } : {}) };
  run.deck.push(p);
  events.push({ type: 'piece', piece: t, pieceId: p.id });
}

function addMaxim(run, id, paid, events, edition = null) {
  const m = { uid: run.nextUid++, id, data: {}, edition, paid };
  // 전설은 늘 오른쪽 끝(6번째 칸)에 남게 그 앞에 끼운다
  const at = run.maxims.findIndex((x) => x.legendary);
  run.maxims.splice(at < 0 ? run.maxims.length : at, 0, m);
  events.push({ type: 'maxim', id, uid: m.uid, edition });
}

// 격언 칸: 기본 칸 + 흑요 판본마다 하나. 전설 격언은 칸을 차지하지 않는다.
export const maximCapacity = (run) => run.maximSlots + run.maxims.reduce((a, m) => a + (m.legendary ? 0 : editionSlots(m)), 0);
export const maximCount = (run) => run.maxims.filter((m) => !m.legendary).length;
// 격언 하나(판본 포함)를 더 넣을 자리가 있나. 흑요 판본은 제 칸을 스스로 가져온다.
export const hasMaximRoom = (run, edition = null) => maximCount(run) < maximCapacity(run) + (edition && EDITION_BY_ID[edition].slots ? EDITION_BY_ID[edition].slots : 0);

const pay = (run, n) => {
  if (run.money < n) throw new Error('not enough money');
  run.money -= n;
};

// 진열 물건 하나를 지금 살 수 있나(돈 · 칸)
export function canBuy(run, it) {
  if (!it || it.sold || run.money < it.price) return false;
  if (it.kind === 'maxim') return hasMaximRoom(run, it.edition);
  if (it.kind === 'chart' || it.kind === 'engraving' || it.kind === 'soul' || it.kind === 'evolve' || it.kind === 'tactic') return run.consumables.length < run.consumableSlots;
  return true;
}

// 관 선택에서 떠나온 상점으로 돌아갈 수 있나(판의 첫 대국 앞 · 건너뛴 뒤 · 두기 뒤에는 상점이 없다)
export const canReopenShop = (run) => run.phase === 'select' && !!run.shop && run.shop.ante != null;

export const sellPrice = (m) => Math.max(1, Math.floor((m.paid || 0) / 2));
export const canSell = (m) => !!m && !m.legendary;

// ── 명령
export function applyRun(run, cmd) {
  const events = [];
  const ph = run.phase;
  const need = (...ok) => { if (!ok.includes(ph)) throw new Error(`${cmd.type} not allowed in ${ph}`); };
  switch (cmd.type) {
    case 'joseki': {
      need('draft');
      const id = run.draft.options[cmd.index];
      if (!id) throw new Error('bad joseki');
      run.josekis.push(id);
      (run.drafted || (run.drafted = [])).push(run.draft.ante);
      const j = JOSEKI_BY_ID[id];
      events.push({ type: 'joseki', id });
      if (j.pick) j.pick(run, events);
      run.draft = null;
      run.phase = 'select';
      break;
    }
    case 'play': {
      need('select');
      run.shop = null;
      startBattle(run);
      events.push({ type: 'battleStart', ...blindInfo(run) });
      break;
    }
    case 'skip': {
      need('select');
      const info = blindInfo(run);
      if (info.kind === 'master') throw new Error('cannot skip master');
      const tag = info.tag;
      if (tag.kind === 'money') run.money += tag.amount;
      else if (tag.kind === 'chart') useChart(run, tag.form, events);
      events.push({ type: 'skip', tag });
      run.log.push({ ante: run.ante, blind: run.blind, kind: info.kind, skipped: true, tag });
      run.shop = null;
      advance(run);
      break;
    }
    // 묘수(깊이 F): 대국 중 떨구기 전에
    case 'tactic': {
      need('battle');
      const c = run.consumables[cmd.index];
      if (!c || c.kind !== 'tactic') throw new Error('no tactic');
      events.push(...useTactic(run.battle, c.id));
      run.consumables.splice(cmd.index, 1);
      break;
    }
    // 대본 대국 건너뛰기(첫 수 뒤에도): 대본을 지우고 같은 대국 자리에 평범한 1관 연습을 새로 깐다
    case 'unscript': {
      need('battle');
      if (!run.battle || !run.battle.script) throw new Error('not a scripted battle');
      run.script = null;
      startBattle(run);
      events.push({ type: 'battleStart', ...blindInfo(run) });
      break;
    }
    case 'drop': case 'capture': case 'redrop': case 'discard': case 'reboard': {
      need('battle');
      const seen = run.battle.history.length;
      events.push(...applyBattle(run.battle, cmd));
      for (const h of run.battle.history.slice(seen)) checkFeats(run, h, events);
      if (run.battle.status === 'won' || run.battle.status === 'lost') endBattle(run, events);
      break;
    }
    case 'buy': {
      need('shop');
      const it = run.shop.display[cmd.slot];
      if (!canBuy(run, it)) throw new Error('cannot buy');
      pay(run, it.price);
      it.sold = true;
      if (it.kind === 'maxim') addMaxim(run, it.id, it.price, events, it.edition || null);
      else if (it.kind === 'piece') addPiece(run, it.t, events, it.soul || null);
      else if (it.kind === 'fragment') grantFragment(run, it.legend, 'first', events);
      else if (it.kind === 'gamble') gamble(run, it.id, cmd.slot, events);
      else run.consumables.push(it.kind === 'chart' ? { kind: 'chart', form: it.form } : it.kind === 'evolve' ? { kind: 'evolve' } : { kind: it.kind, id: it.id });
      events.push({ type: 'buy', item: { ...it } });
      break;
    }
    case 'buyPack': {
      need('shop');
      const pk = run.shop.packs[cmd.slot];
      if (!pk || pk.sold) throw new Error('no pack');
      pay(run, pk.price);
      pk.sold = true;
      run.pack = { kind: pk.kind, options: rollPackOptions(run, pk.kind) };
      run.phase = 'pack';
      events.push({ type: 'packOpen', kind: pk.kind, options: clone(run.pack.options) });
      break;
    }
    case 'pick': {
      need('pack');
      const o = run.pack.options[cmd.index];
      if (!o) throw new Error('bad pick');
      if (o.kind === 'piece') addPiece(run, o.t, events);
      else if (o.kind === 'chart') useChart(run, o.form, events);
      else if (o.kind === 'fragment') grantFragment(run, o.legend, 'first', events);
      else if (o.kind === 'maxim') {
        if (!hasMaximRoom(run, o.edition)) throw new Error('no maxim slot');
        addMaxim(run, o.id, maximPrice(o.id, o.edition), events, o.edition);
      } else engrave(run, cmd.target, o.id, events);
      run.pack = null;
      run.phase = 'shop';
      break;
    }
    case 'skipPack': {
      need('pack');
      run.pack = null;
      run.phase = 'shop';
      break;
    }
    case 'reroll': {
      need('shop');
      pay(run, rerollCost(run));
      run.shop.rerolls++;
      rollDisplay(run);
      events.push({ type: 'reroll' });
      break;
    }
    case 'sell': {
      need('shop', 'select', 'pack');
      const m = run.maxims[cmd.index];
      if (!m) throw new Error('no maxim');
      if (!canSell(m)) throw new Error('cannot sell a legend');
      run.maxims.splice(cmd.index, 1);
      run.money += sellPrice(m);
      events.push({ type: 'sell', id: m.id, money: sellPrice(m) });
      break;
    }
    case 'use': {
      need('shop', 'select');
      const c = run.consumables[cmd.index];
      if (!c) throw new Error('no consumable');
      if (c.kind === 'engraving') engrave(run, cmd.target, c.id, events);
      else if (c.kind === 'soul') ensoul(run, cmd.target, c.id, events);
      else if (c.kind === 'evolve') {
        const p = run.deck.find((x) => x.id === cmd.target);
        const to = p && evolveTo(run.seed, p);
        if (!to) throw new Error('cannot evolve');
        events.push({ type: 'evolve', pieceId: p.id, from: p.t, to });
        p.t = to;
      } else if (c.kind === 'tactic') throw new Error('tactics are used in a battle');
      else useChart(run, c.form, events);
      run.consumables.splice(cmd.index, 1);
      break;
    }
    case 'promote': {
      need('shop');
      if (run.shop.promoted) throw new Error('already promoted');
      const p = run.deck.find((x) => x.id === cmd.pieceId);
      if (!p || !PROMOTE[p.t]) throw new Error('cannot promote');
      const to = cmd.to ?? PROMOTE[p.t][0];
      if (!PROMOTE[p.t].includes(to)) throw new Error('bad promotion');
      pay(run, SHOP.promotePrice);
      run.shop.promoted = true;
      events.push({ type: 'promote', pieceId: p.id, from: p.t, to });
      p.t = to;
      break;
    }
    case 'remove': {
      need('shop');
      if (run.shop.removed) throw new Error('already removed');
      if (run.deck.length <= SHOP.deckMin) throw new Error('deck too small');
      const i = run.deck.findIndex((x) => x.id === cmd.pieceId);
      if (i < 0) throw new Error('no piece');
      pay(run, SHOP.removePrice);
      run.shop.removed = true;
      const [p] = run.deck.splice(i, 1);
      events.push({ type: 'remove', pieceId: p.id, piece: p.t });
      break;
    }
    case 'moveMaxim': {
      need('shop', 'select');
      const { from, to } = cmd;
      if (!run.maxims[from] || to < 0 || to >= run.maxims.length) throw new Error('bad move');
      const [m] = run.maxims.splice(from, 1);
      run.maxims.splice(to, 0, m);
      break;
    }
    case 'leave': {
      need('shop');
      // 8관 명인에서 진 뒤의 상점: 같은 대국 앞으로(다음 관으로 넘어가지 않는다)
      if (run.shop.stay) { run.pack = null; run.phase = 'select'; }
      else advance(run);
      break;
    }
    // 관 선택에서 떠나온 상점으로 돌아간다. 상점이 열린 대국 자리로 되돌려, 상점 안은 떠날 때와 똑같다(진열 · 꾸러미 · 횟수).
    // 다시 떠나면(leave) 같은 대국 앞으로 온다(정석은 이미 골라 다시 열리지 않는다). 봇에게 뜻이 없어 legalRunCommands에는 넣지 않는다.
    case 'shop': {
      need('select');
      if (!canReopenShop(run)) throw new Error('no shop to return to');
      run.ante = run.shop.ante;
      run.blind = run.shop.blind;
      run.phase = 'shop';
      break;
    }
    case 'endless': {
      need('won');
      run.endless = true;
      openShop(run);
      break;
    }
    default: throw new Error(`unknown command ${cmd.type}`);
  }
  return events;
}

// 둘 수 있는 명령 전부(봇 · 화면 공용). moveMaxim은 이웃과 자리 바꾸기만 센다.
export function legalRunCommands(run) {
  const out = [];
  const ph = run.phase;
  if (ph === 'battle') {
    const out = battleCommands(run.battle);
    if (run.battle.status === 'play') run.consumables.forEach((c, index) => { if (c.kind === 'tactic') out.push({ type: 'tactic', index }); });
    return out;
  }
  if (ph === 'won') return [{ type: 'endless' }];
  if (ph === 'draft') return run.draft.options.map((_, index) => ({ type: 'joseki', index }));
  if (ph === 'lost') return [];
  if (ph === 'pack') {
    run.pack.options.forEach((o, index) => {
      if (o.kind === 'engraving') for (const p of run.deck) out.push({ type: 'pick', index, target: p.id });
      else if (o.kind !== 'maxim' || hasMaximRoom(run, o.edition)) out.push({ type: 'pick', index });
    });
    // 금빛 꾸러미의 격언을 칸이 찬 채로 받으려면 먼저 판다
    if (run.pack.options.some((o) => o.kind === 'maxim')) run.maxims.forEach((m, index) => { if (canSell(m)) out.push({ type: 'sell', index }); });
    out.push({ type: 'skipPack' });
    return out;
  }
  // select · shop 공통
  run.consumables.forEach((c, index) => {
    if (c.kind === 'engraving' || c.kind === 'soul') for (const p of run.deck) out.push({ type: 'use', index, target: p.id });
    else if (c.kind === 'evolve') { for (const p of run.deck) if (evolveTo(run.seed, p)) out.push({ type: 'use', index, target: p.id }); }
    else if (c.kind !== 'tactic') out.push({ type: 'use', index });
  });
  run.maxims.forEach((m, index) => { if (canSell(m)) out.push({ type: 'sell', index }); });
  for (let i = 0; i + 1 < run.maxims.length; i++) out.push({ type: 'moveMaxim', from: i, to: i + 1 });
  if (ph === 'select') {
    out.push({ type: 'play' });
    if (run.blind < 2) out.push({ type: 'skip' });
    return out;
  }
  // shop
  run.shop.display.forEach((it, slot) => { if (canBuy(run, it)) out.push({ type: 'buy', slot }); });
  run.shop.packs.forEach((pk, slot) => { if (!pk.sold && run.money >= pk.price) out.push({ type: 'buyPack', slot }); });
  if (run.money >= rerollCost(run)) out.push({ type: 'reroll' });
  if (!run.shop.promoted && run.money >= SHOP.promotePrice) {
    for (const p of run.deck) for (const to of PROMOTE[p.t] || []) out.push({ type: 'promote', pieceId: p.id, to });
  }
  if (!run.shop.removed && run.money >= SHOP.removePrice && run.deck.length > SHOP.deckMin) {
    for (const p of run.deck) out.push({ type: 'remove', pieceId: p.id });
  }
  out.push({ type: 'leave' });
  return out;
}

export const maximInfo = (id) => MAXIM_BY_ID[id] || LEGEND_BY_ID[id];
export const engravingInfo = (id) => ENGRAVING_BY_ID[id];
