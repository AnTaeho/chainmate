import { route } from './_lib/http.js';

// POST /api/player { key?, reroll? } → { key, a, n, rerolls }
export const { POST, OPTIONS } = route('POST', (s, body) => s.player(body));
