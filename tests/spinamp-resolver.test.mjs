import test from "node:test";
import assert from "node:assert/strict";
import {
  needsRelationRetry,
  applyRelationResponse,
} from "../scripts/spinamp-resolve-nfts.mjs";
const group = [{ id: "a" }, { id: "b" }];
test("empty success is distinct from malformed or failed response; previous evidence survives errors", () => {
  const old = { musicMetadata: { hasLyrics: false } };
  const s = { references: { b: old }, failures: {} };
  applyRelationResponse(s, group, {
    data: {
      t0: { totalCount: 0, nodes: [] },
      t1: { totalCount: 1, nodes: [] },
    },
  });
  assert.equal(s.references.a, null);
  assert.equal(s.references.b, old);
  assert.ok(s.failures.b);
  assert.equal(needsRelationRetry(s, "a"), false);
  assert.equal(needsRelationRetry(s, "b"), true);
  applyRelationResponse(s, [{ id: "b" }], {
    errors: [{ path: ["t0"], message: "statement timeout" }],
    data: { t0: { totalCount: 0, nodes: [] } },
  });
  assert.equal(s.references.b, old);
  assert.equal(s.failures.b, "statement timeout");
});
test("successful representative retains metadata and relation count but does not claim all editions", () => {
  const s = { references: {}, failures: { a: "old" } };
  applyRelationResponse(s, [{ id: "a" }], {
    data: {
      t0: {
        totalCount: 7,
        nodes: [
          {
            nftByNftId: {
              id: "nft",
              metadata: { bpm: 123, lyrics: "One line\nAnother line" },
              tokenUri: "data:application/json,x",
            },
          },
        ],
      },
    },
  });
  assert.equal(s.relationCounts.a, 7);
  assert.equal(s.references.a.tokenUri, null);
  assert.equal(s.references.a.musicMetadataSchemaVersion, 5);
  assert.equal(
    s.references.a.musicMetadata.lyrics[0].text,
    "One line\nAnother line",
  );
  assert.equal(needsRelationRetry(s, "a"), false);
});
test("pending metadata and missing IDs are retried, not marked complete merely because keys exist", () => {
  assert.equal(
    needsRelationRetry({ references: { a: {} }, failures: {} }, "a"),
    true,
  );
  assert.equal(needsRelationRetry({ references: {}, failures: {} }, "a"), true);
});
