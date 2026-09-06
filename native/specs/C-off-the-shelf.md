# Off-the-shelf sync (Replicache, Zero, and the rest)

Question: can Folio use Replicache (or another shelf product) instead of PowerSync or homemade Changeset?

Answer: **No. Replicache would not give us the sync we want.** Neither would Zero, Instant, Electric, or Turso, without throwing away the native apps or the garden-offline promise.

The shelf is real. It is built for a different client.

## What Folio needs that a shelf product must hit

1. **Kotlin Compose on DC-1** and **SwiftUI on iPhone** — not a WebView, not React Native unless we rewrite the reader.
2. **Offline writes for days.** Mark a sentence in the garden with no radio. The mark is local. Wifi later drains it.
3. **Voice bytes** as files, not rows.
4. **Postgres we already have**, Better Auth, companion rows that clients cannot mutate.
5. Two devices, a five-person club. Not a live collab canvas.

If a product misses (1) or (2), it is not a candidate. Blobs (3) are never included; every engine says “object storage beside us.”

## Replicache

Rocicorp’s original sync engine. Open source, **maintenance mode**. Active work moved to Zero.

| | |
| --- | --- |
| Clients | Browser JavaScript. IndexedDB / KV. |
| Native Kotlin / Swift | None. A few teams stuffed it into React Native with a custom KV. That is not Compose or SwiftUI. |
| What you still write | **Push and pull HTTP endpoints.** Versioned mutations, a cookie, rebase. That *is* our v1, plus rebase we do not need. |
| Offline writes | Yes, in the tab that has IndexedDB. |
| Blobs | No. |
| Conflicts | Server-authoritative rebase. Fine for texty web apps. Overkill for LWW progress + union marks + append voices. |

Replicache’s famous trick — optimistic mutators that replay on a server cookie — is exactly the work Spec B reinvented, in a runtime the folio cannot run.

**It would not help.** Adopting it means rewriting the native readers as a web/RN app, then still writing the push/pull we already have, then still doing blobs ourselves.

## Zero (Replicache’s living product)

1.0 GA (March 2026). TypeScript. Postgres → `zero-cache` → client replica. Best DX on the web.

Fatal for Folio, in their own words:

> Zero does not support offline writes. When disconnected, reads from synced data continue to work, but **writes are rejected**.

Aaron Boodman (2025): they are not trying to be truly local-first; they are making high-quality **online** software. Offline is not the priority.

Also: native mobile is **not yet**. Official when-to-use: TypeScript/web. There is an Expo/RN demo (`zslack`); that is still JS, not the Kotlin/Swift trees.

A garden folio that records a voice with the radio off **cannot use Zero**. The write would error. That is the opposite of the product.

## The rest of the shelf

| Product | Native K+S | Days-offline writes | Postgres origin | Notes |
| --- | --- | --- | --- | --- |
| **ElectricSQL** | No first-class | Reads yes; writes are *your* API | Yes | A read stream. We would still own the outbox. Web-shaped. |
| **InstantDB** | React Native only | Yes | No — their backend | Files/presence built in. Adopting it abandons Neon and both native trees. |
| **Triplit** | JS | Yes | No | Acquired by Supabase. Same rewrite. |
| **PowerSync** | **Yes** | **Yes** | Yes | Only shelf product that actually sits on Kotlin + Swift + Postgres. Already killed in [A-review.md](./A-review.md): FIFO vs voice, alpha attachments, store rewrite before the gate. |
| **Turso / libSQL** | Swift + Android **preview**; last-push-wins | Local SQLite + `sync()` | **No** — SQLite in the cloud | Club sharing, companion rows, Better Auth, web PGLite all become a second origin. Kotlin “fully Kotlin support coming.” Blobs still separate. |
| **Ditto** | Yes | Yes, even mesh | No | Commercial field-team sync. A sledgehammer. |

The only off-the-shelf engine that speaks our languages **and** allows a week without radio is PowerSync (or Ditto, if we wanted to pay enterprise for a book club). We already decided PowerSync is a good engine for a different app.

## What Replicache *would* have given us, if we were a web app

- A drain loop with backoff.
- A cookie so pull is incremental.
- Rebase so two tabs don’t clobber.

We need (1) and (2). We do not need rebase. v1.1 in [VERDICT.md](./VERDICT.md) is that subset: blobs, tombstones, batch. No mutator framework, no `zero-cache`, no IndexedDB.

## One-line

Replicache is a browser KV with push/pull you write yourself, now frozen. Zero is its successor and **refuses offline writes**. Instant/Triplit want a JS client and their database. PowerSync is the only honest shelf fit and we already rejected it. Folio’s sync stays HTTP v1.1 on the stores we wrote.
