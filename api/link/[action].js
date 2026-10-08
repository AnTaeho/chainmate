import { routes } from '../_lib/http.js';

// POST /api/link/{code,redeem,devices,unlink} (docs/design-notes/leaderboard.md 「기기 잇기 · 클라우드 저장」)
export const { POST, OPTIONS } = routes('POST', {
  code: (s, body) => s.linkCode(body),
  redeem: (s, body) => s.linkRedeem(body),
  devices: (s, body) => s.linkDevices(body),
  unlink: (s, body) => s.linkUnlink(body),
});
