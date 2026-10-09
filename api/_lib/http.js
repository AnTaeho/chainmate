// 순위(CHM-70) · 기기 잇기(CHM-71) · 계정(CHM-72) 함수의 HTTP 껍데기: 출처 확인 · JSON 읽기(크기 한도) · 오류 감싸기. 로직은 api/_lib/service.js.
// IP는 읽지도 남기지도 않는다. 500에는 내부 메시지를 싣지 않는다(기록은 함수 로그에만).
import { createStore } from './store.js';
import { createService, LIMITS } from './service.js';

// 같은 출처 말고 받아 줄 출처(앱 Tauri 출처는 여기에 붙인다 — 예: 'tauri://localhost')
export const ALLOWED_ORIGINS = [];

// 배포 식별자: 클라이언트는 켤 때 받아 두었다가 제출에 싣는다. 다르면(그 사이 새로 배포) 409 stale — 규칙이 다른 판을 다시 두지 않는다
export const BUILD = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

// 드라이버는 처음 쓸 때 싣는다 — 시험(가짜 서비스)은 npm 패키지 없이 돈다
let service = null;
async function getService() {
  if (!service) {
    const { neon } = await import('@neondatabase/serverless');
    const q = neon(process.env.DATABASE_URL);
    service = createService({ store: createStore((text, params) => q.query(text, params)), build: BUILD });
  }
  return service;
}

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
});

// 출처: Origin이 없거나(브라우저 밖 · 같은 출처 GET) 요청 호스트와 같거나 허용 목록에 있으면 받는다
export function originOk(request, allowed = ALLOWED_ORIGINS) {
  const origin = request.headers.get('origin');
  if (!origin) return { ok: true, cors: {} };
  let host = null;
  try { host = new URL(origin).host; } catch { /* 틀린 Origin */ }
  const mine = request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
  if (host && host === mine) return { ok: true, cors: {} };
  if (allowed.includes(origin)) return { ok: true, cors: { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } };
  return { ok: false, cors: {} };
}

// JSON 본문: 크기 한도 · 객체만. 틀리면 { error }
export async function readJson(request, limit = LIMITS.body) {
  if (!/^application\/json\b/i.test(request.headers.get('content-type') || '')) return { error: [415, 'json_only'] };
  if (Number(request.headers.get('content-length') || 0) > limit) return { error: [413, 'too_large'] };
  const text = await request.text();
  if (Buffer.byteLength(text) > limit) return { error: [413, 'too_large'] };
  let body;
  try { body = JSON.parse(text); } catch { return { error: [400, 'bad_json'] }; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: [400, 'bad_request'] };
  return { body };
}

// 열쇠는 Authorization: Bearer <key> 머리말로만 받는다(CHM-72 — 주소 · 접근 로그에 실리지 않게). 머리말이 없으면 null, 꼴이 틀리면 ''
export function bearer(request) {
  const h = request.headers.get('authorization');
  if (!h) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(h.trim());
  return m ? m[1] : '';
}

// method: 'GET' | 'POST' | 'PUT'. run(service, 입력) → { status, body }. 돌려주는 것: Vercel 함수가 내보낼 { GET | POST | PUT, OPTIONS }
// make: 서비스를 만드는 함수(시험이 가짜를 넘긴다). limit: 본문 한도(바이트). allow: 이 길이 받는 방식 모두(OPTIONS 답 — 한 파일이 둘을 내보낼 때)
export function route(method, run, make = getService, { limit = LIMITS.body, allow = method } = {}) {
  const handle = async (request) => {
    const o = originOk(request);
    if (!o.ok) return json(403, { error: 'bad_origin' });
    try {
      let input;
      if (method !== 'GET') {
        const r = await readJson(request, limit);
        if (r.error) return json(r.error[0], { error: r.error[1] }, o.cors);
        input = r.body;
      } else input = Object.fromEntries(new URL(request.url, 'http://x').searchParams);
      // 본문 · 주소에 실려 온 key는 버린다
      delete input.key;
      const key = bearer(request);
      if (key != null) input.key = key;
      const out = await run(await make(), input);
      return json(out.status, out.body, o.cors);
    } catch (e) {
      console.error('leaderboard', e);
      return json(500, { error: 'server' }, o.cors);
    }
  };
  const options = (request) => {
    const o = originOk(request);
    if (!o.ok) return json(403, { error: 'bad_origin' });
    return new Response(null, { status: 204, headers: { ...o.cors, 'Access-Control-Allow-Methods': `${allow}, OPTIONS`, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '86400' } });
  };
  return { [method]: handle, OPTIONS: options };
}

// 한 파일이 여러 길을 받는다(api/x/[action].js): 주소의 마지막 조각으로 table의 run을 고른다. 모르는 조각은 404 not_found
export function routes(method, table, make = getService, opts = {}) {
  const made = new Map(Object.entries(table).map(([name, run]) => [name, route(method, run, make, opts)]));
  const handle = (request) => {
    const name = new URL(request.url, 'http://x').pathname.split('/').filter(Boolean).pop();
    const hit = made.get(name);
    if (hit) return hit[method](request);
    const o = originOk(request);
    return o.ok ? json(404, { error: 'not_found' }, o.cors) : json(403, { error: 'bad_origin' });
  };
  return { [method]: handle, OPTIONS: route(method, null, make, opts).OPTIONS };
}
