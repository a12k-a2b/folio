import type { Highlight, Tag } from "./types";
import { offsetToPoint } from "./sentences";

export function applyMarks(
  root: HTMLElement,
  highlights: Highlight[],
  activeId?: string | null,
  voicedIds?: Set<string>,
) {
  unwrapMarks(root);
  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
  for (const h of sorted) {
    wrapRange(
      root,
      h.startOffset,
      h.endOffset,
      h.id,
      Boolean(h.note),
      activeId === h.id,
      Boolean(voicedIds?.has(h.id)),
      h.isCompanion,
    );
  }
}

export function applyDraft(root: HTMLElement, start: number, end: number) {
  if (end <= start) return;
  wrapRange(root, start, end, "draft", false, false, false, false);
  root.querySelectorAll('mark[data-highlight-id="draft"]').forEach((m) => {
    m.classList.add("folio-draft");
  });
}

function unwrapMarks(root: HTMLElement) {
  const marks = [...root.querySelectorAll("mark.folio-mark")];
  for (const mark of marks) {
    const parent = mark.parentNode;
    if (!parent) continue;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  }
}

function wrapRange(
  root: HTMLElement,
  startOffset: number,
  endOffset: number,
  id: string,
  hasNote: boolean,
  active: boolean,
  hasVoice: boolean,
  isTheirs: boolean,
) {
  if (endOffset <= startOffset) return;
  const start = offsetToPoint(root, startOffset);
  const end = offsetToPoint(root, endOffset);
  if (!start || !end) return;
  const doc = root.ownerDocument;
  const range = doc.createRange();
  try {
    range.setStart(start.node, start.nodeOffset);
    range.setEnd(end.node, end.nodeOffset);
  } catch {
    return;
  }
  if (range.collapsed) return;

  const pieces: { node: Text; from: number; to: number }[] = [];
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const node = n as Text;
    if (!range.intersectsNode(node) || !node.data.length) continue;
    let from = 0;
    let to = node.data.length;
    if (node === start.node) from = start.nodeOffset;
    if (node === end.node) to = end.nodeOffset;
    if (to > from) pieces.push({ node, from, to });
  }

  for (let i = pieces.length - 1; i >= 0; i--) {
    const { node, from, to } = pieces[i];
    if (to < node.data.length) node.splitText(to);
    const target = from > 0 ? node.splitText(from) : node;
    const mark = doc.createElement("mark");
    mark.className =
      "folio-mark" +
      (hasNote ? " has-note" : "") +
      (hasVoice ? " has-voice" : "") +
      (active ? " is-active" : "") +
      (isTheirs ? " is-theirs" : "");
    mark.dataset.highlightId = id;
    target.parentNode?.insertBefore(mark, target);
    mark.appendChild(target);
  }
}

export function highlightIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const mark = target.closest("mark.folio-mark");
  if (!(mark instanceof HTMLElement)) return null;
  const id = mark.dataset.highlightId ?? null;
  return id === "draft" ? null : id;
}

export function suggestTagsLocal(text: string, tags: Tag[]): string[] {
  const lowered = text.toLowerCase();
  const names = new Set<string>();
  for (const t of tags) {
    if (t.name.length > 2 && lowered.includes(t.name.toLowerCase())) names.add(t.name);
  }
  const person = /\b(alexander|thoreau|vitruvius|okakura|marcus|aurelius|maya|theo|kakuz[oō]|christopher)\b/i;
  const place = /\b(kyoto|walden|courtyard|kitchen|san francisco|garden|rome|pond|street|plaza|caf[eé])\b/i;
  const bookish = /\b(book|volume|chapter|meditations|walden|vitruvius|pattern language|timeless way)\b/i;
  const idea = /\b(center|pattern|structure|feeling|life|simplicity|solitude|proportion|measure)\b/i;
  for (const t of tags) {
    if (t.kind === "person" && person.test(text)) names.add(t.name);
    if (t.kind === "place" && place.test(text)) names.add(t.name);
    if (t.kind === "book" && bookish.test(text)) names.add(t.name);
    if (t.kind === "idea" && idea.test(text)) names.add(t.name);
    if (t.kind === "quote" && (text.length > 80 || /^[A-Z]/.test(text.trim()))) names.add(t.name);
    if (t.kind === "question" && text.includes("?")) names.add(t.name);
  }
  return [...names].slice(0, 3);
}

export function tagIdsFromNames(names: string[], tags: Tag[]): string[] {
  const lower = names.map((n) => n.toLowerCase());
  return tags.filter((t) => lower.includes(t.name.toLowerCase())).map((t) => t.id);
}
