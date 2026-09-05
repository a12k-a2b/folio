import { useState } from "react";
import { cn } from "@/lib/cn";
import type { GlossEntry } from "@/lib/folio/glossary";

export function GlossMargin({
  terms,
  active,
  onOpen,
  onKnow,
}: {
  terms: GlossEntry[];
  active: GlossEntry | null;
  onOpen: (key: string) => void;
  onKnow: (key: string) => void;
}) {
  return (
    <aside className="absolute top-0 right-0 bottom-0 z-10 flex w-[248px] flex-col border-l border-rule bg-paper-2/80">
      <div className="border-b border-rule px-4 py-4">
        <div className="font-ui text-[10px] tracking-[0.18em] text-ink-soft uppercase">On this page</div>
        <div className="mt-1 font-serif text-[18px] leading-tight">Gloss</div>
        <p className="mt-1 font-ui text-[11px] leading-snug text-ink-soft">
          Tap a dotted word. I know this lifts the underline.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {active ? (
          <GlossCard entry={active} expanded onKnow={() => onKnow(active.key)} onBack={() => onOpen("")} />
        ) : terms.length === 0 ? (
          <p className="px-1 font-serif text-[14px] leading-relaxed text-ink-soft">
            No teacher’s notes on this leaf. Tap any word for a definition.
          </p>
        ) : (
          <ul className="space-y-2">
            {terms.map((t) => (
              <li key={t.key}>
                <button
                  type="button"
                  onClick={() => onOpen(t.key)}
                  className="w-full border border-rule bg-paper p-3 text-left"
                >
                  <div className="font-serif text-[16px] leading-tight">{t.word}</div>
                  <p className="mt-1 line-clamp-2 font-serif text-[13px] leading-snug text-ink-soft">{t.short}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function GlossCard({
  entry,
  expanded,
  loading,
  onKnow,
  onBack,
  onAsk,
}: {
  entry: GlossEntry;
  expanded?: boolean;
  loading?: boolean;
  onKnow?: () => void;
  onBack?: () => void;
  onAsk?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(expanded));
  return (
    <div className="border border-rule bg-paper p-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 font-ui text-[11px] tracking-[0.14em] text-ink-soft uppercase"
        >
          All notes
        </button>
      )}
      <div className="font-ui text-[10px] tracking-[0.16em] text-ink-soft uppercase">{entry.word}</div>
      <p className="mt-2 font-serif text-[16px] leading-snug">{entry.short}</p>
      {loading && <p className="mt-2 font-serif text-[13px] text-ink-soft">Asking the teacher…</p>}
      {(open || expanded) && entry.long && (
        <p className="mt-3 font-serif text-[15px] leading-relaxed text-ink-soft">{entry.long}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {!expanded && entry.long && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              onAsk?.();
            }}
            className="border border-rule px-3 py-2 font-ui text-[11px] tracking-wide uppercase"
          >
            {open ? "Less" : "The lesson"}
          </button>
        )}
        {onKnow && (
          <button
            type="button"
            onClick={onKnow}
            className={cn(
              "border px-3 py-2 font-ui text-[11px] tracking-wide uppercase",
              "border-ink bg-ink text-paper",
            )}
          >
            I know this
          </button>
        )}
      </div>
    </div>
  );
}
