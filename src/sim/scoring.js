// 점수 파이프라인. 값 × 연쇄.
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
//   onCapture      먹을 때마다(기본 값·연쇄를 더한 뒤). ctx.event = { from, to, piece(먹힌 종류), form(먹을 때의 모습), dist, index, forced, born }
//   onTransform    모습이 바뀔 때. ctx.event = { from, to }  (종류가 같으면 안 불림)
//   onPromote      승급. ctx.event = { sq }
//   onForced       응수가 걸렸을 때(이어짐). ctx.event = { sq, attackers }
//   onCut          끊김 직전. ctx.cancelCut()을 부르면 끊김이 무시되고 응수 제한이 풀린 채 사슬이 이어진다.
//   onChainEnd     사슬이 끝날 때(끊김 · 막힘 · 외통). ctx.event = { reason }. ×연쇄는 여기서.
//                  ctx.chain.scoreMul(기본 1)을 곱하면 최종 점수 배율(예: 명인 「앙갚음」 0.5).
//   onBoard        대국판이 바뀐 뒤(시작 · 먹기 · 증원). 화면용 표시를 ctx.t.hints에 적는다. 점수와 무관, 풀이기는 부르지 않는다.
//
// 사슬 밖에 남는 것: ctx.addMoney(n) — 이번 사슬에서 번 상금(chain.money). 대국이 모아 판(런)에 넘긴다.
// 명세에 off: true가 붙으면 그 조정자는 꺼진다(명인 「침묵」 · 「대가」).
// 정의의 onRunEvent(spec, ev)는 판(런)이 부른다: 대국 밖에서 명세 data를 바꾸는 자리
//   (ev.type: 'chartUsed' | 'battleWon'). 대국 안의 state는 대국마다 새로 시작한다.
//
// 순서: 기본 규칙이 먼저, 그다음 종류 순서(KIND_ORDER) — 같은 종류 안에서는 t.mods의 배열 순서.
//   먹기 훅: 명인 → 기보 → 각인 → 격언   (DESIGN 「점수」 1~3)
//   사슬 끝: (기보) → 각인 → 격언 → 명인  (DESIGN 「점수」 4, 명인은 마지막에 판을 비튼다)
// 최종 점수 = floor(값 × 연쇄 × scoreMul).

import { attackers } from './board.js';

export const HOOKS = ['onBattleStart', 'onDropCheck', 'onDrop', 'allowCapture', 'onCapture', 'onTransform', 'onPromote', 'onForced', 'onCut', 'onChainEnd', 'onBoard'];
export const KINDS = ['master', 'chart', 'engraving', 'maxim'];
const DEFAULT_ORDER = ['master', 'chart', 'engraving', 'maxim'];
export const KIND_ORDER = {
  onChainEnd: ['chart', 'engraving', 'maxim', 'master'],
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
const NONE = [];
function ordered(t, hook) {
  const mods = t.mods || NONE;
  const eng = t.chain && t.chain.engraving;
  let withKind = null;
  const order = KIND_ORDER[hook] || DEFAULT_ORDER;
  const n = mods.length + (eng ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const spec = i < mods.length ? mods[i] : eng;
    if (spec.off) continue;
    const def = REGISTRY.get(spec.id);
    if (!def) throw new Error(`unknown modifier ${spec.id}`);
    if (!def[hook]) continue;
    (withKind || (withKind = [])).push({ spec, def, k: order.indexOf(spec.kind || def.kind), i });
  }
  if (!withKind) return NONE;
  if (withKind.length > 1) withKind.sort((a, b) => a.k - b.k || a.i - b.i);
  return withKind;
}

// 훅이 받는 ctx. 메서드는 프로토타입에 두어 부를 때마다 닫힘을 만들지 않는다.
class Ctx {
  constructor(t, spec, event, events) {
    this.t = t; this.chain = t.chain; this.event = event; this.spec = spec;
    this.data = spec.data || {};
    this.rules = t.rules;
    this.flags = t.chain ? t.chain.flags : null;
    this._events = events;
    this._cancel = false;
  }
  get state() { return this.spec.state || (this.spec.state = {}); }
  addValue(n) { if (!n) return; this.chain.value += n; this._events.push({ type: 'score', src: this.spec.id, value: n }); }
  addMult(n) { if (!n) return; this.chain.mult += n; this._events.push({ type: 'score', src: this.spec.id, mult: n }); }
  mulMult(x) { if (x === 1) return; this.chain.mult *= x; this._events.push({ type: 'score', src: this.spec.id, xmult: x }); }
  addMoney(n) { if (!n) return; this.chain.money = (this.chain.money || 0) + n; this._events.push({ type: 'money', src: this.spec.id, money: n }); }
  // 지금 sq를 노리는 적 칸(명인 「철벽」 반영)
  attackers(sq) { return attackers(this.t.board, sq, this.t.rules && this.t.rules.pawnSides ? { pawnSides: true } : {}); }
  cancelCut() { this._cancel = true; }
  emit(ev) { this._events.push({ ...ev, src: this.spec.id }); }
}

// 훅을 차례로 부른다. 돌려주는 값: allowCapture면 허용 여부, onCut이면 취소 여부, 그 밖엔 없음.
export function runHook(t, hook, event, events = []) {
  const list = ordered(t, hook);
  let allowed = true, cancelled = false;
  for (const { spec, def } of list) {
    if (spec.off) continue; // 앞선 조정자가 이번 훅 안에서 끈 경우(「침묵」)
    const ctx = new Ctx(t, spec, event, events);
    const r = def[hook](ctx);
    if (hook === 'allowCapture' && r === false) allowed = false;
    if (ctx._cancel) cancelled = true;
  }
  if (hook === 'allowCapture') return allowed;
  if (hook === 'onCut') return cancelled;
  return undefined;
}

// 탐색 · 조회용 가지치기: 명세 겉과 state만 새로 만들고 data는 같이 쓴다(대국 안의 훅은 data를 바꾸지 않는다).
// 탐색 중 훅이 state를 바꿔도(또는 새로 만들어도) 원래 대국의 명세에 새지 않는다.
export const forkSpec = (s) => (s ? (s.state ? { ...s, state: JSON.parse(JSON.stringify(s.state)) } : { ...s }) : s);
export const forkSpecs = (mods) => (mods && mods.length ? mods.map(forkSpec) : mods);

export const hasHook = (t, hook) => ordered(t, hook).length > 0;

export const finalScore = (chain) => Math.floor(chain.value * chain.mult * (chain.scoreMul ?? 1));

// ── 기보(모습별 레벨) 조정자. 표는 step 2의 data/charts.js가 넘긴다.
// 명세: { id: 'charts', data: { table: { P: { a: 10, b: 1 }, ... }, levels: { N: 2, ... } } }
// 「먹을 때의 모습」(event.form) 기준으로 값 += a×레벨, 연쇄 += b×레벨.
defineModifier('charts', {
  kind: 'chart',
  onCapture(ctx) {
    const form = ctx.event.form;
    const lv = (ctx.data.levels || {})[form] || 0;
    const row = (ctx.data.table || {})[form];
    if (!lv || !row) return;
    ctx.addValue((row.a || 0) * lv);
    ctx.addMult((row.b || 0) * lv);
  },
});
