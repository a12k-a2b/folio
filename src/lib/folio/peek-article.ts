export type PeekArticle = {
  url: string;
  title: string;
  site: string;
  author: string;
  excerpt: string;
  html: string;
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export async function fetchPeekArticle(rawUrl: string): Promise<{ ok: true; article: PeekArticle } | { ok: false; error: string }> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: "That address cannot be opened." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only web pages can be peeked." };
  }

  if (/(^|\.)wikipedia\.org$/i.test(url.hostname) && url.pathname.startsWith("/wiki/")) {
    const wiki = await fetchWikipedia(url);
    if (wiki) return { ok: true, article: wiki };
  }

  try {
    const res = await fetch(url.href, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent": UA,
      },
    });
    if (!res.ok) return { ok: false, error: `The page returned ${res.status}.` };
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text\/plain/i.test(type)) {
      return { ok: false, error: "That link is not a web page." };
    }
    const html = await res.text();
    const article = extractArticle(html, url);
    if (!article) return { ok: false, error: "That page does not look like an article." };
    return { ok: true, article };
  } catch {
    return { ok: false, error: "Could not reach that page." };
  }
}

async function fetchWikipedia(url: URL): Promise<PeekArticle | null> {
  const title = decodeURIComponent(url.pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ");
  const lang = url.hostname.split(".")[0] || "en";
  const api = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`;
  try {
    const res = await fetch(api, {
      headers: { accept: "application/json", "user-agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      title?: string;
      extract?: string;
      extract_html?: string;
      description?: string;
      content_urls?: { desktop?: { page?: string } };
    };
    const extract = body.extract ?? "";
    if (extract.length < 40) return null;
    const paras = extract
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${escapeHtml(p)}</p>`)
      .join("");
    return {
      url: body.content_urls?.desktop?.page || url.href,
      title: body.title || title,
      site: "Wikipedia",
      author: "",
      excerpt: body.description || extract.slice(0, 180),
      html: paras,
    };
  } catch {
    return null;
  }
}

function extractArticle(html: string, url: URL): PeekArticle | null {
  const title =
    pick(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ||
    pick(html, /<title[^>]*>([^<]+)/i) ||
    url.hostname;
  const author =
    pick(html, /<meta[^>]+(?:name|property)=["'](?:author|og:article:author)["'][^>]+content=["']([^"']+)/i) || "";
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const articleBlock =
    sliceTag(cleaned, "article") || sliceTag(cleaned, "main") || sliceTag(cleaned, "body") || cleaned;
  const paragraphs = [...articleBlock.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => strip(m[1] ?? "").trim())
    .filter((p) => p.length > 40 && p.length < 1200)
    .slice(0, 12);
  if (paragraphs.length < 1) return null;
  const htmlOut = paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("");
  return {
    url: url.href,
    title: strip(title).slice(0, 160),
    site: url.hostname.replace(/^www\./, ""),
    author: strip(author).slice(0, 80),
    excerpt: paragraphs[0]?.slice(0, 220) ?? "",
    html: htmlOut,
  };
}

function sliceTag(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(html);
  return m?.[1] ?? null;
}

function pick(html: string, re: RegExp): string {
  return re.exec(html)?.[1]?.trim() ?? "";
}

function strip(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&/g, "&")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}
