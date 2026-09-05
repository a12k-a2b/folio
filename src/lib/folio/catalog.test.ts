import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { POWERSYNC_LOCKED } from "./native-path.ts";

describe("catalog dump", () => {
  it("ships the six bundled books the native apps open offline", () => {
    const raw = readFileSync(new URL("../../../native/shared/catalog.json", import.meta.url), "utf8");
    const catalog = JSON.parse(raw) as {
      protocol: string;
      powersyncLocked: boolean;
      books: { id: string; chapterCount: number; wordCount: number }[];
      full: Record<string, { chapters: { html: string }[] }>;
    };
    assert.equal(catalog.protocol, "folio-native/1");
    assert.equal(catalog.powersyncLocked, true);
    assert.equal(catalog.books.length, 6);
    const ids = catalog.books.map((b) => b.id);
    assert.ok(ids.includes("living-structure"));
    assert.ok(ids.includes("folio-guide"));
    assert.ok(ids.includes("walden"));
    for (const b of catalog.books) {
      assert.ok(b.chapterCount >= 1);
      assert.ok(b.wordCount > 40);
    }
    const ls = catalog.full["living-structure"];
    assert.ok(ls.chapters[0]?.html.includes("feeling"));
  });

  it("does not unlock PowerSync from the catalog module", () => {
    assert.equal(POWERSYNC_LOCKED, true);
  });
});
