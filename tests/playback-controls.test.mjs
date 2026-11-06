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

test("feedback distinguishes initial loading, interrupted playback and seeking", async () => {
  const { playbackFeedback } = await import("../src/playback-controls.mjs");
  assert.equal(
    playbackFeedback({ ...state, pending: true, paused: true }).phase,
    "loading",
  );
  assert.equal(
    playbackFeedback({ ...state, readyState: 2, currentTime: 40 }).phase,
    "buffering",
  );
  assert.equal(
    playbackFeedback({ ...state, readyState: 2, currentTime: 0 }).phase,
    "loading",
  );
  assert.equal(
    playbackFeedback({ ...state, readyState: 4, seeking: true }).phase,
    "seeking",
  );
  // A stalled download with playable buffered media must not say buffering.
  assert.equal(
    playbackFeedback({ ...state, readyState: 4, currentTime: 40 }).busy,
    false,
  );
  for (const change of [
    { requested: false },
    { paused: true },
    { error: true },
    { ended: true },
  ])
    assert.equal(
      playbackFeedback({ ...state, readyState: 2, currentTime: 40, ...change })
        .busy,
      false,
    );
});

test("busy playback remains pausable and unchanged updates preserve the button DOM", async () => {
  const { playbackFeedback, syncPlaybackButton } =
    await import("../src/playback-controls.mjs");
  const attributes = new Map();
  let writes = 0;
  const button = {
    dataset: {},
    getAttribute: (key) => attributes.get(key),
    setAttribute: (key, value) => attributes.set(key, value),
    set innerHTML(value) {
      writes++;
      this.html = value;
    },
  };
  const busy = {
    action: "pause",
    feedback: playbackFeedback({ ...state, pending: true }),
    label: "Pause song",
  };
  const icon = (action) => `<svg>${action}</svg>`;
  assert.equal(syncPlaybackButton(button, busy, icon), true);
  assert.equal(button.dataset.playbackBusy, "true");
  assert.equal(attributes.get("aria-label"), "Pause song — Loading…");
  assert.match(button.html, /pause/);
  assert.equal(syncPlaybackButton(button, busy, icon), false);
  assert.equal(writes, 1);
  syncPlaybackButton(
    button,
    { action: "pause", label: "Pause song", feedback: { busy: false } },
    icon,
  );
  assert.equal(button.dataset.playbackBusy, "false");
  assert.equal(attributes.get("aria-label"), "Pause song");
});
