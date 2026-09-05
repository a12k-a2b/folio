import { cn } from "@/lib/cn";

export function BookCover({
  title,
  author,
  label,
  compact,
}: {
  title: string;
  author: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between overflow-hidden border border-rule bg-paper-2 text-ink",
        compact ? "h-36 p-3" : "aspect-[3/4] p-5",
      )}
    >
      <div className="relative z-[1] font-serif text-[11px] tracking-[0.22em] text-ink-soft uppercase">{label}</div>
      <div className="relative z-[1]">
        <div
          className={cn(
            "font-serif leading-[1.15] text-balance",
            compact ? "line-clamp-2 text-lg" : "line-clamp-4 text-[28px]",
          )}
        >
          {title}
        </div>
        <div className="mt-2 line-clamp-1 font-ui text-[12px] tracking-wide text-ink-soft">{author}</div>
      </div>
      <div className="absolute top-0 right-0 h-full w-2 bg-paper-3/80" />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-2 bottom-0 font-serif leading-none text-ink/10 select-none",
          compact ? "text-6xl" : "text-[120px]",
        )}
      >
        {label.slice(0, 2)}
      </div>
    </div>
  );
}
