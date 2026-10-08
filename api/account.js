import { route } from './_lib/http.js';

// GET /api/account → { username | null, devices } — 열쇠는 Authorization 머리말로
export const { GET, OPTIONS } = route('GET', (s, query) => s.accountGet(query));
