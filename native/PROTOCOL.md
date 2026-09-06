# Folio native protocol `folio-native/1`

This is the contract between:

- the web reader (this app)
- the Kotlin DC-1 app (`android/`)
- the SwiftUI iPhone app (`ios/Folio`)

PowerSync is **locked**. See [POWERSYNC.md](./POWERSYNC.md). Do not add a PowerSync
SDK, bucket, or connector until both native apps have kept a mark overnight on
device. HTTP v1 pull/push is the only network sync in this protocol.

Header on every response: `X-Folio-Protocol: folio-native/1`.

## Offline first

Bundled catalog lives in the binary (`native/shared/catalog.json`, copied into
Android assets and iOS resources). A device with no account still:

- opens the six bundled books
- paginates with native text (Compose `TextMeasurer` / CoreText frames)
- writes marks, bookmarks, tags, voice notes, progress to local SQLite (Android) or a JSON file (iOS)
- plays Theo’s companion notes from bundled `voices/theo-*.mp3`

Sign-in is only required to **push** and **pull** against the origin.

## Base URL

```
{origin}/api/native/v1
```

Native clients omit `Sec-Fetch-Site` (OkHttp / URLSession). The origin allows
those. Browser calls from this app are same-origin.

Auth: session cookie (web) **or** `Authorization: Bearer <better-auth session>`.
Email/password is off; native v1 stores a token the user pastes from Settings →
Devices after signing in on the web, or rides the cookie in this preview lab.

CORS: `*` with `Authorization, Content-Type, X-Folio-Protocol`.

## Routes

| Method | Path | Auth | Body / result |
| --- | --- | --- | --- |
| GET | `/health` | no | `{ ok, protocol, sync: "v1.1", powersync, powersyncLocked, catalogSize, time }` |
| GET | `/catalog` | no | `{ protocol, books: CatalogEntry[] }` — no HTML |
| GET | `/catalog/:bookId` | no | `{ protocol, book: Book }` — full chapters |
| GET | `/me` | no (200 either way) | `{ signedIn, userId, email, displayName }` — unsigned returns `signedIn: false`, not 401 |
| GET | `/library` | yes | `{ books, progress, settings, clubs }` |
| GET | `/snapshot/:bookId` | yes | `{ book, highlights, bookmarks, tags, voices, club, tombstones }` — voices have `audioUrl`, never `audioB64` |
| POST | `/progress` | yes | `Progress` — last writer on **client** `updatedAt` wins. Stale push returns `{ stale: true, progress }` |
| POST | `/highlights` | yes | highlight (client may send `id`) → `{ id, clubId }` |
| PATCH | `/highlights/:id` | yes | `{ note?, tagIds? }` → `{ ok }` |
| DELETE | `/highlights/:id` | yes | `{ ok }` — tombstone. Refuses companion (403) |
| POST | `/bookmarks` | yes | `{ bookId, chapterIndex, pageIndex, label, id? }` → `{ id }` |
| DELETE | `/bookmarks/:id` | yes | `{ ok }` — tombstone |
| POST | `/voices` | yes | metadata after blob is `ready`. `audioB64` is ingested as a blob then dropped. `{ id }` or 409 `blob_missing` |
| DELETE | `/voices/:id` | yes | `{ ok }` — tombstone. Companion 403 |
| POST | `/blobs` | yes | `{ id?, mime, byteLength, sha256? }` → `{ id, putUrl, getUrl, expiresAt }` |
| PUT | `/blobs/:id/data` | yes | raw bytes, max 2.4MB. Does **not** mark ready |
| POST | `/blobs/:id/complete` | yes | verifies bytes, sets `ready` |
| GET | `/blobs/:id` | yes | audio bytes if ready and visible |
| POST | `/push` | yes | `{ ops[] }` → `{ accepted[], rejected[] }`. Each op commits. A missing blob rejects **that** op only |
| GET | `/tags` | yes | `{ tags }` |
| POST | `/tags` | yes | `{ name, emoji, kind, id? }` → `{ id }` |
| DELETE | `/tags?id=` | yes | `{ ok }` |
| GET | `/settings` | yes | `{ settings }` |
| POST | `/settings` | yes | `FolioSettings` → `{ ok }` |
| OPTIONS | `*` | no | 204 |

JSON field names are **camelCase**, matching `src/lib/folio/types.ts`.

## Catalog entry

```json
{
  "id": "living-structure",
  "title": "Living Structure",
  "author": "Folio Field Notes",
  "year": "2026",
  "description": "…",
  "coverLabel": "I",
  "source": "bundled",
  "chapterCount": 6,
  "wordCount": 2400,
  "chapters": [{ "id": "ls-1", "title": "The feeling in a room" }]
}
```

## Highlight (pull and push)

```json
{
  "id": "uuid",
  "bookId": "living-structure",
  "chapterId": "ls-1",
  "startOffset": 0,
  "endOffset": 64,
  "text": "There is a feeling you already know",
  "note": "",
  "createdAt": "2026-09-05T09:00:00.000Z",
  "tagIds": [],
  "authorId": "user-uuid",
  "authorName": "You",
  "clubId": "club-uuid-or-null",
  "isCompanion": false
}
```

Client-generated UUIDs are required for offline writing. POST upserts on `id`
owned by the caller. Companion rows (`isCompanion: true`, Theo) are pull-only.

## Progress

```json
{
  "bookId": "living-structure",
  "chapterIndex": 0,
  "pageIndex": 2,
  "percent": 0.14,
  "locator": "ls-1:2",
  "updatedAt": "2026-09-05T09:00:00.000Z"
}
```

Conflict: last writer on the origin wins. Native keeps a local copy always.

## Voice note

`audioB64` max ~2.4MB is accepted only as a one-step ingest that writes `folio_blobs` then stores an empty row column. Prefer the two-step blob API. `audioUrl` is origin-absolute after pull (Theo’s MP3s). Native also ships those files under `voices/` so the club works offline.

## v1.1 sync (still `folio-native/1`)

Health reports `sync: "v1.1"`. PowerSync stays locked.

- **Blobs.** Voice bytes live in `folio_blobs`, not on the voice row. PUT then POST complete. A 409 `blob_missing` never blocks a bookmark in `/push`.
- **Tombstones.** Deletes set `deleted_at`. Snapshot lists live rows plus `tombstones`. Pull applies a tombstone even if the id is dirty, when the tombstone’s `updatedAt` is newer.
- **Batch.** `POST /push` with up to 100 ops. Partial success is normal. Poison op is rejected; the rest drain.
- **Progress.** Last writer is the client `updatedAt`, not server `now()`.
- **Companion ids.** Bundled `theo-hl-feeling` and origin `theo-hl-feeling-<club>` are the same note. On pull, adopt the origin id.
- **No long-poll.** Drain on resume and on wifi. Opening the book is the sync.

## Local SQL (Android SQLiteOpenHelper / iOS JSON file mapped to the same names)

```
folio_library(id, book_id, source, title, author, description, cover_label, added_at)
folio_book_content(book_id, chapters_json)
folio_progress(book_id, chapter_index, page_index, percent, locator, updated_at)
folio_tags(id, name, emoji, kind, created_at)
folio_highlights(id, book_id, chapter_id, start_offset, end_offset, text, note, created_at, author_id, author_name, club_id, is_companion, dirty)
folio_highlight_tags(highlight_id, tag_id)
folio_bookmarks(id, book_id, chapter_index, page_index, label, created_at, dirty)
folio_voice_notes(id, highlight_id, transcript, audio_b64, mime, duration_ms, created_at, author_id, author_name, reply_to, club_id, is_companion, audio_url, dirty)
folio_settings(json)
folio_meta(key, value)  -- origin, token, last_pull_at, powersync = "locked"
```

`dirty` is local-only: 1 after an offline write, 0 after a successful POST.
Pull applies `tombstones` even if the id is dirty, when the tombstone `updatedAt` is newer.
Last-writer on progress uses the client `updatedAt`.

## Matter gestures (both apps)

| Gesture | Result |
| --- | --- |
| 2 taps on a word | highlight that word |
| 3 taps | highlight the sentence |
| 4 taps | highlight the paragraph |
| press-drag | custom span; lift keeps it |
| tap an existing mark | annotation sheet (note, tags, voice) |
| tap right third / swipe from right | next page |
| tap left third | previous page |
| tap middle | chrome (title, bookmark, paperclip) |
| hold mic (thumb, lower-right) | push-to-talk; lift stops |

Daylight DC-1 layout tokens: **1184 × 1584**. Thumb chrome sits in the bottom
124px. iPhone twin: **390 × 844**.

Paper `#F2EFE6` / `#E7E1D2`. Ink `#1C1B16` / `#5A564C`. Mark wash `#D8D0BC`.
No highlighter rainbow. Type: a serif for the page (Newsreader / New York /
Noto Serif), IBM Plex Sans / SF Pro for chrome.

## Proven-out gate (before PowerSync)

Both of these, on real hardware, overnight:

1. Kotlin DC-1: mark a sentence, kill the app, reopen — mark still there.
2. Swift iPhone: same, independently.

Then HTTP pull on the other device shows the mark. Only then unlock PowerSync.
