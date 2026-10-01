// 판(런) 하네스: 판을 N개 끝까지 돌려 곡선을 잰다.
//   node tools/run.mjs --runs 1000 --policy smart|hunt|random|none|nosac --seed 1 [--workers 10] [--k 6]
//   nosac: smart 상점 + 희생을 쓰지 않는 대국 봇(옛 버리기 봇, CHM-35 비교용). --tune '{"sac":"B"}': 희생 세기 후보(battle.js SACRIFICE)
// 대국 안은 풀이기 봇(tools/bot.mjs), 상점은 tools/shopbot.mjs의 정책.
// 찍는 것: 판 승률, 관 도달 분포, 관별 대국 점수/목표, 종류별 통과율, 외통 · 첫수외통 · 막힘 비율,
//          명인별 통과율, 많이 산 격언과 산 판의 승률, 관별 최고 한 수, 판당 ms.
//          2b: 불멸의 기보(전설 완성률 · 조각 · 명국별 · 전설 판 승률), 황금 기물, 명인의 상자, 판본, 사슬 평가, 넘친 목표 층.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRun, B, targetFor, REWARD, CHEST } from '../src/sim/run.js';
import { applyNight2 } from './night2.mjs';
import { GOLDEN } from '../src/sim/battle.js';
import { SHOP } from '../src/sim/shop.js';
import { playRun, SMART, DRAFT } from './shopbot.mjs';
import { JOSEKIS, DRAFT_ANTES } from '../src/data/josekis.js';
import { SOULS, SOUL_BY_ID, SOUL_RARITY, RARITY_NAME } from '../src/data/souls.js';
import { MAXIM_BY_ID } from '../src/data/maxims.js';
import { MASTER_BY_ID } from '../src/data/masters.js';
import { FACTIONS, FACTION_BY_ID } from '../src/data/factions.js';
import { LEGENDS, LEGEND_BY_ID } from '../src/data/legends.js';
import { EDITIONS } from '../src/data/editions.js';
import { familyCounts, FAMILIES } from '../src/data/families.js';
import { PIECES, FAIRIES } from '../src/data/pieces.js';

function parseArgs(argv) {
  const a = { runs: 200, policy: 'smart', seed: 1, workers: 10, k: SMART.K, limit: 120 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--runs') a.runs = Number(argv[++i]);
    else if (k === '--policy') a.policy = argv[++i];
    else if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--workers') a.workers = Number(argv[++i]);
    else if (k === '--k') a.k = Number(argv[++i]);
    else if (k === '--B') a.B = argv[++i].split(',').map(Number);       // 실험: 목표 기준 덮어쓰기
    else if (k === '--shop') a.shop = JSON.parse(argv[++i]);            // 실험: 상점 수치 덮어쓰기(JSON)
    else if (k === '--tune') a.tune = JSON.parse(argv[++i]);
    else if (k === '--opening') a.opening = argv[++i];                  // 오프닝(판 밖 해금)
    else if (k === '--dan') a.dan = Number(argv[++i]);                   // 단(난이도) 0~8
    else if (k === '--give') a.give = argv[++i].split(',');
    else if (k === '--nodraft') a.nodraft = true;
    else if (k === '--limit') a.limit = Number(argv[++i]);             // 판 하나 시간 상한(초)
    else if (k === '--quiet') a.quiet = true;
    else if (k === '--json') a.json = argv[++i];                       // 수치를 JSON으로도(밤샘 2 보고서 · 아티팩트용)                          // 정석 드래프트 없이(깊이 E 이전)
    else if (k === '--joseki') a.joseki = argv[++i];                       // 이 정석이 보이면 고른다              // 실험: 판 시작에 격언을 쥐여 준다(값 재기)            // 실험: {"overflow":{…},"chest":[[1,77],…],"golden":0.04}
  }
  return a;
}

function one(seed, policy, opening = undefined, dan = 0, give = null, nodraft = false) {
  const t0 = performance.now();
  const run = createRun({ seed, opening, dan, draft: !nodraft });
  for (const id of give || []) run.maxims.push({ uid: run.nextUid++, id, data: {}, edition: null, paid: 0 });
  const { bought, editions, legendAt, seen } = playRun(run, policy);
  return {
    seed, won: run.phase === 'won', ante: run.ante, blind: run.blind,
    log: run.log, bought, final: run.maxims.filter((m) => !m.legendary).map((m) => m.id), money: run.money,
    fragments: run.fragments, legends: run.legends, legendAt, editions, seen,
    deck: run.deck.map((p) => p.t + (p.eng ? ':' + p.eng.id : '')).sort().join(' '),
    charts: Object.values(run.charts).reduce((a, x) => a + x, 0), deckSize: run.deck.length,
    fam: familyCounts(run), josekis: run.josekis || [], fairies: [...new Set(run.deck.filter((p) => PIECES[p.t].fairy).map((p) => p.t))],
    best: Math.max(0, ...run.log.filter((x) => !x.skipped).map((x) => x.best || 0)),
    // 혼 등급 · 각성(CHM-17): 판 동안 주머니에 있던 혼 · 금이 간 때 · 깨어난 때와 길
    souls: [...new Set(run.log.flatMap((b) => b.souls || []))], cracked: run.cracked || [], awakened: run.awakened || [],
    ms: performance.now() - t0,
  };
}

if (!isMainThread) {
  const { seeds, policy, k, B: b, shop, tune, opening, dan, give, nodraft, joseki } = workerData;
  if (joseki) DRAFT.pick = joseki;
  if (tune && tune.overflow) REWARD.overflow = tune.overflow;
  if (tune && tune.chest) CHEST.counts = tune.chest;
  if (tune && tune.chestItems) CHEST.items = tune.chestItems;
  if (tune && tune.masterBase != null) REWARD.base.master = tune.masterBase;
  if (tune && tune.chestMoney != null) CHEST.money = tune.chestMoney;
  if (tune && tune.golden != null) GOLDEN.chance = tune.golden;
  if (tune && tune.calling != null) GOLDEN.calling = tune.calling;
  // 밤샘 2 D4: 장치를 하나씩 켜 보며 잰다 {"clock":1,"reboard":false,"filter":0,"reboardRatio":1}
  applyNight2(tune);
  SMART.K = k;
  if (policy === 'nofam') SMART.famAware = false;
  if (b) b.forEach((x, i) => { B[i] = x; });
  if (shop) Object.assign(SHOP, shop);
  const out = [];
  for (const s of seeds) out.push(one(s, policy, opening, dan || 0, give, nodraft));
  parentPort.postMessage(out);
} else {
  const args = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: args.runs }, (_, i) => (args.seed * 1000003 + i * 7919) >>> 0);
  const t0 = performance.now();
  // 판 하나에 일꾼 하나: 시간 상한(--limit 초, 기본 120)을 넘으면 그 일꾼을 끊고 「시간 초과」로 따로 센다
  const data = { policy: args.policy, k: args.k, B: args.B, shop: args.shop, tune: args.tune, opening: args.opening, dan: args.dan, give: args.give, nodraft: args.nodraft, joseki: args.joseki };
  const results = [], timeouts = [];
  let next = 0, done = 0;
  await new Promise((finish) => {
    const launch = () => {
      if (next >= seeds.length) { if (done === seeds.length) finish(); return; }
      const seed = seeds[next++];
      const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { ...data, seeds: [seed] } });
      const timer = setTimeout(() => { timeouts.push(seed); wk.terminate(); }, args.limit * 1000);
      let settled = false;
      const end = () => { if (settled) return; settled = true; clearTimeout(timer); done++; if (!args.quiet) process.stderr.write(`\r판 ${done}/${seeds.length} · 시간 초과 ${timeouts.length}   `); launch(); };
      wk.on('message', (m) => { results.push(...m); });
      wk.on('error', (e) => { console.error(`seed ${seed} 오류`, e); end(); });
      wk.on('exit', end);
    };
    for (let i = 0; i < Math.min(args.workers, seeds.length); i++) launch();
  });
  process.stderr.write('\n');
  args.timeouts = timeouts;
  report(results, args, performance.now() - t0);
}

function report(R, args, wall) {
  const n = R.length;
  const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
  const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '-');
  const f2 = (x) => f(x, 2);
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
  if (args.timeouts && args.timeouts.length) console.log(`시간 초과 ${args.timeouts.length}판(${args.limit}초, 표에서 뺐다): seed ${args.timeouts.join(' ')}`);
  console.log(`판 ${n}개, 정책 ${args.policy}, seed ${args.seed}, K ${args.k}${args.opening ? ', 오프닝 ' + args.opening : ''}${args.dan ? ', 단 ' + args.dan : ''}${args.give ? ', 쥐여 줌 ' + args.give.join(',') : ''} — 판 승률 ${pc(wins / n)}, 판당 ${f(R.reduce((a, r) => a + r.ms, 0) / n, 0)}ms(일꾼 ${args.workers}, 전체 ${(wall / 1000).toFixed(1)}s)`);

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
  // 시계 · 다시 놓기(밤샘 2)
  const clk = R.map((r) => r.log.filter((x) => x.clockLost).length);
  const wonR = R.filter((r) => r.won);
  const lostKinds = {}; for (const b of battles) if (b.clockLost) lostKinds[b.kind] = (lostKinds[b.kind] || 0) + 1;
  console.log(`시계: 판당 잃은 칸 ${f2(clk.reduce((a, x) => a + x, 0) / n)} (0칸 ${pc(clk.filter((x) => x === 0).length / n)} · 1칸 ${pc(clk.filter((x) => x === 1).length / n)} · 2칸 ${pc(clk.filter((x) => x === 2).length / n)} · 3칸+ ${pc(clk.filter((x) => x >= 3).length / n)}), 이긴 판 중 시계를 쓴 판 ${pc(wonR.filter((r) => r.log.some((x) => x.clockLost)).length / Math.max(1, wonR.length))}, 잃은 대국 종류 ${Object.entries(lostKinds).map(([k, v]) => `${k} ${v}`).join(' · ')}. 다시 놓기 대국당 ${f2(battles.reduce((a, b) => a + (b.reboards || 0), 0) / battles.length)}`);
  const allMates = battles.filter((b) => b.reason === 'mate').length;
  // 희생(CHM-35, 기록 칸 이름은 옛 discarded): 대국당 바친 기물 수
  const disc = battles.map((b) => b.discarded || 0);
  const dshare = (k) => pc(disc.filter((x) => (k >= 3 ? x >= 3 : x === k)).length / battles.length);
  console.log(`희생: 대국당 ${f2(disc.reduce((a, x) => a + x, 0) / battles.length)}번 (0번 ${dshare(0)} · 1번 ${dshare(1)} · 2번 ${dshare(2)} · 3번+ ${dshare(3)}), 이긴 대국 ${f2(disc.filter((_, i) => battles[i].won).reduce((a, x) => a + x, 0) / Math.max(1, battles.filter((b) => b.won).length))} · 진 대국 ${f2(disc.filter((_, i) => !battles[i].won).reduce((a, x) => a + x, 0) / Math.max(1, battles.filter((b) => !b.won).length))}`);
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

  // ── 세력(docs/design-notes/factions.md): 세력별 대국 통과율 · 명인 통과율의 관 보정 · 관별 가장 많이 입은 모습
  const fx = factionStats(battles);
  console.log('\n세력: 종류별 통과율 · 명인 관 보정(같은 관 모든 세력 명인 통과율과의 차, 평균) · 평균관');
  table(['세력', '대국', '연습', '정식', '명인', '명인 대국', '관 보정', '평균관', '입은 모습(몫 큰 셋)'], fx.rows.map((x) => [
    x.name, String(x.n), pc(x.practice.win), pc(x.official.win), pc(x.master.win), String(x.master.n), x.adj == null ? '-' : (x.adj >= 0 ? '+' : '') + (100 * x.adj).toFixed(1) + '%p', f(x.ante, 1),
    x.worn.slice(0, 3).map(([t, v]) => `${PIECES[t].name} ${(100 * v).toFixed(0)}%`).join(' · '),
  ]));
  console.log('관별 가장 많이 입은 모습(세력 · 그 모습의 몫 · 사슬로 먹은 수)');
  table(['관', ...FACTIONS.map((x) => x.name)], fx.byAnte.map((row) => [String(row.ante), ...FACTIONS.map((x) => { const c = row.f[x.id]; return c ? `${PIECES[c.top].name} ${(100 * c.share).toFixed(0)}%/${c.n}` : '-'; })]));

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

  // ── 깊이: 가족 · 이형
  const famRows = FAMILIES.map((f) => {
    const dom = R.filter((r) => { const top = Math.max(...Object.values(r.fam)); return top >= 2 && r.fam[f.id] === top; });
    const on = R.filter((r) => r.fam[f.id] >= 2);
    return [f.name, String(dom.length), pc(dom.filter((r) => r.won).length / dom.length), String(on.length), pc(on.filter((r) => r.won).length / on.length), f2(R.reduce((a, r) => a + r.fam[f.id], 0) / n)];
  });
  const noFam = R.filter((r) => Math.max(...Object.values(r.fam)) < 2);
  console.log(`\n가족(판 끝): 가장 많이 모은 가족별 판 승률 · 문턱 2 이상 판 승률 — 가족 없음(모두 2 미만) ${noFam.length}판 승률 ${pc(noFam.filter((r) => r.won).length / noFam.length)}`);
  table(['가족', '으뜸 판', '승률', '2 이상 판', '승률', '평균 수'], famRows);
  const fr = FAIRIES.map((t) => { const has = R.filter((r) => r.fairies.includes(t)); return [PIECES[t].name, pc(has.length / n), pc(has.filter((r) => r.won).length / has.length)]; });
  const anyF = R.filter((r) => r.fairies.length);
  console.log(`이형(판 끝 주머니): 하나라도 가진 판 ${pc(anyF.length / n)} 승률 ${pc(anyF.filter((r) => r.won).length / anyF.length)} · 없는 판 승률 ${pc(R.filter((r) => !r.fairies.length && r.won).length / (n - anyF.length))} · 판 최고 한 수 p50 이형 ${pctile(anyF.map((r) => r.best), 0.5)} / 없음 ${pctile(R.filter((r) => !r.fairies.length).map((r) => r.best), 0.5)}`);
  table(['이형', '가진 판', '그 판 승률'], fr);
  if (!args.nodraft) {
    // 외통 = 정석을 고른 뒤(1 · 3 · 5관부터)의 대국 중 외통으로 이긴 몫
    const afterJ = (r, id) => { const k = r.josekis.indexOf(id); return r.log.filter((b) => !b.skipped && b.ante >= DRAFT_ANTES[k]); };
    const jr = JOSEKIS.map((j) => { const has = R.filter((r) => r.josekis.includes(j.id)); const first = R.filter((r) => r.josekis[0] === j.id); const bs = has.flatMap((r) => afterJ(r, j.id)); return [j.name, j.tier, pc(has.length / n), pc(has.filter((r) => r.won).length / has.length), String(bs.length), pc(bs.filter((b) => b.reason === 'mate').length / bs.length), String(first.length), pc(first.filter((r) => r.won).length / first.length)]; });
    console.log('정석: 고른 판 · 그 판 승률 · 고른 뒤 대국 · 그중 외통 · 첫 정석으로 고른 판 · 그 판 승률');
    table(['정석', '등급', '고른 판', '승률', '대국', '외통', '첫 정석', '승률'], jr);
  }

  // 혼: 그 혼이 주머니에 있던 대국 · 그중 외통 · 그 혼의 사슬이 낸 외통 · 그 혼을 한 번이라도 가진 판의 승률
  {
    const all = battles;
    const sr = SOULS.map((s) => {
      const bs = all.filter((b) => (b.souls || []).includes(s.id));
      const runs = R.filter((r) => r.log.some((b) => (b.souls || []).includes(s.id)));
      return [s.name, String(runs.length), pc(runs.filter((r) => r.won).length / runs.length), String(bs.length), pc(bs.filter((b) => b.reason === 'mate').length / bs.length), pc(bs.filter((b) => b.mateSoul === s.id).length / bs.length)];
    });
    const none = all.filter((b) => !(b.souls || []).length);
    console.log(`혼: 가진 판 · 그 판 승률 · 혼이 주머니에 있던 대국 · 그중 외통 · 그 혼의 사슬이 낸 외통 — 혼 없는 대국 ${none.length} 외통 ${pc(none.filter((b) => b.reason === 'mate').length / none.length)}`);
    table(['혼', '가진 판', '승률', '대국', '외통', '혼이 낸 외통'], sr);
  }

  // 혼 등급 · 각성(CHM-17): 등급별로 그 등급 혼을 가진 판 · 그 판 승률, 금이 간 판 · 깨어난 판 · 그 판 승률 · 깨운 길
  const soulFx = {};
  {
    const has = (r, rar) => r.souls.some((id) => SOUL_BY_ID[id].rarity === rar);
    const rows = Object.keys(SOUL_RARITY).map((rar) => { const on = R.filter((r) => has(r, rar)); soulFx[rar] = { runs: on.length, win: on.length ? on.filter((r) => r.won).length / on.length : null }; return [RARITY_NAME[rar], `${SOUL_RARITY[rar].weight} · $${SOUL_RARITY[rar].price}`, String(on.length), pc(on.length / n), pc(on.filter((r) => r.won).length / on.length)]; });
    const none = R.filter((r) => !r.souls.length);
    rows.push(['혼 없음', '', String(none.length), pc(none.length / n), pc(none.filter((r) => r.won).length / none.length)]);
    console.log('\n혼 등급: 그 등급 혼을 가진 판(대국 때 주머니) · 그 판 승률');
    table(['등급', '무게 · 값', '판', '몫', '승률'], rows);
    const cr = R.filter((r) => r.cracked.length), aw = R.filter((r) => r.awakened.length);
    const src = {};
    for (const r of R) for (const a of r.awakened) src[a.src] = (src[a.src] || 0) + 1;
    const byAnte = aw.map((r) => r.awakened[0].ante).sort((a, b) => a - b);
    console.log(`각성: 금이 간 판 ${cr.length} (${pc(cr.length / n)}) 승률 ${pc(cr.filter((r) => r.won).length / cr.length)} · 깨어난 판 ${aw.length} (${pc(aw.length / n)}) 승률 ${pc(aw.filter((r) => r.won).length / aw.length)} · 안 깨어난 판 승률 ${pc(R.filter((r) => !r.awakened.length && r.won).length / (n - aw.length))} · 깨운 길 ${JSON.stringify(src)} · 첫 각성 관 p50 ${byAnte.length ? byAnte[Math.floor(byAnte.length / 2)] : '-'} · 첫 금 관 p50 ${cr.length ? cr.map((r) => r.cracked[0].ante).sort((a, b) => a - b)[Math.floor(cr.length / 2)] : '-'}`);
    const awSoul = {};
    for (const r of R) for (const a of r.awakened) awSoul[a.soul] = (awSoul[a.soul] || 0) + 1;
    if (aw.length) console.log(`  깨어난 혼: ${Object.entries(awSoul).sort((a, b) => b[1] - a[1]).map(([id, k]) => `${SOUL_BY_ID[id].name} ${k}`).join(' · ')}`);
    Object.assign(soulFx, { crackedRuns: cr.length, crackedWin: cr.length ? cr.filter((r) => r.won).length / cr.length : null, awakenedRuns: aw.length, awakenedWin: aw.length ? aw.filter((r) => r.won).length / aw.length : null, awakenSrc: src, awakenedSouls: awSoul });
  }

  // 격언
  if (args.policy !== 'none') {
    const cnt = {};
    for (const r of R) for (const id of r.bought) { cnt[id] = cnt[id] || { n: 0, w: 0 }; cnt[id].n++; if (r.won) cnt[id].w++; }
    const top = Object.entries(cnt).sort((a, b) => b[1].n - a[1].n);
    table(['격언', '산 판', '그 판 승률'], top.map(([id, c]) => [(MAXIM_BY_ID[id] || LEGEND_BY_ID[id]).name, pc(c.n / n), pc(c.w / c.n)]));
    const winners = R.filter((r) => r.won).slice(0, 5);
    for (const r of winners) console.log(`  이긴 판 예 seed ${r.seed}: 격언 [${r.final.map((id) => MAXIM_BY_ID[id].name).join(', ')}]${r.legends.length ? ' 전설 [' + r.legends.map((id) => LEGEND_BY_ID[id].name).join(', ') + ']' : ''} 주머니 [${r.deck}]`);
  }
  // ── JSON(--json): 관별 통과율 · 종류별 · 점수/목표 분포 · 시계 · 새것별 산 판 승률
  if (args.json) {
    const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
    const EDGES = [0, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 20, 50, Infinity];
    const hist = (xs) => EDGES.slice(0, -1).map((lo, i) => xs.filter((x) => x >= lo && x < EDGES[i + 1]).length);
    const antes = [];
    for (let ante = 1; ante <= 8; ante++) {
      const reached = R.filter((r) => r.won || r.ante >= ante).length, cleared = R.filter((r) => r.won || r.ante > ante).length;
      const bs = battles.filter((b) => b.ante === ante);
      const kind = (k) => { const x = bs.filter((b) => b.kind === k); return { n: x.length, win: r3(x.filter((b) => b.won).length / x.length) }; };
      antes.push({ ante, reached: r3(reached / n), cleared: r3(cleared / n), pass: r3(cleared / Math.max(1, reached)), practice: kind('practice'), official: kind('official'), master: kind('master'),
        ratioHist: hist(bs.filter((b) => b.reason !== 'mate').map((b) => b.score / b.target)) });
    }
    const tally = (keyOf) => { const t = {}; for (const r of R) for (const id of new Set(keyOf(r))) { t[id] = t[id] || { n: 0, w: 0 }; t[id].n++; if (r.won) t[id].w++; } return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { runs: v.n, win: r3(v.w / v.n) }])); };
    const out = {
      tool: 'tools/run.mjs', policy: args.policy, seed: args.seed, dan: args.dan || 0, runs: n, timeouts: (args.timeouts || []).length, tune: args.tune || null, B: args.B || null,
      runWin: r3(wins / n), antes, ratioEdges: EDGES.slice(0, -1).map((x, i) => [x, EDGES[i + 1] === Infinity ? null : EDGES[i + 1]]),
      clock: { lostPerRun: r3(R.reduce((a, r) => a + r.log.filter((x) => x.clockLost).length, 0) / n), wonWithLoss: r3(R.filter((r) => r.won && r.log.some((x) => x.clockLost)).length / Math.max(1, wins)), reboardPerBattle: r3(battles.reduce((a, b) => a + (b.reboards || 0), 0) / battles.length) },
      items: {
        maxim: tally((r) => r.bought), joseki: tally((r) => r.josekis),
        soul: tally((r) => r.log.flatMap((b) => b.souls || [])), engraving: tally((r) => r.deck.split(' ').filter((x) => x.includes(':')).map((x) => x.split(':')[1])),
      },
      factions: fx,
      souls: soulFx,
      // 대국 한 줄씩 [관, 대국(0 · 1 · 2), 세력, 이김 1/0, 끝난 까닭](세력 · 관별로 다시 셀 때)
      battles: battles.map((b) => [b.ante, b.blind, b.faction || null, b.won ? 1 : 0, b.reason]),
      masters: Object.fromEntries(Object.keys(MASTER_BY_ID).map((id) => { const bs = battles.filter((b) => b.master === id); return [id, { n: bs.length, win: r3(bs.filter((b) => b.won).length / bs.length) }]; })),
    };
    mkdirSync(dirname(args.json), { recursive: true });
    writeFileSync(args.json, JSON.stringify(out, null, 1) + '\n');
    console.log(`JSON: ${args.json}`);
  }
}

// 세력별 수치: 종류별 통과율, 명인 통과율의 관 보정(명인 대국마다 이김(1/0) − 같은 관 명인 통과율, 세력 평균), 입은 모습 몫
export function factionStats(battles) {
  const r3 = (x) => (Number.isFinite(x) ? Math.round(x * 1000) / 1000 : null);
  const kindOf = (bs, k) => { const x = bs.filter((b) => b.kind === k); return { n: x.length, win: r3(x.filter((b) => b.won).length / x.length) }; };
  const masterAt = {};
  for (let a = 1; a <= 8; a++) { const x = battles.filter((b) => b.kind === 'master' && b.ante === a); masterAt[a] = x.length ? x.filter((b) => b.won).length / x.length : null; }
  const share = (bs) => {
    const w = {};
    for (const b of bs) for (const [t, v] of Object.entries(b.worn || {})) w[t] = (w[t] || 0) + v;
    const tot = Object.values(w).reduce((a, x) => a + x, 0);
    return { tot, list: Object.entries(w).map(([t, v]) => [t, r3(v / tot)]).sort((a, b) => b[1] - a[1]) };
  };
  const rows = FACTIONS.map((fa) => {
    const bs = battles.filter((b) => b.faction === fa.id);
    const ms = bs.filter((b) => b.kind === 'master' && masterAt[b.ante] != null);
    // 같은 관에 다른 세력이 없는 관(1관 · 8관)은 보정이 늘 0이라 빼고, 섞이는 2~7관만 센다
    const mid = ms.filter((b) => b.ante >= 2 && b.ante <= 7);
    return {
      id: fa.id, name: fa.name, n: bs.length,
      practice: kindOf(bs, 'practice'), official: kindOf(bs, 'official'), master: kindOf(bs, 'master'),
      adj: mid.length ? r3(mid.reduce((a, b) => a + (b.won ? 1 : 0) - masterAt[b.ante], 0) / mid.length) : null, adjN: mid.length,
      ante: bs.length ? bs.reduce((a, b) => a + b.ante, 0) / bs.length : null,
      worn: share(bs).list,
    };
  });
  const byAnte = [];
  for (let a = 1; a <= 8; a++) {
    const f = {};
    for (const fa of FACTIONS) {
      const s = share(battles.filter((b) => b.faction === fa.id && b.ante === a));
      if (s.tot) f[fa.id] = { top: s.list[0][0], share: s.list[0][1], n: s.tot, list: s.list };
    }
    byAnte.push({ ante: a, f });
  }
  return { rows, byAnte, masterAt: Object.fromEntries(Object.entries(masterAt).map(([k, v]) => [k, r3(v)])) };
}
