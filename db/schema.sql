-- 순위(CHM-70, docs/design-notes/leaderboard.md). tools/db-migrate.mjs가 적용한다 — 여러 번 돌려도 안전하게(if not exists · on conflict do nothing)만 쓴다.
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

-- ── 기기 잇기 · 클라우드 저장(CHM-71, leaderboard.md 「기기 잇기 · 클라우드 저장」)

-- 플레이어 하나에 열쇠 여럿(기기마다 하나). 열쇠 찾기는 이 표로 한다. players.key_hash는 옛 배포가 읽는 동안 두 벌로 남긴다
create table if not exists player_keys (
  key_hash     text primary key,              -- 열쇠의 SHA-256
  player_id    bigint not null references players(id) on delete cascade,
  created_at   timestamptz not null default now(),
  label        text                           -- 기기 이름표(아직 쓰지 않는다)
);
create index if not exists player_keys_player on player_keys (player_id);
-- 옛 열쇠 옮기기: 이미 옮긴 줄은 건너뛴다
insert into player_keys (key_hash, player_id, created_at)
  select key_hash, id, created_at from players on conflict (key_hash) do nothing;

-- 옮기기 코드(숫자 여덟 자리)의 해시. 10분 · 한 번
create table if not exists link_codes (
  code_hash    text primary key,
  player_id    bigint not null references players(id) on delete cascade,
  expires_at   timestamptz not null,
  used_at      timestamptz
);
create index if not exists link_codes_player on link_codes (player_id);

-- 한도 세기: kind(code · redeem · lock · save) · who(플레이어 id, 전체는 0) · bucket(날짜 · 시각 창)
create table if not exists link_limits (
  kind         text not null,
  who          bigint not null default 0,
  bucket       text not null,
  n            integer not null default 0,
  at           timestamptz not null default now(),
  primary key (kind, who, bucket)
);

-- 플레이어마다 저장 한 덩이(기록 · 진행 중인 판 · 설정 몇 칸의 JSON 글). rev로 낙관적 잠금
create table if not exists saves (
  player_id    bigint primary key references players(id) on delete cascade,
  rev          integer not null,
  blob         text not null,
  updated_at   timestamptz not null default now()
);

-- ── 계정(CHM-72, leaderboard.md 「계정」): 플레이어에 붙는 자격 하나. 이메일은 없다. 비번은 scrypt 해시 글(scrypt$N$r$p$salt$hash)만 둔다
create table if not exists accounts (
  id            bigint generated always as identity primary key,
  username      text not null unique,          -- 영문 소문자 · 숫자 · _ 3~20자(소문자로 저장). 남에게 보이지 않는다
  pw_hash       text not null,
  player_id     bigint not null unique references players(id) on delete cascade,
  created_at    timestamptz not null default now(),
  pw_changed_at timestamptz not null default now()
);
