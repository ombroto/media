create table teachers (
  id            bigserial primary key,
  email         text not null unique,
  password_hash text not null,
  name          text not null,
  created_at    timestamptz not null default now()
);

create table contents (
  id              bigserial primary key,
  owner_id        bigint not null references teachers(id),
  title           text not null,
  main_library    text not null,
  h5p_content_id  text not null,
  scoring         text not null default 'unknown'
                  check (scoring in ('scored','unscored','unknown')),
  source_filename text not null,
  created_at      timestamptz not null default now()
);

create table quiz_sessions (
  id              bigserial primary key,
  owner_id        bigint not null references teachers(id),
  content_id      bigint not null references contents(id),
  title           text not null,
  pin             text not null unique check (pin ~ '^[0-9]{6}$'),
  opens_at        timestamptz not null,
  closes_at       timestamptz not null,
  closed_early_at timestamptz,
  created_at      timestamptz not null default now(),
  check (closes_at > opens_at)
);

create table participants (
  id          bigserial primary key,
  session_id  bigint not null references quiz_sessions(id) on delete cascade,
  alias       text not null check (char_length(alias) between 1 and 40),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  score_raw   integer,
  score_max   integer,
  token_hash  text not null unique
);

create unique index participants_alias_unik
  on participants (session_id, lower(btrim(alias)));

create table xapi_events (
  id             bigserial primary key,
  participant_id bigint not null references participants(id) on delete cascade,
  statement      jsonb not null,
  received_at    timestamptz not null default now()
);

create index xapi_events_peserta on xapi_events (participant_id, received_at);
