-- Folio reader: per-user library, marks, voice, tags, progress
create table if not exists folio_library (
  id text primary key,
  user_id text not null,
  book_id text not null,
  source text not null default 'bundled',
  title text not null,
  author text not null,
  description text not null default '',
  cover_label text not null default '',
  added_at timestamptz not null default now(),
  unique (user_id, book_id)
);
create index if not exists folio_library_user_idx on folio_library (user_id);

create table if not exists folio_book_content (
  book_id text not null,
  user_id text not null,
  chapters_json text not null,
  primary key (user_id, book_id)
);

create table if not exists folio_progress (
  user_id text not null,
  book_id text not null,
  chapter_index int not null default 0,
  page_index int not null default 0,
  percent real not null default 0,
  locator text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create table if not exists folio_tags (
  id text primary key,
  user_id text not null,
  name text not null,
  emoji text not null default '',
  kind text not null default 'custom',
  created_at timestamptz not null default now()
);
create index if not exists folio_tags_user_idx on folio_tags (user_id);

create table if not exists folio_highlights (
  id text primary key,
  user_id text not null,
  book_id text not null,
  chapter_id text not null,
  start_offset int not null,
  end_offset int not null,
  text text not null,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists folio_highlights_user_book_idx on folio_highlights (user_id, book_id);

create table if not exists folio_highlight_tags (
  highlight_id text not null,
  tag_id text not null,
  primary key (highlight_id, tag_id)
);

create table if not exists folio_bookmarks (
  id text primary key,
  user_id text not null,
  book_id text not null,
  chapter_index int not null,
  page_index int not null,
  label text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists folio_bookmarks_user_book_idx on folio_bookmarks (user_id, book_id);

create table if not exists folio_voice_notes (
  id text primary key,
  user_id text not null,
  highlight_id text not null,
  transcript text not null default '',
  audio_b64 text not null,
  mime text not null default 'audio/webm',
  duration_ms int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists folio_voice_user_idx on folio_voice_notes (user_id);

create table if not exists folio_settings (
  user_id text primary key,
  json text not null
);
