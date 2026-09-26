// 오프스크린 캔버스 만들기. 브라우저는 document.createElement, 연기 시험(tools/smoke.mjs)은 가짜를 꽂는다.
let factory = null;

export function setCanvasFactory(fn) { factory = fn; }

export function makeCanvas(w, h) {
  let c;
  if (factory) c = factory(w, h);
  else if (typeof document !== 'undefined') c = document.createElement('canvas');
  else if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h);
  else throw new Error('no canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function context(c) {
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
