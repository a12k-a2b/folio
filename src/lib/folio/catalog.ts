import { BUNDLED_BOOKS, bookWordCount } from "./books";
import type { Book } from "./types";

export type CatalogChapter = { id: string; title: string };

export type CatalogEntry = {
  id: string;
  title: string;
  author: string;
  year: string;
  description: string;
  coverLabel: string;
  source: "bundled";
  chapterCount: number;
  chapters: CatalogChapter[];
  wordCount: number;
};

export function catalogIndex(): CatalogEntry[] {
  return BUNDLED_BOOKS.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    year: b.year ?? "",
    description: b.description,
    coverLabel: b.coverLabel,
    source: "bundled" as const,
    chapterCount: b.chapters.length,
    chapters: b.chapters.map((c) => ({ id: c.id, title: c.title })),
    wordCount: bookWordCount(b),
  }));
}

export function catalogBook(id: string): Book | null {
  return BUNDLED_BOOKS.find((b) => b.id === id) ?? null;
}

export function catalogDump() {
  return {
    protocol: "folio-native/1",
    generatedAt: "static",
    books: catalogIndex(),
    full: Object.fromEntries(BUNDLED_BOOKS.map((b) => [b.id, b])),
  };
}
