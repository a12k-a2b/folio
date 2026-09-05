-- Shared reading circles: marks and voices visible to club-mates
create table if not exists folio_clubs (
  id text primary key,
  book_id text not null,
  name text not null,
  invite_code text not null unique,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists folio_clubs_book_idx on folio_clubs (book_id);

create table if not exists folio_club_members (
  club_id text not null,
  user_id text not null,
  display_name text not null,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);
create index if not exists folio_club_members_user_idx on folio_club_members (user_id);

alter table folio_highlights add column if not exists author_name text not null default '';
alter table folio_highlights add column if not exists club_id text;
alter table folio_highlights add column if not exists is_companion boolean not null default false;

alter table folio_voice_notes add column if not exists author_name text not null default '';
alter table folio_voice_notes add column if not exists reply_to text;
alter table folio_voice_notes add column if not exists audio_url text not null default '';
alter table folio_voice_notes add column if not exists is_companion boolean not null default false;
alter table folio_voice_notes add column if not exists club_id text;
