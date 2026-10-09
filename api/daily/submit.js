import { route } from '../_lib/http.js';

// POST /api/daily/submit { date, build, cmds } (+ 열쇠 머리말) → { ok, best, rank, total, improved }
export const { POST, OPTIONS } = route('POST', (s, body) => s.submit(body));
