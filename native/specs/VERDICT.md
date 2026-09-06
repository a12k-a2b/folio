# Verdict — you do not need PowerSync

Question: does Folio need PowerSync, or will a simpler sync service do?

Answer: **neither spec, as written, should ship.** Stay on HTTP v1 until the overnight gate. Then ship a **small v1.1** (blobs + tombstones + batch), not a sync engine and not a homemade one.

Adversarial reviews: [A-review.md](./A-review.md) (PowerSync), [B-review.md](./B-review.md) (Changeset). Both verdicts were *do not ship*. They were right.

## What Folio actually syncs

Two devices (garden folio, pocket phone). A club of about five. Marks, notes, tags, bookmarks, the page you were on, and voice on a sentence so you hear the feeling.

Without audio, a lifetime of that is tens of kilobytes. Audio is the only fat thing. Companion (Theo) rows are server-owned. Conflicts are few and already named: last-writer on progress, union on marks, append on voices.

That is not a field-team CRDT problem. It is “don’t put mp3s in JSON, don’t resurrect a delete, don’t stall a bookmark behind a voice.”

## Spec A — PowerSync

A replication service in front of Neon. Kotlin/Swift SDKs. Local SQLite replica. Writes still go through **our REST**. Voice bytes still go through **object storage**.

What it actually buys: a retrying upload queue, incremental down-sync, a watch so the other device updates without a pull.

What the review killed:

- PowerSync does not take writes. The upload connector *is* a new protocol (LWW, tombstones, companion, blobs). A pretends v1 is enough. It is not: live companion delete is **403**, the spec listens for **409**, and a 403 at the head of a FIFO freezes the folio.
- Voice is two-phase. A blocking FIFO plus an empty `audio_url` either stalls everything or ships ghost play buttons.
- Kotlin/Swift attachment helpers are alpha. The “must-ship fallback” is Spec B’s blob routes. Then you paid for two queues.
- Origin tables (`folio_club_members`, `folio_highlight_tags`) have composite keys. PowerSync wants a single `id`. Cutover 0004 as specified cannot publish the club stream.
- iOS is not SwiftData. It is `folio-store.json`. Android is not Room. A rewrites both stores *before* the overnight gate, which exists so a sync engine cannot launder store bugs.
- Guest DB + signed replica, one-shot import: garden marks written unsigned do not come back.
- Preview/PGLite cannot run this. First dogfood is production Neon plus a replication slot.

A wins only if Folio becomes many devices, a live online club, many new tables, and one local database including unsigned. That is not this product.

## Spec B — Folio Changeset (`folio-native/2`)

No extra process. Cursor, tombstone, blob store, 25s long-poll. Keep the stores we wrote.

What it actually buys: the three things v1 is missing, without a vendor.

What the review killed:

- It is PowerSync’s shape in three languages: outbox ≈ `ps_crud`, change_log ≈ buckets, long-poll ≈ the stream, two-step blob ≈ the attachment queue — none of them implemented for us.
- Cursor rewind: foreground long-poll and drain can start at the same cursor; the slower one writes backwards. Marks appear on the phone and vanish on the folio.
- Signed PUT to S3 never flips `folio_blobs` to `ready` (no complete/HEAD). Metadata push is `blob_missing` forever. Hero feature dead-letters after eight tries.
- Club join does not backfill. Leave is unspecified. Write-time fan-out of 2-of-5 then a crash splits the circle.
- `if op.id in outbox: skip` reimplements the resurrection B claimed to fix (phone deletes, folio has a dirty note, folio pushes the note, delete loses).
- `LISTEN/NOTIFY` is illegal on Neon pooled connections. Fallback is a 25s HTTP hold. DC-1 client timeout is 30s. Radio up every 25s on a garden folio.
- iOS still has no SQL, no `deletedAt`. Android `onUpgrade` is empty. 90-day tombstone compact + outbox-wins-on-snapshot resurrects deletes.
- Local Theo ids already fork from origin ids. First snapshot makes two Theos.

B without those fixes is worse than v1. v1 fails in one obvious way (pull never deletes). B fails when a club leaves and a folio wakes on day 91.

## What to do instead (v1.1, after the overnight gate)

Keep `folio-native/1`. Do not unlock PowerSync. Do not add `/v2/changes?wait=1`.

1. **Voice out of the row.** `POST /blobs` → signed PUT → confirm (HEAD or `POST /blobs/:id/complete`) → metadata POST. Never `audio_b64` on the wire. Preview may store bytes on origin; production uses R2. Missing blob rejects *that* op only.
2. **Tombstones.** `deleted_at` on marks, bookmarks, voices. Pull applies deletes. Outbox vs incoming: compare `updatedAt`; newer wins; never skip a tombstone because the id is dirty. No compact that drops tombstones an outbox put can beat.
3. **Batch push.** One `POST /push` for the dirty set, max 100, each op committed, poison op dead-letters after 8, UI “this mark did not leave the device.” Progress LWW uses the **client** `updatedAt` (v1 stamps `now()` today — that lie has to die first).
4. **Pull stays a snapshot-per-book** until a user is actually large. Incremental is optional. A full metadata snapshot is cheap.
5. **No long-poll on the folio.** Drain on resume, on wifi, on a quiet timer. Opening the book is the sync. iOS background refresh is theater; do not pretend otherwise.
6. **One mutation helper** shared by web and native so LWW cannot fork.
7. **Name the iOS store.** It is a JSON file. Either keep it and put tombstones in the file, or move it to SQLite *as the overnight-gate follow-up*, not as a sync-engine rewrite.
8. **Remap Theo ids** on first signed pull so bundled companion rows and origin rows are the same ids.
9. **Club join = snapshot of that club’s marks**, not write-time log copies. Leave = tombstones for rows you did not author. Invite codes do not need to live on every disk.

That is the simpler sync service: the protocol you already have, with the three holes closed.

## Gate (unchanged)

A human, on device, overnight:

1. DC-1: mark a sentence in *Living Structure*, force-stop, reopen — mark present.
2. iPhone: same, independently, in *Walden*.
3. Sign in. The other device pulls the mark.

Until then: no PowerSync SDK, no change_log, no blob pipeline in production. Local SQL / JSON plus HTTP v1 only.

## One-line

PowerSync is a good engine for a different app. Changeset v2 is that engine, worse. Folio needs blobs, tombstones, and a batch that cannot stall — then stop.

Replicache / Zero / Instant are not a shortcut. They are web (or RN) engines; Zero **rejects writes when offline**. See [C-off-the-shelf.md](./C-off-the-shelf.md).

