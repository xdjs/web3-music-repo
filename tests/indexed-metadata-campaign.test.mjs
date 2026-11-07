import test from "node:test";
import assert from "node:assert/strict";
import { metadataBatchDecision } from "../src/indexed-metadata-campaign.mjs";
test("metadata campaign continues useful partial progress but stops provider failures, crashes, no progress and exhaustion", () => {
  const report = { selectedRecords: 1000, read: 997, failures: [{}, {}, {}] };
  assert.equal(metadataBatchDecision(report, 0).continue, true);
  for (const [r, code, reason] of [
    [report, 1, "worker-exit-failure"],
    [
      { ...report, stoppedReason: "three-consecutive-provider-failures" },
      0,
      "three-consecutive-provider-failures",
    ],
    [{ ...report, interrupted: true }, 0, "interrupted"],
    [{ ...report, read: 0 }, 0, "no-successful-progress"],
    [{ selectedRecords: 0, read: 0 }, 0, "eligible-cohort-exhausted"],
  ])
    assert.deepEqual(metadataBatchDecision(r, code), {
      continue: false,
      reason,
    });
});
