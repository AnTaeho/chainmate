// 글자: 벡터 글꼴 둘(src/render/type.js — 굵게 Black Han Sans · 보통 Chainmate Sans KR — IBM Plex Sans KR을 줄인 것)을 그리는 곳의 화소 배율(k)로 오프스크린에 그려 캐시한다.
// 논리 크기는 480×270 칸 그대로(12px), 그림만 k배라 N배 화면에서도 또렷하다. 알파를 자르지 않는다(가장자리가 부드럽다).
// 글자 세로 자리 보정(docs/design-notes/layout.md 「글자 세로 자리 보정」): 기준선은 'alphabetic'(브라우저마다 같다)으로 두고,
// 굵기마다 한 번 기준 글자 「가A」의 잉크 높이(measureText actualBoundingBox)를 재어 그 잉크를 글자 띠(text()의 y부터 INK_H줄) 가운데에 놓는다.
import { makeCanvas, context } from './surface.js';
import { L, getLang } from '../ui/lang.js';
import { LOG, logClip } from './layoutlog.js';
import { INK_H, faceOf, fontOf } from './type.js';
import { frac } from './look.js';

export const FONT_PX = 12;
const PT = 2, PL = 1;       // 글자 그림의 위 · 왼쪽 여유(띠 위로 솟는 글자 · 왼쪽으로 튀어나온 획)
const HB = PT + INK_H + 5;  // 글자 그림 높이(논리 px): 여유 + 띠 + 아래로 빠지는 줄
const CACHE = new Map();
let cachePx = 0;
const CACHE_PX = 1.5e6;     // 글자 그림 캐시의 화소 합 한도(넘치면 가장 오래 안 쓴 그림부터 버린다)
export const TEXT_STATS = { hit: 0, miss: 0 };
export const textCachePx = () => cachePx;
function cacheGet(key) {
  const hit = CACHE.get(key);
  if (hit) { CACHE.delete(key); CACHE.set(key, hit); TEXT_STATS.hit++; } else TEXT_STATS.miss++;
  return hit;
}
function cachePut(key, hit) {
  cachePx += hit.c.width * hit.c.height;
  CACHE.set(key, hit);
  for (const [k, v] of CACHE) {
    if (cachePx <= CACHE_PX || k === key) break;
    CACHE.delete(k); cachePx -= v.c.width * v.c.height;
  }
}
let measurer = null;

function measureCtx() {
  if (!measurer) measurer = context(makeCanvas(4, 4));
  return measurer;
}

// 잰 폭 · 줄 바꿈 캐시: 글꼴이 오거나(clearTextCache) 차면 비운다. 옮긴 글로 열쇠를 삼아 말이 바뀌어도 맞다
const WIDTHS = new Map();
const WRAPS = new Map();
const LIMIT = 4000;
export function textWidth(s, bold = false) {
  const t = L(String(s));
  const key = bold ? `1${t}` : `0${t}`;
  let v = WIDTHS.get(key);
  if (v !== undefined) return v;
  const ctx = measureCtx();
  ctx.font = fontOf(bold);
  v = Math.ceil(ctx.measureText(t).width - 1e-3);
  // 글꼴이 오기 전의 폭은 적어 두지 않는다
  if (!fontReady(bold)) { unready = true; return v; }
  if (WIDTHS.size > LIMIT) WIDTHS.clear();
  WIDTHS.set(key, v);
  return v;
}

const PROBE = '가A';
const BASE = new Map(); // 굵기 → 글자 띠 위에서 기준선까지(논리 px)
let unready = false;    // 글꼴이 오기 전에 그린 글자 그림이 캐시에 있다

// 글꼴이 왔는가. 물어볼 길이 없으면(시험 환경) 왔다고 본다
function fontReady(bold) {
  const f = typeof document !== 'undefined' ? document.fonts : null;
  if (!f || typeof f.check !== 'function') return true;
  try { return f.check(fontOf(bold), PROBE); } catch { return true; }
}

// 기준선 자리: 기준 글자의 잉크(위 asc · 아래 desc)를 띠 가운데에. 글꼴이 오기 전에는 적어 두지 않는다(오면 캐시를 비우고 다시 잰다).
// 잉크를 못 재는 곳(가짜 캔버스 · 옛 브라우저)은 type.js의 잰 값
export function baseOf(bold) {
  let v = BASE.get(bold);
  if (v !== undefined) return v;
  let [asc, desc] = faceOf(bold).ink;
  const ready = fontReady(bold);
  if (ready) {
    const ctx = measureCtx();
    ctx.font = fontOf(bold);
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(PROBE);
    if (typeof m.actualBoundingBoxAscent === 'number' && m.actualBoundingBoxAscent > 0) { asc = m.actualBoundingBoxAscent; desc = Math.max(0, m.actualBoundingBoxDescent || 0); }
  } else unready = true;
  v = (INK_H - asc - desc) / 2 + asc;
  if (ready) BASE.set(bold, v);
  return v;
}

// 그림의 잉크 첫 · 끝 줄(그림 화소). 잉크가 없으면 null
function inkRows(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let top = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 127) { if (top < 0) top = y; bottom = y; break; }
  return top < 0 ? null : { top, bottom };
}

// 글자 캐시를 비운 횟수(글꼴이 온 뒤 다시 구울 것 — 첫 화면 로고 · 그리기 판단이 본다)
let gen = 0;
export const textGen = () => gen;
export function clearTextCache() { CACHE.clear(); cachePx = 0; measurer = null; BASE.clear(); WIDTHS.clear(); WRAPS.clear(); unready = false; gen++; }
// 글꼴이 늦게 와도 다시 잰다
if (typeof document !== 'undefined' && document.fonts && typeof document.fonts.addEventListener === 'function') {
  try { document.fonts.addEventListener('loadingdone', () => clearTextCache()); } catch { /* 그대로 */ }
}

// 글자 그림(textImage 결과)의 잉크 상자(논리 px, text()의 y 기준): 첫 줄 top · 끝 줄 bottom · 높이 h. 그림 칸 안에 글자를 가운데 놓을 때 쓴다.
// 잉크를 못 재는 곳은 글자 띠(0 ~ 10줄)
export function inkBox(img) {
  if (!img.ink) {
    const r = inkRows(context(img.c), img.c.width, img.c.height);
    img.ink = r ? { top: r.top / img.k + img.top, bottom: (r.bottom + 1) / img.k + img.top - 1, h: (r.bottom - r.top + 1) / img.k } : { top: 0, bottom: INK_H - 1, h: INK_H };
  }
  return img.ink;
}

// 글자 그림: k = 그리는 곳의 화소 배율(화면 N × 확대). 돌려주는 것: c 캔버스(k배) · w 글 폭 · cw × h 그림의 논리 크기 · left · top 그림을 놓을 자리(text()의 x · y에서)
// edge: 테 빛깔 — 같은 글을 둥근 이음 선(굵기 ow 논리 px, 글 바깥으로 ow)으로 긋고 그 위에 글을 채운 그림 하나(left · top이 테만큼 더 바깥)
export function textImage(s, col, bold = false, k = 1, edge = null, ow = 1) {
  s = String(s);
  // 꽉 채움(뒷면 배율이 소수): 그 배율 그대로 굽고 1:1로 붙인다 — 올림한 그림을 줄여 붙이면 가장 가까운 화소 고르기라 줄이 빠진다
  const fr = frac() && Math.abs(k - Math.round(k)) > 1e-6;
  k = fr ? Math.max(1, Math.min(12, Math.round(k * 1000) / 1000)) : Math.max(1, Math.min(12, Math.ceil(k - 1e-6)));
  if (unready && fontReady(false) && fontReady(true)) clearTextCache();
  // 테 굵기는 기기 화소 반 칸 단위로(크기가 움직이며 굵기를 맞춰 부르는 이름표가 프레임마다 다시 굽지 않게)
  if (edge) ow = Math.max(1, Math.round(ow * k * 2)) / (k * 2);
  const key = `${bold ? 1 : 0}${k}|${col}|${edge ? `${edge}|${ow}|` : ''}${s}`;
  let hit = cacheGet(key);
  if (hit) return hit;
  const P = edge ? Math.ceil(ow) + 1 : 0, w = textWidth(s, bold), cw = w + PL + 2 + P * 2, h = HB + P * 2;
  // 소수 배율이면 그림 왼쪽 · 위 끝을 기기 화소 정수 자리에 둔다(붙일 때 글 자리 x · y가 기기 화소면 그림도 그렇다)
  const c = fr ? makeCanvas(Math.ceil(cw * k), Math.ceil(h * k)) : makeCanvas(cw * k, h * k);
  const ctx = context(c);
  ctx.font = fontOf(bold, faceOf(bold).px * k);
  ctx.textBaseline = 'alphabetic';
  const bx = fr ? Math.round((PL + P) * k) : (PL + P) * k, by = Math.round((PT + P + baseOf(bold)) * k);
  const ty = fr ? Math.round((PT + P) * k) : (PT + P) * k;
  if (edge) {
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.lineWidth = ow * 2 * k; ctx.strokeStyle = edge; ctx.fillStyle = edge;
    ctx.strokeText(s, bx, by); ctx.fillText(s, bx, by);
  }
  ctx.fillStyle = col;
  ctx.fillText(s, bx, by);
  hit = fr ? { c, w, cw: c.width / k, h: c.height / k, k, left: -bx / k, top: -ty / k } : { c, w, cw, h, k, left: -PL - P, top: -PT - P };
  cachePut(key, hit);
  return hit;
}

// 줄 바꿈: 너비 w 안에서 낱말(띄어쓰기) 단위로, 낱말이 너무 길면 글자 단위로.
// 효과를 잇는 「 · 」가 줄 끝 · 줄 머리에 걸리면 뺀다(줄 바꿈이 곧 나눔이다)
// 문장부호(마침표 · 쉼표 · 가운뎃점 · 닫는 괄호 …)는 줄 머리에 두지 않는다 — 글자 단위로 끊을 때 앞 글자와 함께 내린다
const noDot = (l) => (l.endsWith(' ·') ? l.slice(0, -2) : l);
export const CLOSE_PUNCT = /^[.,·:;!?…)\]}」』》〉’”%]/;
// 값 · 배수와 그 수(「배수 ×1.5」 · 「+20 Value」)는 한 덩이로 줄을 바꾼다(카드에 색 칸 하나로 그린다 — glossary.js richText)
// 색 칸 글: 낱말 상자 값 · 배수가 찾는 꼴과 같다. 칸은 글보다 CHIP_X씩 넓어 줄 폭에 더한다
export const VM_RE = { value: [/(?<!상점 )값 [+×−][\d.]+/, /[+×−][\d.,]+ Value\b/], links: [/배수 [+×−][\d.]+/, /[+×−][\d.,]+ Mult\b/] };
export const CHIP_X = 2.5;
const VM_ALL = { ko: new RegExp(`${VM_RE.value[0].source}|${VM_RE.links[0].source}`, 'g'), en: new RegExp(`${VM_RE.value[1].source}|${VM_RE.links[1].source}`, 'g') };
export function chipCount(s) { const m = String(s).match(VM_ALL[getLang() === 'en' ? 'en' : 'ko']); return m ? m.length : 0; }
// 줄 폭: 글 폭 + 색 칸이 넓힌 몫
export function lineWidth(s, bold = false) { return textWidth(s, bold) + chipCount(L(String(s))) * CHIP_X * 2; }
const vmPair = (a, b) => (/^(?:값|배수)$/.test(a) && /^[+×−][\d.,]+/.test(b)) || (/^[+×−][\d.,]+$/.test(a) && /^(?:Value|Mult)\b/.test(b));
function glueVM(words, w, bold) {
  const out = [];
  for (const word of words) {
    const prev = out[out.length - 1];
    if (prev != null && vmPair(prev.split(' ').pop(), word) && lineWidth(`${prev} ${word}`, bold) <= w && !prev.includes(' ')) out[out.length - 1] = `${prev} ${word}`;
    else out.push(word);
  }
  return out;
}
// 수 목록(「2 · 4 · 5개」)은 한 덩이로 줄을 바꾼다 — 줄 끝 「 ·」를 빼면 「4 / 5개」가 「45개」처럼 붙어 읽힌다
function glueNums(words) {
  const out = [];
  for (let i = 0; i < words.length; i++) {
    const prev = out[out.length - 1];
    if (prev != null && words[i] === '·' && /(?:^|\s)\d+$/.test(prev) && /^\d/.test(words[i + 1] || '')) { out[out.length - 1] = `${prev} · ${words[i + 1]}`; i++; }
    else out.push(words[i]);
  }
  return out;
}
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
  if (unready && fontReady(false) && fontReady(true)) clearTextCache();
  // 레이아웃 기록 중(연기 시험)에는 끊긴 낱말을 적어야 하니 캐시를 거치지 않는다
  if (LOG.on) return wrapRaw(s, w, bold);
  const key = `${bold ? 1 : 0}|${w}|${getLang()}|${s}`;
  let hit = WRAPS.get(key);
  if (!hit) {
    hit = wrapRaw(s, w, bold);
    if (unready) return hit;
    if (WRAPS.size > LIMIT) WRAPS.clear();
    WRAPS.set(key, hit);
  }
  return hit.slice();
}
function wrapRaw(s, w, bold) {
  const out = [];
  for (const para of String(s).split('\n')) {
    let line = '';
    for (const word of glueVM(glueNums(para.split(' ')), w, bold)) {
      const tryLine = line ? `${line} ${word}` : word;
      if (lineWidth(tryLine, bold) <= w) { line = tryLine; continue; }
      if (line) out.push(noDot(line));
      if (word === '·') { line = ''; continue; }
      if (lineWidth(word, bold) <= w) { line = word; continue; }
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
      const prev = out[n - 2];
      let cut = prev.lastIndexOf(' ');
      if (cut > 0 && vmPair(prev.slice(0, cut).split(' ').pop(), prev.slice(cut + 1))) cut = prev.lastIndexOf(' ', cut - 1);
      const moved = `${prev.slice(cut + 1)} ${out[n - 1]}`;
      if (cut > 0 && lineWidth(moved, bold) <= w) { out[n - 2] = noDot(prev.slice(0, cut)); out[n - 1] = moved; }
    }
  }
  return out;
}

// 작은 글자(딱지 숫자 · 판 좌표 · 기보 수): 글꼴 글자를 대문자 · 숫자 잉크 높이 h로 (cx, cy)에 가운데 놓는다. 그리는 곳에 바로 써서 어느 배율에서나 또렷하고,
// 글 기록(layoutlog)에 들지 않는다 — 옛 3 × 5 · 7줄 도트 글자 자리에 선 그림 안 글자라서. 돌려주는 값은 폭(논리 px)
export function tinyText(ctx, s, cx, cy, h, col, { bold = true, align = 'center' } = {}) {
  s = String(s);
  const f = faceOf(bold), px = (f.px * h) / f.ink[0];
  ctx.save();
  ctx.font = fontOf(bold, px);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;
  ctx.fillStyle = col;
  ctx.fillText(s, cx, cy + h / 2);
  const m = ctx.measureText(s);
  ctx.restore();
  return m && typeof m.width === 'number' ? m.width : 0;
}
