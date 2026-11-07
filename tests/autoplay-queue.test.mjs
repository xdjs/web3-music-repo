import test from "node:test";
import assert from "node:assert/strict";
import {
  createAutoplaySession,
  startAutoplayContext,
  noteQueueAttempt,
  excludeQueueRecording,
  replenishAutoplay,
  removeAutoplayTail,
} from "../src/autoplay-queue.mjs";
import {
  createShuffleQueue,
  replaceShuffleQueue,
  selectShuffledTrack,
  appendShuffleQueue,
  moveShuffleQueue,
  toggleQueueShuffle,
  clearShuffleQueue,
} from "../src/queue-shuffle.mjs";
const make = (ids = ["a"]) =>
  replaceShuffleQueue(createShuffleQueue(), ids, 0, "auto");
const plan = (ids) =>
  noteQueueAttempt(startAutoplayContext(createAutoplaySession(), ids), "a");
test("context is used before discovery and generated upcoming stays at20 through advancement", () => {
  let queue = make(),
    session = plan([
      "a",
      ...Array.from({ length: 30 }, (_, i) => "context" + i),
    ]);
  const discovery = Array.from({ length: 60 }, (_, i) => "discovery" + i);
  for (let step = 0; step < 50; step++) {
    ({ queue, session } = replenishAutoplay(queue, session, discovery));
    assert.equal(queue.ids.length - queue.index - 1, 20);
    assert.equal(new Set(queue.ids).size, queue.ids.length);
    if (step === 0)
      assert.ok(queue.entries.slice(1).every((e) => e.origin === "context"));
    if (step === 11) assert.equal(queue.entries.at(-1).origin, "autoplay");
    queue = selectShuffledTrack(
      queue,
      queue.ids[queue.index + 1],
      [],
      queue.ids,
      queue.index + 1,
    );
    session = noteQueueAttempt(session, queue.ids[queue.index]);
  }
});
test("manual add and Play Next precede generated entries without losing manual duplicates", () => {
  let { queue } = replenishAutoplay(
    make(["a", "manual"]),
    plan(["a", "context"]),
    ["discovery"],
    { target: 4 },
  );
  queue = appendShuffleQueue(queue, "manual");
  queue = appendShuffleQueue(queue, "next", { playNext: true });
  assert.deepEqual(queue.ids, [
    "a",
    "next",
    "manual",
    "manual",
    "context",
    "discovery",
  ]);
  const shuffled = toggleQueueShuffle(queue, true, () => 0);
  assert.deepEqual(
    new Set(shuffled.ids.slice(1, 4)),
    new Set(["next", "manual"]),
  );
  assert.deepEqual(toggleQueueShuffle(shuffled, false).ids, queue.ids);
});
test("explicit playlist stays intact, continuation labeled Autoplay and toggle off removes only untouched generated tail", () => {
  const explicit = make(["a", "b", "b"]);
  let { queue } = replenishAutoplay(explicit, plan([]), ["d", "e"], {
    target: 4,
  });
  assert.deepEqual(queue.ids, ["a", "b", "b", "d", "e"]);
  assert.equal(queue.entries[3].origin, "autoplay");
  assert.deepEqual(removeAutoplayTail(queue).ids, ["a", "b", "b"]);
  queue = moveShuffleQueue(queue, 4, 1);
  assert.deepEqual(
    removeAutoplayTail(queue).ids,
    queue.ids,
    "Explicitly reordered choices survive disabling autoplay",
  );
});
test("session attempts and removed songs are not reintroduced; exhaustion stops rather than repeating", () => {
  let session = plan(["a", "b"]);
  session = excludeQueueRecording(session, "b");
  session = noteQueueAttempt(session, "c");
  const result = replenishAutoplay(make(), session, ["a", "b", "c", "d", "d"]);
  assert.deepEqual(result.queue.ids, ["a", "d"]);
  assert.deepEqual(
    replenishAutoplay(result.queue, result.session, ["a", "b", "c", "d"]).queue
      .ids,
    ["a", "d"],
  );
  assert.deepEqual(
    replenishAutoplay(
      make(),
      startAutoplayContext(session, ["a", "c", "e"]),
      [],
    ).queue.ids,
    ["a", "e"],
  );
});
test("clear and disabled autoplay never refill, and unplayable entries are skipped", () => {
  const s = plan(["a", "b"]);
  assert.equal(
    replenishAutoplay(make(), { ...s, enabled: false }, ["c"]).queue.ids.length,
    1,
  );
  assert.equal(
    replenishAutoplay(clearShuffleQueue(make()), s, ["c"]).queue.ids.length,
    0,
  );
  assert.deepEqual(
    replenishAutoplay(make(), s, ["c"], { playable: (id) => id !== "b" }).queue
      .ids,
    ["a", "c"],
  );
});
test("shuffle restoration retains context order and later refill does not reorder existing next tracks", () => {
  const initial = { ...make(), enabled: true };
  const first = replenishAutoplay(initial, plan(["b", "c", "d"]), ["e"], {
    target: 3,
    random: () => 0,
  });
  assert.notDeepEqual(first.queue.ids, ["a", "b", "c", "d"]);
  assert.deepEqual(toggleQueueShuffle(first.queue, false).ids, [
    "a",
    "b",
    "c",
    "d",
  ]);
  const second = replenishAutoplay(first.queue, first.session, ["e"], {
    target: 4,
    random: () => 0,
  });
  assert.deepEqual(second.queue.ids.slice(0, 4), first.queue.ids);
});

test("only exhausted automatic continuation may skip, capped at three; delays/manual choices stop", async () => {
  const { shouldSkipUnavailable } = await import("../src/autoplay-queue.mjs");
  const state = {
    enabled: true,
    requested: true,
    generated: true,
    mode: "manual",
    hardFailure: true,
    failures: 1,
  };
  assert.equal(shouldSkipUnavailable(state), true);
  for (const change of [
    { enabled: false },
    { requested: false },
    { hardFailure: false },
    { generated: false },
    { failures: 4 },
  ])
    assert.equal(shouldSkipUnavailable({ ...state, ...change }), false);
});

test("Play Next inserted while shuffled stays ahead of generated context when shuffle turns off", () => {
  let { queue } = replenishAutoplay(make(), plan(["b", "c", "d"]), []);
  queue = toggleQueueShuffle(queue, true, () => 0);
  queue = appendShuffleQueue(queue, "manual-next", { playNext: true });
  assert.equal(toggleQueueShuffle(queue, false).ids[1], "manual-next");
});
