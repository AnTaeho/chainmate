// 순위 화면 쪽 시험의 가짜 서버(CHM-70): 진짜 요청 → 응답 로직(api/_lib/service.js)에 기억 저장소(memstore.js)를 물리고 fetch 꼴로 감싼다.
// HTTP · DB는 없다 — 화면 쪽(src/ui/rank.js)이 진짜 서버와 같은 답을 받는다. 연기 시험(tools/smoke.mjs) · 스크린샷 도구도 이것을 쓴다.
import { createService } from '../../api/_lib/service.js';
import { memStore } from './memstore.js';

// api.mode: 'ok' | 'fail'(망이 끊김 — fetch가 거절) | 'html'(다른 서버가 답함 — JSON이 아닌 404) | 'hang'(답이 안 온다)
// api.calls: 받은 요청 [{ method, path, query, body }]. api.setBuild(b): 새로 배포된 것처럼 배포 식별자를 바꾼다
// newCode: 옮기기 코드를 정해 줄 때(없으면 진짜 무작위)
// scryptN: 비번 해시의 N — 시험은 작게(진짜 값은 한 번에 수십 ms · 32MiB)
export function fakeApi({ build = 'test-build', now = () => Date.now(), store = memStore(), rand = Math.random, newCode = null, scryptN = 16 } = {}) {
  const api = { store, mode: 'ok', calls: [], build };
  const more = { scryptN, ...(newCode ? { newCode } : {}) };
  let service = createService({ store, build, now, rand, ...more });
  api.setBuild = (b) => { api.build = b; service = createService({ store, build: b, now, rand, ...more }); };
  api.named = (path) => api.calls.filter((c) => c.path === path);
  api.fetch = async (url, init = {}) => {
    const u = new URL(url, 'http://fake.local');
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    try { body = init.body ? JSON.parse(init.body) : null; } catch { body = undefined; }
    let query = Object.fromEntries(u.searchParams);
    // 열쇠 머리말(api/_lib/http.js route와 같은 뜻): 머리말의 열쇠만 받고 주소 · 본문의 key는 버린다. calls에는 보낸 그대로(주소 · 본문) + auth(머리말의 열쇠)
    const h = init.headers || {}, m = /^Bearer\s+(\S+)$/i.exec(h.Authorization || h.authorization || '');
    api.calls.push({ method, path: u.pathname, query, body, keepalive: !!init.keepalive, auth: m ? m[1] : null, url: String(url) });
    const keyed = (o) => { const { key: _old, ...rest } = o; return m ? { ...rest, key: m[1] } : rest; };
    if (method === 'GET') query = keyed(query); else if (body && typeof body === 'object' && !Array.isArray(body)) body = keyed(body); else if (body === null && m) body = { key: m[1] };
    if (api.mode === 'hang') return new Promise(() => {});
    if (api.mode === 'fail') throw new TypeError('Failed to fetch');
    const html = { ok: false, status: 404, json: async () => { throw new SyntaxError('Unexpected token <'); } };
    if (api.mode === 'html') return html;
    let r = null;
    if (method === 'GET' && u.pathname === '/api/hello') r = await service.hello();
    else if (method === 'POST' && u.pathname === '/api/player') r = await service.player(body);
    else if (method === 'POST' && u.pathname === '/api/daily/submit') r = await service.submit(body);
    else if (method === 'GET' && u.pathname === '/api/daily/board') r = await service.board(query);
    else if (method === 'POST' && u.pathname === '/api/link/code') r = await service.linkCode(body);
    else if (method === 'POST' && u.pathname === '/api/link/redeem') r = await service.linkRedeem(body);
    else if (method === 'POST' && u.pathname === '/api/link/devices') r = await service.linkDevices(body);
    else if (method === 'POST' && u.pathname === '/api/link/unlink') r = await service.linkUnlink(body);
    else if (method === 'GET' && u.pathname === '/api/save') r = await service.saveGet(query);
    else if (method === 'PUT' && u.pathname === '/api/save') r = await service.savePut(body);
    else if (method === 'GET' && u.pathname === '/api/account') r = await service.accountGet(query);
    else if (method === 'POST' && u.pathname === '/api/account/signup') r = await service.accountSignup(body);
    else if (method === 'POST' && u.pathname === '/api/account/login') r = await service.accountLogin(body);
    else if (method === 'POST' && u.pathname === '/api/account/logout') r = await service.accountLogout(body);
    else if (method === 'POST' && u.pathname === '/api/account/password') r = await service.accountPassword(body);
    else if (method === 'POST' && u.pathname === '/api/account/delete') r = await service.accountDelete(body);
    if (!r) return html;
    const out = JSON.parse(JSON.stringify(r.body));
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => out };
  };
  return api;
}

// ── 꾸민 순위표(연기 시험 · 스크린샷 · 폭 시험): 기억 저장소에 다른 사람들의 그날 성적을 바로 넣는다(명령 줄 없이 — 서버 다시 두기를 거치지 않는다).
import { NAMES, NAME_COUNT } from '../../src/data/names.js';
import { hashKey } from '../../api/_lib/service.js';

const idx = (lang, kind, word) => NAMES[lang][kind].indexOf(word);
// 가장 넓은 이름(src/data/names.js 머리말): 한국어 「호기심 많은 바다코끼리」 · 영어 「Mischievous Hippopotamus」
export const LONG_KO = { a: idx('ko', 'adj', '호기심 많은'), n: idx('ko', 'animal', '바다코끼리') };
export const LONG_EN = { a: idx('en', 'adj', 'Mischievous'), n: idx('en', 'animal', 'Hippopotamus') };
// 줄 count개: 위에서부터 8관 우승 → 낮은 관. 맨 위 둘은 가장 넓은 이름 + 큰 점수(봇이 실제로 내는 열 자리 「1,010,796,771」 · 「3,482,150」)
export function demoRows(count = 24) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const k = i / Math.max(1, count - 1);
    const ante = Math.max(1, 8 - Math.floor(k * 7.5)), won = i < Math.max(2, Math.floor(count / 8));
    const name = i === 0 ? LONG_KO : i === 1 ? LONG_EN : { a: (i * 37 + 5) % NAME_COUNT.a, n: (i * 53 + 11) % NAME_COUNT.n };
    out.push({ ...name, ante: won ? 8 : ante, blind: won ? 2 : (i * 2) % 3, won, score: i === 0 ? 1010796771 : i === 1 ? 3482150 : Math.round(2217600 * Math.pow(1 - k, 4)) + 120 + i * 7 });
  }
  return out;
}
export async function seedBoard(api, date, rows = demoRows()) {
  let i = 0;
  for (const r of rows) {
    const p = await api.store.createPlayer(hashKey(`seed:${date}:${i++}`), r.a, r.n);
    await api.store.putScore(p.id, date, { ante: r.ante, blind: r.blind, won: !!r.won, score_total: r.score, battles: r.ante * 3, moves: r.ante * 9, ignite: null }, api.build, '[]');
  }
  return rows.length;
}
