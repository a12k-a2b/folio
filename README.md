# Folio

An EPUB / HTML reader for the [Daylight Computer DC-1](https://daylightcomputer.com/) (10.5″, 4:3, 1184×1584) with an iPhone twin.

Read. Mark. Speak. A circle of friends can leave **voice notes on the same sentence** so you hear the feeling, not just the words.

Sister projects: [Gloss](https://github.com/a12k-a2b/gloss) (teacher’s margin) and [Peek](https://github.com/a12k-a2b/peek) (hold a link, don’t leave the page). Both live here as plugins.

## What it is

- **Matter-style marks** — two taps a word, three a sentence, four a paragraph; hold and drag for a span
- **Kindle-style** highlights, written notes, page bookmarks
- **Tags as you read** — Person, Place, Idea, Quote, Book, plus your own; auto-tag from the sentence
- **Alexander Circle** — Theo left voices on *Living Structure*. Tap a marked line, hear him, hold the mic and answer
- **Gloss plugin** — tap a word for a teacher’s note in the margin; *I know this* lifts the underline
- **Peek plugin** — hold a link, a sheet of the article slides in from the right; lift to go back, drag left to keep it
- **Gutenberg** — search the public stacks and shelve an EPUB
- **EPUB and HTML** upload
- **Page curl**, Instapaper / Matter-like type on paper
- **Thumb layout** for a 10.5″ portrait folio: page-turn and mic sit in the bottom corners
- **Sync** — HTTP v1.1: voice as a blob, deletes as tombstones, a batch that cannot stall. Sign in; marks, voice, tags, and the page you were on travel from the garden folio to the phone. PowerSync stays locked until both native apps keep a mark overnight.

Native sketches (Kotlin / Compose for DC-1, SwiftUI for iPhone) live under `android/`, `ios/`, and `native/`.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints. Toggle **Daylight DC-1** / **iPhone** at the top of the preview.

```bash
npm run typecheck
npm run build
```

## What to try

- Open **Alexander Circle** → *Living Structure*. Tap a marked sentence. Hear Theo. Hold the microphone to reply.
- Two taps / three taps / four taps / hold-drag on a sentence. Tags apply as you mark.
- Settings → **Gloss**. Dotted words get a teacher’s note.
- In *How to read a place*, hold **his name**, **Timeless Way**, or **courtyard**. Peek. Lift. Drag left to keep.
- Search Gutenberg on the shelf, or upload an EPUB / HTML file.

## Stack

React 19, TypeScript, Vite, TanStack Start, Tailwind v4, Zustand, Better Auth, Postgres / PGLite.

Keep the ink-on-paper rule: no color, hairline rules, serif for the passage. The reading surface lives in `src/components/folio/`. Bundled books live in `src/lib/folio/books/`.
