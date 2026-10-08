// 순위(CHM-70)의 조작 막기: 클라이언트가 보낸 명령 줄을 같은 규칙(src/sim)으로 처음부터 다시 두어 성적을 스스로 셈한다.
// 클라이언트가 말한 점수는 받지도 않는다. sim만 쓰는 순수 함수 — Node 시험(test/daily-verify.test.js)과 smoke가 그대로 부른다.
import { applyRun, igniteKey } from '../../src/sim/run.js';
import { createDailyRun } from '../../src/sim/daily.js';

export const LIMITS = { cmds: 5000 };

export class VerifyError extends Error {
  constructor(code, at = null) { super(code); this.code = code; this.at = at; }
}

export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`))
  && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

// 명령 꼴(applyRun · battle apply가 읽는 칸만). 그 밖의 종류 · 칸 · 값은 규칙에 닿기 전에 버린다 —
// 문자열 번호('constructor' 따위)로 배열 · 객체의 딴 곳을 가리키지 못하게 번호는 작은 자연수만 받는다.
const INT = (v) => Number.isInteger(v) && v >= 0 && v < 100000;
const WORD = (v) => typeof v === 'string' && /^[A-Za-z]{1,8}$/.test(v);
const INTS = (v) => Array.isArray(v) && v.length <= 16 && v.every(INT);
const SHAPES = {
  joseki: { index: INT },
  play: {}, skip: {}, leave: {}, shop: {}, skipPack: {}, reroll: {}, reboard: {}, endless: {},
  tactic: { index: INT },
  drop: { handIndex: INT, sq: INT },
  capture: { sq: INT },
  redrop: { sq: INT },
  discard: { handIndices: INTS },
  buy: { slot: INT },
  buyPack: { slot: INT },
  pick: { index: INT, target: [INT] },
  hold: { slot: INT },
  sell: { index: INT },
  use: { index: INT, target: [INT] },
  promote: { pieceId: INT, to: [WORD] },
  remove: { pieceId: INT },
  moveMaxim: { from: INT, to: INT },
};
// 돌려주는 것: 깨끗한 새 명령 객체. 꼴이 틀리면 null. [검사]는 없어도 되는 칸(null · undefined면 뺀다)
export function cleanCmd(cmd) {
  if (!cmd || typeof cmd !== 'object' || Array.isArray(cmd) || typeof cmd.type !== 'string' || !Object.hasOwn(SHAPES, cmd.type)) return null;
  const shape = SHAPES[cmd.type], out = { type: cmd.type };
  for (const k of Object.keys(cmd)) if (k !== 'type' && !Object.hasOwn(shape, k)) return null;
  for (const [k, rule] of Object.entries(shape)) {
    const optional = Array.isArray(rule), check = optional ? rule[0] : rule, v = cmd[k];
    if (v == null) { if (optional) continue; return null; }
    if (!check(v)) return null;
    out[k] = Array.isArray(v) ? v.slice() : v;
  }
  return out;
}

// 판 하나의 성적(순위에 쓰는 것). score_total: 판 전체에서 낸 점수의 합(둔 대국마다 — 8관 마스터전을 다시 두었으면 그 대국들도)
export function summarize(run) {
  const played = run.log.filter((x) => !x.skipped);
  const ig = igniteKey(run);
  return {
    ante: run.ante, blind: run.blind, won: run.phase === 'won' || !!run.endless,
    score_total: played.reduce((a, x) => a + (x.score || 0), 0),
    battles: played.length,
    moves: played.reduce((a, x) => a + (x.moves || 0), 0),
    ignite: ig ? ig.at : null,
  };
}

// 판 하나에 cmds를 차례로 둔다(run을 고친다). 돌려주는 것: { ...summarize, used(쓴 명령 수) }.
// 던지는 것(VerifyError.code): bad_cmds(배열 아님 · 너무 김) · bad_cmd(꼴이 틀리거나 규칙이 거절, at = 몇째) · unfinished(판이 아직 안 끝남).
// 8관 우승 뒤의 명령(끝없는 대국)은 보지 않고 우승 시점에서 끊는다. 진 뒤에 명령이 더 있으면 규칙이 거절한다(bad_cmd).
export function replayRun(run, cmds) {
  if (!Array.isArray(cmds) || cmds.length > LIMITS.cmds) throw new VerifyError('bad_cmds');
  run.cmds = null; // 다시 두는 판은 명령을 또 남기지 않는다
  let used = 0;
  for (; used < cmds.length; used++) {
    if (run.phase === 'won') break;
    const cmd = cleanCmd(cmds[used]);
    if (!cmd || cmd.type === 'endless') throw new VerifyError('bad_cmd', used);
    try { applyRun(run, cmd); } catch { throw new VerifyError('bad_cmd', used); }
  }
  if (run.phase !== 'won' && run.phase !== 'lost') throw new VerifyError('unfinished', used);
  return { ...summarize(run), used };
}

// date의 오늘의 대국 판(화면과 같은 createDailyRun)에 cmds를 다시 둔다. 틀린 날짜는 bad_date
export function verifyDaily(date, cmds) {
  if (!isDate(date)) throw new VerifyError('bad_date');
  return replayRun(createDailyRun(date), cmds);
}
