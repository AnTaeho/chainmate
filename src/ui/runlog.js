// 사람 판 기록의 저장(CHM-50): localStorage 한 열쇠(KEYS.runs)에 { v, runs: [판 요약] }. 판 요약은 src/sim/runlog.js runRow.
// 판이 끝날 때(이김 · 짐 · 끝없는 대국 끝 · 새 판으로 덮어씀)만 쓴다. 저장이 꽉 차면 오래된 판부터 덜어 다시 쓴다.
import { KEYS } from './save.js';
import { addRow, exportPayload, RUNLOG_MAX } from '../sim/runlog.js';

export function loadRuns(store) {
  const d = store.get(KEYS.runs, null);
  return d && d.v === 1 && Array.isArray(d.runs) ? d.runs : [];
}

// 한 판을 더한다(같은 id면 갈아 끼움). 돌려주는 값: 남은 판 수(쓰지 못했으면 -1)
export function keepRow(store, row, max = RUNLOG_MAX) {
  let runs = addRow(loadRuns(store), row, max);
  while (runs.length) {
    if (store.set(KEYS.runs, { v: 1, runs })) return runs.length;
    runs = runs.slice(Math.ceil(runs.length / 4)); // 꽉 찼다: 오래된 네 몫 하나를 덜고 다시
  }
  return -1;
}

// 내보낼 JSON 글과 파일 이름
export function exportText(store, { app = null, now = new Date() } = {}) {
  const runs = loadRuns(store);
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return { n: runs.length, name: `chainmate-runs-${stamp}.json`, text: JSON.stringify(exportPayload(runs, { app, exportedAt: now.toISOString() })) };
}
