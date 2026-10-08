import { route } from './_lib/http.js';

// GET /api/hello → { build } (docs/design-notes/leaderboard.md)
export const { GET, OPTIONS } = route('GET', (s) => s.hello());
