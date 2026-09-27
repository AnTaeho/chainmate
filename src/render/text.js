// 도트 글자: Galmuri11을 12px로 오프스크린에 그리고 알파를 문턱값(> 0.5)으로 잘라 또렷하게 캐시한다.
// 숫자와 제목은 굵게(Bold 파일).
import { makeCanvas, context } from './surface.js';
import { rgb } from './palette.js';
import { L } from '../ui/lang.js';

export const FONT_PX = 12;
export const LINE_H = 13;
const H = 16;
const CACHE = new Map();
let measurer = null;

const fontOf = (bold) => `${bold ? 700 : 400} ${FONT_PX}px Galmuri11`;

function measureCtx() {
  if (!measurer) measurer = context(makeCanvas(4, 4));
  return measurer;
}

export function textWidth(s, bold = false) {
  const ctx = measureCtx();
  ctx.font = fontOf(bold);
  return Math.ceil(ctx.measureText(L(String(s))).width);
}

export function clearTextCache() { CACHE.clear(); }

export function textImage(s, col, bold = false) {
  s = String(s);
  const key = `${bold ? 1 : 0}${col}${s}`;
  let hit = CACHE.get(key);
  if (hit) return hit;
  const w = Math.max(1, textWidth(s, bold) + 2);
  const c = makeCanvas(w, H);
  const ctx = context(c);
  ctx.font = fontOf(bold);
  ctx.textBaseline = 'top';
  ctx.fillStyle = col;
  ctx.fillText(s, 0, 1);
  const img = ctx.getImageData(0, 0, w, H);
  const d = img.data;
  const [r, g, b] = rgb(col);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] > 127) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; } else d[i + 3] = 0;
  }
  ctx.putImageData(img, 0, 0);
  hit = { c, w: w - 2, h: H };
  if (CACHE.size > 3000) CACHE.clear();
  CACHE.set(key, hit);
  return hit;
}

// 줄 바꿈: 너비 w 안에서 낱말(띄어쓰기) 단위로, 낱말이 너무 길면 글자 단위로.
// 효과를 잇는 「 · 」가 줄 끝 · 줄 머리에 걸리면 뺀다(줄 바꿈이 곧 나눔이다)
const noDot = (l) => (l.endsWith(' ·') ? l.slice(0, -2) : l);
export function wrap(s, w, bold = false) {
  s = L(String(s));
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const tryLine = line ? `${line} ${word}` : word;
      if (textWidth(tryLine, bold) <= w) { line = tryLine; continue; }
      if (line) out.push(noDot(line));
      if (word === '·') { line = ''; continue; }
      if (textWidth(word, bold) <= w) { line = word; continue; }
      line = '';
      for (const ch of word) {
        if (textWidth(line + ch, bold) > w && line) { out.push(line); line = ''; }
        line += ch;
      }
    }
    out.push(line);
    // 외톨이 끝말(숫자 하나 같은 짧은 낱말)이 홀로 다음 줄로 떨어지지 않게 앞 줄의 끝 낱말을 함께 내린다
    const n = out.length;
    if (n >= 2 && out[n - 1].length <= 2 && !out[n - 1].includes(' ') && out[n - 2].includes(' ')) {
      const prev = out[n - 2], cut = prev.lastIndexOf(' ');
      const moved = `${prev.slice(cut + 1)} ${out[n - 1]}`;
      if (textWidth(moved, bold) <= w) { out[n - 2] = noDot(prev.slice(0, cut)); out[n - 1] = moved; }
    }
  }
  return out;
}
