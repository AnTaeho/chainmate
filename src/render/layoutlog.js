// 개발용 기록기: 한 프레임에 그린 글 상자와 글을 적어 둔다. 연기 시험(tools/smoke.mjs)과 스크린샷 도구가 「글 넘침」을 잰다.
// 꺼져 있으면(LOG.on false) 아무것도 적지 않는다 — 게임은 늘 꺼 둔다.
// 상자 종류(docs/design-notes/layout.md 「검사」):
//   'panel' 'note' 'card' — 글이 안 여백(pad)을 뺀 안쪽에 있어야 한다
//   'tile'  단추 · 칩 · 값 칸 — 글이 상자 안에만 있으면 된다(pad 0). 칩은 가로 여백만({ x: CHIP_PAD, y: 0 })
// overlay: 다른 상자 위에 뜨는 것(말풍선 · 낱말 상자 · 처음 안내 · 차림표 · 끄는 카드). 상자끼리 겹침을 재지 않는다.
// loose: 연출 중(뒤집히는 카드 등)이라 이번 프레임은 재지 않는다.
export const LOG = { on: false, boxes: [], texts: [], stack: [], layer: 0 };

export function logBegin() {
  if (!LOG.on) return;
  LOG.boxes = []; LOG.texts = []; LOG.stack = []; LOG.layer = 0;
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
// 글 하나: 글자가 찍히는 네모(text()의 y 한 칸 아래부터 12)
export function logText(s, x, y, w, h) {
  if (!LOG.on) return;
  LOG.texts.push({ s, x, y, w, h, box: LOG.stack[LOG.stack.length - 1] || null, layer: LOG.layer });
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
    if (t.x < 0 || t.y < 0 || t.x + t.w > W || t.y + t.h > H) { out.push({ what: 'screen', msg: `「${t.s}」 화면 밖 (${t.x},${t.y})` }); continue; }
    if (!b) {
      // 상자 밖에 쓴 글(이름표 · 머리줄)이 같은 층의 상자를 덮으면 넘친 것(뜨는 상자 · 연출 상자는 빼고)
      const hit = LOG.boxes.find((q) => !q.overlay && !q.loose && q.layer === t.layer && cross(t, q));
      if (hit) out.push({ what: 'text', msg: `「${t.s}」 (${t.x},${t.y} ${t.w}×${t.h}) ∩ ${where(hit)}` });
      continue;
    }
    const px = typeof b.pad === 'object' ? b.pad.x : b.pad, py = typeof b.pad === 'object' ? b.pad.y : b.pad, p = typeof b.pad === 'object' ? `${px}·${py}` : b.pad;
    if (!inside(t, b.x + px, b.y + py, b.x + b.w - px, b.y + b.h - py)) out.push({ what: 'text', msg: `「${t.s}」 (${t.x},${t.y} ${t.w}×${t.h}) ⊄ ${where(b)} 여백 ${p}` });
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
