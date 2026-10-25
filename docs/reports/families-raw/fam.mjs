// 판 하네스 --dump 둘 이상을 견준다: 판 승률 · 외통 이김 · 판 끝 으뜸 시너지(가장 많이 모은 것, 2 이상)별 판 수 · 승률 · 도달 단계별 승률
//   node docs/reports/families-raw/fam.mjs a.json b.json …
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const { FAMILIES, levelOf } = await import('../../../src/data/families.js');
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
for (const file of process.argv.slice(2)) {
  const { runs: R, timeouts } = JSON.parse(readFileSync(file, 'utf8'));
  const n = R.length, win = (xs) => xs.filter((r) => r.won).length / xs.length;
  const battles = R.flatMap((r) => r.log.filter((x) => !x.skipped));
  const mates = battles.filter((b) => b.reason === 'mate').length;
  const top = (r) => Math.max(...Object.values(r.fam));
  console.log(`\n${basename(file)}: 판 ${n}(시간 초과 ${timeouts.length}) 승률 ${pc(win(R))} · 외통 이김 ${pc(mates / battles.length)} · 으뜸 수 평균 ${(R.reduce((a, r) => a + top(r), 0) / n).toFixed(2)}`);
  const lv = [0, 1, 2, 3].map((l) => { const xs = R.filter((r) => levelOf(top(r)) === l); return `${l}단 ${xs.length}판 ${pc(win(xs))}`; });
  console.log(`  으뜸 단계: ${lv.join(' · ')}`);
  const rows = FAMILIES.map((f) => {
    const dom = R.filter((r) => top(r) >= 2 && r.fam[f.id] === top(r));
    const hi = R.filter((r) => levelOf(r.fam[f.id]) >= 2);
    return `${f.name} 으뜸 ${dom.length} ${pc(win(dom))} · 2단+ ${hi.length} ${pc(win(hi))} · 평균 ${(R.reduce((a, r) => a + r.fam[f.id], 0) / n).toFixed(2)}`;
  });
  for (const x of rows) console.log('  ' + x);
}
