import { route } from '../_lib/http.js';

// GET /api/daily/board?date=&page= (+ 열쇠 머리말 — 없으면 구경) → { date, total, page, pages, rows, me, around }
export const { GET, OPTIONS } = route('GET', (s, query) => s.board(query));
