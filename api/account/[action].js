import { routes } from '../_lib/http.js';
import { LIMITS } from '../_lib/service.js';

// POST /api/account/{signup,login,logout,password,delete} (docs/design-notes/leaderboard.md 「계정」) — 열쇠는 Authorization 머리말로
export const { POST, OPTIONS } = routes('POST', {
  signup: (s, body) => s.accountSignup(body),
  login: (s, body) => s.accountLogin(body),
  logout: (s, body) => s.accountLogout(body),
  password: (s, body) => s.accountPassword(body),
  delete: (s, body) => s.accountDelete(body),
}, undefined, { limit: LIMITS.account });
