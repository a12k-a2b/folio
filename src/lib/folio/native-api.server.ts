import { getSql } from "@/lib/db";
import { assertSameSiteRequest } from "@/lib/auth/isolation.server";
import { getSessionUser, requireUserId, UnauthorizedError } from "@/lib/auth/verify.server";
import { BUNDLED_BOOKS } from "./books";
import { catalogBook, catalogIndex } from "./catalog";
import { NATIVE_PROTOCOL, POWERSYNC_LOCKED, SYNC_VERSION, parseNativePath } from "./native-path";
import { ensureFolioUser, fetchBookBundle } from "./server";
import { DEFAULT_SETTINGS, type FolioSettings, type Tag } from "./types";
import {
  applyPush,
  completeBlob,
  createBlob,
  deleteBookmark,
  deleteHighlight,
  deleteTag,
  deleteVoice,
  parseOps,
  putBlobBytes,
  putBookmark,
  putHighlight,
  putProgress,
  putSettings,
  putTag,
  putVoice,
  readBlob,
} from "./sync-mutate.server";

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, PUT, OPTIONS",
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
  if (request.method === "OPTIONS") {
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
          sync: SYNC_VERSION,
          changeset: SYNC_VERSION,
          powersync: POWERSYNC_LOCKED ? "locked" : "open",
          powersyncLocked: POWERSYNC_LOCKED,
          reason: POWERSYNC_LOCKED
            ? "HTTP v1.1 (blobs, tombstones, batch). PowerSync stays locked until both native apps keep a mark overnight."
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
        voices: bundle.voices.map((v) => ({ ...v, audioB64: "", audioUrl: absUrl(request, v.audioUrl) })),
        club: bundle.club,
        tombstones: bundle.tombstones,
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
      const result = await putSettings(sql, uid, body, DEFAULT_SETTINGS);
      if (result.rejected?.code === "stale") {
        return json({ ok: true, stale: true, settings: result.rejected.row, protocol: NATIVE_PROTOCOL });
      }
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "tags" && request.method === "GET") {
      const tags = await sql<{ id: string; name: string; emoji: string; kind: Tag["kind"] }>`
        select id, name, emoji, kind from folio_tags where user_id = ${uid} and deleted_at is null order by created_at asc`;
      return json({
        protocol: NATIVE_PROTOCOL,
        tags: tags.map((t) => ({ id: t.id, name: t.name, emoji: t.emoji, kind: t.kind })),
      });
    }

    if (route.name === "tags" && request.method === "POST") {
      const body = await readBody(request);
      const tid = str(body.id) || newId();
      const result = await putTag(sql, uid, tid, body);
      if (result.rejected?.code === "invalid") return json({ error: "name_required" }, 400);
      return json({ id: tid, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "tags" && request.method === "DELETE") {
      const tid = url.searchParams.get("id") || str((await readBody(request)).id);
      if (!tid) return json({ error: "id_required" }, 400);
      const result = await deleteTag(sql, uid, tid);
      if (result.rejected) return json({ ok: false, error: result.rejected.code }, 404);
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "progress" && request.method === "POST") {
      const body = await readBody(request);
      if (!str(body.bookId)) return json({ error: "bookId_required" }, 400);
      const result = await putProgress(sql, uid, body);
      if (result.rejected?.code === "stale") {
        return json({ ok: true, stale: true, progress: result.rejected.row, protocol: NATIVE_PROTOCOL });
      }
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "highlights" && request.method === "POST") {
      const body = await readBody(request);
      if (!str(body.bookId) || !str(body.chapterId) || !str(body.text)) {
        return json({ error: "highlight_required" }, 400);
      }
      const hid = str(body.id) || newId();
      const result = await putHighlight(sql, uid, me.displayName, hid, body);
      if (result.rejected?.code === "companion") return json({ ok: false, error: "forbidden" }, 403);
      const clubs = await sql<{ id: string }>`
        select c.id from folio_clubs c
        join folio_club_members m on m.club_id = c.id
        where m.user_id = ${uid} and c.book_id = ${str(body.bookId)}
        limit 1`;
      return json({ id: hid, clubId: clubs[0]?.id ?? null, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "highlight" && request.method === "PATCH") {
      const body = await readBody(request);
      const owned = await sql<{
        id: string;
        book_id: string;
        chapter_id: string;
        start_offset: number;
        end_offset: number;
        text: string;
        note: string;
      }>`select id, book_id, chapter_id, start_offset, end_offset, text, note from folio_highlights where id = ${route.id} and user_id = ${uid} and deleted_at is null`;
      if (!owned[0]) return json({ ok: false, error: "not_found" }, 404);
      const result = await putHighlight(sql, uid, me.displayName, route.id, {
        bookId: owned[0].book_id,
        chapterId: owned[0].chapter_id,
        startOffset: owned[0].start_offset,
        endOffset: owned[0].end_offset,
        text: owned[0].text,
        note: typeof body.note === "string" ? body.note : owned[0].note,
        tagIds: Array.isArray(body.tagIds) ? body.tagIds : undefined,
      });
      if (result.rejected?.code === "companion") return json({ ok: false, error: "forbidden" }, 403);
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "highlight" && request.method === "DELETE") {
      const result = await deleteHighlight(sql, uid, route.id);
      if (result.rejected?.code === "companion") return json({ ok: false, error: "forbidden" }, 403);
      if (result.rejected?.code === "not_found") return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "bookmarks" && request.method === "POST") {
      const body = await readBody(request);
      if (!str(body.bookId)) return json({ error: "bookId_required" }, 400);
      const bid = str(body.id) || newId();
      await putBookmark(sql, uid, bid, body);
      return json({ id: bid, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "bookmark" && request.method === "DELETE") {
      const result = await deleteBookmark(sql, uid, route.id);
      if (result.rejected?.code === "not_found") return json({ ok: false, error: "not_found" }, 404);
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "voices" && request.method === "POST") {
      const body = await readBody(request);
      if (!str(body.highlightId)) return json({ error: "highlightId_required" }, 400);
      const vid = str(body.id) || newId();
      const result = await putVoice(sql, uid, me.displayName, vid, body);
      if (result.rejected?.code === "blob_missing") return json({ error: "blob_missing", id: vid, protocol: NATIVE_PROTOCOL }, 409);
      if (result.rejected?.code === "not_found") return json({ error: "highlight_not_found" }, 404);
      if (result.rejected?.code === "companion") return json({ error: "forbidden" }, 403);
      if (result.rejected?.code === "invalid") return json({ error: "too_long" }, 413);
      return json({ id: vid, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "voice" && request.method === "DELETE") {
      const result = await deleteVoice(sql, uid, route.id);
      if (result.rejected?.code === "companion") return json({ error: "forbidden" }, 403);
      return json({ ok: true, protocol: NATIVE_PROTOCOL });
    }

    if (route.name === "push" && request.method === "POST") {
      const body = await readBody(request);
      const ops = parseOps(body);
      if (!ops) return json({ error: "ops_required", protocol: NATIVE_PROTOCOL }, 400);
      const result = await applyPush(sql, uid, me.displayName, DEFAULT_SETTINGS, ops);
      return json({ protocol: NATIVE_PROTOCOL, accepted: result.accepted, rejected: result.rejected });
    }

    if (route.name === "blobs" && request.method === "POST") {
      const body = await readBody(request);
      try {
        const created = await createBlob(sql, uid, {
          id: str(body.id) || str(body.voiceId) || undefined,
          mime: str(body.mime) || undefined,
          byteLength: num(body.byteLength),
          sha256: str(body.sha256) || undefined,
        });
        const origin = new URL(request.url).origin;
        return json({
          protocol: NATIVE_PROTOCOL,
          id: created.id,
          putUrl: origin + created.putPath,
          getUrl: origin + created.getPath,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
      } catch (err) {
        const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 400;
        return json({ error: err instanceof Error ? err.message : "blob", protocol: NATIVE_PROTOCOL }, status);
      }
    }

    if (route.name === "blobData" && request.method === "PUT") {
      const bytes = new Uint8Array(await request.arrayBuffer());
      const put = await putBlobBytes(sql, uid, route.id, bytes);
      if (!("ok" in put)) return json({ error: put.error, protocol: NATIVE_PROTOCOL }, put.status);
      return json({ ok: true, protocol: NATIVE_PROTOCOL, bytes: bytes.byteLength });
    }

    if (route.name === "blobComplete" && request.method === "POST") {
      const done = await completeBlob(sql, uid, route.id);
      if (!("ok" in done)) return json({ error: done.error, protocol: NATIVE_PROTOCOL }, done.status);
      return json({ ok: true, protocol: NATIVE_PROTOCOL, sha256: done.sha256, byteLength: done.byteLength });
    }

    if (route.name === "blob" && (request.method === "GET" || request.method === "HEAD")) {
      const blob = await readBlob(sql, uid, route.id);
      if (!blob) return json({ error: "not_found", protocol: NATIVE_PROTOCOL }, 404);
      if (request.method === "HEAD") {
        return new Response(null, {
          status: 200,
          headers: {
            ...CORS,
            "Content-Type": blob.mime,
            "Content-Length": String(blob.bytes.byteLength),
          },
        });
      }
      return new Response(Buffer.from(blob.bytes), {
        status: 200,
        headers: {
          ...CORS,
          "Content-Type": blob.mime,
          "Cache-Control": "private, max-age=3600",
        },
      });
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
