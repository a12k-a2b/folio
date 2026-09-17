-- Programmable highlighters: a tag kind prints a slip onto the mark.
create table if not exists folio_prints (
  id text primary key,
  user_id text not null,
  highlight_id text not null,
  tag_kind text not null,
  kicker text not null default '',
  title text not null default '',
  body text not null default '',
  sources_json text not null default '[]',
  created_at timestamptz not null default now(),
  unique (user_id, highlight_id, tag_kind)
);
create index if not exists folio_prints_user_hl_idx on folio_prints (user_id, highlight_id);
