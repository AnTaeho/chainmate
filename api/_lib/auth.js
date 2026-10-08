// 계정(CHM-72, docs/design-notes/leaderboard.md 「계정」): 아이디 · 비번 규칙과 비번 해시. 외부 패키지 없이 node:crypto의 scrypt만 쓴다.
// 비번 원문은 여기서 해시로 바뀐 뒤 어디에도 남지 않는다(로그 · 오류 글에도 싣지 않는다).
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

// N 2^15 · r 8 · p 1: 한 번에 메모리 32MiB(128 × N × r). Node의 기본 한도(32MiB)에 걸리므로 maxmem을 넉넉히 준다
export const SCRYPT = { N: 1 << 15, r: 8, p: 1, salt: 16, len: 32, maxmem: 96 * 1024 * 1024 };

export const USERNAME = { min: 3, max: 20 };
export const PASSWORD = { min: 8, max: 72 };
// 막는 아이디: 운영 쪽으로 읽힐 이름
export const RESERVED = new Set(['admin', 'administrator', 'root', 'system', 'support', 'help', 'staff', 'mod', 'moderator', 'official',
  'chainmate', 'chain_mate', 'papercut', 'paper_cut', 'owner', 'master', 'null', 'undefined', 'anonymous', 'guest', 'test', 'user', 'username', 'login', 'account']);
// 흔한 비번(소문자로 견준다)
export const COMMON = new Set(['password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', '12345678', '123456789', '1234567890', '0123456789',
  '87654321', '11111111', '00000000', '12341234', '11223344', '12344321', '123123123', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4', '1qaz2wsx', 'qwertyui',
  'qwerty123', 'qwerty1234', 'qwertyuiop', 'asdfghjk', 'asdfghjkl', 'asdf1234', 'zxcvbnm1', 'abcd1234', 'abcdefgh', 'abc12345', 'a1b2c3d4', 'aaaaaaaa',
  'iloveyou', 'iloveyou1', 'sunshine', 'princess', 'football', 'baseball', 'superman', 'trustno1', 'letmein1', 'welcome1', 'admin123', 'administrator',
  'computer', 'internet', 'starwars', 'dragon123', 'monkey123', 'chainmate', 'checkmate', 'changeme']);

// 아이디: 영문 소문자 · 숫자 · _ 3~20자. 대문자는 소문자로 고친다. 틀리면 null
export function cleanUsername(v) {
  if (typeof v !== 'string') return null;
  const u = v.trim().toLowerCase();
  if (u.length < USERNAME.min || u.length > USERNAME.max || !/^[a-z0-9_]+$/.test(u) || RESERVED.has(u)) return null;
  return u;
}
// 비번: 8~72자 · 흔한 것과 아이디와 같은 것은 막는다
export function passwordOk(pw, username = '') {
  if (typeof pw !== 'string' || pw.length < PASSWORD.min || pw.length > PASSWORD.max || Buffer.byteLength(pw) > PASSWORD.max * 4) return false;
  const low = pw.toLowerCase();
  return !COMMON.has(low) && low !== String(username).toLowerCase();
}

const derive = (pw, salt, N, r, p, len) => new Promise((done, fail) => {
  scrypt(pw.normalize('NFKC'), salt, len, { N, r, p, maxmem: SCRYPT.maxmem }, (e, key) => (e ? fail(e) : done(key)));
});
// 「scrypt$N$r$p$salt$hash」(salt · hash는 base64)
export async function hashPassword(pw, { N = SCRYPT.N, salt = randomBytes(SCRYPT.salt) } = {}) {
  const key = await derive(pw, salt, N, SCRYPT.r, SCRYPT.p, SCRYPT.len);
  return `scrypt$${N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
// 저장된 글과 견준다. 꼴이 틀린 글은 거짓
export async function verifyPassword(pw, stored) {
  const m = typeof stored === 'string' ? stored.split('$') : [];
  if (m.length !== 6 || m[0] !== 'scrypt' || typeof pw !== 'string') return false;
  const N = Number(m[1]), r = Number(m[2]), p = Number(m[3]);
  if (!Number.isInteger(N) || N < 2 || N > (1 << 20) || (N & (N - 1)) !== 0 || r !== SCRYPT.r || p !== SCRYPT.p) return false;
  const salt = Buffer.from(m[4], 'base64'), want = Buffer.from(m[5], 'base64');
  if (!salt.length || want.length !== SCRYPT.len) return false;
  const got = await derive(pw, salt, N, r, p, want.length);
  return timingSafeEqual(got, want);
}
// 한도 표(link_limits.who는 bigint)에 쓸 아이디의 번호: 해시의 앞 60비트. 아이디 원문은 한도 표에 두지 않는다
export const usernameId = (username) => BigInt(`0x${createHash('sha256').update(`user:${username}`).digest('hex').slice(0, 15)}`).toString();
