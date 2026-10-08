// 순위(CHM-70) · 기기 잇기와 클라우드 저장(CHM-71) · 계정(CHM-72) DB 접근 층. sql: (text, params) => rows — 함수에서는 Neon HTTP 드라이버(api/_lib/http.js), 시험은 같은 꼴의 기억 저장소
// (test/helpers/memstore.js). SQL은 모두 매개변수 바인딩. 날짜는 글(YYYY-MM-DD)로 주고받는다. 스키마는 db/schema.sql.
// HTTP 드라이버에는 주고받는 트랜잭션이 없다 — 한도 세기 · 기록 갈아 끼우기는 조건을 단 한 문장으로 한다(경합에도 안전).

// 줄 세우기(api/_lib/rank.js rankKey와 같은 차례) + 같으면 먼저 낸 사람
const ORDER = 'ante desc, blind desc, won desc, score_total desc, submitted_at asc, player_id asc';
const RANKED = `select player_id, ante, blind, won, score_total, row_number() over (order by ${ORDER})::int as rank from daily_scores where date = $1::date`;
const ROW = 'r.rank, p.a, p.n, r.ante, r.blind, r.won, r.score_total as score';

export function createStore(sql) {
  const one = async (text, params) => (await sql(text, params))[0] || null;
  return {
    // 새 플레이어 + 첫 열쇠(한 문장). players.key_hash에도 같이 적는다(옛 배포가 읽는 동안 두 벌)
    async createPlayer(keyHash, a, n) {
      return one(`with p as (insert into players (key_hash, a, n) values ($1, $2, $3) returning id, a, n),
          k as (insert into player_keys (key_hash, player_id) select $1, id from p)
        select id::text as id, a, n from p`, [keyHash, a, n]);
    },
    // 열쇠 → 플레이어(player_keys). 옛 배포가 만든 플레이어(players.key_hash에만 있다)는 그 자리에서 옮겨 읽는다
    async getPlayer(keyHash, today) {
      const find = () => one(`select p.id::text as id, p.a, p.n, case when p.rerolls_date = $2::date then p.rerolls_day else 0 end as rerolls
        from player_keys k join players p on p.id = k.player_id where k.key_hash = $1`, [keyHash, today]);
      const hit = await find();
      if (hit) return hit;
      const moved = await sql(`insert into player_keys (key_hash, player_id, created_at)
        select key_hash, id, created_at from players where key_hash = $1 on conflict (key_hash) do nothing returning key_hash`, [keyHash]);
      return moved.length ? find() : null;
    },
    // 다시 짓기: 하루 한도 안이면 이름을 바꾸고 { a, n, rerolls(오늘 쓴 수) }, 한도면 null
    async reroll(id, a, n, today, limit) {
      return one(`update players set a = $2, n = $3,
          rerolls_day = case when rerolls_date = $4::date then rerolls_day + 1 else 1 end, rerolls_date = $4::date
        where id = $1::bigint and (rerolls_date is distinct from $4::date or rerolls_day < $5)
        returning a, n, rerolls_day as rerolls`, [id, a, n, today, limit]);
    },
    // 제출 한 번을 센다. 하루 한도를 넘으면 거짓(세지 않는다)
    async bumpSubmit(id, today, limit) {
      return !!(await one(`update players set
          submits_day = case when submits_date = $2::date then submits_day + 1 else 1 end, submits_date = $2::date
        where id = $1::bigint and (submits_date is distinct from $2::date or submits_day < $3)
        returning id`, [id, today, limit]));
    },
    // 그날 기록보다 좋을 때만 갈아 끼운다(같으면 그대로). 돌려주는 것: 갈아 끼웠나. 좋아진 기록의 명령 줄만 daily_logs에 남긴다
    async putScore(id, date, r, build, cmdsText) {
      const hit = await one(`insert into daily_scores (player_id, date, ante, blind, won, score_total, battles, moves, ignite, build)
        values ($1::bigint, $2::date, $3, $4, $5, $6, $7, $8, $9, $10)
        on conflict (player_id, date) do update set ante = excluded.ante, blind = excluded.blind, won = excluded.won,
          score_total = excluded.score_total, battles = excluded.battles, moves = excluded.moves, ignite = excluded.ignite,
          build = excluded.build, submitted_at = now()
        where (excluded.ante, excluded.blind, excluded.won, excluded.score_total)
            > (daily_scores.ante, daily_scores.blind, daily_scores.won, daily_scores.score_total)
        returning player_id`, [id, date, r.ante, r.blind, r.won, r.score_total, r.battles, r.moves, r.ignite, build]);
      if (!hit) return false;
      await sql(`insert into daily_logs (player_id, date, cmds) values ($1::bigint, $2::date, $3)
        on conflict (player_id, date) do update set cmds = excluded.cmds`, [id, date, cmdsText]);
      return true;
    },
    // 그 사람의 그날 기록과 자리. 기록이 없으면 best · rank는 null
    async standing(id, date) {
      const [me, t] = await Promise.all([
        one(`select r.rank, r.ante, r.blind, r.won, r.score_total as score, s.battles, s.moves, s.ignite
          from (${RANKED}) r join daily_scores s on s.player_id = r.player_id and s.date = $1::date where r.player_id = $2::bigint`, [date, id]),
        one('select count(*)::int as total from daily_scores where date = $1::date', [date]),
      ]);
      if (!me) return { best: null, rank: null, total: t.total };
      const { rank, ...best } = me;
      return { best, rank, total: t.total };
    },
    // 순위표 한 쪽(offset부터 size줄) + 그 사람 줄 + 그 위아래 span줄씩. id가 없으면 me · around는 비운다
    async board(date, offset, size, id = null, span = 2) {
      const [rows, t, near] = await Promise.all([
        sql(`select ${ROW} from (${RANKED}) r join players p on p.id = r.player_id where r.rank > $2 and r.rank <= $3 order by r.rank`, [date, offset, offset + size]),
        one('select count(*)::int as total from daily_scores where date = $1::date', [date]),
        id == null ? [] : sql(`with r as (${RANKED}), me as (select rank from r where player_id = $2::bigint)
          select ${ROW}, (r.player_id = $2::bigint) as me from r join players p on p.id = r.player_id, me
          where r.rank between me.rank - $3 and me.rank + $3 order by r.rank`, [date, id, span]),
      ]);
      const strip = ({ me, ...x }) => x;
      const mine = near.find((x) => x.me);
      return { total: t.total, rows, me: mine ? strip(mine) : null, around: near.map(strip) };
    },
    // ── 기기 잇기 · 클라우드 저장(CHM-71)
    async keyCount(id) { return (await one('select count(*)::int as n from player_keys where player_id = $1::bigint', [id])).n; },
    // 한도 세기: 한 번 세고 센 수를 돌려준다. 한도에 닿았으면 null(세지 않는다)
    async bump(kind, who, bucket, limit) {
      const r = await one(`insert into link_limits (kind, who, bucket, n) values ($1, $2::bigint, $3, 1)
        on conflict (kind, who, bucket) do update set n = link_limits.n + 1, at = now() where link_limits.n < $4 returning n`, [kind, who, bucket, limit]);
      return r ? r.n : null;
    },
    async peek(kind, who, bucket) {
      const r = await one('select n from link_limits where kind = $1 and who = $2::bigint and bucket = $3', [kind, who, bucket]);
      return r ? r.n : 0;
    },
    // 새 코드: 그 사람의 앞 코드는 지운다. 같은 해시가 살아 있으면 거짓(다른 숫자로 다시)
    async putCode(id, codeHash, expires) {
      await sql('delete from link_codes where player_id = $1::bigint or expires_at < to_timestamp($2::double precision / 1000) - interval \'1 day\'', [id, expires]);
      await sql('delete from link_limits where at < now() - interval \'2 days\'', []);
      return !!(await one(`insert into link_codes (code_hash, player_id, expires_at) values ($1, $2::bigint, to_timestamp($3::double precision / 1000))
        on conflict (code_hash) do nothing returning code_hash`, [codeHash, id, expires]));
    },
    async findCode(codeHash) {
      return one(`select player_id::text as "playerId", (extract(epoch from expires_at) * 1000)::bigint::float8 as expires, used_at is not null as used
        from link_codes where code_hash = $1`, [codeHash]);
    },
    // 코드를 쓴다(한 번만). 그 사이 쓰였거나 시간이 지났으면 거짓
    async claimCode(codeHash, now) {
      return !!(await one(`update link_codes set used_at = to_timestamp($2::double precision / 1000)
        where code_hash = $1 and used_at is null and expires_at > to_timestamp($2::double precision / 1000) returning code_hash`, [codeHash, now]));
    },
    // from의 것을 to로 합치고 from을 지운다: 날짜마다 더 좋은 성적(낸 시각 그대로) + 그 명령 줄 → 이 기기의 새 열쇠 → from의 다른 기기 열쇠 → from 지우기(옛 열쇠 oldKeyHash는 같이 지워진다).
    // 차례가 중간에 끊겨도 잃는 것은 없다(성적은 이미 옮겨졌고 from은 남는다)
    async absorb(from, to, oldKeyHash, newKeyHash) {
      await sql(`with moved as (
          insert into daily_scores (player_id, date, ante, blind, won, score_total, battles, moves, ignite, build, submitted_at)
          select $2::bigint, date, ante, blind, won, score_total, battles, moves, ignite, build, submitted_at from daily_scores where player_id = $1::bigint
          on conflict (player_id, date) do update set ante = excluded.ante, blind = excluded.blind, won = excluded.won,
            score_total = excluded.score_total, battles = excluded.battles, moves = excluded.moves, ignite = excluded.ignite,
            build = excluded.build, submitted_at = excluded.submitted_at
          where (excluded.ante, excluded.blind, excluded.won, excluded.score_total)
              > (daily_scores.ante, daily_scores.blind, daily_scores.won, daily_scores.score_total)
          returning date)
        insert into daily_logs (player_id, date, cmds)
        select $2::bigint, l.date, l.cmds from daily_logs l join moved m on m.date = l.date where l.player_id = $1::bigint
        on conflict (player_id, date) do update set cmds = excluded.cmds`, [from, to]);
      await sql('insert into player_keys (key_hash, player_id) values ($1, $2::bigint)', [newKeyHash, to]);
      await sql('update player_keys set player_id = $2::bigint where player_id = $1::bigint and key_hash <> $3', [from, to, oldKeyHash]);
      await sql('delete from players where id = $1::bigint', [from]);
    },
    // 이 열쇠만 떼어 새 플레이어로(이름 · 저장 덩이 사본을 들고). 한 문장. 돌려주는 것: 새 플레이어 id
    async splitKey(keyHash, id, filler) {
      const r = await one(`with old as (select a, n from players where id = $2::bigint),
          np as (insert into players (key_hash, a, n) select $3, a, n from old returning id),
          sv as (insert into saves (player_id, rev, blob, updated_at) select np.id, 1, s.blob, s.updated_at from saves s, np where s.player_id = $2::bigint),
          mv as (update player_keys set player_id = (select id from np) where key_hash = $1 and player_id = $2::bigint returning key_hash)
        select id::text as id from np`, [keyHash, id, filler]);
      return r ? r.id : null;
    },
    async getSave(id) {
      return one('select rev, blob, (extract(epoch from updated_at) * 1000)::bigint::float8 as "updatedAt" from saves where player_id = $1::bigint', [id]);
    },
    // baseRev가 서버 것과 같을 때만 갈아 끼운다(없는 저장은 0). 돌려주는 것: 새 rev, 어긋나면 null
    async putSave(id, baseRev, blobText, now) {
      const r = baseRev === 0
        ? await one(`insert into saves (player_id, rev, blob, updated_at) values ($1::bigint, 1, $2, to_timestamp($3::double precision / 1000))
            on conflict (player_id) do nothing returning rev`, [id, blobText, now])
        : await one(`update saves set rev = rev + 1, blob = $2, updated_at = to_timestamp($3::double precision / 1000)
            where player_id = $1::bigint and rev = $4 returning rev`, [id, blobText, now, baseRev]);
      return r ? r.rev : null;
    },
    // ── 계정(CHM-72)
    async findAccount(username) {
      return one('select player_id::text as "playerId", username, pw_hash as hash from accounts where username = $1', [username]);
    },
    async accountOfPlayer(id) {
      return one('select username, pw_hash as hash from accounts where player_id = $1::bigint', [id]);
    },
    // 계정 만들기(한 문장): 아이디가 이미 있거나 그 플레이어에 계정이 있으면 거짓
    async createAccount(id, username, hash) {
      return !!(await one('insert into accounts (username, pw_hash, player_id) values ($1, $2, $3::bigint) on conflict do nothing returning id', [username, hash, id]));
    },
    async setPassword(id, hash, now) {
      await sql('update accounts set pw_hash = $2, pw_changed_at = to_timestamp($3::double precision / 1000) where player_id = $1::bigint', [id, hash, now]);
    },
    // 열쇠 하나를 지운다. 옛 칸 players.key_hash에 같은 값이 남아 있으면 쓰이지 않을 값으로 바꾼다(getPlayer가 옛 칸에서 되살리지 않게)
    async dropKey(keyHash, filler) {
      await sql('update players set key_hash = $2 where key_hash = $1', [keyHash, filler]);
      await sql('delete from player_keys where key_hash = $1', [keyHash]);
    },
    // 플레이어와 딸린 것(계정 · 열쇠 · 성적 · 명령 줄 · 코드 · 저장 — cascade) + 그 사람의 한도 줄
    async deletePlayer(id) {
      await sql("delete from link_limits where who = $1::bigint and kind not in ('login', 'loginlock')", [id]);
      await sql('delete from players where id = $1::bigint', [id]);
    },
    // 한도 표에 값을 그대로 적는다(잠금이 풀리는 때 · 틀린 수 되돌리기)
    async setMark(kind, who, bucket, n) {
      await sql(`insert into link_limits (kind, who, bucket, n) values ($1, $2::bigint, $3, $4)
        on conflict (kind, who, bucket) do update set n = excluded.n, at = now()`, [kind, who, bucket, n]);
    },
  };
}
