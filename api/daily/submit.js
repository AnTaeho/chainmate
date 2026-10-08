import { route } from '../_lib/http.js';

// POST /api/daily/submit { key, date, build, cmds } → { ok, best, rank, total, improved }
export const { POST, OPTIONS } = route('POST', (s, body) => s.submit(body));
