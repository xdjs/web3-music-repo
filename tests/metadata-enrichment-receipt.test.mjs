import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const read = (p) => JSON.parse(readFileSync(p));
test("indexed metadata overlays retain source attribution and portable exact NFT evidence", () => {
  const audit = read("data/metadata-enrichment-audit.json"),
    metadata = read("data/music-metadata.json").records,
    checkpoints = read("data/metadata-enrichment-checkpoint.json").records,
    sources = JSON.parse(
      gunzipSync(readFileSync("data/metadata-enrichment-sources.json.gz")),
    ).nfts;
  for (const record of audit.records) {
    const source = sources[record.nftId];
    assert.equal(source.nft.id, record.nftId);
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify(source.nft.metadata))
        .digest("hex"),
      record.metadataSha256,
    );
    assert.equal(checkpoints[record.recordId].nftId, record.nftId);
    assert.equal(checkpoints[record.recordId].schemaVersion, 6);
    if (record.improved) {
      const m = metadata[record.recordId];
      assert.equal(m.sourceType, "spinamp-indexed-metadata");
      assert.equal(m.onchainVerified, false);
      assert.equal(m.source, "https://api.spinamp.xyz/v3/graphql");
      assert.equal(m.schemaVersion, 6);
    }
  }
});
test("next bounded metadata pass advances beyond successful checkpoints", () => {
  const plan = JSON.parse(
    execFileSync(
      process.execPath,
      ["scripts/recover-indexed-music-metadata.mjs", "--plan", "--limit=10"],
      { maxBuffer: 1024 * 1024 },
    ),
  );
  const checkpoints = read("data/metadata-enrichment-checkpoint.json").records;
  assert.equal(plan.selectedRecords.length, 10);
  for (const id of plan.selectedRecords)
    assert.equal(checkpoints[id], undefined);
});
test("offline note extraction preserves indexed versus publisher source distinctions", () => {
  const notes = read("data/metadata-notes-enrichment.json"),
    metadata = read("data/music-metadata.json").records;
  for (const r of notes.records) {
    const m = metadata[r.recordId];
    assert.equal(
      m.sourceType || "original-document-or-publisher-snapshot",
      r.sourceType,
    );
    if (r.sourceType === "spinamp-indexed-metadata")
      assert.equal(m.onchainVerified, false);
  }
});
