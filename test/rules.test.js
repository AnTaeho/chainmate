// 규칙 판본(src/sim/rules.js): 규칙 파일이 바뀌면 RULES_VERSION도 올라야 한다 — 안 올리면 옛 규칙으로 둔 오늘의 대국이 새 서버에서
// 다른 결과로 다시 두어져 422로 조용히 버려진다(C-1). 글자 하나라도 바꿨으면 판본을 올리고 `node tools/rules-hash.mjs --write`
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rulesHash, rulesFiles, FIXTURE } from '../tools/rules-hash.mjs';
import { RULES_VERSION } from '../src/sim/rules.js';
import { createDailyRun } from '../src/sim/daily.js';

test('규칙 파일 해시가 기록과 같다(다르면 RULES_VERSION을 올리고 node tools/rules-hash.mjs --write)', () => {
  const want = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const now = rulesHash();
  assert.ok(rulesFiles().includes('api/_lib/verify.js') && rulesFiles().some((p) => p.startsWith('src/data/')) && !rulesFiles().some((p) => p.startsWith('src/data/i18n')));
  if (now !== want.hash) assert.ok(RULES_VERSION > want.version, `규칙 파일이 바뀌었는데 RULES_VERSION(${RULES_VERSION})이 그대로다 — 올리고 node tools/rules-hash.mjs --write`);
  assert.equal(now, want.hash, '해시 기록을 고쳐라: node tools/rules-hash.mjs --write (오늘의 대국 시험 자료도: node tools/fixture-daily.mjs)');
  assert.equal(RULES_VERSION, want.version, '기록의 판본과 RULES_VERSION이 다르다: node tools/rules-hash.mjs --write');
});

test('오늘의 대국 판은 시작한 규칙 판본을 적는다', () => {
  assert.equal(createDailyRun('2026-10-26').rulesVersion, RULES_VERSION);
});
