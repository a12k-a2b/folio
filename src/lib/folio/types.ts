export const DC_WIDTH = 1184;
export const DC_HEIGHT = 1584;
export const PHONE_WIDTH = 390;
export const PHONE_HEIGHT = 844;

export type DeviceMode = "dc1" | "phone";
export type PageAnim = "curl" | "slide" | "none";
export type SourceKind = "bundled" | "gutenberg" | "upload" | "plugin";
export type TagKind =
  | "person"
  | "place"
  | "idea"
  | "quote"
  | "book"
  | "question"
  | "term"
  | "custom";

export type Chapter = {
  id: string;
  title: string;
  html: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  year?: string;
  description: string;
  coverLabel: string;
  source: SourceKind;
  chapters: Chapter[];
};

export type LibraryItem = {
  id: string;
  bookId: string;
  source: SourceKind;
  title: string;
  author: string;
  description: string;
  coverLabel: string;
  addedAt: string;
};

export type Progress = {
  bookId: string;
  chapterIndex: number;
  pageIndex: number;
  percent: number;
  locator: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  emoji: string;
  kind: TagKind;
};

export type Highlight = {
  id: string;
  bookId: string;
  chapterId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  note: string;
  createdAt: string;
  tagIds: string[];
  authorId: string;
  authorName: string;
  clubId: string | null;
  isCompanion: boolean;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type Bookmark = {
  id: string;
  bookId: string;
  chapterIndex: number;
  pageIndex: number;
  label: string;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string | null;
};

export type VoiceNote = {
  id: string;
  highlightId: string;
  transcript: string;
  audioB64: string;
  audioUrl: string;
  mime: string;
  durationMs: number;
  createdAt: string;
  authorId: string;
  authorName: string;
  replyTo: string | null;
  clubId: string | null;
  isCompanion: boolean;
  updatedAt?: string;
  deletedAt?: string | null;
  sha256?: string;
  byteLength?: number;
};

export type Tombstone = {
  table: "highlights" | "bookmarks" | "voices" | "tags";
  id: string;
  deletedAt: string;
  updatedAt: string;
};

export type ClubMember = {
  userId: string;
  displayName: string;
  role: "owner" | "member" | "companion";
};

export type Club = {
  id: string;
  bookId: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  members: ClubMember[];
};

export type FolioSettings = {
  typeScale: 0 | 1 | 2 | 3;
  leading: "tight" | "normal" | "loose";
  measure: "narrow" | "book" | "wide";
  justify: boolean;
  pageAnim: PageAnim;
  gloss: boolean;
  linkSlide: boolean;
  device: DeviceMode | "auto";
};

export const DEFAULT_SETTINGS: FolioSettings = {
  typeScale: 1,
  leading: "normal",
  measure: "book",
  justify: true,
  pageAnim: "curl",
  gloss: false,
  linkSlide: true,
  device: "auto",
};

export const TYPE_PX = [20, 23, 26, 30] as const;
export const LEADING = { tight: 1.42, normal: 1.62, loose: 1.82 } as const;
export const MEASURE_EM = { narrow: 28, book: 34, wide: 40 } as const;

export const DEFAULT_TAGS: { name: string; emoji: string; kind: TagKind }[] = [
  { name: "Person", emoji: "👤", kind: "person" },
  { name: "Place", emoji: "📍", kind: "place" },
  { name: "Idea", emoji: "✦", kind: "idea" },
  { name: "Quote", emoji: "❝", kind: "quote" },
  { name: "Book", emoji: "▣", kind: "book" },
  { name: "Question", emoji: "?", kind: "question" },
  { name: "Term", emoji: "※", kind: "term" },
];
