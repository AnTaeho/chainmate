// 연기 시험의 글 폭 표(tools/fonts/widths.json)를 실제 글꼴로 잰다: 줄인 글꼴(style.css가 가리키는 woff2)을 Playwright 크로미움에 싣고,
// 덮은 글자(tools/fonts/glyphs.json covered)마다 굵게 · 보통(src/render/type.js fontOf)의 폭을 1/1000 em으로(올림) 적는다.
// 한글 음절의 폭이 한 글꼴 안에서 모두 같으면 그 값 하나(hangul)로 줄인다. 기준 글자 「가A」의 잉크 위 · 아래도 재어 type.js의 값과 견준다.
//   node tools/fontwidths.mjs        (글꼴을 다시 줄였거나 type.js 글꼴 · 굵기를 바꿨으면)
// Playwright는 저장소 의존성에 넣지 않는다 — PLAYWRIGHT(index.mjs 경로) · 'playwright' · 전역 순.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FACE, fontOf } from '../src/render/type.js';
import { loadPlaywright } from './_lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tools/fonts/widths.json');


const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => {
  const body = m[1];
  const family = body.match(/font-family:\s*"([^"]+)"/)[1], weight = (body.match(/font-weight:\s*(\d+)/) || [0, '400'])[1];
  const url = body.match(/url\("([^"]+)"\)/)[1];
  const data = fs.readFileSync(path.join(ROOT, url)).toString('base64');
  return `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${data}) format("woff2")}`;
}).join('\n');
const covered = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/fonts/glyphs.json'), 'utf8')).covered;

const { chromium } = await loadPlaywright();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent(`<style>${faces}</style><body></body>`);
  const roles = { regular: { font: fontOf(false, 1000), at12: fontOf(false) }, bold: { font: fontOf(true, 1000), at12: fontOf(true) } };
  const out = await page.evaluate(async ({ roles, chars }) => {
    for (const r of Object.values(roles)) await document.fonts.load(r.at12, chars);
    const g = document.createElement('canvas').getContext('2d');
    const res = {};
    for (const [name, r] of Object.entries(roles)) {
      g.font = r.font;
      const w = {};
      for (const ch of chars) w[ch] = Math.ceil(g.measureText(ch).width - 1e-6);
      g.font = r.at12;
      g.textBaseline = 'alphabetic';
      const m = g.measureText('가A');
      res[name] = { w, ink: [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent] };
    }
    return res;
  }, { roles, chars: covered });
  const table = { note: 'tools/fontwidths.mjs가 쓴다 — 글자 폭은 1/1000 em(올림). 표에 없는 한글은 hangul, 그 밖 넓은 글자도 hangul, 좁은 글자는 500', fonts: {} };
  for (const [name, r] of Object.entries(out)) {
    const face = FACE[name];
    const hang = Object.entries(r.w).filter(([ch]) => ch >= '가' && ch <= '힣').map(([, v]) => v);
    const uniform = hang.length && hang.every((v) => v === hang[0]);
    const chars = Object.entries(r.w).filter(([ch]) => !(uniform && ch >= '가' && ch <= '힣'));
    table.fonts[name] = { font: fontOf(name === 'bold'), hangul: uniform ? hang[0] : Math.max(...hang), chars: chars.map(([ch]) => ch).join(''), w: chars.map(([, v]) => v) };
    const ink = r.ink.map((v) => Math.round(v * 100) / 100);
    const same = Math.abs(ink[0] - face.ink[0]) < 0.05 && Math.abs(ink[1] - face.ink[1]) < 0.05;
    console.log(`${name} ${fontOf(name === 'bold')}: 한글 ${uniform ? `모두 ${hang[0]}` : `제각각(${Math.min(...hang)}~${Math.max(...hang)})`}/1000 em · 그 밖 ${chars.length}자 · 「가A」 잉크 위 ${ink[0]} 아래 ${ink[1]}${same ? '' : ` — type.js의 ${face.ink.join(' · ')}와 다르다, 고친다`}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(table) + '\n');
  console.log(`→ ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} B)`);
} finally {
  await browser.close();
}
