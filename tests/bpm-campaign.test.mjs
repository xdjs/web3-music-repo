import test from "node:test";
import assert from "node:assert/strict";
import {
  campaignEligible,
  campaignPlan,
  campaignCounts,
  providerCircuit,
} from "../src/bpm-campaign.mjs";
const track = (id, platform, extra = {}) => ({
  id,
  platform,
  kind: "audio",
  ...extra,
});
test("campaign never overwrites supplied tempo or retries completed, failed and review attempts", () => {
  const r = track("a", "Sound");
  assert.equal(campaignEligible(r, undefined), true);
  assert.equal(campaignEligible(r, { status: "pending" }), true);
  for (const status of [
    "estimated",
    "unavailable",
    "needs-review",
    "missing-media-reference",
    "deferred",
    "metadata-bpm",
  ])
    assert.equal(campaignEligible(r, { status }), false);
  assert.equal(
    campaignEligible(
      track("b", "Sound", { musicMetadata: { bpms: [120], keys: [] } }),
      undefined,
    ),
    false,
  );
  assert.equal(
    campaignEligible(track("c", "Sound", { note: "BPM: 120" }), undefined),
    false,
  );
  assert.equal(
    campaignEligible(track("d", "Sound", { kind: "artwork" }), undefined),
    false,
  );
});
test("unfinished Sound records resume first; non-Sound batches rotate without starving small platforms", () => {
  const records = [
    track("n1", "Nina"),
    track("n2", "Nina"),
    track("s1", "Sound"),
    track("s2", "Sound"),
    track("z1", "Zora"),
    track("c1", "Catalog"),
  ];
  let analysis = {
    records: { s1: { status: "pending" }, s2: { status: "estimated" } },
  };
  assert.deepEqual(campaignPlan(records, analysis, "Nina", 50).next, {
    platform: "Sound",
    recordIds: ["s1"],
  });
  analysis.records.s1 = { status: "estimated" };
  assert.equal(
    campaignPlan(records, analysis, "Catalog", 1).next.platform,
    "Nina",
  );
  assert.equal(
    campaignPlan(records, analysis, "Nina", 1).next.platform,
    "Zora",
  );
  assert.equal(
    campaignPlan(records, analysis, "Zora", 1).next.platform,
    "Catalog",
  );
  assert.deepEqual(
    campaignPlan(records, analysis, "Catalog", 1).next.recordIds,
    ["n1"],
  );
});
test("provider circuit stops sustained service failure but not isolated timeouts or unmeasurable music", () => {
  const timeout = {
      status: "unavailable",
      error: "The operation was aborted due to timeout",
    },
    ok = { status: "estimated" },
    review = { status: "needs-review" },
    rate = { status: "unavailable", error: "Media HTTP 429" };
  assert.equal(providerCircuit([timeout, ...Array(9).fill(ok)]).stop, false);
  assert.equal(
    providerCircuit([...Array(8).fill(timeout), ok, review]).stop,
    true,
  );
  assert.equal(providerCircuit([...Array(4).fill(rate), ok]).stop, true);
  assert.equal(
    providerCircuit(
      Array(10).fill({
        status: "unavailable",
        error: "Duration outside 10–1800 second analysis range",
      }),
    ).stop,
    false,
  );
  assert.equal(
    providerCircuit(
      Array(10).fill({ status: "unavailable", error: "Media HTTP 404" }),
    ).stop,
    false,
  );
});
test("public campaign totals use source-first counts and preserve uncertainty categories", () => {
  const records = [
    track("source", "Sound", { musicMetadata: { bpms: [120], keys: [] } }),
    track("estimate", "Nina"),
    track("review", "Nina"),
    track("failed", "Sound"),
    track("pending", "Sound"),
    track("new", "Zora"),
  ];
  const analysis = {
    records: {
      source: { status: "estimated" },
      estimate: { status: "estimated" },
      review: { status: "needs-review" },
      failed: { status: "unavailable" },
      pending: { status: "pending" },
    },
  };
  assert.deepEqual(campaignCounts(records, analysis), {
    records: 6,
    supplied: 1,
    estimated: 1,
    needsReview: 1,
    unavailable: 1,
    deferred: 0,
    pending: 1,
    untouched: 1,
    other: 0,
  });
});
