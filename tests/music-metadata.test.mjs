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

test("Sound enum keys normalize without guessing and original lyric text is retained", () => {
  const r = extractMusicMetadata({
    key: "C_SHARP_MINOR",
    releaseDate: "2022-05-01",
    lyrics: { text: "An original lyric" },
  });
  assert.deepEqual(r.keys, ["C# MINOR"]);
  assert.deepEqual(r.details["Release date"], ["2022-05-01"]);
  assert.equal(r.hasLyrics, true);
  assert.equal(r.details.Lyrics, undefined);
  assert.deepEqual(r.lyrics, [{ text: "An original lyric", field: "lyrics" }]);
});

test("a parent project contributes its title without copying project-wide credits or musical attributes", () => {
  const result = extractMusicMetadata({
    project: {
      title: "Shared album",
      bpm: 120,
      credits: "Every album musician",
      description: "Album narrative",
    },
  });
  assert.deepEqual(result.details, { Project: ["Shared album"] });
  assert.deepEqual(result.credits, []);
  assert.deepEqual(result.bpms, []);
});

test("Mint Songs collaboratorType credits are explicit names and roles, not payout addresses", () => {
  const result = extractMusicMetadata({
    credits: [
      { name: "WYMN", collaboratorType: "creator" },
      { address: "0x123", collaboratorType: "recipient" },
    ],
  });
  assert.deepEqual(result.credits, ["WYMN — creator"]);
});

test("TokenTraxx role maps retain named source credits and exclude payment identities", () => {
  const result = extractMusicMetadata({
    credits: {
      "Music & Lyrics Written by": "Taylor Alexander",
      "Produced by": "Terence Shaw",
      "Mixed by": "Terence Shaw",
      "Recorded at": "Beaches Records",
      "Visuals by": "Taylor Alexander",
      recipient: "0x123",
      share: 100,
      "Mastered by": "0x1234567890123456789012345678901234567890",
    },
  });
  assert.deepEqual(result.credits, [
    "Taylor Alexander — Music & Lyrics Written by",
    "Terence Shaw — Produced by",
    "Terence Shaw — Mixed by",
    "Beaches Records — Recorded at",
    "Taylor Alexander — Visuals by",
  ]);
});
test("scalar genre lists and object attributes remain explicit facts; musical layers do not invent tempo or key", () => {
  const result = extractMusicMetadata({
    genres: ["House", "Electronic"],
    attributes: { BPM: 124, Key: "F# minor" },
    properties: {
      attributes: [
        { trait_type: "Chords", value: "S3 Toy Flute" },
        { trait_type: "Vocals", value: "S3 Hennessy" },
      ],
    },
  });
  assert.deepEqual(result.bpms, [124]);
  assert.deepEqual(result.keys, ["F# minor"]);
  assert.deepEqual(result.details.Genre, ["House", "Electronic"]);
  assert.deepEqual(result.details["Chords layer"], ["S3 Toy Flute"]);
  assert.deepEqual(result.details["Vocals layer"], ["S3 Hennessy"]);
  assert.deepEqual(
    extractMusicMetadata({
      attributes: [{ trait_type: "Chords", value: "S3 Toy Flute" }],
    }).bpms,
    [],
  );
});
test("punctuated placeholder text is not recovered lyrics", () => {
  assert.equal(
    extractMusicMetadata({ lyrics: { text: "None." } }).hasLyrics,
    undefined,
  );
});
test("source notes only expose standalone explicit tempo and key statements", () => {
  const result = extractMusicMetadata({
    description:
      "I played 130 shows in 2022.\nBPM: 126\nKey: E Major\nMade this at 140 bpm with friends.",
  });
  assert.deepEqual(result.bpms, [126]);
  assert.deepEqual(result.keys, ["E Major"]);
  assert.deepEqual(
    extractMusicMetadata({
      description: "This album ranges from 80 to 130 BPM.",
    }).bpms,
    [],
  );
});
