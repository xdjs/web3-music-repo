import test from "node:test";
import assert from "node:assert/strict";
import {
  readBpmSelection,
  retryBpmIds,
  completedRetryIds,
} from "../src/bpm-retry-plan.mjs";

test("retry queue preserves supplied tempos, estimates and uncertain results", () => {
  const rows = [
    "failed",
    "deferred",
    "supplied",
    "estimated",
    "review",
    "large",
    "silent",
  ].map((id) => ({
    id,
    kind: "audio",
    note: id === "supplied" ? "BPM: 120" : "",
  }));
  const records = Object.fromEntries(
    rows.map((r) => [r.id, { status: "unavailable" }]),
  );
  records.deferred.status = "deferred";
  records.estimated = { status: "estimated", bpm: 90 };
  records.review.status = "needs-review";
  records.large.failureReason = "size-limit";
  records.silent.error = "Media contains no audio stream";
  assert.deepEqual(retryBpmIds(rows, { records }), ["failed", "deferred"]);
  assert.deepEqual(retryBpmIds(rows, { records }, ["failed"]), ["deferred"]);
});

test("selection limits retries to the explicit saved IDs", () => {
  assert.equal(
    readBpmSelection([], () => {
      throw Error("Unexpected read");
    }),
    null,
  );
  assert.deepEqual(
    [
      ...readBpmSelection(
        ["--record-ids-file=queue.json"],
        () => '["one","two","one"]',
      ),
    ],
    ["one", "two"],
  );
  assert.deepEqual(
    [...readBpmSelection(["--record-ids-file=queue.json"], () => "[]")],
    [],
  );
  for (const body of [
    "{}",
    '[""]',
    "[4]",
    JSON.stringify(Array(1001).fill("one")),
  ])
    assert.throws(() =>
      readBpmSelection(["--record-ids-file=queue.json"], () => body),
    );
});

test("an empty selection filename cannot expand into an unrestricted pass", () => {
  assert.throws(() => readBpmSelection(["--record-ids-file="], () => "[]"));
});

test("interrupted retries count only completed results from this attempt", () => {
  const analysis = {
    records: {
      complete: { status: "unavailable", checkedAt: "2026-11-11T12:01:00Z" },
      old: { status: "unavailable", checkedAt: "2026-11-10T12:01:00Z" },
      pending: { status: "pending", checkedAt: "2026-11-11T12:01:00Z" },
    },
  };
  assert.deepEqual(
    completedRetryIds(
      ["complete", "old", "pending", "missing"],
      analysis,
      "2026-11-11T12:00:00Z",
    ),
    ["complete"],
  );
});
