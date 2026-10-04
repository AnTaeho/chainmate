// 사슬 시험의 탁자: 판(map) · 조정자 · 대국 쪽 값(extra)만 둔 가장 작은 대국
import { boardFrom } from '../../src/sim/board.js';

export const table = (map, mods = [], extra = {}) => ({ board: boardFrom(map), rules: {}, mods, chain: null, ...extra });
