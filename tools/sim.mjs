// 화면 없이 대국을 N판씩 돌리는 하네스.
//   node tools/sim.mjs --battles 500 --ante 1..8 --seed 1 [--nomate]
//   --ante 3 처럼 하나만, 1..8 처럼 범위로.
//   --nomate: 봇이 외통을 피한다(다른 수가 없을 때만 외통). 외통 없이 4수로 낼 수 있는 점수를 보려고.
// 봇: tools/bot.mjs(풀이기 최선 수 + 무르기 · 폰 먼저 쓰기 규칙).
// 목표 점수 없이 수 4를 다 쓴다(외통이면 거기서 끝). 관별로 찍는 것:
//   점수/수 평균, 대국 총점 평균, 총점 p10/p50/p90(외통으로 끝난 대국 제외), 사슬 길이 평균,
//   끊김률(끊김으로 끝난 수 / 수), 응수율(응수로 먹은 먹기 / 먹기), 응수 있는 수 비율,
//   외통률(대국), 막힘 패배율(대국), 무르기 평균, 결정당 ms(평균 / 최대).
import { createBattle, apply } from '../src/sim/battle.js';
import { decideBattle } from './bot.mjs';

function parseArgs(argv) {
  const a = { battles: 300, ante: [1, 8], seed: 1, nomate: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--battles') a.battles = Number(argv[++i]);
    else if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--nomate') a.nomate = true;
    else if (k === '--ante') {
      const v = argv[++i];
      const m = v.match(/^(\d+)(?:\.\.(\d+))?$/);
      if (!m) throw new Error(`bad --ante ${v}`);
      a.ante = [Number(m[1]), Number(m[2] ?? m[1])];
    }
  }
  return a;
}

function pct(sorted, p) {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

function runAnte(ante, n, seed, nomate) {
  const s = {
    moves: 0, moveScore: 0, totals: [], totalsNoMate: [], captures: 0, cuts: 0, forcedCaps: 0, forcedMoves: 0,
    mates: 0, mates1: 0, stuck: 0, discards: 0, decisions: 0, ms: 0, maxMs: 0, best: 0,
  };
  for (let i = 0; i < n; i++) {
    const b = createBattle({ seed: (seed * 1000003 + ante * 7919 + i * 104729) >>> 0, ante });
    while (b.status === 'play') {
      const t0 = performance.now();
      const d = decideBattle(b, { nomate });
      const dt = performance.now() - t0;
      s.decisions++; s.ms += dt; s.maxMs = Math.max(s.maxMs, dt);
      if (!d) break;
      if (d.discard) { apply(b, { type: 'discard', handIndices: d.discard }); continue; }
      apply(b, { type: 'drop', handIndex: d.play.handIndex, sq: d.play.sq });
      for (const sq of d.play.line) apply(b, { type: 'capture', sq });
    }
    for (const h of b.history) {
      s.moves++; s.moveScore += h.score; s.captures += h.captures; s.forcedCaps += h.forced;
      if (h.reason === 'cut') s.cuts++;
      if (h.forced > 0) s.forcedMoves++;
      s.best = Math.max(s.best, h.score);
    }
    s.discards += b.discardsUsed;
    s.totals.push(b.score);
    if (b.result && b.result.reason === 'mate') { s.mates++; if (b.history.length === 1) s.mates1++; }
    else s.totalsNoMate.push(b.score);
    if (b.result && b.result.reason === 'stuck') s.stuck++;
  }
  s.totalsNoMate.sort((x, y) => x - y);
  return s;
}

const args = parseArgs(process.argv.slice(2));
const f = (x, d = 0) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pc = (x) => (100 * x).toFixed(1) + '%';
const cols = ['관', '점수/수', '총점', 'p10', 'p50', 'p90', '최고한수', '사슬', '끊김', '응수/먹기', '응수수', '외통', '첫수외통', '막힘', '무르기', 'ms/결정', 'ms최대'];
const rows = [];
const t0 = performance.now();
for (let ante = args.ante[0]; ante <= args.ante[1]; ante++) {
  const s = runAnte(ante, args.battles, args.seed, args.nomate);
  const n = args.battles;
  rows.push([
    String(ante), f(s.moveScore / s.moves, 1), f(s.totals.reduce((a, x) => a + x, 0) / n, 0),
    f(pct(s.totalsNoMate, 0.1)), f(pct(s.totalsNoMate, 0.5)), f(pct(s.totalsNoMate, 0.9)), String(s.best),
    f(s.captures / s.moves, 2), pc(s.cuts / s.moves), pc(s.forcedCaps / s.captures), pc(s.forcedMoves / s.moves),
    pc(s.mates / n), pc(s.mates1 / n), pc(s.stuck / n), f(s.discards / n, 2), f(s.ms / s.decisions, 2), f(s.maxMs, 1),
  ]);
}
// 한글은 두 칸 너비로 센다
const dw = (x) => [...x].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
const w = cols.map((c, i) => Math.max(dw(c), ...rows.map((r) => dw(r[i]))));
const line = (r) => r.map((x, i) => ' '.repeat(w[i] - dw(x)) + x).join('  ');
console.log(`대국 ${args.battles}판 × 관 ${args.ante[0]}..${args.ante[1]}, seed ${args.seed} (목표 없음, 수 4${args.nomate ? ', 외통 피함' : ''})`);
console.log(line(cols));
for (const r of rows) console.log(line(r));
console.log(`p10/p50/p90 = 외통 없이 끝난 대국의 총점. 끊김·응수수 = 수 기준, 응수/먹기 = 먹기 기준, 외통·첫수외통·막힘 = 대국 기준. 전체 ${((performance.now() - t0) / 1000).toFixed(1)}s`);
