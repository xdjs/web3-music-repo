import test from "node:test";
import assert from "node:assert/strict";
import { applyPreservedPlaybackCopy } from "../src/preserved-playback-copy.mjs";
const record = {
  id: "test",
  chainId: 10,
  contract: "0x145ac4d1ad5817b28997a479a980ea1d5d53e3e9",
  tokenId: "1",
  kind: "audio",
};
const evidence = {
  status: "live",
  mediaURI: "ar://original",
  metadataURI: "ar://metadata/1",
  mediaURL: "https://arweave.net/original",
};
const copy = {
  recordId: record.id,
  expectedIdentity: record,
  sourceType: "spinamp-preserved-audio",
  source: "https://api.spinamp.xyz/v3/graphql",
  originalMediaURI: evidence.mediaURI,
  originalMetadataURI: evidence.metadataURI,
  indexedReference: {
    ...record,
    mediaURI: evidence.mediaURI,
    tokenUri: evidence.metadataURI,
  },
  trackId: "optimism/" + record.contract + "/indexed-track",
  audioIpfsHash: "QmR9U9mrJUvJh4sJwEzSSdGVfNNa6QgNQ1kYhCXaH5KupH",
  verification: {
    status: "played",
    url: "https://ipfs.filebase.io/ipfs/QmR9U9mrJUvJh4sJwEzSSdGVfNNa6QgNQ1kYhCXaH5KupH",
    currentTime: 1,
    duration: 293.69,
    mediaType: "audio/mpeg",
    decodedAudioBytes: 50000,
    checkedAt: "2026-11-06T19:00:00.000Z",
  },
};
test("verified copy selects its proven URL while preserving immutable evidence and attribution", () => {
  const before = structuredClone(evidence),
    r = applyPreservedPlaybackCopy(record, evidence, copy);
  assert.equal(r.playback.workingURL, copy.verification.url);
  assert.equal(r.playback.sourceType, "spinamp-preserved-audio");
  assert.equal(r.playbackCopy.originalMetadataURI, evidence.metadataURI);
  assert.deepEqual(evidence, before);
  assert.equal(record.playback, undefined);
});
test("wrong source identity, stale original, unplayed audio or unsafe gateway cannot become playback copy", () => {
  for (const mutate of [
    (c) => (c.recordId = "other"),
    (c) => (c.expectedIdentity = { ...record, tokenId: "2" }),
    (c) => (c.originalMediaURI = "ar://other"),
    (c) =>
      (c.indexedReference = { ...c.indexedReference, tokenUri: "ar://other" }),
    (c) => (c.verification.status = "timeout"),
    (c) => (c.verification.currentTime = 0),
    (c) => (c.verification.mediaType = "video/mp4"),
    (c) => (c.verification.url = "https://example.org/ipfs/" + c.audioIpfsHash),
    (c) => (c.verification.url += "?unbound=1"),
    (c) => (c.audioIpfsHash = "different"),
  ]) {
    const c = structuredClone(copy);
    mutate(c);
    assert.equal(applyPreservedPlaybackCopy(record, evidence, c), record);
  }
  const corrected = {
    ...record,
    playback: { sourceType: "artist-supplied-correction" },
  };
  assert.equal(
    applyPreservedPlaybackCopy(corrected, evidence, copy),
    corrected,
  );
});
test("actual catalog wires only the two proven copies and retains their original NFT evidence", async () => {
  const { createCatalogLoader } = await import("../src/catalog-bundle.mjs");
  const { readFileSync } = await import("node:fs");
  const copies = JSON.parse(
    readFileSync(
      new URL("../data/spinamp/playback-copies.json", import.meta.url),
    ),
  ).records;
  assert.equal(Object.keys(copies).length, 2);
  const b = createCatalogLoader()();
  for (const [id, c] of Object.entries(copies)) {
    const r = b.records.find((r) => r.id === id);
    assert.equal(r.playback.workingURL, c.verification.url);
    assert.equal(r.playback.sourceType, "spinamp-preserved-audio");
    assert.equal(b.evidence[id].status, "live");
    assert.equal(b.evidence[id].mediaURI, c.originalMediaURI);
    assert.equal(b.evidence[id].mediaURL, c.originalMediaURL);
    assert.equal(b.evidence[id].metadataURI, c.originalMetadataURI);
  }
});
