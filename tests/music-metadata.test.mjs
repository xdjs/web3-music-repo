import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { extractMusicMetadata } from "../src/extract-music-metadata.mjs";
test("CHAOS attributes and song-specific collaborators survive metadata extraction", () => {
  const raw = JSON.parse(readFileSync("data/chaos-metadata-sample.json"));
  const result = extractMusicMetadata(raw);
  assert.deepEqual(result.bpms, [120]);
  assert.deepEqual(result.keys, ["E Major"]);
  assert.match(result.credits[0], /Three Oscillators - Producer\/Mixer/);
  assert.match(result.collaborators[0], /Kyle Tolbert/);
  assert.ok(!result.credits.join("").includes("The Goddess Of Chaos"));
});
test("unrelated keys, payment recipients and invalid tempo values are not musical metadata", () => {
  const result = extractMusicMetadata({
    key: "api-key",
    tempo: "fast",
    bpm: -1,
    credits: [{ address: "0x123", share: 50 }],
    attributes: [{ trait_type: "Paper", value: "Blue" }],
  });
  assert.deepEqual(result, {
    bpms: [],
    keys: [],
    collaborators: [],
    credits: [],
    details: {},
  });
});

test("Sound enum keys normalize without guessing and lyrics remain a source reference", () => {
  const r = extractMusicMetadata({
    key: "C_SHARP_MINOR",
    releaseDate: "2022-05-01",
    lyrics: { text: "An original lyric" },
  });
  assert.deepEqual(r.keys, ["C# MINOR"]);
  assert.deepEqual(r.details["Release date"], ["2022-05-01"]);
  assert.equal(r.hasLyrics, true);
  assert.equal(r.details.Lyrics, undefined);
});
