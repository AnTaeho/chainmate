// 두 배 도트 그림 마스크(CHM-39 2단계): 격언 아이콘 · 종류 딱지 문양 · 세력 문장 · 카드 그림(각인 재료 · 전술 · 명경기 조각)을
// 원래 마스크에서 만든다. 결과는 src/render/art-hi.js에 글자 줄로 쓴다 — 실행 때는 이 도구를 부르지 않는다.
//   node tools/art-hi.mjs           → src/render/art-hi.js를 다시 쓴다
//   node tools/art-hi.mjs --print   → 마스크를 글로 찍어 본다
// 바탕은 Scale2x(EPX): 도트 하나를 2×2 반 도트로 나누고, 이웃 둘이 같은 빛깔로 꺾이는 모서리만 그 빛깔로 채운다 — 계단이 사선으로,
// 꺾인 모서리가 둥글게 다듬어진다. 새 빛깔은 생기지 않고, 도트 하나의 네 반 도트 중 둘까지만 바뀐다(모양 · 빛깔을 지킨다).
// 네모 테처럼 모서리가 둥글면 뜻이 흐려지는 그림은 NEAREST(그대로 두 배), 손으로 고친 곳은 PATCH에 둔다.
// 초상(portraits.js)은 그리는 코드가 반 도트 단위로 직접 그린다 — 여기서 만들지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeFakeDom } from './fakedom.mjs';

const dom = makeFakeDom();
globalThis.document = dom.document; globalThis.window = dom.window;
const { setCanvasFactory } = await import('../src/render/surface.js');
setCanvasFactory(() => dom.document.createElement('canvas'));
const { ICON_ROWS } = await import('../src/render/icons.js');
const { KIND } = await import('../src/ui/kinds.js');
const { CREST } = await import('../src/render/crests.js');
const { EMBLEM, TACTIC_G, SHARD_ROWS } = await import('../src/ui/parts.js');

// Scale2x: rows(문자 줄) → 두 배 줄. 그림 밖은 빈칸(.)
export function scale2x(rows) {
  const h = rows.length, w = rows[0].length;
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  const out = Array.from({ length: h * 2 }, () => Array(w * 2).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
    out[2 * y][2 * x] = C === A && C !== D && A !== B ? A : P;
    out[2 * y][2 * x + 1] = A === B && A !== C && B !== D ? B : P;
    out[2 * y + 1][2 * x] = D === C && D !== B && C !== A ? C : P;
    out[2 * y + 1][2 * x + 1] = B === D && B !== A && D !== C ? D : P;
  }
  return out.map((r) => r.join(''));
}
const nearest = (rows) => rows.flatMap((r) => { const d = [...r].map((c) => c + c).join(''); return [d, d]; });

// 네모 테 · 칸 무늬 · 글자 같은 그림: 둥글게 다듬으면 판 · 상자의 뜻이 흐려진다 — 그대로 두 배
const NEAREST = {
  icon: new Set(['edge', 'bare_board', 'welcome', 'checkerboard', 'full_board', 'encircle', 'last_square', 'asceticism', 'whim']),
  crest: new Set(['tower']), // 성탑 창(빈칸 구멍)이 모래시계 꼴로 바뀌었다
  tactic: new Set(['reload']), // 더하기가 마름모로 바뀌었다
};
// 한 그림 안에서 이 빛깔만 그대로 두 배(작은 더하기 · 네모 표가 마름모 · 동그라미로 바뀌지 않게) — 나머지 선은 다듬는다
const KEEP = {
  icon: { payback: 'r', reversal: 'r', soul_collector: 'p', center: 'g', specialty: 'b' },
};
const keep = (rows, hi, chars) => {
  const nn = nearest(rows);
  return hi.map((r, y) => [...r].map((c, x) => (c !== nn[y][x] && (chars.includes(c) || chars.includes(nn[y][x])) ? nn[y][x] : c)).join(''));
};
// 손으로 고친 반 도트: { 그림: [[y, x, 문자], ...] } — 다듬은 뒤에 얹는다
const PATCH = { icon: {}, kind: {}, crest: {}, emblem: {}, tactic: {} };

function build(group, src, { width = null } = {}) {
  const out = {};
  for (const [id, rows0] of Object.entries(src)) {
    const rows = width ? rows0.map((r) => r.padEnd(width, '.')) : rows0;
    let hi = NEAREST[group] && NEAREST[group].has(id) ? nearest(rows) : scale2x(rows);
    if (KEEP[group] && KEEP[group][id]) hi = keep(rows, hi, KEEP[group][id]);
    hi = hi.map((r) => [...r]);
    for (const [y, x, ch] of (PATCH[group] && PATCH[group][id]) || []) hi[y][x] = ch;
    out[id] = hi.map((r) => r.join(''));
  }
  return out;
}

const ICON_HI = build('icon', ICON_ROWS);
const KIND_HI = build('kind', Object.fromEntries(Object.entries(KIND).map(([k, v]) => [k, v.g])));
const CREST_HI = build('crest', CREST);
const EMBLEM_HI = build('emblem', Object.fromEntries(Object.entries(EMBLEM).map(([k, v]) => [k, v.g])));
const TACTIC_HI = build('tactic', TACTIC_G, { width: 16 });
// 명경기 조각: 1배는 8×7 마스크를 2도트씩(16×14). 빛깔은 자리로 정한다(h 밝은 금 · d 짙은 금 · c 금) — 두 번 다듬어 32×28 반 도트
const shardChars = SHARD_ROWS.map((r, j) => [...r].map((ch, i) => (ch !== '#' ? '.' : (i + j) % 4 === 0 ? 'h' : j > 3 ? 'd' : 'c')).join(''));
const SHARD_HI = scale2x(scale2x(shardChars));

const SETS = {
  ICON_HI: [ICON_HI, '격언 · 전설 아이콘 24×24(12×12 자리). 문자는 icons.js와 같다: # 먹 · g 금 · r 붉음 · w 흰 · s 은 · p 보라 · b 파랑 · G 풀빛'],
  KIND_HI: [KIND_HI, '종류 딱지 문양 24×24(12×12 자리, kinds.js). # 문양'],
  CREST_HI: [CREST_HI, '세력 문장 24×24(12×12 자리, crests.js). o 테 · # 세력 빛깔 · h 밝은 빛 · s 은빛 · w 나무'],
  EMBLEM_HI: [EMBLEM_HI, '각인 재료 그림 32×32(16×16 자리, parts.js EMBLEM). o 테 · m 그늘 · h 몸 · w 빛'],
  TACTIC_HI: [TACTIC_HI, '전술 그림 32×22(16×11 자리, parts.js TACTIC_G). # 그림'],
};
for (const [name, [set]] of Object.entries(SETS)) for (const [id, rows] of Object.entries(set)) {
  const w = rows[0].length;
  if (rows.some((r) => r.length !== w)) throw new Error(`${name} ${id}`);
}

if (process.argv.includes('--print')) {
  for (const [name, [set]] of Object.entries(SETS)) for (const [id, rows] of Object.entries(set)) console.log(`${name}.${id}\n${rows.join('\n')}\n`);
  console.log(`SHARD_HI\n${SHARD_HI.join('\n')}`);
} else {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const block = (name, set, note) => `// ${note}\nexport const ${name} = {\n${Object.entries(set).map(([k, v]) => `  ${k}: [\n${v.map((r) => `    '${r}',`).join('\n')}\n  ],`).join('\n')}\n};\n`;
  const src = `// 두 배 도트 그림 마스크(CHM-39 2단계). tools/art-hi.mjs가 만든다 — 손으로 고치면 도구(PATCH)에도 옮긴다.
// 화면 배율 N ≥ 2(그리는 곳의 실제 배율 2 이상, sprites.js hiFor)에서 원래 자리에 반 도트로 그린다. N = 1은 원래 마스크 그대로.
${Object.entries(SETS).map(([name, [set, note]]) => block(name, set, note)).join('')}// 명경기 조각 32×28(16×14 자리, parts.js SHARD_ROWS를 2도트씩). c 금 · h 밝은 금 · d 짙은 금
export const SHARD_HI = [
${SHARD_HI.map((r) => `  '${r}',`).join('\n')}
];
`;
  fs.writeFileSync(path.join(ROOT, 'src/render/art-hi.js'), src);
  console.log('씀 src/render/art-hi.js', Object.entries(SETS).map(([n, [s]]) => `${n} ${Object.keys(s).length}`).join(' · '), '· SHARD_HI 1');
}
delete globalThis.document; delete globalThis.window;
