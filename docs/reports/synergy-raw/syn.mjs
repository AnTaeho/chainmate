// 판 하네스 --dump 시너지 표: 시너지마다 판 끝 수가 문턱 2 · 4 · 5에 닿은 판 수 · 승률 · 판 평균 대비 차, 으뜸 판 · 평균 수
//   node syn.mjs a.json [b.json …]
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const { FAMILIES } = await import(ROOT + '/src/data/families.js');
const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
const dp = (x, avg) => (Number.isFinite(x) ? ((x - avg) * 100 >= 0 ? '+' : '') + ((x - avg) * 100).toFixed(1) : '-');
const pad = (s, n) => String(s).padStart(n);
for (const file of process.argv.slice(2)) {
  const { runs: R, timeouts } = JSON.parse(readFileSync(file, 'utf8'));
  const n = R.length, win = (xs) => (xs.length ? xs.filter((r) => r.won).length / xs.length : NaN);
  const avg = win(R);
  console.log(`\n${basename(file)}: 판 ${n}(시간 초과 ${timeouts.length}) 판 승률 ${pc(avg)}`);
  console.log(['시너지', '평균 수', '으뜸 판', '승률', '2+ 판', '승률', '차', '4+ 판', '승률', '차', '5+ 판', '승률', '차'].map((s, i) => pad(s, i ? 7 : 4)).join(' '));
  for (const f of FAMILIES) {
    const c = (r) => r.fam[f.id] || 0;
    const top = (r) => Math.max(...Object.values(r.fam));
    const dom = R.filter((r) => top(r) >= 2 && c(r) === top(r));
    const at = (k) => R.filter((r) => c(r) >= k);
    const cells = [f.name, (R.reduce((a, r) => a + c(r), 0) / n).toFixed(2), dom.length, pc(win(dom))];
    for (const k of [2, 4, 5]) { const xs = at(k); cells.push(xs.length, pc(win(xs)), dp(win(xs), avg)); }
    console.log(cells.map((s, i) => pad(s, i ? 7 : 4)).join(' '));
  }
  // 생존 편향 보정용: 6관 이상 닿은 판끼리(늦게 죽은 판끼리) 4+ 승률
  const late = R.filter((r) => r.won || r.ante >= 6), lavg = win(late);
  console.log(`6관+ 닿은 판 ${late.length} 승률 ${pc(lavg)} — 그 판에서 4+ 승률 · 차`);
  console.log('  ' + FAMILIES.map((f) => { const xs = late.filter((r) => (r.fam[f.id] || 0) >= 4); return `${f.name} ${xs.length} ${pc(win(xs))} (${dp(win(xs), lavg)})`; }).join(' · '));
}
