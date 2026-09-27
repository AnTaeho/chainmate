// 묘수(깊이 F): 소모품 칸에 드는 한 번 쓰는 수. 대국 중(떨구기 전)에 쓴다 — 막힌 판을 뚫는 비상구.
// 버린 안: 되돌리기(대국 상태를 통째로 되감아야 해서 연출 · 증원 예고와 엇갈린다) · 소용돌이(적 자리를 섞으면 완전 정보 퍼즐이 흐려진다) ·
//   오셀로 · 조커(규칙 설명이 두 줄을 넘는다) · 저격(비숍 · 퀸 행마를 바꾸는 규칙이 이미 이형 · 고속도로에 있다).
import { PIECES } from './pieces.js';
import { createRng, fork, int } from '../sim/rng.js';

export const TACTICS = [
  { id: 'freeze', name: '빙결', text: '쓰면 값이 가장 큰 적 셋이 이번 수 동안 아무것도 지키지 못한다', families: ['sacrifice'] },
  { id: 'reload', name: '재장전', text: '쓰면 이번 대국의 수 +1', families: ['march'] },
  { id: 'taunt', name: '도발', text: '쓰면 적 폰 넷이 빈칸에 나와 먹을 적이 는다', families: ['hunt'] },
];
export const TACTIC_BY_ID = Object.fromEntries(TACTICS.map((x) => [x.id, x]));
export const TACTIC_PRICE = 4;

// 대국 b에 묘수를 쓴다(떨구기 전 · play 상태에서만). 돌려주는 값: 사건 배열
export function useTactic(b, id) {
  if (b.status !== 'play') throw new Error('tactic only before a drop');
  const events = [];
  if (id === 'freeze') {
    const list = [];
    b.board.forEach((c, sq) => { if (c && !c.mine && c.t !== 'K' && c.t !== 'X' && c.t !== 'J') list.push(sq); });
    list.sort((x, y) => PIECES[b.board[y].t].value - PIECES[b.board[x].t].value || x - y);
    for (const sq of list.slice(0, 3)) b.board[sq] = { ...b.board[sq], frozen: true };
    events.push({ type: 'freeze', squares: list.slice(0, 3) });
  } else if (id === 'reload') {
    b.movesLeft++;
    b.rules = { ...b.rules, moves: b.rules.moves + 1 };
    events.push({ type: 'reload' });
  } else if (id === 'taunt') {
    const r = fork(createRng((b.seed ?? 1) >>> 0), `taunt:${b.movesUsed}`);
    const free = [];
    for (let sq = 24; sq < 56; sq++) if (!b.board[sq]) free.push(sq);
    const placed = [];
    for (let i = 0; i < 4 && free.length; i++) {
      const sq = free.splice(int(r, free.length), 1)[0];
      b.board[sq] = { t: 'P', id: b.nextId++, born: b.movesUsed };
      placed.push(sq);
    }
    events.push({ type: 'taunt', squares: placed });
  } else throw new Error(`unknown tactic ${id}`);
  return events;
}
// 얼린 적은 수가 끝나면 풀린다
export function thaw(b) { for (let i = 0; i < 64; i++) if (b.board[i] && b.board[i].frozen) b.board[i] = { ...b.board[i], frozen: false }; }

// 진화(깊이 F): 두루마리 「진화」 — 주머니 기물 하나를 그 종류의 이형으로(여럿이면 판 시드 · 기물 번호로 정해진다)
export const EVOLVE = { P: ['S'], N: ['H', 'L'], B: ['A'], R: ['C', 'O', 'W'], Q: ['Z'] };
export const EVOLVE_PRICE = 4;
export const evolveTo = (seed, piece) => { const l = EVOLVE[piece.t]; return l ? l[(seed + piece.id) % l.length] : null; };
