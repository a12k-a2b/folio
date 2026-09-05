import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNativePath, POWERSYNC_LOCKED, NATIVE_PROTOCOL } from "./native-path.ts";

describe("native path", () => {
  it("parses health and catalog", () => {
    assert.deepEqual(parseNativePath("/api/native/v1/health"), { name: "health" });
    assert.deepEqual(parseNativePath("/api/native/v1"), { name: "health" });
    assert.deepEqual(parseNativePath("/api/native/v1/catalog"), { name: "catalog" });
    assert.deepEqual(parseNativePath("/api/native/v1/catalog/living-structure"), {
      name: "catalogBook",
      bookId: "living-structure",
    });
    assert.deepEqual(parseNativePath("/api/native/v1/catalog/living-structure/"), {
      name: "catalogBook",
      bookId: "living-structure",
    });
  });

  it("parses snapshot and mutations", () => {
    assert.deepEqual(parseNativePath("/api/native/v1/snapshot/walden"), {
      name: "snapshot",
      bookId: "walden",
    });
    assert.deepEqual(parseNativePath("/api/native/v1/highlights/abc"), {
      name: "highlight",
      id: "abc",
    });
    assert.deepEqual(parseNativePath("/api/native/v1/bookmarks/xyz"), {
      name: "bookmark",
      id: "xyz",
    });
    assert.deepEqual(parseNativePath("/api/native/v1/me"), { name: "me" });
    assert.deepEqual(parseNativePath("/api/native/v1/library"), { name: "library" });
    assert.deepEqual(parseNativePath("/api/native/v1/voices"), { name: "voices" });
    assert.deepEqual(parseNativePath("/api/native/v1/tags"), { name: "tags" });
    assert.deepEqual(parseNativePath("/api/native/v1/settings"), { name: "settings" });
    assert.equal(parseNativePath("/api/folio/library"), null);
    assert.equal(parseNativePath("/api/native/v2/health"), null);
  });

  it("keeps PowerSync locked until native clients are proven on device", () => {
    assert.equal(POWERSYNC_LOCKED, true);
    assert.equal(NATIVE_PROTOCOL, "folio-native/1");
  });
});
