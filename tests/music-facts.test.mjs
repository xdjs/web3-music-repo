import test from "node:test";
import assert from "node:assert/strict";
import { musicFacts } from "../src/music-facts.mjs";
test("explicit standalone title tempos outrank half-time audio estimates", () => {
  for (const title of [
    "Lofi_Hip_Hop__BPM145",
    "Beat 145bpm Dm",
    "BPM:145",
    "145Bpm",
  ])
    assert.equal(
      musicFacts({ title, audioAnalysis: { status: "estimated", bpm: 72.5 } })
        .bpm,
      145,
    );
  for (const title of [
    "v145 beat",
    "ArtistBPM145",
    "BPM1999",
    "Song [120 BPM)",
    "BPM12",
  ])
    assert.equal(musicFacts({ title }).bpm, null);
  assert.equal(musicFacts({ title: "120bpm - 140bpm" }).bpm, null);
});
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

test("explicit bracketed title tempos preserve decimals and reject mismatched delimiters", () => {
  assert.equal(musicFacts({ title: "REAL CRIA [121.35 BPM]" }).bpm, 121.35);
  assert.equal(musicFacts({ title: "Mix (120 BPM) [140 BPM]" }).bpm, null);
  assert.equal(musicFacts({ title: "Song [120 BPM)" }).bpm, null);
});
