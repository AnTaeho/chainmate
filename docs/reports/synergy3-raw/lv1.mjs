const R='../../../';
const { createRun, battleMods } = await import(R+'src/sim/run.js');
const { createBattle, arrive } = await import(R+'src/sim/battle.js');
const { bestMove } = await import(R+'src/sim/solver.js');
const { FAMILIES } = await import(R+'src/data/families.js');
const N = Number(process.argv[2]||40);
function evalMods(run, build, mods, seeds, ante) {
  let total=0;
  seeds.forEach((seed,k)=>{
    const b = createBattle({ seed, ante, kind:'practice', target:null, golden:false, bag: build.deck.map(p=>({t:p.t,id:p.id})), rules: run.rules, mods });
    const m = Math.min(k % b.rules.moves, b.rules.moves-1);
    for (let i=0;i<m&&b.hand.length;i++){ b.used.push(b.hand.shift()); while(b.hand.length<b.rules.hand&&b.bag.length) b.hand.push(b.bag.shift()); b.movesUsed=i+1; arrive(b);}
    b.movesUsed=m; b.movesLeft=b.rules.moves-m;
    const best = b.hand.length? bestMove(b,{preferMate:'avoid',maxNodes:1000}):null;
    total += best?best.score:0;
  });
  return total/seeds.length;
}
for (const ante of [2,4]) {
  const run = createRun({ seed: 7, draft: false });
  const build = { deck: run.deck, maxims: [], charts: { ...run.charts }, josekis: [] };
  const seeds = Array.from({length:N},(_,i)=>1000+i*7919);
  const base = evalMods(run, build, battleMods(build), seeds, ante);
  const row=[];
  for (const f of FAMILIES) for (const level of [1,2,3]) {
    const v = evalMods(run, build, [...battleMods(build), {id:`family:${f.id}`, data:{level}}], seeds, ante);
    row.push(`${f.name}${level}:${((v/base-1)*100).toFixed(0)}%`);
  }
  console.log('ante',ante,'base',base.toFixed(0)); console.log(row.join(' '));
}
