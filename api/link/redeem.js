import { route } from '../_lib/http.js';

// POST /api/link/redeem { key, code } → { key, a, n, rerolls, devices }
export const { POST, OPTIONS } = route('POST', (s, body) => s.linkRedeem(body));
