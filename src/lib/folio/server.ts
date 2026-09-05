import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
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
import { parseEpub, parseHtmlDocument } from "./epub";
import { fetchPeekArticle } from "./peek-article";
import {
  DEFAULT_SETTINGS,
  DEFAULT_TAGS,
  type Book,
  type Bookmark,
  type Club,
  type FolioSettings,
  type Highlight,
  type LibraryItem,
  type Progress,
  type Tag,
  type VoiceNote,
} from "./types";

function id() {
  return crypto.randomUUID();
}

type HighlightRow = {
  id: string;
  user_id: string;
  book_id: string;
  chapter_id: string;
  start_offset: number;
  end_offset: number;
  text: string;
  note: string;
  created_at: string;
  author_name: string | null;
  club_id: string | null;
  is_companion: boolean | null;
};

function mapHighlight(row: HighlightRow, tagIds: string[]): Highlight {
  return {
    id: row.id,
    bookId: row.book_id,
    chapterId: row.chapter_id,
    startOffset: Number(row.start_offset),
    endOffset: Number(row.end_offset),
    text: row.text,
    note: row.note,
    createdAt: String(row.created_at),
    tagIds,
    authorId: row.user_id,
    authorName: row.author_name || (row.is_companion ? THEO_NAME : "You"),
    clubId: row.club_id,
    isCompanion: Boolean(row.is_companion),
  };
}

async function ensureAlexanderClub(
  sql: Awaited<ReturnType<typeof getSql>>,
  uid: string,
  displayName: string,
) {
  const existing = await sql<{ id: string }>`
    select c.id from folio_clubs c
    join folio_club_members m on m.club_id = c.id
    where m.user_id = ${uid} and c.book_id = ${ALEXANDER_BOOK}
    limit 1`;
  let clubId = existing[0]?.id;
  if (!clubId) {
    clubId = id();
    const code = inviteCode();
    await sql`insert into folio_clubs (id, book_id, name, invite_code, created_by)
      values (${clubId}, ${ALEXANDER_BOOK}, ${"Alexander Circle"}, ${code}, ${uid})`;
    await sql`insert into folio_club_members (club_id, user_id, display_name, role)
      values (${clubId}, ${uid}, ${displayName || "You"}, ${"owner"})
      on conflict do nothing`;
    await sql`insert into folio_club_members (club_id, user_id, display_name, role)
      values (${clubId}, ${THEO_ID}, ${THEO_NAME}, ${"companion"})
      on conflict do nothing`;
  }
  for (const note of THEO_NOTES) {
    const html = chapterHtml(note.chapterId);
    const span = findQuote(html, note.quote);
    if (!span) continue;
    const hid = `theo-hl-${note.key}-${clubId.slice(0, 8)}`;
    await sql`insert into folio_highlights (id, user_id, book_id, chapter_id, start_offset, end_offset, text, author_name, club_id, is_companion)
      values (${hid}, ${THEO_ID}, ${ALEXANDER_BOOK}, ${note.chapterId}, ${span.start}, ${span.end}, ${note.quote}, ${THEO_NAME}, ${clubId}, ${true})
      on conflict (id) do update set start_offset = excluded.start_offset, end_offset = excluded.end_offset, text = excluded.text`;
    const vid = `theo-v-${note.key}-${clubId.slice(0, 8)}`;
    await sql`insert into folio_voice_notes (id, user_id, highlight_id, transcript, audio_b64, mime, duration_ms, author_name, audio_url, is_companion, club_id)
      values (${vid}, ${THEO_ID}, ${hid}, ${note.transcript}, ${""}, ${"audio/mpeg"}, ${note.durationMs}, ${THEO_NAME}, ${note.audioUrl}, ${true}, ${clubId})
      on conflict (id) do nothing`;
  }
  return clubId;
}

async function ensureFolioUser(
  sql: Awaited<ReturnType<typeof getSql>>,
  uid: string,
  displayName: string,
) {
  const existing = await sql<{ n: number }>`select count(*)::int as n from folio_library where user_id = ${uid}`;
  if ((existing[0]?.n ?? 0) === 0) {
    for (const b of BUNDLED_BOOKS) {
      await sql`insert into folio_library (id, user_id, book_id, source, title, author, description, cover_label)
        values (${id()}, ${uid}, ${b.id}, ${"bundled"}, ${b.title}, ${b.author}, ${b.description}, ${b.coverLabel})`;
    }
  }
  const tags = await sql<{ n: number }>`select count(*)::int as n from folio_tags where user_id = ${uid}`;
  if ((tags[0]?.n ?? 0) === 0) {
    for (const t of DEFAULT_TAGS) {
      await sql`insert into folio_tags (id, user_id, name, emoji, kind) values (${id()}, ${uid}, ${t.name}, ${t.emoji}, ${t.kind})`;
    }
  }
  const settings = await sql<{ n: number }>`select count(*)::int as n from folio_settings where user_id = ${uid}`;
  if ((settings[0]?.n ?? 0) === 0) {
    await sql`insert into folio_settings (user_id, json) values (${uid}, ${JSON.stringify(DEFAULT_SETTINGS)})`;
  }
  await ensureAlexanderClub(sql, uid, displayName || "You");
}

export { ensureFolioUser };

export const bootstrapFolio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await ensureFolioUser(sql, context.userId, "You");
    return { ok: true as const };
  });

export const loadLibrary = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const uid = context.userId;
    const books = await sql<{
      id: string;
      book_id: string;
      source: LibraryItem["source"];
      title: string;
      author: string;
      description: string;
      cover_label: string;
      added_at: string;
    }>`select id, book_id, source, title, author, description, cover_label, added_at from folio_library where user_id = ${uid} order by added_at asc`;
    const progress = await sql<{
      book_id: string;
      chapter_index: number;
      page_index: number;
      percent: number;
      locator: string;
      updated_at: string;
    }>`select book_id, chapter_index, page_index, percent, locator, updated_at from folio_progress where user_id = ${uid}`;
    const settingsRows = await sql<{ json: string }>`select json from folio_settings where user_id = ${uid}`;
    let settings: FolioSettings = DEFAULT_SETTINGS;
    try {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRows[0]?.json ?? "{}") };
    } catch {
      settings = DEFAULT_SETTINGS;
    }
    const clubRows = await sql<{
      id: string;
      book_id: string;
      name: string;
      invite_code: string;
      created_by: string;
    }>`select c.id, c.book_id, c.name, c.invite_code, c.created_by
       from folio_clubs c
       join folio_club_members m on m.club_id = c.id
       where m.user_id = ${uid}`;
    const memberRows = await sql<{
      club_id: string;
      user_id: string;
      display_name: string;
      role: Club["members"][number]["role"];
    }>`select m.club_id, m.user_id, m.display_name, m.role
       from folio_club_members m
       where m.club_id in (
         select c.id from folio_clubs c
         join folio_club_members me on me.club_id = c.id
         where me.user_id = ${uid}
       )`;
    const clubs: Club[] = clubRows.map((c) => ({
      id: c.id,
      bookId: c.book_id,
      name: c.name,
      inviteCode: c.invite_code,
      createdBy: c.created_by,
      members: memberRows
        .filter((m) => m.club_id === c.id)
        .map((m) => ({ userId: m.user_id, displayName: m.display_name, role: m.role })),
    }));
    return {
      books: books.map(
        (b): LibraryItem => ({
          id: b.id,
          bookId: b.book_id,
          source: b.source,
          title: b.title,
          author: b.author,
          description: b.description,
          coverLabel: b.cover_label,
          addedAt: String(b.added_at),
        }),
      ),
      progress: progress.map(
        (p): Progress => ({
          bookId: p.book_id,
          chapterIndex: Number(p.chapter_index),
          pageIndex: Number(p.page_index),
          percent: Number(p.percent),
          locator: p.locator,
          updatedAt: String(p.updated_at),
        }),
      ),
      settings,
      clubs,
    };
  });

export async function fetchBookBundle(uid: string, bookId: string) {
    const sql = await getSql();
    const bundled = BUNDLED_BOOKS.find((b) => b.id === bookId);
    let book: Book | null = bundled ?? null;
    if (!book) {
      const rows = await sql<{ chapters_json: string; title: string; author: string; description: string; cover_label: string; source: Book["source"] }>`
        select c.chapters_json, l.title, l.author, l.description, l.cover_label, l.source
        from folio_book_content c
        join folio_library l on l.book_id = c.book_id and l.user_id = c.user_id
        where c.user_id = ${uid} and c.book_id = ${bookId}`;
      const row = rows[0];
      if (row) {
        book = {
          id: bookId,
          title: row.title,
          author: row.author,
          description: row.description,
          coverLabel: row.cover_label,
          source: row.source,
          chapters: JSON.parse(row.chapters_json) as Book["chapters"],
        };
      }
    }
    if (!book)
      return {
        book: null,
        highlights: [] as Highlight[],
        bookmarks: [] as Bookmark[],
        tags: [] as Tag[],
        voices: [] as VoiceNote[],
        club: null as Club | null,
      };

    const clubRows = await sql<{
      id: string;
      book_id: string;
      name: string;
      invite_code: string;
      created_by: string;
    }>`select c.id, c.book_id, c.name, c.invite_code, c.created_by
       from folio_clubs c
       join folio_club_members m on m.club_id = c.id
       where m.user_id = ${uid} and c.book_id = ${bookId}
       limit 1`;
    const clubRow = clubRows[0] ?? null;
    let club: Club | null = null;
    if (clubRow) {
      const members = await sql<{
        user_id: string;
        display_name: string;
        role: Club["members"][number]["role"];
      }>`select user_id, display_name, role from folio_club_members where club_id = ${clubRow.id}`;
      club = {
        id: clubRow.id,
        bookId: clubRow.book_id,
        name: clubRow.name,
        inviteCode: clubRow.invite_code,
        createdBy: clubRow.created_by,
        members: members.map((m) => ({
          userId: m.user_id,
          displayName: m.display_name,
          role: m.role,
        })),
      };
    }

    const hl = await sql<HighlightRow>`
      select id, user_id, book_id, chapter_id, start_offset, end_offset, text, note, created_at,
             coalesce(author_name, '') as author_name, club_id, coalesce(is_companion, false) as is_companion
      from folio_highlights
      where book_id = ${bookId}
        and (user_id = ${uid} or club_id in (
          select c.id from folio_clubs c
          join folio_club_members m on m.club_id = c.id
          where m.user_id = ${uid} and c.book_id = ${bookId}
        ))
      order by created_at asc`;
    const tagMap = new Map<string, string[]>();
    const hlLinks = await sql<{ highlight_id: string; tag_id: string }>`
      select ht.highlight_id, ht.tag_id
      from folio_highlight_tags ht
      join folio_highlights h on h.id = ht.highlight_id
      where h.user_id = ${uid} and h.book_id = ${bookId}`;
    for (const l of hlLinks) {
      const arr = tagMap.get(l.highlight_id) ?? [];
      arr.push(l.tag_id);
      tagMap.set(l.highlight_id, arr);
    }
    const bookmarks = await sql<{
      id: string;
      book_id: string;
      chapter_index: number;
      page_index: number;
      label: string;
      created_at: string;
    }>`select id, book_id, chapter_index, page_index, label, created_at from folio_bookmarks where user_id = ${uid} and book_id = ${bookId} order by created_at desc`;
    const tags = await sql<{ id: string; name: string; emoji: string; kind: Tag["kind"] }>`
      select id, name, emoji, kind from folio_tags where user_id = ${uid} order by created_at asc`;
    const voices = await sql<{
      id: string;
      user_id: string;
      highlight_id: string;
      transcript: string;
      audio_b64: string;
      mime: string;
      duration_ms: number;
      created_at: string;
      author_name: string | null;
      audio_url: string | null;
      reply_to: string | null;
      club_id: string | null;
      is_companion: boolean | null;
    }>`select v.id, v.user_id, v.highlight_id, v.transcript, v.audio_b64, v.mime, v.duration_ms, v.created_at,
              coalesce(v.author_name, '') as author_name, coalesce(v.audio_url, '') as audio_url, v.reply_to, v.club_id,
              coalesce(v.is_companion, false) as is_companion
       from folio_voice_notes v
       join folio_highlights h on h.id = v.highlight_id
       where h.book_id = ${bookId}
         and (v.user_id = ${uid} or v.club_id in (
           select c.id from folio_clubs c
           join folio_club_members m on m.club_id = c.id
           where m.user_id = ${uid} and c.book_id = ${bookId}
         ))`;
    return {
      book,
      highlights: hl.map((h) => mapHighlight(h, tagMap.get(h.id) ?? [])),
      bookmarks: bookmarks.map(
        (b): Bookmark => ({
          id: b.id,
          bookId: b.book_id,
          chapterIndex: Number(b.chapter_index),
          pageIndex: Number(b.page_index),
          label: b.label,
          createdAt: String(b.created_at),
        }),
      ),
      tags: tags.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, kind: t.kind })),
      voices: voices.map(
        (v): VoiceNote => ({
          id: v.id,
          highlightId: v.highlight_id,
          transcript: v.transcript,
          audioB64: v.audio_b64,
          audioUrl: v.audio_url ?? "",
          mime: v.mime,
          durationMs: Number(v.duration_ms),
          createdAt: String(v.created_at),
          authorId: v.user_id,
          authorName: v.author_name || (v.is_companion ? THEO_NAME : "You"),
          replyTo: v.reply_to,
          clubId: v.club_id,
          isCompanion: Boolean(v.is_companion),
        }),
      ),
      club,
    };
}

export const loadBook = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((bookId: string) => bookId)
  .handler(async ({ context, data: bookId }) => fetchBookBundle(context.userId, bookId));

export const saveProgress = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: Progress) => p)
  .handler(async ({ context, data: p }) => {
    const sql = await getSql();
    await sql`insert into folio_progress (user_id, book_id, chapter_index, page_index, percent, locator, updated_at)
      values (${context.userId}, ${p.bookId}, ${p.chapterIndex}, ${p.pageIndex}, ${p.percent}, ${p.locator}, now())
      on conflict (user_id, book_id) do update set
        chapter_index = excluded.chapter_index,
        page_index = excluded.page_index,
        percent = excluded.percent,
        locator = excluded.locator,
        updated_at = now()`;
    return { ok: true as const };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((s: FolioSettings) => s)
  .handler(async ({ context, data: s }) => {
    const sql = await getSql();
    await sql`insert into folio_settings (user_id, json) values (${context.userId}, ${JSON.stringify(s)})
      on conflict (user_id) do update set json = excluded.json`;
    return { ok: true as const };
  });

export const addHighlight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (h: {
      bookId: string;
      chapterId: string;
      startOffset: number;
      endOffset: number;
      text: string;
      authorName?: string;
    }) => h,
  )
  .handler(async ({ context, data: h }) => {
    const sql = await getSql();
    const hid = id();
    const clubs = await sql<{ id: string }>`
      select c.id from folio_clubs c
      join folio_club_members m on m.club_id = c.id
      where m.user_id = ${context.userId} and c.book_id = ${h.bookId}
      limit 1`;
    const clubId = clubs[0]?.id ?? null;
    const authorName = (h.authorName || "You").slice(0, 40);
    await sql`insert into folio_highlights (id, user_id, book_id, chapter_id, start_offset, end_offset, text, author_name, club_id, is_companion)
      values (${hid}, ${context.userId}, ${h.bookId}, ${h.chapterId}, ${h.startOffset}, ${h.endOffset}, ${h.text.slice(0, 4000)}, ${authorName}, ${clubId}, ${false})`;
    return { id: hid, clubId };
  });

export const updateHighlight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((h: { id: string; note?: string; tagIds?: string[] }) => h)
  .handler(async ({ context, data: h }) => {
    const sql = await getSql();
    const owned = await sql<{ id: string }>`select id from folio_highlights where id = ${h.id} and user_id = ${context.userId}`;
    if (!owned[0]) return { ok: false as const };
    if (typeof h.note === "string") {
      await sql`update folio_highlights set note = ${h.note} where id = ${h.id} and user_id = ${context.userId}`;
    }
    if (h.tagIds) {
      await sql`delete from folio_highlight_tags where highlight_id = ${h.id}`;
      for (const tagId of h.tagIds) {
        await sql`insert into folio_highlight_tags (highlight_id, tag_id) values (${h.id}, ${tagId}) on conflict do nothing`;
      }
    }
    return { ok: true as const };
  });

export const deleteHighlight = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((hid: string) => hid)
  .handler(async ({ context, data: hid }) => {
    const sql = await getSql();
    const row = await sql<{ is_companion: boolean | null }>`
      select is_companion from folio_highlights where id = ${hid} and user_id = ${context.userId}`;
    if (!row[0] || row[0].is_companion) return { ok: false as const };
    await sql`delete from folio_voice_notes where highlight_id = ${hid} and user_id = ${context.userId}`;
    await sql`delete from folio_highlight_tags where highlight_id = ${hid}`;
    await sql`delete from folio_highlights where id = ${hid} and user_id = ${context.userId} and coalesce(is_companion, false) = false`;
    return { ok: true as const };
  });

export const addBookmark = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((b: { bookId: string; chapterIndex: number; pageIndex: number; label: string }) => b)
  .handler(async ({ context, data: b }) => {
    const sql = await getSql();
    const bid = id();
    await sql`insert into folio_bookmarks (id, user_id, book_id, chapter_index, page_index, label)
      values (${bid}, ${context.userId}, ${b.bookId}, ${b.chapterIndex}, ${b.pageIndex}, ${b.label})`;
    return { id: bid };
  });

export const deleteBookmark = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((bid: string) => bid)
  .handler(async ({ context, data: bid }) => {
    const sql = await getSql();
    await sql`delete from folio_bookmarks where id = ${bid} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const addTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((t: { name: string; emoji: string; kind: Tag["kind"] }) => t)
  .handler(async ({ context, data: t }) => {
    const sql = await getSql();
    const tid = id();
    await sql`insert into folio_tags (id, user_id, name, emoji, kind) values (${tid}, ${context.userId}, ${t.name.slice(0, 40)}, ${t.emoji.slice(0, 8)}, ${t.kind})`;
    return { id: tid };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((tid: string) => tid)
  .handler(async ({ context, data: tid }) => {
    const sql = await getSql();
    await sql`delete from folio_highlight_tags where tag_id = ${tid}`;
    await sql`delete from folio_tags where id = ${tid} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const saveVoiceNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (v: {
      highlightId: string;
      transcript: string;
      audioB64: string;
      mime: string;
      durationMs: number;
      authorName?: string;
      replyTo?: string | null;
    }) => v,
  )
  .handler(async ({ context, data: v }) => {
    if (v.audioB64.length > 2_400_000) throw new Error("Voice note is too long");
    const sql = await getSql();
    const owned = await sql<{ id: string; club_id: string | null }>`
      select id, club_id from folio_highlights
      where id = ${v.highlightId}
        and (user_id = ${context.userId} or club_id in (
          select club_id from folio_club_members where user_id = ${context.userId}
        ))`;
    if (!owned[0]) throw new Error("Highlight not found");
    const vid = id();
    const authorName = (v.authorName || "You").slice(0, 40);
    await sql`insert into folio_voice_notes (id, user_id, highlight_id, transcript, audio_b64, mime, duration_ms, author_name, reply_to, audio_url, is_companion, club_id)
      values (${vid}, ${context.userId}, ${v.highlightId}, ${v.transcript.slice(0, 8000)}, ${v.audioB64}, ${v.mime}, ${v.durationMs}, ${authorName}, ${v.replyTo ?? null}, ${""}, ${false}, ${owned[0].club_id})`;
    return { id: vid };
  });

export const transcribeAudio = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((v: { audioB64: string; mime: string }) => v)
  .handler(async ({ data: v }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, text: "", error: "unavailable" };
    const bin = Buffer.from(v.audioB64, "base64");
    const form = new FormData();
    form.set("format", "true");
    form.set("language", "en");
    const blob = new Blob([bin], { type: v.mime || "audio/webm" });
    form.set("file", blob, "note.webm");
    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!res.ok) return { ok: false as const, text: "", error: `stt ${res.status}` };
    const body = (await res.json()) as { text?: string };
    return { ok: true as const, text: body.text ?? "", error: "" };
  });

export const loadAllMarks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const uid = context.userId;
    const hl = await sql<HighlightRow>`
      select id, user_id, book_id, chapter_id, start_offset, end_offset, text, note, created_at,
             coalesce(author_name, '') as author_name, club_id, coalesce(is_companion, false) as is_companion
      from folio_highlights where user_id = ${uid} order by created_at desc limit 400`;
    const tagMap = new Map<string, string[]>();
    const allLinks = await sql<{ highlight_id: string; tag_id: string }>`
      select ht.highlight_id, ht.tag_id
      from folio_highlight_tags ht
      join folio_highlights h on h.id = ht.highlight_id
      where h.user_id = ${uid}`;
    for (const l of allLinks) {
      const arr = tagMap.get(l.highlight_id) ?? [];
      arr.push(l.tag_id);
      tagMap.set(l.highlight_id, arr);
    }
    const tags = await sql<{ id: string; name: string; emoji: string; kind: Tag["kind"] }>`
      select id, name, emoji, kind from folio_tags where user_id = ${uid} order by created_at asc`;
    const voices = await sql<{ highlight_id: string; n: number }>`
      select highlight_id, count(*)::int as n from folio_voice_notes where user_id = ${uid} group by highlight_id`;
    const voiceSet = new Set(voices.map((v) => v.highlight_id));
    return {
      highlights: hl.map((h) => mapHighlight(h, tagMap.get(h.id) ?? [])),
      tags: tags.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, kind: t.kind })),
      voicedIds: [...voiceSet],
    };
  });

export type GutenbergHit = {
  id: number;
  title: string;
  authors: string;
  downloadCount: number;
  epubUrl: string | null;
};

export const searchGutenberg = createServerFn({ method: "POST" })
  .validator((q: string) => q.trim().slice(0, 80))
  .handler(async ({ data: q }) => {
    if (!q) return [] as GutenbergHit[];
    const url = `https://gutendex.com/books?search=${encodeURIComponent(q)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [] as GutenbergHit[];
    const body = (await res.json()) as {
      results?: {
        id: number;
        title: string;
        download_count?: number;
        authors?: { name: string }[];
        formats?: Record<string, string>;
      }[];
    };
    return (body.results ?? []).slice(0, 18).map((r): GutenbergHit => {
      const formats = r.formats ?? {};
      const epubUrl =
        formats["application/epub+zip"] ??
        Object.entries(formats).find(([k]) => k.includes("epub"))?.[1] ??
        null;
      return {
        id: r.id,
        title: r.title,
        authors: (r.authors ?? []).map((a) => a.name).join(", ") || "Unknown",
        downloadCount: r.download_count ?? 0,
        epubUrl,
      };
    });
  });

export const parseRemoteEpub = createServerFn({ method: "POST" })
  .validator((v: { url: string; title: string; authors: string; id: number }) => v)
  .handler(async ({ data: v }) => {
    const res = await fetch(v.url);
    if (!res.ok) throw new Error("Could not download EPUB");
    const buf = await res.arrayBuffer();
    const book = await parseEpub(buf, v.title);
    book.id = `gutenberg-${v.id}`;
    book.source = "gutenberg";
    book.author = v.authors || book.author;
    book.title = v.title || book.title;
    return book;
  });

export const importGutenberg = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((v: { id: number; title: string; authors: string; epubUrl: string }) => v)
  .handler(async ({ context, data: v }) => {
    const res = await fetch(v.epubUrl);
    if (!res.ok) throw new Error("Could not download EPUB");
    const buf = await res.arrayBuffer();
    const book = await parseEpub(buf, v.title);
    book.id = `gutenberg-${v.id}`;
    book.source = "gutenberg";
    book.author = v.authors || book.author;
    book.title = v.title || book.title;
    const sql = await getSql();
    const uid = context.userId;
    await sql`insert into folio_library (id, user_id, book_id, source, title, author, description, cover_label)
      values (${id()}, ${uid}, ${book.id}, ${"gutenberg"}, ${book.title}, ${book.author}, ${book.description}, ${book.coverLabel})
      on conflict (user_id, book_id) do update set title = excluded.title`;
    await sql`insert into folio_book_content (book_id, user_id, chapters_json)
      values (${book.id}, ${uid}, ${JSON.stringify(book.chapters)})
      on conflict (user_id, book_id) do update set chapters_json = excluded.chapters_json`;
    return { bookId: book.id };
  });

export const importEpub = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((v: { filename: string; b64: string }) => v)
  .handler(async ({ context, data: v }) => {
    if (v.b64.length > 12_000_000) throw new Error("EPUB is too large for this preview");
    const buf = Buffer.from(v.b64, "base64");
    const book = await parseEpub(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), v.filename);
    const sql = await getSql();
    const uid = context.userId;
    await sql`insert into folio_library (id, user_id, book_id, source, title, author, description, cover_label)
      values (${id()}, ${uid}, ${book.id}, ${"upload"}, ${book.title}, ${book.author}, ${book.description}, ${book.coverLabel})`;
    await sql`insert into folio_book_content (book_id, user_id, chapters_json)
      values (${book.id}, ${uid}, ${JSON.stringify(book.chapters)})`;
    return { bookId: book.id };
  });

export const suggestClusters = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, clusters: [] as { name: string; emoji: string; texts: string[] }[], error: "AI is not available" };
    const sql = await getSql();
    const rows = await sql<{ text: string; note: string }>`
      select text, note from folio_highlights where user_id = ${context.userId} order by created_at desc limit 40`;
    if (rows.length === 0) return { ok: true as const, clusters: [], error: "" };
    const prompt = `You cluster reading highlights into named lists. Return JSON only: {"clusters":[{"name":"","emoji":"","texts":[...]}]}.
Use short names (1-2 words), one emoji each. Prefer kinds like Person, Place, Idea, Quote, Book, Question. Keep 3-8 clusters. Use the highlight text (truncate ok).
Highlights:\n${rows.map((r, i) => `${i + 1}. ${r.text.slice(0, 220)}${r.note ? ` [note: ${r.note.slice(0, 80)}]` : ""}`).join("\n")}`;
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return { ok: false as const, clusters: [], error: `xAI ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as {
        clusters?: { name: string; emoji: string; texts: string[] }[];
      };
      return { ok: true as const, clusters: parsed.clusters ?? [], error: "" };
    } catch {
      return { ok: false as const, clusters: [], error: "Could not parse clusters" };
    }
  });

export const suggestTagsForText = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((text: string) => text.slice(0, 500))
  .handler(async ({ context, data: text }) => {
    const sql = await getSql();
    const tags = await sql<{ name: string; emoji: string }>`select name, emoji from folio_tags where user_id = ${context.userId}`;
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      const lowered = text.toLowerCase();
      const hits = tags.filter((t) => lowered.includes(t.name.toLowerCase())).map((t) => t.name);
      return { names: hits.slice(0, 3) };
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 80,
        messages: [
          {
            role: "user",
            content: `Pick up to 3 tag names from this list that fit the passage. Reply with comma-separated names only, or NONE.\nTags: ${tags.map((t) => t.name).join(", ")}\nPassage: ${text}`,
          },
        ],
      }),
    });
    if (!res.ok) return { names: [] as string[] };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    if (/none/i.test(raw.trim())) return { names: [] as string[] };
    const allowed = new Set(tags.map((t) => t.name.toLowerCase()));
    const names = raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter((s) => allowed.has(s.toLowerCase()));
    return { names };
  });

export const createClub = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((v: { bookId: string; name: string; displayName: string }) => v)
  .handler(async ({ context, data: v }) => {
    const sql = await getSql();
    const existing = await sql<{ id: string; invite_code: string }>`
      select c.id, c.invite_code from folio_clubs c
      join folio_club_members m on m.club_id = c.id
      where m.user_id = ${context.userId} and c.book_id = ${v.bookId}
      limit 1`;
    if (existing[0]) return { id: existing[0].id, inviteCode: existing[0].invite_code };
    const clubId = id();
    const code = inviteCode();
    const name = v.name.trim().slice(0, 48) || "Reading circle";
    await sql`insert into folio_clubs (id, book_id, name, invite_code, created_by)
      values (${clubId}, ${v.bookId}, ${name}, ${code}, ${context.userId})`;
    await sql`insert into folio_club_members (club_id, user_id, display_name, role)
      values (${clubId}, ${context.userId}, ${(v.displayName || "You").slice(0, 40)}, ${"owner"})`;
    return { id: clubId, inviteCode: code };
  });

export const joinClub = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((v: { code: string; displayName: string }) => v)
  .handler(async ({ context, data: v }) => {
    const sql = await getSql();
    const code = v.code.trim().toUpperCase();
    const rows = await sql<{ id: string; book_id: string }>`
      select id, book_id from folio_clubs where invite_code = ${code} limit 1`;
    const club = rows[0];
    if (!club) return { ok: false as const, error: "No circle with that code", bookId: "", clubId: "" };
    await sql`insert into folio_club_members (club_id, user_id, display_name, role)
      values (${club.id}, ${context.userId}, ${(v.displayName || "You").slice(0, 40)}, ${"member"})
      on conflict do nothing`;
    const bundled = BUNDLED_BOOKS.find((b) => b.id === club.book_id);
    if (bundled) {
      await sql`insert into folio_library (id, user_id, book_id, source, title, author, description, cover_label)
        values (${id()}, ${context.userId}, ${bundled.id}, ${bundled.source}, ${bundled.title}, ${bundled.author}, ${bundled.description}, ${bundled.coverLabel})
        on conflict (user_id, book_id) do nothing`;
    }
    return { ok: true as const, error: "", bookId: club.book_id, clubId: club.id };
  });

export const importHtml = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((v: { filename: string; text: string }) => v)
  .handler(async ({ context, data: v }) => {
    if (v.text.length > 800_000) throw new Error("HTML is too large");
    const book = parseHtmlDocument(v.text, v.filename);
    const sql = await getSql();
    const uid = context.userId;
    await sql`insert into folio_library (id, user_id, book_id, source, title, author, description, cover_label)
      values (${id()}, ${uid}, ${book.id}, ${"upload"}, ${book.title}, ${book.author}, ${book.description}, ${book.coverLabel})`;
    await sql`insert into folio_book_content (book_id, user_id, chapters_json)
      values (${book.id}, ${uid}, ${JSON.stringify(book.chapters)})`;
    return { bookId: book.id };
  });

const defineCache = new Map<string, { word: string; short: string; long: string }>();

export const peekArticle = createServerFn({ method: "POST" })
  .validator((url: string) => url.slice(0, 500))
  .handler(async ({ data: url }) => fetchPeekArticle(url));

export const defineWord = createServerFn({ method: "POST" })
  .validator((v: { word: string; context?: string }) => ({
    word: v.word.trim().slice(0, 48),
    context: (v.context ?? "").slice(0, 280),
  }))
  .handler(async ({ data }) => {
    const key = data.word.toLowerCase();
    const cached = defineCache.get(key);
    if (cached) return { ok: true as const, ...cached };
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false as const, word: data.word, short: "", long: "", error: "unavailable" };
    }
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 160,
        messages: [
          {
            role: "user",
            content: `You are a teacher in the margin of a book. Define the word for a careful reader in two layers.
Return JSON only: {"word":"","short":"one or two sentences","long":"a slightly longer lesson, analogy welcome, no bullet list"}.
Word: ${data.word}
Nearby: ${data.context || "(none)"}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ok: false as const, word: data.word, short: "", long: "", error: `xAI ${res.status}` };
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = body.choices?.[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(jsonMatch?.[0] ?? raw) as { word?: string; short?: string; long?: string };
      const entry = {
        word: parsed.word || data.word,
        short: (parsed.short || "").slice(0, 280),
        long: (parsed.long || "").slice(0, 600),
      };
      if (entry.short) defineCache.set(key, entry);
      return { ok: true as const, ...entry };
    } catch {
      return { ok: false as const, word: data.word, short: "", long: "", error: "Could not parse" };
    }
  });

