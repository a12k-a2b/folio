import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isNewer, resolveUpdatedAt, SKEW_MS } from "./sync-clock.ts";
import { companionKey, remapLocalId, sameCompanion } from "./theo-ids.ts";

describe("sync clock", () => {
  it("keeps a garden-offline past stamp", () => {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    assert.equal(Date.parse(resolveUpdatedAt(past)), Date.parse(past));
  });

  it("clamps a stamp more than 24h in the future", () => {
    const now = Date.UTC(2026, 8, 5, 12, 0, 0);
    const future = new Date(now + SKEW_MS + 60_000).toISOString();
    const got = Date.parse(resolveUpdatedAt(future, now));
    assert.equal(got, now);
  });

  it("fills a missing stamp with now", () => {
    const now = Date.UTC(2026, 8, 5, 12, 0, 0);
    assert.equal(Date.parse(resolveUpdatedAt("", now)), now);
    assert.equal(Date.parse(resolveUpdatedAt(undefined, now)), now);
  });

  it("orders last-writer", () => {
    assert.equal(isNewer("2026-09-05T12:00:01.000Z", "2026-09-05T12:00:00.000Z"), true);
    assert.equal(isNewer("2026-09-05T12:00:00.000Z", "2026-09-05T12:00:01.000Z"), false);
  });
});

describe("theo ids", () => {
  it("aliases bundled and club-suffixed companion rows", () => {
    assert.equal(companionKey("theo-hl-feeling"), "theo-hl-feeling");
    assert.equal(companionKey("theo-hl-feeling-ab12cd34"), "theo-hl-feeling");
    assert.equal(sameCompanion("theo-hl-feeling", "theo-hl-feeling-ab12cd34"), true);
    assert.equal(sameCompanion("theo-v-heat", "theo-hl-heat"), false);
    assert.equal(
      remapLocalId("theo-hl-feeling", ["theo-hl-feeling-ab12cd34", "other"]),
      "theo-hl-feeling-ab12cd34",
    );
  });
});
