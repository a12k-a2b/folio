import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import { glossEntry, loadKnownGloss, saveKnownGloss, termsInText, wrapGlossHtml, type GlossEntry } from "@/lib/folio/glossary";
import { applyMarks, applyDraft, highlightIdFromTarget, suggestTagsLocal, tagIdsFromNames } from "@/lib/folio/marks";
import {
  apiAddBookmark,
  apiAddHighlight,
  apiDeleteBookmark,
  apiDeleteHighlight,
  apiLoadBook,
  apiSaveProgress,
  apiSaveVoice,
  apiUpdateHighlight,
  defineWord,
  suggestTagsForText,
} from "@/lib/folio/api";
import {
  expandToParagraphEl,
  expandToSentenceEl,
  expandToWord,
  offsetFromPoint,
  sliceText,
} from "@/lib/folio/sentences";
import { useFolioUi } from "@/lib/folio/store";
import {
  DC_HEIGHT,
  DC_WIDTH,
  LEADING,
  MEASURE_EM,
  PHONE_HEIGHT,
  PHONE_WIDTH,
  TYPE_PX,
  type Book,
  type Bookmark as BookmarkT,
  type Club,
  type Highlight,
  type Tag,
  type VoiceNote,
} from "@/lib/folio/types";
import { AnnotationSheet } from "./annotation-sheet";
import { ClubIntro, ClubRail } from "./club-rail";
import { useFolio } from "./folio-state";
import { GlossCard, GlossMargin } from "./gloss-margin";
import { PeekSheet } from "./peek-sheet";
import { Sidebar } from "./sidebar";
import { ThumbBar } from "./thumb-bar";

export function ReaderView({ bookId }: { bookId: string }) {
  const { settings, progress, refresh, displayName, userId } = useFolio();
  const device = useFolioUi((s) => s.device);
  const chrome = useFolioUi((s) => s.chromeVisible);
  const setChrome = useFolioUi((s) => s.setChrome);
  const toggleChrome = useFolioUi((s) => s.toggleChrome);
  const sidebarOpen = useFolioUi((s) => s.sidebarOpen);
  const setSidebar = useFolioUi((s) => s.setSidebar);
  const activeId = useFolioUi((s) => s.activeHighlightId);
  const setActive = useFolioUi((s) => s.setActiveHighlight);
  const showToast = useFolioUi((s) => s.showToast);
  const setGloss = useFolioUi((s) => s.setGloss);
  const linkUrl = useFolioUi((s) => s.linkUrl);
  const setLinkUrl = useFolioUi((s) => s.setLinkUrl);

  const [book, setBook] = useState<Book | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkT[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [voices, setVoices] = useState<VoiceNote[]>([]);
  const [club, setClub] = useState<Club | null>(null);
  const [chapterIndex, setChapterIndex] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [flip, setFlip] = useState<"forward" | "back" | null>(null);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const [peekLocked, setPeekLocked] = useState(false);
  const [clubIntro, setClubIntro] = useState(false);
  const [autoPlayId, setAutoPlayId] = useState<string | null>(null);
  const [knownGloss, setKnownGloss] = useState<Set<string>>(() => loadKnownGloss());
  const [glossEntryState, setGlossEntryState] = useState<GlossEntry | null>(null);
  const [glossLoading, setGlossLoading] = useState(false);
  const [hint, setHint] = useState(() => {
    try {
      return localStorage.getItem("folio.hint") !== "1";
    } catch {
      return true;
    }
  });
  const stageRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const snapshotRef = useRef<HTMLDivElement>(null);
  const tapRef = useRef({ count: 0, t: 0, timer: 0 as unknown as number });
  const selectRef = useRef<{ start: number; end: number } | null>(null);
  const holdTimer = useRef<number>(0);
  const linkHold = useRef<number>(0);
  const pointer = useRef({ x: 0, y: 0, t: 0, down: false });
  const draftRaf = useRef(0);

  const tablet = device === "dc1";
  const screenW = tablet ? DC_WIDTH : PHONE_WIDTH;
  const screenH = tablet ? DC_HEIGHT : PHONE_HEIGHT;
  const fontSize = TYPE_PX[settings.typeScale];
  const leading = LEADING[settings.leading];
  const measureEm = MEASURE_EM[settings.measure];
  const clubRailW = tablet && club ? 248 : 0;
  const glossRailW = tablet && settings.gloss && !club ? 248 : 0;
  const rail = clubRailW || glossRailW;
  const pageW = Math.round(Math.min(screenW - rail, fontSize * measureEm + (tablet ? 200 : 64)));
  const sidePad = Math.max(tablet ? 56 : 22, Math.round((screenW - rail - pageW) / 2));
  const topPad = tablet ? 64 : 56;
  const botPad = tablet ? 124 : 72;
  const colW = screenW - rail - sidePad * 2;
  const lineBox = fontSize * leading;
  const usable = screenH - topPad - botPad;
  const colH = Math.max(lineBox * 8, (Math.floor(usable / lineBox) - 1) * lineBox);

  const chapter = book?.chapters[chapterIndex];
  const voicedIds = useMemo(() => new Set(voices.map((v) => v.highlightId)), [voices]);
  const pageTerms = useMemo(() => {
    if (!chapter || !settings.gloss) return [] as GlossEntry[];
    return termsInText(chapter.html.replace(/<[^>]+>/g, " ")).filter((t) => !knownGloss.has(t.key));
  }, [chapter, settings.gloss, knownGloss]);
  const chapterHtml = useMemo(() => {
    if (!chapter) return "<p></p>";
    if (!settings.gloss) return chapter.html;
    return wrapGlossHtml(chapter.html, knownGloss);
  }, [chapter, settings.gloss, knownGloss]);

  const reload = useCallback(async () => {
    const data = await apiLoadBook(bookId);
    setBook(data.book);
    setHighlights(data.highlights);
    setBookmarks(data.bookmarks);
    setTags(data.tags);
    setVoices(data.voices);
    setClub(data.club ?? null);
  }, [bookId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const p = progress.find((x) => x.bookId === bookId);
    if (p) {
      setChapterIndex(p.chapterIndex);
      setPageIndex(p.pageIndex);
    } else {
      setChapterIndex(0);
      setPageIndex(0);
    }
  }, [bookId, progress]);

  useEffect(() => {
    if (!club) return;
    try {
      if (localStorage.getItem("folio.clubIntro") !== "1") setClubIntro(true);
    } catch {
      setClubIntro(true);
    }
  }, [club]);

  useLayoutEffect(() => {
    const el = flowRef.current;
    if (!el || !chapter) return;
    const measure = () => {
      const pages = Math.max(1, Math.round(el.scrollWidth / Math.max(1, colW)));
      setPageCount(pages);
      setPageIndex((p) => Math.min(p, pages - 1));
    };
    measure();
    const id = requestAnimationFrame(measure);
    void document.fonts?.ready.then(measure);
    return () => cancelAnimationFrame(id);
  }, [chapterHtml, colW, colH, fontSize, leading, settings.justify]);

  useLayoutEffect(() => {
    const el = flowRef.current;
    if (!el || !chapter) return;
    const mine = highlights.filter((h) => h.chapterId === chapter.id);
    applyMarks(el, mine, activeId, voicedIds);
    if (draft) applyDraft(el, draft.start, draft.end);
  }, [highlights, chapter?.id, pageIndex, pageCount, activeId, draft, voices]);

  useEffect(() => {
    if (!book) return;
    const chapters = book.chapters.length;
    const pct =
      ((chapterIndex + (pageCount ? (pageIndex + 1) / pageCount : 0)) / Math.max(1, chapters)) * 100;
    const t = window.setTimeout(() => {
      void apiSaveProgress({
        bookId,
        chapterIndex,
        pageIndex,
        percent: Math.min(100, pct),
        locator: `${chapterIndex}:${pageIndex}`,
        updatedAt: new Date().toISOString(),
      }).then(() => refresh());
    }, 400);
    return () => clearTimeout(t);
  }, [book, bookId, chapterIndex, pageIndex, pageCount, refresh]);

  useEffect(() => {
    setChrome(true);
  }, [bookId, setChrome]);

  useEffect(() => {
    const snap = snapshotRef.current;
    if (!snap || flip) return;
    snap.style.display = "";
    if (snap.innerHTML) snap.innerHTML = "";
  }, [flip, device]);

  function dismissHint() {
    if (!hint) return;
    setHint(false);
    try {
      localStorage.setItem("folio.hint", "1");
    } catch {
      /* ignore */
    }
  }

  const go = useCallback(
    (dir: 1 | -1) => {
      if (flip) return;
      dismissHint();
      setChrome(false);
      if (dir === 1) {
        if (pageIndex < pageCount - 1) {
          animate(dir, () => setPageIndex((p) => p + 1));
        } else if (book && chapterIndex < book.chapters.length - 1) {
          animate(dir, () => {
            setChapterIndex((c) => c + 1);
            setPageIndex(0);
          });
        }
      } else if (pageIndex > 0) {
        animate(dir, () => setPageIndex((p) => p - 1));
      } else if (chapterIndex > 0) {
        animate(dir, () => {
          setChapterIndex((c) => c - 1);
          setPageIndex(9999);
        });
      }
    },
    [pageIndex, pageCount, book, chapterIndex, flip, settings.pageAnim, hint, setChrome],
  );

  function animate(dir: 1 | -1, apply: () => void) {
    if (settings.pageAnim === "none" || settings.pageAnim === "slide") {
      apply();
      return;
    }
    const flow = flowRef.current;
    const snap = snapshotRef.current;
    if (flow && snap) {
      snap.innerHTML = flow.outerHTML;
    }
    apply();
    setFlip(dir === 1 ? "forward" : "back");
    window.setTimeout(() => {
      setFlip(null);
      if (snap) snap.innerHTML = "";
    }, 540);
  }

  function knowGloss(key: string) {
    const next = new Set(knownGloss);
    next.add(key);
    setKnownGloss(next);
    saveKnownGloss(next);
    setGlossEntryState(null);
    setGloss(null);
  }

  async function openGloss(word: string, display: string) {
    const local = glossEntry(word) ?? glossEntry(display);
    if (local) {
      setGlossEntryState(local);
      setGloss(local.word, local.short);
      return;
    }
    setGlossLoading(true);
    setGlossEntryState({ key: word.toLowerCase(), word: display, short: "Looking up…", long: "" });
    setGloss(display, "Looking up…");
    try {
      const nearby = (flowRef.current?.textContent ?? "").slice(0, 240);
      const res = await defineWord({ data: { word: display, context: nearby } });
      if (res.ok && res.short) {
        const entry: GlossEntry = { key: display.toLowerCase(), word: res.word || display, short: res.short, long: res.long };
        setGlossEntryState(entry);
        setGloss(entry.word, entry.short);
      } else {
        const fallback: GlossEntry = {
          key: display.toLowerCase(),
          word: display,
          short: "No gloss for this word yet.",
          long: "The teacher’s lexicon is quiet. Mark the sentence if it still has heat.",
        };
        setGlossEntryState(fallback);
        setGloss(display, fallback.short);
      }
    } catch {
      setGloss(display, "No gloss for this word yet.");
    } finally {
      setGlossLoading(false);
    }
  }

  async function markRange(start: number, end: number) {
    if (!chapter || !book) return;
    const root = flowRef.current;
    if (!root) return;
    const text = root.textContent ?? "";
    const slice = sliceText(text, start, end);
    if (slice.length < 2) return;
    const overlap = highlights.find(
      (h) => h.chapterId === chapter.id && !(end <= h.startOffset || start >= h.endOffset),
    );
    if (overlap) {
      setActive(overlap.id);
      return;
    }
    const res = await apiAddHighlight({
      bookId: book.id,
      chapterId: chapter.id,
      startOffset: start,
      endOffset: end,
      text: slice,
      authorName: displayName,
    });
    const h: Highlight = {
      id: res.id,
      bookId: book.id,
      chapterId: chapter.id,
      startOffset: start,
      endOffset: end,
      text: slice,
      note: "",
      createdAt: new Date().toISOString(),
      tagIds: [],
      authorId: userId,
      authorName: displayName,
      clubId: club?.id ?? null,
      isCompanion: false,
    };
    setHighlights((xs) => [...xs, h]);
    setActive(res.id);
    setDraft(null);
    dismissHint();
    const localNames = suggestTagsLocal(slice, tags);
    const localIds = tagIdsFromNames(localNames, tags);
    if (localIds.length) {
      h.tagIds = localIds;
      setHighlights((xs) => xs.map((x) => (x.id === res.id ? { ...x, tagIds: localIds } : x)));
      void apiUpdateHighlight({ id: res.id, tagIds: localIds });
    }
    showToast("Marked · hold the mic to speak", async () => {
      await apiDeleteHighlight(res.id);
      setHighlights((xs) => xs.filter((x) => x.id !== res.id));
      setActive(null);
    });
    void suggestTagsForText({ data: slice })
      .then((r) => {
        setSuggested(r.names);
        const extra = tagIdsFromNames(r.names, tags);
        if (extra.length) {
          const merged = [...new Set([...(localIds.length ? localIds : h.tagIds), ...extra])];
          void apiUpdateHighlight({ id: res.id, tagIds: merged });
          setHighlights((xs) => xs.map((x) => (x.id === res.id ? { ...x, tagIds: merged } : x)));
        }
      })
      .catch(() => setSuggested(localNames));
  }

  const active = highlights.find((h) => h.id === activeId) ?? null;
  const pageBookmarked = bookmarks.some((b) => b.chapterIndex === chapterIndex && b.pageIndex === pageIndex);

  function onPointerDown(e: PointerEvent) {
    if (sidebarOpen) return;
    pointer.current = { x: e.clientX, y: e.clientY, t: Date.now(), down: true };
    selectRef.current = null;
    const target = e.target as Element;
    const link = target.closest("a");
    if (link && settings.linkSlide) {
      const href = (link as HTMLAnchorElement).getAttribute("href") || (link as HTMLAnchorElement).href;
      linkHold.current = window.setTimeout(() => {
        if (href) {
          setPeekLocked(false);
          setLinkUrl(href);
        }
      }, 220);
      return;
    }
    if (target.closest("mark, button, textarea, input")) return;
    holdTimer.current = window.setTimeout(() => {
      const root = flowRef.current;
      if (!root) return;
      const off = offsetFromPoint(root, e.clientX, e.clientY);
      if (off == null) return;
      const word = expandToWord(root.textContent ?? "", off);
      selectRef.current = word;
      setDraft(word);
    }, 280);
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointer.current.down) return;
    if (selectRef.current && flowRef.current) {
      const off = offsetFromPoint(flowRef.current, e.clientX, e.clientY);
      if (off == null) return;
      const start = Math.min(selectRef.current.start, off);
      const end = Math.max(selectRef.current.end, off);
      selectRef.current = { start, end };
      if (draftRaf.current) cancelAnimationFrame(draftRaf.current);
      const span = { start, end };
      draftRaf.current = requestAnimationFrame(() => setDraft(span));
    }
  }

  function onPointerUp(e: PointerEvent) {
    pointer.current.down = false;
    window.clearTimeout(holdTimer.current);
    window.clearTimeout(linkHold.current);
    const dx = e.clientX - pointer.current.x;
    const dt = Date.now() - pointer.current.t;
    const target = e.target as Element;

    if (linkUrl && !peekLocked) {
      if (dx < -40) {
        setPeekLocked(true);
        return;
      }
      setLinkUrl(null);
      return;
    }

    if (selectRef.current) {
      void markRange(selectRef.current.start, selectRef.current.end);
      selectRef.current = null;
      setDraft(null);
      return;
    }

    const hid = highlightIdFromTarget(e.target);
    if (hid) {
      setActive(hid);
      setChrome(true);
      const firstVoice = voices.find((v) => v.highlightId === hid);
      setAutoPlayId(firstVoice?.id ?? null);
      return;
    }

    if (target.closest("a")) {
      e.preventDefault();
      return;
    }

    if (Math.abs(dx) > 56 && dt < 600) {
      go(dx < 0 ? 1 : -1);
      return;
    }

    const now = Date.now();
    if (now - tapRef.current.t < 340) tapRef.current.count += 1;
    else tapRef.current.count = 1;
    tapRef.current.t = now;
    window.clearTimeout(tapRef.current.timer);
    const count = tapRef.current.count;
    const x = e.clientX;
    const rect = stageRef.current?.getBoundingClientRect();
    tapRef.current.timer = window.setTimeout(() => {
      const root = flowRef.current;
      if (count >= 2 && root) {
        const off = offsetFromPoint(root, e.clientX, e.clientY);
        if (off != null) {
          const text = root.textContent ?? "";
          const span =
            count >= 4
              ? expandToParagraphEl(root, off)
              : count >= 3
                ? expandToSentenceEl(root, off)
                : expandToWord(text, off);
          void markRange(span.start, span.end);
        }
        tapRef.current.count = 0;
        return;
      }
      if (count === 1 && root && settings.gloss) {
        const off = offsetFromPoint(root, e.clientX, e.clientY);
        if (off != null) {
          const w = expandToWord(root.textContent ?? "", off);
          const word = sliceText(root.textContent ?? "", w.start, w.end);
          if (word) {
            void openGloss(word, word);
            tapRef.current.count = 0;
            return;
          }
        }
      }
      if (rect) {
        const local = x - rect.left;
        if (local < rect.width * 0.22) go(-1);
        else if (local > rect.width * 0.78) go(1);
        else {
          toggleChrome();
          setGloss(null);
        }
      }
      tapRef.current.count = 0;
    }, 300) as unknown as number;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        setActive(null);
        setSidebar(false);
        setChrome(false);
        setLinkUrl(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, setActive, setSidebar, setChrome, setLinkUrl]);

  const totalPagesHint = book ? `Ch ${chapterIndex + 1} · ${pageIndex + 1}/${pageCount}` : "";
  const canPrev = pageIndex > 0 || chapterIndex > 0;
  const canNext = Boolean(book && (pageIndex < pageCount - 1 || chapterIndex < book.chapters.length - 1));

  async function toggleBookmark() {
    if (pageBookmarked) {
      const b = bookmarks.find((x) => x.chapterIndex === chapterIndex && x.pageIndex === pageIndex);
      if (b) {
        await apiDeleteBookmark(b.id);
        setBookmarks((xs) => xs.filter((x) => x.id !== b.id));
        showToast("Bookmark lifted");
      }
    } else {
      const res = await apiAddBookmark({
        bookId,
        chapterIndex,
        pageIndex,
        label: `${chapter?.title ?? "Chapter"} · p. ${pageIndex + 1}`,
      });
      setBookmarks((xs) => [
        {
          id: res.id,
          bookId,
          chapterIndex,
          pageIndex,
          label: `${chapter?.title ?? "Chapter"} · p. ${pageIndex + 1}`,
          createdAt: new Date().toISOString(),
        },
        ...xs,
      ]);
      showToast("Dog-eared");
    }
  }

  async function saveVoice(v: {
    audioB64: string;
    mime: string;
    durationMs: number;
    transcript: string;
  }) {
    if (!active) return;
    const res = await apiSaveVoice({ highlightId: active.id, authorName: displayName, ...v });
    setVoices((xs) => [
      ...xs,
      {
        id: res.id,
        highlightId: active.id,
        ...v,
        audioUrl: "",
        createdAt: new Date().toISOString(),
        authorId: userId,
        authorName: displayName,
        replyTo: null,
        clubId: club?.id ?? null,
        isCompanion: false,
      },
    ]);
    showToast("Voice kept");
  }

  function openFirstVoice() {
    setClubIntro(false);
    try {
      localStorage.setItem("folio.clubIntro", "1");
    } catch {
      /* ignore */
    }
    const first = voices.find((v) => v.isCompanion);
    if (first) {
      const h = highlights.find((x) => x.id === first.highlightId);
      if (h) {
        const idx = book?.chapters.findIndex((c) => c.id === h.chapterId) ?? 0;
        if (idx >= 0) setChapterIndex(idx);
        setActive(first.highlightId);
        setAutoPlayId(first.id);
      }
    }
  }

  const threadHandlers = active
    ? {
        onNote: async (note: string) => {
          await apiUpdateHighlight({ id: active.id, note });
          setHighlights((xs) => xs.map((h) => (h.id === active.id ? { ...h, note } : h)));
        },
        onTags: async (tagIds: string[]) => {
          await apiUpdateHighlight({ id: active.id, tagIds });
          setHighlights((xs) => xs.map((h) => (h.id === active.id ? { ...h, tagIds } : h)));
        },
        onVoice: saveVoice,
        onDelete: async () => {
          await apiDeleteHighlight(active.id);
          setHighlights((xs) => xs.filter((h) => h.id !== active.id));
          setActive(null);
          showToast("Mark undone");
        },
      }
    : null;

  return (
    <div className="relative h-full bg-paper text-ink select-none">
      <header
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-center justify-between px-3 transition-opacity duration-200",
          chrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        style={{ height: topPad, paddingRight: rail || undefined }}
      >
        <div className="flex items-center">
          <Link
            to="/"
            className="grid size-12 place-items-center"
            aria-label="Library"
            onClick={() => setChrome(false)}
          >
            <ChevronLeft className="size-5" strokeWidth={1.5} />
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setSidebar(true, "book")}
            className="grid size-12 place-items-center"
          >
            <Paperclip className="size-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="min-w-0 px-2 text-center">
          <div className="truncate font-serif text-[15px]">{book?.title ?? "…"}</div>
          <div className="truncate font-ui text-[11px] tracking-wide text-ink-soft">
            {club ? club.name : book?.author}
          </div>
        </div>
        <div className="size-12" />
      </header>

      <div
        ref={stageRef}
        className="absolute overflow-hidden touch-manipulation"
        style={{
          left: sidePad,
          right: sidePad + rail,
          top: topPad,
          bottom: botPad,
          perspective: 1800,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          ref={flowRef}
          className={cn("folio-prose will-change-transform", settings.pageAnim === "slide" && "transition-transform duration-300")}
          style={{
            width: colW,
            height: colH,
            columnWidth: colW,
            columnGap: 0,
            columnFill: "auto",
            boxSizing: "border-box",
            fontSize,
            lineHeight: leading,
            textAlign: settings.justify ? "justify" : "left",
            transform: `translateX(${-pageIndex * colW}px)`,
          }}
          dangerouslySetInnerHTML={{ __html: chapterHtml }}
        />
        <div
          ref={snapshotRef}
          className={cn(
            "page-turn pointer-events-none absolute inset-0 overflow-hidden bg-paper",
            flip ? "block" : "hidden",
            flip === "forward" && "forward flip-forward",
            flip === "back" && "flip-back",
          )}
          style={{ boxShadow: flip ? " -12px 0 30px rgba(28,27,22,0.18)" : undefined }}
        />
      </div>

      {!tablet && (
        <footer className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center px-6" style={{ height: botPad }}>
          {hint && <div className="font-ui text-[11px] tracking-wide text-ink-faint">Two taps a word · three a sentence</div>}
          <div className="font-ui text-[12px] tracking-[0.14em] text-ink-faint tabular-nums">{totalPagesHint}</div>
        </footer>
      )}

      {tablet && (
        <ThumbBar
            label={totalPagesHint}
            canPrev={canPrev}
            canNext={canNext}
            onPrev={() => go(-1)}
            onNext={() => go(1)}
            onMic={() => {
              if (active) setChrome(true);
              else showToast("Two taps a word, then hold the mic");
            }}
            bookmarked={pageBookmarked}
            onBookmark={() => void toggleBookmark()}
            micArmed={Boolean(active)}
            rightOffset={rail}
          />
      )}

      {club && tablet && threadHandlers && (
        <ClubRail
          club={club}
          highlights={highlights.filter((h) => h.chapterId === chapter?.id)}
          voices={voices}
          tags={tags}
          suggested={suggested}
          userId={userId}
          active={active}
          onOpen={(id) => {
            setActive(id);
            const first = voices.find((v) => v.highlightId === id);
            setAutoPlayId(first?.id ?? null);
          }}
          onClose={() => setActive(null)}
          onNote={threadHandlers.onNote}
          onTags={threadHandlers.onTags}
          onVoice={threadHandlers.onVoice}
          onDelete={threadHandlers.onDelete}
          autoPlayId={autoPlayId}
        />
      )}

      {club && tablet && !threadHandlers && (
        <ClubRail
          club={club}
          highlights={highlights.filter((h) => h.chapterId === chapter?.id)}
          voices={voices}
          tags={tags}
          suggested={suggested}
          userId={userId}
          active={null}
          onOpen={(id) => {
            setActive(id);
            const first = voices.find((v) => v.highlightId === id);
            setAutoPlayId(first?.id ?? null);
          }}
          onClose={() => setActive(null)}
          onNote={() => {}}
          onTags={() => {}}
          onVoice={async () => {}}
          onDelete={() => {}}
          autoPlayId={autoPlayId}
        />
      )}

      {settings.gloss && glossRailW > 0 && (
        <GlossMargin
          terms={pageTerms}
          active={glossEntryState}
          onOpen={(key) => {
            if (!key) {
              setGlossEntryState(null);
              setGloss(null);
              return;
            }
            const t = pageTerms.find((x) => x.key === key);
            if (t) {
              setGlossEntryState(t);
              setGloss(t.word, t.short);
            }
          }}
          onKnow={knowGloss}
        />
      )}

      {glossEntryState && settings.gloss && !glossRailW && (
        <div className="absolute z-20 w-[min(320px,70%)]" style={{ top: topPad + 8, right: (rail || 16) + 12 }}>
          <GlossCard
            entry={glossEntryState}
            loading={glossLoading}
            onKnow={() => knowGloss(glossEntryState.key)}
            onBack={() => {
              setGlossEntryState(null);
              setGloss(null);
            }}
          />
        </div>
      )}
      {linkUrl && settings.linkSlide && (
        <PeekSheet
          url={linkUrl}
          locked={peekLocked}
          onLock={() => setPeekLocked(true)}
          onClose={() => {
            setLinkUrl(null);
            setPeekLocked(false);
          }}
        />
      )}

      {active && threadHandlers && !tablet && (
        <AnnotationSheet
          highlight={active}
          tags={tags}
          voices={voices}
          suggested={suggested}
          userId={userId}
          onClose={() => setActive(null)}
          onNote={threadHandlers.onNote}
          onTags={threadHandlers.onTags}
          onVoice={threadHandlers.onVoice}
          onDelete={threadHandlers.onDelete}
          autoPlayId={autoPlayId}
          onTagsCreated={() => void reload()}
        />
      )}

      {sidebarOpen && (
        <Sidebar
          book={book}
          highlights={highlights}
          bookmarks={bookmarks}
          tags={tags}
          voices={voices}
          club={club}
          onJump={(c, p) => {
            setChapterIndex(c);
            setPageIndex(p);
          }}
          onOpenHighlight={(id) => setActive(id)}
          onTagsChange={() => void reload()}
        />
      )}

      {clubIntro && club && <ClubIntro name={club.name} onDismiss={openFirstVoice} />}

      <Toast />
    </div>
  );
}

function Toast() {
  const toast = useFolioUi((s) => s.toast);
  const undo = useFolioUi((s) => s.toastUndo);
  const dismissToast = useFolioUi((s) => s.dismissToast);
  if (!toast) return null;
  return (
    <div className="absolute bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 border border-rule bg-ink px-4 py-2 font-ui text-[13px] text-paper">
      <span>{toast}</span>
      {undo && (
        <button
          type="button"
          className="font-ui text-[11px] tracking-[0.16em] uppercase"
          onClick={() => {
            void undo();
            dismissToast();
          }}
        >
          Undo
        </button>
      )}
    </div>
  );
}
