# Spec A — PowerSync (unlock target)

Status: design only. `POWERSYNC_LOCKED` stays `true` until the overnight gate in [POWERSYNC.md](../POWERSYNC.md) is signed by a human on real hardware.

Protocol remains `folio-native/1` for health, catalog, and the upload connector. PowerSync is a **read stream + upload queue**, not a new write API.

## 1. What we would buy

PowerSync keeps a SQLite replica on each client in sync with Neon/Postgres.

- **Down:** Postgres logical replication → PowerSync Service → Sync Streams → client SQLite views.
- **Up:** local write → `ps_crud` upload queue → **our existing REST** (`uploadData()` calls `/api/native/v1/*`) → Postgres → then down to other devices.
- **Files:** voice bytes never enter SQLite. Metadata row syncs; bytes go to object storage through the SDK attachment queue.

This is the important honesty: **PowerSync does not replace the native API.** It replaces polling, retry, and the “is my local SQLite current?” problem. We still own conflict rules, authz, and companion-row refusal, because those live in the upload connector.

## 2. Why it might be the right engine

- Official Kotlin and Swift SDKs with a native Rust/SQLite core. Web SDK exists if the preview reader should share the replica.
- Persistent upload queue with backoff. DC-1 can sit in a bag for a week; marks drain when it sees wifi.
- Incremental. A new highlight on the phone appears on the folio without pulling the whole book snapshot.
- Sync Streams can express “my rows + rows from clubs I belong to” as SQL, which is the only fan-out Folio has.
- Attachment helpers (Kotlin/Swift: built-in, still **alpha**) match the voice-note shape: local file, queued upload, signed URL, download on the other device.

## 3. Topology

```
 DC-1 SQLite ──┐                    ┌─ Neon Postgres (origin)
 iPhone SQLite─┼─ PowerSync Service─┤
 Web (optional)┘         │          └─ object store (voice)
                         │
                         └── uploadData() → Folio REST (this app)
```

- **Origin:** existing Neon. `wal_level=logical`, publication `powersync` on the `folio_*` tables (not Better Auth tables).
- **Service:** PowerSync Cloud (simplest) or Open Edition self-host. Open Edition needs a **second** store for buckets (Postgres or Mongo) plus a replication slot that must not be dropped on hibernate.
- **Auth:** Better Auth session → short JWT (`sub` = user id, `aud` = PowerSync instance, ≤60 min). Native already pastes a bearer from Settings → Devices; that minting endpoint grows a `/api/native/v1/powersync-token` route.
- **Object store:** S3 / R2 / equivalent. Path `voices/{userId}/{voiceId}.{ext}`. Signed PUT/GET. Theo’s bundled mp3s stay in the binary; they are not attachments.

## 4. Client schema (views over synced JSON)

PowerSync stores schemaless JSON and projects views. Client schema must use stable string `id` keys (we already do UUIDs).

```
folio_library(id, book_id, source, title, author, description, cover_label, added_at)
folio_progress(id, book_id, chapter_index, page_index, percent, locator, updated_at)
folio_tags(id, name, emoji, kind, created_at)
folio_highlights(id, book_id, chapter_id, start_offset, end_offset, text, note,
                 created_at, updated_at, author_id, author_name, club_id, is_companion)
folio_highlight_tags(id, highlight_id, tag_id)
folio_bookmarks(id, book_id, chapter_index, page_index, label, created_at)
folio_voice_notes(id, highlight_id, transcript, mime, duration_ms, created_at,
                  author_id, author_name, reply_to, club_id, is_companion,
                  audio_url, sha256, byte_length)
folio_settings(id, json, updated_at)
folio_clubs(id, book_id, name, invite_code, created_by, created_at)
folio_club_members(id, club_id, user_id, display_name, role, joined_at)
```

Local-only, never synced:

```
folio_meta(key, value)          -- origin, last error
folio_attachments_local(...)    -- SDK attachment queue state
```

**Migration pain:** current Android `SQLiteOpenHelper` and iOS SwiftData become **read-only leftovers**. PowerSync owns the connection. Room integration is beta; SwiftData is not supported — GRDB is the Swift path. The native trees we just wrote would be rewritten around `PowerSyncDatabase`. Bundled catalog and Theo mp3s stay as assets; they are not in the replica.

`dirty` flags go away. The SDK queue is the dirty set.

`audio_b64` is **removed from Postgres and from the replica.** Existing v1 rows migrate: decode, PUT to object store, write `audio_url` + `sha256`, null the b64.

## 5. Sync Streams (edition 3)

Auto-subscribe, parameterized by JWT `sub`.

```yaml
streams:
  mine:
    auto_subscribe: true
    queries:
      - SELECT * FROM folio_library WHERE user_id = auth.user_id()
      - SELECT * FROM folio_progress WHERE user_id = auth.user_id()
      - SELECT * FROM folio_tags WHERE user_id = auth.user_id()
      - SELECT * FROM folio_highlights WHERE user_id = auth.user_id()
      - SELECT * FROM folio_highlight_tags WHERE highlight_id IN (
          SELECT id FROM folio_highlights WHERE user_id = auth.user_id()
        )
      - SELECT * FROM folio_bookmarks WHERE user_id = auth.user_id()
      - SELECT * FROM folio_voice_notes WHERE user_id = auth.user_id()
      - SELECT * FROM folio_settings WHERE user_id = auth.user_id()

  clubs:
    auto_subscribe: true
    queries:
      - SELECT * FROM folio_club_members WHERE user_id = auth.user_id()
      - SELECT * FROM folio_clubs WHERE id IN (
          SELECT club_id FROM folio_club_members WHERE user_id = auth.user_id()
        )
      - SELECT * FROM folio_highlights
        WHERE club_id IN (
          SELECT club_id FROM folio_club_members WHERE user_id = auth.user_id()
        )
      - SELECT * FROM folio_voice_notes
        WHERE club_id IN (
          SELECT club_id FROM folio_club_members WHERE user_id = auth.user_id()
        )
```

Companion (Theo) highlights/voices are rows with `is_companion = true` and a well-known `user_id`. They must be **included in `clubs`** (Alexander Circle membership) so a signed-out device that later signs in still sees them after first club pull. Unsigned devices keep the bundled copies; PowerSync does not run until a JWT exists.

**Access control lives in the JWT + these queries, but uploads are re-checked in REST.** Stream parameters are not a security boundary for writes.

## 6. Upload connector (this is where Folio’s rules live)

`uploadData()` walks `ps_crud` FIFO and maps to existing endpoints:

| op | table | REST |
| --- | --- | --- |
| PUT/PATCH | folio_highlights | POST `/highlights` (upsert by client id) |
| DELETE | folio_highlights | DELETE `/highlights/:id` — 409 if companion |
| PUT | folio_progress | POST `/progress` — server compares `updated_at`, last writer wins |
| PUT | folio_voice_notes | POST `/voices` **metadata only** (no b64). Audio must already be on object storage, or the connector waits on the attachment queue. |
| PUT | folio_tags, folio_bookmarks, folio_settings, folio_library | matching v1 routes |
| any | companion row | drop from queue, do not retry |

Hard rules in the connector, not in the SDK:

1. **Do not stall the queue.** A 409 companion delete is ack’d and discarded. A 401 refreshes JWT once then nacks. A 5xx nacks and backs off. A 413 voice metadata with missing blob is parked on that row, not the whole FIFO — if the SDK only offers FIFO, the connector must skip-and-requeue that op locally so a missing mp3 cannot freeze bookmarks.
2. **Idempotent.** Client UUIDs. `ON CONFLICT DO UPDATE WHERE user_id = :uid`.
3. **Progress LWW.** If incoming `updated_at` < stored, return 200 with the stored row so the replica converges on next down-sync. Never 409 a progress write.
4. **Highlight union.** A DELETE is a tombstone (`deleted_at`). A PUT of the same id from the other device with a newer `updated_at` resurrects. We add `updated_at` and `deleted_at` to `folio_highlights` (migration 0004).
5. **Club writes.** Only the author may PATCH/DELETE their mark. Club-mates receive it on the down-stream; they may only POST a **reply voice** (`reply_to`).

If the FIFO cannot skip a poison op, this spec is invalid — see adversarial notes. We would then need a sidecar table `folio_upload_hold(id, reason)` and a connector that acks the SDK op while we retry out of band. That is extra code PowerSync was supposed to save.

## 7. Voice attachments

Never `audio_b64` in a synced column.

Record on device → write file under app files → insert `folio_voice_notes` with `audio_url=''`, `sha256`, `byte_length` → attachment queue uploads via signed PUT → PATCH row with the public/signed GET URL → other devices’ attachment queues download into their local files dir.

Max duration 90s. Max bytes 2.4MB (same as v1). Mime: `audio/m4a` native, `audio/webm` web. Transcode is **not** in v1 of this spec; each client plays what it can, falls back to transcript.

Failure: metadata row without a successful PUT is local-only. Other devices see nothing. The queue retries the PUT independently of CRUD.

Alpha warning: Kotlin/Swift attachment APIs are documented as alpha. If they misbehave, we fall back to the same two-step REST as Spec B (`POST /voices/blob` then POST metadata) and only use PowerSync for the metadata row. That fallback **must ship**, not be a later idea.

## 8. Web reader

Two options, pick one before unlock:

- **W1.** PowerSync JS + WASM SQLite in the browser. Same replica as native. Preview iframe and auth cookies make JWT minting fiddly; OPFS required.
- **W2.** Web keeps talking Postgres through existing server functions. Native uses PowerSync. Origin is still Postgres so they converge. Web will be slightly behind (request/response) unless we add a listen channel.

**Choose W2.** The web app is a preview and a Gutenberg/search surface, not the garden folio. One WASM SQLite in an iframe is a second source of “why is my mark gone.” Native is the offline client; web is origin-online.

## 9. Deletes, clocks, identity

- Every synced table has `id text primary key` (UUIDv4, client-generated).
- `folio_progress` currently keys `(user_id, book_id)`. Add a synthetic `id = user_id || ':' || book_id` for PowerSync (it wants a single `id` column). Keep the unique pair.
- Server clock is authority for `created_at` on first insert. Client `updated_at` is trusted if `|client - now| < 24h`, else server stamps `now`.
- Club membership revoke: member row DELETE removes them from the `clubs` stream. Their **own** marks remain (they live in `mine`). Marks they only saw via the club disappear from their replica on the next stream — correct. Those marks remain on authors’ devices.
- Sign-out: `disconnect()`, wipe replica, keep bundled catalog and local-only drafts if we ever add guest marks. Guest marks today stay in the old SQLite; after cutover, guest mode uses a local-only PowerSync partition or we keep a tiny guest DB. **Decision: guest stays on the old local schema; PowerSync starts at sign-in.** Two databases on device until guest is abandoned.

## 10. Ops, cost, failure

- Neon: logical replication slot. Slot lag during preview hibernate can bloat WAL. Need a heartbeat or accept that self-host/open-edition on a sleeping preview is a bad idea — **PowerSync Cloud against production Neon only, not against the sandbox PGLite.**
- Preview/dev: stay on HTTP v1. PowerSync is a production-native concern.
- Cloud pricing (2026 public): free tier ~50 concurrent connections / a few GB; Pro from ~$49/mo. Folio at two devices is free-tier shaped until a club is popular.
- Poison replication: dropping the slot = full resnapshot. Clients handle that. We must not create a new slot every deploy.
- JWT rotation every ≤60 min. DC-1 asleep: fetchCredentials on wake. Fine.
- Monitoring: connector logs per op; attachment queue depth; stream `downloadProgress`.

## 11. Cutover

1. Overnight gate passes on both apps (HTTP v1).
2. Migration 0004: `updated_at`, `deleted_at`, `sha256`, drop `audio_b64` after blob migrate.
3. JWT mint route. Object store. PowerSync instance + streams.
4. Ship native apps that open **guest DB** unsigned and **PowerSync DB** signed. Dual-read during one release: if PowerSync empty, import from guest/v1 snapshot then mark imported.
5. Web stays W2.
6. `POWERSYNC_LOCKED = false`. Health reports `powersync: "open"`. HTTP v1 remains for catalog, blob signed URLs, and the connector.

Rollback: set locked true, native falls back to v1 snapshot/push against the same Postgres. Replica is a cache.

## 12. Non-goals

- CRDTs on highlight text.
- Syncing EPUB/HTML bodies (catalog + `folio_book_content` stay pull-on-demand).
- Using PowerSync as a blob store.
- Sharing a replica with unsigned users.

## 13. Acceptance

- Highlight on iPhone while DC-1 is off. Open DC-1 on wifi. Mark appears without an explicit “sync” tap, under 5s after connect.
- Voice recorded offline on DC-1. On wifi, phone can play it. Postgres has no `audio_b64`.
- Delete on phone. Folio, if it had a dirty note on that id, does not lose the note — resurrection or a visible conflict sheet. (If we cannot show a conflict sheet, **refuse silent delete**: last writer on `updated_at` including deletes.)
- Kill PowerSync Service. Both apps keep reading and writing locally. Queue drains after service returns.
- Companion rows cannot be deleted from either device.
