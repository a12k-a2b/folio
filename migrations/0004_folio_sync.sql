-- Folio v1.1 sync: tombstones, clocks, voice blobs out of the row.
-- PowerSync stays locked. No change_log. No long-poll.

alter table folio_highlights add column if not exists updated_at timestamptz not null default now();
alter table folio_highlights add column if not exists deleted_at timestamptz;

alter table folio_bookmarks add column if not exists updated_at timestamptz not null default now();
alter table folio_bookmarks add column if not exists deleted_at timestamptz;

alter table folio_tags add column if not exists updated_at timestamptz not null default now();
alter table folio_tags add column if not exists deleted_at timestamptz;

alter table folio_voice_notes add column if not exists updated_at timestamptz not null default now();
alter table folio_voice_notes add column if not exists deleted_at timestamptz;
alter table folio_voice_notes add column if not exists sha256 text not null default '';
alter table folio_voice_notes add column if not exists byte_length int not null default 0;

alter table folio_settings add column if not exists updated_at timestamptz not null default now();

update folio_highlights set updated_at = created_at where updated_at is null;
update folio_bookmarks set updated_at = created_at where updated_at is null;
update folio_voice_notes set updated_at = created_at where updated_at is null;
update folio_tags set updated_at = created_at where updated_at is null;

create table if not exists folio_blobs (
  id text primary key,
  user_id text not null,
  sha256 text not null default '',
  byte_length int not null default 0,
  mime text not null default 'application/octet-stream',
  state text not null default 'pending',
  bytes_b64 text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists folio_blobs_user_idx on folio_blobs (user_id);
