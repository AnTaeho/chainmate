// 복기 화면 글 · 표시 자리(CHM-59). 계산은 src/sim/replay.js, 화면은 대국 화면의 갈림길 카드(screens/battle.js)와
// 다시 두기(screens/review.js). 그리기를 모르는 셈만 여기 두어 시험이 잰다.
import { PIECE_NAME, josa } from './words.js';
import { sqName } from '../sim/board.js';
import { num } from '../render/gfx.js';

// 복기를 켜는 대국: 판(런)의 대국(오늘의 대국 · 끝없는 대국 포함). 수업 · 킹 대본 · 연습 판(scratch) · 타이틀 하늘은 끈다. 설정 「복기」로 끈다.
export const reviewOn = (app, src, b) => app.settings.replay !== false && !!src && src.kind === 'run' && !!app.run && !app.run.scratch && !!b && !b.script;

// 카드 첫 줄 · 둘째 줄 · 점수 줄. r = review() 결과(kind 'path'), board = 갈림길 상태의 판(사슬이 갈린 칸의 적 이름)
export const forkTitle = (r) => `${r.move}번째 수가 승부처였어요`;
export function forkLine(r, board) {
  const b0 = r.best[0];
  const s = r.split && r.split.best;
  if (s && s.type === 'capture') {
    const c = board && board[s.sq];
    return c && !c.mine && PIECE_NAME[c.t] ? `${sqName(s.sq)}의 ${josa(PIECE_NAME[c.t], '을/를')} 먹었다면 이겼어요` : `${sqName(s.sq)}의 적을 먹었다면 이겼어요`;
  }
  if (s && s.type === 'redrop') return `${sqName(s.sq)}에 한 번 더 놓았다면 이겼어요`;
  if (b0.kind === 'drop') return `${josa(PIECE_NAME[b0.t], '을/를')} ${sqName(b0.sq)}에 놓았다면 이겼어요`;
  if (b0.kind === 'discard') return `${josa(PIECE_NAME[b0.t], '을/를')} 희생했다면 이겼어요`;
  return '판을 다시 놓았다면 이겼어요';
}
export const forkScores = (r) => `내가 둔 수 ${num(r.scores.mine)} · 이기는 수 ${r.mate ? '메이트' : num(r.scores.best)} / 목표 ${num(r.scores.target)}`;
// 한 줄에 안 들어가면 두 줄로(목표를 줄 가운데서 끊지 않게)
export const forkScoreLines = (r) => [`내가 둔 수 ${num(r.scores.mine)} · 이기는 수 ${r.mate ? '메이트' : num(r.scores.best)}`, `목표 ${num(r.scores.target)}`];
// 두 줄 첫 줄도 안 들어가면(영어 · 큰 수) 세 줄로 — 「네 수」 · 「이길 길」 · 「목표」를 줄 가운데서 끊지 않게
export const forkScoreRows = (r) => [`내가 둔 수 ${num(r.scores.mine)}`, `이기는 수 ${r.mate ? '메이트' : num(r.scores.best)}`, `목표 ${num(r.scores.target)}`];
export const NO_PATH = '이번 대국은 이길 방법이 없었어요';
export const THINKING = '복기 중…';

// 갈림길 표시 칸: 「?」 내 수(붉음) · 「!」 이길 수(청록). 같은 떨구기면 사슬이 처음 갈린 칸에.
// 희생 · 다시 놓기는 판 위 칸이 없다(null).
export function forkMarks(r) {
  if (r.split) return { mine: r.split.mine ? r.split.mine.sq : null, best: r.split.best ? r.split.best.sq : null, ghost: null };
  const m = r.mine, b = r.best[0];
  return { mine: m.kind === 'drop' ? m.sq : null, best: b.kind === 'drop' ? b.sq : null, ghost: b.kind === 'drop' ? b.t : null };
}

// 다시 두기 왼쪽 칸 한 줄: 결정 하나(describe 꼴) → { t(기물 그림), label(칸 이름 · 희생 · 다시 놓기), gain }
export function stepLabel(d) {
  if (!d) return null;
  if (d.kind === 'drop') return { t: d.t, label: sqName(d.sq), gain: d.gain };
  if (d.kind === 'discard') return { t: d.t, label: '희생', gain: d.gain };
  return { t: null, label: '다시 놓기', gain: d.gain };
}
