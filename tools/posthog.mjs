// PostHog에서 사람 판 줄을 내려받는다(CHM-63, docs/design-notes/telemetry.md): run_end 사건의 row = runRow 한 줄(src/sim/runlog.js).
// HogQL Query API(POST /api/projects/:id/query). 개인 API 키 · 프로젝트 id는 환경 변수로만 받는다(저장소에 적지 않는다).
export const POSTHOG_APP = 'https://us.posthog.com';

// 자가 확인(selftest)으로 보낸 것은 뺀다
export const rowsQuery = (days = 90) => `select properties.row, properties.row_trimmed, distinct_id, timestamp from events where event = 'run_end' and timestamp > now() - interval ${Math.max(1, Math.floor(days))} day and properties.selftest is null order by timestamp asc limit 50000`;

// 응답({ results: [[row, row_trimmed, distinct_id, timestamp], …] }) → 판 줄. row는 JSON 글이거나 객체로 온다.
// 같은 id(이긴 뒤 끝없는 대국)는 뒤의 것으로 갈아 끼운다(기기 기록 addRow와 같다). 큰 배열을 뺀 줄(row_trimmed)은 log를 빈 배열로 채운다.
export function parseRows(json) {
  const out = new Map();
  const people = new Set();
  let bad = 0, trimmed = 0;
  for (const r of (json && json.results) || []) {
    let row = Array.isArray(r) ? r[0] : r;
    if (typeof row === 'string') { try { row = JSON.parse(row); } catch { row = null; } }
    if (!row || typeof row !== 'object' || row.ante == null) { bad++; continue; }
    if (!Array.isArray(row.log)) { row.log = []; row.trimmed = true; trimmed++; }
    if (Array.isArray(r) && r[2]) people.add(r[2]);
    const id = row.id ?? `?${out.size}`;
    out.delete(id);
    out.set(id, row);
  }
  return { runs: [...out.values()], bad, trimmed, people: people.size };
}

export async function fetchRows({ key, project, days = 90, host = POSTHOG_APP, fetch = globalThis.fetch }) {
  const res = await fetch(`${host}/api/projects/${encodeURIComponent(project)}/query/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: rowsQuery(days) } }),
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return parseRows(await res.json());
}
