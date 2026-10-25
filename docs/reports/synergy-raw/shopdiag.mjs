// --build dump: 시너지마다 상점 진열 · 살 돈이 있던 진열 · 산 수(격언 · 혼 · 기물 칸), 판당 값. 그리고 판 끝 수에 정석 몫
//   node shopdiag.mjs build.json
import { readFileSync } from 'node:fs';
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const { FAMILIES, maximFamilies } = await import(ROOT + '/src/data/families.js');
const { SOUL_BY_ID } = await import(ROOT + '/src/data/souls.js');
const { PIECES } = await import(ROOT + '/src/data/pieces.js');
const { JOSEKI_BY_ID } = await import(ROOT + '/src/data/josekis.js');
const { runs: R } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const famsOf = (it) => {
  if (it.k === 'maxim') return maximFamilies(it.id);
  if (it.s && SOUL_BY_ID[it.s]) return SOUL_BY_ID[it.s].families || [];
  if (it.k === 'soul' && SOUL_BY_ID[it.id]) return SOUL_BY_ID[it.id].families || [];
  if (it.k === 'piece' && PIECES[it.id] && PIECES[it.id].fairy) return PIECES[it.id].families || [];
  return [];
};
const S = {};
for (const f of FAMILIES) S[f.id] = { shown: 0, afford: 0, bought: 0, boughtAff: 0, early: 0, josekis: 0 };
for (const r of R) {
  for (const sh of r.build.shops) for (const it of sh.items) for (const f of famsOf(it)) {
    const s = S[f]; if (!s) continue;
    s.shown++; if (it.a) s.afford++; if (it.b) s.bought++;
    if (it.b && sh.ante <= 3) s.early++;
  }
  for (const j of r.josekis || []) for (const f of (JOSEKI_BY_ID[j] && JOSEKI_BY_ID[j].families) || []) S[f].josekis++;
}
const n = R.length, pc = (x) => (100 * x).toFixed(1) + '%';
console.log(`판 ${n}: 시너지마다 판당 진열 · 살 돈 있던 진열 · 산 것 · 산 비율(살 돈 있던 진열 중) · 1~3관에 산 것 · 판당 정석 칩`);
for (const f of FAMILIES) { const s = S[f.id]; console.log(`${f.name}\t진열 ${(s.shown / n).toFixed(2)}\t살 돈 ${(s.afford / n).toFixed(2)}\t산 것 ${(s.bought / n).toFixed(2)}\t산 비율 ${pc(s.bought / s.afford)}\t1~3관 ${(s.early / n).toFixed(2)}\t정석 ${(s.josekis / n).toFixed(2)}`); }
