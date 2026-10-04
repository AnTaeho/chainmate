// 판 운 하네스: 판(런)의 대국 하나하나가 「덱의 힘」과 「대국판 운」 중 어느 쪽으로 갈리는지 잰다(CHM-18). 규칙은 건드리지 않는다.
//   node tools/luck.mjs --runs 40 --seed 1 --k 20 --sk 10 --workers 10 [--sample 1] [--policies 50] [--json out.json] [--limit 300]
//     [--peek-skip 0.2](판 보기 건너뛰기를 켠 봇, run.mjs와 같음)
//
// 1. smart 판 하네스를 run.mjs와 같은 시드(seed*1000003 + i*7919)로 돌린다. 대국이 시작될 때마다 그 직전 판 상태
//    (주머니 · 격언 · 기보 · 각인 · 혼 · 정석 · 목표 · 관 · 종류 · 명인)를 그대로 떠 둔다(playRun의 stopAt을 보기만 하는 데 쓴다).
// 2. 떠 둔 상태에서 대국판 시드만 바꿔(fork(원래 대국 시드, 'alt:k')) 다시 둔다. 대국판마다 두 번:
//      목표 있는 대국(판과 같은 봇 · 같은 목표) → 이겼나(대체 판 승률)
//      목표 없는 대국(수 4를 다 씀, 외통을 피함 = sim.mjs --nomate) → 대국 점수(목표에서 끊기지 않은 점수. 그래도 외통 · 오목으로 끝난 판은 점수 통계에서 뺀다)
//    판 죽음(진 대국)은 K개(--k), 나머지 대국은 --sample 몫만큼 SK개(--sk).
// 3. 대국판마다 시작 성질을 잰다: 떨굴 수 있는 칸 · 첫 손 최선 사슬(풀이기) · 적 구성 · 서로 지키는 적 · 증원 자리 · 손.
// 4. random · none 정책은 판만 돌려 판 승률 · 관별 통과율을 낸다(--policies 판씩, 0이면 뺀다).
// 5. --split(운의 출처, docs/reports/agency-measure.md): 판을 끝낸 진 대국마다 같은 직전 상태에서 하나만 바꿔 K번 다시 둔다.
//      (a) 대국판만: 대체 시드로 판 · 증원을 깔고 손 · 주머니 차례는 원래 대국 그대로
//      (b) 주머니 차례만: 원래 판 · 증원, 손 · 주머니를 대체 스트림으로 다시 섞음
//      (ab) 둘 다: 위 2의 대체 판(옛 luck.md와 같은 수)
//      (c) 둘 다 그대로, 봇만 세게(--strong N · --look M, bot.mjs BOT · shopbot applyStrength): 같은 상태에서 한 번(결정적)
//      (cb) --ck개: 세게 둔 봇으로 (b)의 대체 주머니를 다시 둠 — 같은 대체에서 보통 봇(b)과 짝 비교
// 6. --shopk N(운의 출처 (d)): smart 판마다 상점 난수만 바꾼 판을 N번 처음부터 다시 둔다(shopbot playRun shopAlt).
// 표를 찍고 --json 경로에 수치를 남긴다(시간 값은 넣지 않는다: 같은 시드면 같은 파일).
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createRng, fork, next, shuffle } from '../src/sim/rng.js';
import { createRun, blindInfo, battleMods, awaitingGold, battleSeed, layoutFor, ANTES, KINDS } from '../src/sim/run.js';
import { boardFilter } from '../src/sim/tuning.js';
import { createBattle, apply, dropSquaresFor, GOLDEN, hasLegalDrop, checkStuck, refreshHints } from '../src/sim/battle.js';
import { attackers } from '../src/sim/board.js';
import { boardOpts } from '../src/sim/chain.js';
import { bestMove } from '../src/sim/solver.js';
import { PIECES, valueOf } from '../src/data/pieces.js';
import { playRun, SMART, PEEK } from './shopbot.mjs';
import { stepBattle, BOT, SAC } from './bot.mjs';
import { applyNight2 } from './night2.mjs';

const SELF = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const a = { runs: 40, seed: 1, k: 20, sk: 10, sample: 1, workers: 10, policies: null, json: null, limit: 300, shopK: SMART.K, split: false, strong: 4, look: 0, ck: 0, shopk: 0, peekSkip: null };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i];
    if (x === '--runs') a.runs = Number(argv[++i]);
    else if (x === '--seed') a.seed = Number(argv[++i]);
    else if (x === '--k') a.k = Number(argv[++i]);              // 판 죽음마다 대체 대국판 수
    else if (x === '--sk') a.sk = Number(argv[++i]);            // 이긴 대국마다 대체 대국판 수
    else if (x === '--sample') a.sample = Number(argv[++i]);    // 이긴 대국 중 잴 몫(0~1, 시드로 정해진다)
    else if (x === '--workers') a.workers = Number(argv[++i]);
    else if (x === '--policies') a.policies = Number(argv[++i]);
    else if (x === '--json') a.json = argv[++i];
    else if (x === '--limit') a.limit = Number(argv[++i]);      // 판 하나(대체 대국 빼고) 시간 상한(초)
    else if (x === '--tune') a.tune = JSON.parse(argv[++i]);    // 밤샘 2 장치 켜고 끄기(run.mjs와 같은 꼴)
    else if (x === '--split') a.split = true;                   // 운의 출처: 판만 · 주머니만 · 봇만 세게
    else if (x === '--strong') a.strong = Number(argv[++i]);    // (c)의 세기: 예산 ×N(기본 4)
    else if (x === '--look') a.look = Number(argv[++i]);        // (c)의 내다보기 굴림 수(기본 0)
    else if (x === '--ck') a.ck = Number(argv[++i]);            // (cb) 세게 둔 봇으로 다시 둘 대체 주머니 수(기본 0)
    else if (x === '--shopk') a.shopk = Number(argv[++i]);      // (d) 판마다 상점 난수만 바꾼 판 수(기본 0)
    else if (x === '--peek-skip') a.peekSkip = Number(argv[++i]); // 판 보기 건너뛰기(run.mjs --peek-skip과 같음): 판 읽기가 이 값 + 패 덤보다 낮으면 건너뛴다
  }
  if (a.policies == null) a.policies = a.runs;
  return a;
}

const runSeeds = (seed, n) => Array.from({ length: n }, (_, i) => (seed * 1000003 + i * 7919) >>> 0);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── 떠 둔 판 상태에서 대국을 다시 만든다(run.js startBattle과 같은 재료, 시드만 바꿀 수 있게)
// 판 보기(CHM-61) 뒤로 대국은 관 선택에서 지어 둔 판(run.boards — 그때의 주머니로 거른 판)으로 열린다. 원래 시드면 떠 둔 상태의
// 지어 둔 판(layoutFor)을 깔고, 대체 시드면 지금 상태로 새로 짓는다(대체 판의 거르기는 대국 직전 주머니로 잰다).
const origSeed = (snap) => battleSeed(snap);
const altSeed = (snap, k) => fork(createRng(origSeed(snap)), `alt:${k}`).s;
function rebuild(snap, seed, withTarget = true) {
  const info = blindInfo(snap);
  return createBattle({
    layout: seed === origSeed(snap) && snap.factions ? layoutFor(snap, snap.blind) : null,
    seed, ante: snap.ante, kind: info.kind, target: withTarget ? info.target : null,
    bag: snap.deck.map((p) => ({ t: p.t, id: p.id, eng: p.eng, ...(p.soul ? { soul: p.soul } : {}) })),
    rules: snap.rules, mods: battleMods(snap, info.master, info.faction),
    goldenChance: awaitingGold(snap) ? GOLDEN.calling : GOLDEN.chance,
    filter: boardFilter(),
  });
}
const boardKey = (b) => b.board.map((c) => (c ? c.t + (c.gold ? '*' : '') + (c.trait || '') : '.')).join('') + '|' + b.hand.map((p) => p.t).join('') + '|' + b.target + '|' + JSON.stringify(b.incoming);

function playOut(b, opts = {}) {
  let guard = 0;
  while (b.status === 'play' && guard++ < 200) {
    if (!stepBattle(b, (c) => apply(b, c), opts)) break;
  }
  return b;
}

// 대국판 시작 성질(목표 없는 쪽 대국으로, 두기 전에)
function features(b) {
  const opts = boardOpts(b);
  const union = new Set();
  let pairs = 0;
  for (const p of b.hand) { const s = dropSquaresFor(b, p); pairs += s.length; for (const q of s) union.add(q); }
  const best = bestMove(b, { preferMate: false });
  const enemies = [];
  b.board.forEach((c, sq) => { if (c && !c.mine && c.t !== 'K' && c.t !== 'X' && c.t !== 'J') enemies.push(sq); });
  const types = enemies.map((sq) => b.board[sq].t);
  const guarded = enemies.map((sq) => attackers(b.board, sq, opts).length);
  const ksq = b.board.findIndex((c) => c && c.t === 'K');
  const heavy = (t) => t === 'Q' || t === 'R' || PIECES[t].fairy;
  const inc = b.incoming || [];
  return {
    drops: union.size,                                      // 첫 손으로 떨굴 수 있는 칸(겹침 없이)
    dropPairs: pairs,                                       // 손 기물 × 칸
    bestScore: best ? best.score : 0,                       // 첫 손 최선 사슬 점수(풀이기, 외통 줄도 점수로)
    bestLen: best ? best.captures : 0,                      // 그 사슬의 먹기 수
    bestMate: best && best.mate ? 1 : 0,
    enemies: enemies.length,
    pawnRatio: types.filter((t) => t === 'P').length / Math.max(1, types.length),
    heavy: types.filter(heavy).length,                      // 룩 · 퀸 · 이형
    enemyValue: types.reduce((a, t) => a + valueOf(t), 0) / Math.max(1, types.length),
    guardedShare: guarded.filter((x) => x > 0).length / Math.max(1, guarded.length), // 다른 적이 지키는 적의 몫
    guardMean: guarded.reduce((a, x) => a + x, 0) / Math.max(1, guarded.length),
    kingGuards: ksq >= 0 ? attackers(b.board, ksq, opts).length : 0,
    incRank: inc.length ? inc.reduce((a, x) => a + (x.sq >> 3), 0) / inc.length : 0, // 증원 자리의 줄(0 = 내 쪽)
    incValue: inc.reduce((a, x) => a + valueOf(x.t), 0),
    handValue: b.hand.reduce((a, p) => a + valueOf(p.t), 0),
    handPawns: b.hand.filter((p) => p.t === 'P').length,
    things: b.board.filter((c) => c && (c.t === 'X' || c.t === 'J')).length,
    gold: b.board.some((c) => c && c.gold) ? 1 : 0,
  };
}

// 떠 둔 상태 하나를 K개 대체 판에서 잰다
function measure(task) {
  const { snap, n } = task;
  const alts = [];
  for (let k = 0; k < n; k++) {
    const seed = altSeed(snap, k);
    const bt = playOut(rebuild(snap, seed, true));
    const bf = rebuild(snap, seed, false);
    const f = features(bf);
    playOut(bf, { nomate: true }); // 점수 재기: 외통을 피한다(sim.mjs --nomate). 목표가 없으면 외통을 노려 대국 절반이 외통으로 끝나 점수가 사라진다
    const reason = bf.result ? bf.result.reason : 'none';
    alts.push({ k, won: bt.status === 'won', wonBy: bt.result ? bt.result.reason : 'none', score: bf.score, end: reason, f });
  }
  // 원래 시드를 따로 다시 두어 판 안의 결과와 같은지 본다(떠 둔 상태 · 봇이 판 밖에서도 똑같이 도는지)
  const orig = playOut(rebuild(snap, origSeed(snap), true));
  // 맞춤 문제 가리기: 원래 판의 첫 손 최선 사슬 점수가 대체 판들 사이 몇째인가(0~1, 같으면 반씩). 고르게 퍼지면 원래 판이 대체 판과 같은 분포
  const ob = rebuild(snap, origSeed(snap), false);
  const oScore = features(ob).bestScore;
  const below = alts.filter((a) => a.f.bestScore < oScore).length + 0.5 * alts.filter((a) => a.f.bestScore === oScore).length;
  const out = { id: task.id, alts, origWon: orig.status === 'won', origScore: orig.score, origPct: below / Math.max(1, alts.length), origReboards: orig.reboards || 0 };
  if (task.split) out.split = splitMeasure(snap, n, task.split);
  return out;
}

// ── 운의 출처(--split): 하나만 바꾼 다시 두기
// 손 · 주머니 차례와 주머니 난수를 갈아 끼운다(판은 그대로). 판을 깔 때 본 손과 다르면 첫 손으로 떨굴 곳이 없을 수 있다 — 그때는
// 규칙대로(checkStuck: 희생이 남았으면 봇이 바치고, 없으면 손을 새로 쥔다) 두고 그 수를 센다.
function setHand(b, hand, bag, bagRng) {
  b.hand = clone(hand); b.bag = clone(bag); b.rng.bag = { ...bagRng };
  refreshHints(b);
  const noDrop = !hasLegalDrop(b);
  checkStuck(b, []);
  return noDrop;
}
function withStrength({ strong, look }, fn) {
  const saved = { nodes: BOT.nodes, look: BOT.look, sn: SAC.nodes, sk: SAC.keys };
  if (strong !== 1) { BOT.nodes = Math.round(10000 * strong); SAC.nodes = Math.round(SAC.nodes * strong); SAC.keys = Math.round(SAC.keys * strong); }
  BOT.look = look || 0;
  try { return fn(); } finally { BOT.nodes = saved.nodes; BOT.look = saved.look; SAC.nodes = saved.sn; SAC.keys = saved.sk; }
}
function bagVariant(snap, k) {
  const b = rebuild(snap, origSeed(snap), true);
  const all = [...b.hand, ...b.bag];
  const r = fork(createRng(origSeed(snap)), `altbag:${k}`);
  shuffle(r, all);
  const noDrop = setHand(b, all.slice(0, b.hand.length), all.slice(b.hand.length), r);
  return { b, noDrop };
}
function splitMeasure(snap, n, opt) {
  const o = rebuild(snap, origSeed(snap), true);
  const board = [], bag = [];
  let noDropA = 0, noDropB = 0;
  for (let k = 0; k < n; k++) {
    // (a) 대국판만: 대체 시드의 판 · 증원 · 금빛 · 확률, 손 · 주머니 차례 · 주머니 난수는 원래 대국
    const ba = rebuild(snap, altSeed(snap, k), true);
    if (setHand(ba, o.hand, o.bag, o.rng.bag)) noDropA++;
    board.push(playOut(ba).status === 'won' ? 1 : 0);
    // (b) 주머니 차례만
    const v = bagVariant(snap, k);
    if (v.noDrop) noDropB++;
    bag.push(playOut(v.b).status === 'won' ? 1 : 0);
  }
  // (c) 같은 상태 · 세게 둔 봇
  const strong = withStrength(opt, () => playOut(rebuild(snap, origSeed(snap), true)));
  // (cb) 세게 둔 봇으로 (b)의 대체 주머니
  const strongBag = [];
  for (let k = 0; k < (opt.ck || 0); k++) strongBag.push(withStrength(opt, () => playOut(bagVariant(snap, k).b)).status === 'won' ? 1 : 0);
  return { board, bag, strongWon: strong.status === 'won' ? 1 : 0, strongScore: strong.score, strongBag, noDropA, noDropB };
}

// ── 판 하나(스냅숏 포함)
function oneRun(seed, policy, withSnaps, shopAlt = null) {
  const run = createRun({ seed });
  const snaps = [];
  let lastKey = null, mismatch = 0;
  const watch = (r) => {
    if (!withSnaps || r.phase !== 'battle' || r.endless) return false;
    const key = `${r.ante}:${r.blind}`;
    if (key === lastKey) return false;
    lastKey = key;
    const snap = clone({ ...r, battle: null, shop: null, pack: null, log: [] });
    // 다시 만든 대국이 판이 연 대국과 같아야 떠 둔 상태가 온전하다
    if (boardKey(rebuild(snap, origSeed(snap))) !== boardKey(r.battle)) mismatch++;
    snaps.push(snap);
    return false;
  };
  playRun(run, policy, { stopAt: watch, shopAlt });
  return {
    seed, policy, shopAlt, won: run.phase === 'won', ante: run.ante, blind: run.blind,
    log: run.log.map((x) => ({ ante: x.ante, blind: x.blind, kind: x.kind, master: x.master, target: x.target, score: x.score, won: x.won, reason: x.reason, skipped: !!x.skipped, clockLost: !!x.clockLost, reboards: x.reboards || 0 })),
    snaps, mismatch,
  };
}

// 이긴 대국 중 잴 것(시드로 정해진다)
const sampled = (seed, ante, blind, frac) => frac >= 1 || next(fork(createRng(seed), `luck:${ante}:${blind}`)) < frac;

// ── 통계
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const variance = (a) => { if (a.length < 2) return NaN; const m = mean(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
const sd = (a) => Math.sqrt(variance(a));
const quant = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };
function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN];
  const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
  return [(c - h) / d, (c + h) / d];
}
function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
const ranks = (a) => { const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]); const r = new Array(a.length); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let t = i; t <= j; t++) r[idx[t][1]] = (i + j) / 2; i = j + 1; } return r; };
const spearman = (x, y) => pearson(ranks(x), ranks(y));
// 이긴 판의 값이 진 판의 값보다 클 확률(AUC)
function auc(vals, wins) {
  const r = ranks(vals); const n1 = wins.filter(Boolean).length, n0 = wins.length - n1;
  if (!n1 || !n0) return NaN;
  const s = r.reduce((a, x, i) => a + (wins[i] ? x + 1 : 0), 0);
  return (s - n1 * (n1 + 1) / 2) / (n1 * n0);
}
const zs = (a) => { const m = mean(a), s = sd(a); return a.map((x) => (s > 0 ? (x - m) / s : 0)); };
const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
const BUCKETS = [[0.8, 1.01, '≥80%'], [0.6, 0.8, '60~80%'], [0.4, 0.6, '40~60%'], [0.2, 0.4, '20~40%'], [0, 0.2, '<20%']];
const bucketOf = (p) => BUCKETS.find(([lo, hi]) => p >= lo && p < hi)[2];
const FEATS = ['bestScore', 'bestLen', 'drops', 'dropPairs', 'bestMate', 'enemies', 'pawnRatio', 'heavy', 'enemyValue', 'guardedShare', 'guardMean', 'kingGuards', 'incRank', 'incValue', 'handValue', 'handPawns', 'things', 'gold'];
const FEAT_NAME = {
  bestScore: '첫 손 최선 사슬 점수', bestLen: '첫 손 최선 사슬 길이', drops: '떨굴 수 있는 칸', dropPairs: '떨구기 가짓수(기물×칸)', bestMate: '첫 손 외통 줄',
  enemies: '적 수', pawnRatio: '적 중 폰 비율', heavy: '무거운 적(룩·퀸·이형)', enemyValue: '적 평균 값', guardedShare: '지켜지는 적의 몫', guardMean: '적 하나를 지키는 적 수',
  kingGuards: '킹 수비수', incRank: '첫 증원 줄(0=내 쪽)', incValue: '첫 증원 값', handValue: '손 값 합', handPawns: '손의 폰', things: '벽·보석', gold: '금빛 적',
};

function analyse(args, smart, states, others) {
  const R = smart.runs;
  const n = R.length;
  const survival = (runs) => {
    const out = [];
    for (let ante = 1; ante <= ANTES; ante++) {
      const reached = runs.filter((r) => r.won || r.ante >= ante).length;
      const cleared = runs.filter((r) => r.won || r.ante > ante).length;
      out.push({ ante, reached: r3(reached / runs.length), cleared: r3(cleared / runs.length), passGivenReached: r3(reached ? cleared / reached : NaN) });
    }
    return out;
  };
  const winRate = (runs) => runs.filter((r) => r.won).length / runs.length;

  // 1. 판 죽음
  const deaths = states.filter((s) => s.death).map((s) => {
    const w = s.alts.filter((a) => a.won).length;
    return { seed: s.seed, ante: s.ante, kind: s.kind, master: s.master, altWin: w / s.alts.length, altN: s.alts.length, bucket: bucketOf(w / s.alts.length) };
  });
  const bucketRows = BUCKETS.map(([, , name]) => {
    const k = deaths.filter((d) => d.bucket === name).length;
    const [lo, hi] = wilson(k, deaths.length);
    return { bucket: name, n: k, share: r3(k / deaths.length), ci: [r3(lo), r3(hi)] };
  });
  const dAlt = deaths.map((d) => d.altWin);
  const hi60 = deaths.filter((d) => d.altWin >= 0.6).length, lo40 = deaths.filter((d) => d.altWin < 0.4).length;
  const death = {
    n: deaths.length, meanAltWin: r3(mean(dAlt)), meanCi: [r3(Math.max(0, mean(dAlt) - 1.96 * sd(dAlt) / Math.sqrt(dAlt.length))), r3(Math.min(1, mean(dAlt) + 1.96 * sd(dAlt) / Math.sqrt(dAlt.length)))],
    median: r3(quant(dAlt, 0.5)),
    luck60: { n: hi60, share: r3(hi60 / deaths.length), ci: wilson(hi60, deaths.length).map(r3) },
    weak40: { n: lo40, share: r3(lo40 / deaths.length), ci: wilson(lo40, deaths.length).map(r3) },
    // 기대 판 운 몫: 진 대국마다 「다른 판이면 이겼을 확률」의 합 / 죽음 수
    buckets: bucketRows,
    byAnte: Array.from({ length: ANTES }, (_, i) => { const d = deaths.filter((x) => x.ante === i + 1); return { ante: i + 1, n: d.length, meanAltWin: r3(mean(d.map((x) => x.altWin))) }; }),
    byKind: KINDS.map((k) => { const d = deaths.filter((x) => x.kind === k); return { kind: k, n: d.length, meanAltWin: r3(mean(d.map((x) => x.altWin))) }; }),
    list: deaths.map((d) => ({ ...d, altWin: r3(d.altWin) })),
  };

  // 1b. 진 대국 전부(시계를 잃은 대국 포함)
  const losses = states.filter((s) => s.lost).map((s) => s.alts.filter((a) => a.won).length / s.alts.length);
  const lostAll = { n: losses.length, meanAltWin: r3(mean(losses)), luck60: r3(losses.filter((x) => x >= 0.6).length / Math.max(1, losses.length)), weak40: r3(losses.filter((x) => x < 0.4).length / Math.max(1, losses.length)),
    perRun: r3(losses.length / R.length), clockLostPerRun: r3(R.reduce((a, r) => a + r.log.filter((x) => x.clockLost).length, 0) / R.length),
    reboardPerBattle: r3(R.reduce((a, r) => a + r.log.reduce((b, x) => b + (x.reboards || 0), 0), 0) / Math.max(1, R.reduce((a, r) => a + r.log.filter((x) => !x.skipped).length, 0))) };
  // 맞춤 확인 거들기: 원래 판의 첫 손 점수 백분위(대체 판 사이). 고르면 평균 0.5 · 사분위마다 25%
  const pcts = states.map((s) => s.origPct).filter((x) => Number.isFinite(x));
  const origPct = { n: pcts.length, mean: r3(mean(pcts)), quartiles: [0, 1, 2, 3].map((q) => r3(pcts.filter((x) => x >= q / 4 && (q === 3 ? x <= 1 : x < (q + 1) / 4)).length / Math.max(1, pcts.length))),
    lostMean: r3(mean(states.filter((s) => s.lost).map((s) => s.origPct))), wonMean: r3(mean(states.filter((s) => !s.lost).map((s) => s.origPct))) };

  // 2. 대국마다 이길 확률
  const p = states.map((s) => s.alts.filter((a) => a.won).length / s.alts.length);
  const slot = [];
  for (let ante = 1; ante <= ANTES; ante++) for (const kind of KINDS) {
    const idx = states.map((s, i) => (s.ante === ante && s.kind === kind ? i : -1)).filter((i) => i >= 0);
    const ps = idx.map((i) => p[i]);
    const hist = Array.from({ length: 10 }, (_, b) => ps.filter((x) => Math.min(9, Math.floor(x * 10)) === b).length);
    slot.push({ ante, kind, n: ps.length, mean: r3(mean(ps)), sd: r3(sd(ps)), p10: r3(quant(ps, 0.1)), p50: r3(quant(ps, 0.5)), hist });
  }
  const prodAll = slot.reduce((a, s) => a * (Number.isFinite(s.mean) ? s.mean : 1), 1);
  const histAll = Array.from({ length: 10 }, (_, b) => p.filter((x) => Math.min(9, Math.floor(x * 10)) === b).length);
  const perBattle = {
    states: states.length, altBoards: states.reduce((a, s) => a + s.alts.length, 0),
    meanAll: r3(mean(p)), hist: histAll, histEdges: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1],
    slots: slot, product24: r3(prodAll), actualRunWin: r3(winRate(R)),
    // 맞춤 확인: 대국마다 (1 − 대체 판 승률)의 합 = 기대 판 죽음 수(이긴 대국을 모두 잴 때만 뜻이 있다)
    expectedDeaths: r3(p.reduce((a, x) => a + (1 - x), 0)), observedDeaths: states.filter((s) => s.lost).length,
    geoMean24: r3(prodAll ** (1 / 24)),
    trap: [0.9, 0.95, 0.97, 0.98, 0.99].map((q) => ({ perBattle: q, run: r3(q ** 24) })),
    needFor: [0.2, 0.3, 0.5].map((t) => ({ run: t, perBattle: r3(t ** (1 / 24)) })),
    // 대국 하나가 안전(≥95%)한 몫과 위험(<80%)한 몫
    safe95: r3(p.filter((x) => x >= 0.95).length / p.length), risky80: r3(p.filter((x) => x < 0.8).length / p.length),
  };

  // 3. 분산 나누기(관별): log(목표 없는 점수), 외통 · 오목으로 끝난 판은 뺀다. 승패도 같은 방식으로.
  const scored = (s) => s.alts.filter((a) => a.end !== 'mate' && a.end !== 'gomoku' && a.score > 0);
  const decomp = [];
  for (let ante = 1; ante <= ANTES; ante++) {
    const ss = states.filter((s) => s.ante === ante);
    const groups = ss.map((s) => scored(s).map((a) => Math.log(a.score))).filter((g) => g.length >= 3);
    const all = groups.flat();
    const vw = mean(groups.map(variance));
    const nbar = mean(groups.map((g) => g.length));
    const vb = Math.max(0, variance(groups.map(mean)) - vw / nbar);
    const wg = ss.map((s) => s.alts.map((a) => (a.won ? 1 : 0)));
    const pw = wg.map(mean);
    const winW = mean(pw.map((q) => q * (1 - q))); // 같은 상태 안 승패 분산(모집단 꼴) — 총분산 p̄(1−p̄)을 넘지 않는다
    const pbar = mean(wg.flat());
    const mates = ss.flatMap((s) => s.alts).filter((a) => a.end === 'mate' || a.end === 'gomoku').length;
    const tot = ss.reduce((a, s) => a + s.alts.length, 0);
    decomp.push({
      ante, states: groups.length, boards: all.length, mateShare: r3(mates / Math.max(1, tot)),
      varTotal: r3(variance(all)), varWithin: r3(vw), varBetween: r3(vb), luckShare: r3(vw / (vw + vb)),
      // 점수 퍼짐(같은 상태 안): 좋은 판/나쁜 판 배수 ≈ exp(2.56σ) (p90/p10)
      withinP90P10: r3(Math.exp(2.563 * Math.sqrt(vw))), betweenP90P10: r3(Math.exp(2.563 * Math.sqrt(vb))),
      winLuckShare: r3(winW / (pbar * (1 - pbar))), winMean: r3(pbar), stateWinSd: r3(sd(pw)),
    });
  }
  const allGroups = states.map((s) => scored(s).map((a) => Math.log(a.score))).filter((g) => g.length >= 3);

  // 4. 나쁜 판 · 좋은 판을 가르는 성질: 같은 상태 안에서 z로 맞춘 뒤 묶는다
  const rows = [];
  for (const s of states) {
    const sc = scored(s);
    if (sc.length < 4) continue;
    const zScore = zs(sc.map((a) => Math.log(a.score)));
    const zf = Object.fromEntries(FEATS.map((f) => [f, zs(sc.map((a) => a.f[f]))]));
    sc.forEach((a, i) => rows.push({ z: zScore[i], ante: s.ante, won: a.won, f: Object.fromEntries(FEATS.map((f) => [f, zf[f][i]])), raw: a.f, logScore: Math.log(a.score) }));
  }
  const cut = (q) => quant(rows.map((r) => r.z), q);
  const lo = cut(0.2), hi = cut(0.8);
  const bad = rows.filter((r) => r.z <= lo), good = rows.filter((r) => r.z >= hi);
  const featRank = FEATS.map((f) => {
    const gb = good.map((r) => r.f[f]), bb = bad.map((r) => r.f[f]);
    const pooled = Math.sqrt((variance(gb) + variance(bb)) / 2);
    const d = pooled > 0 ? (mean(gb) - mean(bb)) / pooled : 0;
    const rawBad = mean(bad.map((r) => r.raw[f])), rawGood = mean(good.map((r) => r.raw[f]));
    return { feature: f, name: FEAT_NAME[f], d: r3(d), spearman: r3(spearman(rows.map((r) => r.f[f]), rows.map((r) => r.z))), rawBad: r3(rawBad), rawGood: r3(rawGood) };
  }).sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  // 첫 손 최선 사슬 점수 ↔ 실제 대국 점수
  const allScored = states.flatMap((s) => scored(s).map((a) => ({ ...a, ante: s.ante })));
  const corrByAnte = [];
  for (let ante = 1; ante <= ANTES; ante++) {
    const a = allScored.filter((x) => x.ante === ante && x.f.bestScore > 0);
    const w = rows.filter((r) => r.ante === ante);
    const tw = states.filter((s) => s.ante === ante).flatMap((s) => s.alts);
    corrByAnte.push({
      ante, n: a.length,
      rawLog: r3(pearson(a.map((x) => Math.log(x.f.bestScore)), a.map((x) => Math.log(x.score)))),
      within: r3(pearson(w.map((r) => r.f.bestScore), w.map((r) => r.z))),
      aucWin: r3(auc(tw.map((x) => x.f.bestScore), tw.map((x) => x.won))),
    });
  }
  const allAlts = states.flatMap((s) => s.alts);
  const aOk = allScored.filter((x) => x.f.bestScore > 0);
  const corr = {
    rawLog: r3(pearson(aOk.map((x) => Math.log(x.f.bestScore)), aOk.map((x) => Math.log(x.score)))),
    within: r3(pearson(rows.map((r) => r.f.bestScore), rows.map((r) => r.z))),
    withinSpearman: r3(spearman(rows.map((r) => r.f.bestScore), rows.map((r) => r.z))),
    // 승패는 같은 상태 안에서만 비교해야 덱 힘이 새지 않는다: 이긴 판과 진 판이 섞인 상태만
    aucWinWithin: r3((() => { const xs = []; for (const s of states) { const w = s.alts.filter((a) => a.won), l = s.alts.filter((a) => !a.won); if (!w.length || !l.length) continue; for (const a of w) for (const b of l) xs.push(a.f.bestScore > b.f.bestScore ? 1 : a.f.bestScore === b.f.bestScore ? 0.5 : 0); } return mean(xs); })()),
    aucWinRaw: r3(auc(allAlts.map((x) => x.f.bestScore), allAlts.map((x) => x.won))),
    byAnte: corrByAnte,
    // 흩뿌림 그림용: 관 · log 첫 손 점수 · log 대국 점수(표본 600개까지, 순서는 결정적)
    scatter: aOk.filter((_, i) => i % Math.max(1, Math.ceil(aOk.length / 600)) === 0).map((x) => [x.ante, r3(Math.log10(x.f.bestScore)), r3(Math.log10(x.score)), x.won ? 1 : 0]),
  };
  // 판을 거를 때 쓸 문턱 보기: 같은 상태 안 첫 손 점수 하위 20%를 버렸다면 대체 판 승률이 얼마나 오르나
  const filterSim = (() => {
    let base = 0, kept = 0, keptN = 0, all = 0;
    for (const s of states) {
      const v = s.alts.map((a) => a.f.bestScore); const t = quant(v, 0.2);
      for (const a of s.alts) { all++; base += a.won; if (a.f.bestScore > t) { keptN++; kept += a.won; } }
    }
    return { baseWin: r3(base / all), keptWin: r3(kept / keptN), keptShare: r3(keptN / all) };
  })();

  // 5. 정책
  const policies = { smart: { runs: n, timeouts: smart.timeouts.length, runWin: r3(winRate(R)), ci: wilson(R.filter((r) => r.won).length, n).map(r3), survival: survival(R) } };
  for (const [k, v] of Object.entries(others)) if (k !== '__shop') policies[k] = { runs: v.runs.length, timeouts: v.timeouts.length, runWin: r3(winRate(v.runs)), ci: wilson(v.runs.filter((r) => r.won).length, v.runs.length).map(r3), survival: survival(v.runs) };

  return {
    tool: 'tools/luck.mjs', args: { runs: args.runs, seed: args.seed, k: args.k, sk: args.sk, sample: args.sample, policies: args.policies, shopK: args.shopK, limit: args.limit, split: args.split, strong: args.strong, look: args.look, ck: args.ck, shopk: args.shopk, peekSkip: args.peekSkip },
    rebuildMismatch: R.reduce((a, r) => a + r.mismatch, 0),
    replayMismatch: states.filter((s) => s.origWon !== s.actualWon || s.origScore !== s.actualScore).length, snapshots: R.reduce((a, r) => a + r.snaps.length, 0), timeouts: smart.timeouts,
    runs: R.map((r) => ({ seed: r.seed, won: r.won, ante: r.ante, blind: r.blind, battles: r.log.length })),
    death, lostAll, origPct, perBattle, decomp, luckShareAll: r3((() => { const vw = mean(allGroups.map(variance)); return vw / variance(allGroups.flat()); })()),
    features: { rows: rows.length, badCut: r3(lo), goodCut: r3(hi), rank: featRank }, corr, filterSim, policies,
    split: analyseSplit(states, args), shop: analyseShop(R, others.__shop, args),
  };
}

// ── 운의 출처 분석: 판을 끝낸 진 대국마다 pA(판만) · pB(주머니만) · pAB(둘 다) · c(같은 상태 세게) · pCB(세게 · 주머니만)
function analyseSplit(states, args) {
  const ds = states.filter((s) => s.death && s.split);
  if (!ds.length) return null;
  const m = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const rows = ds.map((s) => {
    const pAB = s.alts.filter((a) => a.won).length / s.alts.length;
    const pA = m(s.split.board), pB = m(s.split.bag);
    const pCB = s.split.strongBag.length ? m(s.split.strongBag) : null;
    const pBpair = s.split.strongBag.length ? m(s.split.bag.slice(0, s.split.strongBag.length)) : null;
    return { seed: s.seed, ante: s.ante, kind: s.kind, pA, pB, pAB, c: s.split.strongWon, pCB, pBpair, noDropA: s.split.noDropA, noDropB: s.split.noDropB, n: s.split.board.length };
  });
  const n = rows.length;
  const meanCi = (xs) => { const mu = mean(xs), e = 1.96 * sd(xs) / Math.sqrt(xs.length); return { mean: r3(mu), ci: [r3(Math.max(0, mu - e)), r3(Math.min(1, mu + e))] }; };
  const share = (pred) => { const k = rows.filter(pred).length; return { n: k, share: r3(k / n), ci: wilson(k, n).map(r3) }; };
  const src = (key, name) => ({ key, name, ...meanCi(rows.map((r) => r[key])), hi60: share((r) => r[key] >= 0.6), lo40: share((r) => r[key] < 0.4), any: share((r) => r[key] > 0) });
  const sources = [src('pA', '(a) 대국판만'), src('pB', '(b) 주머니 차례만'), src('pAB', '(ab) 둘 다')];
  const strong = share((r) => r.c === 1);
  const withCb = rows.filter((r) => r.pCB != null);
  const cb = withCb.length ? { n: withCb.length, strongMean: r3(mean(withCb.map((r) => r.pCB))), baseMean: r3(mean(withCb.map((r) => r.pBpair))) } : null;
  // 겹치지 않는 갈래(먼저 맞는 쪽): 세게 두면 이김 → 실수 / 판만 ≥60% → 판 운 / 주머니만 ≥60% → 뽑기 운 / 둘 다 ≥60% → 둘이 겹친 운 / 나머지 → 덱의 힘
  const cls = (r) => (r.c === 1 ? 'mistake' : r.pA >= 0.6 && r.pB >= 0.6 ? 'both' : r.pA >= 0.6 ? 'board' : r.pB >= 0.6 ? 'bag' : r.pAB >= 0.6 ? 'joint' : r.pA < 0.4 && r.pB < 0.4 && r.pAB < 0.4 ? 'deck' : 'mixed');
  const CLS = [['mistake', '실수(같은 상태에서 세게 두면 이김)'], ['board', '판 운(판만 바꿔 ≥60%)'], ['bag', '뽑기 운(주머니만 바꿔 ≥60%)'], ['both', '판 · 뽑기 어느 쪽만 바꿔도 ≥60%'], ['joint', '둘 다 바꿔야 ≥60%'], ['mixed', '가운데(40~60% 언저리)'], ['deck', '덱의 힘 부족(셋 다 <40%)']];
  const classes = CLS.map(([id, name]) => ({ id, name, ...share((r) => cls(r) === id) }));
  // 기대 몫: 진 대국마다 그 하나만 바꿨을 때 살아날 확률의 평균(판 · 뽑기 · 둘 다), 실수는 0/1
  const byAnte = Array.from({ length: ANTES }, (_, i) => { const x = rows.filter((r) => r.ante === i + 1); return { ante: i + 1, n: x.length, pA: r3(mean(x.map((r) => r.pA))), pB: r3(mean(x.map((r) => r.pB))), pAB: r3(mean(x.map((r) => r.pAB))), c: r3(mean(x.map((r) => r.c))) }; });
  return { n, k: rows[0].n, strong: { mult: args.strong, look: args.look, ...strong }, sources, cb, classes, byAnte,
    noDrop: { a: rows.reduce((x, r) => x + r.noDropA, 0), b: rows.reduce((x, r) => x + r.noDropB, 0), of: rows.reduce((x, r) => x + r.n, 0) },
    list: rows.map((r) => ({ ...r, pA: r3(r.pA), pB: r3(r.pB), pAB: r3(r.pAB), pCB: r3(r.pCB), pBpair: r3(r.pBpair), cls: cls(r) })) };
}
// 상점 운(d): 판마다 상점 난수만 바꾼 판 N번
function analyseShop(smartRuns, shopRuns, args) {
  if (!shopRuns || !shopRuns.length) return null;
  const by = new Map();
  for (const r of shopRuns) { if (!by.has(r.seed)) by.set(r.seed, []); by.get(r.seed).push(r.won ? 1 : 0); }
  const orig = new Map(smartRuns.map((r) => [r.seed, r.won]));
  const per = [...by.entries()].filter(([seed]) => orig.has(seed)).map(([seed, w]) => ({ seed, orig: orig.get(seed) ? 1 : 0, n: w.length, p: mean(w) }));
  const all = per.flatMap((x) => by.get(x.seed));
  const pbar = mean(all);
  // 같은 판 안(상점만 다름) 승패 분산(표본 보정) / 전체 승패 분산
  const within = mean(per.map((x) => (x.n > 1 ? x.p * (1 - x.p) * x.n / (x.n - 1) : 0)));
  const lost = per.filter((x) => !x.orig), won = per.filter((x) => x.orig);
  return { runs: per.length, k: args.shopk, timeouts: shopRuns.timeouts || 0, origWin: r3(mean(per.map((x) => x.orig))), altWin: r3(pbar), altCi: wilson(all.filter(Boolean).length, all.length).map(r3),
    luckShare: r3(within / (pbar * (1 - pbar))),
    lostRescue: r3(mean(lost.map((x) => x.p))), lostHi60: r3(lost.filter((x) => x.p >= 0.6).length / Math.max(1, lost.length)), lostZero: r3(lost.filter((x) => x.p === 0).length / Math.max(1, lost.length)), lostN: lost.length,
    wonKeep: r3(mean(won.map((x) => x.p))), wonN: won.length, sdPerRun: r3(sd(per.map((x) => x.p))), list: per.map((x) => ({ ...x, p: r3(x.p) })) };
}

function report(D, args, wall) {
  const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
  const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  const dw = (x) => [...String(x)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  const table = (cols, rows) => {
    const w = cols.map((c, i) => Math.max(dw(c), ...rows.map((r) => dw(r[i]))));
    const line = (r) => r.map((x, i) => ' '.repeat(w[i] - dw(x)) + x).join('  ');
    console.log(line(cols));
    for (const r of rows) console.log(line(r));
  };
  const ci = (c) => `[${pc(c[0])}, ${pc(c[1])}]`;
  console.log(`판 운 하네스: smart ${D.runs.length}판, seed ${args.seed}, 죽음 K ${args.k}, 이긴 대국 SK ${args.sk} × 몫 ${args.sample}, 상점 K ${args.shopK}${args.peekSkip != null ? ` · 판 보기 건너뛰기 ${args.peekSkip}` : ''} — 전체 ${(wall / 1000).toFixed(0)}s(일꾼 ${args.workers})`);
  console.log(`떠 둔 상태 ${D.snapshots}개, 다시 만든 대국이 원래와 다른 것 ${D.rebuildMismatch}개, 원래 시드를 따로 다시 둔 결과(승패 · 점수)가 판 안과 다른 것 ${D.replayMismatch}개${D.timeouts.length ? `, 시간 초과 ${D.timeouts.length}판(뺐다): ${D.timeouts.join(' ')}` : ''}`);

  console.log(`\n① 판 죽음의 운 비율 — 진 대국 ${D.death.n}개, 같은 상태에서 판만 바꾼 대체 판 승률 평균 ${pc(D.death.meanAltWin)} ${ci(D.death.meanCi)}, 가운데 ${pc(D.death.median)}`);
  console.log(`  대체 판 승률 ≥60%(판 운으로 죽음) ${D.death.luck60.n}개 ${pc(D.death.luck60.share)} ${ci(D.death.luck60.ci)} · <40%(덱이 약해 죽음) ${D.death.weak40.n}개 ${pc(D.death.weak40.share)} ${ci(D.death.weak40.ci)}`);
  table(['대체 판 승률', '죽음', '몫', '95% 구간'], D.death.buckets.map((b) => [b.bucket, String(b.n), pc(b.share), ci(b.ci)]));
  table(['관', '죽음', '대체 승률'], D.death.byAnte.filter((x) => x.n).map((x) => [String(x.ante), String(x.n), pc(x.meanAltWin)]));
  table(['종류', '죽음', '대체 승률'], D.death.byKind.map((x) => [x.kind, String(x.n), pc(x.meanAltWin)]));

  const LA = D.lostAll;
  console.log(`  진 대국 전부(시계를 잃은 대국 포함) ${LA.n}개 · 판당 ${f2(LA.perRun)} · 시계 잃음 판당 ${f2(LA.clockLostPerRun)} · 대체 판 승률 평균 ${pc(LA.meanAltWin)} · ≥60% ${pc(LA.luck60)} · <40% ${pc(LA.weak40)} · 다시 놓기 대국당 ${f2(LA.reboardPerBattle)}`);
  console.log(`  원래 판의 첫 손 점수 백분위(대체 판 사이): 평균 ${f2(D.origPct.mean)} · 사분위 몫 ${D.origPct.quartiles.map(pc).join(' ')} · 진 대국 ${f2(D.origPct.lostMean)} · 이긴 대국 ${f2(D.origPct.wonMean)}`);
  const P = D.perBattle;
  console.log(`\n② 대국마다 이길 확률 — 상태 ${P.states}개 × 대체 판(모두 ${P.altBoards}판). 평균 ${pc(P.meanAll)}, ≥95% 안전 ${pc(P.safe95)}, <80% 위험 ${pc(P.risky80)}`);
  console.log(`  분포(0~10% … 90~100%): ${P.hist.join(' ')}`);
  table(['관', '종류', '상태', '평균', 'sd', 'p10', 'p50'], P.slots.map((s) => [String(s.ante), s.kind, String(s.n), pc(s.mean), f2(s.sd), pc(s.p10), pc(s.p50)]));
  console.log(`  곱의 함정: 24칸 평균 승률의 곱 = ${pc(P.product24)} (실제 smart 판 승률 ${pc(P.actualRunWin)}), 대국당 기하 평균 ${pc(P.geoMean24)}`);
  if (args.sample >= 1) console.log(`  맞춤 확인: 대체 판 승률로 본 기대 판 죽음 ${P.expectedDeaths.toFixed(1)}개 · 실제 ${P.observedDeaths}개`);
  console.log(`  대국당 → 판: ${P.trap.map((t) => `${pc(t.perBattle)} → ${pc(t.run)}`).join(' · ')} | 판 ${P.needFor.map((t) => `${pc(t.run)}에 대국당 ${pc(t.perBattle)}`).join(' · ')}`);

  console.log(`\n③ 점수 분산 나누기(관별, log 목표 없는 점수, 외통 · 오목 판 뺌) — 판 운 몫 = 같은 상태 안 분산 / (안 + 사이). 전체 모아 ${pc(D.luckShareAll)}`);
  table(['관', '상태', '판', '외통 몫', '분산 전체', '안(판 운)', '사이(덱)', '판 운 몫', '판 p90/p10', '덱 p90/p10', '승패 판 운 몫', '평균 승률'],
    D.decomp.map((d) => [String(d.ante), String(d.states), String(d.boards), pc(d.mateShare), f2(d.varTotal), f2(d.varWithin), f2(d.varBetween), pc(d.luckShare), '×' + f2(d.withinP90P10), '×' + f2(d.betweenP90P10), pc(d.winLuckShare), pc(d.winMean)]));

  const F = D.features;
  console.log(`\n④ 나쁜 판(같은 상태 안 점수 하위 20%) · 좋은 판(상위 20%)을 가르는 성질 — 판 ${F.rows}개, 효과 크기 d(같은 상태 안 z), 스피어먼(성질 z ↔ 점수 z)`);
  table(['순위', '성질', 'd', '스피어먼', '나쁜 판 평균', '좋은 판 평균'], F.rank.map((r, i) => [String(i + 1), r.name, f2(r.d), f2(r.spearman), f2(r.rawBad), f2(r.rawGood)]));
  const C = D.corr;
  console.log(`  첫 손 최선 사슬 점수 ↔ 대국 점수: 상관(log, 상태 섞음) ${f2(C.rawLog)} · 같은 상태 안 ${f2(C.within)}(스피어먼 ${f2(C.withinSpearman)}) · 승패 AUC 같은 상태 안 ${f2(C.aucWinWithin)} / 섞음 ${f2(C.aucWinRaw)}`);
  table(['관', '판', 'r(log, 섞음)', 'r(같은 상태 안)', '승패 AUC'], C.byAnte.map((x) => [String(x.ante), String(x.n), f2(x.rawLog), f2(x.within), f2(x.aucWin)]));
  console.log(`  거르기 보기: 같은 상태 안 첫 손 점수 하위 20% 판을 버리면 대체 판 승률 ${pc(D.filterSim.baseWin)} → ${pc(D.filterSim.keptWin)}(남긴 판 ${pc(D.filterSim.keptShare)})`);

  console.log('\n⑤ 정책 사이 차이 — 판 승률(95% 구간) · 관별 통과율(도달한 판 중)');
  table(['정책', '판', '판 승률', '구간', ...Array.from({ length: ANTES }, (_, i) => `${i + 1}관`)],
    Object.entries(D.policies).map(([k, v]) => [k, String(v.runs), pc(v.runWin), ci(v.ci), ...v.survival.map((s) => pc(s.passGivenReached))]));
  table(['정책', ...Array.from({ length: ANTES }, (_, i) => `${i + 1}관 도달`)], Object.entries(D.policies).map(([k, v]) => [k, ...v.survival.map((s) => pc(s.reached))]));

  const S = D.split;
  if (S) {
    console.log(`\n⑥ 운의 출처 — 판을 끝낸 진 대국 ${S.n}개, 하나만 바꿔 K ${S.k}번씩. 판을 깔 때와 다른 손이라 첫 손으로 떨굴 곳이 없던 대체: (a) ${S.noDrop.a} · (b) ${S.noDrop.b} / ${S.noDrop.of}`);
    table(['바꾼 것', '대체 승률 평균', '95% 구간', '≥60%', '<40%', '한 번이라도 이김'], S.sources.map((x) => [x.name, pc(x.mean), ci(x.ci), `${x.hi60.n} ${pc(x.hi60.share)}`, `${x.lo40.n} ${pc(x.lo40.share)}`, `${x.any.n} ${pc(x.any.share)}`]));
    console.log(`  (c) 같은 상태 · 같은 판 · 같은 차례에서 봇만 세게(예산 ×${S.strong.mult}${S.strong.look ? ` · 내다보기 ${S.strong.look}` : ''}): 이긴 진 대국 ${S.strong.n}개 ${pc(S.strong.share)} ${ci(S.strong.ci)}`);
    if (S.cb) console.log(`  (cb) 주머니만 바꾼 대체 ${S.cb.n}개 상태에서: 보통 봇 ${pc(S.cb.baseMean)} → 세게 둔 봇 ${pc(S.cb.strongMean)}`);
    table(['갈래(먼저 맞는 쪽)', '진 대국', '몫', '95% 구간'], S.classes.map((x) => [x.name, String(x.n), pc(x.share), ci(x.ci)]));
    table(['관', '진 대국', '(a) 판만', '(b) 주머니만', '(ab) 둘 다', '(c) 세게'], S.byAnte.filter((x) => x.n).map((x) => [String(x.ante), String(x.n), pc(x.pA), pc(x.pB), pc(x.pAB), pc(x.c)]));
  }
  const H = D.shop;
  if (H) {
    console.log(`\n⑦ 상점 운(d) — smart ${H.runs}판 × 상점 난수만 바꾼 판 ${H.k}번${H.timeouts ? `(시간 초과 ${H.timeouts}판 뺌)` : ''}`);
    console.log(`  원래 판 승률 ${pc(H.origWin)} · 상점만 바꾼 판 승률 ${pc(H.altWin)} ${ci(H.altCi)} · 판마다 승률 sd ${f2(H.sdPerRun)}`);
    console.log(`  판 승패 분산 중 상점 운 몫(같은 판 안 분산 / 전체) ${pc(H.luckShare)}`);
    console.log(`  원래 진 판 ${H.lostN}개: 상점만 바꾸면 이긴 몫 평균 ${pc(H.lostRescue)} · ≥60% ${pc(H.lostHi60)} · 한 번도 못 이김 ${pc(H.lostZero)} | 원래 이긴 판 ${H.wonN}개: 상점만 바꿔도 이긴 몫 ${pc(H.wonKeep)}`);
  }
}

// ── 실행(통계 함수가 모두 선언된 뒤)
if (!isMainThread) {
  const { mode } = workerData;
  applyNight2(workerData.tune);
  if (mode === 'run') {
    SMART.K = workerData.shopK;
    if (workerData.peekSkip != null) PEEK.skipBelow = workerData.peekSkip;
    parentPort.postMessage(oneRun(workerData.seed, workerData.policy, workerData.snaps, workerData.shopAlt ?? null));
  } else {
    parentPort.on('message', (task) => { if (task === 'end') process.exit(0); parentPort.postMessage(measure(task)); });
  }
} else {
  const args = parseArgs(process.argv.slice(2));
  applyNight2(args.tune);
  const t0 = performance.now();
  const say = (s) => process.stderr.write(s);

  // 판: 판 하나에 일꾼 하나(run.mjs처럼), 시간 상한을 넘으면 따로 센다
  // alts > 0이면 판마다 상점 난수만 바꾼 판 alts번(shopAlt 0…alts−1)
  async function runPool(policy, seeds, snaps, alts = 0) {
    const out = [], timeouts = [];
    const jobs = alts > 0 ? seeds.flatMap((seed) => Array.from({ length: alts }, (_, k) => ({ seed, shopAlt: k }))) : seeds.map((seed) => ({ seed, shopAlt: null }));
    let nextI = 0, done = 0;
    await new Promise((finish) => {
      const launch = () => {
        if (nextI >= jobs.length) { if (done === jobs.length) finish(); return; }
        const { seed, shopAlt } = jobs[nextI++];
        const wk = new Worker(SELF, { workerData: { mode: 'run', seed, policy, snaps, shopAlt, shopK: args.shopK, tune: args.tune, peekSkip: args.peekSkip } });
        const timer = setTimeout(() => { timeouts.push(seed); wk.terminate(); }, args.limit * 1000);
        let settled = false;
        const end = () => { if (settled) return; settled = true; clearTimeout(timer); done++; say(`\r${policy}${alts ? ' 상점만 바꾼' : ''} 판 ${done}/${jobs.length} · 시간 초과 ${timeouts.length}   `); launch(); };
        wk.on('message', (m) => out.push(m));
        wk.on('error', (e) => { console.error(`seed ${seed} 오류`, e); end(); });
        wk.on('exit', end);
      };
      for (let i = 0; i < Math.min(args.workers, jobs.length); i++) launch();
    });
    say('\n');
    out.sort((x, y) => seeds.indexOf(x.seed) - seeds.indexOf(y.seed) || (x.shopAlt ?? 0) - (y.shopAlt ?? 0));
    return { runs: out, timeouts };
  }

  // 대체 대국: 오래 사는 일꾼들이 과제를 나눠 받는다
  async function measurePool(tasks) {
    const res = new Array(tasks.length);
    let nextI = 0, done = 0;
    const order = tasks.map((_, i) => i).sort((a, b) => tasks[b].snap.ante - tasks[a].snap.ante); // 무거운 뒤 관부터
    await new Promise((finish) => {
      const n = Math.min(args.workers, tasks.length);
      if (!n) return finish();
      let alive = n;
      for (let w = 0; w < n; w++) {
        const wk = new Worker(SELF, { workerData: { mode: 'measure', tune: args.tune } });
        const feed = () => {
          if (nextI >= order.length) { wk.postMessage('end'); return; }
          const i = order[nextI++];
          wk.postMessage({ ...tasks[i], id: i });
        };
        wk.on('message', (m) => { res[m.id] = m; done++; say(`\r대체 대국 ${done}/${tasks.length}   `); feed(); });
        wk.on('error', (e) => { console.error('측정 오류', e); });
        wk.on('exit', () => { if (--alive === 0) finish(); });
        feed();
      }
    });
    say('\n');
    return res;
  }

  const seeds = runSeeds(args.seed, args.runs);
  const smart = await runPool('smart', seeds, true);
  const tasks = [];
  for (const r of smart.runs) {
    r.snaps.forEach((snap, i) => {
      const row = r.log.filter((x) => !x.skipped)[i];
      const death = !r.won && i === r.snaps.length - 1;
      // 시계(밤샘 2 D1): 진 대국이 판을 끝내지 않을 수 있다. lost = 진 대국 전부, death = 판을 끝낸 대국
      const lost = !!row && !row.won;
      if (!lost && !sampled(r.seed, snap.ante, snap.blind, args.sample)) return;
      tasks.push({ snap, n: lost ? args.k : args.sk, split: args.split && death ? { strong: args.strong, look: args.look, ck: args.ck } : null, meta: { seed: r.seed, ante: snap.ante, blind: snap.blind, kind: KINDS[snap.blind], master: row && row.master, death, lost, actualWon: row ? row.won : null, actualScore: row ? row.score : null, target: row && row.target } });
    });
  }
  const alts = await measurePool(tasks.map((t) => ({ snap: t.snap, n: t.n, split: t.split })));
  const states = tasks.map((t, i) => ({ ...t.meta, alts: alts[i].alts, origWon: alts[i].origWon, origScore: alts[i].origScore, origPct: alts[i].origPct, split: alts[i].split || null }));
  const others = {};
  for (const p of ['random', 'none']) if (args.policies > 0) others[p] = await runPool(p, runSeeds(args.seed, args.policies), false);
  if (args.shopk > 0) {
    const sh = await runPool('smart', seeds, false, args.shopk);
    others.__shop = Object.assign(sh.runs, { timeouts: sh.timeouts.length });
  }
  const wall = performance.now() - t0;
  const data = analyse(args, smart, states, others);
  report(data, args, wall);
  if (args.json) { mkdirSync(dirname(args.json), { recursive: true }); writeFileSync(args.json, JSON.stringify(data, null, 1) + '\n'); console.log(`JSON: ${args.json}`); }
}
