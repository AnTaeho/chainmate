import { FAMILIES, maximFamilies } from '../../../src/data/families.js';
import { MAXIMS } from '../../../src/data/maxims.js';
import { JOSEKIS } from '../../../src/data/josekis.js';
import { SOULS } from '../../../src/data/souls.js';
import { PIECES } from '../../../src/data/pieces.js';
const rows = {};
for (const f of FAMILIES) rows[f.id] = { m: [], j: [], s: [], p: [] };
for (const m of MAXIMS) for (const f of maximFamilies(m.id)) rows[f]?.m.push(m.name);
for (const j of JOSEKIS) for (const f of j.families || []) rows[f]?.j.push(j.name);
for (const s of SOULS) for (const f of s.families || []) rows[f]?.s.push(s.name);
for (const p of Object.values(PIECES)) if (p.fairy) for (const f of p.families) rows[f]?.p.push(p.name);
console.log('| 시너지 | 격언 | 레퍼토리 | 혼 | 특수 기물 | 합 |\n|---|---|---|---|---|---|');
for (const f of FAMILIES) { const r = rows[f.id]; console.log(`| ${f.name} | ${r.m.length} | ${r.j.length} | ${r.s.length} | ${r.p.length} | ${r.m.length+r.j.length+r.s.length+r.p.length} |`); }
if (process.argv[2]) for (const f of FAMILIES) { const r = rows[f.id]; console.log(f.name, JSON.stringify(r)); }
console.log('maxims total', MAXIMS.length, 'josekis', JOSEKIS.length, 'souls', SOULS.length);
