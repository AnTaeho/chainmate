// 기록 보내기 자가 확인(CHM-63): 조건을 강제로 켜고 app_open · run_end 한 벌을 진짜 수집 주소로 보낸다. 게임이 쓰는 모듈 · 묶음 꼴 그대로.
//   node tools/telemetry-selftest.mjs
// distinct_id는 selftest-…, 속성 selftest: true — PostHog Activity에서 그 ID로 찾고, 분석 질의에서는 selftest가 없는 것만 센다.
import { createTelemetry, runEndProps } from '../src/ui/telemetry.js';
import { TELEMETRY_HOSTS } from '../src/config.js';
import { VERSION } from '../src/version.js';
import { createRun } from '../src/sim/run.js';
import { newTrack, runRow } from '../src/sim/runlog.js';
import { playRun } from './shopbot.mjs';

const id = `selftest-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;
const answers = [];
const tel = createTelemetry({
  fetch: async (url, init) => {
    const res = await fetch(url, init);
    answers.push({ url, status: res.status, body: await res.text(), events: JSON.parse(init.body).batch.map((e) => e.event) });
    return { ok: res.ok };
  },
  host: TELEMETRY_HOSTS[0], platform: 'web', version: VERSION, ua: 'selftest',
  context: () => ({ lang: 'ko', dan: 0, screen_w: 0, screen_h: 0, scale: 1, screen: 'selftest' }),
  distinctId: id, extra: { selftest: true },
});
// 봇이 둔 판 하나(상점은 그냥 떠나는 none)를 사람 판 줄로
const run = createRun({ seed: 1000003, dan: 0, draft: true });
const { bought, editions, legendAt, seen, holds } = playRun(run, 'none');
const row = runRow(run, { ...newTrack({ startedAt: Date.now(), app: { version: VERSION, commit: null, platform: 'selftest' } }), bought, editions, legendAt, seen, holds }, { end: 'lost', endedAt: new Date().toISOString() });
tel.open();
tel.track('run_end', runEndProps(row));
await tel.flush();
console.log(`distinct_id ${id}`);
for (const a of answers) console.log(`POST ${a.url} [${a.events.join(', ')}] → ${a.status} ${a.body}`);
if (answers.length !== 1 || answers[0].status !== 200) { console.log('보내지 못했다'); process.exit(1); }
