# Spec A — adversarial review

## Verdict

Do not ship. Spec A buys a replication service Folio does not need, then reinvents Spec B inside the upload connector, the attachment fallback, and a dual local schema it cannot escape. POWERSYNC.md locked the engine so it cannot launder store bugs; A rewrites both stores before that gate means anything. Two devices, a sleeping garden folio, a five-person club: this is the six-month rewrite you take when you are bored of shipping the reader.

## Fatal (will actually break the product)

1. **FIFO vs the hero feature (§6.1, §7, §13).** `ps_crud` is a blocking FIFO: no ack, nothing behind it drains. Voice is two-phase (file → signed PUT → metadata). A late blob is a 413. A says park that row — “if the SDK only offers FIFO, skip-and-requeue.” That is an admission, not a spec. Until `folio_upload_hold` exists, one garden recording freezes bookmarks and progress. User-visible: folio stuck, voice never leaves, then stale progress overwrites the phone.

2. **Empty `audio_url` leaks or stalls (§7 vs §6).** Record path inserts `folio_voice_notes` with `audio_url=''`, then uploads the file, then PATCHes the URL. That insert is a PowerSync write. Connector waits → FIFO stalls. Connector uploads → other devices get an unplayable voice. §7 also says a metadata row without a PUT is local-only. Both cannot be true of a synced table. User-visible: ghost play buttons, or silence that looks like the recording arrived.

3. **Alpha attachments are the voice path (§2, §7).** Kotlin/Swift helpers: “Do not rely on this for production.” Fallback that “must ship” is B’s `POST /blobs` plus PowerSync for the row. Hero feature is B plus a second queue. `saveFile` racing CRUD yields rows without bytes. User-visible: voice lost.

4. **Delete vs dirty note is unimplemented (§6.4, §13).** Acceptance: phone delete must not eat a dirty folio note — resurrection or a conflict sheet. PowerSync has no conflict sheet. Ack/reject converges on server. LWW either resurrects a deleted club mark (the v1 bug) or tombstones the folio’s unsynced sentence. User-visible: mark resurrected, or garden notes gone when wifi returns.

5. **Origin tables are not PowerSync tables (§4, §9, §11, 0002/0003).** PowerSync wants one text `id`. `folio_club_members` PK is `(club_id, user_id)` — no `id`. `folio_highlight_tags` PK is `(highlight_id, tag_id)` — no `id`. Progress/settings are composite. Cutover 0004 adds timestamps and drops `audio_b64`; it does not add `id`. Streams that `SELECT * FROM folio_club_members` cannot publish. User-visible: club marks never arrive; tagged highlights land naked.

6. **Companion delete is 403; connector listens for 409 (§6 vs native-api.server.ts).** Live DELETE returns 403 for Theo. The only “ack and discard” rule is 409. 403 is not in the backoff list. A companion delete sits at the head of FIFO forever. User-visible: folio stuck; Theo flickering as local writes fight the replica.

7. **Guest DB + PowerSync DB, one-shot import (§9, §11.4).** “Two databases until guest is abandoned.” Import only if the replica is empty. DC-1 in a garden is often unsigned; marks go to `folio.db` / `folio-store.json`. Paste a bearer after a prior session: those marks are not imported. Sign-out wipes the replica; guest drafts never drain. JWT ≤60 min on a week-asleep folio: mint fails, writes hit the wrong handle. User-visible: overnight marks gone; two Theos (`theo-hl-feeling` vs `theo-hl-feeling-<club>`).

## Load-bearing lies

- **“PowerSync does not replace the native API” (§1).** §6 rewrites LWW, tombstones, companion discard, blob-wait, resurrection. v1 `POST /progress` stamps `now()` and ignores client `updated_at`. `POST /voices` stores `audio_b64`. No metadata-only voice route. The connector is a new protocol wearing v1 paths.

- **“Replaces polling, retry, and is-my-SQLite-current” (§1).** You still own retry, JWT wake, blobs, conflicts. Dirty flags “go away” as `ps_crud` plus `folio_upload_hold`.

- **“Existing REST” (§1, §6).** 403 vs 409, hard DELETE vs `deleted_at`, b64 vs blob: new API work. B is honest that v2 is three routes. A pretends zero.

- **“SwiftData leftover; GRDB is the path” (§4).** `FolioStore.swift` is JSON in Application Support, not SwiftData. PROTOCOL.md lies the same way. A throws away the file store that kept the overnight mark for a third store.

- **“SQLiteOpenHelper leftover; Room is beta” (§4).** Folio is not on Room. `FolioDb.kt` is the app. The leftover is the guest DB §9 says you keep.

- **“WAL on Neon, not PGLite” (§10) as isolation.** Preview cannot run A. First slot, first JWT, first FIFO poison: production Neon after unlock. POWERSYNC.md forbade a sync engine on unproven stores.

- **Rollback is a cache (§11).** Drop `audio_b64` and v1 cannot push voices. Rewrite Compose/Swift and there is no v1 drain unless you keep it — dual protocol forever. `POWERSYNC_LOCKED = true` does not resurrect `FolioDb`.

- **W2 converges (§8).** Web still records `audioB64`. Dropping the column kills web voice unless web grows blobs too. Then LWW helpers diverge.

## Platform mismatches

DC-1 sleeps days on flaky wifi. Acceptance: mark appears with no sync tap, under 5s after connect. Wake is mint JWT, websocket to Cloud, drain FIFO, download attachments. That is not 5s. iOS BGAppRefresh is theater; the Swift SDK will not drain in a pocket overnight. The folio opening the app is the sync — B says this.

W2 is split-brain: native replica vs web request/response. PGLite has no logical replication; dropped slot = full resnapshot. Open Edition needs a second store and a slot that dies when preview hibernates. Cloud-only against prod Neon means you never dogfood the topology.

Dual-store is the product, not a footnote. Unsigned reading is required (PROTOCOL.md). Two schemas, two Theo seeds, two dirty mechanisms, one import that runs once.

## Security / privacy

Clubs stream `SELECT *` on clubs, highlights, and voices for every membership (§5). Invite codes, notes, `audio_url`s land on every disk. `folio_club_members` is filtered to `auth.user_id()`, so no roster — over-share content, under-share members. Club-mate tags are not in the stream.

`audio_url` in the replica is a long-lived GET (left member keeps the URL and file) or a short-lived signed URL that expires in SQLite so the other device 404s. Leave-club (§9) drops stream rows; it does not wipe the attachment cache. Deleted member still has everyone’s mp3s.

Local Theo ids (`theo-hl-*`, `alexander-local`) ≠ origin (`theo-hl-*-<club>`, `user_id = companion:theo`). Connector drops companion ops after they already wrote SQLite. JWT mint from a bearer pasted in Settings, stored in plaintext JSON. CORS `*`. Stream SQL is not a write boundary; live REST does not match §6.

## Cost you will pay in six months

Rewrite `FolioDb.kt` and `FolioStore.swift` around `PowerSyncDatabase`/GRDB; keep the old schema as guest; ship a connector that is a second protocol; ship B’s blob routes when alpha attachments fail; pay Cloud (~$49/mo) plus R2 plus a Neon slot you must never drop; keep `folio-native/1` for catalog, tokens, and the connector forever. Vendor on the wake path of an offline device. Dual protocol is the architecture. Five people, tens of kilobytes of marks: a field-team sync tax on a garden reader.

## What would have to be true for A to win

Many devices, many tables, a live club that stays online — not two devices and Alexander Circle. A single text `id` on every origin table before unlock. A non-FIFO upload path in the SDK, not a sidecar. Production attachments, or B’s blob API as the only voice path. One local database, including unsigned. The §13 conflict sheet as UI, or honest LWW with no resurrection. Dogfood the slot off the preview. Folio as specified fails that bar. A loses.

## Steal from B

- Outbox that cannot poison FIFO: `folio_outbox`, dead-letter after 8 attempts, UI “this mark did not leave the device.” Never block a bookmark on a voice.
- Blobs as two-step (`POST /blobs`, signed PUT, metadata, `blob_missing` keeps only that op). No bytes or signed URLs in the replica.
- Tombstones with a 90-day epoch, not DELETE-as-gone plus resurrection.
- Write-time club fan-out (one log row per mate) instead of `SELECT *` streams that dump invite codes and miss member rows.
- Keep SQLiteOpenHelper and the iOS file store. Prove those, then add a cursor.
- Honest drain: WorkManager hourly; iOS on resume; foreground long-poll. No 5s magic.
- Companion as canonical rows; ignore deletes matching live 403, not a fictional 409.
- Web on the same mutation helpers so W2 cannot diverge LWW.
- Poison op never stalls the rest (B §10). A §6.1 treats it as a maybe. It is the product.
