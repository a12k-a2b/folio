# PowerSync — locked

`POWERSYNC_LOCKED = true` in `src/lib/folio/native-path.ts`.

`GET /api/native/v1/health` reports:

```json
{
  "powersync": "locked",
  "powersyncLocked": true,
  "reason": "HTTP v1 pull/push is the sync until both native apps keep a mark overnight on device."
}
```

## Why it is locked

Two-way CRDT sync is the right end state (Postgres origin, per-user buckets,
object storage for voice blobs, last-writer on progress, union on highlights).
It is the wrong **next** step. A sync engine on top of unproven native stores
will launder bugs: a Room/SwiftData miss looks like a conflict.

The Kotlin DC-1 app and the SwiftUI iPhone app must each:

- open a bundled book offline
- write a Matter mark into local SQL
- survive process death
- push/pull that mark over HTTP v1

before any PowerSync client, connector, or schema is added.

## What is allowed now

- Local SQLiteOpenHelper (Android) and SwiftData (iOS)
- `dirty` flags and a single `FolioApi.pull(bookId)` / `FolioApi.pushDirty()`
- The REST surface in [PROTOCOL.md](./PROTOCOL.md)

## What is forbidden until unlock

- `com.powersync` Gradle / SPM dependency
- PowerSync Service config, sync rules, buckets
- A “sync engine” abstraction that is not HTTP v1
- Replacing `dirty` with CRDT clocks

## Unlock checklist (human, on device — not this preview)

1. DC-1: highlight a sentence in *Living Structure*, force-stop, reopen, mark present.
2. iPhone: same, independently, in *Walden*.
3. Sign in on both. Pull on the other device. The mark appears. Voice optional.
4. Set `POWERSYNC_LOCKED = false`, add the SDK, buckets:

```
library, progress, highlights, highlight_tags, bookmarks, tags, settings
voice_notes  (row + pointer; blobs in object storage, not WAL)
```

Conflict: last-writer on `folio_progress.updated_at`. Union on highlights —
never delete a mark the other device still has. Companion (Theo) rows are
server-owned.

Railway remains a fine host for the sync service if PowerSync Cloud is too
much. The protocol matters more than the vendor.

## After the gate: PowerSync is not the default

Specs and adversarial reviews live in [specs/](./specs/). Verdict: **do not
unlock PowerSync** for two devices and a five-person club. Close three holes
in HTTP v1 (voice blobs, tombstones, batch push). See [specs/VERDICT.md](./specs/VERDICT.md).

