// 대국 호흡 견줌표(CHM-66 D′): 판 하네스 dump(--beats) 여럿을 받아 안마다 한 줄씩 지표를 낸다(보고서 docs/reports/pace.md).
//   node tools/pace-table.mjs 이름=<dump.json>[+<dump.json>…] …   (+로 이은 dump는 합쳐 센다 — 단 0 두 시드)
// 지표: 판 승률 · 관별 통과율 · 목표를 넘겨 이긴 대국의 첫 수 · 마지막 두 수 · 앞/가운데/끝 1/3(사슬마다 쌓인 점수로 처음 넘긴 수, tools/beats.mjs paceOf) ·
//       체크메이트 승리(그중 목표 밑) · 진 대국 점수/목표 층 · 대국당 둔 수 · 대국당 번 상금 · 판당 둔 수 합 · 판 보기로 건너뛴 몫 · 시간 초과
import { readFileSync } from 'node:fs';
import { runBeats, NEAR_NAMES } from './beats.mjs';

const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (xs) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : NaN);
const share = (xs, fn) => (xs.length ? xs.filter(fn).length / xs.length : NaN);

export function paceRow(dumps) {
  const D = dumps.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  const runs = D.flatMap((d) => d.runs), timeouts = D.reduce((a, d) => a + d.timeouts.length, 0);
  const X = runs.map((r) => runBeats(r.beats));
  const won = X.flatMap((x) => x.pace.won), mate = X.flatMap((x) => x.pace.mate), all = X.flatMap((x) => x.pace.all), near = X.flatMap((x) => x.near), after = X.flatMap((x) => x.pace.after);
  const peek = runs.flatMap((r) => r.peek || []);
  const n = runs.length;
  const pass = [1, 2, 3, 4, 5, 6, 7, 8].map((a) => { const reached = runs.filter((r) => r.won || r.ante >= a).length, cleared = runs.filter((r) => r.won || r.ante > a).length; return cleared / Math.max(1, reached); });
  return {
    runs: n, timeouts, runWin: share(runs, (r) => r.won), pass,
    crossedWins: won.length, first: share(won, (v) => v.first), last2: share(won, (v) => v.last2), thirds: [0, 1, 2].map((i) => share(won, (v) => v.third === i)),
    firstByKind: [0, 1, 2].map((k) => share(won.filter((v) => v.blind === k), (v) => v.first)),
    mateWins: mate.length, mateUnder: mate.filter((v) => v.cross == null).length, battles: all.length,
    lost: near.length, near: NEAR_NAMES.map((_, i) => share(near, (v) => v.tier === i)),
    moves: mean(all.map((v) => v.moves)), movesWon: mean(all.filter((v) => v.won).map((v) => v.moves)), reward: mean(all.map((v) => v.reward)), rewardWon: mean(all.filter((v) => v.won).map((v) => v.reward)),
    movesPerRun: mean(X.map((x) => x.pace.all.reduce((a, v) => a + v.moves, 0))), skip: share(peek, (v) => v.skip),
    after: after.length ? { n: after.length, ratioP50: (() => { const rs = after.filter((v) => v.pre > 0).map((v) => v.post / v.pre).sort((a, b) => a - b); return rs[Math.floor((rs.length - 1) / 2)]; })(), sacBattles: share(after, (v) => v.sacs > 0) } : null,
  };
}

const args = process.argv.slice(2);
if (args.length) {
  const rows = args.map((a) => { const [name, files] = a.split('='); return [name, paceRow(files.split('+'))]; });
  const cols = ['안', '판', '시간 초과', '판 승률', '넘겨 이김', '첫 수', '마지막 두 수', '앞', '가운데', '끝', '첫 수 연습/정식/마스터', '메이트 승리(목표 밑)', '진 대국', ...NEAR_NAMES, '대국당 수(이김)', '대국당 상금(이김)', '판당 수 합', '건너뜀'];
  console.log('| ' + cols.join(' | ') + ' |');
  console.log('|' + cols.map(() => '---').join('|') + '|');
  for (const [name, r] of rows) console.log('| ' + [name, r.runs, r.timeouts, pc(r.runWin), r.crossedWins, pc(r.first), pc(r.last2), ...r.thirds.map(pc), r.firstByKind.map(pc).join(' / '), `${r.mateWins}(${r.mateUnder})`, r.lost, ...r.near.map(pc), `${f2(r.moves)}(${f2(r.movesWon)})`, `${f2(r.reward)}(${f2(r.rewardWon)})`, f2(r.movesPerRun), pc(r.skip)].join(' | ') + ' |');
  console.log('\n관별 통과율(도달한 판 중 통과)');
  console.log('| 안 | ' + [1, 2, 3, 4, 5, 6, 7, 8].map((a) => `${a}관`).join(' | ') + ' |');
  console.log('|---|' + [1, 2, 3, 4, 5, 6, 7, 8].map(() => '---').join('|') + '|');
  for (const [name, r] of rows) console.log(`| ${name} | ${r.pass.map(pc).join(' | ')} |`);
  const af = rows.filter(([, r]) => r.after);
  if (af.length) {
    console.log('\n넘긴 뒤에도 둔 대국(대국마다 넘긴 뒤 사슬 평균 ÷ 넘기기까지 사슬 평균의 p50 · 넘긴 뒤 희생한 대국)');
    for (const [name, r] of af) console.log(`- ${name}: ${r.after.n}대국 · p50 ${f2(r.after.ratioP50)} · 희생 ${pc(r.after.sacBattles)}`);
  }
}
