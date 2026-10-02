// 사람 판 기록(CHM-50): 판 하나를 판 하네스(tools/run.mjs --dump)의 판별 항목과 같은 열쇠로 요약한다.
// 하네스는 봇이 판 동안 센 것(bought · editions · legendAt · seen)을 shopbot.playRun이 돌려주고, 사람 판은 화면이
// 명령마다 trackCommand로 run.track에 센다. 같은 열쇠를 같은 뜻으로 — test/runlog.test.js가 하네스 판 하나와 값까지 견준다.
// 열쇠 표: docs/design-notes/human-runs.md. 순수 함수(DOM 없음), 상태는 JSON 왕복 안전.
import { PIECES } from '../data/pieces.js';
import { familyCounts } from '../data/families.js';

export const RUNLOG_MAX = 200;   // 기기에 남기는 판 수(오래된 것부터 버린다)

const clone = (x) => JSON.parse(JSON.stringify(x));
const emptySeen = () => ({ maxims: 0, slots: 0, editions: {}, fragDisplay: 0, packs: 0, fragPack: 0, golden: 0 });

// 판을 시작할 때 하나. app = { version, commit, platform }. startedAt: 시작 시각(ms, 옛 저장에서 이어 붙인 판은 null)
export function newTrack({ startedAt = null, app = null } = {}) {
  return { v: 1, startedAt, sec: 0, bought: [], editions: [], legendAt: null, seen: emptySeen(), buys: [], script: [], app };
}

// 명령 바로 앞의 판 모습(trackCommand가 견줄 것)
export function trackBefore(run) {
  return {
    phase: run.phase, logLen: run.log.length,
    scripted: !!(run.battle && run.battle.script),
    uids: run.maxims.map((m) => m.uid),
    pack: run.pack ? clone(run.pack.options) : null,
  };
}

// shopbot noteDisplay · notePack과 같은 셈: 상점에 들어설 때(꾸러미에서 돌아올 때와 「상점으로 돌아가기」는 빼고) · 다시 뽑을 때 진열, 꾸러미를 살 때 꾸러미
function noteDisplay(seen, run) {
  for (const it of run.shop.display) {
    seen.slots++;
    if (it.kind === 'maxim') { seen.maxims++; if (it.edition) seen.editions[it.edition] = (seen.editions[it.edition] || 0) + 1; }
    if (it.kind === 'fragment') seen.fragDisplay++;
  }
}
function notePack(seen, run) {
  if (run.pack.kind === 'golden') seen.golden++;
  else seen.packs++;
  if (run.pack.options.some((o) => o.kind === 'fragment')) seen.fragPack++;
}
const itemId = (it) => it.id ?? it.form ?? it.t ?? it.legend ?? null;

// 명령 하나가 끝난 뒤: before = trackBefore(명령 앞의 run). track을 고친다.
export function trackCommand(track, run, cmd, events, before) {
  // 대본 대국(킹과 두는 첫 대국)의 줄은 기록에서 뺀다 — 그 대국이 끝나며 늘어난 log 자리를 적어 둔다
  if (before.scripted && run.log.length > before.logLen) for (let i = before.logLen; i < run.log.length; i++) track.script.push(i);
  if (run.phase === 'shop' && run.shop && cmd.type !== 'shop' && before.phase !== 'shop' && before.phase !== 'pack') noteDisplay(track.seen, run);
  if (cmd.type === 'reroll') noteDisplay(track.seen, run);
  if (cmd.type === 'buyPack' && run.pack) notePack(track.seen, run);
  // 산 격언(하네스 bought: 상점에서 새로 든 격언 id, 겹치면 한 번 · editions: 판본마다)
  if (cmd.type === 'buy' || cmd.type === 'pick') {
    for (const m of run.maxims) if (!before.uids.includes(m.uid)) {
      if (!track.bought.includes(m.id)) track.bought.push(m.id);
      if (m.edition) track.editions.push(m.edition);
    }
  }
  if (track.legendAt == null && run.legends.length) track.legendAt = run.ante;
  // 산 것 모두(사람 판에만): 관 · 대국 · 종류 · id · 값, 꾸러미에서 고른 것은 pack: 1
  const at = { a: run.ante, b: run.blind };
  for (const e of events) if (e.type === 'buy') track.buys.push({ ...at, k: e.item.kind, id: itemId(e.item), $: e.item.price ?? null });
  if (cmd.type === 'buyPack' && run.pack) { const pk = run.shop && run.shop.packs[cmd.slot]; track.buys.push({ ...at, k: 'pack', id: run.pack.kind, $: pk ? pk.price ?? null : null }); }
  if (cmd.type === 'pick' && before.pack) { const o = before.pack[cmd.index]; if (o) track.buys.push({ ...at, k: o.kind, id: itemId(o), $: null, pack: 1 }); }
  return track;
}

// 판 하나의 요약. 하네스 dump의 판별 열쇠(seed … awakened)를 같은 뜻으로, 그 뒤에 사람 판에만 있는 열쇠.
// end: 'won' | 'lost' | 'quit'(새 판으로 덮어씀) | 'endless'(이긴 뒤 끝없는 대국이 끝남).
// won은 결과 화면과 같이 「8관을 꺾었나」(끝없는 대국에서 져도 이긴 판). 하네스 판에는 끝없는 대국이 없다.
export function runRow(run, track, { end = null, endedAt = null, id = null } = {}) {
  const tr = track || newTrack();
  const skip = new Set(tr.script || []);
  const log = clone(run.log.filter((_, i) => !skip.has(i)));
  const played = log.filter((x) => !x.skipped);
  const won = run.phase === 'won' || !!run.endless;
  const row = {
    // ── 하네스 dump와 같은 열쇠(tools/run.mjs one())
    seed: run.seed, won, ante: run.ante, blind: run.blind,
    log, bought: [...tr.bought], final: run.maxims.filter((m) => !m.legendary).map((m) => m.id), money: run.money,
    fragments: clone(run.fragments), legends: [...run.legends], legendAt: tr.legendAt, editions: [...tr.editions], seen: clone(tr.seen),
    deck: run.deck.map((p) => p.t + (p.eng ? ':' + p.eng.id : '')).sort().join(' '),
    charts: Object.values(run.charts).reduce((a, x) => a + x, 0), deckSize: run.deck.length,
    fam: familyCounts(run), josekis: [...(run.josekis || [])], fairies: [...new Set(run.deck.filter((p) => PIECES[p.t].fairy).map((p) => p.t))],
    best: Math.max(0, ...played.map((x) => x.best || 0)),
    souls: [...new Set(log.flatMap((b) => b.souls || []))], cracked: clone(run.cracked || []), awakened: clone(run.awakened || []),
    // ── 사람 판에만
    human: 1,
    id: id ?? `${tr.startedAt ?? 0}:${run.seed}`,
    end: end ?? (won ? 'won' : run.phase === 'lost' ? 'lost' : 'quit'),
    dan: run.dan || 0, opening: run.opening, daily: run.daily || null,
    endless: run.endless ? run.ante : null,
    startedAt: tr.startedAt, endedAt, sec: Math.round(tr.sec || 0),
    battles: played.length,
    sacrifices: played.reduce((a, b) => a + (b.discarded || 0), 0),
    brilliants: played.reduce((a, b) => a + (b.brilliants || []).length, 0),
    lostAt: played.filter((b) => !b.won).map((b) => ({ ante: b.ante, blind: b.blind, kind: b.kind, score: b.score, target: b.target, pct: b.target ? Math.round((1000 * b.score) / b.target) / 10 : null, reason: b.reason, clockLost: !!b.clockLost })),
    buys: clone(tr.buys || []),
    script: skip.size,
    app: tr.app ? { ...tr.app } : null,
  };
  return row;
}

// 기록 목록에 한 판: 같은 id면 갈아 끼운다(이긴 뒤 끝없는 대국). 오래된 것부터 버려 max개까지.
export function addRow(list, row, max = RUNLOG_MAX) {
  const out = list.filter((r) => r.id !== row.id);
  out.push(row);
  return out.length > max ? out.slice(out.length - max) : out;
}

// 내보낼 꼴: 하네스 dump처럼 { …, runs: [판] }
export function exportPayload(runs, { app = null, exportedAt = null } = {}) {
  return { kind: 'chainmate-runs', v: 1, exportedAt, app, runs };
}
