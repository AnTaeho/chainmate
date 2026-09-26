// 화면 글 옮기기: 그리기 직전(gfx.text · wrap · 너비 재기)에 한국어 글을 고른 말로 바꾼다.
// 표에 없는 글은 · 쉼표로 쪼개 조각마다, 그래도 없으면 틀(TEMPLATES)로. 끝내 없으면 그대로 둔다.
import { EN, TEMPLATES, PRE } from '../data/i18n/en.js';

let lang = 'ko';
const cache = new Map();
const HANGUL = /[가-힣]/;

export function setLang(l) { lang = l === 'en' ? 'en' : 'ko'; cache.clear(); }
export const getLang = () => lang;

function tr(s) {
  if (EN[s] != null) return EN[s];
  for (const [re, fn] of PRE) { const m = s.match(re); if (m) return fn(m, tr); }
  for (const sep of [' · ', '  ']) if (s.includes(sep)) return s.split(sep).map(tr).join(sep);
  for (const [re, fn] of TEMPLATES) { const m = s.match(re); if (m) return fn(m, tr); }
  return s;
}

export const untranslated = new Set();
export function L(s) {
  if (lang === 'ko' || typeof s !== 'string' || !HANGUL.test(s)) return s;
  let r = cache.get(s);
  if (r === undefined) { r = tr(s); cache.set(s, r); if (HANGUL.test(r)) untranslated.add(s); }
  return r;
}

// 옮기지 못한 글 모으기(시험용)
export function missing(list) {
  const prev = lang;
  lang = 'en';
  const out = list.filter((s) => HANGUL.test(tr(s)));
  lang = prev;
  return out;
}
