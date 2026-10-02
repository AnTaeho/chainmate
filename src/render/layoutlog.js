// 개발용 기록기: 한 프레임에 그린 글 상자와 글을 적어 둔다. 연기 시험(tools/smoke.mjs)과 스크린샷 도구가 「글 넘침」을 잰다.
// 꺼져 있으면(LOG.on false) 아무것도 적지 않는다 — 게임은 늘 꺼 둔다.
// 상자 종류(docs/design-notes/layout.md 「검사」):
//   'panel' 'note' 'card' — 글이 안 여백(pad)을 뺀 안쪽에 있어야 한다
//   'edge'  테(또는 칠한 바탕)가 글에 붙는 작은 칸 — 단추 · 칩 · 값 칸 · 작은 표. pad = 테 두께(칠한 바탕만이면 0).
//           글(잉크 11줄)과 테 사이가 네 변 모두 EDGE_CLEAR(2) 이상이어야 한다(「안 여백 검사」).
//           아래로 빠지는 줄(g p y …)은 그 틈에 들어가도 되지만 테에 닿으면 안 된다(1 이상)
//   'tile'  테가 없는 줄(주머니 줄 · 차림표) — 글이 상자 안에만 있으면 된다(pad 0)
// 글의 네모는 실제 잉크(Galmuri11 12px): text()의 y부터 11줄(한글 · 숫자 · 대문자), 아래로 빠지는 글자(g j p q y ,)는 2줄 더.
//   빠지는 줄은 안 여백 안으로 들어가도 되지만 테에 닿으면 안 된다(상자 안쪽 끝까지).
// 테 기록(box()): 열린 상자와 상관없이 그린 테를 모두 적는다. 같은 상자(또는 둘 다 상자 밖)에서 그린 글이 그 테를 가로지르면 어긴 것 —
//   openBox를 잊은 그리기 길(옛 격언 칸 둘째 줄처럼)도 잡는다.
// overlay: 다른 상자 위에 뜨는 것(말풍선 · 낱말 상자 · 처음 안내 · 차림표 · 끄는 카드). 상자끼리 겹침을 재지 않는다.
// loose: 연출 중(뒤집히는 카드 등)이라 이번 프레임은 재지 않는다.
// clips: 이번 프레임에 줄이거나 자른 글(「잘린 글」 검사, layout.md 「잘린 글 검사」) — logClip
export const LOG = { on: false, boxes: [], texts: [], frames: [], stack: [], layer: 0, folded: [], clips: [] };
export const EDGE_CLEAR = 2;          // 'edge' 칸: 글과 테 사이 최소 틈
export const INK_H = 11, INK_DESC = 2; // 글자 잉크 높이 · 아래로 빠지는 글자의 더 내려가는 줄(12px, 1배)
const DESC = /[gjpqy,]/;

export function logBegin() {
  if (!LOG.on) return;
  LOG.boxes = []; LOG.texts = []; LOG.frames = []; LOG.stack = []; LOG.layer = 0; LOG.folded = []; LOG.clips = [];
}
export function openBox(kind, x, y, w, h, pad = 0, { overlay = false, loose = false, name = '' } = {}) {
  if (!LOG.on) return;
  const parent = LOG.stack[LOG.stack.length - 1] || null;
  const b = { kind, x, y, w, h, pad, overlay: overlay || !!(parent && parent.overlay), loose: loose || !!(parent && parent.loose), name, parent, layer: LOG.layer };
  LOG.boxes.push(b);
  LOG.stack.push(b);
}
export function closeBox() { if (LOG.on) LOG.stack.pop(); }
// 덮개(멈춤 · 설정 …)를 그리기 전에: 그 아래 화면의 상자와는 겹침을 재지 않는다
export function layerUp() { if (LOG.on) LOG.layer++; }
// 글 하나: 잉크 네모(text()의 y부터 INK_H × scale), 아래로 빠지는 글자가 있으면 d(INK_DESC × scale)만큼 더
export function logText(s, x, y, w, scale = 1) {
  if (!LOG.on) return;
  LOG.texts.push({ s, x, y, w, h: INK_H * scale, d: DESC.test(s) ? INK_DESC * scale : 0, box: LOG.stack[LOG.stack.length - 1] || null, layer: LOG.layer });
}
// 줄이거나 자른 글 하나(「잘린 글」 검사): kind 'thin' 보통 굵기로 줄임 · 'cut' 끝을 「…」로 · 'char' 낱말을 글자 단위로 끊음.
// src 원문, shown 그려진 글(끊김은 줄을 「 / 」로 이어), w 자리 폭. 그때 열려 있던 상자(이름 · 연출 여부)에 묶인다
export function logClip(kind, src, shown, w) {
  if (!LOG.on) return;
  const box = LOG.stack[LOG.stack.length - 1] || null;
  LOG.clips.push({ kind, src: String(src), shown: String(shown), w, box: box ? box.name || box.kind : '', loose: !!(box && box.loose), layer: LOG.layer });
}
// 그린 테 하나(gfx.js box()): 그때 열려 있던 상자에 묶인다
export function logFrame(x, y, w, h) {
  if (!LOG.on) return;
  const box = LOG.stack[LOG.stack.length - 1] || null;
  LOG.frames.push({ x, y, w, h, box, layer: LOG.layer, overlay: !!(box && box.overlay), loose: !!(box && box.loose) });
}

const inside = (r, x0, y0, x1, y1) => r.x >= x0 && r.y >= y0 && r.x + r.w <= x1 && r.y + r.h <= y1;
const cross = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const where = (b) => `${b.name || b.kind}@${b.x},${b.y} ${b.w}×${b.h}`;

// 이번 프레임의 어긴 곳: [{ what: 'text'|'screen'|'overlap', msg }]
export function checkLayout({ W = 480, H = 270 } = {}) {
  const out = [];
  for (const t of LOG.texts) {
    if (!t.s.trim()) continue;
    const b = t.box;
    if (b && b.loose) continue;
    const full = { x: t.x, y: t.y, w: t.w, h: t.h + t.d };
    const at = `(${t.x},${t.y} ${t.w}×${t.h}${t.d ? `+${t.d}` : ''})`;
    if (t.x < 0 || t.y < 0 || t.x + t.w > W || t.y + full.h > H) { out.push({ what: 'screen', msg: `「${t.s}」 화면 밖 (${t.x},${t.y})` }); continue; }
    if (!b) {
      // 상자 밖에 쓴 글(이름표 · 머리줄)이 같은 층의 상자를 덮으면 넘친 것(뜨는 상자 · 연출 상자는 빼고)
      const hit = LOG.boxes.find((q) => !q.overlay && !q.loose && q.layer === t.layer && cross(full, q));
      if (hit) { out.push({ what: 'text', msg: `「${t.s}」 ${at} ∩ ${where(hit)}` }); continue; }
    }
    // 같은 상자 안(또는 둘 다 상자 밖)에서 그린 테를 가로지르면 넘친 것: 테 안에 다 들지도, 테 밖에 다 있지도 않다
    const fr = LOG.frames.find((q) => q.box === b && q.layer === t.layer && !q.loose && cross(full, q) && !inside(full, q.x, q.y, q.x + q.w, q.y + q.h));
    if (fr) { out.push({ what: 'text', msg: `「${t.s}」 ${at} 테를 가로지름 ${fr.x},${fr.y} ${fr.w}×${fr.h}${b ? ` (${where(b)})` : ''}` }); continue; }
    if (!b) continue;
    if (b.kind === 'edge') {
      // 안 여백 검사: 글(빠지는 줄 포함)과 테 사이가 네 변 모두 EDGE_CLEAR 이상
      const e = b.pad + EDGE_CLEAR;
      if (!inside(t, b.x + e, b.y + e, b.x + b.w - e, b.y + b.h - e) || !inside(full, b.x, b.y, b.x + b.w, b.y + b.h - b.pad - 1)) out.push({ what: 'pad', msg: `「${t.s}」 ${at} 테에 붙음 ${where(b)} 테 ${b.pad} + 틈 ${EDGE_CLEAR}` });
      continue;
    }
    const px = typeof b.pad === 'object' ? b.pad.x : b.pad, py = typeof b.pad === 'object' ? b.pad.y : b.pad, p = typeof b.pad === 'object' ? `${px}·${py}` : b.pad;
    // 잉크(11줄)는 안 여백 안, 아래로 빠지는 줄은 상자 테(1) 안
    const edge = b.kind === 'tile' ? 0 : 1;
    if (!inside(t, b.x + px, b.y + py, b.x + b.w - px, b.y + b.h - py) || !inside(full, b.x + edge, b.y + edge, b.x + b.w - edge, b.y + b.h - edge)) out.push({ what: 'text', msg: `「${t.s}」 ${at} ⊄ ${where(b)} 여백 ${p}` });
  }
  // 상자끼리: 같은 부모 아래의, 뜨지 않는 상자끼리 겹치면 어긴 것. 상자는 화면 안에
  const solid = LOG.boxes.filter((b) => !b.overlay && !b.loose);
  for (let i = 0; i < solid.length; i++) {
    const a = solid[i];
    if (a.x < 0 || a.y < 0 || a.x + a.w > W || a.y + a.h > H) out.push({ what: 'screen', msg: `${where(a)} 화면 밖` });
    for (let j = i + 1; j < solid.length; j++) {
      const b = solid[j];
      if (a.parent !== b.parent || a.layer !== b.layer) continue;
      if (cross(a, b)) out.push({ what: 'overlap', msg: `${where(a)} ∩ ${where(b)}` });
    }
  }
  return out;
}

// 설명이 덮은 글(docs/design-notes/layout.md 「설명 자리 규칙」 · 「검사」): 이번 프레임에 그린 설명 묶음 · 처음 안내 네모(rects)가
// 그 아래 화면의 글(다른 판넬 · 카드 · 칩 · 가리킨 것)을 덮었는지. 같은 층(덮개를 열었으면 덮개 층)에서, 뜨지 않는 상자의 글만 잰다.
// 돌려주는 값: [{ s, x, y, w, h, self }] — self는 가리킨 것(anchor) 안의 글
export function coveredTexts(rects, anchor = null) {
  if (!LOG.on || !rects || !rects.length) return [];
  const top = LOG.layer;
  const out = [];
  for (const t of LOG.texts) {
    if (!t.s.trim() || t.layer !== top) continue;
    const b = t.box;
    if (b && (b.overlay || b.loose)) continue;
    const ink = { x: t.x, y: t.y, w: t.w, h: t.h + t.d };
    if (!rects.some((r) => cross(ink, r))) continue;
    out.push({ s: t.s, x: t.x, y: t.y, w: t.w, h: ink.h, self: !!(anchor && cross(ink, anchor)) });
  }
  return out;
}

// 설명 자리 접기(src/ui/fold.js): 그 네모를 판넬 바탕으로 다시 칠해 지운 글은 화면에 없다 — 기록에서 빼고 접은 글로 옮긴다
export function foldLog(r) {
  if (!LOG.on) return;
  const keep = [];
  for (const t of LOG.texts) {
    const ink = { x: t.x, y: t.y, w: t.w, h: t.h + t.d };
    if (t.layer === LOG.layer && !(t.box && (t.box.overlay || t.box.loose)) && cross(ink, r)) LOG.folded.push(t);
    else keep.push(t);
  }
  LOG.texts = keep;
}
