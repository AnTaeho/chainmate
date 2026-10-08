import { route } from '../_lib/http.js';

// POST /api/link/code { key } → { code, expiresAt, ttl } (docs/design-notes/leaderboard.md 「기기 잇기 · 클라우드 저장」)
export const { POST, OPTIONS } = route('POST', (s, body) => s.linkCode(body));
