// 판(런) 봇: 대국 안은 tools/bot.mjs(풀이기), 상점은 정책 셋.
//   smart  — 사 보기 전에 그려 본다: 지금 짜임과 바꾼 짜임을 같은 대국판 K개(공통 난수)로 풀이기에 돌려
//            평균 총점이 몇 % 오르는지(득) 재고, 득/값이 가장 큰 것부터 산다. 초반엔 적립을 위해 돈을 남긴다.
//   random — 살 수 있는 것 중 아무거나(진열 · 꾸러미 · 나가기를 고르게), 꾸러미도 아무거나, 두루마리 대상도 아무거나.
//   hunt   — smart에 더해 불멸의 기보를 노린다: 조각은 보이면 사고 꾸러미는 열어 보고, 돈이 남으면 다시 진열해 조각을 찾고,
//            대국에서는 황금 기물 · 가진 첫 조각의 재현이 되는 줄에 덤을 얹어 고른다.
//   none   — 아무것도 사지 않는다(격언 없이 어디까지 가나 보는 기준선).
//   smart도 조각이 진열에 보이면 적립을 다 남기고도 살 수 있을 때 산다(운 좋은 판). 꾸러미에서는 나머지가 짜임을 올리지 못할 때만 조각.
import { createRng, fork, int, next } from '../src/sim/rng.js';
import { createBattle, soulOf, arrive, apply as applyBattle } from '../src/sim/battle.js';
import { isCracked } from '../src/data/souls.js';
import { applyRun, legalRunCommands, battleMods, canBuy, sellPrice, blindInfo, maximCapacity, canSell, josekiTargetMult, previewBattle } from '../src/sim/run.js';
import { EDITION_BY_ID } from '../src/data/editions.js';
import { LEGENDS } from '../src/data/legends.js';
import { SHOP, PROMOTE, rerollCost } from '../src/sim/shop.js';
import { FINAL_MASTER } from '../src/data/masters.js';
import { FINAL_FACTION } from '../src/data/factions.js';
import { stepBattle, SACLOG, SAC, sacrificeChoice, pieceKey, BOT } from './bot.mjs';
import { rollDisplay, rollPacks } from '../src/sim/shop.js';
import { bestMove } from '../src/sim/solver.js';
import { familyCounts, FAMILIES, levelOf } from '../src/data/families.js';
import { evolveTo } from '../src/data/tactics.js';
import { noteStep, review, REVIEW } from '../src/sim/replay.js';

export const SMART = {
  K: 6,            // 짜임 하나를 재는 대국판 수(깊이 층 뒤 8 → 6: 판 하나가 2분 안에 끝나게)
  minGainPerCoin: 0.012, // 1원당 이만큼(비율) 오르지 않으면 안 산다
  reserve: (ante) => (ante <= 1 ? 0 : ante <= 6 ? 15 : 0), // 적립용으로 남길 돈(득이 크면 넘는다)
  bigGain: 0.35,   // 이만큼 오르면 reserve를 무시
  maxActions: 14,
  finalFrom: 6,    // 이 관부터 대가 대비(깊이 층 뒤 5 → 6)
  finalWeight: 0.5, // 대가 판에서 잰 값의 몫
  // 상금 격언의 값(밤샘 D-2): 한 수 점수로는 보이지 않으니 대국당 기대 상금 × 남은 대국 × 1원의 몫(minGainPerCoin)의 절반으로 친다
  moneyMaxims: { vault: 4, mate_hunter: 0.25, thrift: 3, lucky_coin: 1.5 },
  // 확률 격언(밤샘 2): 풀이기는 대국의 운을 모른다(onChainLuck). 기댓값을 득 비율로 얹는다 — 도박사 넷에 하나 ×3 ≈ ×1.5, 조금 덜어서
  luckMaxims: { gambler: 0.4 },
  // 가족(깊이 B): 가장 많이 모은 가족 쪽으로 한 걸음 가는 물건에 덤(득 비율). famAware false = 가족을 모르는 봇(nofam)
  famAware: true,
  famStep: 0.08,
  // 짜임 재기의 풀이기 마디 예산: 대국 결정(10000)보다 작게. 깊이 층(이형 · 가족)으로 판이 넓어져 재기 한 번이 0.6초까지 늘었다
  evalNodes: 1000,
  // 각성(CHM-17): 이만큼 사슬을 이은 혼은 새 혼으로 바꾸지 않는다(금까지 다섯)
  keepLinks: 3,
  // 짜임 재기에서도 대국 봇의 희생 판단을 쓴다(CHM-51): 희생 횟수 · 희생 격언(뽑은 대로 · 미련 없이)이 점수 기대에 든다.
  // sacNodes: 희생을 잴 때 주머니 기물 하나에 쓰는 풀이기 마디(짜임 재기는 하네스 시간의 9할이라 작게)
  sacEval: true,
  sacNodes: 300,
};
// 하네스 세기 손잡이(실력 천장, docs/reports/agency-measure.md): 예산 ×n — 짜임 재기 판 K · 마디 · 희생 마디,
// 대국 결정의 풀이기 마디 · 희생 판단 마디 · 재는 주머니 기물 수. look: 대국 내다보기 굴림 수(bot.mjs BOT.look).
// run.mjs가 --k로 SMART.K를 정한 뒤에 부른다. n 1 · look 0이면 아무것도 바꾸지 않는다.
export function applyStrength(n = 1, look = 0) {
  if (n !== 1) {
    SMART.K = Math.round(SMART.K * n);
    SMART.evalNodes = Math.round(SMART.evalNodes * n);
    SMART.sacNodes = Math.round(SMART.sacNodes * n);
    SAC.nodes = Math.round(SAC.nodes * n);
    SAC.keys = Math.round(SAC.keys * n);
    BOT.nodes = Math.round(10000 * n);
  }
  BOT.look = look || 0;
}
// 상점 운만 바꾸기(운의 출처 (d)): 상점이 열릴 때마다 진열 · 꾸러미 · 다시 진열 · 꾸러미 속을 굴리는 상점 난수만
// (판 시드, alt) 쪽 스트림으로 바꿔 진열을 다시 굴린다. 대국판 · 주머니 · 세력 · 상자 같은 나머지 무작위는 그대로.
function reshop(run, alt) {
  const label = `shop:${run.ante}:${run.blind}${run.retry ? `:${run.retry}` : ''}`;
  run.shop.rng = fork(fork(createRng(run.seed), `altshop:${alt}`), label);
  const golden = run.shop.packs.filter((p) => p.kind === 'golden');
  rollDisplay(run);
  rollPacks(run);
  run.shop.packs.push(...golden);
}
const battlesLeft = (run) => Math.max(0, (8 - run.ante) * 3 + (2 - run.blind));
export const moneyGain = (run, id) => (SMART.moneyMaxims[id] || 0) * battlesLeft(run) * SMART.minGainPerCoin * 0.5 + (SMART.luckMaxims[id] || 0);

const clone = (x) => JSON.parse(JSON.stringify(x));

// 하네스용 세기: 진열에 나온 격언 · 판본 · 조각, 꾸러미에 끼어 나온 조각(playRun마다 새로)
export const SEEN = { reset() { Object.assign(this, { maxims: 0, slots: 0, editions: {}, fragDisplay: 0, packs: 0, fragPack: 0, golden: 0 }); } };
SEEN.reset();
function noteDisplay(run) {
  for (const it of run.shop.display) {
    SEEN.slots++;
    if (it.kind === 'maxim') { SEEN.maxims++; if (it.edition) SEEN.editions[it.edition] = (SEEN.editions[it.edition] || 0) + 1; }
    if (it.kind === 'fragment') SEEN.fragDisplay++;
  }
}
function notePack(run) {
  if (run.pack.kind === 'golden') SEEN.golden++;
  else SEEN.packs++;
  if (run.pack.options.some((o) => o.kind === 'fragment')) SEEN.fragPack++;
}
function act(run, cmd) {
  const ev = applyRun(run, cmd);
  if (cmd.type === 'reroll') noteDisplay(run);
  if (cmd.type === 'buyPack') notePack(run);
  return ev;
}

// ── 짜임 재기
function buildOf(run) {
  return { deck: clone(run.deck), maxims: clone(run.maxims), charts: { ...run.charts }, josekis: [...(run.josekis || [])] };
}
function nextAnte(run) {
  return run.phase === 'shop' && run.blind === 2 ? run.ante + 1 : run.ante;
}
export const EVALS = { n: 0 };
// 짜임 하나의 힘: K개 대국판에서 「한 수」의 최선 점수 평균. 판마다 대국의 몇째 수인지(0~3)를 돌려 가며
// 그만큼 기물을 먼저 써 둔 채로 잰다(첫수 · 마지막 수 · 작은 주머니 같은 격언이 제 몫을 받게).
// 네 수를 끝까지 두는 것보다 6배쯤 싸고, 짜임끼리 비교하는 데는 충분하다.
export function evalBuild(run, build, seeds, ante, master = null, faction = null) {
  EVALS.n++;
  const mods = battleMods(build, master, faction).filter((m) => SMART.famAware || !String(m.id).startsWith('family:'));
  let total = 0;
  seeds.forEach((seed, k) => {
    const b = createBattle({
      seed, ante, kind: 'practice', target: null, golden: false,
      bag: build.deck.map((p) => ({ t: p.t, id: p.id, eng: p.eng, ...soulOf(p) })),
      rules: run.rules, mods,
    });
    const m = Math.min(k % b.rules.moves, b.rules.moves - 1);
    // 지나간 수마다 증원도 들인다(CHM-26): 들이지 않으면 증원을 먹는 몫(매복 · 증원 사냥 …)이 짜임 재기에 보이지 않는다
    for (let i = 0; i < m && b.hand.length; i++) {
      b.used.push(b.hand.shift());
      while (b.hand.length < b.rules.hand && b.bag.length) b.hand.push(b.bag.shift());
      b.movesUsed = i + 1;
      arrive(b);
    }
    b.movesUsed = m;
    b.movesLeft = b.rules.moves - m;
    let collect = [];
    let best = b.hand.length ? bestMove(b, { preferMate: 'avoid', maxNodes: SMART.evalNodes, collect }) : null;
    // 희생(CHM-51): 대국 봇과 같은 판단으로 바칠 만하면 바치고(주머니 맨 위가 실제로 뽑힌다) 다시 잰다. 대국 봇처럼 주머니가 넉넉할 때만
    // 판단이 먼저 거르는 조건(사슬이 약할 때만, SAC.weakChain)을 여기서도 먼저 본다 — 손 칸별 점수를 모으는 값이 짜임 재기마다 들지 않게
    for (let s = 0; SMART.sacEval && best && best.captures <= SAC.weakChain && s < 3 && b.discardsLeft > 0 && b.bag.length >= b.movesLeft; s++) {
      const byHand = new Map();
      for (const c of collect) if (!byHand.has(c.handIndex) || c.score > byHand.get(c.handIndex)) byHand.set(c.handIndex, c.score);
      // 풀이기는 같은 기물을 한 번만 잰다: 같은 기물이면 잰 칸의 점수를 함께 쓴다
      const byKey = new Map();
      for (const [i, sc] of byHand) byKey.set(pieceKey(b.hand[i]), sc);
      const per = b.hand.map((p) => (byKey.has(pieceKey(p)) ? byKey.get(pieceKey(p)) : null));
      const pick = sacrificeChoice(b, per, best, { preferMate: 'avoid', nodes: SMART.sacNodes });
      if (!pick) break;
      applyBattle(b, { type: 'discard', handIndices: [pick.index] });
      collect = [];
      best = b.hand.length ? bestMove(b, { preferMate: 'avoid', maxNodes: SMART.evalNodes, collect }) : null;
    }
    total += b.score + (best ? best.score : 0); // b.score: 함정이 지나간 수에서 붙잡은 증원의 값
  });
  return total / seeds.length;
}

function evalSeeds(run, K) {
  const r = fork(createRng((run.seed ^ 0x5eed5) >>> 0), `eval:${run.ante}:${run.blind}`);
  return Array.from({ length: K }, () => Math.floor(next(r) * 2 ** 31));
}

// 가장 많이 모은 가족(둘 이상일 때)을 한 걸음 채우면 덤. 문턱을 넘는 걸음은 그려 보기에 이미 보이니 문턱 앞 걸음만
export function famBonus(before, after) {
  if (!SMART.famAware) return 0;
  const a = familyCounts(before), b = familyCounts(after);
  const top = Math.max(...Object.values(a));
  if (top < 1) return 0;
  let bonus = 0;
  for (const f of FAMILIES) if (a[f.id] === top && b[f.id] > a[f.id] && levelOf(b[f.id]) === levelOf(a[f.id])) bonus += SMART.famStep;
  return bonus;
}

const RANK = { P: 0, N: 1, B: 1, R: 2, Q: 3, L: 1, S: 1, G: 2, O: 2, H: 2, A: 2, W: 2, C: 3, Z: 4 };
// 두루마리(각인)를 붙일 가장 좋은 기물: 종류 · 각인이 같은 기물은 한 번만 잰다
// soul: 혼 두루마리(깊이 C)면 기물의 soul을 바꿔 본다
function bestEngraveTarget(run, build, engId, ctx, soul = false) {
  let best = null;
  const seen = new Set();
  // 무거운 기물부터 서로 다른 셋만 본다(재는 값을 아끼려고)
  const has = (p) => (soul ? p.soul : p.eng);
  const order = [...build.deck].sort((a, b) => RANK[b.t] - RANK[a.t] || (has(a) ? 1 : 0) - (has(b) ? 1 : 0));
  for (const p of order) {
    const key = p.t + (p.eng ? p.eng.id : '') + (p.soul || '');
    if (seen.has(key) || (soul ? p.soul === engId : p.eng && p.eng.id === engId)) continue;
    // 각성 사다리(CHM-17): 금이 가까운(사슬 셋 이상) · 금이 간 · 깨어난 혼은 새 혼으로 덮지 않는다
    if (soul && p.soul && (p.awake || (p.links || 0) >= SMART.keepLinks)) continue;
    if (seen.size >= 3) break;
    seen.add(key);
    const v = { ...build, deck: build.deck.map((q) => (q.id === p.id ? (soul ? { ...q, soul: engId } : { ...q, eng: { id: engId } }) : q)) };
    const score = ctx.score(v);
    if (!best || score > best.score) best = { target: p.id, score };
  }
  return best;
}

// 깨우기를 쓸 가장 좋은 기물: 금이 간 기물마다 깨운 짜임을 그려 본다
function bestAwakenTarget(run, build, ctx) {
  let best = null;
  for (const p of build.deck) {
    if (!isCracked(p)) continue;
    const v = { ...build, deck: build.deck.map((q) => (q.id === p.id ? { ...q, awake: true } : q)) };
    const score = ctx.score(v);
    if (!best || score > best.score) best = { target: p.id, score, build: v };
  }
  return best;
}

// 진화 두루마리를 쓸 가장 좋은 기물(종류마다 한 번)
function bestEvolveTarget(run, build, ctx) {
  let best = null;
  const seen = new Set();
  for (const p of build.deck) {
    const to = evolveTo(run.seed, p);
    if (!to || seen.has(p.t + to)) continue;
    seen.add(p.t + to);
    const v = { ...build, deck: build.deck.map((q) => (q.id === p.id ? { ...q, t: to } : q)) };
    const score = ctx.score(v);
    if (!best || score > best.score) best = { target: p.id, score, build: v };
  }
  return best;
}

function makeCtx(run) {
  const seeds = evalSeeds(run, SMART.K);
  const ante = nextAnte(run);
  const nextBlind = run.phase === 'shop' ? (run.blind + 1) % 3 : run.blind;
  const nextInfo = blindInfo(run, ante, nextBlind);
  const nextMaster = nextInfo.master, nextFaction = nextInfo.faction;
  const cache = new Map();
  return {
    seeds, ante,
    score(build) {
      const key = JSON.stringify([build.deck.map((p) => p.t + (p.eng ? p.eng.id : '') + (p.soul || '') + (p.awake ? '!' : '')).sort(), build.maxims.map((m) => m.id + JSON.stringify(m.data || {})), build.charts, build.josekis || []]);
      if (!cache.has(key)) {
        // 다음이 명인 대국이면 그 명인을 걸고도 잰다. finalFrom관부터는 8관 「대가」(기보가 안 듣는다)도 미리 섞는다.
        // 세력(버릇 · 적 구성)은 다음 대국의 세력으로 잰다
        const parts = [evalBuild(run, build, seeds, ante, null, nextFaction)];
        if (nextMaster && nextMaster !== FINAL_MASTER) parts.push(evalBuild(run, build, seeds, ante, nextMaster, nextFaction));
        let v = parts.reduce((a, x) => a + x, 0) / parts.length;
        if (run.ante >= SMART.finalFrom || nextMaster === FINAL_MASTER) {
          const fin = evalBuild(run, build, seeds, Math.max(ante, 8), FINAL_MASTER, FINAL_FACTION);
          // 대가 판은 기보가 빠져 값이 한 자릿수 작다: 비율끼리 섞이게 기하 평균
          v = Math.pow(v + 1, 1 - SMART.finalWeight) * Math.pow(fin + 1, SMART.finalWeight);
        }
        cache.set(key, v);
      }
      return cache.get(key);
    },
  };
}

// 소모품은 곧바로 쓴다(각인은 가장 좋은 기물에. 기보는 얻는 순간 쓰이고, 옛 저장에 남은 것만 여기서)
function useConsumables(run, ctx) {
  while (run.consumables.length) {
    const c = run.consumables[0];
    if (c.kind === 'chart') act(run, { type: 'use', index: 0 });
    else if (c.kind === 'tactic') break;
    else if (c.kind === 'evolve') { const t = bestEvolveTarget(run, buildOf(run), ctx); if (t) act(run, { type: 'use', index: 0, target: t.target }); else break; }
    else if (c.kind === 'awaken') { const t = bestAwakenTarget(run, buildOf(run), ctx); if (t) act(run, { type: 'use', index: 0, target: t.target }); else break; }
    else {
      const t = bestEngraveTarget(run, buildOf(run), c.id, ctx, c.kind === 'soul');
      // 갈 곳이 없으면 사다리에 오르지 않은 기물에(금 · 각성을 덮지 않게)
      const spare = run.deck.find((p) => !(p.soul && (p.awake || (p.links || 0) >= SMART.keepLinks))) || run.deck[0];
      act(run, { type: 'use', index: 0, target: t ? t.target : spare.id });
    }
  }
}

// 격언 칸이 찼으면 가장 약한 격언(빼도 덜 떨어지는 것)을 찾는다
function weakestMaxim(run, build, ctx) {
  let best = null;
  build.maxims.forEach((m, i) => {
    if (!canSell(m)) return;
    // 흑요를 팔면 칸이 하나 줄어 자리가 나지 않는다
    if (m.edition && EDITION_BY_ID[m.edition].slots) return;
    const v = { ...build, maxims: build.maxims.filter((_, j) => j !== i) };
    const s = ctx.score(v) / (1 + moneyGain(run, m.id)); // 상금 · 확률 격언은 점수로 보이지 않는 몫이 있다
    if (!best || s > best.score) best = { index: i, score: s };
  });
  return best;
}

// 산 뒤의 짜임(그려 보기). 돌려주는 값 { build, cmds: [명령…] } 또는 null
function variantFor(run, build, it, ctx) {
  if (it.kind === 'maxim') {
    const m = { uid: -1, id: it.id, data: {}, edition: it.edition || null, paid: it.price };
    const cap = maximCapacity({ maximSlots: run.maximSlots, maxims: [...build.maxims, m] });
    if (build.maxims.filter((x) => !x.legendary).length < cap) return { build: { ...build, maxims: [...build.maxims, m] }, sell: null };
    const w = weakestMaxim(run, build, ctx);
    if (!w) return null;
    return { build: { ...build, maxims: [...build.maxims.filter((_, j) => j !== w.index), m] }, sell: w.index };
  }
  if (it.kind === 'chart') return { build: { ...build, charts: { ...build.charts, [it.form]: build.charts[it.form] + 1 } } };
  if (it.kind === 'piece') return { build: { ...build, deck: [...build.deck, { id: -1, t: it.t, eng: null, ...(it.soul ? { soul: it.soul } : {}) }] } };
  if (it.kind === 'evolve') {
    const t = bestEvolveTarget(run, build, ctx);
    if (!t) return null;
    return { build: t.build, target: t.target };
  }
  if (it.kind === 'awaken') {
    const t = bestAwakenTarget(run, build, ctx);
    if (!t) return null;
    return { build: t.build, target: t.target };
  }
  if (it.kind === 'soul') {
    const t = bestEngraveTarget(run, build, it.id, ctx, true);
    if (!t) return null;
    return { build: { ...build, deck: build.deck.map((q) => (q.id === t.target ? { ...q, soul: it.id } : q)) }, target: t.target };
  }
  if (it.kind === 'engraving') {
    const t = bestEngraveTarget(run, build, it.id, ctx);
    if (!t) return null;
    return { build: { ...build, deck: build.deck.map((q) => (q.id === t.target ? { ...q, eng: { id: it.id } } : q)) }, target: t.target };
  }
  return null;
}

// 금빛 꾸러미(공짜)를 먼저 연다: 가장 좋은 격언(판본째), 칸이 차면 가장 약한 격언을 팔고 받는다. hunt는 첫 조각이 있으면 그것.
function openGolden(run, ctx, hunt) {
  const slot = run.shop.packs.findIndex((p) => p.kind === 'golden' && !p.sold);
  if (slot < 0) return;
  act(run, { type: 'buyPack', slot });
  const build = buildOf(run);
  const base = Math.max(1, ctx.score(build));
  const frag = run.pack.options.findIndex((o) => o.kind === 'fragment');
  if (frag >= 0 && hunt) { act(run, { type: 'pick', index: frag }); return; }
  let pick = null;
  run.pack.options.forEach((o, index) => {
    const v = variantFor(run, build, o, ctx);
    if (!v) return;
    const s = ctx.score(v.build);
    if (!pick || s > pick.s) pick = { s, index, sell: v.sell };
  });
  if (frag >= 0 && (!pick || pick.s <= base)) { act(run, { type: 'pick', index: frag }); return; }
  if (pick && pick.s > base) {
    if (pick.sell != null) act(run, { type: 'sell', index: pick.sell });
    act(run, { type: 'pick', index: pick.index });
  } else act(run, { type: 'skipPack' });
}

function smartShop(run, hunt = false) {
  const ctx = makeCtx(run);
  openGolden(run, ctx, hunt);
  for (let step = 0; step < SMART.maxActions && run.phase === 'shop'; step++) {
    useConsumables(run, ctx);
    const build = buildOf(run);
    const base = Math.max(1, ctx.score(build));
    const reserve = SMART.reserve(run.ante);
    // 불멸의 기보 첫 조각: hunt는 보이면, smart는 적립을 다 남기고도 살 수 있으면
    const fslot = run.shop.display.findIndex((it) => it.kind === 'fragment' && canBuy(run, it) && run.money - it.price >= (hunt ? 0 : reserve));
    if (fslot >= 0) { act(run, { type: 'buy', slot: fslot }); continue; }
    const cands = [];
    const consider = (cost, score, act, extra = {}) => {
      const gain = score / base - 1;
      cands.push({ cost, gain, act, ...extra });
    };
    run.shop.display.forEach((it, slot) => {
      if (it.sold || run.money < it.price) return;
      if (it.kind === 'tactic') return;
      if ((it.kind === 'engraving' || it.kind === 'soul' || it.kind === 'evolve' || it.kind === 'awaken') && run.consumables.length >= run.consumableSlots) return;
      const v = variantFor(run, build, it, ctx);
      if (!v) return;
      const refund = v.sell != null ? sellPrice(run.maxims[v.sell]) : 0;
      const econ = it.kind === 'maxim' ? moneyGain(run, it.id) : 0;
      consider(it.price - refund, ctx.score(v.build) * (1 + econ + famBonus(build, v.build)), { type: 'buy', slot }, { sell: v.sell });
    });
    // 가장 좋은 것: 득/값
    const pickBest = () => {
      let best = null;
      for (const c of cands) {
        const per = c.gain / Math.max(1, c.cost);
        if (per < SMART.minGainPerCoin) continue;
        if (run.money - c.cost < reserve && c.gain < SMART.bigGain) continue;
        if (!best || per > best.per) best = { ...c, per };
      }
      return best;
    };
    let best = pickBest();
    // 진열에서 살 게 없으면 기물 조작(승급 · 버리기)도 그려 본다
    if (!best) {
      cands.length = 0;
      if (!run.shop.promoted && run.money >= SHOP.promotePrice) {
        // 가벼운 기물부터 서로 다른 넷만 그려 본다(이형이 섞인 주머니는 열 가지가 넘어 상점 한 번이 수십 초 걸렸다)
        const seen = new Set();
        const order = [...build.deck].sort((a, b) => (RANK[a.t] ?? 5) - (RANK[b.t] ?? 5));
        for (const p of order) for (const to of PROMOTE[p.t] || []) {
          const key = p.t + to + (p.eng ? p.eng.id : '') + (p.soul || '');
          if (seen.has(key) || seen.size >= 4) continue;
          seen.add(key);
          const v = { ...build, deck: build.deck.map((q) => (q.id === p.id ? { ...q, t: to } : q)) };
          consider(SHOP.promotePrice, ctx.score(v), { type: 'promote', pieceId: p.id, to });
        }
      }
      if (!run.shop.removed && run.money >= SHOP.removePrice && build.deck.length > SHOP.deckMin) {
        const seen = new Set();
        const order = [...build.deck].filter((q) => !q.eng && !q.soul).sort((a, b) => (RANK[a.t] ?? 5) - (RANK[b.t] ?? 5));
        for (const p of order) {
          const key = p.t;
          if (seen.has(key) || seen.size >= 3) continue;
          seen.add(key);
          const v = { ...build, deck: build.deck.filter((q) => q.id !== p.id) };
          consider(SHOP.removePrice, ctx.score(v), { type: 'remove', pieceId: p.id });
        }
      }
      best = pickBest();
    }
    if (best) {
      if (best.sell != null) act(run, { type: 'sell', index: best.sell });
      act(run, best.act);
      continue;
    }
    // 꾸러미: 여유 돈이 있으면 열어 보고 가장 좋은 것(오르지 않으면 넘김). hunt는 적립을 헐어서라도 연다.
    const pk = run.shop.packs.findIndex((p) => !p.sold && run.money - p.price >= (hunt ? Math.min(reserve, 4) : reserve));
    if (pk >= 0) {
      act(run, { type: 'buyPack', slot: pk });
      let pick = null;
      run.pack.options.forEach((o, index) => {
        const v = variantFor(run, build, o, ctx);
        if (!v) return;
        const s = ctx.score(v.build) * (1 + famBonus(build, v.build));
        if (!pick || s > pick.s) pick = { s, cmd: { type: 'pick', index, target: v.target } };
      });
      const frag = run.pack.options.findIndex((o) => o.kind === 'fragment');
      if (frag >= 0 && (hunt || !pick || pick.s <= base)) act(run, { type: 'pick', index: frag });
      else if (pick && pick.s > base * 1.0) act(run, pick.cmd);
      else act(run, { type: 'skipPack' });
      continue;
    }
    // 다시 진열: 돈이 넉넉할 때만(hunt는 조각을 찾으려 조금 더 자주)
    if (run.money - rerollCost(run) >= reserve + (hunt ? 2 : 8)) { act(run, { type: 'reroll' }); continue; }
    break;
  }
  if (run.phase === 'shop') { useConsumables(run, ctx); act(run, { type: 'leave' }); }
}

function randomShop(run, r) {
  for (let step = 0; step < 20 && run.phase === 'shop'; step++) {
    const cmds = legalRunCommands(run).filter((c) => ['buy', 'buyPack', 'leave', 'use'].includes(c.type));
    // 나가기의 몫을 살 것들과 같게: 살 게 n개면 나가기 확률 1/(n+1)
    const c = cmds[int(r, cmds.length)];
    act(run, c);
    if (run.phase === 'pack') {
      const opts = legalRunCommands(run).filter((x) => x.type === 'pick');
      act(run, opts.length ? opts[int(r, opts.length)] : { type: 'skipPack' });
    }
  }
  if (run.phase === 'shop') act(run, { type: 'leave' });
}

// 정석 고르기: 셋을 저마다 골라 본 판의 짜임을 그려 보고(목표 배율은 나눠서) 가장 좋은 것. random은 아무거나, none은 첫째.
export const DRAFT = { pick: null }; // 하네스 실험: 정석 id를 정해 두면 보이면 그것을 고른다
function pickJoseki(run, policy, r) {
  const opts = run.draft.options;
  if (DRAFT.pick && opts.includes(DRAFT.pick)) return opts.indexOf(DRAFT.pick);
  if (policy === 'random') return int(r, opts.length);
  if (policy === 'none') return 0;
  const ctx = makeCtx({ ...run, phase: 'select' });
  let best = 0, bs = -Infinity;
  opts.forEach((id, i) => {
    const copy = clone(run);
    applyRun(copy, { type: 'joseki', index: i });
    const s = ctx.score(buildOf(copy)) / josekiTargetMult(copy) * (1 + famBonus(buildOf(run), buildOf(copy)));
    if (s > bs) { bs = s; best = i; }
  });
  return best;
}

// hunt의 줄 평가: 황금 기물을 먹는 줄은 점수 ×3, 가진 첫 조각의 재현이 되는 줄은 ×5(둘 다 목표를 넘길 만큼이면 덤이 이긴다)
function huntRank(run) {
  const open = LEGENDS.filter((l) => { const f = run.fragments[l.id]; return f && f.first && !f.feat; });
  return (r) => {
    let k = r.score + 1;
    if (r.h && r.h.golden) k *= 3;
    if (r.h && open.some((l) => l.check(r.h))) k *= 5;
    return k;
  };
}

// ── 판 보기(CHM-61): 관 선택에서 연습 · 정식 대국판을 보고 건너뛸지 고른다. 사람이 보는 것만 쓴다 — 판(previewBattle) · 주머니 · 목표.
// 손은 모른다: 주머니의 기물(같은 종류 · 각인 · 혼은 하나로)마다 「그 기물 하나로 둔 첫 수 최선 점수」(풀이기, 마디 PEEK.nodes)를 재어
// 주머니 몫으로 평균하고 목표로 나눈 값이 read(판이 내 주머니에 맞는 정도). read < PEEK.skipBelow면 건너뛴다(null이면 늘 둔다).
// log: 대국마다 read를 남겨 승패와 견준다(문턱 고르기). alt: 건너뛴 판을 복사본에서 두어 이겼을지 남긴다(건너뛴 판의 대체 승률).
export const PEEK = { skipBelow: null, nodes: 1500, log: false, alt: false, rows: [] };
export function boardRead(run) {
  const b = previewBattle(run);
  if (!b || !b.target) return null;
  const seen = new Map();
  for (const p of [...b.hand, ...b.bag]) {
    const k = p.t + JSON.stringify(p.eng) + (p.soul || '') + (p.awake ? '!' : '');
    const e = seen.get(k);
    if (e) { e.n++; continue; }
    const m = bestMove({ ...b, hand: [p] }, { preferMate: false, maxNodes: PEEK.nodes });
    seen.set(k, { n: 1, score: m ? m.score : 0 });
  }
  let sum = 0, n = 0, max = 0;
  for (const e of seen.values()) { sum += e.score * e.n; n += e.n; max = Math.max(max, e.score); }
  return { read: n ? sum / n / b.target : 0, max: max / b.target };
}
// 건너뛴 대국을 복사본에서 끝까지 두어 본다(판의 흐름 · 기록은 건드리지 않는다)
function altPlay(run, opts) {
  const copy = clone(run), sac = SACLOG.rows.length;
  applyRun(copy, { type: 'play' });
  for (let i = 0; i < 200 && copy.phase === 'battle'; i++) if (!stepBattle(copy.battle, (c) => applyRun(copy, c), opts)) break;
  SACLOG.rows.length = sac;
  const row = copy.log.at(-1); // 대국이 끝나면 판(런)이 대국을 치우고 한 줄을 남긴다
  return !!(row && row.ante === run.ante && row.blind === run.blind && !row.skipped && row.won);
}
function selectStep(run, policy, r) {
  if (policy === 'random' && run.blind < 2 && int(r, 5) === 0) { act(run, { type: 'skip' }); return; }
  const peek = policy !== 'random' && run.blind < 2 && (PEEK.log || PEEK.skipBelow != null);
  const rd = peek ? boardRead(run) : null;
  const skip = !!rd && PEEK.skipBelow != null && rd.read < PEEK.skipBelow;
  if (rd) PEEK.rows.push({ ante: run.ante, blind: run.blind, read: Math.round(rd.read * 1000) / 1000, max: Math.round(rd.max * 1000) / 1000, skip, ...(skip && PEEK.alt ? { altWon: altPlay(run, policy === 'nosac' ? { sacrifice: false } : {}) } : {}) });
  act(run, { type: skip ? 'skip' : 'play' });
}

// 판 하나를 끝까지. 돌려주는 값: 요약(하네스용)
// 복기 진단(CHM-59, run.mjs --replay): 진 대국마다 복기(src/sim/replay.js)를 돌려 대국 줄에 kind를 적고(사람 판 기록과 같은 열쇠 replay),
// 갈림길 · 마디 · ms는 rows에. 끄면(기본) 아무것도 하지 않는다 — 판의 결과는 켜도 끄도 같다(복기는 복사본만 둔다).
// keep: 진 대국의 기록(steps · 마지막 상태)도 saved에 모은다(복기 예산을 따로 재 보려고).
export const REPLAY = { on: false, rows: [], keep: false, saved: [] };
export function playRun(run, policy = 'smart', { endlessUntil = 0, stopAt = null, shopAlt = null } = {}) {
  const r = createRng((run.seed * 2654435761) >>> 0);
  const bought = new Set();
  const editions = [];
  let legendAt = null;
  SEEN.reset();
  SACLOG.reset();
  PEEK.rows = [];
  const trackBuys = (before) => {
    for (const m of run.maxims) if (!before.includes(m.uid)) { bought.add(m.id); if (m.edition) editions.push(m.edition); }
  };
  let guard = 0;
  let rb = null, rsteps = [];
  REPLAY.rows = [];
  while (guard++ < 5000) {
    if (run.phase === 'lost') break;
    if (stopAt && stopAt(run)) break;
    if (run.phase === 'won') { if (endlessUntil > run.ante) act(run, { type: 'endless' }); else break; }
    if (run.phase === 'draft') { act(run, { type: 'joseki', index: pickJoseki(run, policy, r) }); continue; }
    if (run.phase === 'select') { selectStep(run, policy, r); continue; }
    if (run.phase === 'battle') {
      const opts = policy === 'hunt' ? { rank: huntRank(run) } : policy === 'nosac' ? { sacrifice: false } : {};
      if (!REPLAY.on) {
        if (!stepBattle(run.battle, (c) => act(run, c), opts)) throw new Error('bot has no move but battle is live');
        continue;
      }
      const b = run.battle;
      if (rb !== b) { rb = b; rsteps = []; }
      const logLen = run.log.length;
      if (!stepBattle(b, (c) => { noteStep(rsteps, b, c); return act(run, c); }, opts)) throw new Error('bot has no move but battle is live');
      const row = run.log.length > logLen ? run.log[run.log.length - 1] : null;
      if (row && !row.won) {
        const t0 = performance.now();
        const r = review(rsteps, b);
        const ms = performance.now() - t0;
        row.replay = r.kind;
        if (REPLAY.keep) REPLAY.saved.push({ steps: rsteps, end: b, ended: run.phase === 'lost' });
        REPLAY.rows.push({ ante: row.ante, blind: row.blind, kind: row.kind, replay: r.kind, at: r.at ?? null, move: r.move ?? null, steps: rsteps.length, moves: b.movesUsed, nodes: r.nodes, ms: Math.round(ms), best: r.scores ? r.scores.best : null, score: b.score, target: b.target, first: r.best ? r.best[0].kind : null, ended: run.phase === 'lost' });
      }
      continue;
    }
    if (legendAt == null && run.legends.length) legendAt = run.ante;
    if (run.phase === 'shop') {
      if (shopAlt != null) reshop(run, shopAlt);
      noteDisplay(run);
      const before = run.maxims.map((m) => m.uid);
      if (policy === 'smart' || policy === 'hunt' || policy === 'nofam' || policy === 'nosac') smartShop(run, policy === 'hunt');
      else if (policy === 'random') randomShop(run, r);
      else act(run, { type: 'leave' });
      trackBuys(before);
      continue;
    }
    if (run.phase === 'pack') { act(run, { type: 'skipPack' }); continue; }
  }
  if (legendAt == null && run.legends.length) legendAt = run.ante;
  return { bought: [...bought], editions, legendAt, seen: JSON.parse(JSON.stringify({ ...SEEN, reset: undefined })), sac: SACLOG.rows.slice() };
}

export { blindInfo, canBuy };
