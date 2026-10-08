import { route } from '../_lib/http.js';
import { LIMITS } from '../_lib/service.js';

// POST /api/account/password (docs/design-notes/leaderboard.md 「계정」) — 열쇠는 Authorization 머리말로
export const { POST, OPTIONS } = route('POST', (s, body) => s.accountPassword(body), undefined, { limit: LIMITS.account });
