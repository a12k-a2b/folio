import { parseEpub, parseHtmlDocument } from "./epub";
import { localApi } from "./local-db";
import {
  addBookmark as sAddBookmark,
  addHighlight as sAddHighlight,
  addTag as sAddTag,
  bootstrapFolio,
  createClub as sCreateClub,
  deleteBookmark as sDeleteBookmark,
  deleteHighlight as sDeleteHighlight,
  deleteTag as sDeleteTag,
  importEpub,
  importGutenberg,
  importHtml as sImportHtml,
  joinClub as sJoinClub,
  loadAllMarks as sLoadAllMarks,
  loadBook as sLoadBook,
  loadLibrary,
  parseRemoteEpub,
  saveProgress as sSaveProgress,
  saveSettings as sSaveSettings,
  saveVoiceNote as sSaveVoice,
  searchGutenberg,
  suggestClusters,
  suggestTagsForText,
  transcribeAudio,
  peekArticle,
  defineWord,
  updateHighlight as sUpdateHighlight,
} from "./server";
import { folioAuthed } from "./session-mode";
import type { Book, FolioSettings, Progress, Tag } from "./types";

export { searchGutenberg, suggestClusters, suggestTagsForText, transcribeAudio, peekArticle, defineWord };
export type { GutenbergHit } from "./server";

export async function apiBootstrap() {
  if (folioAuthed) await bootstrapFolio();
}

export async function apiLoadLibrary() {
  if (folioAuthed) return loadLibrary();
  return localApi.loadLibrary();
}

export async function apiLoadBook(bookId: string) {
  if (folioAuthed) return sLoadBook({ data: bookId });
  return localApi.loadBook(bookId);
}

export async function apiSaveProgress(p: Progress) {
  if (folioAuthed) return sSaveProgress({ data: p });
  localApi.saveProgress(p);
}

export async function apiSaveSettings(s: FolioSettings) {
  if (folioAuthed) return sSaveSettings({ data: s });
  localApi.saveSettings(s);
}

export async function apiAddHighlight(h: {
  bookId: string;
  chapterId: string;
  startOffset: number;
  endOffset: number;
  text: string;
  authorName?: string;
}) {
  if (folioAuthed) return sAddHighlight({ data: h });
  return localApi.addHighlight(h);
}

export async function apiUpdateHighlight(h: { id: string; note?: string; tagIds?: string[] }) {
  if (folioAuthed) return sUpdateHighlight({ data: h });
  localApi.updateHighlight(h);
}

export async function apiDeleteHighlight(id: string) {
  if (folioAuthed) return sDeleteHighlight({ data: id });
  localApi.deleteHighlight(id);
}

export async function apiAddBookmark(b: {
  bookId: string;
  chapterIndex: number;
  pageIndex: number;
  label: string;
}) {
  if (folioAuthed) return sAddBookmark({ data: b });
  return localApi.addBookmark(b);
}

export async function apiDeleteBookmark(id: string) {
  if (folioAuthed) return sDeleteBookmark({ data: id });
  localApi.deleteBookmark(id);
}

export async function apiAddTag(t: { name: string; emoji: string; kind: Tag["kind"] }) {
  if (folioAuthed) return sAddTag({ data: t });
  return localApi.addTag(t);
}

export async function apiDeleteTag(id: string) {
  if (folioAuthed) return sDeleteTag({ data: id });
  localApi.deleteTag(id);
}

export async function apiSaveVoice(v: {
  highlightId: string;
  transcript: string;
  audioB64: string;
  mime: string;
  durationMs: number;
  authorName?: string;
  replyTo?: string | null;
}) {
  if (folioAuthed) return sSaveVoice({ data: v });
  return localApi.saveVoice(v);
}

export async function apiLoadAllMarks() {
  if (folioAuthed) return sLoadAllMarks();
  return localApi.loadAllMarks();
}

export async function apiImportGutenberg(v: {
  id: number;
  title: string;
  authors: string;
  epubUrl: string;
}) {
  if (folioAuthed) return importGutenberg({ data: v });
  const book = await parseRemoteEpub({
    data: { url: v.epubUrl, title: v.title, authors: v.authors, id: v.id },
  });
  return localApi.importBook(book);
}

export async function apiImportEpubFile(file: File) {
  const buf = await file.arrayBuffer();
  if (folioAuthed) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return importEpub({ data: { filename: file.name, b64: btoa(binary) } });
  }
  const book: Book = await parseEpub(buf, file.name);
  return localApi.importBook(book);
}

export async function apiImportHtmlFile(file: File) {
  const text = await file.text();
  if (folioAuthed) return sImportHtml({ data: { filename: file.name, text } });
  const book = parseHtmlDocument(text, file.name);
  return localApi.importBook(book);
}

export async function apiCreateClub(v: { bookId: string; name: string; displayName: string }) {
  if (folioAuthed) return sCreateClub({ data: v });
  return localApi.createClub(v.bookId, v.name, v.displayName);
}

export async function apiJoinClub(v: { code: string; displayName: string }) {
  if (folioAuthed) return sJoinClub({ data: v });
  return localApi.joinClub(v.code, v.displayName);
}
