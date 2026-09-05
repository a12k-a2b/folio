import { Bookmark, ChevronLeft, ChevronRight, Mic } from "lucide-react";
import { cn } from "@/lib/cn";

export function ThumbBar({
  label,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onMic,
  bookmarked,
  onBookmark,
  micArmed,
  rightOffset = 0,
}: {
  label: string;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onMic: () => void;
  bookmarked: boolean;
  onBookmark: () => void;
  micArmed: boolean;
  rightOffset?: number;
}) {
  return (
    <div
      className="pointer-events-none absolute bottom-0 z-10 flex items-end justify-between px-2 pb-2"
      style={{ left: 0, right: rightOffset }}
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={!canPrev}
        onClick={onPrev}
        className="pointer-events-auto grid size-20 place-items-center rounded-full text-ink disabled:opacity-30"
      >
        <ChevronLeft className="size-8" strokeWidth={1.2} />
      </button>
      <div className="pointer-events-auto mb-2 flex flex-col items-center gap-1">
        <div className="font-ui text-[11px] tracking-[0.16em] text-ink-faint tabular-nums">{label}</div>
        <button
          type="button"
          aria-label="Bookmark page"
          onClick={onBookmark}
          className="grid size-12 place-items-center"
        >
          <Bookmark className="size-5" strokeWidth={1.5} fill={bookmarked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="pointer-events-auto flex items-end gap-1">
        <button
          type="button"
          aria-label={micArmed ? "Reply in voice" : "Mark a sentence, then speak"}
          onClick={onMic}
          className={cn(
            "grid size-20 place-items-center rounded-full border transition-colors duration-150",
            micArmed ? "border-ink bg-ink text-paper" : "border-rule text-ink",
          )}
        >
          <Mic className="size-7" strokeWidth={1.5} />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={!canNext}
          onClick={onNext}
          className="grid size-20 place-items-center rounded-full text-ink disabled:opacity-30"
        >
          <ChevronRight className="size-8" strokeWidth={1.2} />
        </button>
      </div>
    </div>
  );
}
