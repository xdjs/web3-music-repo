import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMusicMetadataFacts,
  hasAdditionalMusicFacts,
  metadataSnapshotKey,
} from "../src/music-metadata-enrichment.mjs";
test("metadata enrichment is additive, preserves conflicts and does not invent estimates", () => {
  const before = {
    bpms: [120],
    keys: ["A minor"],
    credits: ["Alice — Producer"],
    details: { Description: ["Original notes"] },
    lyrics: [{ text: "Words", field: "lyrics" }],
  };
  const after = mergeMusicMetadataFacts(before, {
    bpms: [121],
    keys: [],
    credits: ["Bob — Mixer"],
    details: { Genre: ["House"] },
    lyrics: [{ text: "Words", field: "properties.lyrics" }],
  });
  assert.deepEqual(after.bpms, [120, 121]);
  assert.deepEqual(after.keys, ["A minor"]);
  assert.deepEqual(after.credits, ["Alice — Producer", "Bob — Mixer"]);
  assert.deepEqual(after.details.Description, ["Original notes"]);
  assert.equal(after.lyrics.length, 1);
  assert.equal(hasAdditionalMusicFacts(before, {}), false);
  assert.equal(
    hasAdditionalMusicFacts(before, { credits: ["Bob — Mixer"] }),
    true,
  );
});
test("snapshot identity never lowercases or coerces Solana mint identities into EVM", () => {
  assert.equal(
    metadataSnapshotKey({ chainId: "solana", mint: "ABcDEF", tokenId: null }),
    null,
  );
  assert.equal(
    metadataSnapshotKey({
      chainId: 1,
      contract: "0x" + "aB".repeat(20),
      tokenId: "10",
    }),
    "1-0x" + "ab".repeat(20) + "-10",
  );
  assert.equal(
    metadataSnapshotKey({
      chainId: 1,
      contract: "0x" + "aB".repeat(20),
      tokenId: null,
    }),
    null,
  );
});
