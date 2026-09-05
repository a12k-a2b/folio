import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiAddTag, transcribeAudio } from "@/lib/folio/api";
import type { Highlight, Tag, VoiceNote } from "@/lib/folio/types";
import { VoiceBubble, VoicePad } from "./voice-pad";

export function VoiceThread({
  highlight,
  voices,
  userId,
  tags,
  suggested,
  onNote,
  onTags,
  onVoice,
  onDelete,
  canDelete,
  autoPlayId,
  onTagsCreated,
}: {
  highlight: Highlight;
  voices: VoiceNote[];
  userId: string;
  tags: Tag[];
  suggested: string[];
  onNote: (note: string) => void;
  onTags: (tagIds: string[]) => void;
  onVoice: (v: { audioB64: string; mime: string; durationMs: number; transcript: string }) => Promise<void>;
  onDelete: () => void;
  canDelete: boolean;
  autoPlayId?: string | null;
  onTagsCreated?: () => void;
}) {
  const [note, setNote] = useState(highlight.note);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(highlight.tagIds.length > 0 || Boolean(highlight.note));
  const [newTag, setNewTag] = useState("");
  const mine = voices
    .filter((v) => v.highlightId === highlight.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  useEffect(() => {
    setNote(highlight.note);
  }, [highlight.id, highlight.note]);

  async function makeTag() {
    const name = newTag.trim();
    if (!name) return;
    const res = await apiAddTag({ name, emoji: "※", kind: "custom" });
    setNewTag("");
    onTags([...highlight.tagIds, res.id]);
    onTagsCreated?.();
  }

  return (
    <div>
      <p className="font-serif text-[17px] leading-snug">{highlight.text}</p>
      <div className="mt-1 font-ui text-[11px] tracking-wide text-ink-soft">
        {highlight.isCompanion ? highlight.authorName : highlight.authorName || "You"} marked this
      </div>
      {highlight.tagIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tags
            .filter((t) => highlight.tagIds.includes(t.id))
            .map((t) => (
              <span key={t.id} className="border border-rule px-2 py-1 font-ui text-[11px] tracking-wide">
                {t.name}
              </span>
            ))}
        </div>
      )}
      <div className="mt-4 space-y-3">
        {mine.map((v) => (
          <VoiceBubble
            key={v.id}
            note={v}
            mine={v.authorId === userId && !v.isCompanion}
            autoPlay={autoPlayId === v.id}
          />
        ))}
      </div>
      <VoicePad
        busy={busy}
        label={mine.length ? "Hold to reply in your voice" : "Hold to leave a voice on this sentence"}
        onSave={async (v) => {
          setBusy(true);
          try {
            let transcript = v.transcript;
            if (!transcript) {
              try {
                const stt = await transcribeAudio({
                  data: { audioB64: v.audioB64, mime: v.mime },
                });
                if (stt.ok) transcript = stt.text;
              } catch {
                /* guest / network */
              }
            }
            await onVoice({ ...v, transcript });
          } finally {
            setBusy(false);
          }
        }}
      />
      <button
        type="button"
        className="mt-4 font-ui text-[11px] tracking-[0.16em] text-ink-soft uppercase"
        onClick={() => setMore((m) => !m)}
      >
        {more ? "Hide note and tags" : "A written note, or tags"}
      </button>
      {more && (
        <div className="mt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== highlight.note) onNote(note);
            }}
            placeholder="A note, if the sentence needs one"
            rows={3}
            className="w-full resize-none border border-rule bg-paper-2 p-3 font-serif text-[15px] leading-relaxed outline-none"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => {
              const on = highlight.tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    const next = on
                      ? highlight.tagIds.filter((id) => id !== t.id)
                      : [...highlight.tagIds, t.id];
                    onTags(next);
                  }}
                  className={cn(
                    "border px-2.5 py-1.5 font-ui text-[13px]",
                    on ? "border-ink bg-paper-2" : "border-rule text-ink-soft",
                  )}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          {suggested.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 font-ui text-[10px] tracking-[0.14em] text-ink-soft uppercase">Suggested</div>
              <div className="flex flex-wrap gap-2">
                {suggested.map((name) => {
                  const tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
                  const on = tag ? highlight.tagIds.includes(tag.id) : false;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        if (!tag) return;
                        const next = on
                          ? highlight.tagIds.filter((id) => id !== tag.id)
                          : [...highlight.tagIds, tag.id];
                        onTags(next);
                      }}
                      className={cn(
                        "border px-2.5 py-1.5 font-ui text-[12px]",
                        on ? "border-ink" : "border-dashed border-rule-strong text-ink-soft",
                      )}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void makeTag();
            }}
          >
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Make a tag — a person, a courtyard…"
              className="h-11 min-w-0 flex-1 border border-rule bg-paper px-3 font-serif text-[15px] outline-none"
            />
            <button
              type="submit"
              className="h-11 border border-rule px-3 font-ui text-[11px] tracking-wide uppercase"
            >
              Add
            </button>
          </form>
          {canDelete && (
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={onDelete} className="font-ui text-[12px] tracking-wide text-ink-soft uppercase">
                Remove mark
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnnotationSheet({
  highlight,
  tags,
  voices,
  suggested,
  userId,
  onClose,
  onNote,
  onTags,
  onVoice,
  onDelete,
  autoPlayId,
  onTagsCreated,
}: {
  highlight: Highlight;
  tags: Tag[];
  voices: VoiceNote[];
  suggested: string[];
  userId: string;
  onClose: () => void;
  onNote: (note: string) => void;
  onTags: (tagIds: string[]) => void;
  onVoice: (v: { audioB64: string; mime: string; durationMs: number; transcript: string }) => Promise<void>;
  onDelete: () => void;
  autoPlayId?: string | null;
  onTagsCreated?: () => void;
}) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 pb-5">
      <div className="sheet-enter w-full max-w-[640px] border border-rule bg-paper shadow-[0_-12px_40px_rgba(28,27,22,0.12)]">
        <div className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="font-ui text-[11px] tracking-[0.16em] text-ink-soft uppercase">On this sentence</div>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 shrink-0 place-items-center">
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="max-h-[58vh] overflow-y-auto px-5 pt-2 pb-5">
          <VoiceThread
            highlight={highlight}
            voices={voices}
            userId={userId}
            tags={tags}
            suggested={suggested}
            onNote={onNote}
            onTags={onTags}
            onVoice={onVoice}
            onDelete={onDelete}
            canDelete={!highlight.isCompanion}
            autoPlayId={autoPlayId}
            onTagsCreated={onTagsCreated}
          />
        </div>
      </div>
    </div>
  );
}
