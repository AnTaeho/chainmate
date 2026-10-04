// 화면 시험의 가짜 DOM: 전역 document · window를 놓고 캔버스를 가짜 캔버스로 만든다(tools/fakedom.mjs).
// 화면 모듈은 이 뒤에 동적 import로 불러야 전역을 본다.
export async function installDom(opts) {
  const { makeFakeDom } = await import('../../tools/fakedom.mjs');
  const dom = makeFakeDom(opts);
  globalThis.document = dom.document; globalThis.window = dom.window;
  const { setCanvasFactory } = await import('../../src/render/surface.js');
  setCanvasFactory(() => dom.document.createElement('canvas'));
  return dom;
}

// 앱 프레임을 n번(16ms씩) 돌린다
export const tick = (app, n = 2) => { for (let i = 0; i < n; i++) app.frame((app.last || 0) + 16); };
