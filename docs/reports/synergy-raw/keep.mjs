// 봇의 짜임 재기(evalBuild)로: 시너지 수가 n일 때 폰 하나를 버리거나(remove) 비숍으로 올리면(promote) 힘이 어떻게 바뀌나
//   node keep.mjs <variant> — 시너지 조정자를 변형으로 갈아 끼우고 잰다
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const { createRun } = await import(ROOT + '/src/sim/run.js');
const { evalBuild } = await import(ROOT + '/tools/shopbot.mjs');
const { defineModifier } = await import(ROOT + '/src/sim/scoring.js');
await import(ROOT + '/src/data/families.js');
const lv = (ctx) => ctx.data.level || 0;
const V = {
  cur: null,
  // 행진: 4 폰 모습 ×2(지금 작업 트리), 5 폰으로 시작 ×5
  start3: { onCapture(ctx) { if (lv(ctx) >= 2 && ctx.event.form === 'P') ctx.mulMult(2); }, onChainEnd(ctx) { if (ctx.chain.dropType !== 'P') return; ctx.addMult(3); if (lv(ctx) >= 2) ctx.mulMult(3); if (lv(ctx) >= 3) ctx.mulMult(5); } },
  start2: { onChainEnd(ctx) { if (ctx.chain.dropType !== 'P') return; ctx.addMult(3); if (lv(ctx) >= 2) ctx.mulMult(2); if (lv(ctx) >= 3) ctx.mulMult(5); } },
  old: { onCapture(ctx) { if (lv(ctx) >= 2 && ctx.event.form === 'P') ctx.addMult(3); }, onChainEnd(ctx) { if (ctx.chain.dropType !== 'P') return; ctx.addMult(3); if (lv(ctx) >= 3) ctx.mulMult(5); } },
};
const variant = process.argv[2] || 'cur';
if (V[variant]) defineModifier('family:march', { kind: 'family', ...V[variant] });
const K = Number(process.argv[3] || 30);
const MAX = { 2: ['pawn_march', 'low_stance'], 4: ['pawn_march', 'low_stance', 'empty_bag', 'youngest'], 5: ['pawn_march', 'low_stance', 'empty_bag', 'youngest', 'farmer'] };
const seeds = Array.from({ length: K }, (_, i) => 5000 + i * 7919);
const out = [];
for (const n of [0, 2, 4, 5]) for (const ante of [2, 5]) {
  const run = createRun({ seed: 7, draft: false });
  const maxims = (MAX[n] || []).map((id, i) => ({ uid: 900 + i, id, data: {}, edition: null }));
  const base = { deck: run.deck, maxims, charts: { ...run.charts }, josekis: [] };
  const pawn = run.deck.find((p) => p.t === 'P');
  const full = evalBuild(run, base, seeds, ante);
  const rem = evalBuild(run, { ...base, deck: run.deck.filter((p) => p !== pawn) }, seeds, ante);
  const pro = evalBuild(run, { ...base, deck: run.deck.map((p) => (p === pawn ? { ...p, t: 'B' } : p)) }, seeds, ante);
  out.push(`행진 ${n} ${ante}관: 그대로 ${full.toFixed(0)} · 폰 버림 ${((rem / full - 1) * 100).toFixed(0)}% · 폰→비숍 ${((pro / full - 1) * 100).toFixed(0)}%`);
}
console.log(`[${variant}] 주머니 ${createRun({ seed: 7, draft: false }).deck.map((p) => p.t).join('')}\n` + out.join('\n'));
