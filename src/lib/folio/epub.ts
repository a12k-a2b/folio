import JSZip from "jszip";
import type { Book, Chapter } from "./types";

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return m?.[1] ?? null;
}

function tags(xml: string, name: string): string[] {
  const re = new RegExp(`<${name}\\b([^>]*)\\/?>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[0]);
  return out;
}

function inner(xml: string, name: string): string {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "i");
  const m = xml.match(re);
  return (m?.[1] ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function resolveHref(base: string, href: string): string {
  const cleaned = (href.split("#")[0] ?? href).replace(/^\.\//, "");
  if (!base.includes("/")) return cleaned;
  const parts = base.split("/").slice(0, -1);
  for (const seg of cleaned.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}

function xhtmlToHtml(raw: string): string {
  const bodyMatch =
    raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i) ??
    raw.match(/<body[^>]*>([\s\S]*)/i);
  let html = bodyMatch?.[1] ?? raw;
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?(html|body|section|div|nav|header|footer)[^>]*>/gi, "")
    .replace(/<h1([^>]*)>/gi, "<h2$1>")
    .replace(/<\/h1>/gi, "</h2>")
    .replace(/\s+xmlns(:\w+)?="[^"]*"/g, "")
    .replace(/\s+xml:lang="[^"]*"/g, "");
  return html.trim() || "<p></p>";
}

export async function parseEpub(buf: ArrayBuffer, fallbackTitle = "Untitled"): Promise<Book> {
  const zip = await JSZip.loadAsync(buf);
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (!containerXml) throw new Error("Not an EPUB (missing container.xml)");
  const rootfileTag = tags(containerXml, "rootfile")[0];
  const rootfile = rootfileTag ? attr(rootfileTag, "full-path") : null;
  if (!rootfile) throw new Error("EPUB has no package document");
  const opfXml = await zip.file(rootfile)?.async("string");
  if (!opfXml) throw new Error("Missing OPF");
  const title = inner(opfXml, "title") || fallbackTitle;
  const author = inner(opfXml, "creator") || "Unknown";
  const itemTags = tags(opfXml, "item");
  const manifest = new Map<string, { href: string; type: string }>();
  for (const t of itemTags) {
    const id = attr(t, "id");
    const href = attr(t, "href");
    if (id && href) {
      manifest.set(id, { href, type: attr(t, "media-type") ?? "" });
    }
  }
  const spine = tags(opfXml, "itemref");
  const chapters: Chapter[] = [];
  let i = 0;
  for (const ref of spine) {
    const idref = attr(ref, "idref");
    if (!idref) continue;
    const item = manifest.get(idref);
    if (!item) continue;
    if (item.type && !/xhtml|html|xml/i.test(item.type)) continue;
    const path = resolveHref(rootfile, item.href);
    const raw = await zip.file(path)?.async("string");
    if (!raw) continue;
    const html = xhtmlToHtml(raw);
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain.length < 80) continue;
    i += 1;
    const h = html.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const chapterTitle = (h ? h[1].replace(/<[^>]+>/g, "") : `Chapter ${i}`).trim().slice(0, 80);
    chapters.push({ id: `ch-${i}`, title: chapterTitle || `Chapter ${i}`, html });
  }
  if (chapters.length === 0) throw new Error("EPUB had no readable chapters");
  return {
    id: `epub-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now().toString(36)}`,
    title,
    author,
    description: `${chapters.length} chapters from EPUB`,
    coverLabel: title.slice(0, 1).toUpperCase(),
    source: "upload",
    chapters,
  };
}

export function parseHtmlDocument(raw: string, filename = "Untitled"): Book {
  const cleaned = raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");
  const title =
    inner(cleaned, "title") ||
    filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") ||
    "Untitled";
  const html = xhtmlToHtml(cleaned);
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  return {
    id: `html-${slug}-${Date.now().toString(36)}`,
    title,
    author: "Uploaded HTML",
    description: "A single HTML leaf.",
    coverLabel: title.slice(0, 1).toUpperCase(),
    source: "upload",
    chapters: [{ id: "html-1", title, html: html || "<p></p>" }],
  };
}

export function bookToJson(book: Book): string {
  return JSON.stringify(book.chapters);
}
