import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/cn";
import { peekArticle } from "@/lib/folio/api";
import type { PeekArticle } from "@/lib/folio/peek-article";

export function PeekSheet({
  url,
  locked,
  onLock,
  onClose,
}: {
  url: string;
  locked: boolean;
  onLock: () => void;
  onClose: () => void;
}) {
  const startX = useRef<number | null>(null);
  const [article, setArticle] = useState<PeekArticle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const internal = url.startsWith("/read/");
  const bookId = internal ? url.replace("/read/", "").split("?")[0] : null;

  useEffect(() => {
    if (bookId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setArticle(null);
    void peekArticle({ data: url })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setArticle(res.article);
        else setError(res.error);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach that page.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, bookId]);

  return (
    <div
      className={cn(
        "absolute inset-y-0 right-0 z-30 flex flex-col border-l border-rule bg-paper",
        locked ? "w-[82%]" : "w-[72%]",
        "peek-enter",
      )}
      onPointerDown={(e) => {
        startX.current = e.clientX;
      }}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        startX.current = null;
        if (dx < -48) onLock();
        if (dx > 56) onClose();
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-ui text-[12px] text-ink-soft">
            {article?.site || article?.title || url}
          </div>
          <div className="font-ui text-[10px] tracking-[0.14em] text-ink-faint uppercase">
            {locked ? "Kept · swipe right to close" : "Hold · drag left to keep · lift to leave"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!locked && (
            <button type="button" onClick={onLock} className="px-2 font-ui text-[11px] uppercase">
              Keep
            </button>
          )}
          <button type="button" aria-label="Close peek" onClick={onClose} className="grid size-10 place-items-center">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
      {bookId ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-4 px-8">
          <p className="font-serif text-2xl leading-snug">This leaf is already on your shelf.</p>
          <Link
            to="/read/$bookId"
            params={{ bookId }}
            className="border border-ink bg-ink px-4 py-2.5 font-ui text-[12px] tracking-wide text-paper uppercase"
            onClick={onClose}
          >
            Open the book
          </Link>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {loading && (
            <p className="font-serif text-lg text-ink-soft">Lifting the page…</p>
          )}
          {error && !loading && (
            <div>
              <p className="font-serif text-lg leading-snug">{error}</p>
              <p className="mt-3 font-serif text-[15px] text-ink-soft">
                Some sites refuse to be read in a sheet. Drag left to keep this address, or let go.
              </p>
              <p className="mt-4 break-all font-ui text-[12px] text-ink-faint">{url}</p>
            </div>
          )}
          {article && (
            <article className="folio-prose" style={{ fontSize: 18, lineHeight: 1.55, textAlign: "left" }}>
              <p className="chapter-kicker">{article.site}{article.author ? ` · ${article.author}` : ""}</p>
              <h2>{article.title}</h2>
              <div dangerouslySetInnerHTML={{ __html: article.html }} />
            </article>
          )}
        </div>
      )}
    </div>
  );
}
