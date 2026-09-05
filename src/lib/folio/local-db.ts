import { BUNDLED_BOOKS } from "./books";
import {
  ALEXANDER_BOOK,
  THEO_ID,
  THEO_NAME,
  THEO_NOTES,
  chapterHtml,
  findQuote,
  inviteCode,
} from "./club-seed";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TAGS,
  type Book,
  type Bookmark,
  type Club,
  type ClubMember,
  type FolioSettings,
  type Highlight,
  type LibraryItem,
  type Progress,
  type Tag,
  type VoiceNote,
} from "./types";

const KEY = "folio.v2";

type DB = {
  books: LibraryItem[];
  content: Record<string, Book["chapters"]>;
  progress: Progress[];
  settings: FolioSettings;
  tags: Tag[];
  highlights: Highlight[];
  bookmarks: Bookmark[];
  voices: VoiceNote[];
  clubs: Club[];
  members: ClubMemberRow[];
};

type ClubMemberRow = ClubMember & { clubId: string };

function uid() {
  return crypto.randomUUID();
}

function emptyHighlight(h: Omit<Highlight, "tagIds" | "note" | "createdAt"> & { note?: string }): Highlight {
  return {
    ...h,
    note: h.note ?? "",
    tagIds: [],
    createdAt: new Date().toISOString(),
  };
}

function seedAlexanderClub(db: DB) {
  let club = db.clubs.find((c) => c.bookId === ALEXANDER_BOOK);
  if (!club) {
    const clubId = uid();
    club = {
      id: clubId,
      bookId: ALEXANDER_BOOK,
      name: "Alexander Circle",
      inviteCode: inviteCode(),
      createdBy: "local",
      members: [],
    };
    db.clubs.push(club);
    db.members.push(
      { clubId, userId: "local", displayName: "You", role: "owner" },
      { clubId, userId: THEO_ID, displayName: THEO_NAME, role: "companion" },
    );
  }
  for (const note of THEO_NOTES) {
    const html = chapterHtml(note.chapterId);
    const span = findQuote(html, note.quote);
    if (!span) continue;
    const hid = `theo-hl-${note.key}`;
    const existing = db.highlights.find((h) => h.id === hid);
    if (existing) {
      existing.startOffset = span.start;
      existing.endOffset = span.end;
      existing.text = note.quote;
      existing.clubId = club.id;
    } else {
      db.highlights.push(
        emptyHighlight({
          id: hid,
          bookId: ALEXANDER_BOOK,
          chapterId: note.chapterId,
          startOffset: span.start,
          endOffset: span.end,
          text: note.quote,
          authorId: THEO_ID,
          authorName: THEO_NAME,
          clubId: club.id,
          isCompanion: true,
        }),
      );
    }
    if (!db.voices.some((v) => v.id === `theo-v-${note.key}`)) {
      db.voices.push({
        id: `theo-v-${note.key}`,
        highlightId: hid,
        transcript: note.transcript,
        audioB64: "",
        audioUrl: note.audioUrl,
        mime: "audio/mpeg",
        durationMs: note.durationMs,
        createdAt: new Date().toISOString(),
        authorId: THEO_ID,
        authorName: THEO_NAME,
        replyTo: null,
        clubId: club.id,
        isCompanion: true,
      });
    }
  }
}

function empty(): DB {
  const db: DB = {
    books: BUNDLED_BOOKS.map((b) => ({
      id: b.id,
      bookId: b.id,
      source: b.source,
      title: b.title,
      author: b.author,
      description: b.description,
      coverLabel: b.coverLabel,
      addedAt: new Date().toISOString(),
    })),
    content: {},
    progress: [],
    settings: { ...DEFAULT_SETTINGS },
    tags: DEFAULT_TAGS.map((t) => ({ id: uid(), ...t })),
    highlights: [],
    bookmarks: [],
    voices: [],
    clubs: [],
    members: [],
  };
  seedAlexanderClub(db);
  return db;
}

function migrate(parsed: Partial<DB>): DB {
  const db: DB = {
    books: parsed.books?.length ? parsed.books : empty().books,
    content: parsed.content ?? {},
    progress: parsed.progress ?? [],
    settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    tags: parsed.tags ?? [],
    highlights: (parsed.highlights ?? []).map((h) => ({
      ...h,
      authorId: h.authorId ?? "local",
      authorName: h.authorName ?? "You",
      clubId: h.clubId ?? null,
      isCompanion: h.isCompanion ?? false,
    })),
    bookmarks: parsed.bookmarks ?? [],
    voices: (parsed.voices ?? []).map((v) => ({
      ...v,
      audioUrl: v.audioUrl ?? "",
      authorId: v.authorId ?? "local",
      authorName: v.authorName ?? "You",
      replyTo: v.replyTo ?? null,
      clubId: v.clubId ?? null,
      isCompanion: v.isCompanion ?? false,
    })),
    clubs: parsed.clubs ?? [],
    members: parsed.members ?? [],
  };
  seedAlexanderClub(db);
  return db;
}

function read(): DB {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("folio.v1");
    if (!raw) {
      const db = empty();
      localStorage.setItem(KEY, JSON.stringify(db));
      return db;
    }
    const db = migrate(JSON.parse(raw) as Partial<DB>);
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  } catch {
    return empty();
  }
}

function write(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

function clubForBook(db: DB, bookId: string, userId = "local"): Club | null {
  const memberships = db.members.filter((m) => m.userId === userId || m.userId === THEO_ID);
  const club = db.clubs.find((c) => c.bookId === bookId && memberships.some((m) => m.clubId === c.id));
  if (!club) return null;
  return {
    ...club,
    members: db.members.filter((m) => m.clubId === club.id).map(({ clubId: _c, ...rest }) => rest),
  };
}

export const localApi = {
  loadLibrary() {
    const db = read();
    return {
      books: db.books,
      progress: db.progress,
      settings: db.settings,
      clubs: db.clubs.map((c) => ({
        ...c,
        members: db.members.filter((m) => m.clubId === c.id).map(({ clubId: _c, ...rest }) => rest),
      })),
    };
  },
  loadBook(bookId: string) {
    const db = read();
    const bundled = BUNDLED_BOOKS.find((b) => b.id === bookId);
    const meta = db.books.find((b) => b.bookId === bookId);
    let book: Book | null = bundled ?? null;
    if (!book && meta && db.content[bookId]) {
      book = {
        id: bookId,
        title: meta.title,
        author: meta.author,
        description: meta.description,
        coverLabel: meta.coverLabel,
        source: meta.source,
        chapters: db.content[bookId] ?? [],
      };
    }
    const club = clubForBook(db, bookId);
    const clubId = club?.id ?? null;
    return {
      book,
      highlights: db.highlights.filter(
        (h) => h.bookId === bookId && (h.authorId === "local" || (clubId && h.clubId === clubId)),
      ),
      bookmarks: db.bookmarks.filter((b) => b.bookId === bookId),
      tags: db.tags,
      voices: db.voices.filter((v) =>
        db.highlights.some(
          (h) =>
            h.id === v.highlightId &&
            h.bookId === bookId &&
            (h.authorId === "local" || (clubId && h.clubId === clubId)),
        ),
      ),
      club,
    };
  },
  saveProgress(p: Progress) {
    const db = read();
    db.progress = db.progress.filter((x) => x.bookId !== p.bookId);
    db.progress.push(p);
    write(db);
  },
  saveSettings(s: FolioSettings) {
    const db = read();
    db.settings = s;
    write(db);
  },
  addHighlight(h: {
    bookId: string;
    chapterId: string;
    startOffset: number;
    endOffset: number;
    text: string;
    authorName?: string;
  }) {
    const db = read();
    const club = clubForBook(db, h.bookId);
    const row: Highlight = {
      id: uid(),
      bookId: h.bookId,
      chapterId: h.chapterId,
      startOffset: h.startOffset,
      endOffset: h.endOffset,
      text: h.text,
      note: "",
      tagIds: [],
      createdAt: new Date().toISOString(),
      authorId: "local",
      authorName: h.authorName ?? "You",
      clubId: club?.id ?? null,
      isCompanion: false,
    };
    db.highlights.push(row);
    write(db);
    return { id: row.id, clubId: row.clubId };
  },
  updateHighlight(h: { id: string; note?: string; tagIds?: string[] }) {
    const db = read();
    db.highlights = db.highlights.map((x) =>
      x.id === h.id ? { ...x, note: h.note ?? x.note, tagIds: h.tagIds ?? x.tagIds } : x,
    );
    write(db);
  },
  deleteHighlight(id: string) {
    const db = read();
    db.highlights = db.highlights.filter((h) => h.id !== id || h.isCompanion);
    db.voices = db.voices.filter((v) => v.highlightId !== id || v.isCompanion);
    write(db);
  },
  addBookmark(b: Omit<Bookmark, "id" | "createdAt">) {
    const db = read();
    const row: Bookmark = { ...b, id: uid(), createdAt: new Date().toISOString() };
    db.bookmarks.unshift(row);
    write(db);
    return { id: row.id };
  },
  deleteBookmark(id: string) {
    const db = read();
    db.bookmarks = db.bookmarks.filter((b) => b.id !== id);
    write(db);
  },
  addTag(t: Omit<Tag, "id">) {
    const db = read();
    const row: Tag = { ...t, id: uid() };
    db.tags.push(row);
    write(db);
    return { id: row.id };
  },
  deleteTag(id: string) {
    const db = read();
    db.tags = db.tags.filter((t) => t.id !== id);
    db.highlights = db.highlights.map((h) => ({ ...h, tagIds: h.tagIds.filter((x) => x !== id) }));
    write(db);
  },
  saveVoice(v: {
    highlightId: string;
    transcript: string;
    audioB64: string;
    mime: string;
    durationMs: number;
    authorName?: string;
    replyTo?: string | null;
  }) {
    const db = read();
    const hl = db.highlights.find((h) => h.id === v.highlightId);
    const row: VoiceNote = {
      id: uid(),
      highlightId: v.highlightId,
      transcript: v.transcript,
      audioB64: v.audioB64,
      audioUrl: "",
      mime: v.mime,
      durationMs: v.durationMs,
      createdAt: new Date().toISOString(),
      authorId: "local",
      authorName: v.authorName ?? "You",
      replyTo: v.replyTo ?? null,
      clubId: hl?.clubId ?? null,
      isCompanion: false,
    };
    db.voices.push(row);
    write(db);
    return { id: row.id };
  },
  loadAllMarks() {
    const db = read();
    return {
      highlights: [...db.highlights].reverse(),
      tags: db.tags,
      voicedIds: db.voices.map((v) => v.highlightId),
    };
  },
  importBook(book: Book) {
    const db = read();
    if (!db.books.some((b) => b.bookId === book.id)) {
      db.books.push({
        id: book.id,
        bookId: book.id,
        source: book.source,
        title: book.title,
        author: book.author,
        description: book.description,
        coverLabel: book.coverLabel,
        addedAt: new Date().toISOString(),
      });
    }
    db.content[book.id] = book.chapters;
    write(db);
    return { bookId: book.id };
  },
  createClub(bookId: string, name: string, displayName: string) {
    const db = read();
    const existing = db.clubs.find((c) => c.bookId === bookId);
    if (existing) return existing;
    const id = uid();
    const club: Club = {
      id,
      bookId,
      name,
      inviteCode: inviteCode(),
      createdBy: "local",
      members: [],
    };
    db.clubs.push(club);
    db.members.push({ clubId: id, userId: "local", displayName, role: "owner" });
    write(db);
    return { ...club, members: [{ userId: "local", displayName, role: "owner" as const }] };
  },
  joinClub(code: string, displayName: string) {
    const db = read();
    const club = db.clubs.find((c) => c.inviteCode.toUpperCase() === code.trim().toUpperCase());
    if (!club) return { ok: false as const, error: "No circle with that code", clubId: "", bookId: "" };
    if (!db.members.some((m) => m.clubId === club.id && m.userId === "local")) {
      db.members.push({ clubId: club.id, userId: "local", displayName, role: "member" });
    }
    if (!db.books.some((b) => b.bookId === club.bookId)) {
      const bundled = BUNDLED_BOOKS.find((b) => b.id === club.bookId);
      if (bundled) {
        db.books.push({
          id: bundled.id,
          bookId: bundled.id,
          source: bundled.source,
          title: bundled.title,
          author: bundled.author,
          description: bundled.description,
          coverLabel: bundled.coverLabel,
          addedAt: new Date().toISOString(),
        });
      }
    }
    write(db);
    return { ok: true as const, error: "", clubId: club.id, bookId: club.bookId };
  },
};
