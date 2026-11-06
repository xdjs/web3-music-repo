import test from "node:test";
import assert from "node:assert/strict";
import { musicFacts } from "../src/music-facts.mjs";
test("metadata takes precedence over estimated BPM and low-confidence output is withheld", () => {
  assert.equal(
    musicFacts({
      note: "BPM: 140",
      audioAnalysis: { status: "estimated", bpm: 70 },
    }).bpm,
    140,
  );
  assert.equal(
    musicFacts({ audioAnalysis: { status: "needs-review", bpm: 127 } }).bpm,
    null,
  );
  const facts = musicFacts({
    audioAnalysis: { status: "estimated", bpm: 123.456 },
  });
  assert.equal(facts.bpm, 123.5);
  assert.match(facts.source, /estimated by Open BPM/);
  assert.equal(
    musicFacts({
      musicMetadata: { bpms: [120], keys: [] },
      audioAnalysis: { status: "estimated", bpm: 60 },
    }).bpm,
    120,
  );
});
