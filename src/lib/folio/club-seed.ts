import { livingStructure } from "./books/living-structure";

export const THEO_ID = "companion:theo";
export const THEO_NAME = "Theo";
export const ALEXANDER_BOOK = "living-structure";

export type SeedNote = {
  key: string;
  chapterId: string;
  quote: string;
  transcript: string;
  audioUrl: string;
  durationMs: number;
};

export const THEO_NOTES: SeedNote[] = [
  {
    key: "feeling",
    chapterId: "ls-1",
    quote: "There is a feeling you already know, and you have never been taught it.",
    transcript:
      "Hey. This is why I wanted us to read this together. That kitchen thing — I felt it last week. Your place versus the office. The body already knows.",
    audioUrl: "/voices/theo-feeling.mp3",
    durationMs: 9980,
  },
  {
    key: "pretty",
    chapterId: "ls-1",
    quote: "A living structure is not a pretty object. Pretty objects often feel dead.",
    transcript:
      "Dude. Pretty objects often feel dead. That's the whole Daylight pitch in one sentence. I laughed out loud. Leave me one back if you felt it too.",
    audioUrl: "/voices/theo-pretty.mp3",
    durationMs: 9410,
  },
  {
    key: "heat",
    chapterId: "ls-1",
    quote: "when a sentence makes your body change",
    transcript:
      "Mark it immediately. That's our rule. If you feel heat, you talk into it. I'll do the same. That's the whole experiment.",
    audioUrl: "/voices/theo-heat.mp3",
    durationMs: 8140,
  },
  {
    key: "missing",
    chapterId: "ls-4",
    quote: "Speak the note if the note is a feeling.",
    transcript:
      "This is the missing piece. I don't want to type a comment on a book. I want you to hear that I'm actually moved. Reply in your voice — even ten seconds.",
    audioUrl: "/voices/theo-missing.mp3",
    durationMs: 9890,
  },
];

export function htmlToPlain(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

export function findQuote(html: string, quote: string): { start: number; end: number } | null {
  const text = htmlToPlain(html);
  const start = text.indexOf(quote);
  if (start >= 0) return { start, end: start + quote.length };
  const collapsed = quote.replace(/\s+/g, " ").trim();
  const t2 = text.replace(/\s+/g, " ");
  const s2 = t2.indexOf(collapsed);
  if (s2 < 0) return null;
  return { start: s2, end: s2 + collapsed.length };
}

export function chapterHtml(chapterId: string): string {
  const ch = livingStructure.chapters.find((c) => c.id === chapterId);
  return ch?.html ?? "";
}

export function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `ALEX-${s}`;
}
