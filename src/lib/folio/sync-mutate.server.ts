import { createHash } from "node:crypto";
import type { Sql } from "@/lib/db";
import { isNewer, resolveUpdatedAt, stamp } from "./sync-clock";
import { parseOps, PUSH_MAX_OPS, type SyncOp, type SyncOpKind, type SyncTable } from "./sync-ops";
import type { FolioSettings, Progress, Tag } from "./types";

export { parseOps, PUSH_MAX_OPS };
export type { SyncOp, SyncOpKind, SyncTable };

export const BLOB_MAX_BYTES = 2_400_000;

export type RejectedOp = {
  id: string;
  table: SyncTable;
  code: "stale" | "companion" | "blob_missing" | "forbidden" | "not_found" | "invalid";
  row?: unknown;
};

export type AcceptedOp = { id: string; table: SyncTable; updatedAt?: string };

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function sha256Bytes(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function bytesToB64(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64");
}

export function b64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function clubForBook(sql: Sql, uid: string, bookId: string): Promise<string | null> {
  const clubs = await sql<{ id: string }>`
    select c.id from folio_clubs c
    join folio_club_members m on m.club_id = c.id
    where m.user_id = ${uid} and c.book_id = ${bookId}
    limit 1`;
  return clubs[0]?.id ?? null;
}

export async function putProgress(
  sql: Sql,
  uid: string,
  row: Record<string, unknown>,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const bookId = str(row.bookId || row.id);
  if (!bookId) return { rejected: { id: "", table: "progress", code: "invalid" } };
  const updatedAt = resolveUpdatedAt(str(row.updatedAt) || undefined);
  const existing = await sql<{ updated_at: string }>`
    select updated_at from folio_progress where user_id = ${uid} and book_id = ${bookId}`;
  if (existing[0] && isNewer(existing[0].updated_at, updatedAt)) {
    const stored = await sql<{
      book_id: string;
      chapter_index: number;
      page_index: number;
      percent: number;
      locator: string;
      updated_at: string;
    }>`select book_id, chapter_index, page_index, percent, locator, updated_at
       from folio_progress where user_id = ${uid} and book_id = ${bookId}`;
    const p = stored[0];
    const mapped: Progress | undefined = p
      ? {
          bookId: p.book_id,
          chapterIndex: Number(p.chapter_index),
          pageIndex: Number(p.page_index),
          percent: Number(p.percent),
          locator: p.locator,
          updatedAt: stamp(p.updated_at),
        }
      : undefined;
    return { rejected: { id: bookId, table: "progress", code: "stale", row: mapped } };
  }
  await sql`insert into folio_progress (user_id, book_id, chapter_index, page_index, percent, locator, updated_at)
    values (${uid}, ${bookId}, ${num(row.chapterIndex)}, ${num(row.pageIndex)}, ${num(row.percent)}, ${str(row.locator)}, ${updatedAt}::timestamptz)
    on conflict (user_id, book_id) do update set
      chapter_index = excluded.chapter_index,
      page_index = excluded.page_index,
      percent = excluded.percent,
      locator = excluded.locator,
      updated_at = excluded.updated_at
    where folio_progress.updated_at <= excluded.updated_at`;
  return { accepted: { id: bookId, table: "progress", updatedAt } };
}

export async function putSettings(
  sql: Sql,
  uid: string,
  row: Record<string, unknown>,
  fallback: FolioSettings,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const updatedAt = resolveUpdatedAt(str(row.updatedAt) || undefined);
  const existing = await sql<{ updated_at: string; json: string }>`
    select updated_at, json from folio_settings where user_id = ${uid}`;
  if (existing[0] && isNewer(existing[0].updated_at, updatedAt)) {
    let settings = fallback;
    try {
      settings = { ...fallback, ...JSON.parse(existing[0].json) };
    } catch {
      settings = fallback;
    }
    return { rejected: { id: "settings", table: "settings", code: "stale", row: settings } };
  }
  const next = { ...fallback, ...row };
  delete (next as { updatedAt?: string }).updatedAt;
  await sql`insert into folio_settings (user_id, json, updated_at)
    values (${uid}, ${JSON.stringify(next)}, ${updatedAt}::timestamptz)
    on conflict (user_id) do update set json = excluded.json, updated_at = excluded.updated_at
    where folio_settings.updated_at <= excluded.updated_at`;
  return { accepted: { id: "settings", table: "settings", updatedAt } };
}

export async function putHighlight(
  sql: Sql,
  uid: string,
  displayName: string,
  id: string,
  row: Record<string, unknown>,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const bookId = str(row.bookId);
  const chapterId = str(row.chapterId);
  const text = str(row.text).slice(0, 4000);
  if (!bookId || !chapterId || !text) return { rejected: { id, table: "highlights", code: "invalid" } };
  const updatedAt = resolveUpdatedAt(str(row.updatedAt) || str(row.createdAt) || undefined);
  const existing = await sql<{ is_companion: boolean | null; updated_at: string; user_id: string }>`
    select is_companion, updated_at, user_id from folio_highlights where id = ${id}`;
  if (existing[0]?.is_companion) return { rejected: { id, table: "highlights", code: "companion" } };
  if (existing[0] && existing[0].user_id !== uid) {
    return { rejected: { id, table: "highlights", code: "forbidden" } };
  }
  if (existing[0] && isNewer(existing[0].updated_at, updatedAt)) {
    return { rejected: { id, table: "highlights", code: "stale" } };
  }
  const clubId = (await clubForBook(sql, uid, bookId)) ?? (str(row.clubId) || null);
  const authorName = str(row.authorName, displayName).slice(0, 40);
  await sql`insert into folio_highlights (
      id, user_id, book_id, chapter_id, start_offset, end_offset, text, note, author_name, club_id, is_companion, updated_at, deleted_at
    ) values (
      ${id}, ${uid}, ${bookId}, ${chapterId}, ${num(row.startOffset)}, ${num(row.endOffset)}, ${text},
      ${str(row.note)}, ${authorName}, ${clubId}, ${false}, ${updatedAt}::timestamptz, ${null}
    )
    on conflict (id) do update set
      text = excluded.text,
      start_offset = excluded.start_offset,
      end_offset = excluded.end_offset,
      note = excluded.note,
      updated_at = excluded.updated_at,
      deleted_at = null
    where folio_highlights.user_id = ${uid}
      and coalesce(folio_highlights.is_companion, false) = false
      and folio_highlights.updated_at <= excluded.updated_at`;
  if (Array.isArray(row.tagIds)) {
    await sql`delete from folio_highlight_tags where highlight_id = ${id}`;
    for (const tagId of row.tagIds) {
      if (typeof tagId !== "string") continue;
      await sql`insert into folio_highlight_tags (highlight_id, tag_id) values (${id}, ${tagId}) on conflict do nothing`;
    }
  }
  return { accepted: { id, table: "highlights", updatedAt } };
}

export async function deleteHighlight(
  sql: Sql,
  uid: string,
  id: string,
  clientUpdatedAt?: string,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const updatedAt = resolveUpdatedAt(clientUpdatedAt);
  const row = await sql<{ is_companion: boolean | null; user_id: string; updated_at: string }>`
    select is_companion, user_id, updated_at from folio_highlights where id = ${id}`;
  if (!row[0]) return { rejected: { id, table: "highlights", code: "not_found" } };
  if (row[0].is_companion) return { rejected: { id, table: "highlights", code: "companion" } };
  if (row[0].user_id !== uid) return { rejected: { id, table: "highlights", code: "forbidden" } };
  if (isNewer(row[0].updated_at, updatedAt)) {
    return { rejected: { id, table: "highlights", code: "stale" } };
  }
  await sql`update folio_voice_notes
    set deleted_at = ${updatedAt}::timestamptz, updated_at = ${updatedAt}::timestamptz
    where highlight_id = ${id} and user_id = ${uid} and coalesce(is_companion, false) = false`;
  await sql`update folio_highlights
    set deleted_at = ${updatedAt}::timestamptz, updated_at = ${updatedAt}::timestamptz
    where id = ${id} and user_id = ${uid} and coalesce(is_companion, false) = false`;
  return { accepted: { id, table: "highlights", updatedAt } };
}

export async function putBookmark(
  sql: Sql,
  uid: string,
  id: string,
  row: Record<string, unknown>,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const bookId = str(row.bookId);
  if (!bookId) return { rejected: { id, table: "bookmarks", code: "invalid" } };
  const updatedAt = resolveUpdatedAt(str(row.updatedAt) || str(row.createdAt) || undefined);
  const existing = await sql<{ user_id: string; updated_at: string }>`
    select user_id, updated_at from folio_bookmarks where id = ${id}`;
  if (existing[0] && existing[0].user_id !== uid) {
    return { rejected: { id, table: "bookmarks", code: "forbidden" } };
  }
  if (existing[0] && isNewer(existing[0].updated_at, updatedAt)) {
    return { rejected: { id, table: "bookmarks", code: "stale" } };
  }
  await sql`insert into folio_bookmarks (id, user_id, book_id, chapter_index, page_index, label, updated_at, deleted_at)
    values (${id}, ${uid}, ${bookId}, ${num(row.chapterIndex)}, ${num(row.pageIndex)}, ${str(row.label)}, ${updatedAt}::timestamptz, ${null})
    on conflict (id) do update set
      label = excluded.label,
      chapter_index = excluded.chapter_index,
      page_index = excluded.page_index,
      updated_at = excluded.updated_at,
      deleted_at = null
    where folio_bookmarks.user_id = ${uid} and folio_bookmarks.updated_at <= excluded.updated_at`;
  return { accepted: { id, table: "bookmarks", updatedAt } };
}

export async function deleteBookmark(
  sql: Sql,
  uid: string,
  id: string,
  clientUpdatedAt?: string,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const updatedAt = resolveUpdatedAt(clientUpdatedAt);
  const row = await sql<{ user_id: string; updated_at: string }>`
    select user_id, updated_at from folio_bookmarks where id = ${id}`;
  if (!row[0]) return { rejected: { id, table: "bookmarks", code: "not_found" } };
  if (row[0].user_id !== uid) return { rejected: { id, table: "bookmarks", code: "forbidden" } };
  if (isNewer(row[0].updated_at, updatedAt)) return { rejected: { id, table: "bookmarks", code: "stale" } };
  await sql`update folio_bookmarks
    set deleted_at = ${updatedAt}::timestamptz, updated_at = ${updatedAt}::timestamptz
    where id = ${id} and user_id = ${uid}`;
  return { accepted: { id, table: "bookmarks", updatedAt } };
}

export async function putTag(
  sql: Sql,
  uid: string,
  id: string,
  row: Record<string, unknown>,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp; tagId?: string }> {
  const name = str(row.name).slice(0, 40);
  if (!name) return { rejected: { id, table: "tags", code: "invalid" } };
  const updatedAt = resolveUpdatedAt(str(row.updatedAt) || str(row.createdAt) || undefined);
  const existing = await sql<{ user_id: string; updated_at: string }>`
    select user_id, updated_at from folio_tags where id = ${id}`;
  if (existing[0] && existing[0].user_id !== uid) return { rejected: { id, table: "tags", code: "forbidden" } };
  if (existing[0] && isNewer(existing[0].updated_at, updatedAt)) {
    return { rejected: { id, table: "tags", code: "stale" } };
  }
  await sql`insert into folio_tags (id, user_id, name, emoji, kind, updated_at, deleted_at)
    values (${id}, ${uid}, ${name}, ${str(row.emoji).slice(0, 8)}, ${str(row.kind, "custom")}, ${updatedAt}::timestamptz, ${null})
    on conflict (id) do update set
      name = excluded.name, emoji = excluded.emoji, kind = excluded.kind,
      updated_at = excluded.updated_at, deleted_at = null
    where folio_tags.user_id = ${uid} and folio_tags.updated_at <= excluded.updated_at`;
  return { accepted: { id, table: "tags", updatedAt }, tagId: id };
}

export async function deleteTag(
  sql: Sql,
  uid: string,
  id: string,
  clientUpdatedAt?: string,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const updatedAt = resolveUpdatedAt(clientUpdatedAt);
  const row = await sql<{ user_id: string }>`select user_id from folio_tags where id = ${id}`;
  if (!row[0] || row[0].user_id !== uid) return { rejected: { id, table: "tags", code: "not_found" } };
  await sql`update folio_tags
    set deleted_at = ${updatedAt}::timestamptz, updated_at = ${updatedAt}::timestamptz
    where id = ${id} and user_id = ${uid}`;
  return { accepted: { id, table: "tags", updatedAt } };
}

export async function createBlob(
  sql: Sql,
  uid: string,
  input: { id?: string; mime?: string; byteLength?: number; sha256?: string },
): Promise<{ id: string; putPath: string; getPath: string }> {
  const id = str(input.id) || crypto.randomUUID();
  const mime = str(input.mime, "audio/webm").slice(0, 80);
  const byteLength = num(input.byteLength);
  const sha = str(input.sha256).slice(0, 64);
  if (byteLength > BLOB_MAX_BYTES) throw Object.assign(new Error("too_long"), { status: 413 });
  await sql`insert into folio_blobs (id, user_id, sha256, byte_length, mime, state)
    values (${id}, ${uid}, ${sha}, ${byteLength}, ${mime}, ${"pending"})
    on conflict (id) do update set mime = excluded.mime, byte_length = excluded.byte_length, sha256 = excluded.sha256
    where folio_blobs.user_id = ${uid} and folio_blobs.state = ${"pending"}`;
  return { id, putPath: `/api/native/v1/blobs/${id}/data`, getPath: `/api/native/v1/blobs/${id}` };
}

export async function putBlobBytes(
  sql: Sql,
  uid: string,
  id: string,
  bytes: Uint8Array,
): Promise<{ ok: true } | { error: string; status: number }> {
  if (bytes.byteLength > BLOB_MAX_BYTES) return { error: "too_long", status: 413 };
  const row = await sql<{ user_id: string; state: string; byte_length: number }>`
    select user_id, state, byte_length from folio_blobs where id = ${id}`;
  if (!row[0] || row[0].user_id !== uid) return { error: "not_found", status: 404 };
  const sha = sha256Bytes(bytes);
  await sql`update folio_blobs
    set bytes_b64 = ${bytesToB64(bytes)}, sha256 = ${sha}, byte_length = ${bytes.byteLength}
    where id = ${id} and user_id = ${uid}`;
  return { ok: true };
}

export async function completeBlob(
  sql: Sql,
  uid: string,
  id: string,
): Promise<{ ok: true; sha256: string; byteLength: number } | { error: string; status: number }> {
  const row = await sql<{
    user_id: string;
    bytes_b64: string;
    sha256: string;
    byte_length: number;
    state: string;
  }>`select user_id, bytes_b64, sha256, byte_length, state from folio_blobs where id = ${id}`;
  if (!row[0] || row[0].user_id !== uid) return { error: "not_found", status: 404 };
  if (!row[0].bytes_b64) return { error: "empty", status: 409 };
  const raw = b64ToBytes(row[0].bytes_b64);
  if (row[0].byte_length > 0 && raw.byteLength !== Number(row[0].byte_length) && Number(row[0].byte_length) !== 0) {
    if (raw.byteLength === 0) return { error: "empty", status: 409 };
  }
  const sha = sha256Bytes(raw);
  await sql`update folio_blobs
    set state = ${"ready"}, sha256 = ${sha}, byte_length = ${raw.byteLength}
    where id = ${id} and user_id = ${uid}`;
  return { ok: true, sha256: sha, byteLength: raw.byteLength };
}

export async function readBlob(
  sql: Sql,
  uid: string,
  id: string,
): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const mine = await sql<{ mime: string; bytes_b64: string; state: string; user_id: string }>`
    select mime, bytes_b64, state, user_id from folio_blobs where id = ${id}`;
  if (mine[0]?.user_id === uid && mine[0].state === "ready" && mine[0].bytes_b64) {
    return { mime: mine[0].mime, bytes: b64ToBytes(mine[0].bytes_b64) };
  }
  const shared = await sql<{ mime: string; bytes_b64: string }>`
    select b.mime, b.bytes_b64
    from folio_blobs b
    join folio_voice_notes v on v.id = b.id
    where b.id = ${id} and b.state = ${"ready"}
      and (v.user_id = ${uid} or v.club_id in (
        select club_id from folio_club_members where user_id = ${uid}
      ))`;
  if (shared[0]?.bytes_b64) return { mime: shared[0].mime, bytes: b64ToBytes(shared[0].bytes_b64) };
  return null;
}

export async function ingestB64Blob(
  sql: Sql,
  uid: string,
  id: string,
  audioB64: string,
  mime: string,
): Promise<{ sha256: string; byteLength: number } | { error: string; status: number }> {
  if (!audioB64) return { error: "empty", status: 400 };
  if (audioB64.length > BLOB_MAX_BYTES) return { error: "too_long", status: 413 };
  const bytes = b64ToBytes(audioB64);
  if (bytes.byteLength > BLOB_MAX_BYTES) return { error: "too_long", status: 413 };
  await createBlob(sql, uid, { id, mime, byteLength: bytes.byteLength });
  const put = await putBlobBytes(sql, uid, id, bytes);
  if (!("ok" in put)) return put;
  const done = await completeBlob(sql, uid, id);
  if (!("ok" in done)) return done;
  return { sha256: done.sha256, byteLength: done.byteLength };
}

export async function putVoice(
  sql: Sql,
  uid: string,
  displayName: string,
  id: string,
  row: Record<string, unknown>,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const highlightId = str(row.highlightId);
  if (!highlightId) return { rejected: { id, table: "voices", code: "invalid" } };
  const updatedAt = resolveUpdatedAt(str(row.updatedAt) || str(row.createdAt) || undefined);
  const owned = await sql<{ id: string; club_id: string | null }>`
    select id, club_id from folio_highlights
    where id = ${highlightId}
      and deleted_at is null
      and (user_id = ${uid} or club_id in (
        select club_id from folio_club_members where user_id = ${uid}
      ))`;
  if (!owned[0]) return { rejected: { id, table: "voices", code: "not_found" } };

  const existing = await sql<{ user_id: string; is_companion: boolean | null; updated_at: string }>`
    select user_id, is_companion, updated_at from folio_voice_notes where id = ${id}`;
  if (existing[0]?.is_companion) return { rejected: { id, table: "voices", code: "companion" } };
  if (existing[0] && existing[0].user_id !== uid) return { rejected: { id, table: "voices", code: "forbidden" } };
  if (existing[0] && isNewer(existing[0].updated_at, updatedAt)) {
    return { rejected: { id, table: "voices", code: "stale" } };
  }

  const audioB64 = str(row.audioB64);
  if (audioB64) {
    const ingested = await ingestB64Blob(sql, uid, id, audioB64, str(row.mime, "audio/webm"));
    if ("error" in ingested) {
      return { rejected: { id, table: "voices", code: ingested.status === 413 ? "invalid" : "blob_missing" } };
    }
  }

  const blob = await sql<{ state: string; sha256: string; byte_length: number }>`
    select state, sha256, byte_length from folio_blobs where id = ${id} and user_id = ${uid}`;
  if (!blob[0] || blob[0].state !== "ready") {
    return { rejected: { id, table: "voices", code: "blob_missing" } };
  }

  const authorName = str(row.authorName, displayName).slice(0, 40);
  const audioUrl = `/api/native/v1/blobs/${id}`;
  await sql`insert into folio_voice_notes (
      id, user_id, highlight_id, transcript, audio_b64, mime, duration_ms, author_name, reply_to, audio_url,
      is_companion, club_id, updated_at, deleted_at, sha256, byte_length
    ) values (
      ${id}, ${uid}, ${highlightId}, ${str(row.transcript).slice(0, 8000)}, ${""}, ${str(row.mime, "audio/webm")},
      ${num(row.durationMs)}, ${authorName}, ${str(row.replyTo) || null}, ${audioUrl}, ${false}, ${owned[0].club_id},
      ${updatedAt}::timestamptz, ${null}, ${blob[0].sha256}, ${Number(blob[0].byte_length)}
    )
    on conflict (id) do update set
      transcript = excluded.transcript,
      mime = excluded.mime,
      duration_ms = excluded.duration_ms,
      audio_url = excluded.audio_url,
      sha256 = excluded.sha256,
      byte_length = excluded.byte_length,
      updated_at = excluded.updated_at,
      deleted_at = null
    where folio_voice_notes.user_id = ${uid}
      and coalesce(folio_voice_notes.is_companion, false) = false
      and folio_voice_notes.updated_at <= excluded.updated_at`;
  return { accepted: { id, table: "voices", updatedAt } };
}

export async function deleteVoice(
  sql: Sql,
  uid: string,
  id: string,
  clientUpdatedAt?: string,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const updatedAt = resolveUpdatedAt(clientUpdatedAt);
  const row = await sql<{ user_id: string; is_companion: boolean | null; updated_at: string }>`
    select user_id, is_companion, updated_at from folio_voice_notes where id = ${id}`;
  if (!row[0]) return { rejected: { id, table: "voices", code: "not_found" } };
  if (row[0].is_companion) return { rejected: { id, table: "voices", code: "companion" } };
  if (row[0].user_id !== uid) return { rejected: { id, table: "voices", code: "forbidden" } };
  if (isNewer(row[0].updated_at, updatedAt)) return { rejected: { id, table: "voices", code: "stale" } };
  await sql`update folio_voice_notes
    set deleted_at = ${updatedAt}::timestamptz, updated_at = ${updatedAt}::timestamptz
    where id = ${id} and user_id = ${uid}`;
  return { accepted: { id, table: "voices", updatedAt } };
}

export async function applyOp(
  sql: Sql,
  uid: string,
  displayName: string,
  fallbackSettings: FolioSettings,
  op: SyncOp,
): Promise<{ accepted?: AcceptedOp; rejected?: RejectedOp }> {
  const table = op.table;
  const id = str(op.id);
  const row = op.row ?? {};
  if (op.op === "put") {
    switch (table) {
      case "progress":
        return putProgress(sql, uid, { ...row, id, updatedAt: op.updatedAt ?? row.updatedAt });
      case "settings":
        return putSettings(sql, uid, { ...row, updatedAt: op.updatedAt ?? row.updatedAt }, fallbackSettings);
      case "highlights":
        return putHighlight(sql, uid, displayName, id, { ...row, updatedAt: op.updatedAt ?? row.updatedAt });
      case "bookmarks":
        return putBookmark(sql, uid, id, { ...row, updatedAt: op.updatedAt ?? row.updatedAt });
      case "tags":
        return putTag(sql, uid, id, { ...row, updatedAt: op.updatedAt ?? row.updatedAt });
      case "voices":
        return putVoice(sql, uid, displayName, id, { ...row, updatedAt: op.updatedAt ?? row.updatedAt });
      default:
        return { rejected: { id, table, code: "invalid" } };
    }
  }
  switch (table) {
    case "highlights":
      return deleteHighlight(sql, uid, id, op.updatedAt);
    case "bookmarks":
      return deleteBookmark(sql, uid, id, op.updatedAt);
    case "tags":
      return deleteTag(sql, uid, id, op.updatedAt);
    case "voices":
      return deleteVoice(sql, uid, id, op.updatedAt);
    default:
      return { rejected: { id, table, code: "invalid" } };
  }
}

export async function applyPush(
  sql: Sql,
  uid: string,
  displayName: string,
  fallbackSettings: FolioSettings,
  ops: SyncOp[],
): Promise<{ accepted: AcceptedOp[]; rejected: RejectedOp[] }> {
  const accepted: AcceptedOp[] = [];
  const rejected: RejectedOp[] = [];
  for (const op of ops.slice(0, PUSH_MAX_OPS)) {
    const result = await applyOp(sql, uid, displayName, fallbackSettings, op);
    if (result.accepted) accepted.push(result.accepted);
    if (result.rejected) rejected.push(result.rejected);
  }
  return { accepted, rejected };
}

export type { Tag };
