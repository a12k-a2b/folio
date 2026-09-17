import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BRUSHES,
  brushPrompt,
  parsePrintJson,
  primaryBrush,
  surroundingContext,
} from "./brushes.ts";
import { DEFAULT_TAGS } from "./types.ts";

describe("programmable highlighters", () => {
  it("gives every default tag a brush", () => {
    for (const t of DEFAULT_TAGS) {
      assert.ok(BRUSHES[t.kind], t.kind);
      assert.ok(BRUSHES[t.kind].verb);
    }
  });

  it("Book finds, Quote checks, Question asks", () => {
    assert.equal(BRUSHES.book.verb, "Find");
    assert.equal(BRUSHES.quote.verb, "Check");
    assert.equal(BRUSHES.question.verb, "Ask");
    assert.equal(BRUSHES.book.search, true);
    assert.equal(BRUSHES.quote.search, false);
  });

  it("picks the strongest brush when several tags sit on one mark", () => {
    assert.equal(primaryBrush(["idea", "book", "person"]), "book");
    assert.equal(primaryBrush(["quote", "question"]), "question");
    assert.equal(primaryBrush([]), null);
  });

  it("keeps surrounding context, not the whole chapter", () => {
    const text = "aaa " + "word ".repeat(200) + "MARK" + " word".repeat(200);
    const start = text.indexOf("MARK");
    const ctx = surroundingContext(text, start, start + 4, 40);
    assert.ok(ctx.includes("MARK"));
    assert.ok(ctx.length < 120);
    assert.ok(ctx.startsWith("…"));
  });

  it("book prompt asks for the cited work; quote prompt asks for doubt", () => {
    const base = {
      passage: "The Timeless Way of Building is the feeling, not the catalog.",
      note: "",
      context: "Christopher Alexander spent a life trying to say this in buildings.",
      bookTitle: "Living Structure",
      author: "Folio Field Notes",
      chapterTitle: "How to read a place",
    };
    const book = brushPrompt({ ...base, kind: "book" });
    assert.match(book, /citation/i);
    const quote = brushPrompt({ ...base, kind: "quote" });
    assert.match(quote, /fact-check/i);
    const q = brushPrompt({ ...base, kind: "question", note: "Is there more recent work?" });
    assert.match(q, /Is there more recent work/);
  });

  it("parses a print even if the model wraps JSON", () => {
    const slip = parsePrintJson(
      '```json\n{"kicker":"Cited work","title":"The Timeless Way of Building","body":"Alexander, 1979.","sources":[{"title":"Wikipedia","url":"https://en.wikipedia.org/wiki/The_Timeless_Way_of_Building"}]}\n```',
      "book",
      "hl-1",
    );
    assert.equal(slip.title, "The Timeless Way of Building");
    assert.equal(slip.sources[0]?.title, "Wikipedia");
    assert.equal(slip.kind, "book");
  });
});
