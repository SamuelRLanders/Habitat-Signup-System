import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath } from "./redirects";

// Run with: npm test

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    assert.equal(safeNextPath("/admin"), "/admin");
    assert.equal(safeNextPath("/admin/forms/abc?tab=past#top"), "/admin/forms/abc?tab=past#top");
  });

  it("ignores anything that isn't a path", () => {
    assert.equal(safeNextPath(undefined), null);
    assert.equal(safeNextPath(["/admin"]), null);
    assert.equal(safeNextPath("admin"), null);
    assert.equal(safeNextPath("https://evil.example"), null);
  });

  it("ignores paths that lead to another site", () => {
    for (const next of [
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      "\t//evil.example",
    ]) {
      assert.equal(safeNextPath(next), null, JSON.stringify(next));
    }
  });
});
