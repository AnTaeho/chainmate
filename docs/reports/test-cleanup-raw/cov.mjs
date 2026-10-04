// lcov → src 파일별 줄 · 가지 · 함수 표. 쓰기: node cov.mjs a.lcov [b.lcov]
import { readFileSync } from 'node:fs';
const parse = (f) => {
  const out = {}; let cur = null;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    if (line.startsWith('SF:')) { const p = line.slice(3); const m = p.match(/(^|\/)(src\/.*)$/); cur = m ? { name: m[2] } : null; if (cur) out[cur.name] = cur; }
    else if (cur && /^(LF|LH|BRF|BRH|FNF|FNH):/.test(line)) { const [k, v] = line.split(':'); cur[k] = +v; }
  }
  return out;
};
const pct = (h, f) => (f ? (100 * h / f) : 100);
const a = parse(process.argv[2]), b = process.argv[3] ? parse(process.argv[3]) : null;
const names = Object.keys(a).sort();
const f2 = (x) => x.toFixed(2);
let worse = 0;
console.log(b ? '| 파일 | 줄 전 | 줄 뒤 | 가지 전 | 가지 뒤 | 함수 전 | 함수 뒤 |' : '| 파일 | 줄 % (맞은/전체) | 가지 % | 함수 % |');
console.log(b ? '|---|---:|---:|---:|---:|---:|---:|' : '|---|---:|---:|---:|');
for (const n of names) {
  const x = a[n];
  if (!b) { console.log(`| ${n} | ${f2(pct(x.LH, x.LF))} (${x.LH}/${x.LF}) | ${f2(pct(x.BRH, x.BRF))} (${x.BRH}/${x.BRF}) | ${f2(pct(x.FNH, x.FNF))} (${x.FNH}/${x.FNF}) |`); continue; }
  const y = b[n] || { LH: 0, LF: x.LF, BRH: 0, BRF: x.BRF, FNH: 0, FNF: x.FNF };
  const cells = [['LH', 'LF'], ['BRH', 'BRF'], ['FNH', 'FNF']].map(([h, f]) => {
    const p0 = pct(x[h], x[f]), p1 = pct(y[h], y[f]);
    const mark = p1 < p0 - 1e-9 ? ' ▼' : '';
    if (mark) worse++;
    return `${f2(p0)} | ${f2(p1)}${mark}`;
  });
  console.log(`| ${n} | ${cells.join(' | ')} |`);
}
const tot = (o, h, f) => { let H = 0, F = 0; for (const k in o) { H += o[k][h]; F += o[k][f]; } return f2(pct(H, F)); };
console.log(b ? `| **src 전체** | ${tot(a,'LH','LF')} | ${tot(b,'LH','LF')} | ${tot(a,'BRH','BRF')} | ${tot(b,'BRH','BRF')} | ${tot(a,'FNH','FNF')} | ${tot(b,'FNH','FNF')} |` : `| **src 전체** | ${tot(a,'LH','LF')} | ${tot(a,'BRH','BRF')} | ${tot(a,'FNH','FNF')} |`);
if (b) console.error(`떨어진 칸: ${worse}`);
