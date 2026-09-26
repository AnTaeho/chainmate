// 판(런) 봇: 대국 안은 tools/bot.mjs(풀이기), 상점은 정책 셋.
//   smart  — 사 보기 전에 그려 본다: 지금 짜임과 바꾼 짜임을 같은 대국판 K개(공통 난수)로 풀이기에 돌려
//            평균 총점이 몇 % 오르는지(득) 재고, 득/값이 가장 큰 것부터 산다. 초반엔 적립을 위해 돈을 남긴다.
//   random — 살 수 있는 것 중 아무거나(진열 · 꾸러미 · 나가기를 고르게), 꾸러미도 아무거나, 두루마리 대상도 아무거나.
//   none   — 아무것도 사지 않는다(격언 없이 어디까지 가나 보는 기준선).
import { createRng, fork, int, next } from '../src/sim/rng.js';
import { createBattle } from '../src/sim/battle.js';
import { applyRun, legalRunCommands, battleMods, canBuy, sellPrice, blindInfo } from '../src/sim/run.js';
import { SHOP, PROMOTE, rerollCost } from '../src/sim/shop.js';
import { FINAL_MASTER } from '../src/data/masters.js';
import { stepBattle } from './bot.mjs';
import { bestMove } from '../src/sim/solver.js';

export const SMART = {
  K: 8,            // 짜임 하나를 재는 대국판 수
  minGainPerCoin: 0.012, // 1원당 이만큼(비율) 오르지 않으면 안 산다
  reserve: (ante) => (ante <= 1 ? 0 : ante <= 6 ? 15 : 0), // 적립용으로 남길 돈(득이 크면 넘는다)
  bigGain: 0.35,   // 이만큼 오르면 reserve를 무시
  maxActions: 14,
  finalFrom: 6,    // 이 관부터 대가 대비
};

const clone = (x) => JSON.parse(JSON.stringify(x));

// ── 짜임 재기
function buildOf(run) {
  return { deck: clone(run.deck), maxims: clone(run.maxims), charts: { ...run.charts } };
}
function nextAnte(run) {
  return run.phase === 'shop' && run.blind === 2 ? run.ante + 1 : run.ante;
}
export const EVALS = { n: 0 };
// 짜임 하나의 힘: K개 대국판에서 「한 수」의 최선 점수 평균. 판마다 대국의 몇째 수인지(0~3)를 돌려 가며
// 그만큼 기물을 먼저 써 둔 채로 잰다(첫수 · 마지막 수 · 작은 주머니 같은 격언이 제 몫을 받게).
// 네 수를 끝까지 두는 것보다 6배쯤 싸고, 짜임끼리 비교하는 데는 충분하다.
export function evalBuild(run, build, seeds, ante, master = null) {
  EVALS.n++;
  let total = 0;
  seeds.forEach((seed, k) => {
    const b = createBattle({
      seed, ante, kind: 'practice', target: null,
      bag: build.deck.map((p) => ({ t: p.t, id: p.id, eng: p.eng })),
      rules: run.rules, mods: battleMods(build, master),
    });
    const m = Math.min(k % b.rules.moves, b.rules.moves - 1);
    for (let i = 0; i < m && b.hand.length; i++) {
      b.used.push(b.hand.shift());
      while (b.hand.length < b.rules.hand && b.bag.length) b.hand.push(b.bag.shift());
    }
    b.movesUsed = m;
    b.movesLeft = b.rules.moves - m;
    const best = b.hand.length ? bestMove(b, { preferMate: 'avoid' }) : null;
    total += best ? best.score : 0;
  });
  return total / seeds.length;
}

function evalSeeds(run, K) {
  const r = fork(createRng((run.seed ^ 0x5eed5) >>> 0), `eval:${run.ante}:${run.blind}`);
  return Array.from({ length: K }, () => Math.floor(next(r) * 2 ** 31));
}

const RANK = { P: 0, N: 1, B: 1, R: 2, Q: 3 };
// 두루마리(각인)를 붙일 가장 좋은 기물: 종류 · 각인이 같은 기물은 한 번만 잰다
function bestEngraveTarget(run, build, engId, ctx) {
  let best = null;
  const seen = new Set();
  // 무거운 기물부터 서로 다른 셋만 본다(재는 값을 아끼려고)
  const order = [...build.deck].sort((a, b) => RANK[b.t] - RANK[a.t] || (a.eng ? 1 : 0) - (b.eng ? 1 : 0));
  for (const p of order) {
    const key = p.t + (p.eng ? p.eng.id : '');
    if (seen.has(key) || (p.eng && p.eng.id === engId)) continue;
    if (seen.size >= 3) break;
    seen.add(key);
    const v = { ...build, deck: build.deck.map((q) => (q.id === p.id ? { ...q, eng: { id: engId } } : q)) };
    const score = ctx.score(v);
    if (!best || score > best.score) best = { target: p.id, score };
  }
  return best;
}

function makeCtx(run) {
  const seeds = evalSeeds(run, SMART.K);
  const ante = nextAnte(run);
  const nextBlind = run.phase === 'shop' ? (run.blind + 1) % 3 : run.blind;
  const nextMaster = blindInfo(run, ante, nextBlind).master;
  const cache = new Map();
  return {
    seeds, ante,
    score(build) {
      const key = JSON.stringify([build.deck.map((p) => p.t + (p.eng ? p.eng.id : '')).sort(), build.maxims.map((m) => m.id + JSON.stringify(m.data || {})), build.charts]);
      if (!cache.has(key)) {
        // 다음이 명인 대국이면 그 명인을 걸고도 잰다. 6관부터는 8관 「대가」(기보가 안 듣는다)도 미리 섞는다.
        const parts = [evalBuild(run, build, seeds, ante)];
        if (nextMaster) parts.push(evalBuild(run, build, seeds, ante, nextMaster));
        if (run.ante >= SMART.finalFrom && nextMaster !== FINAL_MASTER) parts.push(evalBuild(run, build, seeds, Math.max(ante, 8), FINAL_MASTER));
        cache.set(key, parts.reduce((a, x) => a + x, 0) / parts.length);
      }
      return cache.get(key);
    },
  };
}

// 소모품은 곧바로 쓴다(기보는 대상 없음, 각인은 가장 좋은 기물에)
function useConsumables(run, ctx) {
  while (run.consumables.length) {
    const c = run.consumables[0];
    if (c.kind === 'chart') applyRun(run, { type: 'use', index: 0 });
    else {
      const t = bestEngraveTarget(run, buildOf(run), c.id, ctx);
      applyRun(run, { type: 'use', index: 0, target: t ? t.target : run.deck[0].id });
    }
  }
}

// 격언 칸이 찼으면 가장 약한 격언(빼도 덜 떨어지는 것)을 찾는다
function weakestMaxim(run, build, ctx) {
  let best = null;
  build.maxims.forEach((m, i) => {
    const v = { ...build, maxims: build.maxims.filter((_, j) => j !== i) };
    const s = ctx.score(v);
    if (!best || s > best.score) best = { index: i, score: s };
  });
  return best;
}

// 산 뒤의 짜임(그려 보기). 돌려주는 값 { build, cmds: [명령…] } 또는 null
function variantFor(run, build, it, ctx) {
  if (it.kind === 'maxim') {
    const m = { uid: -1, id: it.id, data: {}, edition: null, paid: it.price };
    if (build.maxims.length < run.maximSlots) return { build: { ...build, maxims: [...build.maxims, m] }, sell: null };
    const w = weakestMaxim(run, build, ctx);
    if (!w) return null;
    return { build: { ...build, maxims: [...build.maxims.filter((_, j) => j !== w.index), m] }, sell: w.index };
  }
  if (it.kind === 'chart') return { build: { ...build, charts: { ...build.charts, [it.form]: build.charts[it.form] + 1 } } };
  if (it.kind === 'piece') return { build: { ...build, deck: [...build.deck, { id: -1, t: it.t, eng: null }] } };
  if (it.kind === 'engraving') {
    const t = bestEngraveTarget(run, build, it.id, ctx);
    if (!t) return null;
    return { build: { ...build, deck: build.deck.map((q) => (q.id === t.target ? { ...q, eng: { id: it.id } } : q)) }, target: t.target };
  }
  return null;
}

function smartShop(run) {
  const ctx = makeCtx(run);
  for (let step = 0; step < SMART.maxActions && run.phase === 'shop'; step++) {
    useConsumables(run, ctx);
    const build = buildOf(run);
    const base = Math.max(1, ctx.score(build));
    const reserve = SMART.reserve(run.ante);
    const cands = [];
    const consider = (cost, score, act, extra = {}) => {
      const gain = score / base - 1;
      cands.push({ cost, gain, act, ...extra });
    };
    run.shop.display.forEach((it, slot) => {
      if (it.sold || run.money < it.price) return;
      if ((it.kind === 'chart' || it.kind === 'engraving') && run.consumables.length >= run.consumableSlots) return;
      const v = variantFor(run, build, it, ctx);
      if (!v) return;
      const refund = v.sell != null ? sellPrice(run.maxims[v.sell]) : 0;
      consider(it.price - refund, ctx.score(v.build), { type: 'buy', slot }, { sell: v.sell });
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
        const seen = new Set();
        for (const p of build.deck) for (const to of PROMOTE[p.t] || []) {
          const key = p.t + to + (p.eng ? p.eng.id : '');
          if (seen.has(key)) continue;
          seen.add(key);
          const v = { ...build, deck: build.deck.map((q) => (q.id === p.id ? { ...q, t: to } : q)) };
          consider(SHOP.promotePrice, ctx.score(v), { type: 'promote', pieceId: p.id, to });
        }
      }
      if (!run.shop.removed && run.money >= SHOP.removePrice && build.deck.length > SHOP.deckMin) {
        const seen = new Set();
        for (const p of build.deck) {
          const key = p.t + (p.eng ? p.eng.id : '');
          if (seen.has(key)) continue;
          seen.add(key);
          const v = { ...build, deck: build.deck.filter((q) => q.id !== p.id) };
          consider(SHOP.removePrice, ctx.score(v), { type: 'remove', pieceId: p.id });
        }
      }
      best = pickBest();
    }
    if (best) {
      if (best.sell != null) applyRun(run, { type: 'sell', index: best.sell });
      applyRun(run, best.act);
      continue;
    }
    // 꾸러미: 여유 돈이 있으면 열어 보고 가장 좋은 것(오르지 않으면 넘김)
    const pk = run.shop.packs.findIndex((p) => !p.sold && run.money - p.price >= reserve);
    if (pk >= 0) {
      applyRun(run, { type: 'buyPack', slot: pk });
      let pick = null;
      run.pack.options.forEach((o, index) => {
        const v = variantFor(run, build, o, ctx);
        if (!v) return;
        const s = ctx.score(v.build);
        if (!pick || s > pick.s) pick = { s, cmd: { type: 'pick', index, target: v.target } };
      });
      if (pick && pick.s > base * 1.0) applyRun(run, pick.cmd);
      else applyRun(run, { type: 'skipPack' });
      continue;
    }
    // 다시 진열: 돈이 넉넉할 때만
    if (run.money - rerollCost(run) >= reserve + 8) { applyRun(run, { type: 'reroll' }); continue; }
    break;
  }
  if (run.phase === 'shop') { useConsumables(run, ctx); applyRun(run, { type: 'leave' }); }
}

function randomShop(run, r) {
  for (let step = 0; step < 20 && run.phase === 'shop'; step++) {
    const cmds = legalRunCommands(run).filter((c) => ['buy', 'buyPack', 'leave', 'use'].includes(c.type));
    // 나가기의 몫을 살 것들과 같게: 살 게 n개면 나가기 확률 1/(n+1)
    const c = cmds[int(r, cmds.length)];
    applyRun(run, c);
    if (run.phase === 'pack') {
      const opts = legalRunCommands(run).filter((x) => x.type === 'pick');
      applyRun(run, opts.length ? opts[int(r, opts.length)] : { type: 'skipPack' });
    }
  }
  if (run.phase === 'shop') applyRun(run, { type: 'leave' });
}

// 판 하나를 끝까지. 돌려주는 값: 요약(하네스용)
export function playRun(run, policy = 'smart', { endlessUntil = 0, stopAt = null } = {}) {
  const r = createRng((run.seed * 2654435761) >>> 0);
  const bought = new Set();
  const trackBuys = (before) => { for (const m of run.maxims) if (!before.includes(m.uid)) bought.add(m.id); };
  let guard = 0;
  while (guard++ < 5000) {
    if (run.phase === 'lost') break;
    if (stopAt && stopAt(run)) break;
    if (run.phase === 'won') { if (endlessUntil > run.ante) applyRun(run, { type: 'endless' }); else break; }
    if (run.phase === 'select') {
      if (policy === 'random' && run.blind < 2 && int(r, 5) === 0) applyRun(run, { type: 'skip' });
      else applyRun(run, { type: 'play' });
      continue;
    }
    if (run.phase === 'battle') {
      if (!stepBattle(run.battle, (c) => applyRun(run, c), {})) throw new Error('bot has no move but battle is live');
      continue;
    }
    if (run.phase === 'shop') {
      const before = run.maxims.map((m) => m.uid);
      if (policy === 'smart') smartShop(run);
      else if (policy === 'random') randomShop(run, r);
      else applyRun(run, { type: 'leave' });
      trackBuys(before);
      continue;
    }
    if (run.phase === 'pack') { applyRun(run, { type: 'skipPack' }); continue; }
  }
  return { bought: [...bought] };
}

export { blindInfo, canBuy };
