// 순위 이름 목록(CHM-70, src/data/names.js): 중복 없음 · 두 언어가 짝 · 금칙어 · 가장 긴 조합이 순위 줄에 들어가는가.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAMES, NAME_COUNT, nameText, randomName } from '../src/data/names.js';
import { PIECES } from '../src/data/pieces.js';
import { textWidth } from '../tools/fakedom.mjs';

// 순위 줄의 이름 칸에 들어가는 가장 넓은 이름(Galmuri11 12px 보통 굵기의 폭 표 — tools/fakedom.mjs)
const CAP = { ko: textWidth('호기심 많은 바다코끼리'), en: textWidth('Mischievous Hippopotamus') };
const LISTS = [['ko', 'adj'], ['ko', 'animal'], ['en', 'adj'], ['en', 'animal']];

test('이름 목록: 형용사 · 동물이 200개 안팎이고 한국어 · 영어가 같은 수(같은 차례)', () => {
  assert.equal(NAMES.ko.adj.length, NAMES.en.adj.length);
  assert.equal(NAMES.ko.animal.length, NAMES.en.animal.length);
  assert.deepEqual(NAME_COUNT, { a: NAMES.ko.adj.length, n: NAMES.ko.animal.length });
  assert.ok(NAME_COUNT.a >= 180 && NAME_COUNT.n >= 180, `${NAME_COUNT.a} × ${NAME_COUNT.n}`);
  assert.ok(NAME_COUNT.a < 32767 && NAME_COUNT.n < 32767); // DB는 smallint
});

test('이름 목록: 빈 낱말 · 앞뒤 공백 · 중복이 없다', () => {
  for (const [lang, k] of LISTS) {
    const L = NAMES[lang][k];
    for (const w of L) assert.ok(w && w === w.trim() && !/\s\s/.test(w), `${lang} ${k} 「${w}」`);
    assert.deepEqual(L.filter((w, i) => L.indexOf(w) !== i), [], `${lang} ${k} 중복`);
  }
});

test('이름 목록: 글자는 한글 · 영문 · 빈칸뿐(숫자 · 기호 없음), 영어는 낱말마다 대문자로 시작', () => {
  for (const k of ['adj', 'animal']) {
    for (const w of NAMES.ko[k]) assert.match(w, /^[가-힣]+( [가-힣]+)*$/, w);
    for (const w of NAMES.en[k]) assert.match(w, /^[A-Z][a-z]+( [A-Z][a-z]+)*$/, w);
  }
});

test('이름 목록: 가장 긴 조합이 순위 줄 한도 안(한국어 130 · 영어 173)', () => {
  assert.deepEqual(CAP, { ko: 130, en: 173 });
  for (const lang of ['ko', 'en']) {
    const widest = (L) => L.reduce((a, w) => (textWidth(w) > textWidth(a) ? w : a));
    const a = NAMES[lang].adj.indexOf(widest(NAMES[lang].adj)), n = NAMES[lang].animal.indexOf(widest(NAMES[lang].animal));
    const name = nameText(a, n, lang);
    assert.ok(textWidth(name) <= CAP[lang], `${lang} 「${name}」 ${textWidth(name)} > ${CAP[lang]}`);
  }
});

// 금칙어: 낱말 그대로(빈칸으로 나눈 낱말)와 어디에 끼어 있어도 안 되는 조각. 놀림 · 비하 · 욕설 · 성적 뜻 · 질병 · 정치 · 종교 · 체스 기물
const WORDS = {
  en: ['ass', 'tit', 'cock', 'dick', 'pig', 'hog', 'swine', 'cow', 'monkey', 'ape', 'rat', 'dog', 'bitch', 'donkey', 'mule', 'snake', 'worm', 'slug', 'louse', 'pussy', 'beaver', 'cougar',
    'booby', 'shag', 'chick', 'turkey', 'dodo', 'loon', 'cuckoo', 'weasel', 'skunk', 'shrew', 'toad', 'hyena', 'vulture', 'leech', 'shrimp', 'cardinal', 'mantis', 'lamb',
    'fat', 'ugly', 'dumb', 'stupid', 'lazy', 'dirty', 'filthy', 'wet', 'moist', 'hard', 'hot', 'sexy', 'naked', 'horny', 'naughty', 'gay', 'queer', 'crazy', 'mad', 'insane', 'sick', 'ill',
    'drunk', 'high', 'dead', 'dying', 'evil', 'holy', 'sacred', 'divine', 'blessed', 'red', 'black', 'white', 'yellow', 'brown', 'thirsty', 'loose', 'easy', 'stiff', 'juicy', 'tasty', 'old', 'poor', 'weak',
    'king', 'queen', 'rook', 'bishop', 'knight', 'pawn', 'horse', 'camel', 'crow', 'jester', 'amazon', 'archer', 'ghost', 'cannon', 'kill', 'killer'],
  ko: ['쥐', '닭', '개', '돼지', '소', '말', '뱀', '원숭이', '오징어', '멸치', '새우', '두꺼비', '맹꽁이', '미꾸라지', '피라미', '박쥐', '잠자리', '사마귀', '무당벌레', '베짱이', '하루살이', '당나귀', '고등어',
    '뚱뚱한', '못생긴', '멍청한', '게으른', '더러운', '미친', '아픈', '취한', '죽은', '야한', '뜨거운', '촉촉한', '은밀한', '거룩한', '신성한', '붉은', '빨간', '검은', '하얀', '노란', '늙은', '가난한', '약한',
    '킹', '퀸', '룩', '비숍', '나이트', '폰', '낙타', '까마귀', '광대', '아마존', '궁수', '유령', '포', '알라', '라마'],
};
const PARTS = {
  en: ['cock', 'sex', 'fuck', 'shit', 'nazi', 'porn', 'slave', 'sperm', 'pecker'],
  ko: ['씨발', '병신', '새끼', '지랄', '섹스', '변태', '빨갱이', '일베', '메갈', '좌파', '우파', '예수', '부처', '죽', '똥', '오줌', '원숭이', '돼지', '오징어'],
};
test('이름 목록: 금칙어에 걸리는 낱말이 없다', () => {
  for (const [lang, k] of LISTS) {
    for (const w of NAMES[lang][k]) {
      const low = w.toLowerCase();
      for (const part of low.split(' ')) assert.ok(!WORDS[lang].includes(part), `${lang} ${k} 「${w}」 — 금칙 낱말`);
      for (const part of low.split(' ')) for (const chess of ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn']) assert.ok(!part.startsWith(chess), `${lang} ${k} 「${w}」 — 체스 기물 ${chess}`);
      for (const bad of PARTS[lang]) assert.ok(!low.includes(bad), `${lang} ${k} 「${w}」 — 금칙 조각 ${bad}`);
    }
  }
});

test('이름 목록: 이 게임의 기물 이름과 겹치지 않는다', () => {
  const pieces = new Set(Object.values(PIECES).map((p) => p.name).filter(Boolean));
  assert.ok(pieces.size >= 6);
  for (const k of ['adj', 'animal']) for (const w of NAMES.ko[k]) assert.ok(!pieces.has(w), `「${w}」는 기물 이름`);
});

test('nameText · randomName: 번호 한 쌍 ↔ 보이는 이름, 모르는 번호는 빈 글, 다시 짓기는 다른 이름', () => {
  assert.equal(nameText(0, 0, 'ko'), '졸린 수달');
  assert.equal(nameText(0, 0, 'en'), 'Sleepy Otter');
  assert.equal(nameText(2, 44, 'ko'), '호기심 많은 바다코끼리');
  assert.equal(nameText(3, 18, 'en'), 'Mischievous Hippopotamus');
  assert.equal(nameText(0, 0, 'xx'), '졸린 수달');
  assert.equal(nameText(9999, 0), '');
  assert.equal(nameText(-1, 0), '');
  let i = 0;
  const seq = [0.5, 0.5, 0.5, 0.5, 0.1, 0.9];
  const got = randomName(() => seq[i++ % seq.length], { a: Math.floor(0.5 * NAME_COUNT.a), n: Math.floor(0.5 * NAME_COUNT.n) });
  assert.deepEqual(got, { a: Math.floor(0.1 * NAME_COUNT.a), n: Math.floor(0.9 * NAME_COUNT.n) });
  for (let k = 0; k < 200; k++) { const r = randomName(); assert.ok(nameText(r.a, r.n, 'en')); }
  assert.deepEqual(randomName(() => 0.999999999999), { a: NAME_COUNT.a - 1, n: NAME_COUNT.n - 1 });
});
