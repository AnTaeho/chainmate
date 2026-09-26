// 판(런) 하네스: 판을 N개 끝까지 돌려 곡선을 잰다.
//   node tools/run.mjs --runs 1000 --policy smart|hunt|random|none --seed 1 [--workers 10] [--k 6]
// 대국 안은 풀이기 봇(tools/bot.mjs), 상점은 tools/shopbot.mjs의 정책.
// 찍는 것: 판 승률, 관 도달 분포, 관별 대국 점수/목표, 종류별 통과율, 외통 · 첫수외통 · 막힘 비율,
//          명인별 통과율, 많이 산 격언과 산 판의 승률, 관별 최고 한 수, 판당 ms.
//          2b: 불멸의 기보(전설 완성률 · 조각 · 명국별 · 전설 판 승률), 황금 기물, 명인의 상자, 판본, 사슬 평가, 넘친 목표 층.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createRun, B, targetFor, REWARD, CHEST } from '../src/sim/run.js';
import { GOLDEN } from '../src/sim/battle.js';
import { SHOP } from '../src/sim/shop.js';
import { playRun, SMART } from './shopbot.mjs';
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { MASTER_BY_ID } from '../src/data/masters.js';
import { LEGENDS, LEGEND_BY_ID } from '../src/data/legends.js';
import { EDITIONS } from '../src/data/editions.js';

function parseArgs(argv) {
  const a = { runs: 200, policy: 'smart', seed: 1, workers: 10, k: SMART.K };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--runs') a.runs = Number(argv[++i]);
    else if (k === '--policy') a.policy = argv[++i];
    else if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--workers') a.workers = Number(argv[++i]);
    else if (k === '--k') a.k = Number(argv[++i]);
    else if (k === '--B') a.B = argv[++i].split(',').map(Number);       // 실험: 목표 기준 덮어쓰기
    else if (k === '--shop') a.shop = JSON.parse(argv[++i]);            // 실험: 상점 수치 덮어쓰기(JSON)
    else if (k === '--tune') a.tune = JSON.parse(argv[++i]);            // 실험: {"overflow":{…},"chest":[[1,77],…],"golden":0.04}
  }
  return a;
}

function one(seed, policy) {
  const t0 = performance.now();
  const run = createRun({ seed });
  const { bought, editions, legendAt, seen } = playRun(run, policy);
  return {
    seed, won: run.phase === 'won', ante: run.ante, blind: run.blind,
    log: run.log, bought, final: run.maxims.filter((m) => !m.legendary).map((m) => m.id), money: run.money,
    fragments: run.fragments, legends: run.legends, legendAt, editions, seen,
    deck: run.deck.map((p) => p.t + (p.eng ? ':' + p.eng.id : '')).sort().join(' '),
    charts: Object.values(run.charts).reduce((a, x) => a + x, 0), deckSize: run.deck.length,
    ms: performance.now() - t0,
  };
}

if (!isMainThread) {
  const { seeds, policy, k, B: b, shop, tune } = workerData;
  if (tune && tune.overflow) REWARD.overflow = tune.overflow;
  if (tune && tune.chest) CHEST.counts = tune.chest;
  if (tune && tune.golden != null) GOLDEN.chance = tune.golden;
  SMART.K = k;
  if (b) b.forEach((x, i) => { B[i] = x; });
  if (shop) Object.assign(SHOP, shop);
  const out = [];
  for (const s of seeds) out.push(one(s, policy));
  parentPort.postMessage(out);
} else {
  const args = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: args.runs }, (_, i) => (args.seed * 1000003 + i * 7919) >>> 0);
  const t0 = performance.now();
  const chunks = Array.from({ length: args.workers }, (_, w) => seeds.filter((_, i) => i % args.workers === w));
  const results = (await Promise.all(chunks.filter((c) => c.length).map((c) => new Promise((res, rej) => {
    const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds: c, policy: args.policy, k: args.k, B: args.B, shop: args.shop, tune: args.tune } });
    wk.on('message', res);
    wk.on('error', rej);
  })))).flat();
  report(results, args, performance.now() - t0);
}

function report(R, args, wall) {
  const n = R.length;
  const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
  const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '-');
  const dw = (x) => [...String(x)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
  const table = (cols, rows) => {
    const w = cols.map((c, i) => Math.max(dw(c), ...rows.map((r) => dw(r[i]))));
    const line = (r) => r.map((x, i) => ' '.repeat(w[i] - dw(x)) + x).join('  ');
    console.log(line(cols));
    for (const r of rows) console.log(line(r));
  };
  const pctile = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };

  const wins = R.filter((r) => r.won).length;
  console.log(`B [${B.map((x, i) => (args.B && args.B[i] != null ? args.B[i] : x)).join(', ')}]${args.shop ? ' 상점 ' + JSON.stringify(args.shop) : ''}${args.tune ? ' 조정 ' + JSON.stringify(args.tune) : ''}`);
  console.log(`판 ${n}개, 정책 ${args.policy}, seed ${args.seed}, K ${args.k} — 판 승률 ${pc(wins / n)}, 판당 ${f(R.reduce((a, r) => a + r.ms, 0) / n, 0)}ms(일꾼 ${args.workers}, 전체 ${(wall / 1000).toFixed(1)}s)`);

  // 관별
  const rows = [];
  const battles = R.flatMap((r) => r.log.filter((x) => !x.skipped));
  for (let ante = 1; ante <= 8; ante++) {
    const reached = R.filter((r) => r.won || r.ante >= ante).length;
    const cleared = R.filter((r) => r.won || r.ante > ante).length;
    const bs = battles.filter((b) => b.ante === ante);
    const ratio = bs.filter((b) => b.reason !== 'mate').map((b) => b.score / b.target);
    const byKind = (k) => { const x = bs.filter((b) => b.kind === k); return x.length ? x.filter((b) => b.won).length / x.length : NaN; };
    const mates = bs.filter((b) => b.reason === 'mate');
    const bests = bs.map((b) => b.best);
    rows.push([
      String(ante), pc(reached / n), pc(cleared / n), String(bs.length),
      pc(byKind('practice')), pc(byKind('official')), pc(byKind('master')),
      f(pctile(ratio, 0.1), 2), f(pctile(ratio, 0.25), 2), f(pctile(ratio, 0.5), 2), f(pctile(ratio, 0.9), 2),
      pc(mates.length / bs.length), pc(mates.filter((b) => b.moves === 1).length / bs.length),
      pc(bs.filter((b) => b.reason === 'stuck').length / bs.length),
      String(pctile(bests, 0.5)), String(pctile(bests, 0.9)), String(Math.max(0, ...bests)),
      String(targetFor(ante, 'practice')),
    ]);
  }
  table(['관', '도달', '통과', '대국', '연습', '정식', '명인', '점수/목표p10', 'p25', 'p50', 'p90', '외통', '첫수외통', '막힘', '최고수p50', 'p90', '최고', '연습목표'], rows);
  console.log(`판 끝의 평균: 기보 레벨 합 ${f(R.reduce((a, r) => a + r.charts, 0) / n, 1)}, 주머니 ${f(R.reduce((a, r) => a + r.deckSize, 0) / n, 1)}개, 격언 ${f(R.reduce((a, r) => a + r.final.length, 0) / n, 1)}개, 남은 상금 ${f(R.reduce((a, r) => a + r.money, 0) / n, 1)}`);
  const allMates = battles.filter((b) => b.reason === 'mate').length;
  const lostBy = {};
  for (const r of R) if (!r.won) { const last = r.log.at(-1); lostBy[last.reason] = (lostBy[last.reason] || 0) + 1; }
  console.log(`전체 대국 ${battles.length}: 외통으로 이김 ${pc(allMates / battles.length)}, 막힘 패배 ${pc(battles.filter((b) => b.reason === 'stuck').length / battles.length)}. 판이 끝난 이유: ${Object.entries(lostBy).map(([k, v]) => `${k} ${pc(v / n)}`).join(', ')}`);

  // 명인
  const mrows = [];
  for (const id of Object.keys(MASTER_BY_ID)) {
    const bs = battles.filter((b) => b.master === id);
    if (!bs.length) continue;
    mrows.push([MASTER_BY_ID[id].name, String(bs.length), pc(bs.filter((b) => b.won).length / bs.length), f(bs.reduce((a, b) => a + b.ante, 0) / bs.length, 1)]);
  }
  table(['명인', '대국', '통과', '평균관'], mrows);

  // ── 2b: 불멸의 기보
  const withLegend = R.filter((r) => r.legends.length);
  const noLegend = R.filter((r) => !r.legends.length);
  const parts = { first: 0, feat: 0, gold: 0 };
  let anyFirst = 0, two = 0;
  for (const r of R) {
    let best = 0;
    for (const f of Object.values(r.fragments)) {
      for (const k of Object.keys(parts)) if (f[k]) parts[k]++;
      best = Math.max(best, (f.first ? 1 : 0) + (f.feat ? 1 : 0) + (f.gold ? 1 : 0));
    }
    if (best >= 1) anyFirst++;
    if (best >= 2) two++;
  }
  console.log(`\n불멸의 기보: 전설 완성 ${pc(withLegend.length / n)} (${withLegend.length}판), 첫 조각을 가진 판 ${pc(anyFirst / n)}, 두 조각 이상 ${pc(two / n)}. 판당 조각 수: 첫 ${f(parts.first / n, 2)} · 재현 ${f(parts.feat / n, 2)} · 금빛 ${f(parts.gold / n, 2)}`);
  console.log(`  전설 판 승률 ${pc(withLegend.filter((r) => r.won).length / withLegend.length)} (전설 없는 판 ${pc(noLegend.filter((r) => r.won).length / noLegend.length)}), 완성한 관 평균 ${f(withLegend.reduce((a, r) => a + (r.legendAt || 0), 0) / withLegend.length, 1)}`);
  table(['명국', '첫', '재현', '금빛', '완성', '완성 판 승률'], LEGENDS.map((l) => {
    const has = (k) => R.filter((r) => r.fragments[l.id] && r.fragments[l.id][k]).length;
    const done = R.filter((r) => r.legends.includes(l.id));
    return [l.name, String(has('first')), String(has('feat')), String(has('gold')), String(done.length), pc(done.filter((r) => r.won).length / done.length)];
  }));
  const seenSum = (k) => R.reduce((a, r) => a + (r.seen[k] || 0), 0);
  console.log(`  첫 조각이 보인 곳: 진열 ${seenSum('fragDisplay')}번(진열 칸 ${seenSum('slots')}), 꾸러미 ${seenSum('fragPack')}번(연 꾸러미 ${seenSum('packs')}), 금빛 꾸러미 ${seenSum('golden')}개 엶`);

  // ── 황금 기물 · 상자 · 판본 · 사슬 평가 · 넘친 목표
  const gSeen = battles.filter((b) => b.goldenSeen).length, gGot = battles.filter((b) => b.golden > 0).length;
  console.log(`황금 기물: 나온 대국 ${pc(gSeen / battles.length)}, 먹은 대국 ${pc(gGot / battles.length)} (나온 것 중 ${pc(gGot / gSeen)}), 먹은 판 ${pc(R.filter((r) => r.log.some((b) => b.golden > 0)).length / n)}`);
  const chests = battles.filter((b) => b.chest);
  const cc = (k) => chests.filter((b) => b.chest === k).length;
  console.log(`명인의 상자 ${chests.length}개: 1개 ${pc(cc(1) / chests.length)} · 3개 ${pc(cc(3) / chests.length)} · 5개 ${pc(cc(5) / chests.length)}`);
  const edSeen = {}; for (const r of R) for (const [k, v] of Object.entries(r.seen.editions || {})) edSeen[k] = (edSeen[k] || 0) + v;
  const maximsSeen = seenSum('maxims'), slots = seenSum('slots');
  const edTotal = Object.values(edSeen).reduce((a, x) => a + x, 0);
  const edBought = {}; for (const r of R) for (const e of r.editions) edBought[e] = (edBought[e] || 0) + 1;
  console.log(`판본: 진열 격언 ${maximsSeen}개 중 ${pc(edTotal / maximsSeen)} (칸당 ${pc(edTotal / slots)}) — ${EDITIONS.map((e) => `${e.name} ${edSeen[e.id] || 0}/산 ${edBought[e.id] || 0}`).join(' · ')}. 판본 격언을 가진 판 ${pc(R.filter((r) => r.editions.length).length / n)}`);
  const chains = battles.reduce((a, b) => a + b.moves, 0);
  const gr = {}; for (const b of battles) for (const [k, v] of Object.entries(b.grades || {})) gr[k] = (gr[k] || 0) + v;
  console.log(`사슬 평가(사슬 ${chains}): ${['!', '!!', '!!!', '∞'].map((k) => `「${k}」 ${gr[k] || 0} (${pc((gr[k] || 0) / chains)})`).join(' · ')}`);
  const wonB = battles.filter((b) => b.won);
  const ov = (t) => wonB.filter((b) => b.overflow === t).length;
  console.log(`넘친 목표(이긴 대국 ${wonB.length}): ×1 ${pc(ov(1) / wonB.length)} · ×2 ${pc(ov(2) / wonB.length)} · ×5 ${pc(ov(5) / wonB.length)} · ×10 ${pc(ov(10) / wonB.length)} · 목표 밑(외통) ${pc(ov(0) / wonB.length)}`);

  // 격언
  if (args.policy !== 'none') {
    const cnt = {};
    for (const r of R) for (const id of r.bought) { cnt[id] = cnt[id] || { n: 0, w: 0 }; cnt[id].n++; if (r.won) cnt[id].w++; }
    const top = Object.entries(cnt).sort((a, b) => b[1].n - a[1].n);
    table(['격언', '산 판', '그 판 승률'], top.map(([id, c]) => [(MAXIM_BY_ID[id] || LEGEND_BY_ID[id]).name, pc(c.n / n), pc(c.w / c.n)]));
    const winners = R.filter((r) => r.won).slice(0, 5);
    for (const r of winners) console.log(`  이긴 판 예 seed ${r.seed}: 격언 [${r.final.map((id) => MAXIM_BY_ID[id].name).join(', ')}]${r.legends.length ? ' 전설 [' + r.legends.map((id) => LEGEND_BY_ID[id].name).join(', ') + ']' : ''} 주머니 [${r.deck}]`);
  }
}
