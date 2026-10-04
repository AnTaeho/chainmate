// 대국 호흡 0단계 진단(CHM-66 D′): 판 하네스 dump(`node tools/run.mjs … --beats --dump X`)에서
//   ① 점수로 이긴 대국 가운데 첫 수에 목표를 넘긴 몫 — 대국 종류(연습 · 정식 · 마스터)별 · 관별. 체크메이트 승리는 따로
//   ② 가장 큰 사슬이 대국 점수에서 차지하는 몫(log의 best ÷ score) — 2수 이상 걸려 점수로 이긴 대국 · 진 대국. 체크메이트 승리는 따로
//   node tools/pace-diag.mjs <dump.json> [<dump.json> …]   (여럿이면 합쳐 센다)
import { readFileSync } from 'node:fs';

const files = process.argv.slice(2);
if (!files.length) { console.error('dump 파일을 주세요'); process.exit(1); }
const runs = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).runs);
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
const KN = ['연습', '정식', '마스터'];

// ① beats 대국 줄: [bi, 관, 대국, 이김, 까닭, 점수, 목표, 쓴 수, 둘 수 있던 수, 넘긴 수, …]
const B = runs.flatMap((r) => (r.beats ? r.beats.battles : []));
if (!B.length) { console.error('beats 열쇠가 없다 — --beats로 돌린 dump를 주세요'); process.exit(1); }
const scoreWon = B.filter((x) => x[3] && x[4] !== 'mate' && x[9] != null);
const mateWon = B.filter((x) => x[3] && x[4] === 'mate');
const firstRow = (xs, ms) => `${String(xs.length).padStart(5)}  첫 수 ${pc(xs.filter((x) => x[9] === 1).length / xs.length).padStart(6)}  마지막 두 수 ${pc(xs.filter((x) => x[9] >= x[8] - 1).length / xs.length).padStart(6)}  메이트 승리 ${ms.length}`;
console.log(`① 점수로 이긴 대국의 첫 수 승리 몫(판 ${runs.length}, 둔 대국 ${B.length}, 점수로 이김 ${scoreWon.length}, 체크메이트로 이김 ${mateWon.length} — 그중 목표 밑 ${mateWon.filter((x) => x[9] == null).length})`);
console.log(`  전체    ${firstRow(scoreWon, mateWon)}`);
for (let k = 0; k < 3; k++) console.log(`  ${KN[k].padEnd(4)}  ${firstRow(scoreWon.filter((x) => x[2] === k), mateWon.filter((x) => x[2] === k))}`);
console.log('  관별 · 종류별 첫 수 승리 몫(점수로 이긴 대국 수)');
console.log('  관   ' + KN.map((k) => k.padStart(14)).join(''));
for (let a = 1; a <= 8; a++) {
  const cells = [0, 1, 2].map((k) => { const xs = scoreWon.filter((x) => x[1] === a && x[2] === k); return `${pc(xs.filter((x) => x[9] === 1).length / xs.length)}(${xs.length})`.padStart(14); });
  console.log(`  ${a}관 ${cells.join('')}`);
}

// ② log 대국 줄: best(가장 큰 사슬) ÷ score
const L = runs.flatMap((r) => r.log.filter((x) => !x.skipped));
const share = (xs) => xs.filter((x) => x.score > 0).map((x) => Math.min(1, x.best / x.score));
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))] : NaN; };
const line = (name, xs) => { const s = share(xs); const m = s.reduce((a, v) => a + v, 0) / Math.max(1, s.length); return `  ${name.padEnd(18)} ${String(s.length).padStart(5)}  평균 ${pc(m).padStart(6)}  p25 ${pc(q(s, 0.25)).padStart(6)}  p50 ${pc(q(s, 0.5)).padStart(6)}  80% 넘는 몫 ${pc(s.filter((v) => v > 0.8).length / Math.max(1, s.length)).padStart(6)}  90% 넘는 몫 ${pc(s.filter((v) => v > 0.9).length / Math.max(1, s.length)).padStart(6)}`; };
console.log('\n② 가장 큰 사슬 ÷ 대국 점수');
const won2 = L.filter((x) => x.won && x.reason !== 'mate' && x.moves >= 2);
console.log(line('2수 이상 점수 승리', won2));
for (let k = 0; k < 3; k++) console.log(line(`  ${KN[k]}`, won2.filter((x) => x.blind === k)));
console.log(line('진 대국', L.filter((x) => !x.won)));
console.log(line('  두 수 이상 둔 진 대국', L.filter((x) => !x.won && x.moves >= 2)));
console.log(line('체크메이트 승리', L.filter((x) => x.won && x.reason === 'mate')));
console.log(line('첫 수 점수 승리(참고)', L.filter((x) => x.won && x.reason !== 'mate' && x.moves === 1)));
