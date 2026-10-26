const R = '/Users/antaeho/workspace/projects/chainmate/src/data/';
const { unlockedAt } = await import(R + 'unlocks.js');
const { MAXIM_FAMILIES, FAMILIES, maximFamilies } = await import(R + 'families.js');
const { PIECES } = await import(R + 'pieces.js');
const { JOSEKIS } = await import(R + 'josekis.js').catch(() => ({}));
const { SOULS } = await import(R + 'souls.js').catch(() => ({}));
for (const t of [0, 4, 10, 20]) {
  const u = unlockedAt(t);
  const c = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
  for (const id of u.maxims) for (const f of maximFamilies(id)) c[f]++;
  for (const id of u.pieces) for (const f of (PIECES[id]?.families || [])) c[f] += 0.01; // mark pieces separately
  const pc = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
  for (const id of u.pieces) for (const f of (PIECES[id]?.families || [])) pc[f]++;
  const jc = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
  for (const id of u.josekis) { const j = (JOSEKIS || []).find?.((x) => x.id === id); for (const f of (j?.families || [])) jc[f]++; }
  const sc = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
  for (const id of u.souls) { const s = (Array.isArray(SOULS) ? SOULS.find((x) => x.id === id) : SOULS?.[id]); for (const f of (s?.families || [])) sc[f]++; }
  console.log('tier', t, 'counts maxims', u.maxims.length, 'pieces', u.pieces.length, 'souls', u.souls.length, 'jos', u.josekis.length);
  console.log('  ' + FAMILIES.map((f) => `${f.name} 격${Math.floor(c[f.id])}/이${pc[f.id]}/정${jc[f.id]}/혼${sc[f.id]}`).join(' · '));
}
