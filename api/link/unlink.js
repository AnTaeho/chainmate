import { route } from '../_lib/http.js';

// POST /api/link/unlink { key } → { key, a, n, rerolls, devices }
export const { POST, OPTIONS } = route('POST', (s, body) => s.linkUnlink(body));
