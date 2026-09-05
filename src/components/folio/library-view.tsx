import { useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Paperclip, Search, Upload } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { apiImportEpubFile, apiImportGutenberg, apiImportHtmlFile, apiJoinClub, searchGutenberg, type GutenbergHit } from "@/lib/folio/api";
import { useFolioUi } from "@/lib/folio/store";
import { BookCover } from "./book-cover";
import { useFolio } from "./folio-state";
import { Sidebar } from "./sidebar";

export function LibraryView() {
  const { ready, authed, books, progress, refresh, settings, clubs, displayName } = useFolio();
  const device = useFolioUi((s) => s.device);
  const setSidebar = useFolioUi((s) => s.setSidebar);
  const sidebarOpen = useFolioUi((s) => s.sidebarOpen);
  const showToast = useFolioUi((s) => s.showToast);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GutenbergHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const phone = device === "phone";
  const circle = clubs.find((c) => c.bookId === "living-structure") ?? clubs[0];

  const last = [...progress].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const continueBook = last ? books.find((b) => b.bookId === last.bookId) : books[0];

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const res = await searchGutenberg({ data: query });
      setHits(res);
      if (res.length === 0) showToast("No public-domain matches");
    } catch {
      showToast("Gutenberg is quiet — try again");
    } finally {
      setSearching(false);
    }
  }

  async function onImport(hit: GutenbergHit) {
    if (!hit.epubUrl) {
      showToast("No EPUB for that title");
      return;
    }
    setImporting(hit.title);
    try {
      await apiImportGutenberg({
        id: hit.id, title: hit.title, authors: hit.authors, epubUrl: hit.epubUrl,
      });
      await refresh();
      showToast(`Shelved · ${hit.title}`);
      setHits(null);
      setQuery("");
    } catch {
      showToast("Could not fetch that EPUB");
    } finally {
      setImporting(null);
    }
  }

  async function onUpload(file: File) {
    setImporting(file.name);
    try {
      const isHtml = /\.html?$/i.test(file.name) || file.type.includes("html");
      if (isHtml) await apiImportHtmlFile(file);
      else await apiImportEpubFile(file);
      await refresh();
      showToast(`Shelved · ${file.name}`);
    } catch {
      showToast("Could not parse that file");
    } finally {
      setImporting(null);
    }
  }

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    const res = await apiJoinClub({ code: joinCode, displayName });
    if (!res.ok) {
      showToast(res.error || "Could not join");
      return;
    }
    await refresh();
    showToast("You are in the circle");
    if (res.bookId) void navigate({ to: "/read/$bookId", params: { bookId: res.bookId } });
  }

  return (
    <div className="relative flex h-full flex-col bg-paper text-ink">
      <header className="grid grid-cols-[72px_1fr_72px] items-center px-4 pt-7 pb-3">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setSidebar(true, "search")}
          className="grid size-11 place-items-center rounded-full text-ink transition-transform duration-150 active:scale-[0.96]"
        >
          <Paperclip className="size-5" strokeWidth={1.5} />
        </button>
        <div className="text-center">
          <div className="font-serif text-[28px] leading-none tracking-tight">Folio</div>
          <div className="mt-1 font-ui text-[11px] tracking-[0.2em] text-ink-soft uppercase">
            Read · Mark · Speak
          </div>
        </div>
        <div className="max-w-[168px] text-right">
          {authed ? (
            <div className="scale-90 [&_span]:font-ui [&_span]:text-xs">
              <UserButton />
            </div>
          ) : (
            <Link to="/login" className="font-ui text-[11px] tracking-wide uppercase">
              Sync
            </Link>
          )}
        </div>
      </header>

      <div className="mx-6 h-px bg-rule" />

      <div className="flex-1 overflow-y-auto px-6 pt-6 pb-10">
        {!ready ? (
          <div className="font-serif text-lg text-ink-soft">Opening the shelf…</div>
        ) : (
          <>
            {circle && (
              <Link
                to="/read/$bookId"
                params={{ bookId: circle.bookId }}
                className="mb-6 block border border-ink bg-paper-2 p-5"
              >
                <div className="font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">A circle</div>
                <div className="mt-1 font-serif text-[26px] leading-tight">{circle.name}</div>
                <div className="mt-1 text-sm text-ink-soft">
                  {circle.members.map((m) => m.displayName).join(" · ")}
                </div>
                <p className="mt-3 font-serif text-[15px] leading-snug">
                  Theo left voices on Living Structure. Open the book, tap a marked sentence, hear him, answer in yours.
                </p>
                <div className="mt-3 font-ui text-[11px] tracking-wide text-ink-soft uppercase">
                  Invite {circle.inviteCode}
                </div>
              </Link>
            )}

            {continueBook && (
              <Link
                to="/read/$bookId"
                params={{ bookId: continueBook.bookId }}
                className="mb-8 block border border-rule bg-paper p-5 transition-transform duration-150 active:scale-[0.99]"
              >
                <div className="font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">Continue</div>
                <div className="mt-1 font-serif text-[26px] leading-tight">{continueBook.title}</div>
                <div className="mt-1 text-sm text-ink-soft">{continueBook.author}</div>
                {last && (
                  <div className="mt-3 h-[2px] bg-rule">
                    <div className="h-full bg-ink" style={{ width: `${Math.min(100, last.percent)}%` }} />
                  </div>
                )}
              </Link>
            )}

            <form onSubmit={onSearch} className="mb-4 flex gap-2">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search Gutenberg, or Alexander…"
                  aria-label="Search the public stacks"
                  className="h-12 w-full border border-rule bg-paper pr-3 pl-10 font-serif text-base text-ink outline-none placeholder:text-ink-faint focus:border-rule-strong"
                />
              </label>
              <button
                type="submit"
                disabled={searching}
                className="h-12 shrink-0 border border-rule px-4 font-ui text-[12px] tracking-wide text-ink uppercase disabled:opacity-50"
              >
                {searching ? "…" : "Find"}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="grid size-12 shrink-0 place-items-center border border-rule"
                aria-label="Upload EPUB or HTML"
              >
                <Upload className="size-4" strokeWidth={1.5} />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".epub,.html,.htm,application/epub+zip,text/html"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onUpload(f);
                  e.target.value = "";
                }}
              />
            </form>

            <form onSubmit={onJoin} className="mb-6 flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Join a circle · ALEX-…"
                aria-label="Join a reading circle"
                className="h-11 min-w-0 flex-1 border border-rule bg-paper px-3 font-ui text-[13px] tracking-wide outline-none"
              />
              <button type="submit" className="h-11 border border-rule px-4 font-ui text-[11px] tracking-wide uppercase">
                Join
              </button>
            </form>

            {hits && (
              <div className="mb-8 border border-rule">
                <div className="flex items-center justify-between border-b border-rule px-4 py-3">
                  <div className="font-ui text-[11px] tracking-[0.16em] text-ink-soft uppercase">
                    Public stacks
                  </div>
                  <button type="button" className="text-sm text-ink-soft" onClick={() => setHits(null)}>
                    Close
                  </button>
                </div>
                {hits.length === 0 ? (
                  <p className="px-4 py-5 font-serif text-ink-soft">
                    Nothing in Gutenberg for that. Alexander’s own books are still in copyright — try{" "}
                    <em>Living Structure</em> on the shelf, or Vitruvius.
                  </p>
                ) : (
                  <ul>
                    {hits.map((h) => (
                      <li key={h.id} className="flex items-center justify-between gap-3 border-t border-rule px-4 py-3">
                        <div className="min-w-0">
                          <div className="truncate font-serif text-[17px]">{h.title}</div>
                          <div className="truncate text-[12px] text-ink-soft">{h.authors}</div>
                        </div>
                        <button
                          type="button"
                          disabled={!h.epubUrl || importing === h.title}
                          onClick={() => void onImport(h)}
                          className="shrink-0 font-ui text-[11px] tracking-wide uppercase disabled:opacity-40"
                        >
                          {importing === h.title ? "Fetching…" : "Shelve"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">Shelf</div>
            <div className={phone ? "grid grid-cols-1 gap-4" : "grid grid-cols-2 gap-5"}>
              {books.map((b) => {
                const p = progress.find((x) => x.bookId === b.bookId);
                return (
                  <Link key={b.id} to="/read/$bookId" params={{ bookId: b.bookId }} className="block">
                    <BookCover title={b.title} author={b.author} label={b.coverLabel} compact={phone} />
                    {p && p.percent > 0 && (
                      <div className="mt-2 h-[2px] bg-rule">
                        <div className="h-full bg-ink" style={{ width: `${Math.min(100, p.percent)}%` }} />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>

            <p className="mt-10 max-w-prose font-serif text-sm leading-relaxed text-ink-soft">
              {settings.gloss
                ? "Gloss is on: tap a word for the teacher’s margin. Hold a link to peek without leaving the page."
                : "Two taps a word, three a sentence. Hold a link to peek. Hold the microphone when a feeling is faster than a keyboard."}
            </p>
            <p className="mt-4 font-ui text-[11px] tracking-wide text-ink-faint uppercase">
              <Link to="/native" className="underline decoration-rule underline-offset-4">
                Native · DC-1 Kotlin · iPhone Swift
              </Link>
            </p>
          </>
        )}
      </div>

      {sidebarOpen && <Sidebar library />}
      <Toast />
    </div>
  );
}

function Toast() {
  const toast = useFolioUi((s) => s.toast);
  if (!toast) return null;
  return (
    <div className="absolute bottom-8 left-1/2 z-40 -translate-x-1/2 border border-rule bg-ink px-4 py-2 font-ui text-[13px] text-paper shadow-sm">
      {toast}
    </div>
  );
}
