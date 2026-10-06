// 도트 글자: Galmuri11을 12px로 오프스크린에 그리고 알파를 문턱값(> 0.5)으로 잘라 또렷하게 캐시한다.
// 숫자와 제목은 굵게(Bold 파일).
// 글자 세로 자리 보정(docs/design-notes/layout.md 「글자 세로 자리 보정」): textBaseline 'top'이 가리키는 줄은 브라우저마다 다르다
// (같은 글꼴로 Safari는 크로미움보다 2px 아래에 그린다). 굵기마다 한 번 기준 글자의 잉크 윗줄을 재어 그 차이만큼 올려 그린다.
import { makeCanvas, context } from './surface.js';
import { rgb } from './palette.js';
import { L } from '../ui/lang.js';
import { logClip } from './layoutlog.js';

export const FONT_PX = 12;
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

// 기준 글자 「가A」의 잉크 윗줄이 설 자리(글자 그림의 0번째 줄 — 크로미움에서 fillText y = 1일 때의 자리). 줄 높이 11(0 ~ 10줄)
const INK_TOP = 0, INK_H = 11, PROBE = '가A';
const SHIFT = new Map(); // 굵기 → fillText y에 더할 값
let unready = false;     // 글꼴이 오기 전에 그린 글자 그림이 캐시에 있다

// 글꼴이 왔는가. 물어볼 길이 없으면(시험 환경) 왔다고 본다
function fontReady(bold) {
  const f = typeof document !== 'undefined' ? document.fonts : null;
  if (!f || typeof f.check !== 'function') return true;
  try { return f.check(fontOf(bold)); } catch { return true; }
}

// 그림의 잉크 첫 · 끝 줄. 잉크가 없으면 null
function inkRows(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let top = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 127) { if (top < 0) top = y; bottom = y; break; }
  return top < 0 ? null : { top, bottom };
}

// 글꼴이 온 뒤 굵기마다 한 번 잰다. 글꼴이 아직 없으면 0으로 그리되 적어 두지 않는다(오면 캐시를 비우고 다시 잰다).
// 잉크를 못 재는 곳(가짜 캔버스)은 0
function shiftOf(bold) {
  let v = SHIFT.get(bold);
  if (v !== undefined) return v;
  if (!fontReady(bold)) { unready = true; return 0; }
  const w = 32, pad = H;
  const ctx = context(makeCanvas(w, H + pad * 2));
  ctx.font = fontOf(bold);
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  ctx.fillText(PROBE, 0, pad + 1);
  const ink = inkRows(ctx, w, H + pad * 2);
  v = ink ? pad + INK_TOP - ink.top : 0;
  SHIFT.set(bold, v);
  return v;
}

export function clearTextCache() { CACHE.clear(); SHIFT.clear(); unready = false; }

// 글자 그림(textImage 결과)의 잉크 상자: 첫 줄 top · 끝 줄 bottom · 높이 h(1배 화소). 그림 칸 안에 글자를 가운데 놓을 때 쓴다.
// 잉크를 못 재는 곳은 대문자 · 한글 · 숫자의 자리(0 ~ 10줄)
export function inkBox(img) {
  if (!img.ink) {
    const r = inkRows(context(img.c), img.c.width, img.c.height) || { top: INK_TOP, bottom: INK_TOP + INK_H - 1 };
    img.ink = { top: r.top, bottom: r.bottom, h: r.bottom - r.top + 1 };
  }
  return img.ink;
}

export function textImage(s, col, bold = false) {
  s = String(s);
  if (unready && fontReady(false) && fontReady(true)) clearTextCache();
  const key = `${bold ? 1 : 0}${col}${s}`;
  let hit = CACHE.get(key);
  if (hit) return hit;
  const w = Math.max(1, textWidth(s, bold) + 2);
  const c = makeCanvas(w, H);
  const ctx = context(c);
  ctx.font = fontOf(bold);
  ctx.textBaseline = 'top';
  ctx.fillStyle = col;
  ctx.fillText(s, 0, 1 + shiftOf(bold));
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
// 문장부호(마침표 · 쉼표 · 가운뎃점 · 닫는 괄호 …)는 줄 머리에 두지 않는다 — 글자 단위로 끊을 때 앞 글자와 함께 내린다
const noDot = (l) => (l.endsWith(' ·') ? l.slice(0, -2) : l);
export const CLOSE_PUNCT = /^[.,·:;!?…)\]}」』》〉’”%]/;
// 낱말 안 줄 바꿈 자리: 붙임표 뒤(앞뒤가 글자일 때), 숫자 사이 쉼표 뒤. 나눈 조각을 이으면 원래 낱말이다
export function breakPieces(word) {
  const out = [];
  let from = 0;
  for (let i = 1; i < word.length - 1; i++) {
    const c = word[i], a = word[i - 1], b = word[i + 1];
    const hyphen = c === '-' && /[\p{L}\p{N}]/u.test(a) && /[\p{L}\p{N}]/u.test(b);
    const comma = c === ',' && /\d/.test(a) && /\d/.test(b);
    if (hyphen || comma) { out.push(word.slice(from, i + 1)); from = i + 1; }
  }
  out.push(word.slice(from));
  return out;
}
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
      // 줄보다 긴 낱말은 먼저 낱말 안 경계에서 나눈다: 붙임표(-) 뒤 · 숫자 사이 쉼표 뒤(「Thirteen-year- / old」 · 「1,000,000,000, / 000」).
      // 이것은 글자 끊김이 아니다. 조각 하나가 그래도 줄보다 길 때만 그 조각을 글자 단위로 끊는다
      const pieces = breakPieces(word);
      if (pieces.length > 1 && pieces.every((p) => textWidth(p, bold) <= w)) {
        for (const p of pieces) {
          if (line && textWidth(line + p, bold) > w) { out.push(line); line = ''; }
          line += p;
        }
        continue;
      }
      const from = out.length;
      for (const ch of word) {
        if (textWidth(line + ch, bold) > w && line) {
          // 문장부호가 줄 머리에 오면 앞 글자를 함께 내린다(앞 글자가 하나뿐이면 그대로)
          let keep = 0;
          if (CLOSE_PUNCT.test(ch)) { keep = 1; while (keep < line.length && CLOSE_PUNCT.test(line[line.length - keep])) keep++; }
          if (keep >= line.length) keep = 0;
          out.push(line.slice(0, line.length - keep)); line = line.slice(line.length - keep);
        }
        line += ch;
      }
      // 낱말이 글자 단위로 끊겼다(「잘린 글」 검사 — 그 낱말과 끊긴 조각)
      if (out.length > from) logClip('char', word, [...out.slice(from), line].join(' / '), w);
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
