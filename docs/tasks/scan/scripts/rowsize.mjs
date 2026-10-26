const R = '/Users/antaeho/workspace/projects/chainmate/';
const { createRun } = await import(R + 'src/sim/run.js');
const { runRow, newTrack } = await import(R + 'src/sim/runlog.js');
const { playRun } = await import(R + 'tools/shopbot.mjs');
for (const [seed, pol] of [[1, 'smart'], [2, 'smart'], [3, 'random']]) {
  const run = createRun({ seed, unlockTier: 20 });
  const t0 = Date.now();
  playRun(run, pol);
  const row = runRow(run, newTrack(), { end: run.phase });
  const runJson = JSON.stringify(run);
  console.log(pol, seed, 'phase', run.phase, 'ante', run.ante, 'row bytes', JSON.stringify(row).length, 'log bytes', JSON.stringify(row.log).length, 'run state bytes', runJson.length, 'ms', Date.now() - t0);
}
