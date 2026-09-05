import { formatMs } from "./voice-pad";
import { VoiceThread } from "./annotation-sheet";
import type { Club, Highlight, Tag, VoiceNote } from "@/lib/folio/types";

export function ClubRail({
  club,
  highlights,
  voices,
  tags,
  suggested,
  userId,
  active,
  onOpen,
  onNote,
  onTags,
  onVoice,
  onDelete,
  onClose,
  autoPlayId,
}: {
  club: Club;
  highlights: Highlight[];
  voices: VoiceNote[];
  tags: Tag[];
  suggested: string[];
  userId: string;
  active: Highlight | null;
  onOpen: (id: string) => void;
  onNote: (note: string) => void;
  onTags: (tagIds: string[]) => void;
  onVoice: (v: { audioB64: string; mime: string; durationMs: number; transcript: string }) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
  autoPlayId?: string | null;
}) {
  const voiced = highlights.filter((h) => voices.some((v) => v.highlightId === h.id));

  return (
    <aside className="absolute top-0 right-0 bottom-0 z-10 flex w-[248px] flex-col border-l border-rule bg-paper-2/80">
      <div className="border-b border-rule px-4 py-4">
        <div className="font-ui text-[10px] tracking-[0.18em] text-ink-soft uppercase">Circle</div>
        <div className="mt-1 font-serif text-[18px] leading-tight">{club.name}</div>
        <div className="mt-1 font-ui text-[11px] text-ink-soft">
          {club.members.map((m) => m.displayName).join(" · ")}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {active ? (
          <div>
            <button
              type="button"
              onClick={onClose}
              className="mb-3 font-ui text-[11px] tracking-[0.14em] text-ink-soft uppercase"
            >
              All voices
            </button>
            <VoiceThread
              highlight={active}
              voices={voices}
              userId={userId}
              tags={tags}
              suggested={suggested}
              onNote={onNote}
              onTags={onTags}
              onVoice={onVoice}
              onDelete={onDelete}
              canDelete={!active.isCompanion}
              autoPlayId={autoPlayId}
            />
          </div>
        ) : voiced.length === 0 ? (
          <p className="px-1 font-serif text-[14px] leading-relaxed text-ink-soft">
            Mark a sentence, then hold the microphone. Theo is already in this book — his voices wait on the first
            chapter.
          </p>
        ) : (
          <ul className="space-y-3">
            {voiced.map((h) => {
              const thread = voices.filter((v) => v.highlightId === h.id);
              const last = thread[thread.length - 1];
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(h.id)}
                    className="w-full border border-rule bg-paper p-3 text-left"
                  >
                    <p className="line-clamp-3 font-serif text-[14px] leading-snug">{h.text}</p>
                    {last && (
                      <div className="mt-2 font-ui text-[11px] text-ink-soft">
                        {last.authorName} · {formatMs(last.durationMs)}
                        {thread.length > 1 ? ` · ${thread.length} voices` : ""}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function ClubIntro({
  name,
  onDismiss,
}: {
  name: string;
  onDismiss: () => void;
}) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-ink/25 p-8">
      <div className="sheet-enter max-w-md border border-rule bg-paper p-7 text-ink">
        <div className="font-ui text-[11px] tracking-[0.18em] text-ink-soft uppercase">A circle</div>
        <h2 className="mt-2 font-serif text-[28px] leading-tight">{name}</h2>
        <p className="mt-3 font-serif text-[16px] leading-relaxed text-ink-soft">
          Theo left voices in the margin of this book. Tap a marked sentence to hear him. Hold the microphone in the
          corner to answer — you will hear the feeling, not just the words.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 h-12 w-full border border-ink bg-ink font-ui text-[12px] tracking-wide text-paper uppercase"
        >
          Open the first voice
        </button>
      </div>
    </div>
  );
}
