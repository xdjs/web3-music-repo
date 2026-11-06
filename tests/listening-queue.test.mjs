import { test } from "node:test";
import assert from "node:assert/strict";
import { selectQueueTrack, removeQueueTrack } from "../src/listening-queue.mjs";
test("plain play rotates browsing context to begin with the clicked recording", () => {
  assert.deepEqual(
    selectQueueTrack({ ids: [], index: -1, mode: null }, "b", ["a", "b", "c"]),
    { ids: ["b", "c", "a"], index: 0, mode: "auto" },
  );
});
test("explicit queue is preserved when playing another record", () => {
  assert.deepEqual(
    selectQueueTrack({ ids: ["a", "b", "c"], index: 0, mode: "manual" }, "x", [
      "x",
      "y",
    ]),
    { ids: ["a", "x", "b", "c"], index: 1, mode: "manual" },
  );
});
test("next preserves auto mode but a new explicit playlist is manual", () => {
  const ids = ["a", "b"];
  const state = { ids, index: 0, mode: "auto" };
  assert.equal(selectQueueTrack(state, "b", [], ids, 1).mode, "auto");
  assert.equal(selectQueueTrack(state, "b", [], ["b", "a"], 0).mode, "manual");
});
test("removal before and at playback position retains correct next item", () => {
  const state = { ids: ["a", "b", "c"], index: 1, mode: "auto" };
  assert.deepEqual(removeQueueTrack(state, 0), {
    ids: ["b", "c"],
    index: 0,
    mode: "manual",
  });
  assert.deepEqual(removeQueueTrack(state, 1), {
    ids: ["a", "c"],
    index: 0,
    mode: "manual",
  });
  assert.equal(removeQueueTrack(state, 99), state);
});
