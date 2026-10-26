// 사람 판 기록의 저장(CHM-50): localStorage 한 열쇠(KEYS.runs)에 { v, runs: [판 요약] }. 판 요약은 src/sim/runlog.js runRow.
// 판이 끝날 때(이김 · 짐 · 끝없는 대국 끝 · 새 판으로 덮어씀)만 쓴다. 저장이 꽉 차면 오래된 판부터 덜어 다시 쓴다.
import { KEYS } from './save.js';
import { addRow, exportPayload, RUNLOG_MAX } from '../sim/runlog.js';
import { renameOldPieces } from '../sim/oldsave.js';

export function loadRuns(store) {
  const d = store.get(KEYS.runs, null);
  return d && d.v === 1 && Array.isArray(d.runs) ? renameOldPieces(d.runs) : []; // 뺀 기물(CHM-55)은 새 기물로
}

// 판 기록이 차지할 수 있는 글자 수(판 하나 약 18KB — 200줄이면 360만 자로 브라우저 저장 한도(WebKit 한글 섞이면 260만 자)에 닿아
// 진행 중인 판 · 기록 저장이 말없이 실패했다, P-6 · C-11). 줄 수 상한 RUNLOG_MAX와 둘 다 지킨다
export const RUNLOG_CHARS = 1200000;
// 한 판을 더한다(같은 id면 갈아 끼움). 돌려주는 값: 남은 판 수(쓰지 못했으면 -1)
export function keepRow(store, row, max = RUNLOG_MAX) {
  let runs = addRow(loadRuns(store), row, max);
  while (runs.length > 1 && JSON.stringify(runs).length > RUNLOG_CHARS) runs = runs.slice(Math.ceil(runs.length / 4));
  while (runs.length) {
    if (store.set(KEYS.runs, { v: 1, runs })) return runs.length;
    runs = runs.slice(Math.ceil(runs.length / 4)); // 꽉 찼다: 오래된 네 몫 하나를 덜고 다시
  }
  return -1;
}

// 다른 저장(진행 중인 판 · 기록)이 꽉 차 실패했을 때: 판 기록의 오래된 네 몫 하나를 덜어 자리를 낸다. 덜 것이 없으면 거짓
export function makeRoom(store) {
  const runs = loadRuns(store);
  if (!runs.length) return false;
  const rest = runs.slice(Math.ceil(runs.length / 4));
  if (!rest.length) { store.del(KEYS.runs); return true; }
  return store.set(KEYS.runs, { v: 1, runs: rest }) || (store.del(KEYS.runs), true);
}

// 내보낼 JSON 글과 파일 이름
export function exportText(store, { app = null, now = new Date() } = {}) {
  const runs = loadRuns(store);
  const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
  return { n: runs.length, name: `chainmate-runs-${stamp}.json`, text: JSON.stringify(exportPayload(runs, { app, exportedAt: now.toISOString() })) };
}
