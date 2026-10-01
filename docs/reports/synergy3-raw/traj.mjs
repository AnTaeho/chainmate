const R='../../../';
const { createRun } = await import(R+'src/sim/run.js');
const { playRun } = await import(R+'tools/shopbot.mjs');
const { familyCounts, maximFamilies } = await import(R+'src/data/families.js');
const fam = process.argv[2]||'ambush'; const seeds = Number(process.argv[3]||10); const off = Number(process.argv[4]||0);
const agg = { max:0, end:0, offeredAt0:0, offeredAt1:0, bought0:0, bought1:0 };
for (let s=0;s<seeds;s++){
  const run = createRun({ seed: 1000003 + (s+off)*7919 });
  let max=0, lastShopKey=null; const traj=[];
  playRun(run,'smart',{ stopAt:(r)=>{
    const n = familyCounts(r)[fam]; max=Math.max(max,n);
    if (r.phase==='shop'){ const key=r.ante+':'+r.blind; if(key!==lastShopKey){ lastShopKey=key;
      const offers = r.shop.display.filter(it=>it.kind==='maxim' && maximFamilies(it.id).includes(fam)).map(it=>it.id);
      if (offers.length) { if(n===0) agg.offeredAt0+=offers.length; if(n===1) agg.offeredAt1+=offers.length; }
      traj.push(n+(offers.length?'['+offers.join(',')+']':'')); } }
    return false; } });
  const end = familyCounts(run)[fam]; agg.max+=max; agg.end+=end;
  console.log(s, run.phase, 'end',end,'max',max, traj.join(' '));
}
console.log(JSON.stringify(agg));
