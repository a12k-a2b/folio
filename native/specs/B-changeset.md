# Spec B — Folio Changeset (`folio-native/2`)

Status: design only. Same overnight gate as A. This is the **simpler sync service**: no extra process, no extra SDK, no replication slot. We keep the stores we already wrote.

HTTP v1 already moves every row Folio has. v2 makes that **incremental, batched, and blob-safe**. It is a protocol, not a product.

## 1. What we would buy

A cursor. A tombstone. A blob store. A 25-second long-poll.

That is the whole service. Postgres remains origin. Android keeps `SQLiteOpenHelper`. iOS keeps SwiftData. Web keeps server functions. The native API grows three routes and stops stuffing mp3s into JSON.

## 2. Why it might be enough

Folio’s working set without audio is small:

- 6 bundled books, a handful of Gutenberg shelves
- hundreds to low thousands of highlights over years
- progress: one row per book
- tags: tens
- club: a few members, their marks on one book

A **full snapshot** of metadata for one user is tens of kilobytes. Incremental is a nicety (less work on a flaky garden wifi), not a scalability requirement. The thing v1 gets wrong is **voice in `audio_b64`** and **N round-trips for N dirty rows**, plus no tombstones so a pull can resurrect a delete.

We do not have:

- live collaborative cursors
- millions of rows
- a field-team of offline writers
- a need for reactive SQL watches across processes

PowerSync’s upload queue is real engineering. We can copy the *shape* (a `dirty` flag we already have, a drain loop, backoff) in ~200 lines per client without taking on WAL slots and a second database.

## 3. Topology

```
 DC-1 SQLite  ──HTTP v2──┐
 iPhone SwiftData──HTTP v2─┼─ this origin (TanStack Start) ─ Neon
 Web (cookies) ──HTTP v2──┘              ╲
                                           object store (voice)
```

No sidecar. Clients already know `{origin}/api/native/v1`. v2 lives under `{origin}/api/native/v2` and is advertised on `GET /v1/health` as `"changeset": "open"` when unlocked. Until then health stays as today.

## 4. Local schema (delta from v1)

Keep current tables. Add:

```
folio_highlights.updated_at text not null
folio_highlights.deleted_at text null
folio_bookmarks.updated_at, deleted_at
folio_tags.updated_at, deleted_at
folio_voice_notes.updated_at, deleted_at
folio_voice_notes.sha256, byte_length
folio_voice_notes.audio_b64   -- local cache only; never pushed
folio_progress.updated_at     -- already exists
folio_settings.updated_at
folio_meta.cursor             -- last applied server cursor (opaque)
folio_meta.push_backoff_until
folio_outbox(id, table, op, payload_json, created_at, attempts, last_error)
```

`dirty` can remain as a derived view of outbox, or we migrate dirty rows into `folio_outbox` once and drop the column later. Outbox is the upload queue.

Tombstones stay on origin for 90 days, then a snapshot-generation bump forces clients with old cursors to resnapshot. Clients never compact tombstones themselves.

## 5. Routes

All under `/api/native/v2`. Same auth as v1 (cookie or bearer). Same CORS. Header `X-Folio-Protocol: folio-native/2`.

| Method | Path | Auth | Contract |
| --- | --- | --- | --- |
| GET | `/health` | no | `{ protocol, v1, changeset, blob }` |
| GET | `/snapshot` | yes | full user+club metadata, **no audio bytes**. Cursor `c0`. |
| GET | `/changes?cursor=&wait=0\|1` | yes | `{ cursor, ops[], truncated }` |
| POST | `/push` | yes | `{ ops[] }` → `{ accepted[], rejected[], cursor }` |
| POST | `/blobs` | yes | `{ voiceId, mime, byteLength, sha256 }` → `{ putUrl, getUrl, expiresAt }` |
| PUT | object store (signed) | signed URL | raw audio, max 2.4MB |
| GET | `/blobs/:id` | yes | 302 to signed GET, or the file if we host it |

v1 routes stay for one native release as a fallback. Catalog stays v1 (public, fat HTML).

### 5.1 Snapshot

One payload:

```
{
  protocol, cursor,
  library, progress, settings, tags,
  highlights, highlightTags, bookmarks, voices,
  clubs, clubMembers
}
```

Voices have `audioUrl`, `sha256`, `byteLength`, never `audioB64`. Client downloads blobs lazily when the annotation sheet opens, caches by sha256 on disk.

First sign-in: GET snapshot, replace non-dirty local rows, union with outbox (outbox wins on same id if `updatedAt` ≥ snapshot).

### 5.2 Changes

Cursor is an opaque server token: `{userId}:{snapshotEpoch}:{seq}`. `seq` is a bigint from `folio_change_log`.

```
create table folio_change_log (
  seq bigserial primary key,
  user_id text not null,          -- owner of the row, or club fan-out target
  table_name text not null,
  row_id text not null,
  op text not null,               -- put | delete
  row_json text not null,         -- full row after put; {id} after delete
  at timestamptz not null default now()
);
create index folio_change_log_user_seq on folio_change_log (user_id, seq);
```

Every successful mutation writes **one log row for the author and one for each club-mate** if `club_id` is set. Fan-out is write-time, not read-time. A club of 5 = 5 log rows. Fine.

`GET /changes?cursor=u:1:40`:

- If `snapshotEpoch` mismatches, return `{ resnapshot: true }`. Client pulls snapshot.
- Else return ops with `seq > 40` **for this user_id**, cap 500. `truncated: true` if more.
- `wait=1`: if no ops, hold up to 25s (LISTEN/NOTIFY on `folio_changes_{userId}` or a cheap poll of `max(seq)`). DC-1 can long-poll while the screen is on; when backgrounded, it uses a single GET on resume.

Client apply:

```
for op in ops ordered by seq:
  if op.id in outbox: skip (we still own it; push will reconcile)
  if op is delete: hide local row unless outbox has a newer put
  if op is put: upsert unless local outbox is newer
cursor = response.cursor
```

Never apply a companion delete. If the server sends one, ignore and log — server bug.

### 5.3 Push

Batch, max 100 ops or 512KB JSON (blobs are not in this body).

```
{ "ops": [
  { "op": "put", "table": "highlights", "id": "…", "row": { … }, "updatedAt": "…" },
  { "op": "delete", "table": "highlights", "id": "…", "updatedAt": "…" }
]}
```

Server per op:

1. Authz: row.user_id == caller, or (voice reply on a club highlight).
2. Companion: reject delete/put with `code: "companion"`.
3. LWW: if stored `updated_at` > incoming, `rejected: { id, code: "stale", row: stored }`. Client applies stored row and drops outbox.
4. Else upsert / tombstone, append change_log, NOTIFY.
5. Voice put without a blob that exists in object store: `rejected: { code: "blob_missing" }`. Outbox stays. Client must finish `/blobs` first.

Progress and settings: LWW by `updatedAt` only; no tombstones. A stale progress push returns the stored row; client overwrites local.

Push is **not** transactional across the batch. Each op commits. Client retries only rejected/unacked ids. Partial success is normal on a phone that dies mid-flight.

### 5.4 Blobs

Two-step, always:

1. `POST /blobs` with `voiceId` (client UUID), mime, length, sha256. Server records `folio_blobs(id, user_id, sha256, byte_length, mime, state='pending')` and returns a 10-minute signed PUT.
2. Client PUT bytes. Object store (or our origin in dev: `PUT /api/native/v2/blobs/:id/data`). On complete, server sets `state='ready'`, verifies length (and sha256 if cheap).
3. Client `push` the voice **metadata** op. Server 409 `blob_missing` until ready.

Download: client GET `audioUrl` (signed, 1h). Cache file named by sha256. Theo’s bundled files short-circuit: if `isCompanion` and asset exists, never hit the network.

Dev/preview without S3: store on the origin filesystem or in Postgres bytea **behind the blob API**, never in the voice row JSON. Production: R2/S3.

## 6. Conflict rules (normative)

| Kind | Rule |
| --- | --- |
| Progress, settings | Last `updatedAt` wins. No merge. |
| Highlight create | Union by id. Two devices highlighting the same sentence make **two** marks unless ids collide (they won’t). |
| Highlight note/tags | LWW on the row. Whole-row replace, not field merge. |
| Highlight delete vs edit | Compare `updatedAt`. Newer delete wins; newer edit resurrects. Show nothing fancy in v2. |
| Bookmark | Same as highlight. |
| Tag rename | LWW. Kind/emoji included in the row. |
| Voice | Append-only. No edit. Delete is LWW tombstone, author only. Replies are new ids. |
| Companion | Immutable. Push rejected. Pull applied. |
| Club membership | Server-only (invite accept / leave). Clients do not push member rows. |
| Clock skew | If `updatedAt` is >24h in the future, server stamps `now` and tells the client the new stamp in `accepted[]`. |

No CRDT. No operational transform. If two people edit the same club note, last writer wins. Club voices never collide (new ids).

## 7. Client drain loop

Both apps already have `dirty`. Replace the per-row POST with:

```
on write:
  upsert local
  enqueue outbox
  try drain()

drain():
  if backoff: return
  pending blobs first (POST /blobs, PUT, confirm)
  take ≤100 outbox ops
  POST /push
  remove accepted
  for stale: apply server row, remove
  for blob_missing: keep, retry blob
  for companion: drop
  GET /changes?cursor (wait=0)
  apply
on resume / network up / interval 60s:
  drain(); GET /changes?wait=0
while reader is foreground and signed-in:
  GET /changes?wait=1  (25s long-poll)
```

Android: `WorkManager` once an hour when idle. iOS: `BGAppRefresh` best-effort; **do not pretend iOS will sync in the garden overnight.** The folio opening the app is the sync. That is the product.

Unsigned: outbox never drains. Local only. Sign-in then snapshot-union then drain.

## 8. Club fan-out

Alexander Circle is the test:

- Theo’s companion rows are seeded on origin, `club_id = alexander`, `is_companion = true`. They appear in every member’s snapshot and change log as `user_id = that member` **copies** or as log rows fanned out at seed time. Prefer **one canonical row** (author = companion user) plus change_log entries per member, not duplicated highlight ids per member.
- A member’s voice reply: `club_id` set, `reply_to` = Theo’s highlight. Push as author. Fan-out log to other members.
- Leaving the club: server writes delete ops for **club-visible rows the user did not author** into their log, and stops future fan-out. Their own marks remain.

Invite accept is a web/native POST `/v1` or `/v2/clubs/join` (new, tiny). Not a generic put.

## 9. Web reader

Same v2. Browser: `wait=1` long-poll while the tab is open. Voice: MediaRecorder → blob PUT. No WASM SQLite. Server functions can share the mutation helpers with the native routes so web and native cannot diverge on LWW.

## 10. Ops, cost, failure

- **Zero extra vendors** if we accept origin-hosted blobs in preview. Production wants R2 (~pennies for voice).
- Change log growth: ~1–5 rows per human action. 90-day retention then epoch++. Vacuum. A popular club of 20 with chatty voices is still nothing to Neon.
- LISTEN/NOTIFY dies on connection reset: long-poll falls back to `max(seq)` poll every 25s. Correct, slightly slower.
- Hibernate of the preview origin: native apps back off, keep local, drain later. Same as today.
- Clock: server `now()`. Clients use ISO-8601 UTC.
- Poison outbox op: `attempts > 8` moves to `folio_outbox_dead`. UI: a quiet “this mark did not leave the device” on the annotation sheet. Never blocks other ops.

## 11. Cutover

1. Overnight gate on v1 (unchanged).
2. Migration 0004: new columns, `folio_change_log`, `folio_blobs`, backfill `updated_at = created_at`.
3. Blob-migrate existing `audio_b64` if any.
4. Ship native with outbox drain + v2 routes. If `/v2/health` missing, keep v1 push (one release).
5. Health: `changeset: "open"`, `powersync: "locked"`.
6. Do **not** set `POWERSYNC_LOCKED = false`. Spec B never unlocks PowerSync.

Rollback: clients already speak v1. Feature-flag drain to v1 POSTs.

## 12. Non-goals

- Real-time presence (“Anjan is on page 12”).
- Syncing book HTML.
- Field-level merge of notes.
- A generic sync engine for other apps.

## 13. Acceptance

- Same functional tests as Spec A §13, except “without an explicit sync tap, under 5s” becomes “under 5s **if the folio app is foregrounded** (long-poll) or on next resume (background).” That difference is documented, not a bug.
- Full v1 snapshot of a heavy user (1k highlights, 50 voices metadata) < 300KB. Changes after one new mark: one op, <2KB.
- Pull never reintroduces a tombstoned mark.
- Missing blob cannot block a bookmark push.
- Companion immutable.
- Kill origin. Both apps read/write locally. On return, outbox drains, cursors catch up, no duplicate ids.
