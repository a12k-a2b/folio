/**
 * Dump bundled books to native/shared so Kotlin and Swift ship the same catalog.
 * Imports each book file with a .ts URL so Node can resolve them.
 */
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const booksDir = join(root, "src/lib/folio/books");

async function load(name) {
  const url = pathToFileURL(join(booksDir, name)).href;
  return import(url);
}

const [{ guide }, { livingStructure }, { meditations }, { bookOfTea }, { walden }, { vitruvius }] =
  await Promise.all([
    load("guide.ts"),
    load("living-structure.ts"),
    load("meditations.ts"),
    load("tea.ts"),
    load("walden.ts"),
    load("vitruvius.ts"),
  ]);

const BUNDLED_BOOKS = [guide, livingStructure, meditations, bookOfTea, walden, vitruvius];

function bookWordCount(book) {
  return book.chapters.reduce((n, ch) => {
    const text = ch.html.replace(/<[^>]+>/g, " ");
    return n + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}

const books = BUNDLED_BOOKS.map((b) => ({
  id: b.id,
  title: b.title,
  author: b.author,
  year: b.year ?? "",
  description: b.description,
  coverLabel: b.coverLabel,
  source: "bundled",
  chapterCount: b.chapters.length,
  chapters: b.chapters.map((c) => ({ id: c.id, title: c.title })),
  wordCount: bookWordCount(b),
}));
const full = Object.fromEntries(BUNDLED_BOOKS.map((b) => [b.id, b]));
const payload = {
  protocol: "folio-native/1",
  powersyncLocked: true,
  books,
  full,
};

const targets = [
  join(root, "native/shared/catalog.json"),
  join(root, "android/app/src/main/assets/catalog.json"),
  join(root, "ios/Folio/Resources/catalog.json"),
];

for (const t of targets) {
  mkdirSync(dirname(t), { recursive: true });
  writeFileSync(t, JSON.stringify(payload));
}

const voicesSrc = join(root, "public/voices");
const voiceFiles = ["theo-feeling.mp3", "theo-heat.mp3", "theo-missing.mp3", "theo-pretty.mp3"];
const voiceDests = [
  join(root, "android/app/src/main/assets/voices"),
  join(root, "ios/Folio/Resources/voices"),
  join(root, "native/shared/voices"),
];
for (const dest of voiceDests) {
  mkdirSync(dest, { recursive: true });
  for (const f of voiceFiles) {
    const src = join(voicesSrc, f);
    if (existsSync(src)) copyFileSync(src, join(dest, f));
  }
}

console.log(
  JSON.stringify({
    books: books.length,
    bytes: JSON.stringify(payload).length,
    ids: books.map((b) => b.id),
  }),
);
