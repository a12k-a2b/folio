const WORD_RE = /[\p{L}\p{N}’'-]+/u;
const SENTENCE_END = /[.!?…]["’”')\]]*$/;

export type TextPoint = {
  offset: number;
  node: Text;
  nodeOffset: number;
};

export function chapterText(root: Node): string {
  return (root.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Map a clientX/Y to a character offset in the chapter root's textContent. */
export function offsetFromPoint(root: HTMLElement, x: number, y: number): number | null {
  const doc = root.ownerDocument;
  let range: Range | null = null;
  const anyDoc = doc as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof anyDoc.caretPositionFromPoint === "function") {
    const pos = anyDoc.caretPositionFromPoint(x, y);
    if (pos?.offsetNode) {
      range = doc.createRange();
      try {
        range.setStart(pos.offsetNode, pos.offset);
        range.setEnd(pos.offsetNode, pos.offset);
      } catch {
        return null;
      }
    }
  } else if (typeof anyDoc.caretRangeFromPoint === "function") {
    range = anyDoc.caretRangeFromPoint(x, y);
  }
  if (!range || !root.contains(range.startContainer)) return null;
  return rangeToOffset(root, range.startContainer, range.startOffset);
}

export function rangeToOffset(root: Node, node: Node, nodeOffset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let offset = 0;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const text = n.textContent ?? "";
    if (n === node) return offset + nodeOffset;
    offset += text.length;
  }
  return offset;
}

export function offsetToPoint(root: Node, offset: number): { node: Text; nodeOffset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let n: Node | null;
  let last: Text | null = null;
  while ((n = walker.nextNode())) {
    const text = n as Text;
    last = text;
    const len = text.data.length;
    if (remaining <= len) return { node: text, nodeOffset: remaining };
    remaining -= len;
  }
  if (last) return { node: last, nodeOffset: last.data.length };
  return null;
}

function isWordChar(ch: string): boolean {
  return WORD_RE.test(ch);
}

export function expandToWord(text: string, offset: number): { start: number; end: number } {
  let start = offset;
  let end = offset;
  while (start > 0 && isWordChar(text[start - 1] ?? "")) start -= 1;
  while (end < text.length && isWordChar(text[end] ?? "")) end += 1;
  if (start === end && text[end]) {
    end += 1;
  }
  return { start, end };
}

export function expandToSentence(text: string, offset: number): { start: number; end: number } {
  const len = text.length;
  let start = offset;
  let end = offset;
  while (start > 0) {
    const prev = text[start - 1] ?? "";
    if (prev === "\n") break;
    if (SENTENCE_END.test(prev) && /\s/.test(text[start] ?? " ")) break;
    start -= 1;
  }
  while (start < len && /\s/.test(text[start] ?? "")) start += 1;
  while (end < len) {
    const ch = text[end] ?? "";
    end += 1;
    if (SENTENCE_END.test(ch) && (end >= len || /\s/.test(text[end] ?? ""))) break;
  }
  while (end < len && /["’”')\]]/.test(text[end] ?? "")) end += 1;
  return { start, end };
}

/** textContent concatenates <p> blocks without newlines — walk the DOM instead. */
export function expandToParagraphEl(root: HTMLElement, offset: number): { start: number; end: number } {
  const point = offsetToPoint(root, offset);
  if (!point) return { start: offset, end: offset };
  const block =
    point.node.parentElement?.closest("p, h1, h2, h3, blockquote, li, pre") ?? null;
  if (!block || !root.contains(block)) {
    return expandToSentence(root.textContent ?? "", offset);
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let start = -1;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    if (block.contains(n)) {
      if (start < 0) start = acc;
      acc += len;
    } else if (start >= 0) {
      return { start, end: acc };
    } else {
      acc += len;
    }
  }
  if (start < 0) return expandToSentence(root.textContent ?? "", offset);
  return { start, end: acc };
}

export function expandToSentenceEl(root: HTMLElement, offset: number): { start: number; end: number } {
  const block = expandToParagraphEl(root, offset);
  const text = root.textContent ?? "";
  const inner = text.slice(block.start, block.end);
  const local = expandToSentence(inner, Math.max(0, offset - block.start));
  return { start: block.start + local.start, end: block.start + local.end };
}

export function sliceText(text: string, start: number, end: number): string {
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}
