// 밤샘 2 D4: 장치를 하나씩 켜 보며 잰다(run.mjs · luck.mjs의 --tune). {"clock":1,"reboard":false,"filter":0,"reboardRatio":1}
import { CLOCK, BOARD_FILTER_N } from '../src/sim/run.js';
import { DEFAULT_RULES } from '../src/sim/battle.js';
import { REBOARD } from './bot.mjs';

export function applyNight2(tune) {
  if (!tune) return;
  if (tune.clock != null) CLOCK.start = tune.clock;
  if (tune.reboard === false) { REBOARD.on = false; DEFAULT_RULES.reboards = 0; }
  if (tune.reboardRatio != null) REBOARD.ratio = tune.reboardRatio;
  if (tune.filter != null) for (const k of Object.keys(BOARD_FILTER_N)) BOARD_FILTER_N[k] = typeof tune.filter === 'object' ? tune.filter[k] : tune.filter;
}

