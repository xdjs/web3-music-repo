import test from "node:test";
import assert from "node:assert/strict";
import { musicFacts } from "../src/music-facts.mjs";
test("explicit release-note tempo and key survive with attribution", () => {
  assert.deepEqual(musicFacts({ note: "BPM: 140\nKey: Amin" }), {
    bpm: 140,
    key: "A minor",
    source: "Release notes; not audio-analysis estimates",
  });
  assert.equal(musicFacts({ title: "NIGHTFALL (122 BPM)" }).bpm, 122);
  assert.equal(musicFacts({ note: "BPM93.33" }).bpm, 93.33);
});
test("mentions, conflicting values and unrelated prose do not become music facts", () => {
  assert.equal(
    musicFacts({
      note: "A major source of inspiration.\nI heard a 140 BPM track.",
    }).key,
    null,
  );
  assert.equal(musicFacts({ note: "I heard a 140 BPM track." }).bpm, null);
  assert.equal(musicFacts({ note: "BPM: 70\nBPM: 140" }).bpm, null);
  assert.equal(musicFacts({ note: "Key: Amin\nKey: Gmin" }).key, null);
});
