import { route } from '../_lib/http.js';

// GET /api/daily/board?date=&page=&key= → { date, total, page, pages, rows, me, around }
export const { GET, OPTIONS } = route('GET', (s, query) => s.board(query));
