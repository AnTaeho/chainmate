// 밤샘 2 D4: 장치를 하나씩 켜 보며 잰다(run.mjs · luck.mjs의 --tune). {"clock":1,"reboard":false,"filter":0,"reboardRatio":1}
// 판 조정(거르기 · 다시 놓기)은 src/sim/tuning.js BOARD_TUNING을 바꾼다 — 규칙 · 봇 · 화면이 모두 그 값을 따른다.
import { CLOCK } from '../src/sim/run.js';
import { BOARD_TUNING } from '../src/sim/tuning.js';
import { REBOARD } from './bot.mjs';

export function applyNight2(tune) {
  if (!tune) return;
  if (tune.clock != null) CLOCK.start = tune.clock;
  if (tune.reboard != null) BOARD_TUNING.reboard = !!tune.reboard;
  if (tune.reboardRatio != null) REBOARD.ratio = tune.reboardRatio;
  if (tune.filter != null) BOARD_TUNING.filter = tune.filter;
}
