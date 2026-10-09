// 점수 파이프라인. 값 × 배수.
//
// 조정자(modifier)는 두 조각으로 나뉜다.
//   정의(def)  — defineModifier(id, def)로 등록하는 함수 묶음. 코드에만 있고 저장되지 않는다.
//   명세(spec) — 대국 상태에 들어가는 순수 데이터 { id, kind?, data?, state? }. JSON으로 저장된다.
//                data = 레벨·수치 같은 고정 인수, state = 조정자가 대국 동안 스스로 바꾸는 값(예: 「희생」 사용 여부).
// 대국 상태의 t.mods(명인 · 기보 · 격언 순서대로, 격언은 왼쪽부터)와, 떨군 기물의 각인 명세(chain.engraving)가 켜진다.
//
// 훅(모두 선택). 각 훅은 ctx 하나를 받는다(아래 makeCtx).
//   onBattleStart  대국 시작, 판을 만들기 전. ctx.rules를 고쳐 수·손·킹 수 등을 바꿀 수 있다.
//   onDropCheck    떨굴 칸을 셀 때. ctx.event = { type, engraving, allow }. ctx.event.allow.attacked = true 로 노려진 칸 허용(각인 「깃」).
//   onDrop         떨군 직후. ctx.event = { type, sq }. ctx.flags로 사슬 규칙 깃발을 세울 수 있다.
//   allowCapture   먹을 칸을 걸러 낼 때. ctx.event = { from, to, piece, form }. false를 돌려주면 금지.
//   onCapture      먹을 때마다(기본 값·배수를 더한 뒤). ctx.event = { from, to, piece(먹힌 종류), form(먹을 때의 모습), dist, index, forced, born }
//   onTransform    모습이 바뀔 때. ctx.event = { from, to }  (종류가 같으면 안 불림)
//   onPromote      승급. ctx.event = { sq }
//   onForced       응수가 걸렸을 때(이어짐). ctx.event = { sq, attackers }
//   onCut          끊김 직전. ctx.cancelCut()을 부르면 끊김이 무시되고 응수 제한이 풀린 채 사슬이 이어진다.
//   onMate         외통 직후(마지막 킹을 먹음). ctx.keepGoing()을 부르면 대국을 끝내는 대신 판이 다시 채워지고
//                  내 기물은 킹 모습으로 사슬을 잇는다(전설 「오페라 대국」). ctx.event = { sq, mates }
//   onChainStop    사슬이 멈출 때, 점수를 매기기 전(끊김 · 막힘. 외통은 빼고). ctx.event = { reason }.
//                  ctx.redrop()을 부르면 기물을 들어 지금 모습 그대로 떨굴 칸을 다시 고른다 — 값 · 배수를 이어받는 두 번째 사슬(사슬당 한 번, 전설 「상록의 대국」).
//   onChainEnd     사슬이 끝날 때(끊김 · 막힘 · 외통). ctx.event = { reason }. ×배수는 여기서.
//                  ctx.chain.scoreMul(기본 1)을 곱하면 최종 점수 배율(예: 명인 「앙갚음」 0.5).
//   onBoard        대국판이 바뀐 뒤(시작 · 먹기 · 증원). 화면용 표시를 ctx.t.hints에 적는다. 점수와 무관, 풀이기는 부르지 않는다.
//   ── 밤샘 2(가짓수 늘리기)에서 더한 일반 훅
//   onSetup        판을 다 깐 뒤(대국 시작 · 다시 놓기). 판 위 적 · 사물을 고칠 수 있다(정석 「횃불」 · 「함정」 · 「선수」).
//                  ctx.rng()는 (대국 시드, 조정자 id, 몇째 다시 놓기)로 정해진 난수.
//   onArrive       증원 하나가 들어오기 직전. ctx.event = { sq, t }. ctx.event.caught = true면 들어오지 않고 먹은 것으로(값을 점수에 곧바로).
//   onBattleEnd    대국이 끝날 때. ctx.event = { status, reason }. ctx.addBattleMoney(n)로 상금.
//   onChainLuck    사슬이 끝나 점수를 대국에 더하기 직전(battle.js endMove에서만 — 풀이기는 모른다, 각인 「유리」와 같은 자리).
//                  ctx.roll()은 대국의 운 흐름에서 0~1, ctx.rescore(x)는 사슬 배수를 곱하고 점수를 다시 셈한다.
//   onBuild(spec, build)  판(런)이 대국 조정자를 꾸릴 때(run.js battleMods). 짜임(덱 · 격언 칸)에서 셀 값을 spec.data에 적는다.
//
// 사슬 밖에 남는 것: ctx.addMoney(n) — 이번 사슬에서 번 상금(chain.money). 대국이 모아 판(런)에 넘긴다.
// 명세에 off: true가 붙으면 그 조정자는 꺼진다(명인 「침묵」 · 「대가」).
// 정의의 onRunEvent(spec, ev)는 판(런)이 부른다: 대국 밖에서 명세 data를 바꾸는 자리
//   (ev.type: 'chartUsed' | 'battleWon'). 대국 안의 state는 대국마다 새로 시작한다.
//
// 순서: 기본 규칙이 먼저, 그다음 종류 순서(KIND_ORDER) — 같은 종류 안에서는 t.mods의 배열 순서.
//   먹기 훅: 명인 → 기보 → 각인 → 격언   (DESIGN 「점수」 1~3)
//   사슬 끝: (기보) → 각인 → 격언 → 명인  (DESIGN 「점수」 4, 명인은 마지막에 판을 비튼다)
// 최종 점수 = floor(값 × 배수 × scoreMul).

import { attackers } from './board.js';
import { chartForm } from '../data/pieces.js';
import { createRng, fork, next } from './rng.js';

export const HOOKS = ['onBattleStart', 'onDropCheck', 'onDrop', 'allowCapture', 'onCapture', 'onTransform', 'onPromote', 'onThreat', 'onForced', 'onCut', 'onMate', 'onBlocked', 'onChainStop', 'onChainEnd', 'onBoard', 'onSetup', 'onArrive', 'onBattleEnd', 'onChainLuck'];
// ctx가 「기본 결말을 물린다」를 돌려줄 수 있는 훅: onCut(cancelCut) · onMate(keepGoing) · onChainStop(redrop)
//   · onThreat(ignoreThreat — 먹은 칸의 노림을 이번 한 번 없는 것으로, 깊이 B 「도약」) · onBlocked(keepGoing — 막혔을 때 한 번 더, 「변신」)
const CANCEL_HOOKS = new Set(['onCut', 'onMate', 'onChainStop', 'onThreat', 'onBlocked']);
// 종류: 세력의 버릇 · 명인(세력의 우두머리) · 기보 · 가족(깊이 B) · 정석(E) · 각인 · 혼(C) · 격언
export const KINDS = ['faction', 'master', 'chart', 'family', 'joseki', 'engraving', 'soul', 'maxim'];
const DEFAULT_ORDER = ['faction', 'master', 'chart', 'family', 'joseki', 'engraving', 'soul', 'maxim'];
export const KIND_ORDER = {
  onChainEnd: ['chart', 'family', 'joseki', 'engraving', 'soul', 'maxim', 'faction', 'master'],
};

const REGISTRY = new Map();

export function defineModifier(id, def) {
  if (!def.kind || !KINDS.includes(def.kind)) throw new Error(`modifier ${id}: kind must be one of ${KINDS}`);
  REGISTRY.set(id, { id, ...def });
  return REGISTRY.get(id);
}
export const getModifier = (id) => REGISTRY.get(id);
export const undefineModifier = (id) => REGISTRY.delete(id);

// 켜진 명세 목록을 훅 순서대로. 훅이 없으면 빈 배열(탐색 중 가장 흔한 경우라 아무것도 만들지 않는다).
// 돌려주는 값: [{ i, def }] — i는 (mods … , 각인, 혼) 안의 자리. 풀이기가 마디마다 mods를 복사하므로
// 차례는 (명세 id · 꺼짐 줄 + 훅 + 각인 · 혼)을 열쇠로 한 번만 정렬해 둔다(깊이 층으로 조정자가 늘어 정렬이 탐색 시간의 18%였다).
const NONE = [];
// 차례 표: 명세 열쇠(문자열 — 복사본끼리 같은 문자열 객체를 나눠 쓴다) → 훅 → 각인 id → 혼 id → 차례.
// 열쇠를 마디마다 이어 붙여 새 문자열을 만들면 조정자가 많을 때 그 해시가 탐색 시간의 30%였다(CHM-44). 고르는 차례는 같다.
const PLANS = new Map();
let planCount = 0;
function modsKey(mods) {
  let k = mods._key;
  if (k === undefined) {
    k = mods.map((s) => s.id + (s.off ? '!' : '')).join(',');
    Object.defineProperty(mods, '_key', { value: k, writable: true, enumerable: false, configurable: true });
  }
  return k;
}
function ordered(t, hook) {
  const mods = t.mods || NONE;
  const eng = t.chain && t.chain.engraving;
  const soul = t.chain && t.chain.soul;
  const cacheable = hook !== 'onBattleStart' && mods !== NONE;
  let bySoul = null;
  const sk = soul ? soul.id : '';
  if (cacheable) {
    const mk = modsKey(mods);
    let byHook = PLANS.get(mk);
    if (!byHook) PLANS.set(mk, (byHook = new Map()));
    let byEng = byHook.get(hook);
    if (!byEng) byHook.set(hook, (byEng = new Map()));
    const ek = eng ? eng.id : '';
    bySoul = byEng.get(ek);
    if (!bySoul) byEng.set(ek, (bySoul = new Map()));
    const hit = bySoul.get(sk);
    if (hit) return hit;
  }
  let withKind = null;
  const order = KIND_ORDER[hook] || DEFAULT_ORDER;
  const n = mods.length + (eng ? 1 : 0) + (soul ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const spec = specAt(mods, eng, soul, i);
    if (spec.off) continue;
    const def = REGISTRY.get(spec.id);
    if (!def) throw new Error(`unknown modifier ${spec.id}`);
    if (!def[hook]) continue;
    (withKind || (withKind = [])).push({ def, k: order.indexOf(spec.kind || def.kind), i });
  }
  let plan = NONE;
  if (withKind) { if (withKind.length > 1) withKind.sort((a, b) => a.k - b.k || a.i - b.i); plan = withKind; }
  if (bySoul) {
    if (planCount > 5000) { PLANS.clear(); planCount = 0; }
    else { bySoul.set(sk, plan); planCount++; }
  }
  return plan;
}
const specAt = (mods, eng, soul, i) => (i < mods.length ? mods[i] : i === mods.length && eng ? eng : soul);

// 훅이 받는 ctx. 메서드는 프로토타입에 두어 부를 때마다 닫힘을 만들지 않는다.
class Ctx {
  constructor(t, spec, event, events, i = -1) {
    this.t = t; this.chain = t.chain; this.event = event; this.spec = spec; this._i = i;
    this.data = spec.data || {};
    this.rules = t.rules;
    this.flags = t.chain ? t.chain.flags : null;
    this._events = events;
    this._cancel = false;
  }
  get state() {
    // 풀이기 탁자(t._cow)는 명세를 부모와 나눠 쓰다가 state에 처음 손대는 순간 제 것으로 갈라 낸다(ownSpec)
    const spec = this.t._cow ? (this.spec = ownSpec(this.t, this._i, this.spec)) : this.spec;
    return spec.state || (spec.state = {});
  }
  addValue(n) { if (!n) return; this.chain.value += n; this._events.push({ type: 'score', src: this.spec.id, value: n }); }
  addMult(n) { if (!n) return; this.chain.mult += n; this._events.push({ type: 'score', src: this.spec.id, mult: n }); }
  mulMult(x) { if (x === 1) return; this.chain.mult *= x; this._events.push({ type: 'score', src: this.spec.id, xmult: x }); }
  addMoney(n) { if (!n) return; this.chain.money = (this.chain.money || 0) + n; this._events.push({ type: 'money', src: this.spec.id, money: n }); }
  // 지금 sq를 노리는 적 칸(명인 「철벽」 반영)
  attackers(sq) { return attackers(this.t.board, sq, this.t.rules && this.t.rules.pawnSides ? { pawnSides: true } : {}); }
  cancelCut() { this._cancel = true; }
  keepGoing() { this._cancel = true; }
  redrop() { this._cancel = true; }
  ignoreThreat() { this._cancel = true; }
  emit(ev) { this._events.push({ ...ev, src: this.spec.id }); }
  // ── 대국 쪽(사슬 밖에서 부르는 훅용)
  addBattleMoney(n) { if (!n) return; this.t.money = (this.t.money || 0) + n; this._events.push({ type: 'money', src: this.spec.id, money: n }); }
  rng() { if (!this._rng) this._rng = fork(createRng((this.t.seed ?? 1) >>> 0), `${this.spec.id}:${this.t.reboards || 0}`); return next(this._rng); }
  roll() { return this.t._luck ? this.t._luck() : 1; }
  rescore(x) { if (x === 1) return; this.chain.mult *= x; this.chain.score = finalScore(this.chain); this._events.push({ type: 'score', src: this.spec.id, xmult: x, luck: true }); }
}

// 훅을 차례로 부른다. 돌려주는 값: allowCapture면 허용 여부, onCut · onMate · onChainStop이면 기본 결말을 물렸나, 그 밖엔 없음.
export function runHook(t, hook, event, events = []) {
  const list = ordered(t, hook);
  let allowed = true, cancelled = false;
  const mods = t.mods || NONE, eng = t.chain && t.chain.engraving, soul = t.chain && t.chain.soul;
  for (const { i, def } of list) {
    const spec = specAt(mods, eng, soul, i);
    if (spec.off) continue; // 앞선 조정자가 이번 훅 안에서 끈 경우(「침묵」)
    const ctx = new Ctx(t, spec, event, events, i);
    const r = def[hook](ctx);
    if (hook === 'allowCapture' && r === false) allowed = false;
    if (ctx._cancel) cancelled = true;
  }
  // 대국 시작 훅은 명세를 끌 수 있다(「침묵」): 차례 열쇠를 다시 만든다
  if (hook === 'onBattleStart' && t.mods && t.mods._key !== undefined) t.mods._key = undefined;
  if (hook === 'allowCapture') return allowed;
  if (CANCEL_HOOKS.has(hook)) return cancelled;
  return undefined;
}

// 탐색 · 조회용 가지치기: 명세 겉과 state만 새로 만들고 data는 같이 쓴다(대국 안의 훅은 data를 바꾸지 않는다).
// 탐색 중 훅이 state를 바꿔도(또는 새로 만들어도) 원래 대국의 명세에 새지 않는다.
// state 복사: JSON 왕복과 똑같은 결과를 더 싸게(탐색 마디마다 부르는 곳이라 왕복이 시간의 10%였다, CHM-44).
// 평범한 객체 · 배열 안의 문자열 · 참거짓 · null · 유한한 수(−0 빼고)만 직접 베끼고, 그 밖의 값이 하나라도 보이면 통째로 JSON 왕복한다.
const BAIL = Symbol('bail');
function plainCopy(v) {
  if (v === null) return null;
  const ty = typeof v;
  if (ty === 'string' || ty === 'boolean') return v;
  if (ty === 'number') return Number.isFinite(v) && !Object.is(v, -0) ? v : BAIL;
  if (ty !== 'object') return BAIL;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) { if (!(i in v)) return BAIL; const x = plainCopy(v[i]); if (x === BAIL) return BAIL; out[i] = x; }
    return out;
  }
  if (Object.getPrototypeOf(v) !== Object.prototype) return BAIL;
  const out = {};
  for (const k of Object.keys(v)) { const x = plainCopy(v[k]); if (x === BAIL) return BAIL; out[k] = x; }
  return out;
}
const copyState = (st) => { const x = plainCopy(st); return x === BAIL ? JSON.parse(JSON.stringify(st)) : x; };
export const forkSpec = (s) => (s ? (s.state ? { ...s, state: copyState(s.state) } : { ...s }) : s);
export const forkSpecs = (mods) => {
  if (!mods || !mods.length) return mods;
  const out = mods.map(forkSpec);
  if (mods._key !== undefined) Object.defineProperty(out, '_key', { value: mods._key, writable: true, enumerable: false, configurable: true });
  return out;
};

// 풀이기의 탁자 복사(CHM-44): 명세를 마디마다 모두 복사(forkSpecs)하는 대신 배열만 새로 만들어 명세를 부모와 나눠 쓰고,
// 훅이 state를 읽거나 쓰려는 순간(Ctx.state) 그 명세 하나만 forkSpec으로 갈라 낸다. 탐색 중 명세에서 바뀌는 것은 state뿐이라
// (data는 대국 안에서 바뀌지 않고, off는 대국 시작 훅만 바꾼다) 모두 복사할 때와 결과가 같다.
// t._cow[i]: i번째 명세(mods … , 각인, 혼 — specAt 차례)를 이 탁자가 이미 제 것으로 갈라 냈나.
export const cowSpecs = (mods) => {
  if (!mods || !mods.length) return mods;
  const out = mods.slice();
  if (mods._key !== undefined) Object.defineProperty(out, '_key', { value: mods._key, writable: true, enumerable: false, configurable: true });
  return out;
};
function ownSpec(t, i, spec) {
  const cow = t._cow;
  if (i < 0 || cow[i]) return spec;
  cow[i] = 1;
  const f = forkSpec(spec);
  const mods = t.mods || NONE;
  if (i < mods.length) mods[i] = f;
  else if (i === mods.length && t.chain && t.chain.engraving) t.chain.engraving = f;
  else t.chain.soul = f;
  return f;
}

export const hasHook = (t, hook) => ordered(t, hook).length > 0;

export const finalScore = (chain) => Math.floor(chain.value * chain.mult * (chain.scoreMul ?? 1));

// ── 기보(모습별 레벨) 조정자. 표는 step 2의 data/charts.js가 넘긴다.
// 명세: { id: 'charts', data: { table: { P: { a: 10, b: 1 }, ... }, levels: { N: 2, ... } } }
// 「먹을 때의 모습」(event.form) 기준으로 값 += a×레벨, 배수 += b×레벨.
// 이형 모습은 바탕이 된 체스 모습의 기보를 따른다(pieces.js chart).
defineModifier('charts', {
  kind: 'chart',
  onCapture(ctx) {
    const form = chartForm(ctx.event.form);
    const lv = (ctx.data.levels || {})[form] || 0;
    const row = (ctx.data.table || {})[form];
    if (!lv || !row) return;
    ctx.addValue((row.a || 0) * lv);
    ctx.addMult((row.b || 0) * lv);
  },
});
