// 판 하나에서 폰이 어디로 사라지나: 상점 명령(승급 · 버리기 · 팔기)과 관마다 주머니의 폰 수
//   node pawns.mjs <seed> [give,ids]
const ROOT = new URL('../../..', import.meta.url).pathname.replace(/\/$/, '');
const { createRun } = await import(ROOT + '/src/sim/run.js');
const { playRun, BUILD } = await import(ROOT + '/tools/shopbot.mjs');
const seed = Number(process.argv[2]);
const give = process.argv[3] ? process.argv[3].split(',') : [];
const run = createRun({ seed, draft: true });
for (const id of give) run.maxims.push({ uid: run.nextUid++, id, data: {}, edition: null, paid: 0 });
const out = [];
let lastAnte = run.ante;
BUILD.log = {
  record(r, cmd, events) {
    const pawnsNow = run.deck.filter((p) => p.t === 'P').length;
    if (cmd.type === 'promote' || cmd.type === 'remove') out.push(`${run.ante}관 ${cmd.type} ${cmd.to || ''} 폰 ${pawnsNow}`);
    for (const e of events) if (e.type === 'evolve' && e.from === 'P') out.push(`${run.ante}관 evolve P→${e.to}`);
    if (run.ante !== lastAnte) { out.push(`→ ${run.ante}관 주머니 ${run.deck.map((p) => p.t).join('')}`); lastAnte = run.ante; }
  },
};
playRun(run, 'smart');
console.log(`seed ${seed} ${run.phase} ${run.ante}관 끝 주머니 ${run.deck.map((p) => p.t).join('')}\n  ` + out.join('\n  '));
