// 순위 DB 스키마 적용(CHM-70): node tools/db-migrate.mjs — db/schema.sql을 .env.local의 DATABASE_URL_UNPOOLED(풀 없는 직접 연결)로 넣는다.
// 스키마는 if not exists만 써서 여러 번 돌려도 같다. 비밀 값은 찍지 않는다.
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const sql = direct();
  const text = fs.readFileSync(new URL('db/schema.sql', ROOT), 'utf8').replace(/--.*$/gm, '');
  const stmts = text.split(';').map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await sql.query(s);
  const tables = await sql.query("select table_name from information_schema.tables where table_schema = 'public' order by 1");
  console.log(`스키마 적용: 문장 ${stmts.length} · 표 ${tables.map((t) => t.table_name).join(' · ')}`);
}
