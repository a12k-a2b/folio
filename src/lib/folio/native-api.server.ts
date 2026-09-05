import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSessionUser, requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { BUNDLED_BOOKS } from "./books";
import { catalogBook, catalogIndex } from "./catalog";
import { NATIVE_PROTOCOL, POWERSYNC_LOCKED, parseNativePath } from "./native-path";
import { ensureFolioUser, fetchBookBundle } from "./server";
import { DEFAULT_SETTINGS, type FolioSettings, type Tag } from "./types";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Folio-Protocol",
  "Access-Control-Max-Age": "86400",
  "X-Folio-Protocol": NATIVE_PROTOCOL,
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}

function bearerOf(request: Request): string | undefined {
  const raw = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!raw) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(raw.trim());
  return m?.[1];
}

function newId() {
  return crypto.randomUUID();
}

function absUrl(request: Request, url: string) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  const origin = new URL(request.url).origin;
  return origin + (url.startsWith("/") ? url : `/${url}`);
}

async function session(request: Request) {
  const user = await getSessionUser(bearerOf(request));
  if (user) {
    return {
      userId: user.id,
      email: user.email,
      displayName: (user.email?.split("@")[0] || "You").slice(0, 40),
    };
  }
  const userId = await requireUserId(bearerOf(request));
  return { userId, email: null as string | null, displayName: "You" };
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (!text.trim()) return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_json");
  }
  return parsed as Record<string, unknown>;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export async function handleNativeRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS" || request.method === "HEAD") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url = new URL(request.url);
  const route = parseNativePath(url.pathname);
  if (!route) return json({ error: "not_found", protocol: NATIVE_PROTOCOL }, 404);

  try {
    switch (route.name) {
      case "health":
        return json({
          ok: true,
          protocol: NATIVE_PROTOCOL,
          powersync: POWERSYNC_LOCKED ? "locked" : "open",
          powersyncLocked: POWERSYNC_LOCKED,
          reason: POWERSYNC_LOCKED
            ? "HTTP v1 pull/push is the sync until both native apps keep a mark overnight on device."
            : "open",
          catalogSize: BUNDLED_BOOKS.length,
          time: new Date().toISOString(),
        });

      case "catalog":
        return json({ protocol: NATIVE_PROTOCOL, books: catalogIndex() });

      case "catalogBook": {
        const book = catalogBook(route.bookId);
        if (!book) return json({ error: "not_found", protocol: NATIVE_PROTOCOL }, 404);
        return json({ protocol: NATIVE_PROTOCOL, book });
      }

      default:
        break;
    }

    if (route.name === "me") {
      try {
        assertSameSiteRequest();
        const me = await session(request);
        const sql = await getSql();
        await ensureFolioUser(sql, me.userId, me.displayName);
        return json({ protocol: NATIVE_PROTOCOL, signedIn: true, ...me, powersyncLocked: POWERSYNC_LOCKED });
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          return json({
            protocol: NATIVE_PROTOCOL,
            signedIn: false,
            userId: null,
            email: null,
            displayName: null,
            powersyncLocked: POWERSYNC_LOCKED,
          });
        }
        throw err;
      }
    }

    assertSameSiteRequest();
    const me = await session(request);
    const sql = await getSql();
    await ensureFolioUser(sql, me.userId, me.displayName);
    const uid = me.userId;

    if (route.name === "library") {
      const books = await sql<{
        id: string;
        book_id: string;
        source: string;
        title: string;
        author: string;
        description: string;
        cover_label: string;
        added_at: string;
      }>`select id, book_id, source, title, author, description, cover_label, added_at
         from folio_library where user_id = ${uid} order by added_at asc`;
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
        role: "owner" | "member" | "companion";
      }>`select m.club_id, m.user_id, m.display_name, m.role
         from folio_club_members m
         where m.club_id in (
           select c.id from folio_clubs c
           join folio_club_members me on me.club_id = c.id
           where me.user_id = ${uid}
         )`;
      return json({
        protocol: NATIVE_PROTOCOL,
        books: books.map((b) => ({
          id: b.id,
          bookId: b.book_id,
          source: b.source,
          title: b.title,
          author: b.author,
          description: b.description,
          coverLabel: b.cover_label,
          addedAt: String(b.added_at),
        })),
        progress: progress.map((p) => ({
          bookId: p.book_id,
          chapterIndex: Number(p.chapter_index),
          pageIndex: Number(p.page_index),
          percent: Number(p.percent),
          locator: p.locator,
          updatedAt: String(p.updated_at),
        })),
        settings,
        clubs: clubRows.map((c) => ({
          id: c.id,
          bookId: c.book_id,
          name: c.name,
          inviteCode: c.invite_code,
          createdBy: c.created_by,
          members: memberRows
            .filter((m) => m.club_id === c.id)
            .map((m) => ({ userId: m.user_id, displayName: m.display_name, role: m.role })),
        })),
      });
    }

    if (route.name === "snapshot") {
      const bundle = await fetchBookBundle(uid, route.bookId);
      return json({
        protocol: NATIVE_PROTOCOL,
        book: bundle.book,
        highlights: bundle.highlights,
        bookmarks: bundle.bookmarks,
        tags: bundle.tags,
        voices: bundle.voices.map((v) => ({ ...v, audioUrl: absUrl(request, v.audioUrl) })),
        club: bundle.club,
      });
    }

    if (route.name === "settings" && request.method === "GET") {
      const rows = await sql<{ json: string }>`select json from folio_settings where user_id = ${uid}`;
      let settings: FolioSettings = DEFAULT_SETTINGS;
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(rows[0]?.json ?? "{}") };
      } catch {
        settings = DEFAULT_SETTINGS;
      }
      return json({ protocol: NATIVE_PROTOCOL, settings });
    }

    if (route.name === "settings" && request.method === "POST") {
      const body = await readBody(request);
      const next: FolioSettings = {
        ...DEFAULT_SETTINGS,
        ...(body as Partial<FolioSettings>),
      };
      await sql`insert into folio_settings (user_id, json) values (${uid}, ${JSON.stringify(next)})
        on conflict (user_id) do update set json = excluded.json`;
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "tags" && request.method === "GET") {
      const tags = await sql<{ id: string; name: string; emoji: string; kind: Tag["kind"] }>`
        select id, name, emoji, kind from folio_tags where user_id = ${uid} order by created_at asc`;
      return json({
        protocol: NATIVE_PROTOCOL,
        tags: tags.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, kind: t.kind })),
      });
    }

    if (route.name === "tags" && request.method === "POST") {
      const body = await readBody(request);
      const tid = str(body.id) || newId();
      const name = str(body.name).slice(0, 40);
      const emoji = str(body.emoji).slice(0, 8);
      const kind = str(body.kind, "custom");
      if (!name) return json({ error: "name_required" }, 400);
      await sql`insert into folio_tags (id, user_id, name, emoji, kind)
        values (${tid}, ${uid}, ${name}, ${emoji}, ${kind})
        on conflict (id) do update set name = excluded.name, emoji = excluded.emoji, kind = excluded.kind
        where folio_tags.user_id = ${uid}`;
      return json({ id: tid, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "tags" && request.method === "DELETE") {
      const tid = url.searchParams.get("id") || str((await readBody(request)).id);
      if (!tid) return json({ error: "id_required" }, 400);
      await sql`delete from folio_highlight_tags where tag_id = ${tid}`;
      await sql`delete from folio_tags where id = ${tid} and user_id = ${uid}`;
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "progress" && request.method === "POST") {
      const body = await readBody(request);
      const bookId = str(body.bookId);
      if (!bookId) return json({ error: "bookId_required" }, 400);
      await sql`insert into folio_progress (user_id, book_id, chapter_index, page_index, percent, locator, updated_at)
        values (${uid}, ${bookId}, ${num(body.chapterIndex)}, ${num(body.pageIndex)}, ${num(body.percent)}, ${str(body.locator)}, now())
        on conflict (user_id, book_id) do update set
          chapter_index = excluded.chapter_index,
          page_index = excluded.page_index,
          percent = excluded.percent,
          locator = excluded.locator,
          updated_at = now()`;
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "highlights" && request.method === "POST") {
      const body = await readBody(request);
      const bookId = str(body.bookId);
      const chapterId = str(body.chapterId);
      const text = str(body.text).slice(0, 4000);
      if (!bookId || !chapterId || !text) return json({ error: "highlight_required" }, 400);
      const hid = str(body.id) || newId();
      const clubs = await sql<{ id: string }>`
        select c.id from folio_clubs c
        join folio_club_members m on m.club_id = c.id
        where m.user_id = ${uid} and c.book_id = ${bookId}
        limit 1`;
      const clubId = clubs[0]?.id ?? null;
      const authorName = str(body.authorName, me.displayName).slice(0, 40);
      await sql`insert into folio_highlights (id, user_id, book_id, chapter_id, start_offset, end_offset, text, note, author_name, club_id, is_companion)
        values (${hid}, ${uid}, ${bookId}, ${chapterId}, ${num(body.startOffset)}, ${num(body.endOffset)}, ${text}, ${str(body.note)}, ${authorName}, ${clubId}, ${false})
        on conflict (id) do update set
          text = excluded.text,
          start_offset = excluded.start_offset,
          end_offset = excluded.end_offset,
          note = excluded.note
        where folio_highlights.user_id = ${uid} and coalesce(folio_highlights.is_companion, false) = false`;
      return json({ id: hid, clubId, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "highlight" && request.method === "PATCH") {
      const body = await readBody(request);
      const owned = await sql<{ id: string }>`select id from folio_highlights where id = ${route.id} and user_id = ${uid}`;
      if (!owned[0]) return json({ ok: false, error: "not_found" }, 404);
      if (typeof body.note === "string") {
        await sql`update folio_highlights set note = ${body.note} where id = ${route.id} and user_id = ${uid}`;
      }
      if (Array.isArray(body.tagIds)) {
        await sql`delete from folio_highlight_tags where highlight_id = ${route.id}`;
        for (const tagId of body.tagIds) {
          if (typeof tagId !== "string") continue;
          await sql`insert into folio_highlight_tags (highlight_id, tag_id) values (${route.id}, ${tagId}) on conflict do nothing`;
        }
      }
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "highlight" && request.method === "DELETE") {
      const row = await sql<{ is_companion: boolean | null }>`
        select is_companion from folio_highlights where id = ${route.id} and user_id = ${uid}`;
      if (!row[0] || row[0].is_companion) return json({ ok: false, error: "forbidden" }, 403);
      await sql`delete from folio_voice_notes where highlight_id = ${route.id} and user_id = ${uid}`;
      await sql`delete from folio_highlight_tags where highlight_id = ${route.id}`;
      await sql`delete from folio_highlights where id = ${route.id} and user_id = ${uid} and coalesce(is_companion, false) = false`;
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "bookmarks" && request.method === "POST") {
      const body = await readBody(request);
      const bookId = str(body.bookId);
      if (!bookId) return json({ error: "bookId_required" }, 400);
      const bid = str(body.id) || newId();
      await sql`insert into folio_bookmarks (id, user_id, book_id, chapter_index, page_index, label)
        values (${bid}, ${uid}, ${bookId}, ${num(body.chapterIndex)}, ${num(body.pageIndex)}, ${str(body.label)})
        on conflict (id) do update set label = excluded.label
        where folio_bookmarks.user_id = ${uid}`;
      return json({ id: bid, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "bookmark" && request.method === "DELETE") {
      await sql`delete from folio_bookmarks where id = ${route.id} and user_id = ${uid}`;
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "voices" && request.method === "POST") {
      const body = await readBody(request);
      const highlightId = str(body.highlightId);
      const audioB64 = str(body.audioB64);
      if (!highlightId) return json({ error: "highlightId_required" }, 400);
      if (audioB64.length > 2_400_000) return json({ error: "too_long" }, 413);
      const owned = await sql<{ id: string; club_id: string | null }>`
        select id, club_id from folio_highlights
        where id = ${highlightId}
          and (user_id = ${uid} or club_id in (
            select club_id from folio_club_members where user_id = ${uid}
          ))`;
      if (!owned[0]) return json({ error: "highlight_not_found" }, 404);
      const vid = str(body.id) || newId();
      const authorName = str(body.authorName, me.displayName).slice(0, 40);
      await sql`insert into folio_voice_notes (id, user_id, highlight_id, transcript, audio_b64, mime, duration_ms, author_name, reply_to, audio_url, is_companion, club_id)
        values (${vid}, ${uid}, ${highlightId}, ${str(body.transcript).slice(0, 8000)}, ${audioB64}, ${str(body.mime, "audio/m4a")}, ${num(body.durationMs)}, ${authorName}, ${str(body.replyTo) || null}, ${""}, ${false}, ${owned[0].club_id})
        on conflict (id) do update set transcript = excluded.transcript
        where folio_voice_notes.user_id = ${uid}`;
      return json({ id: vid, protocol: NATIVE_PROTOCOL });
    }

    return json({ error: "method_not_allowed", protocol: NATIVE_PROTOCOL }, 405);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return json({ error: "unauthorized", protocol: NATIVE_PROTOCOL }, 401);
    }
    const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
    const message = err instanceof Error ? err.message : "error";
    if (status === 403) return json({ error: "forbidden", protocol: NATIVE_PROTOCOL }, 403);
    console.error("[native-api]", message);
    return json({ error: "server_error", protocol: NATIVE_PROTOCOL }, status >= 400 ? status : 500);
  }
}
