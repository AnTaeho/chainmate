// 연기 시험용 가짜 DOM: 캔버스 컨텍스트는 그리기 호출을 세기만 한다(setTransform · translate · rotate · putImageData도 센다). 입력은 등록된 듣개에 직접 넣는다.
// 글 폭은 실제 글꼴(굵게 Black Han Sans · 보통 Chainmate Sans KR)의 글자 폭 표(tools/fonts/widths.json — 브라우저에서 잰 표, node tools/fontwidths.mjs)를 더한다 —
// 연기 시험의 「글 넘침」이 실제 화면과 맞게. 표는 1/1000 em(올림)이고 글꼴 크기(font의 px)를 곱한다. 짝 글자 사이 좁힘(커닝)은 빼서 실제보다 조금 넓거나 같다.
import fs from 'node:fs';
import { FACE } from '../src/render/type.js';

const WIDTHS = JSON.parse(fs.readFileSync(new URL('./fonts/widths.json', import.meta.url), 'utf8')).fonts;
const W_MAP = { regular: new Map(), bold: new Map() };
for (const role of ['regular', 'bold']) { const t = WIDTHS[role]; [...t.chars].forEach((c, i) => W_MAP[role].set(c, t.w[i])); }
const charEm = (ch, bold) => { const role = bold ? 'bold' : 'regular'; const w = W_MAP[role].get(ch); return w !== undefined ? w : ch.charCodeAt(0) > 0x2000 ? WIDTHS[role].hangul : 500; };
const widthAt = (s, bold, px) => ([...String(s)].reduce((a, ch) => a + charEm(ch, bold), 0) * px) / 1000;
// 글 한 줄의 폭(논리 px, text.js textWidth처럼 올림) — 시험이 화면 없이 길이 한도를 잴 때(test/names.test.js)
export const textWidth = (s, bold = false) => Math.ceil(widthAt(s, bold, (bold ? FACE.bold : FACE.regular).px) - 1e-3);
export function makeFakeDom({ width = 1280, height = 720, dpr = 1 } = {}) {
  const counter = { calls: 0 };
  function makeCtx(canvas) {
    const base = {
      canvas, fillStyle: '#000', globalAlpha: 1, font: '', textAlign: 'left', textBaseline: 'top', imageSmoothingEnabled: false,
      // 빛과 움직임이 쓰는 그리기 상태(읽으면 함수가 아닌 값이 나와야 한다)
      globalCompositeOperation: 'source-over', shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', filter: 'none',
      createRadialGradient() { counter.calls++; return { addColorStop() {} }; },
      createLinearGradient() { counter.calls++; return { addColorStop() {} }; },
      measureText(s) { const f = this.font || '', bold = /Black Han Sans/.test(f), px = Number((f.match(/([\d.]+)px/) || [0, 12])[1]); return { width: widthAt(s, bold, px) }; },
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(1, w * h * 4)), width: w, height: h }),
    };
    return new Proxy(base, {
      get(t, k) {
        if (k in t) return t[k];
        return () => { counter.calls++; };
      },
      set(t, k, v) { t[k] = v; return true; },
    });
  }
  class FakeCanvas {
    constructor() { this.width = 300; this.height = 150; this.style = {}; this.listeners = {}; this._ctx = null; }
    getContext() { return this._ctx || (this._ctx = makeCtx(this)); }
    // PNG 만들기(하이라이트 그림, CHM-73): 가짜 덩이를 돌려주고 센다
    toBlob(cb, type = 'image/png') { counter.blobs = (counter.blobs || 0) + 1; cb({ size: this.width * this.height, type }); }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    getBoundingClientRect() {
      const w = parseFloat(this.style.width) || 480, h = parseFloat(this.style.height) || 270;
      return { left: Math.floor((width - w) / 2), top: Math.floor((height - h) / 2), width: w, height: h };
    }
  }
  // 가짜 WebAudio: 마디를 만들고 잇기만 한다(합성 코드의 예외를 잡으려고)
  const audioCalls = { nodes: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime(v) { if (!(v > 0)) throw new Error('exponential ramp to non-positive'); } });
  const node = (extra = {}) => { audioCalls.nodes++; return { connect() {}, disconnect() {}, start() {}, stop() {}, gain: param(), frequency: param(), Q: param(), type: '', buffer: null, ...extra }; };
  class FakeAudioContext {
    constructor() { this.sampleRate = 8000; this.state = 'running'; this.destination = node(); this.t0 = performance.now(); }
    get currentTime() { return (performance.now() - this.t0) / 1000; }
    createGain() { return node(); }
    createOscillator() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { return node(); }
    createBuffer(ch, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    resume() { this.state = 'running'; }
  }
  const screen = new FakeCanvas();
  const store = new Map();
  let rafCb = null;
  const winListeners = {};
  // 가짜 요소(CHM-72 — 글자 입력 칸 src/ui/textfield.js): form · input · label · button · div. 붙이기 · 떼기 · 속성 · 듣개 · 초점만 한다
  class FakeEl {
    constructor(tag) { this.tagName = String(tag).toUpperCase(); this.style = {}; this.attrs = {}; this.children = []; this.listeners = {}; this.parent = null; this.value = ''; this.className = ''; const cls = new Set(); this.classList = { toggle: (c, on) => { if (on === undefined ? !cls.has(c) : on) cls.add(c); else cls.delete(c); }, add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c) }; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    appendChild(el) { el.parent = this; this.children.push(el); return el; }
    remove() { if (!this.parent) return; const i = this.parent.children.indexOf(this); if (i >= 0) this.parent.children.splice(i, 1); this.parent = null; if (document.activeElement === this) document.activeElement = null; }
    addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
    emit(type, e = {}) { for (const fn of this.listeners[type] || []) fn({ target: this, preventDefault() {}, ...e }); }
    focus() { if (document.activeElement === this) return; if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); document.activeElement = this; this.emit('focus'); }
    blur() { if (document.activeElement !== this) return; document.activeElement = null; this.emit('blur'); }
    getBoundingClientRect() { return { left: parseFloat(this.style.left) || 0, top: parseFloat(this.style.top) || 0, width: parseFloat(this.style.width) || 0, height: parseFloat(this.style.height) || 0 }; }
  }
  const body = new FakeEl('body');
  const document = {
    getElementById: () => screen,
    createElement: (tag) => (tag && String(tag).toLowerCase() !== 'canvas' ? new FakeEl(tag) : new FakeCanvas()),
    fonts: { load: async () => [] },
    body, activeElement: null,
  };
  const walk = (el, out = []) => { for (const c of el.children) { out.push(c); walk(c, out); } return out; };
  const window = {
    innerWidth: width, innerHeight: height, devicePixelRatio: dpr,
    addEventListener(type, fn) { (winListeners[type] ||= []).push(fn); },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
    },
    requestAnimationFrame(cb) { rafCb = cb; },
    performance: globalThis.performance,
    matchMedia: () => ({ matches: false }),
    AudioContext: FakeAudioContext,
  };
  const fire = (list, e) => { for (const fn of list || []) fn(e); };
  return {
    document, window, screen, store, counter, audioCalls,
    // 게임 좌표 (gx, gy)를 화면 좌표로 바꿔 누른다
    clientOf(gx, gy) {
      const r = screen.getBoundingClientRect();
      return { clientX: r.left + ((gx + 0.5) * r.width) / 480, clientY: r.top + ((gy + 0.5) * r.height) / 270 };
    },
    mouse(type, gx, gy, button = 0) {
      const e = { ...this.clientOf(gx, gy), button, preventDefault() {} };
      if (type === 'mouseup') fire(winListeners.mouseup, e);
      else fire(screen.listeners[type], e);
    },
    key(k, mods = {}) { fire(winListeners.keydown, { key: k, repeat: false, preventDefault() {}, target: document.activeElement || body, ...mods }); },
    // 글자 입력 칸: 지금 문서에 붙어 있는 <input> · 이름으로 찾기 · 사람이 치듯 값 넣기(input 사건) · Enter(form 제출)
    inputs() { return walk(body).filter((el) => el.tagName === 'INPUT'); },
    input(id) { return walk(body).find((el) => el.tagName === 'INPUT' && el.id === `tf-${id}`) || null; },
    type(id, text) { const el = this.input(id); if (!el) throw new Error(`입력 칸 없음: ${id}`); el.focus(); el.value = String(text); el.emit('input'); return el; },
    submit() { const f = walk(body).find((el) => el.tagName === 'FORM'); if (f) f.emit('submit'); },
    // 창 사건(error · unhandledrejection · pagehide …)
    emit(type, e = {}) { fire(winListeners[type], e); },
    frame(t) { const cb = rafCb; rafCb = null; if (cb) cb(t); },
  };
}
