// 순위(CHM-70) DB 접근 층. sql: (text, params) => rows — 함수에서는 Neon HTTP 드라이버(api/_lib/http.js), 시험은 같은 꼴의 기억 저장소
// (test/helpers/memstore.js). SQL은 모두 매개변수 바인딩. 날짜는 글(YYYY-MM-DD)로 주고받는다. 스키마는 db/schema.sql.
// HTTP 드라이버에는 주고받는 트랜잭션이 없다 — 한도 세기 · 기록 갈아 끼우기는 조건을 단 한 문장으로 한다(경합에도 안전).

// 줄 세우기(api/_lib/rank.js rankKey와 같은 차례) + 같으면 먼저 낸 사람
const ORDER = 'ante desc, blind desc, won desc, score_total desc, submitted_at asc, player_id asc';
const RANKED = `select player_id, ante, blind, won, score_total, row_number() over (order by ${ORDER})::int as rank from daily_scores where date = $1::date`;
const ROW = 'r.rank, p.a, p.n, r.ante, r.blind, r.won, r.score_total as score';

export function createStore(sql) {
  const one = async (text, params) => (await sql(text, params))[0] || null;
  return {
    async createPlayer(keyHash, a, n) {
      return one('insert into players (key_hash, a, n) values ($1, $2, $3) returning id::text as id, a, n', [keyHash, a, n]);
    },
    async getPlayer(keyHash, today) {
      return one(`select id::text as id, a, n, case when rerolls_date = $2::date then rerolls_day else 0 end as rerolls
        from players where key_hash = $1`, [keyHash, today]);
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
  };
}
