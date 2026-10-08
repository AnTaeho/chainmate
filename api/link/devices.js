import { route } from '../_lib/http.js';

// POST /api/link/devices { key } → { devices }
export const { POST, OPTIONS } = route('POST', (s, body) => s.linkDevices(body));
