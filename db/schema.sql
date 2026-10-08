-- 순위(CHM-70, docs/design-notes/leaderboard.md). tools/db-migrate.mjs가 적용한다 — 여러 번 돌려도 안전하게(if not exists)만 쓴다.
-- 사람을 가리키는 것은 두지 않는다: 무작위 열쇠의 해시 · 이름 번호 · 그날 성적뿐. IP · 기기 정보는 없다.

create table if not exists players (
  id           bigint generated always as identity primary key,
  key_hash     text not null unique,          -- 플레이어 열쇠(무작위 256비트)의 SHA-256. 열쇠 원문은 두지 않는다
  a            smallint not null,             -- 이름: 형용사 번호(src/data/names.js)
  n            smallint not null,             -- 이름: 동물 번호
  created_at   timestamptz not null default now(),
  rerolls_day  integer not null default 0,    -- rerolls_date 날에 다시 지은 수(하루 한도)
  rerolls_date date,
  submits_day  integer not null default 0,    -- submits_date 날에 제출한 수(하루 한도)
  submits_date date,
  test         boolean not null default false -- 시험 도구(tools/daily-e2e.mjs)가 만든 플레이어 — 확인 뒤 지운다
);

-- 한 사람 · 하루에 가장 좋은 기록 하나
create table if not exists daily_scores (
  player_id    bigint not null references players(id) on delete cascade,
  date         date not null,                 -- 오늘의 대국 날짜(그 사람의 달력)
  ante         smallint not null,             -- 닿은 관
  blind        smallint not null,             -- 대국 번호(0 연습 · 1 정식 · 2 마스터전)
  won          boolean not null,              -- 8관 마스터전 승리
  score_total  double precision not null,     -- 판 전체에서 낸 점수의 합
  battles      integer not null,
  moves        integer not null,
  ignite       smallint,                      -- 점화가 난 대국(몇째로 둔 대국), 없으면 null
  build        text not null,                 -- 다시 둔 배포
  submitted_at timestamptz not null default now(),
  primary key (player_id, date)
);
create index if not exists daily_scores_rank on daily_scores (date, ante desc, blind desc, won desc, score_total desc, submitted_at, player_id);

-- 그날 가장 좋은 기록의 명령 줄(JSON 글) — 상위권을 다시 살펴볼 때 쓴다. 좋아진 기록만 갈아 끼운다
create table if not exists daily_logs (
  player_id    bigint not null references players(id) on delete cascade,
  date         date not null,
  cmds         text not null,
  primary key (player_id, date)
);
