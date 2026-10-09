import { route } from './_lib/http.js';

// POST /api/player { reroll? } (+ 열쇠 머리말 — 없으면 새 플레이어) → { key, a, n, rerolls }
export const { POST, OPTIONS } = route('POST', (s, body) => s.player(body));
