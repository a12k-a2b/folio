import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseOps, PUSH_MAX_OPS } from "./sync-ops.ts";

describe("parseOps", () => {
  it("keeps a poison voice in the same batch as a bookmark", () => {
    const ops = parseOps({
      ops: [
        { op: "put", table: "voices", id: "ghost", row: { highlightId: "h1", transcript: "no blob" } },
        { op: "put", table: "bookmarks", id: "b1", row: { bookId: "living-structure", label: "v1.1" } },
        { op: "put", table: "progress", id: "living-structure", updatedAt: "2026-09-05T12:00:00.000Z", row: { bookId: "living-structure", pageIndex: 2 } },
        { op: "delete", table: "highlights", id: "gone", updatedAt: "2026-09-05T12:00:01.000Z" },
      ],
    });
    assert.ok(ops);
    assert.equal(ops.length, 4);
    assert.equal(ops[0]?.table, "voices");
    assert.equal(ops[1]?.table, "bookmarks");
    assert.equal(ops[2]?.table, "progress");
    assert.equal(ops[3]?.op, "delete");
  });

  it("drops unknown tables and malformed items without stalling the rest", () => {
    const ops = parseOps({
      ops: [
        { op: "put", table: "change_log", id: "nope" },
        null,
        { op: "merge", table: "highlights", id: "x" },
        { op: "put", table: "highlights", id: "keep", row: { bookId: "walden", chapterId: "w-1", text: "hi" } },
      ],
    });
    assert.ok(ops);
    assert.equal(ops.length, 1);
    assert.equal(ops[0]?.id, "keep");
  });

  it("caps at 100 on apply, not parse", () => {
    assert.equal(PUSH_MAX_OPS, 100);
    const ops = parseOps({
      ops: Array.from({ length: 3 }, (_, i) => ({ op: "put", table: "tags", id: `t${i}`, row: { name: `t${i}` } })),
    });
    assert.equal(ops?.length, 3);
  });
});
