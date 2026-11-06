import test from "node:test";
import assert from "node:assert/strict";
import { recordingControlState } from "../src/playback-controls.mjs";

const state = {
  id: "a",
  currentId: "a",
  requested: true,
  pending: false,
  paused: false,
  ended: false,
  error: false,
  queueIndex: 2,
};
test("all surfaces for the playing recording offer Pause; other recordings offer Play", () => {
  assert.equal(recordingControlState(state).action, "pause");
  assert.deepEqual(recordingControlState({ ...state, id: "b" }), {
    current: false,
    action: "play",
  });
});
test("a pending metadata load can be paused without an audio source yet", () => {
  assert.equal(
    recordingControlState({ ...state, pending: true, paused: true }).action,
    "pause",
  );
  assert.equal(
    recordingControlState({
      ...state,
      pending: true,
      paused: true,
      requested: false,
    }).action,
    "play",
  );
});
test("pause, ended, errors and rejected play show Play", () => {
  for (const change of [
    { paused: true },
    { ended: true },
    { error: true },
    { requested: false },
  ])
    assert.equal(recordingControlState({ ...state, ...change }).action, "play");
});
test("a duplicate queue occurrence remains a separate Play action", () => {
  assert.equal(
    recordingControlState({ ...state, controlQueueIndex: 2 }).action,
    "pause",
  );
  assert.deepEqual(recordingControlState({ ...state, controlQueueIndex: 3 }), {
    current: false,
    action: "play",
  });
});
