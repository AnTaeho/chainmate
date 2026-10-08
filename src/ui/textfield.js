// 글자 입력 칸(CHM-72, docs/design-notes/layout.md 24절): 아이디 · 비번은 브라우저 입력 칸(DOM <input>)을 캔버스 위에 겹쳐 받는다 —
// 비번 관리자 · 폰 키보드 · 붙여넣기가 되게. 입력 칸은 이 모듈로만 만든다.
// 화면은 그릴 때마다 app.fields.field(id, 칸)을 부르고, 그 프레임에 부르지 않은 칸은 치워진다(화면을 떠나면 남는 칸이 없다 — app.go도 한 번 더 치운다).
// 값은 입력 칸에만 있다(화면 상태 · 저장 · 기록 보내기로 옮기지 않는다). doc가 없으면(Node 시험) 같은 꼴로 값만 든다.
import { GW, toClient } from './fit.js';

export const FIELD_FONT = 12;
// 아이디 칸: 영문 소문자 · 숫자 · _만 남긴다(대문자는 소문자로)
export const USERNAME_FILTER = (v) => String(v).toLowerCase().replace(/[^a-z0-9_]/g, '');
// 폰 세로(돌려 그린 화면)에서 초점이 가면 칸을 화면 위쪽에 바로 세워 쌓는다: 칸 높이 · 이름표 높이 · 사이
export const LIFT = { pad: 12, label: 18, h: 40, gap: 10, font: 16 };

// 게임 좌표의 칸 { x, y, w, h } → 창 좌표. rect: 보이는 캔버스의 사각형(돌렸으면 세운 사각형), rot: 폰 세로로 돌려 그렸나.
// 돌렸으면 칸의 왼쪽 위 구석에서 시계 방향 90도로 돌린다(transform-origin 0 0) — 게임 가로가 창 아래쪽으로 자란다
export function placeField(f, rect, rot = false) {
  const scale = (rot ? rect.height : rect.width) / GW;
  const [left, top] = toClient(f.x, f.y, rect, rot);
  return { left, top, width: f.w * scale, height: f.h * scale, rot: !!rot, scale, font: FIELD_FONT * scale };
}
// 위쪽에 쌓는 자리(i째 칸): 창 폭 vw, 위 안전 영역 safeTop
export function liftField(i, vw, safeTop = 0) {
  const top = safeTop + LIFT.pad + i * (LIFT.label + LIFT.h + LIFT.gap);
  return { labelTop: top, left: LIFT.pad, top: top + LIFT.label, width: Math.max(80, vw - LIFT.pad * 2), height: LIFT.h, font: LIFT.font };
}
// 키보드가 칸을 가리면 화면을 이만큼 올린다: 칸 아랫변(창 좌표)이 보이는 창 아랫변 - 여유보다 아래면 그 차이
export const keyboardLift = (fieldBottom, visibleBottom, margin = 8) => Math.max(0, Math.ceil(fieldBottom + margin - visibleBottom));

const px = (v) => `${Math.round(v * 100) / 100}px`;

// doc · win: 브라우저(없으면 값만 드는 가짜). canvas: 게임 캔버스(자리의 기준). rot: () => 돌려 그렸나. safeTop: () => 위 안전 영역(CSS 화소)
export function createFields({ doc = null, win = null, canvas = null, rot = () => false, safeTop = () => 0 } = {}) {
  const dom = !!(doc && doc.body && doc.createElement && canvas);
  const items = new Map(); // id → { id, spec, el, label, value(가짜일 때), seen, geo, rejected }
  let form = null, lifted = false, fakeFocus = null;
  const fields = { dom, onFocus: null };

  const active = () => {
    if (!dom) return fakeFocus && items.has(fakeFocus) ? items.get(fakeFocus) : null;
    for (const it of items.values()) if (doc.activeElement === it.el) return it;
    return null;
  };
  fields.focused = () => { const it = active(); return it ? it.id : null; };
  fields.owns = (el) => { if (!el) return false; for (const it of items.values()) if (it.el === el) return true; return false; };
  fields.count = () => items.size;
  fields.ids = () => [...items.keys()];
  fields.lifted = () => lifted;

  function ensureForm() {
    if (form || !dom) return;
    form = doc.createElement('form');
    form.className = 'tf';
    form.setAttribute('novalidate', '');
    form.setAttribute('autocomplete', 'on');
    form.addEventListener('submit', (e) => { if (e && e.preventDefault) e.preventDefault(); const it = active() || [...items.values()].pop(); if (it && it.spec.enter) it.spec.enter(); });
    // 위쪽에 쌓은 동안 어두운 바탕을 누르면 초점을 푼다
    form.addEventListener('mousedown', (e) => { if (lifted && e && e.target === form) fields.blur(); });
    form.addEventListener('touchstart', (e) => { if (lifted && e && e.target === form) fields.blur(); });
    // Enter로 내려면 form에 제출 단추가 있어야 한다(보이지 않는다)
    const go = doc.createElement('button');
    go.type = 'submit'; go.className = 'tf-go'; go.tabIndex = -1; go.setAttribute('aria-hidden', 'true');
    form.appendChild(go);
    doc.body.appendChild(form);
  }
  function dropForm() { if (form && !items.size) { form.remove(); form = null; lifted = false; } }

  function make(id, spec) {
    const it = { id, spec, el: null, label: null, value: '', seen: true, geo: null, rejected: false };
    items.set(id, it);
    if (!dom) return it;
    ensureForm();
    const el = doc.createElement('input'), label = doc.createElement('label');
    el.id = `tf-${id}`; el.name = spec.name || id; el.type = spec.type === 'password' ? 'password' : 'text';
    el.className = 'tf-in';
    el.setAttribute('autocomplete', spec.autocomplete || 'off');
    el.setAttribute('autocapitalize', 'off'); el.setAttribute('autocorrect', 'off'); el.setAttribute('spellcheck', 'false');
    el.setAttribute('enterkeyhint', spec.hint || 'go');
    if (spec.type !== 'password') { el.setAttribute('inputmode', 'text'); el.setAttribute('lang', 'en'); }
    if (spec.max) el.maxLength = spec.max;
    label.htmlFor = el.id; label.setAttribute('for', el.id); label.className = 'tf-label'; label.textContent = spec.label || id;
    // 걸러 낸 글자가 있으면 알린다(한글 자판으로 친 아이디). 조합 중인 글자는 끝난 뒤에 거른다
    // typed: 사람이 방금 친 것(걸러 낸 글자가 없으면 알림을 거둔다). 초점이 풀릴 때는 남은 글자만 거른다
    const filter = (typed) => {
      if (!it.spec.filter) return;
      const v = String(el.value), w = it.spec.filter(v), cut = w.length < v.length;
      if (typed || cut) it.rejected = cut;
      if (w !== v) el.value = w;
    };
    el.addEventListener('input', (e) => { if (e && e.isComposing) return; filter(true); });
    el.addEventListener('compositionend', () => filter(true));
    el.addEventListener('focus', () => { fields.layout(); if (fields.onFocus) fields.onFocus(id); });
    el.addEventListener('blur', () => { filter(false); const t = () => { fields.layout(); if (fields.onFocus) fields.onFocus(fields.focused()); }; if (win && win.setTimeout) win.setTimeout(t, 0); else t(); });
    form.appendChild(label); form.appendChild(el);
    it.el = el; it.label = label;
    return it;
  }
  function remove(it) {
    if (it.el) { try { if (doc.activeElement === it.el) it.el.blur(); } catch { /* 그대로 */ } it.el.remove(); it.label.remove(); }
    if (fakeFocus === it.id) fakeFocus = null;
    items.delete(it.id);
  }

  // ── 화면이 부르는 것
  fields.begin = () => { for (const it of items.values()) it.seen = false; };
  // 칸 하나: { x, y, w, h(게임 좌표), label, type: 'text' | 'password', autocomplete, name, max, filter, enter(Enter를 눌렀을 때), hint, auto(만들 때 초점) }
  fields.field = (id, spec) => {
    let it = items.get(id);
    const fresh = !it;
    if (!it) it = make(id, spec); else { it.spec = spec; it.seen = true; }
    if (dom) {
      if (it.label.textContent !== (spec.label || id)) it.label.textContent = spec.label || id;
      const geo = `${spec.x},${spec.y},${spec.w},${spec.h}`;
      if (geo !== it.geo) { it.geo = geo; place(it, [...items.keys()].indexOf(id)); }
    }
    if (fresh && spec.auto) fields.focus(id);
  };
  fields.end = () => { for (const it of [...items.values()]) if (!it.seen) remove(it); dropForm(); };
  fields.clear = () => { for (const it of [...items.values()]) remove(it); dropForm(); };
  fields.value = (id) => { const it = items.get(id); return it ? String(it.el ? it.el.value : it.value) : ''; };
  fields.set = (id, v) => {
    const it = items.get(id);
    if (!it) return;
    const w = it.spec.filter ? it.spec.filter(v) : String(v);
    it.rejected = !!it.spec.filter && w.length < String(v).length;
    if (it.el) it.el.value = w; else it.value = w;
  };
  fields.rejected = (id) => { const it = items.get(id); return !!(it && it.rejected); };
  fields.focus = (id) => { const it = items.get(id); if (!it) return; if (it.el) { try { it.el.focus(); } catch { /* 그대로 */ } } else fakeFocus = id; };
  fields.blur = () => { const it = active(); if (!it) return; if (it.el) { try { it.el.blur(); } catch { /* 그대로 */ } } else fakeFocus = null; };
  // Enter(가짜 · 시험): 초점이 있는 칸의 enter
  fields.enter = () => { const it = active(); if (it && it.spec.enter) it.spec.enter(); };
  // 칸의 창 좌표 자리(시험 · 도구가 읽는다)
  fields.rectOf = (id) => { const it = items.get(id); return it && it.at ? { ...it.at } : null; };

  function place(it, i) {
    if (!dom) return;
    const s = it.el.style, ls = it.label.style, r = rot();
    if (lifted) {
      const at = liftField(i, (win && win.innerWidth) || 320, safeTop());
      it.at = { left: at.left, top: at.top, width: at.width, height: at.height, rot: false, lift: true };
      s.left = px(at.left); s.top = px(at.top); s.width = px(at.width); s.height = px(at.height);
      s.fontSize = px(at.font); s.transform = ''; s.borderWidth = '2px'; s.padding = '0 10px';
      ls.left = px(at.left); ls.top = px(at.labelTop); ls.fontSize = '14px';
      return;
    }
    const at = placeField(it.spec, canvas.getBoundingClientRect(), r);
    it.at = { left: at.left, top: at.top, width: at.width, height: at.height, rot: at.rot, lift: false };
    s.left = px(at.left); s.top = px(at.top); s.width = px(at.width); s.height = px(at.height);
    s.fontSize = px(at.font); s.transform = at.rot ? 'rotate(90deg)' : '';
    s.borderWidth = px(Math.max(1, Math.round(at.scale))); s.padding = `0 ${px(4 * at.scale)}`;
    ls.left = ''; ls.top = ''; ls.fontSize = '';
  }
  // 창 크기 · 배율 · 회전 · 초점이 바뀌면 다시 놓는다(main.js refit · 초점 사건)
  fields.layout = () => {
    if (!dom || !form) return;
    const want = !!rot() && !!active();
    if (want !== lifted) { lifted = want; if (form.classList) form.classList.toggle('lift', lifted); }
    let i = 0;
    for (const it of items.values()) place(it, i++);
  };
  return fields;
}
