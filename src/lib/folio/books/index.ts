import type { Book } from "../types";
import { guide } from "./guide";
import { livingStructure } from "./living-structure";
import { meditations } from "./meditations";
import { bookOfTea } from "./tea";
import { walden } from "./walden";
import { vitruvius } from "./vitruvius";

export const BUNDLED_BOOKS: Book[] = [
  guide,
  livingStructure,
  meditations,
  bookOfTea,
  walden,
  vitruvius,
];

export function findBundled(id: string): Book | undefined {
  return BUNDLED_BOOKS.find((b) => b.id === id);
}

export function bookWordCount(book: Book): number {
  return book.chapters.reduce((n, ch) => {
    const text = ch.html.replace(/<[^>]+>/g, " ");
    return n + text.split(/\s+/).filter(Boolean).length;
  }, 0);
}
