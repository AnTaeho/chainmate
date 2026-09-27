// 재미 하네스: 점수 · 승률 말고 「고민할 거리」를 잰다(docs/design-notes/fun.md).
//   node tools/fun.mjs --runs 60 --seed 1 [--workers 4] [--policy smart]
// 판마다 smart 봇으로 끝까지 두며, 대국의 첫 결정마다:
//   선택지   최선 점수의 90% 이상을 내는 서로 다른 떨구기(기물 종류 × 칸)의 수
//   민감도   같은 판을 「맨 짜임」(격언 · 기보 · 가족 · 정석 없음, 주머니 같음)으로 풀면 최선 떨구기(종류 · 칸 · 첫 먹이)가 달라지는 비율
// 판마다: 목표 ×5 · ×10을 넘긴 대국 수(폭발), 이긴 판, 도달 관.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { createRun } from '../src/sim/run.js';
import { playRun } from './shopbot.mjs';
import { bestMove } from '../src/sim/solver.js';

function parseArgs(argv) {
  const a = { runs: 60, seed: 1, workers: 4, policy: 'smart' };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--runs') a.runs = Number(argv[++i]);
    else if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--workers') a.workers = Number(argv[++i]);
    else if (k === '--policy') a.policy = argv[++i];
  }
  return a;
}

const bare = (b) => ({ ...b, mods: b.mods.filter((m) => m.id !== 'charts' && !m.uid && !m.of && m.kind !== 'family' && m.kind !== 'joseki'), chain: null });
const key = (m) => (m ? `${m.t ?? ''}${m.handIndex}@${m.sq}>${m.line ? m.line[0] : ''}` : '-');

function sample(b) {
  const collect = [];
  const best = bestMove(b, { preferMate: 'avoid', collect });
  if (!best || best.score <= 0) return null;
  const seen = new Map();
  for (const c of collect) { const k = `${c.t}@${c.sq}`; seen.set(k, Math.max(seen.get(k) || 0, c.score)); }
  const good = [...seen.values()].filter((s) => s >= 0.9 * best.score).length;
  const plain = bestMove(bare(b), { preferMate: 'avoid' });
  const tOf = (m) => (m ? b.hand[m.handIndex].t : '');
  const differ = !plain || tOf(plain) !== tOf(best) || plain.sq !== best.sq || plain.line[0] !== best.line[0];
  return { good, options: seen.size, differ };
}

function one(seed, policy) {
  const run = createRun({ seed });
  const samples = [];
  let lastKey = null;
  playRun(run, policy, {
    stopAt: (r) => {
      const b = r.battle;
      if (r.phase === 'battle' && b && b.status === 'play') {
        const k = `${r.ante}:${r.blind}:${b.movesUsed}:${b.discardsUsed}`;
        if (k !== lastKey) { lastKey = k; const s = sample(b); if (s) samples.push(s); }
      }
      return false;
    },
  });
  const battles = run.log.filter((x) => !x.skipped);
  return {
    won: run.phase === 'won', ante: run.ante, samples,
    x5: battles.filter((x) => x.overflow >= 5).length, x10: battles.filter((x) => x.overflow >= 10).length, battles: battles.length,
  };
}

if (!isMainThread) {
  const { seeds, policy } = workerData;
  parentPort.postMessage(seeds.map((s) => one(s, policy)));
} else {
  const args = parseArgs(process.argv.slice(2));
  const seeds = Array.from({ length: args.runs }, (_, i) => (args.seed * 1000003 + i * 7919) >>> 0);
  const t0 = performance.now();
  const chunks = Array.from({ length: args.workers }, (_, w) => seeds.filter((_, i) => i % args.workers === w));
  const R = (await Promise.all(chunks.filter((c) => c.length).map((c) => new Promise((res, rej) => {
    const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { seeds: c, policy: args.policy } });
    wk.on('message', res); wk.on('error', rej);
  })))).flat();
  const S = R.flatMap((r) => r.samples);
  const n = R.length;
  const pc = (x) => (100 * x).toFixed(1) + '%';
  const avg = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  console.log(`재미 하네스: 판 ${n}, 정책 ${args.policy}, seed ${args.seed} — ${((performance.now() - t0) / 1000).toFixed(0)}s`);
  console.log(`판 승률 ${pc(R.filter((r) => r.won).length / n)} · 평균 도달 관 ${avg(R.map((r) => r.ante)).toFixed(2)}`);
  console.log(`결정 ${S.length}: 의미 있는 선택지(최선 90% 이상) 평균 ${avg(S.map((s) => s.good)).toFixed(2)} · 외길(1) ${pc(S.filter((s) => s.good === 1).length / S.length)} · 셋 이상 ${pc(S.filter((s) => s.good >= 3).length / S.length)} · 떨굴 자리 평균 ${avg(S.map((s) => s.options)).toFixed(1)}`);
  console.log(`짜임 민감도(맨 짜임과 최선 수가 다름) ${pc(S.filter((s) => s.differ).length / S.length)}`);
  console.log(`폭발: 판당 ×5 ${avg(R.map((r) => r.x5)).toFixed(2)}번 · ×10 ${avg(R.map((r) => r.x10)).toFixed(2)}번 (대국당 ×5 ${pc(R.reduce((a, r) => a + r.x5, 0) / R.reduce((a, r) => a + r.battles, 0))})`);
}
