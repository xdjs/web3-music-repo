import test from "node:test";
import assert from "node:assert/strict";
import { summarizeBpmCoverage } from "../src/bpm-coverage.mjs";
import {
  campaignPlan,
  providerCircuit,
  campaignCounts,
} from "../src/bpm-campaign.mjs";
test("deferred files stay missing and visibly distinct; healthy platforms continue without automatic failed retries", () => {
  const source = {
      id: "source",
      platform: "A",
      kind: "audio",
      musicMetadata: { bpms: [120], keys: [] },
      audioAnalysis: { status: "deferred" },
    },
    slow = {
      id: "slow",
      platform: "A",
      kind: "audio",
      audioAnalysis: {
        status: "deferred",
        error: "Source transfer budget exhausted",
        retryable: true,
      },
    },
    fresh = { id: "fresh", platform: "B", kind: "audio" };
  const rows = [source, slow, fresh],
    analysis = {
      records: { source: source.audioAnalysis, slow: slow.audioAnalysis },
    };
  const summary = summarizeBpmCoverage(rows);
  assert.equal(summary.supplied, 1);
  assert.equal(summary.missing, 2);
  assert.equal(summary.deferred, 1);
  assert.deepEqual(summary.missingByAnalysisState, {
    deferred: 1,
    "not-analyzed": 1,
  });
  assert.equal(campaignCounts(rows, analysis).deferred, 1);
  assert.equal(providerCircuit(Array(10).fill(slow.audioAnalysis)).stop, false);
  assert.equal(campaignPlan(rows, analysis).next.platform, "B");
});
