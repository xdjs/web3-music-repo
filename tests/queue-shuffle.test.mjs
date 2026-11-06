import test from "node:test";
import assert from "node:assert/strict";
import {
  createShuffleQueue,
  toggleQueueShuffle,
  replaceShuffleQueue,
  selectShuffledTrack,
  appendShuffleQueue,
  removeShuffleQueue,
  clearShuffleQueue,
} from "../src/queue-shuffle.mjs";
const zero = () => 0;
test("enabling changes only upcoming order and never changes current occurrence", () => {
  const s = replaceShuffleQueue(
    createShuffleQueue(),
    ["a", "b", "c", "d", "e"],
    1,
  );
  const t = toggleQueueShuffle(s, true, zero);
  assert.deepEqual(s.ids, ["a", "b", "c", "d", "e"]);
  assert.deepEqual(t.ids, ["a", "b", "d", "e", "c"]);
  assert.equal(t.index, 1);
  assert.equal(t.entries[1].key, s.entries[1].key);
});
test("Next/Previous walk a stable shuffle without calling random again", () => {
  const s = toggleQueueShuffle(
    replaceShuffleQueue(createShuffleQueue(), ["a", "b", "c", "d"], 0),
    true,
    zero,
  );
  const fail = () => {
    throw Error("Unexpected reshuffle");
  };
  const next = selectShuffledTrack(s, s.ids[1], [], s.ids, 1, fail);
  assert.deepEqual(next.ids, s.ids);
  const prev = selectShuffledTrack(next, next.ids[0], [], next.ids, 0, fail);
  assert.deepEqual(prev.ids, s.ids);
  assert.equal(prev.index, 0);
});
test("turning off restores only remaining original order after navigation", () => {
  let s = toggleQueueShuffle(
    replaceShuffleQueue(createShuffleQueue(), ["a", "b", "c", "d", "e"], 0),
    true,
    zero,
  );
  s = selectShuffledTrack(s, s.ids[1], [], s.ids, 1);
  const t = toggleQueueShuffle(s, false);
  assert.deepEqual(t.ids, ["a", "c", "b", "d", "e"]);
  assert.equal(t.ids[t.index], "c");
});
test("duplicate IDs have distinct occurrences; removal and append survive disabling", () => {
  let s = toggleQueueShuffle(
    replaceShuffleQueue(createShuffleQueue(), ["a", "b", "b", "c"], 0),
    true,
    zero,
  );
  const removed = s.entries[1].key;
  s = removeShuffleQueue(s, 1);
  s = appendShuffleQueue(s, "b");
  const t = toggleQueueShuffle(s, false);
  assert.equal(
    t.entries.some((e) => e.key === removed),
    false,
  );
  assert.deepEqual(t.ids, ["a", "b", "c", "b"]);
  assert.equal(new Set(t.entries.map((e) => e.key)).size, 4);
});
test("preference survives empty state and new playlist preserves clicked index", () => {
  const s = toggleQueueShuffle(createShuffleQueue(), true, zero);
  const t = selectShuffledTrack(s, "b", [], ["a", "b", "c", "d"], 1, zero);
  assert.deepEqual(t.ids, ["a", "b", "d", "c"]);
  assert.equal(t.index, 1);
  const cleared = clearShuffleQueue(t);
  assert.equal(cleared.enabled, true);
  assert.equal(cleared.index, -1);
  assert.deepEqual(cleared.ids, []);
  const next = selectShuffledTrack(
    cleared,
    "x",
    ["x", "y", "z"],
    null,
    null,
    zero,
  );
  assert.deepEqual(next.ids, ["x", "z", "y"]);
});
test("current occurrence removal still points Next at the next queued entry", () => {
  let s = toggleQueueShuffle(
    replaceShuffleQueue(createShuffleQueue(), ["a", "b", "c", "d"], 1),
    true,
    zero,
  );
  const expectedNext = s.ids[2];
  s = removeShuffleQueue(s, 1);
  assert.equal(s.index, 0);
  assert.equal(s.ids[s.index + 1], expectedNext);
  assert.deepEqual(toggleQueueShuffle(s, false).ids, ["a", "c", "d"]);
});
test("manual queue insertion retains remaining entries and remembers original relative order", () => {
  let s = toggleQueueShuffle(
    replaceShuffleQueue(createShuffleQueue(), ["a", "b", "c", "d"], 0),
    true,
    zero,
  );
  s = selectShuffledTrack(s, "x", ["unrelated"]);
  assert.deepEqual(s.ids, ["a", "x", "c", "d", "b"]);
  assert.deepEqual(toggleQueueShuffle(s, false).ids, ["a", "x", "b", "c", "d"]);
});
test("toggle idempotence and tiny queues do not consume randomness", () => {
  const fail = () => {
    throw Error("No random needed");
  };
  let s = replaceShuffleQueue(createShuffleQueue(), ["a"], 0);
  s = toggleQueueShuffle(s, true, fail);
  assert.equal(toggleQueueShuffle(s, true, fail), s);
  assert.deepEqual(toggleQueueShuffle(s, false, fail).ids, ["a"]);
});
test("manual queue built before first play applies saved shuffle once", () => {
  let s = createShuffleQueue(true);
  for (const id of ["a", "b", "c", "d"]) s = appendShuffleQueue(s, id);
  s = selectShuffledTrack(s, "a", [], s.ids, 0, zero);
  assert.deepEqual(s.ids, ["a", "c", "d", "b"]);
  const next = selectShuffledTrack(s, s.ids[1], [], s.ids, 1, () => {
    throw Error("Unexpected reshuffle");
  });
  assert.deepEqual(next.ids, s.ids);
});

test("dragging current duplicate preserves the exact playing occurrence", async () => {
  const { moveShuffleQueue } = await import("../src/queue-shuffle.mjs");
  const s = replaceShuffleQueue(createShuffleQueue(), ["a", "b", "a", "c"], 2);
  const currentKey = s.entries[2].key;
  const moved = moveShuffleQueue(s, 2, 0);
  assert.deepEqual(moved.ids, ["a", "a", "b", "c"]);
  assert.equal(moved.index, 0);
  assert.equal(moved.entries[moved.index].key, currentKey);
  assert.deepEqual(s.ids, ["a", "b", "a", "c"]);
});
test("explicit reorder under shuffle remains when shuffle is turned off", async () => {
  const { moveShuffleQueue } = await import("../src/queue-shuffle.mjs");
  const s = toggleQueueShuffle(
    replaceShuffleQueue(createShuffleQueue(), ["a", "b", "c", "d"], 0),
    true,
    zero,
  );
  const moved = moveShuffleQueue(s, 3, 1);
  assert.equal(moved.enabled, true);
  assert.equal(moved.mode, "manual");
  assert.deepEqual(toggleQueueShuffle(moved, false).ids, moved.ids);
  const next = selectShuffledTrack(
    moved,
    moved.ids[1],
    [],
    moved.ids,
    1,
    () => {
      throw Error("Unexpected shuffle");
    },
  );
  assert.equal(next.ids[1], moved.ids[1]);
});
test("moving across the playhead adjusts index and preserves deletions", async () => {
  const { moveShuffleQueue } = await import("../src/queue-shuffle.mjs");
  let s = replaceShuffleQueue(createShuffleQueue(), ["a", "b", "c", "d"], 2);
  s = removeShuffleQueue(s, 1);
  const moved = moveShuffleQueue(s, 2, 0);
  assert.deepEqual(moved.ids, ["d", "a", "c"]);
  assert.equal(moved.index, 2);
  assert.equal(moved.ids.includes("b"), false);
  assert.equal(moveShuffleQueue(moved, -1, 0), moved);
  assert.equal(moveShuffleQueue(moved, 0, 7), moved);
  assert.equal(moveShuffleQueue(moved, 1, 1), moved);
});
