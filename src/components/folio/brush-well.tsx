import { cn } from "@/lib/cn";
import { armedHint, BRUSHES, brushLabel, PROGRAMMABLE_KINDS } from "@/lib/folio/brushes";
import type { TagKind } from "@/lib/folio/types";

export function BrushWell({
  armed,
  onArm,
  busyKind,
}: {
  armed: TagKind | null;
  onArm: (kind: TagKind | null) => void;
  busyKind?: string | null;
}) {
  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1.5" data-testid="brush-well">
      <div className="flex items-center gap-1.5" role="toolbar" aria-label="Programmable highlighters">
        {PROGRAMMABLE_KINDS.map((kind) => {
          const spec = BRUSHES[kind];
          const on = armed === kind;
          const busy = busyKind === kind;
          return (
            <button
              key={kind}
              type="button"
              aria-pressed={on}
              aria-label={`${brushLabel(kind)}. ${spec.hint}`}
              onClick={() => onArm(on ? null : kind)}
              className={cn(
                "min-h-11 border px-3 py-1.5 font-ui text-[12px] tracking-[0.12em] uppercase",
                on ? "border-ink bg-ink text-paper" : "border-rule bg-paper/90 text-ink",
              )}
            >
              {busy ? "Printing…" : brushLabel(kind)}
            </button>
          );
        })}
      </div>
      <p className="max-w-[36ch] text-center font-ui text-[11px] leading-snug tracking-wide text-ink-faint">
        {busyKind ? "The margin is printing…" : armedHint(armed)}
      </p>
    </div>
  );
}
