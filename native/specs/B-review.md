# Spec B — adversarial review

## Verdict

Do not ship. Spec B is a third protocol on stores that do not match the spec, an origin that cannot LISTEN, and a blob pipeline that never marks S3 objects ready. It keeps SQLiteOpenHelper / “SwiftData” as a virtue while inventing outbox, change_log, epoch tokens, long-poll, and a two-step attachment queue — PowerSync’s shape, none of the implementation. Unlocking this means three drain loops, v1+v2 forever, and a garden folio whose radio never sleeps. Stay on v1 until a human signs the gate; then pick A.

Companion immutability and catalog-on-v1 are fine. Two devices highlighting the same sentence as two marks (§6) is existing union-by-id, not a B-only bug.

## Fatal (will actually break the product)

1. **Cursor rewind (§5.2, §7).** Claim: apply ops, then `cursor = response.cursor`. Foreground `wait=1` and resume drain run together. Both GETs start at `u:1:40`; drain stores `u:1:50`; the long-poll returns empty/stale and writes the cursor back. Next pull skips 41–50 or double-applies around outbox skips. **Damage:** marks appear on the phone and vanish on the folio until an epoch bump. The token is called opaque but documented as `{userId}:{snapshotEpoch}:{seq}` — parse `userId` from it and that is an IDOR. Drain does one GET, no `while truncated`, so a 500-cap of page-turn progress delays a club voice.

2. **Write-time fan-out vs join/leave (§8, §5.2, §10).** “A club of 5 = 5 log rows. Fine.” Today’s `joinClub` inserts a member and stops. B never bumps the joiner’s epoch or copies history into their log. A signed-in user with cursor `u:1:900` joins and `/changes` is empty. **Leave:** “delete ops for club-visible rows the user did not author.” There is no `leaveClub` in the tree. If `club_id` stays, remaining members keep seeing the leaver; if cleared, they need their own deletes — unspecified. A voice the leaver authored on someone else’s highlight stays; the parent is deleted → orphaned hero audio. Fan-out is not transactional with the row write: crash after 2 of 5 NOTIFYs and the circle splits. Android saves progress every page turn — hundreds of seqs per sitting, not “1–5 rows per human action.”

3. **Outbox skip reimplements resurrection (§5.2, §6).** Rule 1: `if op.id in outbox: skip`. Hide-delete / upsert never run for dirty ids. Phone deletes, folio has a dirty note: folio skips the tombstone, pushes the put, newer `updatedAt` resurrects. Spec: “Show nothing fancy.” A refuses silent delete if there is no conflict sheet. v1 already union-adds and never removes; B claims to fix that and puts it back. Clock skew stamps `now` into `accepted[]`; drain only “remove accepted.” If local `updatedAt` is not patched, every later push is `stale`.

4. **Blobs never become `ready` in production (§5.3–5.4, §7, §10).** Signed PUT goes to R2/S3. Origin is not on that path. No complete/HEAD/notification. `folio_blobs.state` stays `pending`; metadata push is `blob_missing`; outbox keeps the voice. 10-minute PUT on garden wifi for 2.4MB expires mid-transfer. SHA is verified “if cheap”: trust the client and the cache key is poison; skip and truncated audio lives under that sha forever. FIFO with the voice at the head burns attempts; after 8, dead-letter on the hero feature. Preview stores bytes on origin filesystem/bytea; hibernate **deletes the mp3s**.

5. **`wait=1` kills the DC-1 and does not work on this origin (§5.2, §7, §9, §10).** 25s LISTEN/NOTIFY. Origin is TanStack Start + `pg.Pool` to Neon (pooled: LISTEN is illegal) or PGLite (preview hibernates). Fallback is `max(seq)` every 25s, so every open reader still holds HTTP 25s. Android/iOS request timeouts are 30s — 5s of slack, then reconnect. Foreground reading = radio up every 25s on an e-ink folio. §7 long-polls while the screen is on. Hibernated preview is a reconnect storm, not “same as today.”

6. **Tombstones have nowhere to live; compact resurrects (§4, §5.1, §10).** “iOS keeps SwiftData.” iOS is `folio-store.json`. No SwiftData, no `deletedAt` on `Highlight`. Android `FolioDb` is version 1 with empty `onUpgrade`. Ship 0004 without a native bump and the app throws or ignores columns. Apply-delete is “hide,” not `deleted_at`. Compact: 90 days, `epoch++`, resnapshot with tombstones vacuumed. §5.1: outbox wins if `updatedAt ≥ snapshot`. An outbox put whose delete was compacted has no snapshot row to lose to → the delete comes back.

7. **Theo ids already fork (§8, §5.1).** Local `theo-hl-${key}` / `alexander-local` vs origin `theo-hl-${key}-${clubId.slice(0,8)}`. Union-by-id → two Theo washes. B says prefer one canonical row **or** per-member copies. Copies cannot share PK `id`. First v2 snapshot does not remap local ids. `folio_highlight_tags` is missing from the §4 delta.

## Load-bearing optimism

**“~200 lines per client” (§2).** Outbox, backoff, blobs, sha, cursor, epoch, tombstones, dead-letter, WorkManager, BGAppRefresh, join/leave, clock skew. `FolioApi.kt` is already ~150 lines of v1. iOS has no SQL for an outbox. Count 1–2k × 3.

**“Snapshot is tens of KB” (§2, §13).** Metadata yes. Voice is the working set. `<300KB` for 50 metadata rows is the easy number.

**“iOS background is documented not a bug” (§13 vs A §13).** A requires the mark on the folio in under 5s without a tap. B redefines the test so opening the app *is* the sync. The garden overnight is the gate in `POWERSYNC.md`. B fails it by construction.

**“Dev stores blobs on origin.”** Preview is PGLite. Process death drops the bytes.

**“Partial batch is fine.”** UUID upserts survive a partial client batch. Partial fan-out is split-brain.

**“No CRDT needed.”** Fine for two devices if delete-vs-edit is visible. B chooses silent LWW — no UX, not no CRDT.

## You are reinventing PowerSync

`folio_outbox` is `ps_crud` — you write drain/backoff/dead-letter and still stall on `blob_missing` until attempts > 8. `folio_change_log` + per-user seq is buckets/streams with write-time copies instead of SQL membership, so join/leave must be hand-authored. `GET /changes?wait=1` is the sync stream as 25s HTTP. `POST /blobs` + signed PUT is the attachment queue; A admits alpha and **requires** a REST fallback *with confirm*; B *is* that fallback and omits confirm. Snapshot + `snapshotEpoch` is resync-on-slot-drop without wipe semantics. LISTEN/NOTIFY is a replication slot that dies on the Neon pooler; you already documented polling.

A is honest: PowerSync does not replace REST; poison FIFO can invalidate the spec. B pretends three routes are “not a product” then specifies the product.

## Security / privacy

Signed PUT/GET in `POST /blobs` before bytes exist. Path unspecified (A uses `voices/{userId}/{voiceId}`). Leak the JSON, anyone plays the note until expiry. Snapshot `audioUrl` is 1h-signed but persisted in `row_json`; open the sheet after lunch and you 403 unless you always `GET /blobs/:id`. Club fan-out copies that URL into every member’s log. `change_log.user_id` is owner **or** fan-out target with full `row_json` — mates retain notes they did not author. `inviteCode` is in the snapshot; leave does not scrub local JSON. Client SHA, server “if cheap”: collide the cache or stick truncated audio.

## Cost you will pay in six months

Three drain loops: Kotlin SQLite, Swift JSON (not SwiftData), web server functions + `wait=1`. They already diverge (`native-api.server.ts` stamps progress `now()` and ignores client `updatedAt`; `server.ts` is a second copy). B adds v2 and says they “cannot diverge on LWW.” `PROTOCOL.md` stays folio-native/1 while health grows `"changeset": "open"` and `POWERSYNC_LOCKED` stays true. v1 kept “for one native release”: a DC-1 in a drawer means **v1+v2 forever**.

## What would have to be true for B to lose

It already loses. Bar anyway: a third device; a club that joins and leaves; production R2; DC-1 battery with `wait=1`; Neon pooled connections; preview hibernate; a mark that must appear without opening the folio. Then A’s connector onto existing v1 is cheaper than staffing this protocol.

## Steal from A

Keep v1 REST as the commit story (A §1, §6); do not invent `/push` with a second LWW — fix progress clocks once in `handleNativeRequest`. Query-time clubs, not write-time copies (A §5). Park `blob_missing` off the FIFO (A §6); confirm the PUT; path `voices/{userId}/{voiceId}`. W2: web does not long-poll (A §8). Guest schema until sign-in; remap `theo-hl-*` on first snapshot (A §9). Refuse silent delete-vs-edit (A §13). Name the iOS store (JSON) or pick GRDB (A §4). Snapshot replace = wipe absent non-outbox rows. Cursor is session-scoped; loop `truncated`; cancel `wait=1` during drain. Transaction around mutation + fan-out, or do not fan-out.

B without those is worse than v1. v1 fails in one obvious way (pull never deletes). B fails when a club leaves and a folio wakes 91 days later.
