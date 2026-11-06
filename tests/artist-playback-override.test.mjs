import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { applyArtistPlaybackOverride } from "../src/artist-playback-override.mjs";
import { createCatalogLoader } from "../src/catalog-bundle.mjs";
import { indexRecord } from "../src/catalog-presentation.mjs";
const id = "pete-zora-1-10d32bf55f5cbe66b068f2109ecf7475f0631d53-1";
const override = JSON.parse(readFileSync("data/artist-playback-overrides.json"))
  .records[id];
const record = {
  id,
  ...override.expectedIdentity,
  artist: "Xmane & Pete Rango",
  kind: "video",
  playback: {
    status: "played",
    workingURL: "https://old.example/original.mp4",
  },
};
const evidence = {
  status: "live",
  mediaURI: override.originalMediaURI,
  mediaURL: "https://old.example/original.mp4",
  metadataURI: "original immutable metadata",
};
test("approved corrected playback changes listening URL while retaining original evidence and attribution", () => {
  const before = structuredClone({ record, evidence, override }),
    next = applyArtistPlaybackOverride(record, evidence, override);
  assert.notEqual(next, record);
  assert.equal(next.playback.workingURL, override.playbackURL);
  assert.equal(next.playback.status, "artist-approved");
  assert.equal(next.playback.sourceType, "artist-supplied-correction");
  assert.equal(next.artist, record.artist);
  assert.equal(next.kind, "video");
  assert.equal(next.playbackOverride.originalMediaURI, evidence.mediaURI);
  assert.deepEqual({ record, evidence, override }, before);
});
test("changed token/source, unsigned override or unsafe URL cannot silently replace playback", () => {
  for (const change of [
    { recordId: "different" },
    { status: "draft" },
    { approvedBy: "" },
    { sha256: "bad" },
    { expectedIdentity: { ...override.expectedIdentity, tokenId: "2" } },
    { originalMediaURI: "ipfs://different" },
    { playbackURL: "https://external.example/file.mp4" },
    { playbackURL: "/media/../secret.mp4" },
    { playbackURL: "//external.example/file.mp4" },
  ])
    assert.equal(
      applyArtistPlaybackOverride(record, evidence, { ...override, ...change }),
      record,
    );
});
test("catalog integration and static asset hash select the approved video without rewriting NFT provenance", () => {
  const b = createCatalogLoader()(),
    r = b.records.find((r) => r.id === id),
    original = JSON.parse(
      readFileSync("data/pete-recovery/zora-recovered-media.json"),
    ).evidence[id],
    asset = readFileSync("public" + override.playbackURL);
  assert.deepEqual(b.evidence[id], original);
  assert.equal(r.playback.workingURL, override.playbackURL);
  assert.equal(
    indexRecord(r, b.evidence[id]).playback.workingURL,
    override.playbackURL,
  );
  assert.equal(asset.length, override.byteLength);
  assert.equal(
    createHash("sha256").update(asset).digest("hex"),
    override.sha256,
  );
  const receipt = JSON.parse(readFileSync(override.receipt));
  assert.equal(receipt.original.mediaURI, original.mediaURI);
  assert.equal(receipt.publishedAsset.sha256, override.sha256);
  assert.equal(receipt.artistApproval.approvedBy, "Pete Rango");
});
