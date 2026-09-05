import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  apiAddTag,
  apiDeleteTag,
  apiLoadAllMarks,
  suggestClusters,
} from "@/lib/folio/api";
import { useFolioUi } from "@/lib/folio/store";
import type { Book, Bookmark, Club, Highlight, Tag, VoiceNote } from "@/lib/folio/types";
import { useFolio } from "./folio-state";
import { SettingsPanel } from "./settings-panel";

const TABS = [
  { id: "book", label: "In this book" },
  { id: "circle", label: "Circle" },
  { id: "marks", label: "Marks" },
  { id: "tags", label: "Tags" },
  { id: "search", label: "Search" },
  { id: "settings", label: "Settings" },
] as const;

export function Sidebar({
  library,
  book,
  highlights = [],
  bookmarks = [],
  tags = [],
  voices = [],
  club = null,
  onJump,
  onOpenHighlight,
  onTagsChange,
}: {
  library?: boolean;
  book?: Book | null;
  highlights?: Highlight[];
  bookmarks?: Bookmark[];
  tags?: Tag[];
  voices?: VoiceNote[];
  club?: Club | null;
  onJump?: (chapterIndex: number, pageIndex: number) => void;
  onOpenHighlight?: (id: string) => void;
  onTagsChange?: () => void;
}) {
  const tab = useFolioUi((s) => s.sidebarTab);
  const setSidebar = useFolioUi((s) => s.setSidebar);
  const device = useFolioUi((s) => s.device);
  const wide = device === "dc1" ? "w-[62%]" : "w-[86%]";

  return (
    <div className="absolute inset-0 z-30 flex bg-ink/25">
      <aside className={cn("sidebar-enter relative flex h-full flex-col bg-paper text-ink shadow-xl", wide)}>
        <div className="flex items-center justify-between px-5 pt-6 pb-3">
          <div className="font-serif text-xl">Folio</div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSidebar(false)}
            className="grid size-11 place-items-center"
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b border-rule px-3">
          {TABS.map((t) => {
            if (library && t.id === "book") return null;
            if (library && t.id === "circle") return null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSidebar(true, t.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-3 font-ui text-[12px] tracking-wide whitespace-nowrap uppercase",
                  tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-soft",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {tab === "book" && (
            <BookPane
              book={book}
              highlights={highlights}
              bookmarks={bookmarks}
              onJump={onJump}
              onOpenHighlight={onOpenHighlight}
            />
          )}
          {tab === "circle" && (
            <CirclePane club={club} highlights={highlights} voices={voices} onOpenHighlight={onOpenHighlight} />
          )}
          {tab === "marks" && (
            <MarksPane onOpenHighlight={onOpenHighlight} currentBookId={book?.id} />
          )}
          {tab === "tags" && (
            <TagsPane
              tags={tags}
              highlights={highlights}
              onOpenHighlight={onOpenHighlight}
              onTagsChange={onTagsChange}
            />
          )}
          {tab === "search" && <SearchPane />}
          {tab === "settings" && <SettingsPanel />}
        </div>
      </aside>
      <button type="button" className="h-full flex-1" aria-label="Dismiss menu" onClick={() => setSidebar(false)} />
    </div>
  );
}

function BookPane({
  book,
  highlights,
  bookmarks,
  onJump,
  onOpenHighlight,
}: {
  book?: Book | null;
  highlights: Highlight[];
  bookmarks: Bookmark[];
  onJump?: (chapterIndex: number, pageIndex: number) => void;
  onOpenHighlight?: (id: string) => void;
}) {
  const setSidebar = useFolioUi((s) => s.setSidebar);
  if (!book) return <p className="font-serif text-ink-soft">Open a book to see its contents.</p>;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">Contents</h3>
        <ol className="space-y-1">
          {book.chapters.map((ch, i) => (
            <li key={ch.id}>
              <button
                type="button"
                className="w-full py-2 text-left font-serif text-[18px] leading-snug"
                onClick={() => {
                  onJump?.(i, 0);
                  setSidebar(false);
                }}
              >
                {ch.title}
              </button>
            </li>
          ))}
        </ol>
      </section>
      <section>
        <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">
          Bookmarks · {bookmarks.length}
        </h3>
        {bookmarks.length === 0 ? (
          <p className="font-serif text-ink-soft">Tap the ribbon on a page you want back.</p>
        ) : (
          <ul className="space-y-2">
            {bookmarks.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="text-left font-serif"
                  onClick={() => {
                    onJump?.(b.chapterIndex, b.pageIndex);
                    setSidebar(false);
                  }}
                >
                  {b.label || `Chapter ${b.chapterIndex + 1}, page ${b.pageIndex + 1}`}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">
          Marks in this book · {highlights.length}
        </h3>
        <HighlightList
          items={highlights}
          onOpen={(id) => {
            onOpenHighlight?.(id);
            setSidebar(false);
          }}
        />
      </section>
    </div>
  );
}

function CirclePane({
  club,
  highlights,
  voices,
  onOpenHighlight,
}: {
  club?: Club | null;
  highlights: Highlight[];
  voices: VoiceNote[];
  onOpenHighlight?: (id: string) => void;
}) {
  const setSidebar = useFolioUi((s) => s.setSidebar);
  if (!club) {
    return (
      <p className="font-serif text-ink-soft">
        Open <em>Living Structure</em> to sit in Alexander Circle with Theo, or start a circle from the shelf.
      </p>
    );
  }
  const voiced = highlights.filter((h) => voices.some((v) => v.highlightId === h.id));
  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-serif text-2xl leading-tight">{club.name}</h3>
        <p className="mt-2 font-serif text-[15px] text-ink-soft">
          {club.members.map((m) => m.displayName).join(", ")}
        </p>
        <p className="mt-3 font-ui text-[12px] tracking-wide text-ink-soft">
          Invite · <span className="text-ink">{club.inviteCode}</span>
        </p>
      </section>
      <section>
        <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">
          Voices · {voices.length}
        </h3>
        {voiced.length === 0 ? (
          <p className="font-serif text-ink-soft">No voices on this book yet. Mark a sentence and hold the mic.</p>
        ) : (
          <ul className="space-y-3">
            {voiced.map((h) => {
              const n = voices.filter((v) => v.highlightId === h.id).length;
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      onOpenHighlight?.(h.id);
                      setSidebar(false);
                    }}
                  >
                    <p className="border-l-2 border-mark-strong pl-3 font-serif text-[16px] leading-snug">{h.text}</p>
                    <p className="mt-1 pl-3 font-ui text-[11px] text-ink-soft">
                      {n} {n === 1 ? "voice" : "voices"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function HighlightList({
  items,
  onOpen,
}: {
  items: Highlight[];
  onOpen: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="font-serif text-ink-soft">Two taps a word. Three a sentence. That’s a mark.</p>;
  }
  return (
    <ul className="space-y-4">
      {items.map((h) => (
        <li key={h.id}>
          <button type="button" onClick={() => onOpen(h.id)} className="w-full text-left">
            <p className="border-l-2 border-mark-strong pl-3 font-serif text-[16px] leading-snug">{h.text}</p>
            {h.note && <p className="mt-1 pl-3 text-[13px] text-ink-soft">{h.note}</p>}
          </button>
        </li>
      ))}
    </ul>
  );
}

function MarksPane({
  currentBookId,
  onOpenHighlight,
}: {
  currentBookId?: string;
  onOpenHighlight?: (id: string) => void;
}) {
  const { books } = useFolio();
  const setSidebar = useFolioUi((s) => s.setSidebar);
  const navigate = useNavigate();
  const [rows, setRows] = useState<Highlight[]>([]);
  const [voiced, setVoiced] = useState<Set<string>>(new Set());
  useEffect(() => {
    void apiLoadAllMarks().then((d) => {
      setRows(d.highlights);
      setVoiced(new Set(d.voicedIds));
    });
  }, []);
  return (
    <div>
      <p className="mb-5 font-serif text-ink-soft">Every sentence you refused to lose, across the shelf.</p>
      <ul className="space-y-5">
        {rows.map((h) => {
          const book = books.find((b) => b.bookId === h.bookId);
          return (
            <li key={h.id}>
              <div className="mb-1 font-ui text-[11px] tracking-wide text-ink-faint uppercase">
                {book?.title ?? h.bookId}
                {voiced.has(h.id) ? " · voice" : ""}
              </div>
              <button
                type="button"
                className="w-full text-left font-serif text-[16px] leading-snug"
                onClick={() => {
                  if (currentBookId === h.bookId) {
                    onOpenHighlight?.(h.id);
                    setSidebar(false);
                  } else {
                    setSidebar(false);
                    void navigate({ to: "/read/$bookId", params: { bookId: h.bookId } });
                  }
                }}
              >
                {h.text}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TagsPane({
  tags,
  highlights,
  onOpenHighlight,
  onTagsChange,
}: {
  tags: Tag[];
  highlights: Highlight[];
  onOpenHighlight?: (id: string) => void;
  onTagsChange?: () => void;
}) {
  const showToast = useFolioUi((s) => s.showToast);
  const { authed } = useFolio();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("※");
  const [busy, setBusy] = useState(false);
  const [clusters, setClusters] = useState<{ name: string; emoji: string; texts: string[] }[] | null>(null);
  const [picked, setPicked] = useState<Tag | null>(tags[0] ?? null);

  async function create() {
    if (!name.trim()) return;
    await apiAddTag({ name: name.trim(), emoji: emoji || "※", kind: "custom" });
    setName("");
    onTagsChange?.();
    showToast("Tag saved");
  }

  async function cluster() {
    if (!authed) {
      showToast("Sign in to group marks");
      return;
    }
    setBusy(true);
    try {
      const res = await suggestClusters();
      if (!res.ok) showToast(res.error || "Could not group marks");
      else setClusters(res.clusters);
    } catch {
      showToast("Could not group marks");
    } finally {
      setBusy(false);
    }
  }

  const tagged = picked ? highlights.filter((h) => h.tagIds.includes(picked.id)) : [];
  const references = highlights.filter((h) =>
    h.tagIds.some((id) => {
      const t = tags.find((x) => x.id === id);
      return t?.kind === "book" || t?.kind === "quote";
    }),
  );

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">Your tags</h3>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPicked(t)}
              className={cn(
                "border px-3 py-2 font-ui text-sm",
                picked?.id === t.id ? "border-ink bg-paper-2" : "border-rule",
              )}
            >
              <span className="mr-1">{t.emoji}</span>
              {t.name}
            </button>
          ))}
        </div>
        {picked && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-serif text-lg">
                {picked.emoji} {picked.name}
              </div>
              {picked.kind === "custom" && (
                <button
                  type="button"
                  className="text-[12px] text-ink-soft"
                  onClick={async () => {
                    await apiDeleteTag(picked.id);
                    setPicked(null);
                    onTagsChange?.();
                  }}
                >
                  Remove
                </button>
              )}
            </div>
            <HighlightList items={tagged} onOpen={(id) => onOpenHighlight?.(id)} />
          </div>
        )}
      </section>
      {references.length > 0 && (
        <section>
          <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">
            References · {references.length}
          </h3>
          <p className="mb-3 font-serif text-[14px] text-ink-soft">
            Quotes and books you pinned so they can be found again.
          </p>
          <HighlightList items={references} onOpen={(id) => onOpenHighlight?.(id)} />
        </section>
      )}
      <section>
        <h3 className="mb-3 font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">New tag</h3>
        <div className="flex gap-2">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
            className="h-11 w-14 border border-rule bg-paper text-center font-serif text-lg outline-none"
            aria-label="Tag mark"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Person, courtyard, book…"
            className="h-11 flex-1 border border-rule bg-paper px-3 font-serif outline-none"
          />
          <button type="button" onClick={() => void create()} className="h-11 px-3 font-ui text-[12px] uppercase">
            Add
          </button>
        </div>
      </section>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">Group my marks</h3>
          <button type="button" disabled={busy} onClick={() => void cluster()} className="text-[12px] uppercase">
            {busy ? "Reading…" : "Ask"}
          </button>
        </div>
        {clusters && clusters.length === 0 && (
          <p className="font-serif text-ink-soft">Mark a few sentences first, then ask again.</p>
        )}
        {clusters?.map((c) => (
          <div key={c.name} className="mb-4">
            <div className="mb-1 font-serif">
              {c.emoji} {c.name}
            </div>
            <ul className="space-y-1 text-[14px] text-ink-soft">
              {c.texts.slice(0, 4).map((t) => (
                <li key={t.slice(0, 40)} className="line-clamp-2">
                  {t}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}

function SearchPane() {
  const { books } = useFolio();
  return (
    <div className="space-y-4 font-serif">
      <p className="text-ink-soft">
        Search the public stacks from the shelf. Gutenberg is the plugin that ships. Other sources — a private
        library bot, a local folder — plug in through the same two functions: search, and fetch EPUB. Spec in
        Settings.
      </p>
      <ul className="space-y-2">
        {books.map((b) => (
          <li key={b.id}>
            <Link to="/read/$bookId" params={{ bookId: b.bookId }} className="block py-1">
              {b.title}
              <span className="text-ink-soft"> · {b.author}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
