import { createHash } from "node:crypto";
import { getSql } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/verify.server";
import { BRUSHES, brushPrompt, parsePrintJson, type PrintSlip, type PrintSource, type RunBrushInput } from "./brushes";
import type { TagKind } from "./types";

const MAX_TOKENS = 520;
const cache = new Map<string, PrintSlip>();

function cacheKey(kind: string, passage: string, note: string) {
  return createHash("sha256").update(`${kind}\n${passage}\n${note}`).digest("hex").slice(0, 32);
}

type ChatResult = { text: string; citations: string[] };

async function chat(apiKey: string, prompt: string, search: boolean): Promise<ChatResult> {
  const body: Record<string, unknown> = {
    model: "grok-4.5",
    max_tokens: MAX_TOKENS,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  };
  if (search) {
    body.search_parameters = { mode: "on", return_citations: true };
  }
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    if (search) return chat(apiKey, prompt, false);
    throw new Error(`xAI ${res.status}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  };
  return {
    text: json.choices?.[0]?.message?.content ?? "",
    citations: Array.isArray(json.citations) ? json.citations.filter((u) => typeof u === "string") : [],
  };
}

function mergeSources(slip: PrintSlip, citations: string[]): PrintSlip {
  if (!citations.length) return slip;
  const have = new Set(slip.sources.map((s) => s.url));
  const extra: PrintSource[] = [];
  for (const url of citations) {
    if (!url || have.has(url)) continue;
    have.add(url);
    extra.push({ title: url.replace(/^https?:\/\//, "").slice(0, 80), url });
  }
  return { ...slip, sources: [...slip.sources, ...extra].slice(0, 8) };
}

function rowToPrint(r: {
  id: string;
  highlight_id: string;
  tag_kind: string;
  kicker: string;
  title: string;
  body: string;
  sources_json: string;
  created_at: string;
}): PrintSlip {
  let sources: PrintSource[] = [];
  try {
    sources = JSON.parse(r.sources_json) as PrintSource[];
  } catch {
    sources = [];
  }
  return {
    id: r.id,
    highlightId: r.highlight_id,
    kind: r.tag_kind as TagKind,
    kicker: r.kicker,
    title: r.title,
    body: r.body,
    sources,
    createdAt: String(r.created_at),
  };
}

export async function loadPrintsForBook(uid: string, bookId: string): Promise<PrintSlip[]> {
  const sql = await getSql();
  try {
    const rows = await sql<{
      id: string;
      highlight_id: string;
      tag_kind: string;
      kicker: string;
      title: string;
      body: string;
      sources_json: string;
      created_at: string;
    }>`select p.id, p.highlight_id, p.tag_kind, p.kicker, p.title, p.body, p.sources_json, p.created_at
       from folio_prints p
       join folio_highlights h on h.id = p.highlight_id
       where p.user_id = ${uid} and h.book_id = ${bookId}`;
    return rows.map(rowToPrint);
  } catch {
    return [];
  }
}

export async function persistPrint(uid: string, print: PrintSlip) {
  const sql = await getSql();
  await sql.query(`
    create table if not exists folio_prints (
      id text primary key,
      user_id text not null,
      highlight_id text not null,
      tag_kind text not null,
      kicker text not null default '',
      title text not null default '',
      body text not null default '',
      sources_json text not null default '[]',
      created_at timestamptz not null default now(),
      unique (user_id, highlight_id, tag_kind)
    )`);
  await sql`insert into folio_prints (id, user_id, highlight_id, tag_kind, kicker, title, body, sources_json)
    values (${print.id}, ${uid}, ${print.highlightId}, ${print.kind}, ${print.kicker}, ${print.title}, ${print.body}, ${JSON.stringify(print.sources)})
    on conflict (user_id, highlight_id, tag_kind) do update set
      kicker = excluded.kicker,
      title = excluded.title,
      body = excluded.body,
      sources_json = excluded.sources_json`;
}

export async function executeBrush(
  data: RunBrushInput,
): Promise<{ ok: true; print: PrintSlip; cached: boolean } | { ok: false; error: string }> {
  const kind: TagKind = BRUSHES[data.kind] ? data.kind : "custom";
  const spec = BRUSHES[kind];
  const passage = (data.passage || "").slice(0, 1200);
  const note = (data.note || "").slice(0, 800);
  if (!passage.trim()) return { ok: false, error: "Nothing marked" };

  const key = cacheKey(kind, passage, note);
  if (!data.force && cache.has(key)) {
    const cached = { ...cache.get(key)!, highlightId: data.highlightId };
    return { ok: true, print: cached, cached: true };
  }

  let uid: string | null = null;
  try {
    const user = await getSessionUser();
    uid = user?.id ?? null;
  } catch {
    uid = null;
  }

  if (uid && data.highlightId && !data.force) {
    try {
      const sql = await getSql();
      const existing = await sql<{
        id: string;
        highlight_id: string;
        tag_kind: string;
        kicker: string;
        title: string;
        body: string;
        sources_json: string;
        created_at: string;
      }>`select id, highlight_id, tag_kind, kicker, title, body, sources_json, created_at
         from folio_prints
         where user_id = ${uid} and highlight_id = ${data.highlightId} and tag_kind = ${kind}
         limit 1`;
      if (existing[0]) {
        const print = rowToPrint(existing[0]);
        cache.set(key, print);
        return { ok: true, print, cached: true };
      }
    } catch {
      /* table may not be migrated yet */
    }
  }

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "The margin is quiet — printing is not available here." };

  const prompt = brushPrompt({
    kind,
    passage,
    note,
    context: (data.context || "").slice(0, 1400),
    bookTitle: (data.bookTitle || "").slice(0, 160),
    author: (data.author || "").slice(0, 120),
    chapterTitle: (data.chapterTitle || "").slice(0, 160),
  });

  try {
    const result = await chat(apiKey, prompt, spec.search);
    if (!result.text.trim()) return { ok: false, error: "Nothing came back" };
    let print = parsePrintJson(result.text, kind, data.highlightId);
    print = mergeSources(print, result.citations);
    print.id = crypto.randomUUID();
    cache.set(key, print);
    if (uid && data.highlightId) {
      try {
        await persistPrint(uid, print);
      } catch {
        /* keep the slip in the session even if the shelf missed it */
      }
    }
    return { ok: true, print, cached: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "print failed";
    return { ok: false, error: message };
  }
}
