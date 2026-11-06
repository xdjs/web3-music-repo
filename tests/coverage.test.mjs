import { test } from "node:test";
import assert from "node:assert/strict";
import { expansionCoverage } from "../src/recovery-coverage.mjs";
test("coverage separates unminted contracts from unresolved music and preserves successful reads", () => {
  const modern = {
    attempts: {
      a: { status: "live" },
      b: { status: "unavailable" },
      c: { status: "unavailable" },
      d: { status: "unavailable" },
    },
  };
  const fallback = {
    attempts: {
      a: { status: "unminted" },
      b: { status: "unminted" },
      c: { status: "live" },
    },
  };
  const d = expansionCoverage(modern, fallback);
  assert.equal(d.attempted, 4);
  assert.equal(d.recovered, 2);
  assert.equal(d.unminted, 1);
  assert.equal(d.unresolved, 1);
});

test("Catalog coverage separates snapshot pointers from current contract reads and excludes foreign IDs", async () => {
  const { catalogCoverage } = await import("../src/recovery-coverage.mjs");
  const c = catalogCoverage(
    {
      records: [
        { id: "a", chainId: 1 },
        { id: "b", chainId: 8453 },
      ],
    },
    {
      evidence: {
        a: { mediaURI: "ar://a" },
        b: { mediaURI: "ar://b" },
        foreign: { mediaURI: "ar://c" },
      },
    },
    {
      evidence: {
        a: { status: "live" },
        b: { status: "unavailable" },
        foreign: { status: "live" },
      },
    },
  );
  assert.equal(c.tokenEntries, 2);
  assert.equal(c.ethereum, 1);
  assert.equal(c.base, 1);
  assert.equal(c.indexedMedia, 2);
  assert.equal(c.currentMetadata, 1);
});
