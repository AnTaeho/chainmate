// 시험 자료: smart 봇이 둔 오늘의 대국 판의 명령 줄 · 기대 성적(test/fixtures/daily-<날짜>-smart.json). smart 봇 한 판이 30초라
// test/daily-verify.test.js가 이 파일을 다시 둔다(C-4). 규칙을 바꿔 그 시험이 bad_cmd · 다른 성적으로 떨어지면 다시 만든다:
//   node tools/fixture-daily.mjs [날짜=2026-10-08]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDailyRun } from '../src/sim/daily.js';
import { playRun } from './shopbot.mjs';
import { summarize } from '../api/_lib/verify.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const date = process.argv[2] || '2026-10-08';
const run = createDailyRun(date);
playRun(run, 'smart');
const out = join(ROOT, `test/fixtures/daily-${date}-smart.json`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ date, policy: 'smart', want: summarize(run), cmds: run.cmds }) + '\n');
console.log(`${out}: 명령 ${run.cmds.length}개 · ${run.phase} · ${run.ante}관`);
