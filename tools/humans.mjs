// 사람 판 요약(CHM-50): 설정 「기록 내보내기」로 받은 JSON을 판 하네스와 같은 꼴로 찍는다. --vs로 하네스 dump를 나란히.
//   node tools/humans.mjs <내보낸.json> [--vs <run.mjs --dump 파일>]
// 판 줄의 열쇠는 하네스 dump와 같다(docs/design-notes/human-runs.md). 판 단위 수치는 끝낸 판(이김 · 짐 · 끝없는 대국)만,
// 대국 단위 수치(희생 · 진 대국의 자리)는 그만둔 판의 대국까지 센다. 하네스 dump에는 단이 없어(--dan 한 값) 단별은 사람 판만.
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { FAMILIES, THRESHOLDS } from '../src/data/families.js';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const file = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--vs');
if (!file) { console.error('쓰는 법: node tools/humans.mjs <내보낸.json> [--vs <run.mjs dump>]'); process.exit(1); }
const load = (p) => { const d = JSON.parse(readFileSync(p, 'utf8')); return Array.isArray(d) ? d : d.runs || []; };
const H = load(file);
const vsFile = opt('--vs');
const V = vsFile ? load(vsFile) : null;

const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + '%' : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const dw = (x) => [...String(x)].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x1100 ? 2 : 1), 0);
const table = (cols, rows) => {
  const w = cols.map((c, i) => Math.max(dw(c), ...rows.map((r) => dw(r[i]))));
  const line = (r) => r.map((x, i) => ' '.repeat(w[i] - dw(x)) + x).join('  ');
  console.log(line(cols));
  for (const r of rows) console.log(line(r));
};
const pctile = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.round(p * (s.length - 1)))]; };

// 판 묶음 하나의 수치
function stats(R) {
  const done = R.filter((r) => r.end !== 'quit');
  const n = done.length;
  const battles = R.flatMap((r) => r.log.filter((x) => !x.skipped));
  const wonB = battles.filter((b) => b.won), lostB = battles.filter((b) => !b.won);
  const disc = (bs) => bs.reduce((a, b) => a + (b.discarded || 0), 0) / Math.max(1, bs.length);
  const brR = done.filter((r) => r.log.some((x) => (x.brilliants || []).length));
  const antes = [];
  for (let a = 1; a <= 8; a++) {
    const bs = battles.filter((b) => b.ante === a);
    antes.push({
      reached: done.filter((r) => r.won || r.ante >= a).length / n, cleared: done.filter((r) => r.won || r.ante > a).length / n,
      n: bs.length, ratio: pctile(bs.filter((b) => b.reason !== 'mate' && b.target).map((b) => b.score / b.target), 0.5),
      lost: bs.filter((b) => !b.won).length, lostRatio: pctile(bs.filter((b) => !b.won && b.target).map((b) => b.score / b.target), 0.5),
    });
  }
  const fam = FAMILIES.map((f) => ({ name: f.name, avg: done.reduce((a, r) => a + ((r.fam || {})[f.id] || 0), 0) / Math.max(1, n), on: done.filter((r) => ((r.fam || {})[f.id] || 0) >= THRESHOLDS[0]).length / n }));
  const famOn = done.map((r) => FAMILIES.filter((f) => ((r.fam || {})[f.id] || 0) >= THRESHOLDS[0]).length);
  const share = (k) => battles.filter((b) => (k >= 3 ? (b.discarded || 0) >= 3 : (b.discarded || 0) === k)).length / Math.max(1, battles.length);
  return {
    runs: R.length, n, quits: R.length - n, win: done.filter((r) => r.won).length / n,
    battles: battles.length, perRun: battles.length / Math.max(1, R.length),
    sac: disc(battles), sacWon: disc(wonB), sacLost: disc(lostB), sacShare: [0, 1, 2, 3].map(share),
    brRuns: brR.length / n, brPerBattle: battles.reduce((a, b) => a + (b.brilliants || []).length, 0) / Math.max(1, battles.length),
    antes, fam, famOn: famOn.reduce((a, x) => a + x, 0) / Math.max(1, n),
    mates: battles.filter((b) => b.reason === 'mate').length / Math.max(1, battles.length),
    clock: R.reduce((a, r) => a + r.log.filter((x) => x.clockLost).length, 0) / Math.max(1, R.length),
  };
}

const h = stats(H);
const v = V ? stats(V) : null;
const two = (fn) => (v ? [fn(h), fn(v)] : [fn(h)]);
const vsName = V ? basename(vsFile) : null;

console.log(`사람 판 ${h.runs}개(끝낸 ${h.n} · 그만둠 ${h.quits}) — 판 승률 ${pc(h.win)}, 대국 ${h.battles}(판당 ${f2(h.perRun)}), 체크메이트 ${pc(h.mates)}, 판당 잃은 시계 ${f2(h.clock)}`);
if (v) console.log(`봇 ${vsName} ${v.runs}판 — 판 승률 ${pc(v.win)}, 대국 ${v.battles}(판당 ${f2(v.perRun)}), 체크메이트 ${pc(v.mates)}, 판당 잃은 시계 ${f2(v.clock)}`);
const secs = H.map((r) => r.sec).filter((x) => Number.isFinite(x) && x > 0);
const hms = (t) => (t >= 3600 ? `${Math.floor(t / 3600)}시간 ${Math.round((t % 3600) / 60)}분` : t >= 60 ? `${Math.floor(t / 60)}분 ${Math.round(t % 60)}초` : `${Math.round(t)}초`);
if (secs.length) console.log(`판 시간: p50 ${hms(pctile(secs, 0.5))} · 가장 긴 판 ${hms(Math.max(...secs))} · 합 ${hms(secs.reduce((a, x) => a + x, 0))}`);
const apps = {}; for (const r of H) { const k = r.app ? `${r.app.platform || '?'} ${r.app.version || '?'}${r.app.commit ? ' ' + r.app.commit : ''}` : '?'; apps[k] = (apps[k] || 0) + 1; }
console.log(`앱 판: ${Object.entries(apps).map(([k, x]) => `${k} ${x}판`).join(' · ')}`);

console.log('\n관별: 도달 · 통과(끝낸 판) · 대국 · 점수/목표 p50(체크메이트 빼고)' + (v ? ' — 왼쪽 사람 | 오른쪽 봇' : ''));
const acols = ['관', '도달', '통과', '대국', '점수/목표p50'];
table(v ? [...acols, '|', '봇 도달', '통과', '대국', 'p50'] : acols, h.antes.map((a, i) => {
  const row = [String(i + 1), pc(a.reached), pc(a.cleared), String(a.n), f2(a.ratio)];
  if (!v) return row;
  const b = v.antes[i];
  return [...row, '|', pc(b.reached), pc(b.cleared), String(b.n), f2(b.ratio)];
}));

console.log('\n희생: 대국당 바친 기물(0번 · 1번 · 2번 · 3번+) · 이긴 대국 · 진 대국');
table(['', '대국당', '0번', '1번', '2번', '3번+', '이긴 대국', '진 대국'], two((s) => [s === h ? '사람' : '봇', f2(s.sac), ...s.sacShare.map(pc), f2(s.sacWon), f2(s.sacLost)]));

console.log('\n탁월수: 나온 판(끝낸 판 중) · 대국당');
table(['', '탁월수 판', '대국당'], two((s) => [s === h ? '사람' : '봇', pc(s.brRuns), (s.brPerBattle || 0).toFixed(3)]));

console.log(`\n시너지(판 끝): 판마다 문턱 ${THRESHOLDS[0]} 넘은 시너지 수 평균 — 사람 ${f2(h.famOn)}${v ? ` · 봇 ${f2(v.famOn)}` : ''}`);
table(v ? ['시너지', '평균 수', `${THRESHOLDS[0]} 이상 판`, '|', '봇 평균', `${THRESHOLDS[0]} 이상`] : ['시너지', '평균 수', `${THRESHOLDS[0]} 이상 판`],
  h.fam.map((x, i) => (v ? [x.name, f2(x.avg), pc(x.on), '|', f2(v.fam[i].avg), pc(v.fam[i].on)] : [x.name, f2(x.avg), pc(x.on)])));

console.log('\n진 대국의 자리: 관별 진 대국 수 · 진 대국 점수/목표 p50(시계를 잃고 이어진 대국 포함)');
table(v ? ['관', '진 대국', '점수/목표p50', '|', '봇 진 대국', 'p50'] : ['관', '진 대국', '점수/목표p50'],
  h.antes.map((a, i) => (v ? [String(i + 1), String(a.lost), f2(a.lostRatio), '|', String(v.antes[i].lost), f2(v.antes[i].lostRatio)] : [String(i + 1), String(a.lost), f2(a.lostRatio)])));
const ends = {}; for (const r of H) ends[r.end || '?'] = (ends[r.end || '?'] || 0) + 1;
console.log(`판이 끝난 꼴: ${Object.entries(ends).map(([k, x]) => `${k} ${x}`).join(' · ')}`);

console.log('\n단별(사람 판, 끝낸 판)' + (v ? ' — 봇 dump에는 단이 없다(하네스 --dan 한 값)' : ''));
const dans = [...new Set(H.map((r) => r.dan || 0))].sort((a, b) => a - b);
table(['단', '레이팅', '판', '승률', '평균 관', '그만둠'], dans.map((d) => {
  const all = H.filter((r) => (r.dan || 0) === d), done = all.filter((r) => r.end !== 'quit');
  return [String(d), String(800 + 200 * d), String(done.length), pc(done.filter((r) => r.won).length / done.length), f2(done.reduce((a, r) => a + r.ante, 0) / Math.max(1, done.length)), String(all.length - done.length)];
}));
