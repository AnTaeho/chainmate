// 순위 DB 스키마 적용(CHM-70): node tools/db-migrate.mjs — db/schema.sql을 .env.local의 DATABASE_URL_UNPOOLED(풀 없는 직접 연결)로 넣는다.
// 스키마는 if not exists · on conflict do nothing만 써서 여러 번 돌려도 같다. 비밀 값은 찍지 않는다.
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';

const ROOT = new URL('..', import.meta.url);
// .env.local에서 값 하나(없으면 환경 변수). 도구들이 함께 쓴다
export function envLocal(name) {
  if (process.env[name]) return process.env[name];
  let text = '';
  try { text = fs.readFileSync(new URL('.env.local', ROOT), 'utf8'); } catch { /* 없으면 환경 변수만 */ }
  const m = text.match(new RegExp(`^${name}=("?)(.*)\\1\\s*$`, 'm'));
  return m ? m[2] : null;
}
export function direct() {
  const url = envLocal('DATABASE_URL_UNPOOLED');
  if (!url) throw new Error('DATABASE_URL_UNPOOLED가 없다(.env.local — vercel env pull .env.local)');
  return neon(url);
}

// 시험 플레이어(players.test)와 딸린 것을 모두 지우고 남은 수를 센다(tools/daily-e2e.mjs · link-e2e.mjs · shots-link.mjs가 함께 쓴다).
// 성적 · 명령 줄 · 열쇠 · 코드 · 저장은 플레이어를 따라 지워지고(cascade), 한도 줄(link_limits)은 여기서 지운다. 돌려주는 것: { gone, left, all }
export async function cleanupTests(sql) {
  const has = (await sql.query("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'player_keys'"))[0].n > 0;
  if (has) await sql.query('delete from link_limits where who in (select id from players where test)');
  const gone = await sql.query('delete from players where test returning id');
  const T = has ? ['players', 'daily_scores', 'daily_logs', 'player_keys', 'link_codes', 'saves'] : ['players', 'daily_scores', 'daily_logs'];
  const count = async (where) => { const out = {}; for (const t of T) out[t] = (await sql.query(`select count(*)::int as n from ${t} x ${where(t)}`))[0].n; return out; };
  const left = await count((t) => (t === 'players' ? 'where x.test' : 'join players p on p.id = x.player_id where p.test'));
  const all = await count(() => '');
  if (has) {
    // 플레이어가 없는 한도 줄(지운 시험 플레이어의 것)도 남기지 않는다. 전체 잠금 줄(who 0)은 도구가 제 손으로 되돌린다
    await sql.query('delete from link_limits where who <> 0 and who not in (select id from players)');
    all.link_limits = (await sql.query('select count(*)::int as n from link_limits'))[0].n;
  }
  return { gone: gone.length, left, all };
}
export const cleanupLine = (r) => `정리: 시험 플레이어 ${r.gone}명 지움 · 남은 시험 자료 ${Object.entries(r.left).map(([k, v]) => `${k} ${v}`).join(' · ')} · DB 전체 ${Object.entries(r.all).map(([k, v]) => `${k} ${v}`).join(' · ')}`;

if (import.meta.url === `file://${process.argv[1]}`) {
  const sql = direct();
  const text = fs.readFileSync(new URL('db/schema.sql', ROOT), 'utf8').replace(/--.*$/gm, '');
  const stmts = text.split(';').map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await sql.query(s);
  const tables = await sql.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
  console.log(`스키마 적용: 문장 ${stmts.length} · 표 ${tables.map((t) => t.table_name).join(' · ')}`);
  // 열쇠 옮기기(CHM-71): players.key_hash가 모두 player_keys에 있나. 옛 칸은 지금 배포가 읽는 동안 그대로 둔다
  const [k] = await sql.query(`select (select count(*)::int from players) as players, (select count(*)::int from player_keys) as keys,
    (select count(*)::int from players p where not exists (select 1 from player_keys k where k.key_hash = p.key_hash and k.player_id = p.id)) as missing,
    (select count(*)::int from information_schema.columns where table_name = 'players' and column_name = 'key_hash') as old_column`);
  console.log(`열쇠 옮김: 플레이어 ${k.players} · 열쇠 ${k.keys} · 열쇠 표에 없는 옛 열쇠 ${k.missing} · 옛 칸 players.key_hash ${k.old_column ? '그대로' : '없음'}`);
}
