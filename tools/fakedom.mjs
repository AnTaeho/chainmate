// 연기 시험용 가짜 DOM: 캔버스 컨텍스트는 그리기 호출을 세기만 한다. 입력은 등록된 듣개에 직접 넣는다.
// 글 폭은 Galmuri11 12px의 실제 글자 폭(브라우저에서 잰 표, 보통 · 굵게)을 더한다 — 연기 시험의 「글 넘침」이 실제 화면과 맞게.
// 표에 없는 글자는 한글 · 한자 · 넓은 기호 12, 그 밖 6. 짝 글자 사이 좁힘(커닝)은 빼서 실제보다 조금 넓거나 같다.
const W_CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~·×…—›‹■□○●★→←↑↓–’‘“”";
const W_REG = [5,4,4,8,8,10,8,4,4,4,6,8,4,6,4,6,8,6,8,8,8,8,8,8,8,8,4,4,5,6,5,6,10,8,8,9,8,7,7,9,8,4,7,8,7,10,8,9,8,9,8,8,8,9,8,10,8,8,7,4,6,4,6,8,4,7,8,7,8,8,6,8,7,4,6,7,4,10,7,8,8,8,6,7,6,8,8,10,8,8,7,5,4,5,8,4,8,12,10,4,4,12,12,12,12,12,12,12,12,12,8,4,4,6,6];
const W_BOLD = [5,5,6,10,9,12,11,5,5,5,7,9,5,6,5,7,8,5,8,8,8,8,8,8,8,8,5,5,7,6,7,7,9,9,8,8,8,7,7,8,8,5,8,9,7,10,8,8,8,8,8,8,9,8,9,13,8,9,8,5,7,5,6,8,5,7,8,8,8,8,6,8,8,3,5,8,3,11,8,8,8,8,6,7,6,8,8,11,8,8,7,6,5,6,10,5,9,12,10,5,5,12,12,12,12,12,12,12,12,12,8,5,5,6,6];
const W_MAP = new Map([...W_CHARS].map((c, i) => [c, [W_REG[i], W_BOLD[i]]]));
const charW = (ch, bold) => { const w = W_MAP.get(ch); return w ? w[bold ? 1 : 0] : ch.charCodeAt(0) > 0x2000 ? 12 : 6; };
export function makeFakeDom({ width = 1280, height = 720, dpr = 1 } = {}) {
  const counter = { calls: 0 };
  function makeCtx(canvas) {
    const base = {
      canvas, fillStyle: '#000', globalAlpha: 1, font: '', textAlign: 'left', textBaseline: 'top', imageSmoothingEnabled: false,
      measureText(s) { const bold = /700|bold/.test(this.font || ''); return { width: [...String(s)].reduce((a, ch) => a + charW(ch, bold), 0) }; },
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
  const document = {
    getElementById: () => screen,
    createElement: () => new FakeCanvas(),
    fonts: { load: async () => [] },
  };
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
    key(k) { fire(winListeners.keydown, { key: k, repeat: false, preventDefault() {} }); },
    frame(t) { const cb = rafCb; rafCb = null; if (cb) cb(t); },
  };
}
