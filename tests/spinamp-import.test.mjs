import test from "node:test";
import assert from "node:assert/strict";
import {
  nftIdentity,
  contentKey,
  makeCandidate,
  buildBundle,
} from "../scripts/spinamp-import.mjs";
const t = {
  id: "base/0x" + "a".repeat(40) + "/hash",
  title: "Song",
  platformId: "sound",
  artistId: "artist-source-id",
  artistByArtistId: { name: "Artist" },
  duration: 120,
  websiteUrl: "https://www.sound.xyz/artist/song",
};
const n = {
  chainId: "base",
  contractAddress: "0x" + "a".repeat(40),
  tokenId: "0",
  nftFactoryByNftFactoryId: { standard: "erc721" },
  mediaURI: "ipfs://QmSound",
  imageURI: "ipfs://QmCover",
  metadataArtist: "Artist",
  tokenUri: "ar://metadata",
  mimeType: "audio/wav",
};
test("exact NFT identity required; token zero preserved only when explicit", () => {
  assert.equal(nftIdentity(n).tokenId, "0");
  for (const changed of [
    { tokenId: null },
    { tokenId: "0x123" },
    { chainId: "solana" },
    { chainId: "sepolia" },
    { contractAddress: "abc" },
    { nftFactoryByNftFactoryId: { standard: "erc20" } },
  ])
    assert.equal(nftIdentity({ ...n, ...changed }), null);
});
test("content dedup preserves CID case and path, equates gateways", () => {
  assert.equal(
    contentKey("https://ipfs.io/ipfs/QmAb/track.mp3?download=1"),
    contentKey("ipfs://QmAb/track.mp3"),
  );
  assert.notEqual(contentKey("ipfs://QmAb"), contentKey("ipfs://Qmab"));
  assert.notEqual(contentKey("ipfs://QmAb/one"), contentKey("ipfs://QmAb/two"));
});
test("conflicting artist evidence is reviewable, not silently rewritten", () => {
  assert.equal(
    makeCandidate(
      t,
      { ...n, metadataArtist: "Another Artist" },
      { sound: "Sound" },
      "now",
    ).reason,
    "artist-attribution-conflict",
  );
});
test("artwork and missing original media cannot become playable imports", () => {
  for (const mediaURI of [null, "ipfs://QmCover", "https://x.example/a.jpg"])
    assert.ok(
      makeCandidate(t, { ...n, mediaURI }, { sound: "Sound" }, "now").reason,
    );
});
test("index assertions stay indexed and do not claim chain or playback checks", () => {
  const c = makeCandidate(t, n, { sound: "Sound" }, "now");
  assert.equal(c.evidence.status, "indexed");
  assert.equal(c.evidence.onchainVerified, false);
  assert.equal(c.evidence.playbackVerified, false);
  assert.equal(c.record.standard, "ERC721");
  assert.equal(c.record.platform, "Sound");
  assert.equal(c.evidence.mediaURI, n.mediaURI);
});
test("same NFT and same-contract same-media editions dedup; other chain remains distinct", () => {
  const old = { id: "old", ...nftIdentity(n) };
  const inv = { records: [t] };
  const refs = { references: { [t.id]: n }, updatedAt: "now" };
  assert.equal(
    buildBundle(inv, refs, { records: [old], evidence: {} }, { sound: "Sound" })
      .bundle.records.length,
    0,
  );
  const edition = { ...old, tokenId: "12" };
  assert.equal(
    buildBundle(
      inv,
      refs,
      {
        records: [edition],
        evidence: { old: { mediaURI: "https://ipfs.io/ipfs/QmSound" } },
      },
      { sound: "Sound" },
    ).bundle.records.length,
    0,
  );
  assert.equal(
    buildBundle(
      inv,
      refs,
      { records: [{ ...old, chainId: 1 }], evidence: {} },
      { sound: "Sound" },
    ).bundle.records.length,
    1,
  );
});
test("preserved index audio fallback is explicit and does not override original media", () => {
  const indexed = {
    ...t,
    lossyAudioUrl: "https://arweave.net/preserved-audio",
  };
  const c = makeCandidate(
    indexed,
    { ...n, mediaURI: null },
    { sound: "Sound" },
    "now",
  );
  assert.equal(c.evidence.sourceType, "spinamp-processed-media");
  assert.equal(c.evidence.originalMediaMissing, true);
  assert.equal(c.evidence.originalMediaURI, null);
  assert.equal(c.evidence.mediaURI, indexed.lossyAudioUrl);
  assert.equal(
    makeCandidate(indexed, n, { sound: "Sound" }, "now").evidence.mediaURI,
    n.mediaURI,
  );
});
