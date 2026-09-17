import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { apiAddTag, apiImportGutenberg, searchGutenberg, transcribeAudio } from "@/lib/folio/api";
import { BRUSHES, type PrintSlip } from "@/lib/folio/brushes";
import type { Highlight, Tag, TagKind, VoiceNote } from "@/lib/folio/types";
import { VoiceBubble, VoicePad } from "./voice-pad";

function PrintCard({
  slip,
  busy,
  onAgain,
}: {
  slip: PrintSlip;
  busy: boolean;
  onAgain: () => void;
}) {
  const [shelf, setShelf] = useState<{ id: number; title: string; authors: string; epubUrl: string | null } | null>(null);
  const [shelving, setShelving] = useState(false);

  useEffect(() => {
    if (slip.kind !== "book" || !slip.title) return;
    let alive = true;
    void searchGutenberg({ data: slip.title.split(/[:—–]/)[0]?.trim() ?? slip.title }).then((hits) => {
      if (!alive) return;
      const hit = hits.find((h) => h.epubUrl) ?? hits[0];
      if (hit) setShelf({ id: hit.id, title: hit.title, authors: hit.authors, epubUrl: hit.epubUrl });
    });
    return () => {
      alive = false;
    };
  }, [slip.kind, slip.title]);

  return (
    <article className="print-slip mt-4 border border-rule bg-paper-2 px-3 py-3">
      <div className="font-ui text-[10px] tracking-[0.16em] text-ink-soft uppercase">{slip.kicker}</div>
      <h3 className="mt-1 font-serif text-[18px] leading-snug">{slip.title}</h3>
      <div className="mt-2 space-y-2 font-serif text-[15px] leading-relaxed text-ink">
        {slip.body.split(/\n\n+/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      {slip.sources.length > 0 && (
        <ul className="mt-3 space-y-1">
          {slip.sources.map((s) => (
            <li key={s.url || s.title} className="font-ui text-[11px] text-ink-soft">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-2">
                  {s.title || s.url}
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onAgain}
          className="font-ui text-[11px] tracking-[0.14em] text-ink-soft uppercase"
        >
          {busy ? "Printing…" : "Print again"}
        </button>
        {shelf?.epubUrl && (
          <button
            type="button"
            disabled={shelving}
            onClick={() => {
              setShelving(true);
              void apiImportGutenberg({
                id: shelf.id,
                title: shelf.title,
                authors: shelf.authors,
                epubUrl: shelf.epubUrl!,
              }).finally(() => setShelving(false));
            }}
            className="font-ui text-[11px] tracking-[0.14em] uppercase"
          >
            {shelving ? "Shelving…" : `Shelve · ${shelf.title}`}
          </button>
        )}
      </div>
    </article>
  );
}

export function VoiceThread({
  highlight,
  voices,
  userId,
  tags,
  suggested,
  prints,
  printBusy,
  onNote,
  onTags,
  onVoice,
  onDelete,
  canDelete,
  autoPlayId,
  onTagsCreated,
  onPrint,
  forceAsk,
}: {
  highlight: Highlight;
  voices: VoiceNote[];
  userId: string;
  tags: Tag[];
  suggested: string[];
  prints: PrintSlip[];
  printBusy: string | null;
  onNote: (note: string) => void;
  onTags: (tagIds: string[]) => void;
  onVoice: (v: { audioB64: string; mime: string; durationMs: number; transcript: string }) => Promise<void>;
  onDelete: () => void;
  canDelete: boolean;
  autoPlayId?: string | null;
  onTagsCreated?: () => void;
  onPrint: (kind: TagKind, force?: boolean, note?: string) => void;
  forceAsk?: boolean;
}) {
  const [note, setNote] = useState(highlight.note);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(highlight.tagIds.length > 0 || Boolean(highlight.note) || prints.length > 0 || forceAsk);
  const [newTag, setNewTag] = useState("");
  const [askOpen, setAskOpen] = useState(Boolean(forceAsk));
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const mine = voices
    .filter((v) => v.highlightId === highlight.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const minePrints = prints.filter((p) => p.highlightId === highlight.id);

  useEffect(() => {
    setNote(highlight.note);
  }, [highlight.id, highlight.note]);

  useEffect(() => {
    if (forceAsk) {
      setAskOpen(true);
      setMore(true);
      window.setTimeout(() => noteRef.current?.focus(), 40);
    }
  }, [forceAsk, highlight.id]);

  async function makeTag() {
    const name = newTag.trim();
    if (!name) return;
    const res = await apiAddTag({ name, emoji: "※", kind: "custom" });
    setNewTag("");
    onTags([...highlight.tagIds, res.id]);
    onTagsCreated?.();
    onPrint("custom");
  }

  function toggleTag(tag: Tag) {
    const on = highlight.tagIds.includes(tag.id);
    const next = on ? highlight.tagIds.filter((id) => id !== tag.id) : [...highlight.tagIds, tag.id];
    onTags(next);
    if (on) return;
    if (tag.kind === "question" && !highlight.note.trim() && !note.trim()) {
      setMore(true);
      setAskOpen(true);
      window.setTimeout(() => noteRef.current?.focus(), 40);
      return;
    }
    onPrint(tag.kind);
  }

  function sendAsk() {
    if (note !== highlight.note) onNote(note);
    const q = tags.find((t) => t.kind === "question");
    if (q && !highlight.tagIds.includes(q.id)) onTags([...highlight.tagIds, q.id]);
    setAskOpen(false);
    onPrint("question", false, note);
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
      <p className="mt-4 font-ui text-[11px] tracking-[0.16em] text-ink-soft uppercase">Brushes</p>
      <p className="mt-1 font-serif text-[14px] leading-snug text-ink-soft">
        Book finds the work. Quote checks the claim. Question sends your note with the page around it.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = highlight.tagIds.includes(t.id);
          const spec = BRUSHES[t.kind];
          const thisBusy = printBusy === `${highlight.id}:${t.kind}`;
          return (
            <button
              key={t.id}
              type="button"
              disabled={thisBusy}
              onClick={() => toggleTag(t)}
              className={cn(
                "border px-2.5 py-1.5 font-ui text-[13px]",
                on ? "border-ink bg-paper-2" : "border-rule text-ink-soft",
              )}
            >
              {t.name}
              <span className="ml-1.5 text-[11px] tracking-wide uppercase opacity-60">{thisBusy ? "…" : spec.verb}</span>
            </button>
          );
        })}
      </div>
      {askOpen && (
        <div className="mt-3">
          <textarea
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Is there more recent work?"
            rows={3}
            className="w-full resize-none border border-rule bg-paper-2 p-3 font-serif text-[15px] leading-relaxed outline-none"
          />
          <button
            type="button"
            onClick={sendAsk}
            className="mt-2 border border-ink bg-ink px-3 py-2 font-ui text-[11px] tracking-wide text-paper uppercase"
          >
            Send with the page around it
          </button>
        </div>
      )}
      {minePrints.map((slip) => (
        <PrintCard
          key={slip.id}
          slip={slip}
          busy={printBusy === `${highlight.id}:${slip.kind}`}
          onAgain={() => onPrint(slip.kind, true)}
        />
      ))}
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
            ref={noteRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => {
              if (note !== highlight.note) onNote(note);
            }}
            placeholder="A note, if the sentence needs one — or a question to send"
            rows={3}
            className="w-full resize-none border border-rule bg-paper-2 p-3 font-serif text-[15px] leading-relaxed outline-none"
          />
          {note.trim() && (
            <button
              type="button"
              onClick={sendAsk}
              className="mt-2 font-ui text-[11px] tracking-[0.14em] text-ink-soft uppercase"
            >
              Send as a question
            </button>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => {
              const on = highlight.tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t)}
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
                      onClick={() => tag && toggleTag(tag)}
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
  prints,
  printBusy,
  onClose,
  onNote,
  onTags,
  onVoice,
  onDelete,
  autoPlayId,
  onTagsCreated,
  onPrint,
  forceAsk,
}: {
  highlight: Highlight;
  tags: Tag[];
  voices: VoiceNote[];
  suggested: string[];
  userId: string;
  prints: PrintSlip[];
  printBusy: string | null;
  onClose: () => void;
  onNote: (note: string) => void;
  onTags: (tagIds: string[]) => void;
  onVoice: (v: { audioB64: string; mime: string; durationMs: number; transcript: string }) => Promise<void>;
  onDelete: () => void;
  autoPlayId?: string | null;
  onTagsCreated?: () => void;
  onPrint: (kind: TagKind, force?: boolean, note?: string) => void;
  forceAsk?: boolean;
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
            prints={prints}
            printBusy={printBusy}
            onNote={onNote}
            onTags={onTags}
            onVoice={onVoice}
            onDelete={onDelete}
            canDelete={!highlight.isCompanion}
            autoPlayId={autoPlayId}
            onTagsCreated={onTagsCreated}
            onPrint={onPrint}
            forceAsk={forceAsk}
          />
        </div>
      </div>
    </div>
  );
}
