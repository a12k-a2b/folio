import type { TagKind } from "./types";

export type PrintSource = { title: string; url: string };

export type PrintSlip = {
  id: string;
  highlightId: string;
  kind: TagKind;
  kicker: string;
  title: string;
  body: string;
  sources: PrintSource[];
  createdAt: string;
};

export type BrushSpec = {
  kind: TagKind;
  verb: string;
  kicker: string;
  hint: string;
  /** Live search is worth the spend for these. */
  search: boolean;
};

/** Tags are the digital highlighters. Each kind prints a different slip. */
export const BRUSHES: Record<TagKind, BrushSpec> = {
  book: {
    kind: "book",
    verb: "Find",
    kicker: "Cited work",
    hint: "Finds the book or paper this sentence is pointing at",
    search: true,
  },
  quote: {
    kind: "quote",
    verb: "Check",
    kicker: "Skeptical check",
    hint: "Prints a skeptical fact-check of the claim",
    search: false,
  },
  question: {
    kind: "question",
    verb: "Ask",
    kicker: "Asked",
    hint: "Sends your note with the surrounding page to an agent",
    search: true,
  },
  person: {
    kind: "person",
    verb: "Who",
    kicker: "Person",
    hint: "Who this is, in this book's world",
    search: false,
  },
  place: {
    kind: "place",
    verb: "Where",
    kicker: "Place",
    hint: "Situates the place",
    search: false,
  },
  term: {
    kind: "term",
    verb: "Define",
    kicker: "Term",
    hint: "A teacher's gloss of the word",
    search: false,
  },
  idea: {
    kind: "idea",
    verb: "Open",
    kicker: "Idea",
    hint: "What this idea is doing on the page",
    search: false,
  },
  custom: {
    kind: "custom",
    verb: "Ask",
    kicker: "Asked",
    hint: "Sends the mark and your note to an agent",
    search: true,
  },
};

const BRUSH_RANK: TagKind[] = [
  "question",
  "book",
  "quote",
  "term",
  "person",
  "place",
  "idea",
  "custom",
];

export function primaryBrush(kinds: (TagKind | undefined | null)[]): TagKind | null {
  const set = new Set(kinds.filter(Boolean) as TagKind[]);
  return BRUSH_RANK.find((k) => set.has(k)) ?? null;
}

export function surroundingContext(fullText: string, start: number, end: number, radius = 480): string {
  const a = Math.max(0, start - radius);
  const b = Math.min(fullText.length, Math.max(start, end) + radius);
  const slice = fullText.slice(a, b).replace(/\s+/g, " ").trim();
  return (a > 0 ? "…" : "") + slice + (b < fullText.length ? "…" : "");
}

export type BrushPromptInput = {
  kind: TagKind;
  passage: string;
  note: string;
  context: string;
  bookTitle: string;
  author: string;
  chapterTitle: string;
};

export type RunBrushInput = {
  kind: TagKind;
  passage: string;
  note?: string;
  context?: string;
  bookTitle?: string;
  author?: string;
  chapterTitle?: string;
  highlightId: string;
  force?: boolean;
};

export function brushPrompt(input: BrushPromptInput): string {
  const spec = BRUSHES[input.kind] ?? BRUSHES.custom;
  const frame = `You sit in the margin of a paper reader. Ink, not chrome. No bullet lists. No "as an AI". No cheerleading.
Return JSON only: {"kicker":"${spec.kicker}","title":"short heading","body":"2-4 short paragraphs","sources":[{"title":"","url":""}]}.
If you are unsure, say so in the body. Empty sources is fine.

Book: ${input.bookTitle}${input.author ? ` · ${input.author}` : ""}
Chapter: ${input.chapterTitle || "(none)"}
Marked: ${input.passage.slice(0, 1200)}
Reader's note: ${input.note.trim() || "(none)"}
Surrounding page: ${input.context.slice(0, 1400)}`;

  const jobs: Record<TagKind, string> = {
    book: `JOB: This mark is a citation. Identify the work (book, paper, essay). Title, author, year if known, and why this page is pointing at it. If it is not a citation, say that and name the closest real work.`,
    quote: `JOB: Treat the marked sentence as a claim. Steelman it in one breath, then a skeptical fact-check: what would have to be true, what evidence cuts against it, what a careful reader should not swallow whole. Not a gotcha. Not a summary.`,
    question: `JOB: The reader circled a comment (or the passage itself) and wants an agent. Answer the note using the marked sentence AND the surrounding page. If the note is empty, pose the question the passage is asking, then answer it.`,
    person: `JOB: Who is this person, in the world of this book? One identifying line, then why they are on this page.`,
    place: `JOB: Situate this place. Where, what kind of room or landscape, why the book stopped here.`,
    term: `JOB: Define the term for a careful reader. Two layers: a short sense, then a slightly longer lesson. No dictionary voice.`,
    idea: `JOB: What is this idea doing on the page? Name it. Say what it rules out. One related thought a reader might take for a walk.`,
    custom: `JOB: The reader tagged this and maybe wrote a note. Do what the note asks. If there is no note, explain the passage the way a good friend would in the margin.`,
  };

  return `${frame}\n\n${jobs[input.kind] ?? jobs.custom}`;
}

export function parsePrintJson(raw: string, kind: TagKind, highlightId: string): PrintSlip {
  const spec = BRUSHES[kind] ?? BRUSHES.custom;
  const match = raw.match(/\{[\s\S]*\}/);
  let parsed: {
    kicker?: string;
    title?: string;
    body?: string;
    sources?: { title?: string; url?: string }[];
  } = {};
  try {
    parsed = JSON.parse(match?.[0] ?? raw) as typeof parsed;
  } catch {
    parsed = { body: raw.trim() };
  }
  const sources = Array.isArray(parsed.sources)
    ? parsed.sources
        .filter((s) => s && (s.url || s.title))
        .slice(0, 6)
        .map((s) => ({ title: String(s.title || s.url || "").slice(0, 160), url: String(s.url || "").slice(0, 500) }))
    : [];
  const body = String(parsed.body || raw.replace(/```json|```/g, "").trim()).slice(0, 2800);
  const title = String(parsed.title || spec.kicker).slice(0, 160);
  return {
    id: `print-${kind}-${highlightId}`,
    highlightId,
    kind,
    kicker: String(parsed.kicker || spec.kicker).slice(0, 40),
    title,
    body,
    sources,
    createdAt: new Date().toISOString(),
  };
}
