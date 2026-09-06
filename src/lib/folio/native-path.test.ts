import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNativePath, POWERSYNC_LOCKED, NATIVE_PROTOCOL, SYNC_VERSION } from "./native-path.ts";

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

  it("parses snapshot, mutations, blobs, and batch push", () => {
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
    assert.deepEqual(parseNativePath("/api/native/v1/voices/v1"), { name: "voice", id: "v1" });
    assert.deepEqual(parseNativePath("/api/native/v1/tags"), { name: "tags" });
    assert.deepEqual(parseNativePath("/api/native/v1/settings"), { name: "settings" });
    assert.deepEqual(parseNativePath("/api/native/v1/push"), { name: "push" });
    assert.deepEqual(parseNativePath("/api/native/v1/blobs"), { name: "blobs" });
    assert.deepEqual(parseNativePath("/api/native/v1/blobs/abc"), { name: "blob", id: "abc" });
    assert.deepEqual(parseNativePath("/api/native/v1/blobs/abc/data"), { name: "blobData", id: "abc" });
    assert.deepEqual(parseNativePath("/api/native/v1/blobs/abc/complete"), {
      name: "blobComplete",
      id: "abc",
    });
    assert.equal(parseNativePath("/api/folio/library"), null);
    assert.equal(parseNativePath("/api/native/v2/health"), null);
  });

  it("keeps PowerSync locked; v1.1 is HTTP, not a new protocol", () => {
    assert.equal(POWERSYNC_LOCKED, true);
    assert.equal(NATIVE_PROTOCOL, "folio-native/1");
    assert.equal(SYNC_VERSION, "v1.1");
  });
});
