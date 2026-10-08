import { route } from './_lib/http.js';
import { LIMITS } from './_lib/service.js';

// GET /api/save?key= → { rev, updatedAt, blob } | { rev: 0 }
// PUT /api/save { key, baseRev, blob } → { rev, updatedAt } | 409 { rev, updatedAt, blob }
const opts = { limit: LIMITS.save, allow: 'GET, PUT' };
export const { GET, OPTIONS } = route('GET', (s, query) => s.saveGet(query), undefined, opts);
export const { PUT } = route('PUT', (s, body) => s.savePut(body), undefined, opts);
