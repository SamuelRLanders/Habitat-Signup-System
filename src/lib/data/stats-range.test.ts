import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStatsRange, rangeQuery } from "./stats-range";

const range = (query: string, today: string) => parseStatsRange(new URLSearchParams(query), today);

test("this school year is the default, from fall through summer", () => {
  assert.deepEqual(range("", "2026-11-26"), {
    preset: "this-year",
    from: "2026-08-16",
    to: "2027-08-15",
    label: "2026–27 school year",
  });
  // Summer still belongs to the school year that started the fall before.
  assert.equal(range("", "2027-07-01").from, "2026-08-16");
  assert.equal(range("range=last-year", "2026-11-26").from, "2025-08-16");
});

test("semesters follow Purdue's terms", () => {
  assert.equal(range("range=this-semester", "2026-11-26").label, "Fall 2026");
  assert.equal(range("range=this-semester", "2026-05-15").label, "Spring 2026");
  assert.equal(range("range=this-semester", "2026-05-16").label, "Summer 2026");
  const last = range("range=last-semester", "2026-02-01");
  assert.deepEqual([last.from, last.to, last.label], ["2025-08-16", "2025-12-31", "Fall 2025"]);
});

test("custom dates are swapped when backwards, and bad ones ignored", () => {
  const custom = range("range=custom&from=2026-10-31&to=2026-09-01", "2026-11-26");
  assert.deepEqual([custom.from, custom.to], ["2026-09-01", "2026-10-31"]);
  assert.equal(range("range=custom&from=2026-02-30", "2026-11-26").from, null);
  assert.equal(range("range=nonsense", "2026-11-26").preset, "this-year");
});

test("the query string leaves out the default", () => {
  assert.equal(rangeQuery({ preset: "this-year", from: "2026-08-16", to: null }), "");
  assert.equal(rangeQuery({ preset: "all", from: null, to: null }), "range=all");
  assert.equal(
    rangeQuery({ preset: "custom", from: "2026-09-01", to: null }),
    "range=custom&from=2026-09-01",
  );
});
